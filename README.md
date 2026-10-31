# Weekend Roulette · Phnom Penh

A beginner-friendly attraction discovery prototype with a browser frontend, FastAPI backend, saved ML models, and a tool-calling LLM agent. Everything needed for the offline demo is inside this project.

**This computer is already configured for live AI:** the local `.env` uses the existing Ollama model `gemma4:e2b-mlx`, and a real search/tool-response conversation was tested successfully. No new model download is needed on this computer. Keep Ollama running. If moving the project elsewhere, configure your own model or select `AGENT_PROVIDER=demo`.

**All 150 venues and 7,500 visitor experiences are fictional.** Prices, ratings, accessibility, hours, and coordinates are generated demo values. This app is not a real travel guide.

## Run the app

Python 3.11+ is recommended. A project-local virtual environment and dependencies were created during development. From this directory:

```bash
bash run.sh
```

Open **http://127.0.0.1:8000**. The same server serves the frontend and API, so there is no Node.js build, second frontend server, or CORS setup. API docs: **http://127.0.0.1:8000/docs**. First startup trains missing models automatically; give it a moment.

If setting up on another computer:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
bash run.sh
```

On Windows, use `.venv\Scripts\python` in place of `.venv/bin/python`, and launch with `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000` from the activated environment.

[requirements.lock.txt](./requirements.lock.txt) records the exact dependency versions tested on this Mac. Use it instead of the broad requirements file when reproducing this environment on a compatible Python/platform.

If port 8000 is already occupied, use `PORT=8001 bash run.sh`. Stop the running server with Ctrl+C before restarting after environment changes.

## What works

- **Explore:** free-text similarity search, district/category/mood filters, budget and time limits, group size and suitability, indoor/outdoor, rain and accessibility filters.
- **Surprise me:** randomly select up to three places from the full matching catalog.
- **Place details:** see generated costs, facilities, duration, hours, and suitability.
- **My day:** save up to three places locally, compare costs, and check whether their combined time and cost fit. No account needed.
- **AI companion:** chat with a bounded tool-calling LLM agent, or use an explicitly labeled scripted demo without downloads or keys. Tool inputs and outputs are visible.
- **Behind the picks:** synthetic EDA, category/weather charts, training/test counts, baseline comparison, MAE and R².
- **Deployment:** a FastAPI inference server, health endpoint, saved joblib artifacts, automatic training, and an optional Docker build.

The only external frontend resource is optional Google Fonts; system fonts keep the app usable offline. Illustrations are local SVGs, not photos of real venues.

## Enable the real AI agent

**Without configuration, mode defaults to `demo`: a scripted search-and-plan workflow, not an LLM.** It understands a few simple English budget/time/group/setting patterns. The local `.env` on this computer enables your existing Ollama model. For another computer, follow either option below.

### Option A: Ollama locally

1. Install and open [Ollama](https://ollama.com/download).
2. Download a tool-capable model:

```bash
ollama pull qwen3:4b
```

The [model listing](https://ollama.com/library/qwen3:4b) currently lists about 2.5 GB. Keep Ollama running; if its service is not already running, use `ollama serve` in a separate terminal. A message that the port is already in use usually means the service is already running.

3. Copy [.env.example](./.env.example) to `.env` and set:

```dotenv
AGENT_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:4b
```

4. Restart the app. Send “Plan an indoor afternoon under $20 for 4 friends.” The mode badge should say **LIVE LLM AGENT** and the trace should show the tools it called.

No separate Ollama Python SDK is needed: the backend calls its local HTTP API. The integration follows [Ollama's tool-calling protocol](https://docs.ollama.com/capabilities/tool-calling).

### Option B: a compatible hosted API

Use a provider/model that supports the chat-completions tool-calling protocol. Set `AGENT_PROVIDER=compatible`, `LLM_API_BASE_URL`, `LLM_API_KEY`, and `LLM_API_MODEL` in `.env`, then restart. The base URL should not include `/chat/completions`; the app appends that path. Keys stay on the backend. Requests can consume your provider credits. The current message, supplied conversation history, preferences, and retrieved demo records are sent to that provider.

For Docker with Ollama running on the host computer, use `OLLAMA_BASE_URL=http://host.docker.internal:11434` on Docker Desktop. Inside a container, localhost refers to the container.

