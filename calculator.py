import math

PC_DPR_ROUNDS = {
    "1": {"0": 18, "1": 16, "2": 14, "3": 13, "4": 11, "5": 10, "6": 10, "7": 9, "8": 8, "9": 8, "10": 7, "11": 7},
    "2": {"0": 81, "1": 58, "2": 46, "3": 38, "4": 33, "5": 29, "6": 26, "7": 23, "8": 21, "9": 19, "10": 18, "11": 17},
    "3": {"0": 128, "1": 91, "2": 72, "3": 59, "4": 50, "5": 44, "6": 39, "7": 35, "8": 32, "9": 29, "10": 27, "11": 25},
    "4": {"0": None, "1": 212, "2": 117, "3": 84, "4": 66, "5": 55, "6": 47, "7": 42, "8": 37, "9": 34, "10": 31, "11": 28},
}

BOSS_BENCHMARK = {
    "1": {"hp": 57, "dpr_fast": 16},
    "2": {"hp": 135, "dpr_fast": 15},
    "3": {"hp": 196, "dpr_fast": 32},
    "4": {"hp": 215, "dpr_fast": 39},
}

PC_HP = {
    "1": {"min": 30, "max": 33},
    "2": {"min": 50, "max": 57},
    "3": {"min": 65, "max": 78},
    "4": {"min": 75, "max": 96},
}

_THRESHOLDS = [(0.25, "Trivial"), (0.6, "Easy"), (1.2, "Medium"), (2.0, "Hard"), (math.inf, "Deadly")]

BASE_THREAT = {"Minion": 0.5, "Rival": 1.0, "Boss": 4.0}


def compute_threat(adversary_list, party_tier, num_pcs):
    """Compute official threat-based difficulty.

    adversary_list: list of dicts with keys 'type', 'tier', 'qty'.
    Returns dict with total_threat, thresholds, rating, and per-enemy breakdown, or None if num_pcs <= 0.
    """
    if num_pcs <= 0:
        return None
    total = 0.0
    breakdown = []
    for adv in adversary_list:
        base = BASE_THREAT.get(adv.get("type", "Rival"), 1.0)
        tier_delta = int(adv.get("tier", party_tier)) - party_tier
        scaled = round(base * (2 ** tier_delta) * 4) / 4  # nearest 0.25
        qty = int(adv.get("qty", 1))
        contrib = scaled * qty
        total += contrib
        breakdown.append({
            "type": adv.get("type"),
            "tier": int(adv.get("tier", party_tier)),
            "qty": qty,
            "scaled_threat": scaled,
            "total": contrib,
        })
    total = round(total, 4)
    easy, medium, hard, deadly = 0.5 * num_pcs, 1.0 * num_pcs, 1.5 * num_pcs, 2.0 * num_pcs
    if total < easy:
        rating = "Trivial"
    elif total < medium:
        rating = "Easy"
    elif total < hard:
        rating = "Medium"
    elif total < deadly:
        rating = "Hard"
    else:
        rating = "Deadly"
    return {
        "total_threat": total,
        "threshold_easy": easy,
        "threshold_medium": medium,
        "threshold_hard": hard,
        "threshold_deadly": deadly,
        "rating": rating,
        "breakdown": breakdown,
    }


def get_rating(score):
    for threshold, label in _THRESHOLDS:
        if score < threshold:
            return label
    return "Deadly"


def compute_difficulty(total_hp, total_dpr_fast, party_tier, party_players,
                       ally_hp=0, ally_dpr_fast=0):
    """Returns difficulty dict, or None if no benchmark exists for tier/player combo."""
    tier_key = str(party_tier)
    player_key = str(party_players)

    bench_rounds = PC_DPR_ROUNDS[tier_key][player_key]
    if bench_rounds is None:
        return None

    bench = BOSS_BENCHMARK[tier_key]
    pc_hp = PC_HP[tier_key]

    pc_hp_avg = (pc_hp["min"] + pc_hp["max"]) / 2
    party_hp_avg = party_players * pc_hp_avg + ally_hp

    party_dpr = bench["hp"] / bench_rounds
    effective_party_dpr = party_dpr + ally_dpr_fast
    est_rounds = math.ceil(total_hp / effective_party_dpr) if effective_party_dpr > 0 else 0

    hp_ratio = total_hp / bench["hp"]
    dpr_ratio = total_dpr_fast / bench["dpr_fast"]

    damage_threat = (total_dpr_fast * est_rounds) / party_hp_avg if party_hp_avg > 0 else 0

    bench_rounds_4p = PC_DPR_ROUNDS[tier_key]["4"]
    dt_calibration = bench["dpr_fast"] * bench_rounds_4p / (4 * pc_hp_avg)
    adj_damage_threat = damage_threat / dt_calibration if dt_calibration > 0 else 0

    score = (hp_ratio + adj_damage_threat) / 2

    return {
        "score": round(score, 4),
        "rating": get_rating(score),
        "est_rounds": est_rounds,
        "bench_rounds": bench_rounds,
        "hp_ratio": round(hp_ratio, 4),
        "dpr_ratio": round(dpr_ratio, 4),
        "damage_threat": round(damage_threat, 4),
        "adj_damage_threat": round(adj_damage_threat, 4),
        "party_hp_min": party_players * pc_hp["min"],
        "party_hp_max": party_players * pc_hp["max"],
        "party_hp_avg": round(party_hp_avg, 1),
        "pc_hp_min": pc_hp["min"],
        "pc_hp_max": pc_hp["max"],
        "bench_hp": bench["hp"],
        "bench_dpr_fast": bench["dpr_fast"],
        "party_dpr": round(party_dpr, 2),
    }
