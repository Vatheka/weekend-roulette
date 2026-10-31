import json
from unittest.mock import patch
import httpx
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app import agent


@pytest.fixture(scope='module')
def client():
    with TestClient(app) as client:
        yield client


def test_home_and_assets(client):
    assert client.get('/').status_code == 200
    assert 'Weekend Roulette' in client.get('/').text
    assert client.get('/static/app.js').status_code == 200
    assert client.get('/api/health').json()['catalog_rows'] == 150


def test_data_integrity(client):
    engine = app.state.engine
    assert len(engine.visits) == 7500
    assert engine.places.attraction_id.nunique() == 150
    assert engine.visits.attraction_id.isin(engine.places.attraction_id).all()
    assert engine.places.is_synthetic.all()


def test_hard_filters(client):
    preferences = {'budget': 15, 'minutes': 90, 'group_size': 4,
                   'group_type': 'family', 'rain_friendly': True, 'accessible': True}
    data = client.post('/api/search', json={'query': 'learning art', 'preferences': preferences, 'limit': 50}).json()
    assert data['results']
    for row in data['results']:
        assert row['estimated_total_cost_per_person_usd'] <= 15
        assert row['suggested_duration_minutes'] <= 90
        assert row['family_friendly'] and row['rain_friendly'] and row['wheelchair_accessible']
        assert 1 <= row['predicted_demo_satisfaction'] <= 5


def test_district_and_category(client):
    result = client.post('/api/search', json={'preferences': {'district': 'Daun Penh', 'category': 'park'}}).json()
    assert result['results']
    assert all(r['district'] == 'Daun Penh' and r['category'] == 'park' for r in result['results'])


def test_empty_matches_are_not_relaxed(client):
    data = client.post('/api/search', json={'preferences': {'budget': 0}}).json()
    assert data['total'] == 0 and data['results'] == []


def test_search_relevance(client):
    result = client.post('/api/search', json={'query': 'coffee conversation cafe', 'limit': 3}).json()
    assert all(r['category'] == 'cafe' for r in result['results'])


@pytest.mark.parametrize('body', [
    {'preferences': {'budget': -1}}, {'preferences': {'group_size': 0}},
    {'preferences': {'minutes': 0}}, {'limit': 1000}])
def test_invalid_inputs(client, body):
    assert client.post('/api/search', json=body).status_code == 422


def test_roulette_respects_constraints(client):
    result = client.post('/api/roulette', json={'preferences': {'category': 'cafe', 'budget': 12}}).json()
    assert 0 < len(result['results']) <= 3
    assert len(set(r['attraction_id'] for r in result['results'])) == len(result['results'])
    assert all(r['category'] == 'cafe' and r['estimated_total_cost_per_person_usd'] <= 12 for r in result['results'])


def test_details_and_unknown_id(client):
    assert client.get('/api/attractions/PP_DEMO_001').status_code == 200
    assert client.get('/api/attractions/missing').status_code == 404


def test_itinerary_reports_infeasible_totals(client):
    ids = ['PP_DEMO_001', 'PP_DEMO_002', 'PP_DEMO_003']
    response = client.post('/api/itinerary', json={'attraction_ids': ids, 'budget': 0, 'minutes': 15})
    data = response.json()
    assert response.status_code == 200
    assert not data['within_budget'] and not data['within_time']
    assert data['transfer_minutes'] == 40
    assert data['total_minutes'] == data['activity_minutes'] + 40
    assert client.post('/api/itinerary', json={'attraction_ids': [ids[0], ids[0]]}).status_code == 422
    assert client.post('/api/itinerary', json={'attraction_ids': ['missing']}).status_code == 404


def test_demo_chat_and_budget_memory(client):
    with patch.object(agent, 'PROVIDER', 'demo'):
        response = client.post('/api/chat', json={'message': 'Plan an indoor afternoon under $20 for 4 friends'}).json()
        assert response['mode'] == 'demo'
        assert response['trace'][0]['tool'] == 'search_places'
        assert response['results']
        assert all(r['environment'] == 'indoor' for r in response['results'])
        assert response['itinerary']['within_budget'] and response['itinerary']['within_time']
        second = client.post('/api/chat', json={'message': 'Make the budget $8', 'history': [
            {'role': 'user', 'content': 'indoor places under $20'}]}).json()
        assert second['preferences']['budget'] == 8
        assert all(r['estimated_total_cost_per_person_usd'] <= 8 for r in second['results'])


