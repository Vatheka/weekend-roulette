"""Shared tools used by the API, demo workflow, and LLM agent."""
import json
import joblib
import numpy as np
import pandas as pd
from fastapi import HTTPException
from sklearn.metrics.pairwise import cosine_similarity
from .config import DATA, MODELS
from .schemas import Preferences
from .training import FEATURES


class Engine:
    def __init__(self, metrics):
        self.places = pd.read_csv(DATA / 'phnom_penh_attractions.csv')
        self.visits = pd.read_csv(DATA / 'phnom_penh_visitor_experiences.csv')
        self.index = joblib.load(MODELS / 'recommendations.joblib')
        self.model = joblib.load(MODELS / 'satisfaction.joblib')
        self.metrics = metrics
        assert self.index['ids'] == self.places.attraction_id.tolist()
        self.places['estimated_total_cost_per_person_usd'] = self.places[
            ['estimated_entry_fee_usd', 'estimated_food_cost_usd', 'estimated_transport_cost_usd']].sum(axis=1)

    def detail(self, attraction_id):
        rows = self.places[self.places.attraction_id == attraction_id]
        if rows.empty:
            raise HTTPException(404, 'Attraction not found')
        return json.loads(rows.iloc[0].to_json())

    def search(self, query='', preferences=None, limit=12):
        p = preferences or Preferences()
        frame = self.places.copy()
        keep = ((frame.estimated_total_cost_per_person_usd <= p.budget) &
                (frame.suggested_duration_minutes <= p.minutes) &
                (frame.min_group_size <= p.group_size) & (frame.max_group_size >= p.group_size))
        for field in ['district', 'category', 'environment']:
            value = getattr(p, field)
            if value != 'any':
                keep &= frame[field].str.casefold() == value.casefold()
        for enabled, field in [(p.rain_friendly, 'rain_friendly'), (p.accessible, 'wheelchair_accessible')]:
            if enabled:
                keep &= frame[field]
        if p.group_type in ['solo', 'family', 'couple']:
            keep &= frame[p.group_type + '_friendly']
        elif p.group_type == 'friends':
            keep &= frame.group_friendly
        if p.mood != 'any':
            keep &= frame.mood_tags.str.split(';').apply(lambda tags: p.mood in tags)
        search_text = query.strip()
        similarity = cosine_similarity(self.index['vectorizer'].transform([search_text]), self.index['matrix'])[0]
        frame['similarity'] = similarity
        frame = frame[keep].copy()
        # Similarity is a ranking score, never a probability of enjoyment.
        frame['ranking_score'] = (.85 * frame.similarity + .15 * (frame.estimated_rating / 5)) if search_text else frame.estimated_rating / 5
        frame = frame.sort_values(['ranking_score', 'attraction_id'], ascending=[False, True])
        total = len(frame)
        frame = frame.head(limit).copy()
        if len(frame):
            context = pd.DataFrame([{
                'budget_per_person_usd': p.budget, 'group_size': p.group_size,
                'available_time_minutes': p.minutes,
                'estimated_entry_fee_usd': row.estimated_entry_fee_usd,
                'estimated_food_cost_usd': row.estimated_food_cost_usd,
                'estimated_transport_cost_usd': row.estimated_transport_cost_usd,
                'category': row.category, 'environment': row.environment,
                'weather': 'rainy' if p.rain_friendly else 'sunny',
                'visitor_mood': p.mood if p.mood != 'any' else 'relaxed',
                'group_type': p.group_type if p.group_type != 'any' else 'friends',
            } for row in frame.itertuples()])
            frame['predicted_demo_satisfaction'] = np.round(np.clip(self.model.predict(context[FEATURES]), 1, 5), 2)
        records = json.loads(frame.to_json(orient='records'))
        for row in records:
            row['match_reasons'] = [
                f"${row['estimated_total_cost_per_person_usd']:.0f} estimated per person, within your ${p.budget:g} budget",
                f"{row['suggested_duration_minutes']} minutes; {row['environment']} activity",
                'Interests: ' + row['interest_tags'].replace(';', ', ')]
        return {'results': records, 'total': total, 'preferences': p.model_dump(),
                'notice': 'Synthetic demo listings. Prices, hours, ratings, and coordinates are invented.'}

    def itinerary(self, ids, budget, minutes):
        if len(set(ids)) != len(ids):
            raise HTTPException(422, 'Choose distinct attractions')
        stops = [self.detail(i) for i in ids]
        cost = sum(s['estimated_total_cost_per_person_usd'] for s in stops)
        activity_minutes = sum(s['suggested_duration_minutes'] for s in stops)
        transfer_minutes = max(0, len(stops) - 1) * 20
        return {'stops': stops, 'estimated_cost_per_person_usd': cost,
                'activity_minutes': activity_minutes, 'transfer_minutes': transfer_minutes,
                'total_minutes': activity_minutes + transfer_minutes,
                'within_budget': cost <= budget, 'within_time': activity_minutes + transfer_minutes <= minutes,
                'assumptions': 'Each stop includes its catalog entry, food, and transport estimate. Allow 20 minutes between stops. This is a stop list, not an opening-hours-checked or geographically optimized route.'}

    def analytics(self):
        v = self.visits
        category = v.groupby('category').agg(visits=('visit_id', 'size'), satisfaction=('satisfaction_score', 'mean')).reset_index()
        category.satisfaction = category.satisfaction.round(2)
        return {'metrics': self.metrics,
                'categories': json.loads(category.to_json(orient='records')),
                'districts': self.places.groupby('district').size().to_dict(),
                'weather': json.loads(v.groupby('weather').satisfaction_score.mean().round(2).reset_index().to_json(orient='records')),
                'mean_budget': round(float(v.budget_per_person_usd.mean()), 2),
                'mean_satisfaction': round(float(v.satisfaction_score.mean()), 2),
                'recommend_rate': round(float(v.would_recommend.mean()) * 100, 1)}
