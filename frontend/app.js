"use strict";

const $ = (id) => document.getElementById(id);
const MAX_SIDE = 800;

let selectedBlob = null;
let lastResult = null;

const DEMO_CASES = {
  tinea: {
    disease: "Tinea / Ringworm (Fungal)",
    disease_bn: "দাদ / ছত্রাক সংক্রমণ",
    confidence: 0.88,
    tier: 2,
    urgency_label: "Routine — within 48 hours",
    action_bn: "পরিষ্কার ও শুষ্ক রাখুন এবং ৪৮ ঘণ্টার মধ্যে চিকিৎসকের পরামর্শ নিন।",
    action_en: "Keep the area clean and dry; see a clinician within 48 hours for antifungal evaluation.",
    facility: "Upazila Health Complex / Community Clinic",
    reasons: ["Circular scaly border pattern", "Demo Quick Start scenario"],
    top2: [{ disease: "Tinea / Ringworm", confidence: 0.88 }, { disease: "Eczema", confidence: 0.08 }],
  },
  cellulitis: {
    disease: "Bacterial Skin Infection",
    disease_bn: "ব্যাকটেরিয়াজনিত ত্বকের সংক্রমণ",
    confidence: 0.84,
    tier: 3,
    urgency_label: "Urgent — Today",
    action_bn: "সতর্ক লক্ষণ (জ্বর/দ্রুত ছড়ানো) থাকায় আজই নিকটস্থ স্বাস্থ্যকেন্দ্রে যান।",
    action_en: "Warning signs present — visit the nearest health facility today for urgent evaluation.",
    facility: "District Hospital Emergency / Upazila Health Complex",
    reasons: ["Red-flag safety floor triggered (fever / spreading)", "Demo Quick Start scenario"],
    top2: [{ disease: "Bacterial Infection", confidence: 0.84 }, { disease: "Eczema", confidence: 0.11 }],
  },
  eczema: {
    disease: "Eczema (Dermatitis)",
    disease_bn: "একজিমা",
    confidence: 0.82,
    tier: 1,
    urgency_label: "Non-urgent",
    action_bn: "ত্বক আর্দ্র রাখুন এবং সুযোগমতো চিকিৎসকের পরামর্শ নিন।",
    action_en: "Keep skin moisturized and consult a doctor at your convenience.",
    facility: "Community Clinic / Telemedicine",
    reasons: ["Dry erythematous patch", "Demo Quick Start scenario"],
    top2: [{ disease: "Eczema", confidence: 0.82 }, { disease: "Psoriasis", confidence: 0.12 }],
  },
};

/* ---------- Tabs ---------- */
function switchTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tabId));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === "tab-" + tabId));
}
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

/* ---------- Backend health check ---------- */
async function checkBackend() {
  const pill = $("apiStatus");
  try {
    const res = await fetch("/health");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    pill.textContent = data.model_loaded ? "Backend Ready (HF)" : "Backend Online (Warming)";
    pill.className = "status-pill ok";
  } catch {
    pill.textContent = "Backend Unreachable";
    pill.className = "status-pill err";
  }
}

/* ---------- Quick Start Demos ---------- */
document.querySelectorAll("[data-demo]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const demo = DEMO_CASES[btn.dataset.demo];
    if (!demo) return;
    lastResult = demo;
    $("resultWrap").classList.remove("hidden");
    $("resultError").classList.add("hidden");
    $("resultLoading").classList.add("hidden");
    renderResult(demo);
  });
});

/* ---------- Image resize & preview ---------- */
function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Image encode failed"))), "image/jpeg", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Invalid image")); };
    img.src = url;
  });
}

$("photoInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    selectedBlob = await shrinkImage(file);
    $("photoPreview").src = URL.createObjectURL(selectedBlob);
    $("photoPreview").classList.remove("hidden");
    $("photoMeta").textContent = `Prepared: ${(selectedBlob.size / 1024).toFixed(0)} KB JPEG`;
    $("analyzeBtn").disabled = false;
  } catch (err) {
    $("photoMeta").textContent = err.message;
  }
});

