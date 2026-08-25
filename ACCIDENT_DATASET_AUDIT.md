# Accident Dataset Audit

Audit date: 2026-08-25.

## Result: BLOCKED — ACCIDENT DATASET NOT FOUND

Repository dataset files are limited to `drugs.csv`, `drugs_import.csv`, `hospitals.csv`, and `sources.csv`. No file contains verified road-accident observations, a prediction target, timestamps suitable for a temporal split, or route-level geographic features. Direct access to Supabase could not be established from this environment, so no connected database/storage dataset can be claimed.

## Consequence

ML training, risk-model selection, prediction API, and any numeric SafeRoute risk score are intentionally not implemented. No synthetic data, inferred score, or model metrics were created.

## Data required before training

- Provenance and license for accident records.
- Occurrence time, location/geospatial precision, target definition, and road/environmental features.
- A documented temporal test split to prevent future-data leakage.
- Data-quality assessment for missing values, duplicates, outliers, class imbalance, and geographic/temporal coverage.
