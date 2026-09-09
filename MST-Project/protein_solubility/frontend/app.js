const AMINO_ACIDS = "ACDEFGHIKLMNPQRSTVWY".split("");

const EXAMPLES = {
  thrB: "MVKVYAPASSANMSVGFDVLGAAVTPVDGALLGDVVTVEAAETFSLNNLGRFADKLPSEP"
      + "RENIVYQCWERFCQELGKQIPVAMTLEKNMPIGSGLGSSACSVVAALMAMNEHCGKPLND"
      + "TRLLALMGELEGRISGSIHYDNVAPCFLGGMQLMIEENDIISQQVPGFDEWLWVLAYPGI"
      + "KVSTAEARAILPAQYRRQDCIAHGRHLAGFIHACYSRQPELAAKLMKDVIAEPYRERLLP"
      + "GFRQARQAVAEIGAVASGISGSGPTLFALCDKPETAQRVADWLGKNYLQNQEGFVHICRL"
      + "DTAGARVLEN",
  yaaX: "MSKRARTQETVGPDGTQLVAVSAWLNAHRYENYHKVVNCNGLTKEQLMQALLERFPQNL"
      + "RQNAGREMTEHESIQEVWQEVIGDDLENLPADSRAVVRQSFDAPTGQPTVASWMRVITL"
      + "VLMGLAMYAMYSNGWH",
};

let lastSequence = "";

// ---------- Predictor ----------
const exampleSelect = document.getElementById("example-select");
const sequenceInput = document.getElementById("sequence-input");

if (exampleSelect && sequenceInput) {
  exampleSelect.addEventListener("change", () => {
    if (EXAMPLES[exampleSelect.value]) sequenceInput.value = EXAMPLES[exampleSelect.value];
  });
}

const mutResidue = document.getElementById("mut-residue");
if (mutResidue) {
  AMINO_ACIDS.forEach(aa => {
    const opt = document.createElement("option");
    opt.value = aa; opt.textContent = aa;
    mutResidue.appendChild(opt);
  });
}

function renderDriverBars(drivers) {
  const container = document.getElementById("driver-bars");
  container.innerHTML = "";
  const maxAbs = Math.max(...drivers.map(d => Math.abs(d.shap)), 0.001);
  drivers.forEach(d => {
    const row = document.createElement("div");
    row.className = "driver-row";
    const widthPct = (Math.abs(d.shap) / maxAbs) * 50;
    row.innerHTML = `
      <div class="driver-name" title="${d.feature}">${d.feature}</div>
      <div class="driver-track">
        <div class="driver-mid-line"></div>
        <div class="driver-fill ${d.shap >= 0 ? "pos" : "neg"}" style="width:${widthPct}%"></div>
      </div>
      <div class="driver-val">${d.shap >= 0 ? "+" : ""}${d.shap.toFixed(3)}</div>
    `;
    container.appendChild(row);
  });
}

function renderResult(result) {
  document.getElementById("result-empty").classList.add("hidden");
  document.getElementById("result-body").classList.remove("hidden");

  const box = document.getElementById("verdict-box");
  box.className = "verdict " + result.label.toLowerCase();
  document.getElementById("verdict-label").textContent = "Predicted: " + result.label;
  document.getElementById("prob-fill").style.width = (result.proba_soluble * 100).toFixed(1) + "%";
  document.getElementById("prob-caption").textContent = "P(soluble) = " + result.proba_soluble.toFixed(3);

  renderDriverBars(result.top_drivers);

  const tagCard = document.getElementById("tag-card");
  if (result.tag_recommendation) {
    tagCard.classList.remove("hidden");
    document.getElementById("tag-name").textContent = result.tag_recommendation.tag;
    document.getElementById("tag-driver").textContent =
      `Dominant driver: ${result.tag_recommendation.dominant_driver} = ${result.tag_recommendation.driver_value}`;
    document.getElementById("tag-reason").textContent = result.tag_recommendation.reason;
  } else {
    tagCard.classList.add("hidden");
  }
}

async function predict(sequence) {
  const res = await fetch("/api/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sequence }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Prediction failed");
  return data;
}

