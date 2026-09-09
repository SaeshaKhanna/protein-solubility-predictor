TAG_RULES = [
    {
        "driver": "gravy",
        "condition": lambda v: v > 0,
        "tag": "MBP (Maltose-Binding Protein)",
        "reason": "High hydrophobicity (GRAVY > 0) drives aggregation; MBP is the strongest "
                  "general-purpose solubility carrier for hydrophobic proteins.",
    },
    {
        "driver": "instability_index",
        "condition": lambda v: v > 40,
        "tag": "SUMO",
        "reason": "Instability index above 40 indicates a poorly-folding sequence; SUMO "
                  "fusions are known to improve folding kinetics for unstable proteins.",
    },
    {
        "driver": "fraction_charged",
        "condition": lambda v: v > 0.30,
        "tag": "Thioredoxin (Trx)",
        "reason": "Very high charged-residue fraction suggests charge-driven misfolding; "
                  "Trx's small, reducing-environment profile helps here.",
    },
    {
        "driver": "aromaticity",
        "condition": lambda v: v > 0.12,
        "tag": "MBP (Maltose-Binding Protein)",
        "reason": "High aromatic content promotes hydrophobic stacking; MBP fusion "
                  "counteracts this well.",
    },
]

DEFAULT_TAG = {
    "tag": "SUMO",
    "reason": "No single dominant driver crossed a rule threshold; SUMO is the safest "
              "general first choice for borderline-insoluble proteins.",
}


def recommend_tag(feature_row, shap_row):
    driver_shap = shap_row.abs().sort_values(ascending=False)
    for driver_name in driver_shap.index:
        for rule in TAG_RULES:
            if rule["driver"] == driver_name and rule["condition"](feature_row[driver_name]):
                return {
                    "dominant_driver": driver_name,
                    "driver_value": round(float(feature_row[driver_name]), 3),
                    "tag": rule["tag"],
                    "reason": rule["reason"],
                }
    top = driver_shap.index[0]
    return {
        "dominant_driver": top,
        "driver_value": round(float(feature_row[top]), 3),
        **DEFAULT_TAG,
    }