/* ---------- Analyze Skin ---------- */
$("analyzeBtn").addEventListener("click", async () => {
  if (!selectedBlob) return;
  $("resultWrap").classList.remove("hidden");
  $("resultBody").classList.add("hidden");
  $("resultError").classList.add("hidden");
  $("resultLoading").classList.remove("hidden");
  $("analyzeBtn").disabled = true;

  const flags = Array.from(document.querySelectorAll('input[name="flag"]:checked')).map((el) => el.value);
  const form = new FormData();
  form.append("image", selectedBlob, "skin.jpg");
  flags.forEach((f) => form.append("red_flags", f));
  form.append("symptoms_text", $("symptomsText").value || "");
  form.append("district", $("districtSelect").value);
  form.append("consent", $("consentCheck").checked ? "true" : "false");

  try {
    let res = await fetch("/api/analyze", { method: "POST", body: form });
    if (res.status === 404) {
      const fallbackForm = new FormData();
      fallbackForm.append("image", selectedBlob, "skin.jpg");
      flags.forEach((f) => fallbackForm.append("red_flags", f));
      fallbackForm.append("district", $("districtSelect").value);
      fallbackForm.append("consent", $("consentCheck").checked ? "true" : "false");
      res = await fetch("/api/cases", { method: "POST", body: fallbackForm });
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Analysis failed");
    lastResult = data;
    renderResult(data);
  } catch (err) {
    $("resultError").textContent = "ত্রুটি · Error: " + err.message;
    $("resultError").classList.remove("hidden");
  } finally {
    $("resultLoading").classList.add("hidden");
    $("analyzeBtn").disabled = false;
  }
});

function renderResult(r) {
  const tier = Number(r.tier ?? 1);
  const banner = $("tierBanner");
  banner.className = `tier-banner t${tier}`;
  banner.textContent = `Tier ${tier} — ${r.urgency_label || ""}`;

  $("diseaseName").textContent = r.disease || "Unknown";
  $("diseaseBn").textContent = r.disease_bn || "";
  $("confidenceVal").textContent = r.confidence != null ? `${Math.round(r.confidence * 100)}%` : "—";

  const top2Wrap = $("top2Wrap");
  top2Wrap.innerHTML = "";
  (r.top2 || []).forEach((item) => {
    const span = document.createElement("span");
    span.className = "top2-pill";
    span.textContent = `${item.disease} (${Math.round((item.confidence || 0) * 100)}%)`;
    top2Wrap.appendChild(span);
  });

  $("actionBn").textContent = r.action_bn || "";
  $("actionEn").textContent = r.action_en || "";
  $("facilityText").textContent = r.facility ? `Facility: ${r.facility}` : "";

  const reasons = $("reasonsList");
  reasons.innerHTML = "";
  (r.reasons || []).forEach((line) => {
    const li = document.createElement("li");
    li.textContent = line;
    reasons.appendChild(li);
  });

  $("caseIdNote").textContent = r.case_id ? `Case ID saved for doctor review: ${r.case_id}` : "";
  if (r.disease) {
    $("chatContextBadge").textContent = `Context: ${r.disease}`;
    $("chatContextBadge").classList.remove("hidden");
    $("referralSummary").innerHTML = `<strong>${r.disease}</strong> (${r.disease_bn || ""}) · Tier ${tier} — ${r.action_en || ""}`;
  }
  $("resultBody").classList.remove("hidden");
}

/* ---------- Referral PDF ---------- */
async function downloadReferralPdf() {
  if (!lastResult) return alert("Please run a screening or Quick Start demo first.");
  try {
    const res = await fetch("/api/referral-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        district: $("districtSelect").value,
        symptoms: Array.from(document.querySelectorAll('input[name="flag"]:checked')).map((el) => el.value),
        disease: lastResult.disease || "",
        confidence: lastResult.confidence || 0,
        tier: lastResult.tier ?? 1,
        action_en: lastResult.action_en || "",
        action_bn: lastResult.action_bn || "",
      }),
    });
    if (!res.ok) throw new Error("PDF endpoint unavailable (push webhook/api.py to HF Space)");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "skinai-referral.pdf";
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(err.message);
  }
}
$("downloadPdfBtn").addEventListener("click", downloadReferralPdf);
$("referralTabPdfBtn").addEventListener("click", downloadReferralPdf);

