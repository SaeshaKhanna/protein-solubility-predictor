# Protein Solubility Predictor & Expression Intelligence Console

An explainable machine learning system and interactive workbench for predicting protein solubility in *Escherichia coli* prior to wet-lab cloning, powered by the **eSOL database**, **Biopython**, **XGBoost**, and **SHAP** interpretability.

Developed for the **Pfizer Inc. Therapeutic Protein Expression Problem Statement (UCS321 MST Project)**.

---

## 1. Problem Overview

Recombinant therapeutic protein production in *E. coli* frequently suffers from protein misfolding and aggregation into insoluble **inclusion bodies**. This bottleneck leads to expensive trial-and-error cycles in biotechnology and biopharma pipelines.

This project delivers:
1. A supervised machine learning classification pipeline trained on measured, quantitative *E. coli* proteome data.
2. A **33-dimensional physicochemical feature extractor** using Biopython.
3. **SHAP (SHapley Additive exPlanations)** to pinpoint exact sequence drivers of aggregation or solubility.
4. An automated **fusion-tag recommendation system** (MBP, SUMO, Thioredoxin) to rescue insoluble targets.
5. An interactive, responsive **web workbench** for single-sequence, what-if mutation, and multi-FASTA batch screening.

---

## 2. System Architecture

```
Raw Amino-Acid Sequence (Single or Multi-FASTA)
         │
         ▼
Biopython Feature Extraction (33 Physicochemical Descriptors)
├── GRAVY Hydropathy Index, Isoelectric Point (pI)
├── Molecular Weight, Instability Index, Net Charge @ pH 7
├── Secondary Structure Fractions (Alpha-Helix, Beta-Sheet, Turn)
└── 20 Standard Amino Acid Percentages
         │
         ▼
XGBoost Classification Engine
├── Calibrated Solubility Probability: P(soluble)
└── Binary Verdict: Soluble (≥ 50%) vs Insoluble (< 50%)
         │
         ▼
SHAP Tree Explainer
├── Local feature attribution (positive vs negative impact)
└── Biochemical aggregation driver diagnosis
         │
         ▼
Chaperone / Fusion Tag Rule Engine (If Insoluble)
└── Recommends MBP, SUMO, or Trx based on dominant physical trigger
         │
         ▼
Interactive Web Console (Flask + Modern Vanilla Frontend)
```

---

## 3. Dataset & Preprocessing

- **Source**: *E. coli* K-12 eSOL Database (Niwa et al., *PNAS*). Cell-free measured experimental solubility.
- **Dataset Size**: 3,133 verified proteins.
- **Class Balance**:
  - **Soluble (≥ 50% lab solubility)**: 1,404 proteins (44.8%)
  - **Insoluble (< 50% lab solubility)**: 1,729 proteins (55.2%)
- **Data Splitting**: Stratified 80% training set (2,506 sequences) and 20% held-out test set (627 sequences).

---

## 4. Extracted Sequence Features (33 Dimensions)

| Category | Feature Name | Biological Significance |
| :--- | :--- | :--- |
| **Hydropathy** | `gravy` | Grand Average of Hydropathicity. Positive values indicate hydrophobic sequences prone to aggregation. |
| **Charge & pH** | `isoelectric_point`, `net_charge_at_ph7` | Proteins with pI near physiological pH (7.2) lose electrostatic repulsion and precipitate. |
| **Charge Composition** | `fraction_charged`, `fraction_negative`, `fraction_positive` | Negative surface charge (Asp, Glu) is the primary natural electrostatic barrier against inclusion bodies. |
| **Stability & Mass** | `molecular_weight`, `instability_index` | Large polypeptides (> 45 kDa) fold slower; instability index > 40 indicates in vitro instability. |
| **Aromaticity** | `aromaticity` | Relative fraction of Phe, Trp, Tyr. Excess aromatic residues facilitate non-specific hydrophobic core collapse. |
| **Secondary Structure** | `helix_fraction`, `sheet_fraction`, `turn_fraction` | Extended beta-sheets correlate with amyloid-like aggregation; turns promote compact globular folding. |
| **Residue Frequencies** | `aa_pct_A` through `aa_pct_Y` | Exact percentages for all 20 individual standard amino acids. |

---

## 5. Model Evaluation & Benchmarks

Three models were trained on the exact same cross-validated feature pipeline and evaluated on the held-out test set of 627 proteins:

| Model | Test Accuracy | F1-Score | ROC–AUC | Selection Status |
| :--- | :---: | :---: | :---: | :--- |
| **XGBoost** | **77.8%** | **0.745** | **0.858** | **Selected Best Model** |
| **Random Forest** | 78.5% | 0.745 | 0.855 | Benchmark Candidate |
| **Logistic Regression** | 76.2% | 0.730 | 0.841 | Linear Baseline |

### Test Set Confusion Matrix (XGBoost on N = 627)

```
                       Predicted Insoluble    Predicted Soluble
Actual Insoluble (346)       284 (TN)               62 (FP)      -> 82.1% Specificity
Actual Soluble (281)          78 (FN)              203 (TP)      -> 72.2% Sensitivity (Recall)
```
- **Overall Accuracy**: `(284 + 203) / 627 = 77.8%`
- **Precision (Soluble)**: `203 / (203 + 62) = 76.6%`
- **ROC-AUC**: `0.858`

