import re

from Bio.SeqUtils.ProtParam import ProteinAnalysis

VALID_AA = set("ACDEFGHIKLMNPQRSTVWY")
CHARGED_POS = set("KR")
CHARGED_NEG = set("DE")


def clean_sequence(seq: str) -> str:
    seq = re.sub(r"[^A-Za-z]", "", seq).upper()
    seq = seq.replace("U", "C").replace("O", "K")
    return "".join(ch for ch in seq if ch in VALID_AA)


def extract_features(seq: str) -> dict | None:
    seq = clean_sequence(seq)
    if len(seq) < 10:
        return None

    pa = ProteinAnalysis(seq)
    length = len(seq)
    n_pos = sum(seq.count(a) for a in CHARGED_POS)
    n_neg = sum(seq.count(a) for a in CHARGED_NEG)
    helix, turn, sheet = pa.secondary_structure_fraction()

    features = {
        "sequence_length": length,
        "molecular_weight": pa.molecular_weight(),
        "isoelectric_point": pa.isoelectric_point(),
        "gravy": pa.gravy(),
        "aromaticity": pa.aromaticity(),
        "instability_index": pa.instability_index(),
        "net_charge_at_ph7": n_pos - n_neg,
        "fraction_charged": (n_pos + n_neg) / length,
        "fraction_positive": n_pos / length,
        "fraction_negative": n_neg / length,
        "helix_fraction": helix,
        "turn_fraction": turn,
        "sheet_fraction": sheet,
    }
    for aa, pct in pa.amino_acids_percent.items():
        features[f"aa_pct_{aa}"] = pct
    return features
