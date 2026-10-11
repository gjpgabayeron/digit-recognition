# AGENTS.md — digit-recognition

Turborepo + npm workspaces. Two apps: `apps/backend` (Express + TF.js inference), `apps/web` (React 19 + Vite + Tailwind v4 + shadcn).

## Commands (repo root)

- `npm install` — install all workspaces (npm only; `packageManager: npm@10.9.2`, Node >=18, `.nvmrc` pins 20)
- `npm run dev` — runs both apps via Turbo (web `:5173`, backend `:5000`)
- `npm run build` — `turbo run build`; only `apps/web` has a real build (`tsc -b && vite build` → `apps/web/dist/`)
- `npm run prod` — prod check locally: `NODE_ENV=production node apps/backend/server.js` (Express serves API + `../web/dist` on `:5000`). Always `npm run build` first.
- `npm run lint` / `typecheck` — `turbo run lint` (ESLint: web + backend) / `turbo run typecheck` (web `tsc --noEmit`); backend is plain JS, no typecheck
- `npm run test` — `turbo run test`; backend runs `node --test test/smoke.test.js` (model artifacts, route guards, `/health` shape), web has no tests yet. Python check: `cd scripts && pip install -r requirements.txt && python test_setup.py` (must run from `scripts/`; uses relative `../` paths, writes `scripts/test_input.json`)
- `npm run format:check` / `format:write` — Prettier repo-wide (`AGENTS.md`, `LICENSE.md`, `apps/backend/model/`, `package-lock.json` ignored)

## Architecture quirks

- Backend does NOT use `@tensorflow/tfjs-node`. `apps/backend/server.js` rebuilds the topology in code (`Dense 784→128 relu →64 relu →10 softmax`) and loads weights manually via `tf.io.decodeWeights` from `apps/backend/model/model.json` + `group1-shard1of1.bin`. Keep layer sizes/activations in sync with `model.keras`. Model-load failure calls `process.exit(1)`.
- Frontend preprocessing lives in `apps/web/src/lib/tensor.ts` (`readModelTensor`): downscale → tight bbox (threshold >10) → rescale to 28×28 with 2px padding → 784 floats 0–1, black background. `POST /predict/raw` requires exactly 784 values; anything else is a 400.
- API base is `import.meta.env.VITE_API_URL ?? ''` (`App.tsx`, `hooks/useHealth.ts`). Dev value comes from `apps/web/.env` (`VITE_API_URL=http://localhost:5000`, gitignored but present locally). In production leave it empty — frontend is same-origin served by Express, so relative paths are correct.
- Path alias `@` → `apps/web/src` (`vite.config.ts`). Backend static path assumes `../web/dist` relative to `server.js`; don't move either without updating `server.js`.
- Backend prod behavior: `trust proxy, 1`; CORS open in dev, locked to `ALLOWED_ORIGIN` when `NODE_ENV=production`; `/predict/*` rate-limited 60 req/min/IP; `GET /health` returns `{ status, modelLoaded, version }`; SPA fallback `app.get('*')` serves `index.html`.

## Model workflow

- Source of truth: root `model.keras` (committed). Converted weights in `apps/backend/model/` (committed, required at runtime).
- To re-convert after changing `model.keras`: `cd scripts && pip install tensorflow numpy && python convert_model.py` (outputs to `../apps/backend/model/`; must run from `scripts/`).

## Deploy (Railway)

- Single service per `railway.json`: build `npm install && npm run build`, start `NODE_ENV=production node apps/backend/server.js` (NIXPACKS). `PORT` is injected by Railway; defaults to 5000 locally.
- After first deploy, set `ALLOWED_ORIGIN` to the public URL to lock CORS. Do not set `VITE_API_URL` in production.
## Git & deploy safety (humans own these)

- AI must NOT run `git commit`, `git push`, `git merge`/`rebase`, tag/release commands, or Railway deploys/promotions. Humans run them manually.
- AI may run read-only inspection (`git status`, `git diff`, `git log`) and stage nothing.
- When a task needs a git/deploy step, stop and give the human copy-pasteable step-by-step instructions (exact commands, order, and values) instead of executing them.
- Never commit `apps/web/dist/`, `node_modules/`, or `.env` files (see `.gitignore`).
