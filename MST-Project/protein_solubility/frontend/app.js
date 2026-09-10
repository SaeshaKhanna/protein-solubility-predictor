"use strict";

document.documentElement.classList.add("js");

const AMINO_ACIDS = "ACDEFGHIKLMNPQRSTVWY".split("");
const AMINO_ACID_SET = new Set(AMINO_ACIDS);

const EXAMPLES = {
  thrb: "MVKVYAPASSANMSVGFDVLGAAVTPVDGALLGDVVTVEAAETFSLNNLGRFADKLPSEP"
    + "RENIVYQCWERFCQELGKQIPVAMTLEKNMPIGSGLGSSACSVVAALMAMNEHCGKPLND"
    + "TRLLALMGELEGRISGSIHYDNVAPCFLGGMQLMIEENDIISQQVPGFDEWLWVLAYPGI"
    + "KVSTAEARAILPAQYRRQDCIAHGRHLAGFIHACYSRQPELAAKLMKDVIAEPYRERLLP"
    + "GFRQARQAVAEIGAVASGISGSGPTLFALCDKPETAQRVADWLGKNYLQNQEGFVHICRL"
    + "DTAGARVLEN",
  yaax: "MSKRARTQETVGPDGTQLVAVSAWLNAHRYENYHKVVNCNGLTKEQLMQALLERFPQNL"
    + "RQNAGREMTEHESIQEVWQEVIGDDLENLPADSRAVVRQSFDAPTGQPTVASWMRVITL"
    + "VLMGLAMYAMYSNGWH",
  gfp: "MSKGEELFTGVVPILVELDGDVNGHKFSVSGEGEGDATYGKLTLKFICTTGKLPVPWPTL"
    + "VTTFSYGVQCFSRYPDHMKQHDFFKSAMPEGYVQERTIFFKDDGNYKTRAEVKFEGDTLV"
    + "NRIELKGIDFKEDGNILGHKLEYNYNSHNVYIMADKQKNGIKVNFKIRHNIEDGSVQLAD"
    + "HYQQNTPIGDGPVLLPDNHYLSTQSALSKDPNEKRDHMVLLEFVTAAGITHGMDELYK",
  lysozyme: "KVFGRCELAAAMKRHGLDNYRGYSLGNWVCAAKFESNFNTQATNRNTDGSTDYGILQIN"
    + "SRWWCNDGRTPGSRNLCNIPCSALLSSDITASVNCAKKIVSDGNGMNAWVAWRNRCKGTD"
    + "VQAWIRGCRL",
  insulin: "MALWMRLLPLLALLALWGPDPAAAFVNQHLCGSHLVEALYLVCGERGFFYTPKTRREAED"
    + "LQVGQVELGGGPGAGSLQPLALEGSLQKRGIVEQCCTSICSLYQLENYCN",
};

EXAMPLES.thrB = EXAMPLES.thrb;
EXAMPLES.yaaX = EXAMPLES.yaax;

const FEATURE_LABELS = {
  gravy: "GRAVY · Hydrophobicity",
  molecular_weight: "Molecular Weight · Da",
  instability_index: "Instability Index",
  isoelectric_point: "Isoelectric Point · pI",
  aromaticity: "Aromaticity (F, W, Y)",
  fraction_charged: "Charged-Residue Fraction",
  fraction_negative: "Fraction Negative (D, E)",
  fraction_positive: "Fraction Positive (K, R)",
  net_charge_at_ph7: "Net Charge at pH 7",
  helix_fraction: "Alpha-Helix Fraction",
  sheet_fraction: "Beta-Sheet Fraction",
  turn_fraction: "Turn Fraction",
};

const FEATURE_EXPLANATIONS = {
  gravy: "Grand Average Hydropathy. Positive = hydrophobic (aggregation risk); Negative = hydrophilic (soluble).",
  molecular_weight: "Total polypeptide mass. Smaller proteins fold faster and avoid inclusion body formation.",
  instability_index: "In vitro thermodynamic stability index (< 40 is stable in cytoplasm; > 40 is unstable).",
  isoelectric_point: "pI point. Proteins with pI near physiological pH (7.2) lose electrostatic repulsion and aggregate.",
  aromaticity: "Aromatic residues (Phe, Trp, Tyr). High aromaticity promotes sticky non-specific core collapse.",
  fraction_charged: "Total fraction of Asp, Glu, Lys, Arg. High surface charge creates repulsion that preserves solubility.",
  fraction_negative: "Asp & Glu content. High negative surface charge is the primary natural deterrent against inclusion bodies in E. coli.",
  fraction_positive: "Lys & Arg content. Basic surface residues contributing to net positive surface charge.",
  net_charge_at_ph7: "Net formal charge at pH 7.2. High negative or positive net charge prevents self-association.",
  helix_fraction: "Percentage of residues in alpha-helical conformation.",
  sheet_fraction: "Beta-sheet content. Excess beta sheets often promote amyloid-like cross-beta aggregation.",
  turn_fraction: "Direction-reversal loops promoting compact globular folding.",
};

