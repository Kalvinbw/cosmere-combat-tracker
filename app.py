from flask import Flask, jsonify, request, render_template
from calculator import PC_DPR_ROUNDS, BOSS_BENCHMARK, PC_HP, compute_difficulty
from data import load_adversaries, add_adversary

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/adversaries", methods=["GET"])
def get_adversaries():
    return jsonify(load_adversaries())


@app.route("/api/adversaries", methods=["POST"])
def post_adversary():
    data = request.get_json(force=True)
    for field in ("World", "Adversary Name", "Type", "Tier", "Health", "DPR (Fast)", "DPR (Slow)"):
        if not data.get(field) and data.get(field) != 0:
            return jsonify({"error": f"Missing required field: {field}"}), 400
    add_adversary(data)
    return jsonify({"ok": True}), 201


@app.route("/api/benchmarks")
def get_benchmarks():
    return jsonify({
        "pc_dpr_rounds": PC_DPR_ROUNDS,
        "boss_benchmark": BOSS_BENCHMARK,
        "pc_hp": PC_HP,
    })


@app.route("/api/difficulty", methods=["POST"])
def post_difficulty():
    data = request.get_json(force=True)
    try:
        party_tier = int(data["party_tier"])
        party_players = int(data["party_players"])
        total_hp = int(data["total_hp"])
        total_dpr_fast = int(data["total_dpr_fast"])
    except (KeyError, ValueError) as e:
        return jsonify({"error": str(e)}), 400

    result = compute_difficulty(total_hp, total_dpr_fast, party_tier, party_players)
    if result is None:
        return jsonify({"error": "No benchmark data for this tier/player combination"}), 422
    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True, port=5001)
