# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run the app locally (http://localhost:5001)
python app.py

# Run tests
pytest

# Run a single test
pytest tests/test_calculator.py::test_benchmark_boss_4p_is_medium

# Sync adversaries from Google Sheet into adversaries.csv
python sync_sheet.py
```

## Architecture

**Single-page Flask app** — no JS framework, no database, no ORM.

- `app.py` — Flask routes only. Imports `compute_difficulty` from `calculator.py` and `load_adversaries`/`add_adversary` from `data.py`.
- `calculator.py` — all difficulty math. Two independent systems:
  - `compute_threat()` — official threat-based system (Minion/Rival/Boss × tier scaling). This is what the UI's Encounter Builder uses.
  - `compute_difficulty()` — supplementary HP/DPR analysis using hardcoded benchmark tables (`PC_DPR_ROUNDS`, `BOSS_BENCHMARK`, `PC_HP`). Returns `None` if the tier/player combo has no benchmark data (e.g., Tier 4 with 0 players).
- `data.py` — reads/writes `adversaries.csv` via stdlib `csv`. Uses a simple mtime-based in-process cache (`_cache`). `add_adversary()` appends a row and invalidates the cache by setting `_cache["mtime"] = None`.
- `sync_sheet.py` — standalone script that fetches each `{World}Tier{N}` tab from the public Google Sheet via `gviz/tq?tqx=out:csv` and appends rows not already in `adversaries.csv` (deduped on World + Tier + Adversary Name).
- Frontend — split across:
  - `templates/base.html` — `<head>`, header, tab nav, loads `static/js/main.js` as an ES module
  - `templates/index.html` — thin shell (`{% extends "base.html" %}` + `{% include %}` partials)
  - `templates/components/` — `encounter_tab.html`, `combat_tracker.html`, `admin_tab.html`, `modal_add_enemy.html`
  - `static/style.css` — all styles
  - `static/js/state.js` — shared mutable state and constants
  - `static/js/api.js` — all `fetch()` calls
  - `static/js/encounter.js` — party setup, enemy browser, encounter, difficulty
  - `static/js/combat.js` — combat tracker
  - `static/js/admin.js` — admin panel, world visibility, Google Sheet sync
  - `static/js/main.js` — entry point; imports all modules, exposes handlers to `window`, calls `init()`
- **Static files** are served by WhiteNoise (WSGI middleware), bypassing Flask routing, with gzip compression and long-lived cache headers (`max_age=31536000`). Vanilla JS makes fetch calls to `/api/adversaries`, `/api/difficulty`, `/api/benchmarks`, and `/api/config`.

**Admin key:** `POST /api/adversaries` is gated by `ADMIN_KEY` env var. If set, the request must include `X-Admin-Key: <value>`. Locally this is set in `.env` to `cosmere`. On Railway it should be set as a secret environment variable.

**Deployment:** Railway via `Procfile` (`gunicorn app:app`). Push to GitHub → auto-deploy.

## Data

`adversaries.csv` is the source of truth. The Google Sheet (ID: `1znToovH68XfbhI5YPvEjsou3ADRslqX49Swf7UofZPA`) is upstream — run `sync_sheet.py` to pull new entries in. The columns are fixed and defined in both `data.py` (`COLUMNS`) and `sync_sheet.py` (`CSV_COLUMNS`).

## Difficulty Systems

Two parallel systems exist and both are shown in the UI:

1. **Official threat system** (`compute_threat`): `scaledThreat = baseThreat × 2^(advTier − partyTier)`, rounded to nearest 0.25. Thresholds are multiples of `num_pcs` (Easy = 0.5×, Medium = 1.0×, Hard = 1.5×, Deadly = 2.0×).
2. **Combat analysis** (`compute_difficulty`): score = average of `hp_ratio` and `adj_damage_threat` against the benchmark boss for the party's tier. The benchmark tables in `calculator.py` are hardcoded and cover tiers 1–4 with 0–11 players (Tier 4 with 0 players is `None`).
