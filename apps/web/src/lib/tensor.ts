const MODEL_SIZE = 28;

export function readModelTensor(canvas: HTMLCanvasElement): {
  data: Float32Array;
  preview: ImageData;
} {
  // Step 1: downscale display canvas → 28×28
  const tmp = document.createElement("canvas");
  tmp.width = MODEL_SIZE;
  tmp.height = MODEL_SIZE;
  const ctx = tmp.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, MODEL_SIZE, MODEL_SIZE);
  ctx.drawImage(canvas, 0, 0, MODEL_SIZE, MODEL_SIZE);
  const raw = ctx.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE);

  // Step 2: find tight bounding box of inked pixels (threshold > 10 to ignore anti-alias noise)
  let minX = MODEL_SIZE,
    maxX = -1,
    minY = MODEL_SIZE,
    maxY = -1;
  for (let y = 0; y < MODEL_SIZE; y++) {
    for (let x = 0; x < MODEL_SIZE; x++) {
      if (raw.data[(y * MODEL_SIZE + x) * 4] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Step 3: if ink found, scale bounding box content to fill 28×28 with 2px padding, centered
  let finalImg: ImageData;
  if (maxX >= minX && maxY >= minY) {
    const pad = 2;
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const scale = (MODEL_SIZE - pad * 2) / Math.max(bw, bh);
    const sw = bw * scale;
    const sh = bh * scale;
    const dx = Math.round((MODEL_SIZE - sw) / 2);
    const dy = Math.round((MODEL_SIZE - sh) / 2);

    const out = document.createElement("canvas");
    out.width = MODEL_SIZE;
    out.height = MODEL_SIZE;
    const outCtx = out.getContext("2d")!;
    outCtx.fillStyle = "#000";
    outCtx.fillRect(0, 0, MODEL_SIZE, MODEL_SIZE);
    outCtx.imageSmoothingEnabled = true;
    outCtx.imageSmoothingQuality = "high";
    outCtx.drawImage(tmp, minX, minY, bw, bh, dx, dy, sw, sh);
    finalImg = outCtx.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE);
  } else {
    finalImg = raw;
  }

  const data = new Float32Array(MODEL_SIZE * MODEL_SIZE);
  for (let i = 0; i < data.length; i++) {
    data[i] = finalImg.data[i * 4] / 255;
  }
  return { data, preview: finalImg };
}
