import pathlib
import sys

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
import shap

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from tag_rules import recommend_tag

BASE = pathlib.Path(__file__).resolve().parent.parent
PROCESSED = BASE / "data" / "processed"
MODELS = BASE / "models"
REPORTS = BASE / "reports"


def main():
    model = joblib.load(MODELS / "best_model.joblib")
    test_df = pd.read_csv(PROCESSED / "test_set.csv")
    X_test = test_df.drop(columns=["label"])
    y_test = test_df["label"]

    print("Running SHAP TreeExplainer on XGBoost...")
    explainer = shap.TreeExplainer(model)
    shap_values = explainer(X_test)

    # Global importance plot
    fig = plt.figure(figsize=(7, 6))
    shap.summary_plot(shap_values, X_test, show=False, max_display=12)
    fig.tight_layout()
    fig.savefig(REPORTS / "shap_summary.png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved global SHAP summary -> {REPORTS / 'shap_summary.png'}")

    preds = model.predict(X_test)
    shap_df = pd.DataFrame(shap_values.values, columns=X_test.columns, index=X_test.index)

    advisories = []
    for i, (idx, row) in enumerate(X_test.iterrows()):
        if preds[i] == 1:  # predicted Soluble -> no tag needed
            continue
        rec = recommend_tag(row, shap_df.loc[idx])
        advisories.append({
            "row_index": int(idx),
            "actual_label": y_test.loc[idx],
            "predicted": "Insoluble",
            **rec,
        })

    advisory_df = pd.DataFrame(advisories)
    advisory_df.to_csv(REPORTS / "tag_advisor_output.csv", index=False)
    print(f"\nGenerated tag recommendations for {len(advisory_df)} predicted-insoluble proteins")
    print(f"Saved -> {REPORTS / 'tag_advisor_output.csv'}")

    print("\nTag distribution recommended:")
    print(advisory_df["tag"].value_counts())

    print("\nSample recommendations:")
    print(advisory_df[["row_index", "dominant_driver", "driver_value", "tag"]].head(6).to_string(index=False))


if __name__ == "__main__":
    main()
