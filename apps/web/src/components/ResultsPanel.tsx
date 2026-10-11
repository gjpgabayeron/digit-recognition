import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DigitRow } from "./DigitRow";
import { ModelPreview } from "./ModelPreview";
import { SparkleIcon } from "./icons";
import { cn } from "@/lib/utils";

export interface PredictionResult {
  predictedClass: number;
  probabilities: number[];
  confidence: number;
  inferenceMs: number | null;
  tensor: { preview: ImageData };
}

export type PredictErrorKind = "offline" | "rejected" | "server" | "network";

interface ResultsPanelProps {
  result: PredictionResult | null;
  busy: boolean;
  error: PredictErrorKind | null;
  offline: boolean;
  onRetry: () => void;
  onReconnect: () => void;
}

const ERROR_COPY: Record<PredictErrorKind, { title: string; detail: string }> = {
  offline: {
    title: "Model is offline",
    detail: "The backend didn't answer. Check that it is running, then try again.",
  },
  rejected: {
    title: "Input was rejected",
    detail: "The server couldn't read that drawing. Try redrawing larger and centered.",
  },
  server: {
    title: "Prediction failed",
    detail: "The server hit an error. Your drawing is kept. Try again.",
  },
  network: {
    title: "Couldn't reach the server",
    detail: "Check your connection and that the backend is running, then try again.",
  },
};

const VISIBLE_RANK_COUNT = 4;

export function ResultsPanel({
  result,
  busy,
  error,
  offline,
  onRetry,
  onReconnect,
}: ResultsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (busy) {
    return (
      <div className="flex flex-col gap-6 animate-fade-in-up">
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Prediction
          </div>
          <div className="mt-1 text-lg font-semibold">Running the model…</div>
        </div>
        <div className="h-44 rounded-xl shimmer-bg animate-shimmer" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: VISIBLE_RANK_COUNT }).map((_, i) => (
            <div key={i} className="h-7 rounded-md shimmer-bg animate-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    const copy = ERROR_COPY[error];
    return (
      <div className="flex flex-col gap-6 animate-fade-in-up h-full">
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Prediction
          </div>
          <div className="mt-1 text-lg font-semibold">Something went wrong</div>
        </div>
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:p-5 flex flex-col gap-2"
        >
          <p className="text-sm font-semibold">{copy.title}</p>
          <p className="text-sm text-muted-foreground">{copy.detail}</p>
          <div className="pt-2">
            {error === "offline" ? (
              <Button onClick={onReconnect} size="sm">
                Reconnect
              </Button>
            ) : (
              <Button onClick={onRetry} size="sm">
                Try again
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    if (offline) {
      return (
        <div className="flex flex-col gap-6 animate-fade-in-up h-full">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Prediction
            </div>
            <div className="mt-1 text-lg font-semibold">Model offline</div>
          </div>
          <div
            role="status"
            className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:p-5 flex flex-col gap-2"
          >
            <p className="text-sm font-semibold">The model is offline</p>
            <p className="text-sm text-muted-foreground">
              The backend didn&apos;t answer. Your canvas is untouched. Reconnect to keep going.
              Checks again automatically.
            </p>
            <div className="pt-2">
              <Button onClick={onReconnect} size="sm">
                Reconnect
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-6 animate-fade-in-up h-full">
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Prediction
          </div>
          <div className="mt-1 text-lg font-semibold text-muted-foreground">Awaiting input</div>
        </div>
        <div className="h-44 rounded-xl border border-dashed border-border bg-muted/30 grid place-items-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground px-4 text-center">
            <div className="w-10 h-10 rounded-full border border-dashed border-muted-foreground/40 grid place-items-center">
              <SparkleIcon />
            </div>
            <span className="text-xs">Draw a digit 0-9, then press Predict</span>
          </div>
        </div>
        <div className="flex flex-col gap-2" aria-hidden="true">
          {Array.from({ length: VISIBLE_RANK_COUNT }).map((_, i) => (
            <div key={i} className="h-7 rounded-md bg-muted/60" style={{ opacity: 1 - i * 0.15 }} />
          ))}
        </div>
      </div>
    );
  }

  const sorted = result.probabilities.map((p, d) => ({ d, p })).sort((a, b) => b.p - a.p);
  const top = sorted[0];
  const second = sorted[1];
  const topPct = top.p * 100;
  const marginPts = (top.p - second.p) * 100;

  const band = topPct >= 80 ? "confident" : topPct >= 50 ? "uncertain" : "low-confidence";
  const rowTone: "emerald" | "amber" | "muted" =
    band === "uncertain" ? "amber" : band === "low-confidence" ? "muted" : "emerald";

  const visible = expanded ? sorted : sorted.slice(0, VISIBLE_RANK_COUNT);
  const hiddenCount = sorted.length - VISIBLE_RANK_COUNT;

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Prediction
          </div>
          <div className="mt-1 text-lg font-semibold">Best guess</div>
        </div>
        <p
          aria-live="polite"
          className={cn(
            "text-sm font-medium tabular-nums",
            band === "confident" && "text-emerald-300",
            band === "uncertain" && "text-amber-300",
            band === "low-confidence" && "text-muted-foreground"
          )}
        >
          {topPct.toFixed(1)}%
          {band === "confident"
            ? " confident"
            : band === "uncertain"
              ? ", close call"
              : ", low confidence"}
        </p>
      </div>

      {/* Hero digit */}
      <div
        aria-live="polite"
        className="relative rounded-xl border border-border bg-white/[0.03] p-4 sm:p-6 flex items-center gap-4 sm:gap-6 overflow-hidden"
      >
        <div className="font-mono text-[80px] sm:text-[120px] leading-none font-semibold text-foreground tracking-tighter">
          {top.d}
        </div>
        <div className="flex-1 flex flex-col gap-2">
          <div className="text-sm text-muted-foreground">Predicted digit</div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-3xl font-semibold tabular-nums">
              {topPct.toFixed(1)}
            </span>
            <span className="text-muted-foreground text-sm">%</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Runner-up <span className="font-mono text-foreground">{second.d}</span>{" "}
            <span className="font-mono">, {marginPts.toFixed(1)}% behind</span>
          </div>
          {typeof result.inferenceMs === "number" && (
            <div className="font-mono text-[11px] text-muted-foreground">
              classified in {result.inferenceMs.toFixed(1)}ms
            </div>
          )}
          {band === "uncertain" && (
            <div className="text-xs text-muted-foreground">
              Close call. Try thickening faint strokes.
            </div>
          )}
          {band === "low-confidence" && (
            <div className="text-xs text-muted-foreground">
              Unsure. Try redrawing larger and centered.
            </div>
          )}
        </div>
        <ModelPreview tensor={result.tensor} />
      </div>

      {/* Ranked list */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between pb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Ranked guesses
          </span>
          <span className="text-xs text-muted-foreground">ranked by likelihood</span>
        </div>
        <div className="flex flex-col">
          {visible.map((row, i) => (
            <DigitRow
              key={row.d}
              digit={row.d}
              prob={row.p}
              rank={i}
              isTop={i === 0}
              tone={i === 0 ? rowTone : undefined}
            />
          ))}
        </div>
        {hiddenCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 self-start text-muted-foreground"
          >
            {expanded ? "Show fewer" : `Show all 10 (${hiddenCount} more)`}
          </Button>
        )}
      </div>
    </div>
  );
}