$("askAboutBtn").addEventListener("click", () => {
  switchTab("ask");
  if (lastResult && lastResult.disease) {
    $("chatInput").value = `${lastResult.disease} সম্পর্কে বিস্তারিত ও করণীয় কী?`;
  }
});

$("findHospitalQuickBtn").addEventListener("click", () => {
  switchTab("hospitals");
  loadHospitals({ district: $("districtSelect").value });
});

/* ---------- AI Assistant ---------- */
function appendMsg(role, text) {
  const div = document.createElement("div");
  div.className = "msg " + role;
  div.textContent = text;
  $("chatLog").appendChild(div);
  $("chatLog").scrollTop = $("chatLog").scrollHeight;
  return div;
}

async function sendChat(question) {
  appendMsg("user", question);
  const pending = appendMsg("bot", "চিন্তা করছি… · Thinking…");
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        disease_context: lastResult ? lastResult.disease : null,
      }),
    });
    if (res.status === 404) {
      pending.textContent = "Backend /api/chat not yet deployed on Hugging Face Space. Push webhook/api.py to HF Space to enable RAG chat.";
      return;
    }
    const data = await res.json();
    pending.textContent = data.answer || data.error || "No response";
  } catch (err) {
    pending.textContent = "Error: " + err.message;
  }
}

$("chatForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = $("chatInput").value.trim();
  if (!q) return;
  $("chatInput").value = "";
  sendChat(q);
});

document.querySelectorAll(".chat-chip").forEach((c) => {
  c.addEventListener("click", () => sendChat(c.dataset.q));
});

/* ---------- Hospitals ---------- */
async function loadHospitals(params) {
  $("hospitalsStatus").textContent = "হাসপাতাল খোঁজা হচ্ছে… · Searching nearby hospitals…";
  $("hospitalsGrid").innerHTML = "";
  try {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch("/api/hospitals?" + qs);
    if (res.status === 404) {
      $("hospitalsStatus").textContent = "Backend /api/hospitals not yet deployed on Hugging Face Space. Push webhook/api.py to HF Space to enable hospital lookup.";
      return;
    }
    const data = await res.json();
    const list = data.hospitals || [];
    $("hospitalsStatus").textContent = `${list.length}টি হাসপাতাল পাওয়া গেছে · Found ${list.length} facilities`;
    list.forEach((h) => {
      const card = document.createElement("div");
      card.className = "hospital-card";
      const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.lat + "," + h.lon)}`;
      card.innerHTML = `
        <h3>${h.name || "Hospital"}</h3>
        <div class="muted small">${h.address || ""}</div>
        <div class="small mt"><strong>${h.dist_km != null ? h.dist_km + " km" : ""}</strong> ${h.phone ? " · 📞 " + h.phone : ""}</div>
        <div class="mt"><a href="${mapUrl}" target="_blank" rel="noopener">Google Maps →</a></div>
      `;
      $("hospitalsGrid").appendChild(card);
    });
  } catch (err) {
    $("hospitalsStatus").textContent = "Error: " + err.message;
  }
}

$("findHospitalsBtn").addEventListener("click", () => loadHospitals({ district: $("hospitalDistrict").value }));
$("gpsBtn").addEventListener("click", () => {
  if (!navigator.geolocation) return alert("Geolocation not supported");
  navigator.geolocation.getCurrentPosition(
    (pos) => loadHospitals({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
    (err) => alert("Location denied: " + err.message),
  );
});

checkBackend();
