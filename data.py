import csv
import os

CSV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "adversaries.csv")

COLUMNS = [
    "World", "Tier", "Adversary Name", "Type",
    "Physical Defense", "Cognitive Defense", "Spiritual Defense",
    "Health", "Focus", "Investiture",
    "Physical Skills", "Cognitive Skills", "Spiritual Skills", "Invested Skills",
    "To Hit Bonus", "DPR (Fast)", "DPR (Slow)",
]

_STRING_COLS = {"World", "Adversary Name", "Type"}

_cache = {"data": None, "mtime": None}


def load_adversaries():
    mtime = os.path.getmtime(CSV_PATH)
    if _cache["mtime"] == mtime:
        return _cache["data"]

    adversaries = []
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            adv = {}
            for col in COLUMNS:
                val = row.get(col, "")
                if col not in _STRING_COLS:
                    try:
                        adv[col] = int(val)
                    except (ValueError, TypeError):
                        adv[col] = 0
                else:
                    adv[col] = val
            adversaries.append(adv)

    _cache["data"] = adversaries
    _cache["mtime"] = mtime
    return adversaries


def add_adversary(data):
    with open(CSV_PATH, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        row = {}
        for col in COLUMNS:
            val = data.get(col, "")
            if col not in _STRING_COLS and val != "":
                try:
                    val = int(val)
                except (ValueError, TypeError):
                    val = 0
            row[col] = val
        writer.writerow(row)
    _cache["mtime"] = None