const predictBtn = document.getElementById("predict-btn");
if (predictBtn) {
  predictBtn.addEventListener("click", async () => {
    const seq = sequenceInput.value.trim();
    const errorEl = document.getElementById("predict-error");
    errorEl.textContent = "";
    if (!seq) { errorEl.textContent = "Paste a sequence first."; return; }
    try {
      const result = await predict(seq);
      lastSequence = seq.replace(/[^A-Za-z]/g, "").toUpperCase();
      renderResult(result);
      document.getElementById("mut-position").max = lastSequence.length;
      document.getElementById("mut-position").value = 1;
      document.getElementById("mut-current").value = lastSequence[0] || "";
      document.getElementById("mutation-result").innerHTML = "";
    } catch (e) {
      errorEl.textContent = e.message;
    }
  });
}

const mutPositionInput = document.getElementById("mut-position");
if (mutPositionInput) {
  mutPositionInput.addEventListener("input", (e) => {
    const pos = parseInt(e.target.value, 10);
    if (lastSequence && pos >= 1 && pos <= lastSequence.length) {
      document.getElementById("mut-current").value = lastSequence[pos - 1];
    }
  });
}

const mutateBtn = document.getElementById("mutate-btn");
if (mutateBtn) {
  mutateBtn.addEventListener("click", async () => {
    const resultDiv = document.getElementById("mutation-result");
    if (!lastSequence) { resultDiv.textContent = "Run a prediction first."; return; }
    const position = parseInt(document.getElementById("mut-position").value, 10);
    const residue = document.getElementById("mut-residue").value;

    const res = await fetch("/api/mutate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sequence: lastSequence, position, residue }),
    });
    const data = await res.json();
    if (!res.ok) { resultDiv.textContent = data.error; return; }

    const before = parseFloat(document.getElementById("prob-caption").textContent.split("=")[1]);
    const after = data.proba_soluble;
    const delta = after - before;
    const cls = delta >= 0 ? "delta-up" : "delta-down";
    resultDiv.innerHTML =
      `${data.original_residue}${position}${residue}: ` +
      `P(soluble) ${before.toFixed(3)} &rarr; ${after.toFixed(3)} ` +
      `<span class="${cls}">(${delta >= 0 ? "+" : ""}${delta.toFixed(3)})</span>`;
  });
}

// ---------- Gene lookup ----------
const geneSearch = document.getElementById("gene-search");
if (geneSearch) {
  let geneDebounce = null;
  geneSearch.addEventListener("input", () => {
    clearTimeout(geneDebounce);
    geneDebounce = setTimeout(async () => {
      const q = geneSearch.value.trim();
      const resultsDiv = document.getElementById("gene-results");
      if (q.length < 1) { resultsDiv.innerHTML = ""; return; }
      const res = await fetch("/api/genes?q=" + encodeURIComponent(q));
      const data = await res.json();
      resultsDiv.innerHTML = "";
      data.results.forEach(g => {
        const row = document.createElement("div");
        row.className = "gene-row";
        row.innerHTML = `<span>${g.gene_name} <span class="gene-tag">(${g.b_number})</span></span>
                          <span class="gene-tag">${g.solubility_pct}% soluble</span>`;
        row.addEventListener("click", () => loadGeneDetail(g.b_number));
        resultsDiv.appendChild(row);
      });
    }, 200);
  });
}

async function loadGeneDetail(bNumber) {
  const res = await fetch("/api/gene/" + bNumber);
  const data = await res.json();
  if (!res.ok) return;

  const card = document.getElementById("gene-detail-card");
  card.classList.remove("hidden");
  document.getElementById("gene-detail-title").textContent = `${data.gene_name} (${data.b_number})`;
  document.getElementById("gene-actual-label").textContent = data.actual_label;
  document.getElementById("gene-actual-pct").textContent = data.actual_solubility_pct + "% measured solubility";
  document.getElementById("gene-pred-label").textContent = data.prediction.label;
  document.getElementById("gene-pred-pct").textContent = "P(soluble) = " + data.prediction.proba_soluble.toFixed(3);

  const banner = document.getElementById("gene-match-banner");
  const match = data.actual_label === data.prediction.label;
  banner.className = "match-banner " + (match ? "match" : "mismatch");
  banner.textContent = match
    ? "Model prediction matches the measured lab result."
    : "Model prediction disagrees with the measured lab result.";
}

