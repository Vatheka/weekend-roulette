# Weekend Roulette: presentation guide

## 30-second pitch

“We built Weekend Roulette to help friends decide how to spend a day in Phnom Penh. You enter your budget, available time, and interests, then explore matching places or ask an AI companion to build a small plan. Our prototype connects data preparation, exploratory analysis, machine learning, an agent that calls tools, and deployment through one FastAPI app.”

“For this classroom demo, all venues and visitor records are synthetic. It demonstrates the system, not verified tourism information.”

## Four-minute live demo

1. **Explore (45 seconds).** Search “coffee conversation.” Set a $15 budget and indoor setting. Show how every result respects the filters. Open one card and explain entry, food, and transport estimates.
2. **Interaction (45 seconds).** Ask classmates to choose a mood. Use Surprise me, add two places to My day, and check the combined time and cost. If over budget, remove a stop or change the budget. Estimates include a simplified 20-minute transfer allowance, not real directions.
3. **AI agent (60 seconds).** Reset filters for a clean example. Open AI companion. Say “Plan an indoor afternoon under $20 for 4 friends.” Explain that the assistant uses local search, place-details, and itinerary functions, so its recommendations come from the project catalog instead of invented venues. Use live Ollama mode if configured. Otherwise explicitly call this the scripted offline workflow and explain that the LLM integration is implemented but inactive.
4. **Data and models (60 seconds).** Show Behind the picks: 150 venues, 7,500 visits, synthetic weather/category charts, and evaluation metrics. Explain that TF-IDF handles relevance; Random Forest predicts generated satisfaction. Whole attractions are held out during testing.
5. **Deployment (30 seconds).** Open `/docs` and `/api/health` to show the working API and model startup. One server serves the frontend and runs saved models.

## What each subject contributes

| Subject | Concrete contribution |
| --- | --- |
| Python and pandas | Load CSVs, derive costs, filter records, aggregate analytics |
| EDA and statistics | Category/weather comparisons, distributions, mean baseline |
| Machine learning | TF-IDF similarity and Random Forest regression |
| Evaluation | Grouped holdout, MAE, R², baseline comparison, no outcome leakage |
| Recommendation/text processing | Vectorized catalog text and cosine similarity |
| AI agents | Model-selected search/details/itinerary tools with bounded rounds |
| AI deployment | Joblib artifacts, FastAPI endpoints, startup loading, health check |
| Frontend | Responsive UI, preference controls, chat, and a saved day plan |

This prototype does not claim to train a neural network, use real-time travel data, or cover every course assignment. It applies the relevant parts in a working system.

## Questions to prepare for

- **Why synthetic data?** The goal was a working local prototype without scraping or paid data access. The catalog can later be replaced with verified licensed attraction data using the same schema.
- **Why not a vector database?** There are only 150 catalog rows. A small TF-IDF matrix is sufficient and easy to explain.
- **Is similarity a probability?** No. It measures overlap in text features and determines relevance ordering.
- **Why a baseline?** A model should improve over simply predicting the training-set average. The evaluation view shows both errors.
- **Are predictions reliable for real visitors?** No. Outcomes follow synthetic generation rules, so real-world validation would require real visitor data.
- **What makes it an agent?** In live mode, an LLM chooses tools, reads their outputs, and can make another tool call before answering. Offline mode is explicitly scripted.
- **Why no real map/navigation?** Generated coordinates do not identify real venues. Showing directions would misrepresent the demo data.

## Before class

- Run `bash run.sh` and open the app.
- If showing live AI, start Ollama, confirm the configured local model is available, and test one message before presenting. This computer already has `gemma4:e2b-mlx`; another computer may need its own model download.
- Keep default demo mode available if the model service is unavailable.
- Check `/api/health`; it reports the configured provider, dataset count, and model readiness.
