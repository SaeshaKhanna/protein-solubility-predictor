"""
Pulls the two raw sources needed for the protein solubility project:

1. eSOL solubility labels (Niwa et al. 2009/2012) - quant_mod3.tab
   Source: http://www.tanpaku.org/tp-esol/
2. E. coli K-12 (UP000000625) sequences + gene name synonyms from UniProt,
   used to map eSOL's b-numbers to amino-acid sequences.

Run once: python src/fetch_data.py
"""
import pathlib
import requests

RAW_DIR = pathlib.Path(__file__).resolve().parent.parent / "data" / "raw"
RAW_DIR.mkdir(parents=True, exist_ok=True)

ESOL_URL = "http://www.tanpaku.org/tp-esol/downloader.php?filepath=data%2Fquant_mod3.tab"
UNIPROT_URL = "https://rest.uniprot.org/uniprotkb/stream"
UNIPROT_PARAMS = {
    "query": "proteome:UP000000625",
    "fields": "accession,gene_names,sequence,length",
    "format": "tsv",
}


def fetch_esol():
    dest = RAW_DIR / "esol_quant_mod3.tab"
    print(f"Fetching eSOL solubility data -> {dest}")
    r = requests.get(ESOL_URL, timeout=60, verify=False)
    r.raise_for_status()
    dest.write_bytes(r.content)
    print(f"  {len(r.content):,} bytes")


def fetch_uniprot():
    dest = RAW_DIR / "uniprot_ecoli_k12.tsv"
    print(f"Fetching E. coli K-12 sequences from UniProt -> {dest}")
    r = requests.get(UNIPROT_URL, params=UNIPROT_PARAMS, timeout=120)
    r.raise_for_status()
    dest.write_text(r.text, encoding="utf-8")
    print(f"  {len(r.text.splitlines()) - 1:,} proteins")


if __name__ == "__main__":
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    fetch_esol()
    fetch_uniprot()
    print("Done.")
