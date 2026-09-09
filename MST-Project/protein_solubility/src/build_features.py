import pathlib
import re
import sys

import pandas as pd

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from features import extract_features

BASE = pathlib.Path(__file__).resolve().parent.parent
RAW = BASE / "data" / "raw"
PROCESSED = BASE / "data" / "processed"
PROCESSED.mkdir(parents=True, exist_ok=True)

SOLUBILITY_THRESHOLD = 50.0
BNUM_RE = re.compile(r"\bb\d{4}\b", re.IGNORECASE)


def load_esol():
    df = pd.read_csv(RAW / "esol_quant_mod3.tab", sep="\t")
    df = df.rename(columns={
        "Locustag MG1655": "b_number",
        "Gene name K-12": "gene_name",
        "Solubility(%)": "solubility_pct",
    })
    df["b_number"] = df["b_number"].astype(str).str.strip().str.lower()
    df = df.dropna(subset=["solubility_pct", "b_number"])
    df = df[df["b_number"].str.match(r"^b\d{4}$")]
    return df[["b_number", "gene_name", "solubility_pct"]]


def load_uniprot_sequences():
    df = pd.read_csv(RAW / "uniprot_ecoli_k12.tsv", sep="\t")
    records = []
    for _, row in df.iterrows():
        gene_names = str(row.get("Gene Names", ""))
        match = BNUM_RE.search(gene_names)
        if not match:
            continue
        records.append({
            "b_number": match.group(0).lower(),
            "sequence": str(row["Sequence"]).strip(),
        })
    return pd.DataFrame(records).drop_duplicates(subset="b_number")


def main():
    esol = load_esol()
    seqs = load_uniprot_sequences()
    print(f"eSOL rows with valid b-number: {len(esol)}")
    print(f"UniProt sequences with b-number tag: {len(seqs)}")

    merged = esol.merge(seqs, on="b_number", how="inner")
    print(f"Matched (have both label + sequence): {len(merged)}")

    rows = []
    dropped = 0
    for _, r in merged.iterrows():
        feats = extract_features(r["sequence"])
        if feats is None:
            dropped += 1
            continue
        feats["b_number"] = r["b_number"]
        feats["gene_name"] = r["gene_name"]
        feats["solubility_pct"] = r["solubility_pct"]
        feats["label"] = "Soluble" if r["solubility_pct"] >= SOLUBILITY_THRESHOLD else "Insoluble"
        rows.append(feats)

    print(f"Dropped (sequence too short/invalid): {dropped}")

    out = pd.DataFrame(rows)
    id_cols = ["b_number", "gene_name", "solubility_pct", "label"]
    feature_cols = [c for c in out.columns if c not in id_cols]
    out = out[id_cols + feature_cols]

    out_path = PROCESSED / "feature_table.csv"
    out.to_csv(out_path, index=False)
    print(f"\nWrote {len(out)} rows x {len(feature_cols)} features -> {out_path}")
    print("\nLabel balance:")
    print(out["label"].value_counts())

    lookup = merged[merged["b_number"].isin(out["b_number"])][
        ["b_number", "gene_name", "sequence", "solubility_pct"]
    ]
    lookup_path = PROCESSED / "gene_lookup.csv"
    lookup.to_csv(lookup_path, index=False)
    print(f"Wrote {len(lookup)} rows -> {lookup_path}")


if __name__ == "__main__":
    main()
