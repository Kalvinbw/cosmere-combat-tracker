#!/usr/bin/env python3
"""Sync adversaries from Google Sheet into adversaries.csv.

Fetches each {World}Tier{N} tab from the public Google Sheet and appends
any adversaries not already present in adversaries.csv (matched by
World + Tier + Adversary Name).
"""

import csv
import io
import sys
import urllib.parse
import urllib.request

SHEET_ID = "1znToovH68XfbhI5YPvEjsou3ADRslqX49Swf7UofZPA"
SHEET_BASE = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}"
WORLDS = ["Stormlight", "Mistborn", "Elantris", "Warbreaker", "Wax", "Wayne", "Worldhopper"]
TIERS = [1, 2, 3, 4]
CSV_PATH = "adversaries.csv"
CSV_COLUMNS = [
    "World", "Tier", "Adversary Name", "Type",
    "Physical Defense", "Cognitive Defense", "Spiritual Defense",
    "Health", "Focus", "Investiture",
    "Physical Skills", "Cognitive Skills", "Spiritual Skills", "Invested Skills",
    "To Hit Bonus", "DPR (Fast)", "DPR (Slow)",
]


def fetch_sheet_csv(sheet_name: str) -> str:
    url = f"{SHEET_BASE}/gviz/tq?tqx=out:csv&sheet={urllib.parse.quote(sheet_name)}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.read().decode("utf-8")


def load_sheet_adversaries() -> list[dict]:
    adversaries = []
    for world in WORLDS:
        for tier in TIERS:
            sheet_name = f"{world}Tier{tier}"
            try:
                content = fetch_sheet_csv(sheet_name)
                reader = csv.reader(io.StringIO(content))
                rows = list(reader)
                if not rows or "Adversary Name" not in rows[0]:
                    continue
                header = rows[0]
                adv_idx = header.index("Adversary Name")
                for row in rows[1:]:
                    if not row or not row[adv_idx].strip():
                        continue
                    d = dict(zip(header, row))
                    d["World"] = world
                    d["Tier"] = str(tier)
                    adversaries.append(d)
            except Exception as e:
                print(f"  Warning: could not fetch {sheet_name}: {e}", file=sys.stderr)
    return adversaries


def load_csv_adversaries() -> list[dict]:
    with open(CSV_PATH, newline="") as f:
        return list(csv.DictReader(f))


def append_to_csv(rows: list[dict]) -> None:
    with open(CSV_PATH, "a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS, extrasaction="ignore")
        for row in rows:
            writer.writerow(row)


def main() -> None:
    print("Fetching adversaries from Google Sheet...")
    sheet_advs = load_sheet_adversaries()
    csv_advs = load_csv_adversaries()

    csv_keys = {(r["World"], str(r["Tier"]), r["Adversary Name"]) for r in csv_advs}

    new = [
        r for r in sheet_advs
        if (r["World"], r["Tier"], r["Adversary Name"]) not in csv_keys
    ]

    print(f"Sheet total: {len(sheet_advs)}  |  CSV total: {len(csv_advs)}  |  New: {len(new)}")

    if not new:
        print("CSV is already up to date.")
        return

    print("\nNew adversaries to add:")
    for r in new:
        print(f"  [{r['World']} T{r['Tier']}] {r['Adversary Name']} ({r['Type']})")

    append_to_csv(new)
    print(f"\nAdded {len(new)} adversary/adversaries to {CSV_PATH}.")


if __name__ == "__main__":
    main()
