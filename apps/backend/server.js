const express = require("express");
const { version } = require("./package.json");
const tf = require("@tensorflow/tfjs");
const cors = require("cors");
const helmet = require("helmet");
const multer = require("multer");
const sharp = require("sharp");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");

const app = express();
app.disable("x-powered-by");

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIMETYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_MIMETYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, WebP, or GIF images are allowed"));
    }
  },
});
const isProd = process.env.NODE_ENV === "production";

// Security headers (CSP starts from default-src 'self', tightened for same-origin app)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// Trust the first proxy hop (Railway, Render, etc.) so rate-limiter
// reads the real client IP from X-Forwarded-For instead of the proxy IP
app.set("trust proxy", 1);

// CORS — open in dev, locked to ALLOWED_ORIGIN in production.
// Fail closed: prod without ALLOWED_ORIGIN serves same-origin only (no CORS headers).
const allowedOrigin = process.env.ALLOWED_ORIGIN;
if (isProd) {
  if (allowedOrigin) {
    app.use(cors({ origin: allowedOrigin }));
  } else {
    console.warn("ALLOWED_ORIGIN not set — CORS disabled, same-origin only.");
    app.use(cors({ origin: false }));
  }
} else {
  app.use(cors());
}

app.use(express.json({ limit: "100kb" }));

// Rate limit prediction endpoints — 60 requests per minute per IP
const predictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
});

let model;

async function loadModel() {
  try {
    model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [784], units: 128, activation: "relu" }),
        tf.layers.dense({ units: 64, activation: "relu" }),
        tf.layers.dense({ units: 10, activation: "softmax" }),
      ],
    });

    const modelDir = path.join(__dirname, "model");
    const modelJson = JSON.parse(fs.readFileSync(path.join(modelDir, "model.json"), "utf8"));
    const weightSpecs = modelJson.weightsManifest[0].weights;
    const weightsBuf = fs.readFileSync(path.join(modelDir, "group1-shard1of1.bin"));
    const weightData = weightsBuf.buffer.slice(
      weightsBuf.byteOffset,
      weightsBuf.byteOffset + weightsBuf.byteLength
    );

    const decoded = tf.io.decodeWeights(weightData, weightSpecs);
    model.setWeights(weightSpecs.map((spec) => decoded[spec.name]));

    if (!isProd) {
      console.log("Model loaded successfully");
      console.log("Input shape:", model.inputs[0].shape);
      console.log("Output shape:", model.outputs[0].shape);
    }
  } catch (error) {
    console.error("Failed to load model:", error);
    process.exit(1);
  }
}

async function preprocessImage(imageBuffer) {
  const processedImage = await sharp(imageBuffer).resize(28, 28).grayscale().raw().toBuffer();

  const pixels = new Float32Array(784);
  for (let i = 0; i < 784; i++) {
    pixels[i] = processedImage[i] / 255.0;
  }
  return pixels;
}

function validateRawData(data) {
  if (!data || !Array.isArray(data) || data.length !== 784) {
    return "Invalid input: expected 784 values";
  }
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) {
      return `Invalid input: value at index ${i} must be a finite number between 0 and 1`;
    }
  }
  return null;
}

app.post("/predict/image", predictLimiter, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    let pixels;
    try {
      pixels = await preprocessImage(req.file.buffer);
    } catch {
      return res.status(400).json({ error: "Invalid image file" });
    }
    const inputTensor = tf.tensor2d([pixels], [1, 784]);
    const prediction = model.predict(inputTensor);
    const probabilities = await prediction.data();
    const predictedClass = prediction.argMax(-1).dataSync()[0];

    inputTensor.dispose();
    prediction.dispose();

    res.json({
      predictedClass,
      probabilities: Array.from(probabilities),
      confidence: probabilities[predictedClass],
    });
  } catch (error) {
    console.error("Prediction error:", error);
    res.status(500).json({ error: "Prediction failed" });
  }
});

app.post("/predict/raw", predictLimiter, async (req, res) => {
  try {
    const { data } = req.body ?? {};

    const validationError = validateRawData(data);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const inputTensor = tf.tensor2d([data], [1, 784]);
    const started = performance.now();
    const prediction = model.predict(inputTensor);
    const probabilities = await prediction.data();
    const inferenceMs = Math.round((performance.now() - started) * 10) / 10;
    const predictedClass = prediction.argMax(-1).dataSync()[0];

    inputTensor.dispose();
    prediction.dispose();

    res.json({
      predictedClass,
      probabilities: Array.from(probabilities),
      confidence: probabilities[predictedClass],
      inferenceMs,
    });
  } catch (error) {
    console.error("Prediction error:", error);
    res.status(500).json({ error: "Prediction failed" });
  }
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    modelLoaded: !!model,
    version,
    layers: [128, 64, 10],
    params: model ? model.countParams() : null,
  });
});

// Serve built frontend in production
if (isProd) {
  const distPath = path.join(__dirname, "../web/dist");
  app.use(express.static(distPath));
  // SPA fallback — any unmatched route returns index.html
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// Centralized error handler — keeps multer/body-parser failures as generic JSON,
// never leaks stack traces or internal details to clients.
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "Image too large (max 5MB)" });
    }
    return res.status(400).json({ error: "Invalid upload" });
  }
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body too large" });
  }
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Malformed JSON body" });
  }
  if (err && err.message === "Only JPEG, PNG, WebP, or GIF images are allowed") {
    return res.status(400).json({ error: err.message });
  }
  console.error("Unhandled error:", err);
  return res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 5000;

loadModel().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} [${isProd ? "production" : "development"}]`);
  });
});
