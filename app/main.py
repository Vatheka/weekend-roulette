from contextlib import asynccontextmanager
import random
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from .config import ROOT, PROVIDER
from .engine import Engine
from .schemas import SearchRequest, ChatRequest, ItineraryRequest
from .training import ensure_trained
from .agent import chat


@asynccontextmanager
async def lifespan(app):
    app.state.engine = Engine(ensure_trained())
    yield


app = FastAPI(title='Weekend Roulette', version='1.0.0', lifespan=lifespan)
app.mount('/static', StaticFiles(directory=ROOT / 'app' / 'static'), name='static')


@app.get('/')
def home():
    return FileResponse(ROOT / 'app' / 'static' / 'index.html')


@app.get('/api/health')
def health(request: Request):
    return {'status': 'ok', 'provider': PROVIDER, 'models_loaded': True,
            'catalog_rows': len(request.app.state.engine.places), 'synthetic': True}


@app.get('/api/options')
def options(request: Request):
    engine = request.app.state.engine
    return {'districts': sorted(engine.places.district.unique().tolist()),
            'categories': sorted(engine.places.category.unique().tolist()), 'provider': PROVIDER}


@app.post('/api/search')
def search(body: SearchRequest, request: Request):
    return request.app.state.engine.search(body.query, body.preferences, body.limit)


@app.post('/api/roulette')
def roulette(body: SearchRequest, request: Request):
    found = request.app.state.engine.search(body.query, body.preferences, 150)
    found['results'] = random.sample(found['results'], min(3, len(found['results'])))
    return found


@app.get('/api/attractions/{attraction_id}')
def detail(attraction_id: str, request: Request):
    return request.app.state.engine.detail(attraction_id)


@app.post('/api/itinerary')
def itinerary(body: ItineraryRequest, request: Request):
    return request.app.state.engine.itinerary(body.attraction_ids, body.budget, body.minutes)


@app.post('/api/chat')
def agent_chat(body: ChatRequest, request: Request):
    return chat(request.app.state.engine, body)


@app.get('/api/analytics')
def analytics(request: Request):
    return request.app.state.engine.analytics()
