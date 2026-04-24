import pytest
from calculator import compute_difficulty, get_rating, compute_threat, BASE_THREAT, BOSS_BENCHMARK, PC_DPR_ROUNDS, PC_HP


def test_benchmark_boss_4p_is_medium():
    """1 standard boss at 4 players should always rate Medium at every tier."""
    for tier in range(1, 5):
        bench = BOSS_BENCHMARK[str(tier)]
        result = compute_difficulty(bench["hp"], bench["dpr_fast"], tier, 4)
        assert result is not None
        assert result["rating"] == "Medium", (
            f"Tier {tier}: expected Medium, got {result['rating']} (score={result['score']})"
        )


def test_benchmark_boss_2p_is_hard_or_worse():
    """1 standard boss at 2 players should be Hard or Deadly."""
    for tier in range(1, 5):
        bench = BOSS_BENCHMARK[str(tier)]
        result = compute_difficulty(bench["hp"], bench["dpr_fast"], tier, 2)
        assert result is not None
        assert result["rating"] in ("Hard", "Deadly"), (
            f"Tier {tier}: expected Hard/Deadly at 2 players, got {result['rating']}"
        )


def test_more_players_lowers_score():
    """Adding more players should reduce the difficulty score."""
    bench = BOSS_BENCHMARK["2"]
    r2 = compute_difficulty(bench["hp"], bench["dpr_fast"], 2, 2)
    r4 = compute_difficulty(bench["hp"], bench["dpr_fast"], 2, 4)
    r8 = compute_difficulty(bench["hp"], bench["dpr_fast"], 2, 8)
    assert r2["score"] > r4["score"] > r8["score"]


def test_tier4_0players_returns_none():
    assert compute_difficulty(100, 10, 4, 0) is None


def test_trivial_encounter():
    result = compute_difficulty(1, 1, 1, 4)
    assert result["rating"] == "Trivial"


def test_deadly_encounter():
    result = compute_difficulty(10000, 10000, 1, 1)
    assert result["rating"] == "Deadly"


@pytest.mark.parametrize("score,expected", [
    (0.00, "Trivial"),
    (0.24, "Trivial"),
    (0.25, "Easy"),
    (0.59, "Easy"),
    (0.60, "Medium"),
    (1.19, "Medium"),
    (1.20, "Hard"),
    (1.99, "Hard"),
    (2.00, "Deadly"),
    (99.9, "Deadly"),
])
def test_get_rating_boundaries(score, expected):
    assert get_rating(score) == expected


def test_score_increases_with_more_enemies():
    """Doubling enemy HP and DPR should raise the score."""
    bench = BOSS_BENCHMARK["1"]
    r1 = compute_difficulty(bench["hp"], bench["dpr_fast"], 1, 4)
    r2 = compute_difficulty(bench["hp"] * 2, bench["dpr_fast"] * 2, 1, 4)
    assert r2["score"] > r1["score"]


# ── Threat system tests ───────────────────────────────────────────────────────

def test_single_boss_4p_is_medium():
    """1 Boss at same tier as 4-player party → threat 4.0 = exactly Medium threshold."""
    result = compute_threat([{"type": "Boss", "tier": 1, "qty": 1}], party_tier=1, num_pcs=4)
    assert result["rating"] == "Medium"
    assert result["total_threat"] == 4.0

def test_single_rival_4p_is_trivial():
    """1 Rival at same tier vs 4 PCs → threat 1.0 < Easy threshold 2.0."""
    result = compute_threat([{"type": "Rival", "tier": 1, "qty": 1}], party_tier=1, num_pcs=4)
    assert result["rating"] == "Trivial"

def test_tier_scaling_above_doubles():
    """Rival one tier above party → base 1.0 × 2^1 = 2.0."""
    r = compute_threat([{"type": "Rival", "tier": 2, "qty": 1}], party_tier=1, num_pcs=4)
    assert r["breakdown"][0]["scaled_threat"] == 2.0

def test_tier_scaling_below_halves():
    """Rival one tier below party → base 1.0 × 2^-1 = 0.5."""
    r = compute_threat([{"type": "Rival", "tier": 1, "qty": 1}], party_tier=2, num_pcs=4)
    assert r["breakdown"][0]["scaled_threat"] == 0.5

def test_threat_rounds_to_quarter():
    """Boss 3 tiers below party: 4 × 2^-3 = 0.5, rounds cleanly to 0.5."""
    r = compute_threat([{"type": "Boss", "tier": 1, "qty": 1}], party_tier=4, num_pcs=4)
    assert r["breakdown"][0]["scaled_threat"] == 0.5

def test_zero_players_returns_none():
    assert compute_threat([{"type": "Boss", "tier": 1, "qty": 1}], party_tier=1, num_pcs=0) is None

def test_deadly_encounter_threat():
    """3 Bosses at same tier vs 4 PCs → threat 12 > Deadly threshold 8."""
    result = compute_threat([{"type": "Boss", "tier": 1, "qty": 3}], party_tier=1, num_pcs=4)
    assert result["rating"] == "Deadly"
    assert result["total_threat"] == 12.0

def test_threat_accumulates_multiple_types():
    """Mixed encounter: 2 Minions + 1 Rival = 1.0 + 1.0 = 2.0, Easy for 4 PCs."""
    result = compute_threat(
        [{"type": "Minion", "tier": 1, "qty": 2}, {"type": "Rival", "tier": 1, "qty": 1}],
        party_tier=1, num_pcs=4,
    )
    assert result["total_threat"] == 2.0
    assert result["rating"] == "Easy"

def test_base_threat_values():
    assert BASE_THREAT["Minion"] == 0.5
    assert BASE_THREAT["Rival"] == 1.0
    assert BASE_THREAT["Boss"] == 4.0
