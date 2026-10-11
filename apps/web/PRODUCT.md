# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Students and curious visitors trying a draw-to-predict ML demo in the browser. They sketch a digit 0–9 and want an immediate, understandable classification.

## Product Purpose

A browser canvas that classifies handwritten digits via an MNIST dense model. It exists to make inference tangible: draw, predict, and see what the model saw and how confident it is. Success is a visitor completing the draw → predict → interpret loop without help.

## Positioning

Transparent pipeline over black-box answer. Unlike a demo that only returns a digit, this surface shows the 28×28 model input preview, all 10 ranked probabilities, and live model-online status — the mechanism is part of the product.

## Operating Context

Single responsive web app (`apps/web`, React 19 + Vite). Dev runs at `:5173` with `VITE_API_URL=http://localhost:5000`; production is same-origin static served by Express, so API calls use relative paths. Core workflow is Clear → draw → Predict → ranked results; results reveal as a side panel on desktop and stacked below canvas on mobile.

## Capabilities and Constraints

Confirmed:

- Freehand canvas with ink-detected / empty state, Clear and Predict actions (`apps/web/src/App.tsx`, `apps/web/src/components/DrawingCanvas.tsx`).
- Client preprocessing to 784 normalized floats via `readModelTensor` (`apps/web/src/lib/tensor.ts`); backend `POST /predict/raw` contract is an external dependency.
- Results panel with predicted class, confidence, all 10 ranked probability bars, and 28×28 preview (`apps/web/src/components/ResultsPanel.tsx`, `ModelPreview.tsx`, `DigitRow.tsx`).
- Health badge (model online / offline) and version badge via `useHealth` (`apps/web/src/hooks/useHealth.ts`).

Constraint: future work must preserve the draw-predict-interpret loop. Layout, copy, and styling outside that loop may change.

## Brand Commitments

Name: Digit Recognizer. Existing product copy includes “MNIST · Dense inference”, “Draw a digit”, “Canvas — Drawing area · 28×28 model input”. Favicon asset at `apps/web/public/favicon.png`. No binding visual direction beyond the name and honest technical voice.

## Evidence on Hand

- Live demo: https://digitrecognitionict120.up.railway.app
- Repo copy and API contract: `README.md` at repo root
- Incumbent implementation: `apps/web/src/App.tsx`, `apps/web/src/components/`, `apps/web/src/lib/tensor.ts`
- Credits: Web App by Geger John Paul Gabayeron; model by Joseph Mikhaeli Jalandoni (per root `README.md`). No testimonials, benchmarks, or marketing claims on hand; do not fabricate them.

## Product Principles

1. Show the model’s work — input preview and full ranking are first-class, not debug extras.
2. Keep the loop instant and forgiving — clear, retry, and empty states never trap the visitor.
3. Stay honest about confidence — low or failed predictions read as model limits, not user error.

## Accessibility & Inclusion

No product-specific standard established. Follow general best practice: keyboard-operable Clear/Predict, labeled canvas region, readable contrast for results.
