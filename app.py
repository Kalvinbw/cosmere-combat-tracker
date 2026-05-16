import os
import time
from flask import Flask, jsonify, request, render_template, send_from_directory
from werkzeug.utils import secure_filename
from whitenoise import WhiteNoise
from calculator import PC_DPR_ROUNDS, BOSS_BENCHMARK, PC_HP, compute_difficulty, compute_threat, get_threat_rating
from data import load_adversaries, add_adversary, update_adversary_image, WORLDS, TYPES, TIERS

app = Flask(__name__)
app.wsgi_app = WhiteNoise(app.wsgi_app, root=os.path.join(os.path.dirname(__file__), 'static'), prefix='static', max_age=31536000)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), 'uploads', 'images')


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/adversaries", methods=["GET"])
def get_adversaries():
    return jsonify(load_adversaries())


@app.route("/api/adversaries", methods=["POST"])
def post_adversary():
    admin_key = os.environ.get("ADMIN_KEY")
    if admin_key and request.headers.get("X-Admin-Key") != admin_key:
        return jsonify({"error": "Admin key required"}), 403
    data = request.get_json(force=True)
    for field in ("World", "Adversary Name", "Type", "Tier", "Health", "DPR (Fast)", "DPR (Slow)"):
        if not data.get(field) and data.get(field) != 0:
            return jsonify({"error": f"Missing required field: {field}"}), 400
    add_adversary(data)
    return jsonify({"ok": True}), 201


@app.route("/api/adversaries/image", methods=["POST"])
def post_adversary_image():
    admin_key = os.environ.get("ADMIN_KEY")
    if admin_key and request.headers.get("X-Admin-Key") != admin_key:
        return jsonify({"error": "Admin key required"}), 403
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    file = request.files['file']
    name = request.form.get('name', '').strip()
    if not file or not name:
        return jsonify({"error": "File and name required"}), 400
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(secure_filename(file.filename))[1].lower() or '.jpg'
    filename = secure_filename(f"{name}_{int(time.time())}{ext}")
    file.save(os.path.join(UPLOAD_DIR, filename))
    update_adversary_image(name, filename)
    return jsonify({"image": filename}), 200


@app.route("/images/<path:filename>")
def serve_image(filename):
    return send_from_directory(UPLOAD_DIR, filename)


@app.route("/api/config")
def get_config():
    return jsonify({
        "admin_locked": bool(os.environ.get("ADMIN_KEY")),
        "worlds": WORLDS,
        "types":  TYPES,
        "tiers":  TIERS,
    })


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
    except (KeyError, ValueError) as e:
        return jsonify({"error": str(e)}), 400

    enemies = data.get("enemies", [])
    allies  = data.get("allies", [])
    pc_hp_avg = data.get("pc_hp_avg")

    enemy_result = compute_threat(enemies, party_tier, party_players)
    ally_result  = compute_threat(allies,  party_tier, party_players) if allies else None
    enemy_threat = enemy_result["total_threat"] if enemy_result else 0.0
    ally_threat  = ally_result["total_threat"]  if ally_result  else 0.0
    net_threat   = round(max(0.0, enemy_threat - ally_threat), 4)

    total_hp     = sum(int(e.get("hp", 0))       * int(e.get("qty", 1)) for e in enemies)
    total_dpr    = sum(int(e.get("dpr_fast", 0)) * int(e.get("qty", 1)) for e in enemies)
    ally_hp      = sum(int(a.get("hp", 0))       * int(a.get("qty", 1)) for a in allies)
    ally_dpr     = sum(int(a.get("dpr_fast", 0)) * int(a.get("qty", 1)) for a in allies)
    ally_count   = sum(int(a.get("qty", 1))                              for a in allies)

    analysis = compute_difficulty(total_hp, total_dpr, party_tier, party_players,
                                  ally_hp, ally_dpr, pc_hp_avg)
    if analysis is not None:
        analysis.update(enemy_total_hp=total_hp, enemy_total_dpr=total_dpr,
                        ally_count=ally_count, ally_hp=ally_hp, ally_dpr=ally_dpr)

    return jsonify({
        "threat": {
            "enemy_threat":      enemy_threat,
            "ally_threat":       ally_threat,
            "net_threat":        net_threat,
            "threshold_easy":    0.5 * party_players,
            "threshold_medium":  1.0 * party_players,
            "threshold_hard":    1.5 * party_players,
            "threshold_deadly":  2.0 * party_players,
            "rating":            get_threat_rating(net_threat, party_players),
        },
        "analysis": analysis,
    })


if __name__ == "__main__":
    app.run(debug=True, port=5001)