// ---------- Batch ----------
const batchBtn = document.getElementById("batch-btn");
if (batchBtn) {
  batchBtn.addEventListener("click", async () => {
    const raw = document.getElementById("batch-input").value.trim();
    const resultsDiv = document.getElementById("batch-results");
    if (!raw) { resultsDiv.textContent = "Paste at least one sequence."; return; }

    const entries = [];
    const blocks = raw.split(">").map(b => b.trim()).filter(Boolean);
    blocks.forEach(block => {
      const lines = block.split("\n");
      const label = lines[0].trim() || "unnamed";
      const sequence = lines.slice(1).join("").trim();
      if (sequence) entries.push({ label, sequence });
    });
    if (entries.length === 0) { resultsDiv.textContent = "No valid FASTA-style entries found."; return; }

    const res = await fetch("/api/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sequences: entries }),
    });
    const data = await res.json();

    let html = "<table><thead><tr><th>Label</th><th>Prediction</th><th>P(soluble)</th><th>Tag</th></tr></thead><tbody>";
    data.results.forEach(r => {
      if (r.error) {
        html += `<tr><td>${r.label}</td><td colspan="3">${r.error}</td></tr>`;
      } else {
        const pillClass = r.predicted_label.toLowerCase();
        html += `<tr><td>${r.label}</td>
                  <td><span class="pill ${pillClass}">${r.predicted_label}</span></td>
                  <td>${r.proba_soluble.toFixed(3)}</td>
                  <td>${r.tag}</td></tr>`;
      }
    });
    html += "</tbody></table>";
    resultsDiv.innerHTML = html;
  });
}

// ---------- Dataset & model ----------
const FEATURE_LABELS = {
  gravy: "GRAVY (hydrophobicity)",
  molecular_weight: "Molecular weight (Da)",
  instability_index: "Instability index",
  isoelectric_point: "Isoelectric point (pI)",
  aromaticity: "Aromaticity",
  fraction_charged: "Fraction charged residues",
};

async function loadDatasetStats() {
  const res = await fetch("/api/dataset-stats");
  const data = await res.json();

  const summary = document.getElementById("dataset-summary");
  summary.innerHTML = `
    <div class="dataset-stat"><div class="num">${data.total}</div><div class="lbl">TOTAL PROTEINS</div></div>
    <div class="dataset-stat"><div class="num soluble">${data.soluble_count}</div><div class="lbl">SOLUBLE</div></div>
    <div class="dataset-stat"><div class="num insoluble">${data.insoluble_count}</div><div class="lbl">INSOLUBLE</div></div>
  `;

  const solPct = (data.soluble_count / data.total) * 100;
  document.getElementById("class-balance-bar").innerHTML =
    `<div class="seg-soluble" style="width:${solPct}%"></div>
     <div class="seg-insoluble" style="width:${100 - solPct}%"></div>`;

  const fc = document.getElementById("feature-compare");
  fc.innerHTML = "";
  Object.entries(data.feature_means).forEach(([feat, vals]) => {
    const maxAbs = Math.max(Math.abs(vals.soluble), Math.abs(vals.insoluble), 0.001);
    const solWidth = (Math.abs(vals.soluble) / maxAbs) * 100;
    const insWidth = (Math.abs(vals.insoluble) / maxAbs) * 100;
    const row = document.createElement("div");
    row.innerHTML = `
      <div class="fc-label">${FEATURE_LABELS[feat] || feat}</div>
      <div class="fc-bars">
        <span class="fc-val">${vals.soluble}</span>
        <div class="fc-bar-track"><div class="fc-bar-fill soluble" style="width:${solWidth}%"></div></div>
      </div>
      <div class="fc-bars">
        <span class="fc-val">${vals.insoluble}</span>
        <div class="fc-bar-track"><div class="fc-bar-fill insoluble" style="width:${insWidth}%"></div></div>
      </div>
    `;
    fc.appendChild(row);
  });
}

async function loadModelStats() {
  const res = await fetch("/api/model-stats");
  const data = await res.json();
  const tbody = document.querySelector("#model-table tbody");
  tbody.innerHTML = "";
  data.models.forEach(m => {
    const tr = document.createElement("tr");
    const isBest = m.model === data.best_model;
    if (isBest) tr.classList.add("best");
    const name = isBest ? `${m.model} (selected)` : m.model;
    tr.innerHTML = `<td>${name}</td><td>${(m.accuracy * 100).toFixed(1)}%</td>
                     <td>${m.f1.toFixed(3)}</td><td>${m.roc_auc.toFixed(3)}</td>`;
    tbody.appendChild(tr);
  });
}

if (document.getElementById("dataset-summary")) {
  loadDatasetStats();
  loadModelStats();
}
