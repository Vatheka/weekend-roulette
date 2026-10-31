# Weekend Roulette: Phnom Penh synthetic demo data

All listings, ratings, prices, opening times, accessibility details, and visitor experiences are generated examples. They are not verified travel information. District names refer to Phnom Penh areas; coordinates are random approximate points around district anchors, not venue locations. Do not provide directions to them or present them as actual businesses. Data is not sourced from Kaggle.

## Files

| File | Data rows | Columns | Row meaning |
| --- | ---: | ---: | --- |
| [phnom_penh_attractions.csv](./phnom_penh_attractions.csv) | 150 | 37 | One fictional attraction listing |
| [phnom_penh_visitor_experiences.csv](./phnom_penh_visitor_experiences.csv) | 7,500 | 54 | One synthetic visitor experience, with attraction details included |
| [generate_data.mjs](./generate_data.mjs) | — | — | Dependency-free deterministic generator; run with Node.js |

The larger CSV has 50 experiences for each attraction. It does not represent 7,500 unique attractions. Use the smaller catalog for recommendations, or deduplicate the larger CSV by `attraction_id` first. Both CSVs are UTF-8 with headers, quoted fields, decimal USD amounts, and true/false booleans. Semicolon-separated tags are stored inside individual CSV fields.

## Attraction columns

- Identity: `attraction_id`, `attraction_name`, `city`, `country`, `district`, `category`, `description`.
- Location: `latitude`, `longitude`, `coordinates_are_approximate`.
- Matching: `environment`, `interest_tags`, `mood_tags`, `best_time_of_day`, `typical_crowd_level`, `activity_level`.
- Costs and time: `estimated_entry_fee_usd`, `estimated_food_cost_usd`, `estimated_transport_cost_usd`, `suggested_duration_minutes`, `opening_time`, `closing_time`.
- Facilities and audience: `family_friendly`, `couple_friendly`, `solo_friendly`, `group_friendly`, `wheelchair_accessible`, `parking_available`, `wifi_available`, `rain_friendly`, `reservation_required`, `min_group_size`, `max_group_size`.
- Synthetic popularity: `estimated_rating` (1–5 scale), `synthetic_review_count`.
- Provenance: `data_source`, `is_synthetic`.

Categories: park, museum, art_gallery, cafe, food_market, riverside, workshop, entertainment, shopping, wellness. Facilities and suitability flags are invented, not factual guarantees. Opening hours are simplified daily windows without holiday schedules.

## Additional visitor-experience columns

- IDs and date: `visit_id`, `synthetic_visitor_id`, `visit_date` (YYYY-MM-DD, in 2025).
- Profile: `visitor_age_group`, `visitor_type`, `group_size`, `group_type`.
- Preferences: `visitor_mood`, `preferred_interest`, `budget_per_person_usd`, `available_time_minutes`, `weather`.
- Outcomes: `estimated_total_cost_per_person_usd`, `within_budget`, `actual_duration_minutes`, `satisfaction_score` (1–5), `would_recommend`.

`estimated_total_cost_per_person_usd` is entry + food + transport; transport is a simplified per-person estimate. `within_budget` compares that total to the visitor budget. `would_recommend` is true when satisfaction is at least 3.5. Visitor IDs are random identifiers, not coherent longitudinal user profiles. Generated experiences can include poor matches, such as rainy outdoor visits or group types that do not fit a venue's suitability flags.

## Beginner prototype

1. Load the attraction catalog with pandas.
2. Filter by district, budget, environment, group suitability, and available time.
3. Use TF-IDF or embeddings on description + interest tags for similarity search.
4. Give an agent `search_places(preferences)` and `get_place_details(attraction_id)` tools. Return actual catalog rows and let it explain the matches.
5. Serve those tools through FastAPI and display results in Streamlit.
6. Use visitor experiences for charts of category popularity, budget, weather, and satisfaction. Counts and relationships are simulated; they are not evidence of real Phnom Penh tourism patterns.

Optional ML exercise: predict satisfaction from pre-visit context. Exclude `would_recommend` and other post-visit outcomes to avoid leakage. Because preferences and satisfaction follow artificial generation rules, scores measure those rules rather than real-world performance. If testing generalization to new attractions, split by `attraction_id`, not by random experience rows.

## Regenerate

Run `node generate_data.mjs` from this directory with Node.js installed. Seed: 20261031. This overwrites the two generated CSVs reproducibly.
