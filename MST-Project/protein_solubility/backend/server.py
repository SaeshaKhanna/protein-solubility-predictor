import json
import pathlib
import sys

import joblib
import pandas as pd
import shap
from flask import Flask, jsonify, request, send_from_directory

BASE = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE / "src"))
from features import extract_features
from tag_rules import recommend_tag

MODELS = BASE / "models"
PROCESSED = BASE / "data" / "processed"
REPORTS = BASE / "reports"
FRONTEND = BASE / "frontend"

app = Flask(__name__, static_folder=None)

model = joblib.load(MODELS / "best_model.joblib")
with open(MODELS / "feature_names.json") as f:
    FEATURE_NAMES = json.load(f)
with open(MODELS / "best_model_name.txt") as f:
    BEST_MODEL_NAME = f.read().strip()
explainer = shap.TreeExplainer(model)

feature_table = pd.read_csv(PROCESSED / "feature_table.csv")
gene_lookup = pd.read_csv(PROCESSED / "gene_lookup.csv")
model_comparison = pd.read_csv(REPORTS / "model_comparison.csv")

KEY_FEATURES = [
    "gravy", "molecular_weight", "instability_index",
    "isoelectric_point", "aromaticity", "fraction_charged",
]


def run_prediction(sequence: str):
    feats = extract_features(sequence)
    if feats is None:
        return None
    row = pd.DataFrame([feats])[FEATURE_NAMES]
    proba_soluble = float(model.predict_proba(row)[0, 1])
    shap_row = explainer(row)
    shap_series = pd.Series(shap_row.values[0], index=FEATURE_NAMES)
    label = "Soluble" if proba_soluble >= 0.5 else "Insoluble"

    top = shap_series.abs().sort_values(ascending=False).head(6)
    top_drivers = [
        {"feature": f, "value": round(float(feats[f]), 4), "shap": round(float(shap_series[f]), 4)}
        for f in top.index
    ]

    result = {
        "label": label,
        "proba_soluble": round(proba_soluble, 4),
        "features": {k: round(v, 4) if isinstance(v, float) else v for k, v in feats.items()},
        "top_drivers": top_drivers,
    }
    if label == "Insoluble":
        rec = recommend_tag(feats, shap_series)
        result["tag_recommendation"] = rec
    return result


@app.route("/")
def index():
    return send_from_directory(FRONTEND, "index.html")


@app.route("/predictor")
def page_predictor():
    return send_from_directory(FRONTEND, "predictor.html")


@app.route("/lookup")
def page_lookup():
    return send_from_directory(FRONTEND, "lookup.html")


@app.route("/batch")
def page_batch():
    return send_from_directory(FRONTEND, "batch.html")


@app.route("/dataset")
def page_dataset():
    return send_from_directory(FRONTEND, "dataset.html")


@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(FRONTEND, filename)


@app.route("/report-image/<filename>")
def report_image(filename):
    return send_from_directory(REPORTS, filename)


@app.route("/api/predict", methods=["POST"])
def api_predict():
    data = request.get_json(force=True)
    sequence = data.get("sequence", "")
    result = run_prediction(sequence)
    if result is None:
        return jsonify({"error": "Sequence too short or invalid (need >= 10 valid amino acids)."}), 400
    return jsonify(result)


@app.route("/api/mutate", methods=["POST"])
def api_mutate():
    data = request.get_json(force=True)
    sequence = data.get("sequence", "").strip().upper()
    sequence = "".join(ch for ch in sequence if ch.isalpha())
    position = int(data.get("position", 1))
    new_residue = data.get("residue", "A").upper()

    if position < 1 or position > len(sequence):
        return jsonify({"error": "Position out of range."}), 400

    mutated = sequence[: position - 1] + new_residue + sequence[position:]
    result = run_prediction(mutated)
    if result is None:
        return jsonify({"error": "Mutated sequence invalid."}), 400
    result["mutated_sequence"] = mutated
    result["original_residue"] = sequence[position - 1]
    return jsonify(result)


@app.route("/api/batch", methods=["POST"])
def api_batch():
    data = request.get_json(force=True)
    entries = data.get("sequences", [])
    results = []
    for entry in entries:
        label = entry.get("label", "unnamed")
        seq = entry.get("sequence", "")
        res = run_prediction(seq)
        if res is None:
            results.append({"label": label, "error": "invalid sequence"})
        else:
            results.append({
                "label": label,
                "predicted_label": res["label"],
                "proba_soluble": res["proba_soluble"],
                "tag": res.get("tag_recommendation", {}).get("tag", "-"),
            })
    return jsonify({"results": results})


@app.route("/api/genes")
def api_genes():
    q = request.args.get("q", "").strip().lower()
    if len(q) < 1:
        return jsonify({"results": []})
    matches = gene_lookup[
        gene_lookup["gene_name"].astype(str).str.lower().str.contains(q, na=False)
        | gene_lookup["b_number"].astype(str).str.lower().str.contains(q, na=False)
    ].head(15)
    return jsonify({
        "results": matches[["b_number", "gene_name", "solubility_pct"]].to_dict(orient="records")
    })


@app.route("/api/gene/<b_number>")
def api_gene_detail(b_number):
    row = gene_lookup[gene_lookup["b_number"] == b_number.lower()]
    if row.empty:
        return jsonify({"error": "not found"}), 404
    row = row.iloc[0]
    prediction = run_prediction(row["sequence"])
    return jsonify({
        "b_number": row["b_number"],
        "gene_name": row["gene_name"],
        "sequence": row["sequence"],
        "actual_solubility_pct": float(row["solubility_pct"]),
        "actual_label": "Soluble" if row["solubility_pct"] >= 50 else "Insoluble",
        "prediction": prediction,
    })


@app.route("/api/dataset-stats")
def api_dataset_stats():
    soluble = feature_table[feature_table["label"] == "Soluble"]
    insoluble = feature_table[feature_table["label"] == "Insoluble"]
    feature_means = {
        feat: {
            "soluble": round(float(soluble[feat].mean()), 4),
            "insoluble": round(float(insoluble[feat].mean()), 4),
        }
        for feat in KEY_FEATURES
    }
    return jsonify({
        "total": len(feature_table),
        "soluble_count": len(soluble),
        "insoluble_count": len(insoluble),
        "feature_means": feature_means,
    })


@app.route("/api/model-stats")
def api_model_stats():
    return jsonify({
        "best_model": BEST_MODEL_NAME,
        "models": model_comparison.round(4).to_dict(orient="records"),
    })


if __name__ == "__main__":
    app.run(port=5000, debug=False)
