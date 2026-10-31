"""Small, reproducible training pipeline. No downloaded models required."""
import json
import hashlib
import joblib
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder
from .config import DATA, MODELS

NUMERIC = ['budget_per_person_usd', 'group_size', 'available_time_minutes',
           'estimated_entry_fee_usd', 'estimated_food_cost_usd', 'estimated_transport_cost_usd']
CATEGORICAL = ['category', 'environment', 'weather', 'visitor_mood', 'group_type']
FEATURES = NUMERIC + CATEGORICAL


def fingerprint():
    digest = hashlib.sha256()
    for name in ['phnom_penh_attractions.csv', 'phnom_penh_visitor_experiences.csv']:
        digest.update((DATA / name).read_bytes())
    return digest.hexdigest()


def text_features(frame):
    return (frame['attraction_name'] + ' ' + frame['category'].str.replace('_', ' ') +
            ' ' + frame['district'] + ' ' + frame['description'] + ' ' +
            frame['interest_tags'].str.replace(';', ' ') + ' ' +
            frame['mood_tags'].str.replace(';', ' '))


def train():
    MODELS.mkdir(exist_ok=True)
    places = pd.read_csv(DATA / 'phnom_penh_attractions.csv')
    visits = pd.read_csv(DATA / 'phnom_penh_visitor_experiences.csv')
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words='english', sublinear_tf=True)
    matrix = vectorizer.fit_transform(text_features(places))
    joblib.dump({'vectorizer': vectorizer, 'matrix': matrix,
                 'ids': places.attraction_id.tolist()}, MODELS / 'recommendations.joblib')

    # Split by attraction: the same venue cannot appear in both train and test.
    train_idx, test_idx = next(GroupShuffleSplit(n_splits=1, test_size=.2, random_state=42)
                               .split(visits, groups=visits.attraction_id))
    train_rows, test_rows = visits.iloc[train_idx], visits.iloc[test_idx]
    preprocessing = ColumnTransformer([
        ('numeric', 'passthrough', NUMERIC),
        ('category', OneHotEncoder(handle_unknown='ignore', sparse_output=False), CATEGORICAL)])
    model = make_pipeline(preprocessing, RandomForestRegressor(
        n_estimators=80, max_depth=10, min_samples_leaf=8, random_state=42, n_jobs=1))
    model.fit(train_rows[FEATURES], train_rows.satisfaction_score)
    prediction = model.predict(test_rows[FEATURES])
    baseline = [train_rows.satisfaction_score.mean()] * len(test_rows)
    metrics = {
        'catalog_rows': len(places), 'experience_rows': len(visits),
        'train_rows': len(train_rows), 'test_rows': len(test_rows),
        'train_attractions': train_rows.attraction_id.nunique(),
        'test_attractions': test_rows.attraction_id.nunique(),
        'mae': round(mean_absolute_error(test_rows.satisfaction_score, prediction), 4),
        'baseline_mae': round(mean_absolute_error(test_rows.satisfaction_score, baseline), 4),
        'r2': round(r2_score(test_rows.satisfaction_score, prediction), 4),
        'split': 'Held-out attractions (GroupShuffleSplit, seed 42)',
        'target': 'Synthetic satisfaction score, 1–5',
        'features': FEATURES, 'sklearn_version': sklearn.__version__,
        'data_fingerprint': fingerprint(),
        'limitation': 'Synthetic outcomes follow generated budget/weather rules. Scores do not validate real tourism recommendations.'}
    joblib.dump(model, MODELS / 'satisfaction.joblib')
    (MODELS / 'metrics.json').write_text(json.dumps(metrics, indent=2))
    return metrics


def ensure_trained():
    paths = [MODELS / name for name in ['recommendations.joblib', 'satisfaction.joblib', 'metrics.json']]
    if all(p.exists() for p in paths):
        try:
            metrics = json.loads(paths[-1].read_text())
            if metrics['data_fingerprint'] == fingerprint() and metrics['sklearn_version'] == sklearn.__version__:
                return metrics
        except (ValueError, KeyError):
            pass
    return train()


if __name__ == '__main__':
    print(json.dumps(train(), indent=2))
