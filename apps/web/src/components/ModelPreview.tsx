import { useRef, useEffect } from "react";

interface ModelPreviewProps {
  tensor: { preview: ImageData } | null;
}

export function ModelPreview({ tensor }: ModelPreviewProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current || !tensor) return;
    ref.current.getContext("2d")!.putImageData(tensor.preview, 0, 0);
  }, [tensor]);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <canvas
        ref={ref}
        width={28}
        height={28}
        className="w-16 h-16 rounded-md border border-border bg-white"
        style={{ imageRendering: "pixelated" }}
      />
      <span className="font-mono text-[10px] text-muted-foreground">28×28 input</span>
    </div>
  );
}