def test_live_agent_executes_tools_and_returns_results(client):
    calls = []
    def transport(request):
        body = json.loads(request.content)
        calls.append(body)
        if len(calls) == 1:
            return httpx.Response(200, json={'message': {'role': 'assistant', 'content': '', 'tool_calls': [
                {'function': {'name': 'search_places', 'arguments': {'query': 'coffee', 'preferences': {'category': 'cafe'}}}}]}})
        assert body['messages'][-1]['role'] == 'tool'
        assert body['messages'][-1]['tool_name'] == 'search_places'
        return httpx.Response(200, json={'message': {'role': 'assistant', 'content': 'Here are the fictional cafe options.'}})
    real_client = httpx.Client
    with patch.object(agent, 'PROVIDER', 'ollama'), patch.object(agent.httpx, 'Client',
            side_effect=lambda **kwargs: real_client(transport=httpx.MockTransport(transport), **kwargs)):
        result = client.post('/api/chat', json={'message': 'Find coffee'}).json()
    assert result['mode'] == 'ollama' and result['results']
    assert len(calls) == 2
    assert all(r['category'] == 'cafe' for r in result['results'])


def test_api_provider_tool_call_ids(client, monkeypatch):
    monkeypatch.setenv('LLM_API_BASE_URL', 'https://example.invalid/v1')
    monkeypatch.setenv('LLM_API_MODEL', 'test-model')
    monkeypatch.setenv('LLM_API_KEY', 'test-secret')
    calls = []
    def transport(request):
        body = json.loads(request.content); calls.append(body)
        if len(calls) == 1:
            msg = {'role': 'assistant', 'content': None, 'tool_calls': [{'id': 'call_1', 'type': 'function',
                'function': {'name': 'get_place_details', 'arguments': '{"attraction_id":"PP_DEMO_001"}'}}]}
        else:
            assert body['messages'][-1]['tool_call_id'] == 'call_1'
            msg = {'role': 'assistant', 'content': 'This is a fictional park.'}
        return httpx.Response(200, json={'choices': [{'message': msg}]})
    real_client = httpx.Client
    with patch.object(agent, 'PROVIDER', 'compatible'), patch.object(agent.httpx, 'Client',
            side_effect=lambda **kwargs: real_client(transport=httpx.MockTransport(transport), **kwargs)):
        result = client.post('/api/chat', json={'message': 'Tell me about PP_DEMO_001'}).json()
    assert result['mode'] == 'compatible' and len(result['results']) == 1


def test_llm_failure_is_explicit(client):
    with patch.object(agent, 'PROVIDER', 'ollama'), patch.object(agent.httpx, 'Client', side_effect=httpx.ConnectError('offline')):
        response = client.post('/api/chat', json={'message': 'Find a park'}).json()
    assert response['mode'] == 'demo' and response['warning']


def test_agent_cannot_widen_explicit_user_limits(client):
    from app.schemas import ChatRequest
    engine = app.state.engine
    body = ChatRequest(message='Find indoor cafes under $15 for 2 friends')
    base = agent.resolve_preferences(engine, body)
    result = agent.execute(engine, 'search_places', {'query': '', 'preferences': {
        'budget': 60, 'environment': 'any', 'category': 'any', 'group_size': 1}}, base)
    assert result['results']
    assert all(r['category'] == 'cafe' and r['environment'] == 'indoor'
               and r['estimated_total_cost_per_person_usd'] <= 15 for r in result['results'])


def test_model_evaluation_provenance(client):
    data = client.get('/api/analytics').json()
    metrics = data['metrics']
    assert metrics['train_rows'] + metrics['test_rows'] == 7500
    assert metrics['train_attractions'] + metrics['test_attractions'] == 150
    assert 'satisfaction_score' not in metrics['features']
    assert 'would_recommend' not in metrics['features']
    assert 0 <= metrics['mae'] <= 4
    assert len(data['categories']) == 10


def test_agent_itinerary_uses_actual_user_limits(client):
    from app.schemas import Preferences
    result = agent.execute(app.state.engine, 'build_itinerary', {
        'attraction_ids': ['PP_DEMO_001'], 'budget': 100, 'minutes': 480},
        Preferences(budget=0, minutes=15))
    assert not result['within_budget'] and not result['within_time']


def test_live_plan_completion_is_labeled(client):
    from app.schemas import ChatRequest
    engine = app.state.engine
    body = ChatRequest(message='Plan an indoor afternoon under $20')
    preferences = agent.resolve_preferences(engine, body)
    places = engine.search('coffee', preferences, 6)['results']
    result = agent.finish_live(engine, body, preferences, {'content': ''},
        {r['attraction_id']: r for r in places}, [], None)
    assert result['warning']
    assert result['itinerary']['within_budget'] and result['itinerary']['within_time']
    assert result['trace'][-1]['source'] == 'app completion step'
