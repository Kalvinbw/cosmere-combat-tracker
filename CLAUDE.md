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

- `app.py` — Flask routes only. Imports `compute_difficulty` from `calculator.py` and `load_adversaries`/`add_adversary`/`update_adversary_image` from `data.py`. Also owns `UPLOAD_DIR` (`uploads/images/`) and serves uploaded images via `GET /images/<filename>` (Flask route, not WhiteNoise).
- `calculator.py` — all difficulty math. Two independent systems:
  - `compute_threat()` — official threat-based system (Minion/Rival/Boss × tier scaling). This is what the UI's Encounter Builder uses.
  - `compute_difficulty()` — supplementary HP/DPR analysis using hardcoded benchmark tables (`PC_DPR_ROUNDS`, `BOSS_BENCHMARK`, `PC_HP`). Returns `None` if the tier/player combo has no benchmark data (e.g., Tier 4 with 0 players).
- `data.py` — reads/writes `adversaries.csv` via stdlib `csv`. Uses a simple mtime-based in-process cache (`_cache`). `add_adversary()` appends a row; `update_adversary_image(name, filename)` rewrites the entire CSV to set the Image field for a named adversary. Both invalidate the cache.
- `sync_sheet.py` — standalone script that fetches each `{World}Tier{N}` tab from the public Google Sheet via `gviz/tq?tqx=out:csv` and appends rows not already in `adversaries.csv` (deduped on World + Tier + Adversary Name).
- Frontend — split across:
  - `templates/base.html` — `<head>`, header, tab nav, loads `static/js/main.js` as an ES module
  - `templates/index.html` — thin shell (`{% extends "base.html" %}` + `{% include %}` partials)
  - `templates/components/` — `encounter_tab.html`, `combat_tracker.html`, `admin_tab.html`, `modal_add_enemy.html`
  - `static/style.css` — all styles
  - `static/js/state.js` — shared mutable state and constants; includes `combatImages: new Map()` (keyed by adversary index) for session-only stat block images
  - `static/js/api.js` — all `fetch()` calls
  - `static/js/encounter.js` — party setup, enemy browser, encounter, difficulty
  - `static/js/combat.js` — combat tracker; combatant objects carry `advIdx` (index into `state.ADVERSARIES`) used to key `state.combatImages`; `attachCombatImage(advIdx)` stores a DataURL session-only; `showLightbox(advIdx)` / `closeLightbox()` drive the full-screen image overlay
  - `static/js/admin.js` — admin panel, world visibility, Google Sheet sync; `saveEnemy()` POSTs adversary data then optionally POSTs an image to `POST /api/adversaries/image`
  - `static/js/main.js` — entry point; imports all modules, exposes handlers to `window`, calls `init()`
- **Static files** are served by WhiteNoise (WSGI middleware) for pre-existing assets in `static/`, with gzip and long-lived cache headers (`max_age=31536000`). Uploaded images live in `uploads/images/` (outside `static/`) and are served by Flask directly at `/images/<filename>`.

**Admin key:** `POST /api/adversaries` and `POST /api/adversaries/image` are gated by `ADMIN_KEY` env var. If set, requests must include `X-Admin-Key: <value>`. Locally this is set in `.env` to `cosmere`. On Railway it should be set as a secret environment variable.

**Deployment:** Railway via `Procfile` (`gunicorn app:app`). Push to GitHub → auto-deploy. Note: `uploads/images/` is on Railway's ephemeral filesystem — uploaded stat block images are lost on redeploy.

## Data

`adversaries.csv` is the source of truth. Columns are defined in `data.py` (`COLUMNS`) and must stay in sync with `sync_sheet.py` (`CSV_COLUMNS`). The `Image` column (last) stores a filename served from `uploads/images/`; empty string means no image attached.

The Google Sheet (ID: `1znToovH68XfbhI5YPvEjsou3ADRslqX49Swf7UofZPA`) is upstream — run `sync_sheet.py` to pull new entries in.

## Difficulty Systems

Two parallel systems exist and both are shown in the UI:

1. **Official threat system** (`compute_threat`): `scaledThreat = baseThreat × 2^(advTier − partyTier)`, rounded to nearest 0.25. Thresholds are multiples of `num_pcs` (Easy = 0.5×, Medium = 1.0×, Hard = 1.5×, Deadly = 2.0×).
2. **Combat analysis** (`compute_difficulty`): score = average of `hp_ratio` and `adj_damage_threat` against the benchmark boss for the party's tier. The benchmark tables in `calculator.py` are hardcoded and cover tiers 1–4 with 0–11 players (Tier 4 with 0 players is `None`).

## Stat Block Images

Two ways to attach an image to an adversary:

- **Permanent (admin form):** File input in the "New Adversary" modal. `saveEnemy()` in `admin.js` POSTs the image to `POST /api/adversaries/image` after creating the adversary; the backend saves the file to `UPLOAD_DIR` and calls `update_adversary_image()` to write the filename into the CSV.
- **Session-only (combat):** The 📷 button on each combat card calls `attachCombatImage(advIdx)`, which reads the file as a DataURL via `FileReader` and stores it in `state.combatImages`. Cleared on page refresh; never hits the server.

During combat, `buildEnemyCard()` / `buildAllyCard()` prefer `state.combatImages` over the CSV-stored image when both exist.
