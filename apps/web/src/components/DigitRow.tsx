import { cn } from "@/lib/utils";

interface DigitRowProps {
  digit: number;
  prob: number;
  rank: number;
  isTop: boolean;
}

export function DigitRow({ digit, prob, rank, isTop }: DigitRowProps) {
  return (
    <div
      className="grid items-center gap-3 py-2 border-b border-border last:border-b-0 animate-fade-in-up"
      style={{
        gridTemplateColumns: "24px 28px 1fr 56px",
        animationDelay: `${rank * 40}ms`,
      }}
    >
      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">#{rank + 1}</span>
      <span
        className={cn(
          "font-mono text-lg tabular-nums",
          isTop ? "text-foreground font-semibold" : "text-muted-foreground"
        )}
      >
        {digit}
      </span>
      <div className="relative h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full origin-left animate-bar-grow",
            isTop ? "bg-primary" : "bg-foreground/30"
          )}
          style={{
            width: `${Math.max(prob * 100, 0.5)}%`,
            animationDelay: `${rank * 40 + 80}ms`,
          }}
        />
      </div>
      <span
        className={cn(
          "font-mono text-xs tabular-nums text-right",
          isTop ? "text-foreground font-semibold" : "text-muted-foreground"
        )}
      >
        {(prob * 100).toFixed(2)}%
      </span>
    </div>
  );
}