---

## 6. Explainability & Rescue Interventions

### SHAP Explanations
Rather than outputting a black-box percentage, the system passes the trained model to `shap.TreeExplainer`. For any given input:
- Features with **positive SHAP values** push the prediction toward **Soluble**.
- Features with **negative SHAP values** push the prediction toward **Insoluble**.

### Fusion Tag Recommendation Rules
When a protein is predicted insoluble, the dominant SHAP trigger is routed through biological heuristics:
1. **High Hydrophobicity (`gravy > 0`)**: Suggests **MBP (Maltose-Binding Protein)** — the most potent carrier for hydrophobic targets.
2. **High Instability (`instability_index > 40`)**: Suggests **SUMO** — promotes rapid initial folding and acts as an in vitro nucleation chaperone.
3. **High Charged Fraction (`fraction_charged > 0.30`)**: Suggests **Thioredoxin (Trx)** — a compact oxidoreductase partner that stabilizes electrostatic misfolding.
4. **General Default**: Suggests **SUMO** as a standard first-line fusion carrier.

---

## 7. Web Application Modules

- **Predictor (`/predictor`)**:
  - Live prediction with confidence gauge.
  - One-click presets: `yaaX (Soluble)`, `GFP (Soluble)`, `Lysozyme (Soluble)`, `thrB (Insoluble)`, `Human Insulin (Insoluble)`.
  - 6-card curated biochemical profile (GRAVY, pI, Instability, MW, Charge, Secondary Structure).
  - SHAP driver impact cards with biological interpretations.
  - What-If in-silico mutation simulator (substitute any single residue to observe change in P(soluble)).
- **Gene Lookup (`/lookup`)**: Search 3,133 *E. coli* genes by symbol or b-number with experimental ground-truth vs model verdict.
- **Batch Analysis (`/batch`)**: Multi-FASTA sequential screening with live summary counts and one-click CSV export.
- **Dataset & Evidence (`/dataset`)**: Curated interactive confusion matrix, global SHAP feature importance chart, class balance metrics, and candidate model table.

---

## 8. Installation & Quickstart

### Prerequisites
- Python 3.10+ (tested on Python 3.13)
- Required packages: `flask`, `biopython`, `pandas`, `scikit-learn`, `xgboost`, `shap`, `joblib`

Install dependencies:
```bash
pip install flask biopython pandas scikit-learn xgboost shap joblib
```

### Running the Application

#### Option 1: Double-click script (Windows)
Run [`run.bat`](run.bat) in the repository root.

#### Option 2: Terminal command
```bash
cd MST-Project/protein_solubility
python backend/server.py
```

Open your browser and navigate to:
```
http://localhost:5000
```

---

## 9. Project Directory Structure

```
protein-solubility-predictor/
├── README.md                      # Project documentation and theoretical foundation
├── run.bat                        # Single-click Windows launch script
├── .gitignore                     # Git ignore rules (pycache, envs, logs)
└── MST-Project/
    ├── problem_statements.txt     # Course problem statement specification
    └── protein_solubility/
        ├── backend/
        │   └── server.py          # Flask REST API & static web server
        ├── frontend/
        │   ├── index.html         # Landing page and workbench overview
        │   ├── predictor.html     # Single-sequence inference & mutation analysis
        │   ├── lookup.html        # E. coli eSOL gene search & evidence comparison
        │   ├── batch.html         # Multi-FASTA screening queue with CSV export
        │   ├── dataset.html       # Curated interactive model benchmarks & metrics
        │   ├── style.css          # Vanilla CSS design system (bold & responsive)
        │   └── app.js             # Client application logic & chart rendering
        ├── src/
        │   ├── features.py        # Biopython physicochemical property extraction
        │   ├── tag_rules.py       # Heuristic fusion-tag recommendation engine
        │   ├── fetch_data.py      # eSOL dataset downloader and parser
        │   ├── build_features.py  # Bulk feature dataset builder
        │   ├── train_model.py     # Training & model cross-validation scripts
        │   └── explain_and_advise.py # Batch SHAP explanation generator
        ├── data/
        │   └── processed/         # Cleaned feature tables & train/test splits
        ├── models/
        │   ├── best_model.joblib  # Serialized XGBoost model
        │   ├── feature_names.json # List of 33 model feature inputs
        │   └── best_model_name.txt# Name of top-performing candidate
        └── reports/
            ├── model_comparison.csv   # Accuracy, F1, ROC-AUC comparison table
            ├── best_model_report.txt  # Classification report
            ├── confusion_matrix.png   # Research confusion matrix figure
            └── shap_summary.png       # Research SHAP beeswarm plot
```

---

## 10. References

1. **Niwa, T., et al.** (2009). *Bimodal distribution of protein expression levels in Escherichia coli.* Proceedings of the National Academy of Sciences (PNAS), 106(11), 4201–4206.
2. **Lundin, M., et al.** (2012). *Predicting protein solubility from sequence with machine learning.* Bioinformatics.
3. **Lundberg, S. M., & Lee, S.-I.** (2017). *A unified approach to interpreting model predictions.* Advances in Neural Information Processing Systems (NeurIPS).
4. **Cock, P. J., et al.** (2009). *Biopython: freely available Python tools for computational molecular biology and bioinformatics.* Bioinformatics, 25(11), 1422–1423.
