import { Sparkles, Eraser, LoaderCircle } from "lucide-react";

export function SparkleIcon() {
  return <Sparkles width={14} height={14} aria-hidden="true" />;
}

export function EraserIcon() {
  return <Eraser width={14} height={14} aria-hidden="true" />;
}

export function SpinnerIcon() {
  return (
    <LoaderCircle
      width={14}
      height={14}
      strokeWidth={2.5}
      className="animate-spin"
      aria-hidden="true"
    />
  );
}
