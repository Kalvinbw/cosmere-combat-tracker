# Cosmere Combat Tracker

> **Unofficial fan content, created and shared for non-commercial use. It has not been reviewed by Dragonsteel Entertainment, LLC or Brotherwise Games, LLC.**

A web tool for building and evaluating combat encounters for the Cosmere TTRPG system. Calculate encounter difficulty using the official threat system, track HP/Focus/Investiture during combat, and manage your party's stats.

## Features

- **Encounter Builder** — browse and filter 80+ adversaries from the Cosmere universe, add them to an encounter with quantity controls
- **Official Threat System** — difficulty rated using the handbook's Minion/Rival/Boss threat values with tier-based scaling
- **Combat Analysis** — supplementary HP/DPR breakdown showing estimated rounds, damage threat, and party survivability
- **Combat Tracker** — per-combatant cards with live HP/Focus/Investiture tracking, Fast/Slow turn toggles, and round counter
- **Party Members** — configure each PC's stats (HP, Focus, Investiture, defenses, tier); actual PC HP is used for difficulty calculations when provided
- **Add Adversaries** — submit new adversaries through the UI; saved directly to the CSV data file

## Difficulty System

Difficulty is calculated using the official threat thresholds:

| Rating  | Total Threat        |
|---------|---------------------|
| Trivial | < 0.5 × party size  |
| Easy    | ≥ 0.5 × party size  |
| Medium  | ≥ 1.0 × party size  |
| Hard    | ≥ 1.5 × party size  |
| Deadly  | ≥ 2.0 × party size  |

Base threat by type: **Minion = 0.5**, **Rival = 1.0**, **Boss = 4.0**

Tier scaling: `scaledThreat = baseThreat × 2^(adversaryTier − partyTier)`, rounded to the nearest 0.25. An adversary one tier above the party counts double; one tier below counts half.

## Running Locally

```bash
pip install -r requirements.txt
python app.py
```

Then open `http://localhost:5001`.

## Running Tests

```bash
pytest
```

26 tests covering the difficulty calculator and threat system.

## Data

Adversary stats are stored in `adversaries.csv`. The columns are:

`World, Tier, Adversary Name, Type, Physical Defense, Cognitive Defense, Spiritual Defense, Health, Focus, Investiture, Physical Skills, Cognitive Skills, Spiritual Skills, Invested Skills, To Hit Bonus, DPR (Fast), DPR (Slow)`

You can edit the CSV directly or use the Add Adversary form in the app.

## Deployment

The app is configured for Railway via `Procfile` (`gunicorn app:app`). Connect the GitHub repo in the Railway dashboard and it deploys automatically on every push.

## Stack

- **Backend:** Python / Flask
- **Frontend:** Vanilla JS / HTML / CSS (single-page, no framework)
- **Data:** CSV (stdlib `csv` module, no ORM)
- **Tests:** pytest
