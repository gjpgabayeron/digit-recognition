import { useRef, useEffect, useCallback } from "react";

const DISPLAY_SIZE = 112; // 4 × MODEL_SIZE (28) — clean 4:1 ratio
const MODEL_SIZE = 28;
const BLUR_PX = 0.575; // soft edge to match MNIST stroke style

interface DrawingCanvasProps {
  brush: number;
  isDrawing: boolean;
  setIsDrawing: (v: boolean) => void;
  onChange?: (state: { hasInk: boolean }) => void;
  clearKey: number;
}

export function DrawingCanvas({
  brush,
  isDrawing,
  setIsDrawing,
  onChange,
  clearKey,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const hasInkRef = useRef(false);

  const draw = (
    ctx: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to: { x: number; y: number }
  ) => {
    const w = (brush / MODEL_SIZE) * DISPLAY_SIZE;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.filter = `blur(${BLUR_PX}px)`;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  const resetCanvas = useCallback(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d")!;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    hasInkRef.current = false;
    onChange?.({ hasInk: false });
  }, [onChange]);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const dpr = window.devicePixelRatio || 1;
    cvs.width = DISPLAY_SIZE * dpr;
    cvs.height = DISPLAY_SIZE * dpr;
    const ctx = cvs.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.filter = `blur(${BLUR_PX}px)`;
    resetCanvas();
  }, [resetCanvas]);

  useEffect(() => {
    resetCanvas();
  }, [clearKey, resetCanvas]);

  const localPoint = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const sx = DISPLAY_SIZE / r.width;
    const sy = DISPLAY_SIZE / r.height;
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const p = localPoint(e);
    lastRef.current = p;
    // draw a dot by stroking a zero-length line (round caps produce a circle)
    draw(canvasRef.current!.getContext("2d")!, p, p);
    hasInkRef.current = true;
    onChange?.({ hasInk: true });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    const p = localPoint(e);
    draw(canvasRef.current!.getContext("2d")!, lastRef.current ?? p, p);
    lastRef.current = p;
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
    lastRef.current = null;
  };

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onLostPointerCapture={handlePointerUp}
        role="img"
        aria-label="Drawing canvas, pointer or touch. Draw a digit from 0 to 9, then press Predict or Enter."
        tabIndex={-1}
        className="block w-full h-full rounded-xl bg-black touch-none cursor-crosshair focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      />
      <div className="absolute inset-0 rounded-xl canvas-grid pointer-events-none" />
    </div>
  );
}
