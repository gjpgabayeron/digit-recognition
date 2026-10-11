# Digit Recognizer

![CI](https://github.com/justCallMeJeg/digit-recognition/actions/workflows/ci.yml/badge.svg)
![Commitlint](https://github.com/justCallMeJeg/digit-recognition/actions/workflows/commitlint.yml/badge.svg)

A full-stack handwritten digit recognition app built on a Keras MNIST model. Draw a digit in the browser and the model classifies it in real time, returning a ranked probability list for all 10 classes.

**Live demo:** https://digitrecognitionict120.up.railway.app

---

## Features

- **Draw-to-predict** — freehand canvas with auto-centering and bounding-box preprocessing before inference
- **Ranked results** — all 10 digit classes sorted by probability with animated bars
- **28×28 preview** — shows the exact tensor sent to the model
- **Fast inference** — dense neural network runs in milliseconds via TensorFlow.js on Node.js

---

## Tech Stack

| Layer    | Technology                                              |
| -------- | ------------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, TailwindCSS v4, shadcn/ui   |
| Backend  | Node.js, Express, TensorFlow.js                         |
| Model    | Keras Sequential (Dense 784→128→64→10) trained on MNIST |
| Monorepo | Turborepo, npm workspaces                               |

---

## Project Structure

```
digit-recognition/
├── apps/
│   ├── backend/          # Express API + TensorFlow.js inference
│   │   ├── model/        # Converted TF.js model weights
│   │   └── server.js
│   └── web/              # React + Vite frontend
│       └── src/
│           ├── components/
│           └── App.tsx
├── scripts/
│   ├── convert_model.py  # Keras → TF.js weight converter
│   └── test_setup.py     # Verify model files and backend setup
├── model.keras           # Original Keras model
└── turbo.json
```

---

## Prerequisites

- **Node.js** v18 or higher
- **npm** v9 or higher
- **Python 3.9+** with `tensorflow` and `numpy` _(only needed to re-convert the model)_

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
# apps/web/.env  (already included — change if your backend runs on a different port)
VITE_API_URL=http://localhost:5000
```

### 3. Run in development

```bash
npm run dev
```

Starts both servers concurrently via Turbo:

| Service           | URL                   |
| ----------------- | --------------------- |
| Frontend (Vite)   | http://localhost:5173 |
| Backend (Express) | http://localhost:5000 |

### 4. Production build (local test)

```bash
npm run build   # compiles frontend to apps/web/dist/
npm run prod    # Express serves API + static frontend on port 5000
```

---

## Deploying to Railway

Railway hosts the backend and frontend as a single Node.js service. The `railway.json` config at the repo root handles the build and start commands automatically.

### Steps

1. Push the repo to GitHub (ensure `apps/web/dist/` and `node_modules/` are not committed)
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
3. Select this repository
4. In the Railway dashboard under **Variables**, add:

   | Variable         | Value                                                                                                  |
   | ---------------- | ------------------------------------------------------------------------------------------------------ |
   | `NODE_ENV`       | `production`                                                                                           |
   | `ALLOWED_ORIGIN` | your Railway public URL (e.g. `https://digit-recognizer.up.railway.app`) — set this after first deploy |

5. Railway will run `npm ci && npm run build` then start the server
6. Once deployed, copy the public URL and set it as `ALLOWED_ORIGIN` to lock CORS
7. Optional: set repo Variable `RAILWAY_URL` to the public URL so the `CD smoke check` workflow pings `/health` after `main` pushes

> **`VITE_API_URL` is not needed in production** — the frontend is served from the same Express server, so API calls use relative paths automatically.

---

## Code quality scaffold

| Check                           | Command                                                                 |
| ------------------------------- | ----------------------------------------------------------------------- |
| Lint all                        | `npm run lint`                                                          |
| Typecheck (web)                 | `npm run typecheck`                                                     |
| Format check / write            | `npm run format:check` / `npm run format:write`                         |
| Tests (backend smoke via Turbo) | `npm run test`                                                          |
| Model artifact check            | `cd scripts && pip install -r requirements.txt && python test_setup.py` |

CI (`.github/workflows/ci.yml`) runs lint → typecheck → format check → test → model check → build → advisory `npm audit` on pushes/PRs to `main`/`dev`. CD (`.github/workflows/cd.yml`) rebuilds prod on `main` and boots the server for a `/health` smoke test; Railway itself auto-deploys from GitHub.

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) and are enforced by commitlint + Husky (`feat:`, `fix:`, `chore:`, `docs:`, `ci:`, ...). Pre-commit runs `lint-staged` (Prettier + ESLint autofix).

---

## API Reference

### `GET /health`

Returns model load status.

```json
{ "status": "ok", "modelLoaded": true }
```

### `POST /predict/raw`

Accepts a flat array of 784 normalized float values (grayscale pixels, 0.0–1.0, black background).

**Request**

```json
{ "data": [0.0, 0.0, 0.95, ...] }
```

**Response**

```json
{
  "predictedClass": 7,
  "confidence": 0.982,
  "probabilities": [0.001, 0.003, 0.002, 0.001, 0.002, 0.001, 0.001, 0.982, 0.004, 0.003]
}
```

### `POST /predict/image`

Accepts a multipart form upload (`image` field). The backend resizes and normalizes the image automatically.

---

## Model Architecture

```
Input  →  Dense(128, relu)  →  Dense(64, relu)  →  Dense(10, softmax)
 784            128                  64                    10
```

Trained on the MNIST dataset (60,000 training / 10,000 test images).

### Re-converting the model

If you update `model.keras`, regenerate the TF.js weights:

```bash
cd scripts
pip install tensorflow numpy
python convert_model.py
# outputs to apps/backend/model/
```

---

Web App Created by Geger John Paul Gabayeron and Model Created by Joseph Mikhaeli Jalandoni
