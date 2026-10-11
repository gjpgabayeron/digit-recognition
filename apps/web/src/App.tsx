import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useHealth } from "@/hooks/useHealth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DrawingCanvas } from "@/components/DrawingCanvas";
import { readModelTensor } from "@/lib/tensor";
import {
  ResultsPanel,
  type PredictionResult,
  type PredictErrorKind,
} from "@/components/ResultsPanel";
import { SparkleIcon, EraserIcon, SpinnerIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

const API_URL = import.meta.env.VITE_API_URL ?? "";
const BRUSH_SIZE = 2.575;

export default function App() {
  const health = useHealth();
  const brush = BRUSH_SIZE;
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [clearKey, setClearKey] = useState(0);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(true);
  const [predictError, setPredictError] = useState<PredictErrorKind | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const onCanvasChange = useCallback(({ hasInk }: { hasInk: boolean }) => setHasInk(hasInk), []);

  const handleClear = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setClearKey((k) => k + 1);
    setResult(null);
    setPredictError(null);
    setBusy(false);
    setHasInk(false);
  }, []);

  const handlePredict = useCallback(async () => {
    const cvs = canvasContainerRef.current?.querySelector("canvas");
    if (!cvs || !hasInk || busy) return;
    if (health.status === "offline") {
      setResult(null);
      setPredictError("offline");
      setRevealed(true);
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    setResult(null);
    setPredictError(null);
    setRevealed(true);
    try {
      const tensor = readModelTensor(cvs);
      const res = await fetch(`${API_URL}/predict/raw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: Array.from(tensor.data) }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error(`Prediction failed — HTTP ${res.status}:`, body.error ?? res.statusText);
        setPredictError(res.status >= 500 ? "server" : "rejected");
        return;
      }
      const json = await res.json();
      setResult({
        predictedClass: json.predictedClass,
        probabilities: json.probabilities,
        confidence: json.confidence,
        inferenceMs: typeof json.inferenceMs === "number" ? json.inferenceMs : null,
        tensor,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const isNetworkError = err instanceof TypeError;
      console.error("Prediction failed:", err);
      setPredictError(isNetworkError ? "network" : "server");
      toast.error(isNetworkError ? "Couldn't reach the server" : "Something went wrong", {
        description: isNetworkError
          ? "Check that the backend is running, then retry."
          : "Your drawing is kept. Try again.",
      });
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      setBusy(false);
    }
  }, [hasInk, busy, health.status]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        (target &&
          (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable))
      ) {
        return;
      }
      // Shortcuts live in the canvas card's scope: body-level or inside it.
      // Focused buttons/links keep native behavior; focused elsewhere ignores.
      const inScope =
        !target || target === document.body || !!target.closest?.("[data-canvas-scope]");
      if (!inScope) return;
      if (e.key === "Enter") {
        // Let focused controls activate natively; shortcut is for canvas/body scope
        if (target?.closest?.("button, a, [role='button']")) return;
        e.preventDefault();
        void handlePredict();
      } else if (
        (e.key === "c" || e.key === "C") &&
        !target?.closest?.("button, a, [role='button']")
      ) {
        void handleClear();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlePredict, handleClear]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // An offline error is stale the moment the model is back — derive, don't store
  const visibleError =
    health.status === "online" && predictError === "offline" ? null : predictError;
  const offline = health.status === "offline";

  return (
    <div className="min-h-full w-full flex flex-col lg:h-full lg:overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm shrink-0">
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
                {typeof health.params === "number"
                  ? `MNIST dense, ${health.params >= 1000 ? `${Math.round(health.params / 1000)}k` : health.params} params`
                  : "MNIST dense model"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span
              aria-live="polite"
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
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
            </span>
            {health.status === "offline" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={health.retry}
                className="h-7 px-2 text-xs text-muted-foreground"
              >
                Reconnect
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex flex-col gap-4 sm:gap-6">
        {/* Page heading */}
        <div className="shrink-0 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Draw a digit</h1>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              Sketch any digit from 0-9. Draw it large and centered. Press{" "}
              <span className="inline-flex items-center rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground">
                Predict
              </span>{" "}
              or hit{" "}
              <kbd className="font-mono text-[11px] bg-muted border border-border rounded px-1.5 py-0.5">
                Enter
              </kbd>{" "}
              to run the model on a 28×28 grayscale of your drawing.
            </p>
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
          <Card
            data-canvas-scope
            className="p-4 sm:p-5 flex flex-col gap-4 overflow-hidden border-border"
          >
            <CardContent className="p-0 flex flex-col gap-4 flex-1 min-h-0">
              <div className="flex items-start justify-between shrink-0">
                <div>
                  <h2 className="text-sm font-semibold">Canvas</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Draw large and centered, model sees 28×28
                  </p>
                </div>
                <span
                  aria-live="polite"
                  className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground"
                >
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      hasInk ? "bg-emerald-400" : "bg-muted-foreground/50"
                    )}
                  />
                  {hasInk ? "ink detected" : "empty"}
                </span>
              </div>

              {/* canvas-area: responsive height on mobile, flex-fill on desktop */}
              <div
                ref={canvasContainerRef}
                className="canvas-area relative flex items-center justify-center
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
                {!hasInk && !busy && (
                  <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center px-6 text-center">
                    <span className="text-xs text-white/70">Draw a digit 0-9</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-border shrink-0">
                <Button
                  variant="outline"
                  onClick={handleClear}
                  disabled={!hasInk && !result && !predictError && !busy}
                  title="Clear the canvas (C)"
                  aria-keyshortcuts="c"
                  className="flex-1"
                >
                  <EraserIcon />
                  Clear
                  <kbd className="ml-1 rounded border border-current px-1 font-mono text-[10px] opacity-60">
                    C
                  </kbd>
                </Button>
                <Button
                  onClick={handlePredict}
                  disabled={!hasInk || busy || health.status === "offline"}
                  title={
                    health.status === "offline"
                      ? "Model is offline. Wait for it to come back"
                      : "Run the model (Enter)"
                  }
                  aria-keyshortcuts="Enter"
                  className="flex-1"
                >
                  {busy ? (
                    <>
                      <SpinnerIcon />
                      Predicting…
                    </>
                  ) : (
                    <>
                      <SparkleIcon />
                      Predict
                      <kbd className="ml-1 rounded border border-current px-1 font-mono text-[10px] opacity-60">
                        Enter
                      </kbd>
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
                  <ResultsPanel
                    result={result}
                    busy={busy}
                    error={visibleError}
                    offline={offline}
                    onRetry={handlePredict}
                    onReconnect={health.retry}
                  />
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
                <ResultsPanel
                  result={result}
                  busy={busy}
                  error={visibleError}
                  offline={offline}
                  onRetry={handlePredict}
                  onReconnect={health.retry}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
