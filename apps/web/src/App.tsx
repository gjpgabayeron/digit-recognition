import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useHealth } from "@/hooks/useHealth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DrawingCanvas } from "@/components/DrawingCanvas";
import { readModelTensor } from "@/lib/tensor";
import { ResultsPanel, type PredictionResult } from "@/components/ResultsPanel";
import { cn } from "@/lib/utils";

const API_URL = import.meta.env.VITE_API_URL ?? "";
const BRUSH_SIZE = 2.575;

export default function App() {
  const health = useHealth();
  const [brush] = useState(BRUSH_SIZE);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [clearKey, setClearKey] = useState(0);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  const onCanvasChange = useCallback(({ hasInk }: { hasInk: boolean }) => setHasInk(hasInk), []);

  const handleClear = () => {
    setClearKey((k) => k + 1);
    setResult(null);
    setBusy(false);
    setHasInk(false);
  };

  const handlePredict = async () => {
    const cvs = canvasContainerRef.current?.querySelector("canvas");
    if (!cvs || !hasInk) return;
    setBusy(true);
    setResult(null);
    setRevealed(true);
    try {
      const tensor = readModelTensor(cvs);
      const res = await fetch(`${API_URL}/predict/raw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: Array.from(tensor.data) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error(`Prediction failed — HTTP ${res.status}:`, body.error ?? res.statusText);
        toast.error(res.status >= 500 ? "Prediction failed" : "Invalid request", {
          description:
            res.status >= 500
              ? "The server encountered an error."
              : "The server rejected the input.",
        });
        setRevealed(false);
        return;
      }
      const json = await res.json();
      setResult({
        predictedClass: json.predictedClass,
        probabilities: json.probabilities,
        confidence: json.confidence,
        tensor,
      });
    } catch (err) {
      const isNetworkError = err instanceof TypeError;
      console.error("Prediction failed:", err);
      toast.error(isNetworkError ? "Could not reach the server" : "Something went wrong", {
        description: isNetworkError
          ? "Check that the backend is running."
          : "An unexpected error occurred.",
      });
      setRevealed(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full w-full flex flex-col lg:h-full lg:overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-white/70 backdrop-blur-sm shrink-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src="/favicon.png"
              alt="Digit Recognizer"
              className="w-7 h-7 rounded-md object-contain"
            />
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">Digit Recognizer</span>
              <span className="hidden sm:block text-[11px] text-muted-foreground">
                MNIST · Dense inference
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Badge variant="outline" className="gap-1.5 text-xs">
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  health.status === "loading" && "bg-muted-foreground/50 animate-pulse",
                  health.status === "online" && "bg-emerald-500",
                  health.status === "offline" && "bg-red-500"
                )}
              />
              <span className="hidden sm:inline">
                {health.status === "loading" && "checking…"}
                {health.status === "online" && "model online"}
                {health.status === "offline" && "model offline"}
              </span>
              <span className="sm:hidden">
                {health.status === "loading" && "checking"}
                {health.status === "online" && "online"}
                {health.status === "offline" && "offline"}
              </span>
            </Badge>
            <Badge variant="outline" className="font-mono text-xs">
              {health.version ? `v${health.version}` : "—"}
            </Badge>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex flex-col gap-4 sm:gap-6">
        {/* Page heading */}
        <div className="shrink-0 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Draw a digit</h1>
            <p className="hidden sm:block text-xs text-muted-foreground mt-1 max-w-xl">
              Sketch any digit from 0–9. Press{" "}
              <kbd className="font-mono text-[10px] bg-muted border border-border rounded px-1.5 py-0.5">
                Predict
              </kbd>{" "}
              to run the model — your stroke is downsampled to 28×28 grayscale and classified.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-3 text-[11px] text-muted-foreground shrink-0">
            <span>
              POST <span className="font-mono text-foreground">/predict/raw</span>
            </span>
          </div>
        </div>

        {/* Two-panel layout — single canvas instance shared across breakpoints */}
        <div
          className={cn(
            "flex-1 min-h-0 flex flex-col gap-4 sm:gap-6",
            "lg:grid lg:transition-[grid-template-columns] lg:duration-500 lg:ease-out",
            revealed
              ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
              : "lg:grid-cols-[minmax(0,1fr)_0fr]"
          )}
        >
          {/* Canvas card */}
          <Card className="p-4 sm:p-5 flex flex-col gap-4 overflow-hidden border-border">
            <CardContent className="p-0 flex flex-col gap-4 flex-1 min-h-0">
              <div className="flex items-start justify-between shrink-0">
                <div>
                  <h2 className="text-sm font-semibold">Canvas</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Drawing area · 28×28 model input
                  </p>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  {hasInk ? "ink detected" : "empty"}
                </Badge>
              </div>

              {/* canvas-area: responsive height on mobile, flex-fill on desktop */}
              <div
                ref={canvasContainerRef}
                className="canvas-area flex items-center justify-center
                           h-[min(72vw,360px)]
                           lg:h-auto lg:flex-1 lg:min-h-0"
              >
                <div className="canvas-fit">
                  <DrawingCanvas
                    brush={brush}
                    isDrawing={isDrawing}
                    setIsDrawing={setIsDrawing}
                    onChange={onCanvasChange}
                    clearKey={clearKey}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-border shrink-0">
                <Button
                  variant="outline"
                  onClick={handleClear}
                  disabled={!hasInk && !result && !busy}
                  className="flex-1"
                >
                  <EraserIcon />
                  Clear
                </Button>
                <Button onClick={handlePredict} disabled={!hasInk || busy} className="flex-1">
                  {busy ? (
                    <>
                      <SpinnerIcon />
                      Predicting…
                    </>
                  ) : (
                    <>
                      <SparkleIcon />
                      Predict
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Desktop results — animated side panel */}
          <div
            className={cn(
              "hidden lg:block overflow-hidden transition-all duration-500 min-h-0",
              revealed ? "opacity-100 max-w-full" : "opacity-0 max-w-0 pointer-events-none"
            )}
          >
            {revealed && (
              <Card className="p-5 animate-slide-in-right h-full overflow-y-auto border-border">
                <CardContent className="p-0">
                  <ResultsPanel result={result} busy={busy} />
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Mobile results — stacked below canvas, outside the grid */}
        {revealed && (
          <div className="lg:hidden animate-fade-in-up">
            <Card className="p-4 sm:p-5 border-border">
              <CardContent className="p-0">
                <ResultsPanel result={result} busy={busy} />
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </svg>
  );
}
function EraserIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 21h18" />
      <path d="M5 15L15 5l4 4-10 10H5v-4z" />
    </svg>
  );
}
function SpinnerIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className="animate-spin"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
