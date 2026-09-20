# Fraud Radar — Run Doc

Two processes: the FastAPI service (`127.0.0.1:8000`) and the Vite dev server
(`5173`). The frontend requests **relative `/api/*` paths**; `frontend/vite.config.js`
proxies them to the API, so the browser stays on one origin and no CORS is
involved in development. Override the target with `VITE_API_PROXY_TARGET`.
There is no hardcoded API base URL in the frontend any more, but **both
processes must run** for the UI to score anything.

## Reproduce the artifacts a fresh checkout needs

This workspace IS the main checkout, so there are no env files to copy. From scratch:

1. Python deps (API, training, migrations, tests):
   ```bash
   python -m venv venv
   source venv/Scripts/activate        # Windows Git Bash; venv/bin/activate elsewhere
   pip install -r requirements-dev.txt
   ```
2. Frontend deps:
   ```bash
   cd frontend && npm install
   ```
3. Model artifacts — `model/*.pkl` and `model/metadata.json` are gitignored and
   required at startup. `data/creditcard.csv` (Kaggle, gitignored) must exist first:
   ```bash
   python model/train.py
   ```
   Writes `fraud_model.pkl`, `scaler.pkl`, `feature_order.pkl`, `metadata.json`,
   and prints the held-out metrics. The API refuses to start with a clear message
   if any artifact is missing.
4. Database — nothing to do locally: SQLite at `data/fraud_radar.db` is created
   on startup (`FRAUD_RADAR_AUTO_CREATE_TABLES=true` by default). For Postgres,
   set `FRAUD_RADAR_DATABASE_URL` and run `alembic upgrade head` instead.

## Run the servers

> **Detaching on this machine: PowerShell is unusable.**
> The prescribed `Start-Process` recipe hangs, and so does
> `powershell -NoProfile -Command "Stop-Process -Id <pid> -Force"` — even
> `powershell -NoProfile -Command "Write-Output hello"` times out. Verified again
> after the API restart. Use Git Bash `nohup ... &` to start and
> `taskkill //PID <pid> //F` to stop.

Backend:

```bash
nohup venv/Scripts/python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 \
  > .freebuff/preview-backend.log 2> .freebuff/preview-backend.log.err < /dev/null &
```

Frontend — `nohup npm run dev &` hangs the calling shell (the npm shim keeps the
session alive), so invoke Vite directly. It is the same server `npm run dev` starts:

```bash
cd frontend
nohup node node_modules/vite/bin/vite.js --port 5173 < /dev/null \
  > ../.freebuff/preview-791a43bc-6201-4ae5-ad26-a53dfc43b15e.log \
  2> ../.freebuff/preview-791a43bc-6201-4ae5-ad26-a53dfc43b15e.log.err &
```

These detach commands can report a tool timeout while still starting
successfully — always confirm before concluding a start failed:

```bash
curl -s http://127.0.0.1:8000/health                              # {"status":"ok",...}
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/   # 200
netstat -ano | grep -E ":(8000|5173) " | grep LISTENING
```

- API: <http://127.0.0.1:8000> — OpenAPI docs at `/docs`
- Preview URL: <http://localhost:5173>

Both default ports were free at setup time. If one is taken, add `--port <free>`
to uvicorn and `--port <free>` to the Vite invocation, then register the new URL;
the frontend needs no change because it uses relative `/api` paths (if the API
moves, set `VITE_API_PROXY_TARGET`).

## Restarting the API after a code change

Uvicorn runs **without** `--reload` here, so backend edits need an explicit restart:

```bash
OLD=$(netstat -ano | grep ":8000 " | grep LISTENING | awk '{print $5}' | head -1)
taskkill //PID "$OLD" //F
nohup venv/Scripts/python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 \
  > .freebuff/preview-backend.log 2> .freebuff/preview-backend.log.err < /dev/null &
```

The Vite dev server hot-reloads frontend edits; no restart needed.

## Notes

The frontend is schema-driven: it renders whatever feature list `GET /model`
declares, so pointing it at a different model needs no frontend change. The
console keeps no dataset-specific presets, and the landing page scores a zero
vector (the mean row) rather than any baked-in sample.

## Checks

```bash
pytest                                              # 39 tests
ruff check backend model tests                      # Python lint
node .freebuff/check-keys.mjs                       # every t() key resolves in en + bn
cd frontend && npm run lint && npm run build        # ESLint + production build
```

`npm run build` writes `frontend/dist`; delete it afterwards if you do not want
it around.

## Docker alternative

```bash
cp .env.example .env      # set FRAUD_RADAR_API_KEYS
docker compose up --build # API :8000, UI :8080
```

Not verified in this environment — Docker is not installed here.

## Running instances (as of this session)

- API: port 8000, restarted after the `/model` response gained `dataset` and `runtime`
- Vite dev server: node, port 5173 — the registered preview
