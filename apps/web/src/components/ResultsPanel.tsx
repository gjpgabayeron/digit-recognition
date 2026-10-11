import { Badge } from "@/components/ui/badge";
import { DigitRow } from "./DigitRow";
import { ModelPreview } from "./ModelPreview";

export interface PredictionResult {
  predictedClass: number;
  probabilities: number[];
  confidence: number;
  tensor: { preview: ImageData };
}

interface ResultsPanelProps {
  result: PredictionResult | null;
  busy: boolean;
}

export function ResultsPanel({ result, busy }: ResultsPanelProps) {
  if (busy) {
    return (
      <div className="flex flex-col gap-6 animate-fade-in-up">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Inference
            </div>
            <div className="mt-1 text-lg font-semibold">Analyzing…</div>
          </div>
          <Badge variant="outline" className="gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            running
          </Badge>
        </div>
        <div className="h-44 rounded-xl shimmer-bg animate-shimmer" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-7 rounded-md shimmer-bg animate-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col gap-6 animate-fade-in-up h-full">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Prediction
            </div>
            <div className="mt-1 text-lg font-semibold text-muted-foreground">Awaiting input</div>
          </div>
          <Badge variant="outline" className="gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
            idle
          </Badge>
        </div>
        <div className="h-44 rounded-xl border border-dashed border-border bg-muted/30 grid place-items-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <div className="w-10 h-10 rounded-full border border-dashed border-muted-foreground/40 grid place-items-center">
              <SparkleIcon />
            </div>
            <span className="text-xs">Draw something, then press Predict</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-7 rounded-md bg-muted/60" style={{ opacity: 1 - i * 0.12 }} />
          ))}
        </div>
      </div>
    );
  }

  const sorted = result.probabilities.map((p, d) => ({ d, p })).sort((a, b) => b.p - a.p);
  const top = sorted[0];
  const second = sorted[1];

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Prediction
          </div>
          <div className="mt-1 text-lg font-semibold">Top class</div>
        </div>
        <Badge
          variant="outline"
          className="gap-1.5 text-emerald-700 border-emerald-200 bg-emerald-50"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {(top.p * 100).toFixed(1)}% confident
        </Badge>
      </div>

      {/* Hero digit */}
      <div className="relative rounded-xl border border-border bg-gradient-to-b from-white to-muted/40 p-4 sm:p-6 flex items-center gap-4 sm:gap-6 overflow-hidden">
        <div className="font-mono text-[80px] sm:text-[120px] leading-none font-semibold text-foreground tracking-tighter">
          {top.d}
        </div>
        <div className="flex-1 flex flex-col gap-2">
          <div className="text-sm text-muted-foreground">Predicted digit</div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-3xl font-semibold tabular-nums">
              {(top.p * 100).toFixed(1)}
            </span>
            <span className="text-muted-foreground text-sm">%</span>
          </div>
          <div className="text-xs text-muted-foreground">
            next: <span className="font-mono text-foreground">{second.d}</span>{" "}
            <span className="font-mono">({(second.p * 100).toFixed(1)}%)</span>
          </div>
        </div>
        <ModelPreview tensor={result.tensor} />
      </div>

      {/* Ranked list */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between pb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            All classes
          </span>
          <span className="text-xs text-muted-foreground">sorted by probability</span>
        </div>
        <div className="flex flex-col">
          {sorted.map((row, i) => (
            <DigitRow key={row.d} digit={row.d} prob={row.p} rank={i} isTop={i === 0} />
          ))}
        </div>
      </div>
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