### Agent flow

```text
Message + current filters + recent history
                  ↓
        LLM chooses a tool
                  ↓
 search_places / get_place_details / build_itinerary
                  ↓
  Validated local tool result → LLM
                  ↓
      Explanation + catalog cards + visible trace
```

The loop allows at most five model rounds and eight tool calls. Validation errors return to the model for correction. Connection failures, missing configuration, or incomplete tool calling produce an explicit warning and fall back to demo mode. LLM wording can still be imperfect; the structured result cards and tool trace show what the tools actually returned.

Hard budgets, time limits, and explicit common setting/group/category constraints are enforced by the backend even if the model omits them. If a planning request ends after a model-selected search without a calculated itinerary, the app adds a deterministic feasibility check over the retrieved places. The trace labels this **app completion step**, separately from **model** tool calls. If the model returns an empty explanation, a labeled catalog summary is shown. There may therefore be one additional app completion tool call beyond the model-call limit.

## Data and models

See the [data guide](./data/README.md) for all columns. The catalog has 150 unique fictional venues. The 7,500-row experience CSV repeats attraction attributes across 50 visits per venue. It is not 7,500 unique places.

**Recommendation pipeline:** description, name, category, interests, district and moods → TF-IDF unigrams/bigrams → cosine similarity → hard preference filters → ranked results. A small generated-rating term breaks ties. There is no need to download embedding models or run a vector database. No-query results rank by generated rating.

**Satisfaction pipeline:** pre-visit context and prices → categorical one-hot encoding → Random Forest regression. A grouped 80/20 split holds out whole attractions. `satisfaction_score`, `would_recommend`, and actual visit duration are excluded from inputs. The prediction is returned as `predicted_demo_satisfaction` in search results; it does not determine search ranking.

Retrain or run checks:

```bash
.venv/bin/python -m app.training
.venv/bin/python -m pytest -q
```

Artifacts are stored under [models/](./models/). Startup regenerates them if missing or if the data fingerprint/scikit-learn version changes. Only load model files created by this project; joblib is not a safe format for untrusted downloads. After changing the training code, retrain explicitly and restart the app.

The synthetic satisfaction rules deliberately depend on budget and rain suitability, so model results demonstrate a pipeline rather than validate real travel behavior. Mood tags and generated suitability flags are invented. The offline parser handles simple requests but cannot reliably interpret negation or arbitrary preference changes; use the UI filters or a live LLM for those cases.

## Project map

| Path | Purpose |
| --- | --- |
| [app/main.py](./app/main.py) | FastAPI routes and startup |
| [app/engine.py](./app/engine.py) | Search, model inference, itinerary, EDA |
| [app/training.py](./app/training.py) | Train, save, and evaluate models |
| [app/agent.py](./app/agent.py) | Tools, LLM loop, explicit demo fallback |
| [app/schemas.py](./app/schemas.py) | Input validation |
| [app/static/](./app/static/) | HTML/CSS/JavaScript frontend |
| [data/](./data/) | Included CSVs and data dictionary |
| [tests/test_app.py](./tests/test_app.py) | Data, API, filtering, agent protocol tests |
| [PRESENTATION.md](./PRESENTATION.md) | Suggested live demo and talking points |

## API examples

```bash
curl http://127.0.0.1:8000/api/health
curl -X POST http://127.0.0.1:8000/api/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"coffee conversation","preferences":{"budget":15,"environment":"indoor"},"limit":3}'
curl -X POST http://127.0.0.1:8000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"Plan an indoor afternoon under $20 for 4 friends"}'
```

## Optional container deployment

```bash
docker build -t weekend-roulette .
docker run --rm -p 8000:8000 weekend-roulette
```

The image trains its own models during build. Demo mode needs no credentials. To configure a model provider, pass a local environment file with `--env-file .env`. Docker was not required for the local demo. This is a classroom prototype without authentication, shared user accounts, or rate limiting; run locally for the presentation.

## Manual downloads

**None needed on this computer.** Python dependencies and datasets are installed, and the configured Ollama model is already available locally. Start Ollama if it has been stopped. On another computer, install the dependencies and optionally download a tool-capable model or configure compatible API credentials. The real model service is separate from the app.