const byId = (id) => document.getElementById(id);

function makeElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function sequenceSource(value) {
  return String(value || "")
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith(">"))
    .join("");
}

function normalizeSequence(value) {
  const letters = sequenceSource(value).toUpperCase().replace(/[^A-Z]/g, "");
  return Array.from(letters, (residue) => {
    if (residue === "U") return "C";
    if (residue === "O") return "K";
    return residue;
  }).filter((residue) => AMINO_ACID_SET.has(residue)).join("");
}

function getSequenceStats(value) {
  const letters = sequenceSource(value).toUpperCase().replace(/[^A-Z]/g, "");
  let valid = 0;
  let invalid = 0;
  for (const residue of letters) {
    if (AMINO_ACID_SET.has(residue) || residue === "U" || residue === "O") valid += 1;
    else invalid += 1;
  }
  return { valid, invalid };
}

function formatNumber(value, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return number.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });

  const body = await response.text();
  let data = {};
  if (body) {
    try {
      data = JSON.parse(body);
    } catch (_error) {
      throw new Error(response.ok ? "The server returned an unreadable response." : "The server could not complete this request.");
    }
  }

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status}).`);
  }
  return data;
}

function setButtonBusy(button, busy, busyLabel) {
  if (!button) return;
  const label = button.querySelector(".btn-label");
  if (label && !button.dataset.idleLabel) button.dataset.idleLabel = label.textContent;
  button.disabled = busy;
  button.classList.toggle("loading", busy);
  button.setAttribute("aria-busy", String(busy));
  if (label) label.textContent = busy ? busyLabel : button.dataset.idleLabel;
}

function showMessage(element, message, success = false) {
  if (!element) return;
  element.textContent = message || "";
  element.classList.toggle("success", Boolean(success && message));
}

function initRevealMotion() {
  const nodes = Array.from(document.querySelectorAll("[data-reveal]"));
  if (!nodes.length) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion || !("IntersectionObserver" in window)) {
    nodes.forEach((node) => node.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -7%" });

  nodes.forEach((node) => observer.observe(node));
}

function initTiltMotion() {
  const target = document.querySelector("[data-tilt] .visual-shell");
  const container = document.querySelector("[data-tilt]");
  if (!target || !container) return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  container.addEventListener("pointermove", (event) => {
    const rect = container.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    target.style.setProperty("--tilt-x", `${(-y * 3.2).toFixed(2)}deg`);
    target.style.setProperty("--tilt-y", `${(x * 4).toFixed(2)}deg`);
  });

  container.addEventListener("pointerleave", () => {
    target.style.setProperty("--tilt-x", "0deg");
    target.style.setProperty("--tilt-y", "0deg");
  });
}

function animateWidth(element, width) {
  if (!element) return;
  element.style.width = "0";
  requestAnimationFrame(() => requestAnimationFrame(() => {
    element.style.width = width;
  }));
}

async function initLanding() {
  const totalElement = byId("landing-total");
  if (!totalElement) return;

  const [datasetResult, modelResult] = await Promise.allSettled([
    fetchJSON("/api/dataset-stats"),
    fetchJSON("/api/model-stats"),
  ]);

  if (datasetResult.status === "fulfilled") {
    totalElement.textContent = formatNumber(datasetResult.value.total);
  }

  if (modelResult.status === "fulfilled") {
    const data = modelResult.value;
    const selected = (data.models || []).find((model) => model.model === data.best_model);
    if (selected) {
      const accuracy = byId("landing-accuracy");
      const auc = byId("landing-auc");
      if (accuracy) accuracy.textContent = `${(Number(selected.accuracy) * 100).toFixed(1)}%`;
      if (auc) auc.textContent = Number(selected.roc_auc).toFixed(3);
    }
  }
}

function renderBiochemicalProfile(features) {
  const grid = byId("bio-profile-grid");
  if (!grid || !features) return;
  grid.replaceChildren();

  const cards = [
    {
      label: "GRAVY Hydropathy",
      value: formatNumber(features.gravy, 3),
      pill: features.gravy < 0 ? "Hydrophilic ✅" : "Hydrophobic ⚠️",
      pillClass: features.gravy < 0 ? "good" : "bad",
      hint: features.gravy < 0 ? "Negative = resists aggregation" : "Positive = aggregation risk",
    },
    {
      label: "Isoelectric Point (pI)",
      value: formatNumber(features.isoelectric_point, 2),
      pill: (features.isoelectric_point < 6.2 || features.isoelectric_point > 8.0) ? "Charged at pH 7.2 ✅" : "Near Neutral ⚠️",
      pillClass: (features.isoelectric_point < 6.2 || features.isoelectric_point > 8.0) ? "good" : "warn",
      hint: "Cytoplasm pH ~ 7.2",
    },
    {
      label: "Instability Index",
      value: formatNumber(features.instability_index, 1),
      pill: features.instability_index < 40 ? "Stable (< 40) ✅" : "Unstable (> 40) ⚠️",
      pillClass: features.instability_index < 40 ? "good" : "bad",
      hint: "In vitro thermal stability",
    },
    {
      label: "Molecular Weight",
      value: `${(features.molecular_weight / 1000).toFixed(1)} kDa`,
      pill: features.molecular_weight < 45000 ? "Compact (< 45 kDa) ✅" : "High Mass (> 45 kDa)",
      pillClass: features.molecular_weight < 45000 ? "good" : "warn",
      hint: `${formatNumber(features.sequence_length)} residues`,
    },
    {
      label: "Fraction Charged",
      value: `${(features.fraction_charged * 100).toFixed(1)}%`,
      pill: features.fraction_charged > 0.22 ? "High Surface Charge ✅" : "Moderate Charge",
      pillClass: features.fraction_charged > 0.22 ? "good" : "warn",
      hint: `Net charge @ pH 7: ${features.net_charge_at_ph7 > 0 ? "+" : ""}${features.net_charge_at_ph7}`,
    },
    {
      label: "Secondary Structure",
      value: `${(features.helix_fraction * 100).toFixed(0)}% α · ${(features.sheet_fraction * 100).toFixed(0)}% β`,
      pill: "Globular Fold ✅",
      pillClass: "good",
      hint: `Turn fraction: ${(features.turn_fraction * 100).toFixed(0)}%`,
    },
  ];

  cards.forEach((c) => {
    const card = makeElement("div", "bio-card");
    const label = makeElement("div", "bio-label", c.label);
    const val = makeElement("div", "bio-value", c.value);
    const pill = makeElement("span", `bio-pill ${c.pillClass}`, c.pill);
    const hint = makeElement("div", "shap-bar-desc", c.hint);
    hint.style.marginTop = "4px";
    card.append(label, val, pill, hint);
    grid.appendChild(card);
  });
}

function renderDriverBars(drivers) {
  const container = byId("driver-bars");
  if (!container) return;
  container.replaceChildren();

  const safeDrivers = Array.isArray(drivers) ? drivers : [];
  const maxAbsolute = Math.max(...safeDrivers.map((driver) => Math.abs(Number(driver.shap) || 0)), 0.001);

  safeDrivers.forEach((driver) => {
    const shapValue = Number(driver.shap) || 0;
    const isPos = shapValue >= 0;
    const featKey = driver.feature || "";
    const featNiceName = FEATURE_LABELS[featKey] || String(featKey).replaceAll("_", " ");
    const explanation = FEATURE_EXPLANATIONS[featKey] || "";

    const card = makeElement("div", "curated-driver-card");

    const topRow = makeElement("div", "driver-card-top");
    const nameSpan = makeElement("span", "driver-feat-name", `${featNiceName} = ${driver.value}`);
    const badge = makeElement(
      "span",
      `driver-impact-tag ${isPos ? "pos" : "neg"}`,
      `${isPos ? "▲ +" : "▼ "}${shapValue.toFixed(3)} (${isPos ? "toward Soluble" : "toward Insoluble"})`
    );
    topRow.append(nameSpan, badge);

    const track = makeElement("div", "driver-track");
    const midpoint = makeElement("div", "driver-mid-line");
    const fill = makeElement("div", `driver-fill ${isPos ? "pos" : "neg"}`);
    const width = `${Math.min(50, (Math.abs(shapValue) / maxAbsolute) * 50).toFixed(1)}%`;
    track.append(midpoint, fill);

    card.append(topRow, track);
    if (explanation) {
      const desc = makeElement("div", "driver-desc", `Physical role: ${explanation}`);
      card.appendChild(desc);
    }
    container.appendChild(card);
    animateWidth(fill, width);
  });
}

function renderPrediction(result) {
  byId("result-empty")?.classList.add("hidden");
  byId("result-body")?.classList.remove("hidden");

  const solubleProbability = Math.max(0, Math.min(1, Number(result.proba_soluble) || 0));
  const soluble = result.label === "Soluble";
  const verdict = byId("verdict-box");
  if (verdict) verdict.className = `verdict ${soluble ? "soluble" : "insoluble"}`;

  const verdictLabel = byId("verdict-label");
  const probabilityPercent = byId("prob-percent");
  const probabilityFill = byId("prob-fill");
  if (verdictLabel) {
    verdictLabel.textContent = soluble ? "✅ SOLUBLE EXPRESSION" : "⚠️ INSOLUBLE (INCLUSION BODIES)";
  }
  if (probabilityPercent) probabilityPercent.textContent = `${(solubleProbability * 100).toFixed(1)}% soluble probability`;
  if (probabilityFill) {
    probabilityFill.setAttribute("aria-label", `${(solubleProbability * 100).toFixed(1)} percent soluble probability`);
    animateWidth(probabilityFill, `${(solubleProbability * 100).toFixed(1)}%`);
  }

  if (result.features) {
    renderBiochemicalProfile(result.features);
  }

  renderDriverBars(result.top_drivers);

  const tagCard = byId("tag-card");
  if (result.tag_recommendation && tagCard) {
    tagCard.classList.remove("hidden");
    byId("tag-name").textContent = result.tag_recommendation.tag || "—";
    byId("tag-driver").textContent = `Primary trigger · ${result.tag_recommendation.dominant_driver || "unknown"} = ${result.tag_recommendation.driver_value ?? "—"}`;
    byId("tag-reason").textContent = result.tag_recommendation.reason || "";
  } else if (tagCard) {
    tagCard.classList.add("hidden");
  }
}

function initPredictor() {
  const sequenceInput = byId("sequence-input");
  const predictButton = byId("predict-btn");
  if (!sequenceInput || !predictButton) return;

  const exampleSelect = byId("example-select");
  const residueCount = byId("residue-count");
  const sequenceStatus = byId("sequence-status");
  const errorElement = byId("predict-error");
  const mutationResidue = byId("mut-residue");
  const mutationPosition = byId("mut-position");
  const mutationCurrent = byId("mut-current");
  const mutationButton = byId("mutate-btn");
  const mutationResult = byId("mutation-result");
  let lastSequence = "";
  let lastProbability = null;

  if (mutationResidue) {
    mutationResidue.replaceChildren();
    AMINO_ACIDS.forEach((residue) => {
      const option = makeElement("option", "", residue);
      option.value = residue;
      mutationResidue.appendChild(option);
    });
  }

  const updateSequenceMeta = () => {
    const stats = getSequenceStats(sequenceInput.value);
    if (residueCount) residueCount.innerHTML = `<strong>${formatNumber(stats.valid)}</strong> residues`;
    if (sequenceStatus) {
      sequenceStatus.className = "";
      if (stats.valid === 0) {
        sequenceStatus.textContent = "Waiting for input";
      } else if (stats.invalid > 0) {
        sequenceStatus.textContent = `${stats.invalid} unsupported characters ignored`;
        sequenceStatus.className = "invalid-status";
      } else if (stats.valid < 10) {
        sequenceStatus.textContent = `${10 - stats.valid} more amino acids required (min 10)`;
        sequenceStatus.className = "invalid-status";
      } else {
        sequenceStatus.textContent = "✓ Sequence valid and ready";
        sequenceStatus.className = "valid-status";
      }
    }
  };

  sequenceInput.addEventListener("input", updateSequenceMeta);

  document.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-preset");
      if (!EXAMPLES[key]) return;
      sequenceInput.value = EXAMPLES[key];
      updateSequenceMeta();
      predictButton.click();
    });
  });

  byId("clear-seq-btn")?.addEventListener("click", () => {
    sequenceInput.value = "";
    updateSequenceMeta();
    byId("result-body")?.classList.add("hidden");
    byId("result-empty")?.classList.remove("hidden");
    showMessage(errorElement, "");
    sequenceInput.focus();
  });

  byId("copy-seq-btn")?.addEventListener("click", async () => {
    if (!sequenceInput.value) return;
    try {
      await navigator.clipboard.writeText(sequenceInput.value);
      const copyBtn = byId("copy-seq-btn");
      const oldHTML = copyBtn.innerHTML;
      copyBtn.innerHTML = "✓ Copied!";
      setTimeout(() => { copyBtn.innerHTML = oldHTML; }, 1800);
    } catch (_e) {}
  });

  exampleSelect?.addEventListener("change", () => {
    if (!EXAMPLES[exampleSelect.value]) return;
    sequenceInput.value = EXAMPLES[exampleSelect.value];
    updateSequenceMeta();
    sequenceInput.focus();
  });

  predictButton.addEventListener("click", async () => {
    const sequence = normalizeSequence(sequenceInput.value);
    showMessage(errorElement, "");
    if (sequence.length < 10) {
      showMessage(errorElement, "Add at least 10 valid amino-acid residues before running the model.");
      sequenceInput.focus();
      return;
    }

    setButtonBusy(predictButton, true, "Analyzing sequence");
    try {
      const result = await fetchJSON("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sequence }),
      });
      lastSequence = sequence;
      lastProbability = Number(result.proba_soluble);
      renderPrediction(result);
      if (mutationPosition) {
        mutationPosition.max = String(lastSequence.length);
        mutationPosition.value = "1";
      }
      if (mutationCurrent) mutationCurrent.value = lastSequence[0] || "";
      mutationResult?.replaceChildren();
      showMessage(errorElement, `Analysis complete · ${formatNumber(lastSequence.length)} residues processed.`, true);
    } catch (error) {
      showMessage(errorElement, error.message || "Prediction failed. Please try again.");
    } finally {
      setButtonBusy(predictButton, false, "Analyzing sequence");
    }
  });

  mutationPosition?.addEventListener("input", () => {
    const position = Number.parseInt(mutationPosition.value, 10);
    if (mutationCurrent) mutationCurrent.value = position >= 1 && position <= lastSequence.length ? lastSequence[position - 1] : "";
  });

  mutationButton?.addEventListener("click", async () => {
    if (!lastSequence || lastProbability === null) {
      if (mutationResult) mutationResult.textContent = "Run a primary prediction before simulating a mutation.";
      return;
    }

    const position = Number.parseInt(mutationPosition?.value || "", 10);
    const residue = mutationResidue?.value || "A";
    if (!Number.isInteger(position) || position < 1 || position > lastSequence.length) {
      if (mutationResult) mutationResult.textContent = `Choose a position between 1 and ${lastSequence.length}.`;
      return;
    }

    setButtonBusy(mutationButton, true, "Simulating");
    try {
      const result = await fetchJSON("/api/mutate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sequence: lastSequence, position, residue }),
      });
      const after = Number(result.proba_soluble);
      const delta = after - lastProbability;
      const deltaNode = makeElement("span", delta >= 0 ? "delta-up" : "delta-down", ` (${delta >= 0 ? "+" : ""}${delta.toFixed(3)})`);
      if (mutationResult) {
        mutationResult.replaceChildren(
          document.createTextNode(`${result.original_residue}${position}${residue} · P(soluble) ${lastProbability.toFixed(3)} → ${after.toFixed(3)}`),
          deltaNode,
        );
      }
    } catch (error) {
      if (mutationResult) mutationResult.textContent = error.message || "Mutation simulation failed.";
    } finally {
      setButtonBusy(mutationButton, false, "Simulating");
    }
  });

  updateSequenceMeta();
}

function renderGeneResults(genes, container, selectGene) {
  container.replaceChildren();
  genes.forEach((gene) => {
    const button = makeElement("button", "gene-row");
    button.type = "button";
    button.setAttribute("aria-label", `Open ${gene.gene_name}, ${gene.b_number}, ${gene.solubility_pct} percent soluble`);

    const main = makeElement("span", "gene-main");
    main.append(
      makeElement("strong", "", gene.gene_name || "Unnamed gene"),
      makeElement("span", "gene-tag", gene.b_number || "—"),
    );
    button.append(main, makeElement("span", "gene-score", `${formatNumber(gene.solubility_pct, 1)}% soluble`));
    button.addEventListener("click", () => selectGene(gene.b_number));
    container.appendChild(button);
  });
}

function initGeneLookup() {
  const input = byId("gene-search");
  const results = byId("gene-results");
  const status = byId("gene-status");
  if (!input || !results) return;

  const emptyDetail = byId("gene-empty-detail");
  const detailCard = byId("gene-detail-card");
  let debounceTimer = null;
  let searchController = null;
  let detailController = null;

  const loadGeneDetail = async (bNumber) => {
    detailController?.abort();
    detailController = new AbortController();
    if (status) status.textContent = `Loading ${bNumber}…`;

    try {
      const data = await fetchJSON(`/api/gene/${encodeURIComponent(bNumber)}`, { signal: detailController.signal });
      emptyDetail?.classList.add("hidden");
      detailCard?.classList.remove("hidden");
      byId("gene-detail-title").textContent = `${data.gene_name} · ${data.b_number}`;
      byId("gene-actual-label").textContent = data.actual_label;
      byId("gene-actual-pct").textContent = `${formatNumber(data.actual_solubility_pct, 1)}% measured solubility`;
      byId("gene-pred-label").textContent = data.prediction?.label || "Unknown";
      byId("gene-pred-pct").textContent = `P(soluble) · ${(Number(data.prediction?.proba_soluble) || 0).toFixed(3)}`;

      const banner = byId("gene-match-banner");
      const match = data.actual_label === data.prediction?.label;
      if (banner) {
        banner.className = `match-banner ${match ? "match" : "mismatch"}`;
        banner.textContent = match
          ? "Concordant result · the model matches the measured lab class."
          : "Discordant result · the model and measured lab class disagree.";
      }
      if (status) status.textContent = `Showing ${data.gene_name} · ${data.b_number}`;
      detailCard?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
    } catch (error) {
      if (error.name === "AbortError") return;
      if (status) status.textContent = error.message || "Could not load this protein.";
    }
  };

  input.addEventListener("input", () => {
    window.clearTimeout(debounceTimer);
    searchController?.abort();
    const query = input.value.trim();

    if (!query) {
      results.replaceChildren();
      if (status) status.textContent = "Enter at least one character to search.";
      return;
    }

    if (status) status.textContent = "Searching the measured proteome…";
    debounceTimer = window.setTimeout(async () => {
      searchController = new AbortController();
      try {
        const data = await fetchJSON(`/api/genes?q=${encodeURIComponent(query)}`, { signal: searchController.signal });
        const genes = Array.isArray(data.results) ? data.results : [];
        renderGeneResults(genes, results, loadGeneDetail);
        if (status) status.textContent = genes.length
          ? `${genes.length} result${genes.length === 1 ? "" : "s"} · select one to compare.`
          : "No matching eSOL protein found.";
      } catch (error) {
        if (error.name === "AbortError") return;
        results.replaceChildren();
        if (status) status.textContent = error.message || "Search is temporarily unavailable.";
      }
    }, 240);
  });

  document.querySelectorAll("[data-gene]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const geneName = btn.getAttribute("data-gene");
      if (!geneName) return;
      input.value = geneName;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    });
  });
}

function parseFasta(rawInput) {
  const raw = String(rawInput || "").trim();
  if (!raw) return [];

  const lines = raw.split(/\r?\n/);
  const hasHeaders = lines.some((line) => line.trim().startsWith(">"));
  if (!hasHeaders) {
    return [{ label: "sequence_1", sequence: normalizeSequence(raw) }];
  }

  const entries = [];
  let current = null;
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith(">")) {
      if (current) entries.push({ label: current.label, sequence: normalizeSequence(current.sequence.join("")) });
      current = { label: trimmed.slice(1).trim() || `sequence_${entries.length + 1}`, sequence: [] };
    } else if (current && trimmed) {
      current.sequence.push(trimmed);
    }
  });
  if (current) entries.push({ label: current.label, sequence: normalizeSequence(current.sequence.join("")) });
  return entries;
}

function appendTableCell(row, text, className = "", tag = "td") {
  const cell = makeElement(tag, className, text);
  row.appendChild(cell);
  return cell;
}

function renderBatchResults(batchResults, container) {
  container.replaceChildren();
  const validCount = batchResults.filter((result) => !result.error).length;
  const solubleCount = batchResults.filter((r) => r.predicted_label === "Soluble").length;
  const insolubleCount = validCount - solubleCount;

  const summary = makeElement("div", "result-summary");
  summary.innerHTML = `<strong>${validCount}/${batchResults.length}</strong> sequences analyzed &nbsp;·&nbsp; <span style="color: var(--good); font-weight: 800;">${solubleCount} Soluble</span> &nbsp;·&nbsp; <span style="color: var(--bad); font-weight: 800;">${insolubleCount} Insoluble</span>`;

  const table = makeElement("table", "data-table");
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["Sequence Identifier", "Predicted Verdict", "P(soluble)", "Recommended Rescue Tag"].forEach((label) => appendTableCell(headRow, label, "", "th"));
  head.appendChild(headRow);

  const body = document.createElement("tbody");
  batchResults.forEach((result) => {
    const row = document.createElement("tr");
    appendTableCell(row, result.label || "unnamed");
    if (result.error) {
      appendTableCell(row, result.error, "table-error").colSpan = 3;
    } else {
      const predictionCell = document.createElement("td");
      const isSoluble = result.predicted_label === "Soluble";
      predictionCell.appendChild(makeElement("span", `pill ${isSoluble ? "soluble" : "insoluble"}`, `${isSoluble ? "✅" : "⚠️"} ${result.predicted_label}`));
      row.appendChild(predictionCell);
      appendTableCell(row, `${(Number(result.proba_soluble) * 100).toFixed(1)}%`);
      appendTableCell(row, result.tag || "—");
    }
    body.appendChild(row);
  });

  table.append(head, body);
  container.append(summary, table);

  const exportBtn = byId("export-batch-csv");
  if (exportBtn) {
    exportBtn.classList.remove("hidden");
    exportBtn.onclick = () => {
      const rows = [["Sequence_Label", "Predicted_Label", "Probability_Soluble", "Suggested_Tag"]];
      batchResults.forEach((r) => {
        rows.push([`"${r.label || ""}"`, `"${r.predicted_label || r.error || ""}"`, r.proba_soluble ?? "", `"${r.tag || ""}"`]);
      });
      const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "protein_solubility_predictions.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
    };
  }
}

function initBatch() {
  const input = byId("batch-input");
  const button = byId("batch-btn");
  const results = byId("batch-results");
  if (!input || !button || !results) return;

  const count = byId("batch-entry-count");
  const message = byId("batch-message");
  const exampleButton = byId("load-batch-example");
  const demoButton = byId("load-batch-demo");
  const clearButton = byId("clear-batch-btn");

  const updateCount = () => {
    const entries = parseFasta(input.value);
    if (count) count.innerHTML = `<strong>${entries.length}</strong> entr${entries.length === 1 ? "y" : "ies"} detected`;
  };

  input.addEventListener("input", updateCount);

  demoButton?.addEventListener("click", () => {
    input.value = `>yaaX_b0005 [Soluble · eSOL 78%]\n${EXAMPLES.yaax}\n\n>GFP_GreenFluorescent [Soluble]\n${EXAMPLES.gfp}\n\n>thrB_b0003 [Insoluble · eSOL 32%]\n${EXAMPLES.thrb}\n\n>Human_Insulin [Insoluble cytoplasm]\n${EXAMPLES.insulin}`;
    updateCount();
    input.focus();
    button.click();
  });

  exampleButton?.addEventListener("click", () => {
    input.value = `>thrB_b0003\n${EXAMPLES.thrb}\n\n>yaaX_b0005\n${EXAMPLES.yaax}`;
    updateCount();
    input.focus();
  });

  clearButton?.addEventListener("click", () => {
    input.value = "";
    updateCount();
    results.replaceChildren();
    byId("export-batch-csv")?.classList.add("hidden");
    showMessage(message, "");
    input.focus();
  });

  button.addEventListener("click", async () => {
    const entries = parseFasta(input.value);
    showMessage(message, "");
    results.replaceChildren();
    if (!entries.length) {
      showMessage(message, "Paste at least one amino-acid sequence to create a batch.");
      input.focus();
      return;
    }

    setButtonBusy(button, true, `Analyzing ${entries.length} sequence${entries.length === 1 ? "" : "s"}`);
    try {
      const data = await fetchJSON("/api/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sequences: entries }),
      });
      const batchResults = Array.isArray(data.results) ? data.results : [];
      renderBatchResults(batchResults, results);
      showMessage(message, `Batch analysis complete · ${batchResults.length} proteins evaluated.`, true);
    } catch (error) {
      showMessage(message, error.message || "Batch prediction failed. Please try again.");
    } finally {
      setButtonBusy(button, false, "Run batch analysis");
    }
  });

  updateCount();
}

function renderDatasetStats(data) {
  const summary = byId("dataset-summary");
  const balance = byId("class-balance-bar");
  const featureCompare = byId("feature-compare");
  if (!summary || !balance || !featureCompare) return;

  summary.replaceChildren();
  [
    { value: data.total, label: "TOTAL MEASURED PROTEINS", className: "" },
    { value: data.soluble_count, label: "SOLUBLE (≥ 50%)", className: "soluble" },
    { value: data.insoluble_count, label: "INSOLUBLE (< 50%)", className: "insoluble" },
  ].forEach((stat) => {
    const card = makeElement("div", "dataset-stat");
    card.append(makeElement("div", `num ${stat.className}`.trim(), formatNumber(stat.value)), makeElement("div", "lbl", stat.label));
    summary.appendChild(card);
  });

  const total = Math.max(Number(data.total) || 0, 1);
  const solublePercent = Math.max(0, Math.min(100, ((Number(data.soluble_count) || 0) / total) * 100));
  const solubleSegment = makeElement("div", "seg-soluble");
  const insolubleSegment = makeElement("div", "seg-insoluble");
  balance.replaceChildren(solubleSegment, insolubleSegment);
  balance.setAttribute("aria-label", `${solublePercent.toFixed(1)} percent soluble and ${(100 - solublePercent).toFixed(1)} percent insoluble`);
  animateWidth(solubleSegment, `${solublePercent}%`);
  animateWidth(insolubleSegment, `${100 - solublePercent}%`);

  featureCompare.replaceChildren();
  Object.entries(data.feature_means || {}).forEach(([feature, values]) => {
    const soluble = Number(values.soluble) || 0;
    const insoluble = Number(values.insoluble) || 0;
    const maxAbsolute = Math.max(Math.abs(soluble), Math.abs(insoluble), 0.001);
    const row = makeElement("div", "fc-row");
    row.appendChild(makeElement("div", "fc-label", FEATURE_LABELS[feature] || feature.replaceAll("_", " ")));

    const addBar = (value, className) => {
      const barRow = makeElement("div", "fc-bars");
      const displayDigits = Math.abs(value) >= 100 ? 0 : 3;
      const valueNode = makeElement("span", "fc-val", formatNumber(value, displayDigits));
      const track = makeElement("div", "fc-bar-track");
      const fill = makeElement("div", `fc-bar-fill ${className}`);
      track.appendChild(fill);
      barRow.append(valueNode, track);
      row.appendChild(barRow);
      animateWidth(fill, `${(Math.abs(value) / maxAbsolute * 100).toFixed(1)}%`);
    };

    addBar(soluble, "soluble");
    addBar(insoluble, "insoluble");
    featureCompare.appendChild(row);
  });
}

function renderModelStats(data) {
  const body = document.querySelector("#model-table tbody");
  if (!body) return;
  body.replaceChildren();

  (data.models || []).forEach((model) => {
    const row = document.createElement("tr");
    const selected = model.model === data.best_model;
    if (selected) row.classList.add("best");

    const nameCell = document.createElement("td");
    nameCell.appendChild(document.createTextNode(model.model || "Unnamed model"));
    if (selected) nameCell.appendChild(makeElement("span", "selected-tag", "Selected Best"));
    row.appendChild(nameCell);
    appendTableCell(row, `${(Number(model.accuracy) * 100).toFixed(1)}%`);
    appendTableCell(row, Number(model.f1).toFixed(3));
    appendTableCell(row, Number(model.roc_auc).toFixed(3));
    body.appendChild(row);
  });
}

async function initDataset() {
  if (!byId("dataset-summary")) return;

  const btnCurated = byId("btn-show-curated");
  const btnResearch = byId("btn-show-research");
  const curatedSuite = byId("curated-graphs-suite");
  const researchSuite = byId("research-graphs-suite");

  btnCurated?.addEventListener("click", () => {
    btnCurated.classList.add("active");
    btnCurated.setAttribute("aria-selected", "true");
    btnResearch?.classList.remove("active");
    btnResearch?.setAttribute("aria-selected", "false");
    curatedSuite?.classList.remove("hidden");
    researchSuite?.classList.add("hidden");
  });

  btnResearch?.addEventListener("click", () => {
    btnResearch.classList.add("active");
    btnResearch.setAttribute("aria-selected", "true");
    btnCurated?.classList.remove("active");
    btnCurated?.setAttribute("aria-selected", "false");
    researchSuite?.classList.remove("hidden");
    curatedSuite?.classList.add("hidden");
  });

  const datasetTask = fetchJSON("/api/dataset-stats")
    .then(renderDatasetStats)
    .catch((error) => {
      const target = byId("feature-compare");
      if (target) target.textContent = error.message || "Dataset statistics are unavailable.";
    });

  const modelTask = fetchJSON("/api/model-stats")
    .then(renderModelStats)
    .catch((error) => {
      const body = document.querySelector("#model-table tbody");
      if (!body) return;
      body.replaceChildren();
      const row = document.createElement("tr");
      const cell = appendTableCell(row, error.message || "Model metrics are unavailable.", "table-error");
      cell.colSpan = 4;
      body.appendChild(row);
    });

  await Promise.allSettled([datasetTask, modelTask]);
}

initRevealMotion();
initTiltMotion();
initLanding();
initPredictor();
initGeneLookup();
initBatch();
initDataset();
