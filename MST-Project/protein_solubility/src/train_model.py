"""
Trains and compares three classifiers on the ProtParam feature table:
Logistic Regression -> Random Forest -> XGBoost.

Saves the best model + scaler + evaluation report + confusion matrix plot.

Run: python src/train_model.py
"""
import json
import pathlib

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    ConfusionMatrixDisplay,
    accuracy_score,
    classification_report,
    f1_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

BASE = pathlib.Path(__file__).resolve().parent.parent
PROCESSED = BASE / "data" / "processed"
MODELS = BASE / "models"
REPORTS = BASE / "reports"
MODELS.mkdir(exist_ok=True)
REPORTS.mkdir(exist_ok=True)

ID_COLS = ["b_number", "gene_name", "solubility_pct", "label"]
RANDOM_STATE = 42


def load_data():
    df = pd.read_csv(PROCESSED / "feature_table.csv")
    X = df.drop(columns=ID_COLS)
    y = (df["label"] == "Soluble").astype(int)  # 1 = Soluble, 0 = Insoluble
    feature_names = list(X.columns)
    return X, y, feature_names, df


def evaluate(name, model, X_test, y_test):
    preds = model.predict(X_test)
    proba = model.predict_proba(X_test)[:, 1]
    return {
        "model": name,
        "accuracy": accuracy_score(y_test, preds),
        "f1": f1_score(y_test, preds),
        "roc_auc": roc_auc_score(y_test, proba),
        "report": classification_report(y_test, preds, target_names=["Insoluble", "Soluble"]),
        "preds": preds,
    }


def main():
    X, y, feature_names, df = load_data()
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    results = []

    log_reg = LogisticRegression(max_iter=1000, random_state=RANDOM_STATE)
    log_reg.fit(X_train_scaled, y_train)
    results.append(evaluate("Logistic Regression", log_reg, X_test_scaled, y_test))

    rf = RandomForestClassifier(n_estimators=300, max_depth=12, random_state=RANDOM_STATE, n_jobs=-1)
    rf.fit(X_train, y_train)
    results.append(evaluate("Random Forest", rf, X_test, y_test))

    xgb = XGBClassifier(
        n_estimators=300, max_depth=5, learning_rate=0.05,
        subsample=0.9, colsample_bytree=0.9,
        eval_metric="logloss", random_state=RANDOM_STATE,
    )
    xgb.fit(X_train, y_train)
    results.append(evaluate("XGBoost", xgb, X_test, y_test))

    print("\n=== Model comparison ===")
    summary = pd.DataFrame([
        {"model": r["model"], "accuracy": r["accuracy"], "f1": r["f1"], "roc_auc": r["roc_auc"]}
        for r in results
    ])
    print(summary.to_string(index=False))

    best_idx = summary["roc_auc"].idxmax()
    best_name = summary.loc[best_idx, "model"]
    best_result = results[best_idx]
    best_model = {"Logistic Regression": log_reg, "Random Forest": rf, "XGBoost": xgb}[best_name]
    best_X_test = X_test_scaled if best_name == "Logistic Regression" else X_test

    print(f"\nBest model: {best_name}")
    print(best_result["report"])

    joblib.dump(best_model, MODELS / "best_model.joblib")
    joblib.dump(scaler, MODELS / "scaler.joblib")
    with open(MODELS / "feature_names.json", "w") as f:
        json.dump(feature_names, f, indent=2)
    with open(MODELS / "best_model_name.txt", "w") as f:
        f.write(best_name)

    summary.to_csv(REPORTS / "model_comparison.csv", index=False)
    with open(REPORTS / "best_model_report.txt", "w") as f:
        f.write(f"Best model: {best_name}\n\n")
        f.write(best_result["report"])

    fig, ax = plt.subplots(figsize=(5, 4.5))
    ConfusionMatrixDisplay.from_predictions(
        y_test, best_result["preds"],
        display_labels=["Insoluble", "Soluble"],
        cmap="Greens", ax=ax,
    )
    ax.set_title(f"{best_name} — Confusion Matrix")
    fig.tight_layout()
    fig.savefig(REPORTS / "confusion_matrix.png", dpi=150)

    # Save test split (unscaled) for the SHAP + app step
    X_test.assign(label=y_test.values).to_csv(PROCESSED / "test_set.csv", index=False)
    X_train.assign(label=y_train.values).to_csv(PROCESSED / "train_set.csv", index=False)

    print(f"\nSaved: models/best_model.joblib, models/scaler.joblib")
    print(f"Saved: reports/model_comparison.csv, reports/confusion_matrix.png")


if __name__ == "__main__":
    main()
