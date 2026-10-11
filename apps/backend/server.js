const express = require("express");
const { version } = require("./package.json");
const tf = require("@tensorflow/tfjs");
const cors = require("cors");
const multer = require("multer");
const sharp = require("sharp");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const isProd = process.env.NODE_ENV === "production";

// Trust the first proxy hop (Railway, Render, etc.) so rate-limiter
// reads the real client IP from X-Forwarded-For instead of the proxy IP
app.set("trust proxy", 1);

// CORS — open in dev, locked to ALLOWED_ORIGIN in production
const allowedOrigin = process.env.ALLOWED_ORIGIN;
app.use(cors(isProd && allowedOrigin ? { origin: allowedOrigin } : undefined));

app.use(express.json({ limit: "10mb" }));

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

app.post("/predict/image", predictLimiter, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    const pixels = await preprocessImage(req.file.buffer);
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
    const { data } = req.body;

    if (!data || data.length !== 784) {
      return res.status(400).json({ error: "Invalid input: expected 784 values" });
    }

    const inputTensor = tf.tensor2d([data], [1, 784]);
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

app.get("/health", (req, res) => {
  res.json({ status: "ok", modelLoaded: !!model, version });
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

const PORT = process.env.PORT || 5000;

loadModel().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} [${isProd ? "production" : "development"}]`);
  });
});
