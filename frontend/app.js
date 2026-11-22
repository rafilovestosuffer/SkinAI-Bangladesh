"use strict";

const $ = (id) => document.getElementById(id);
const MAX_SIDE = 800;

let selectedBlob = null;
let lastResult = null;
let bdMap = null;
let mapLayer = null;

const DEMO_CASES = {
  tinea: {
    disease: "Tinea / Ringworm (Fungal)",
    disease_bn: "দাদ / ছত্রাক সংক্রমণ",
    confidence: 0.88,
    tier: 2,
    urgency_label: "Routine — within 48 hours",
    action_bn: "পরিষ্কার ও শুষ্ক রাখুন এবং ৪৮ ঘণ্টার মধ্যে চিকিৎসকের পরামর্শ নিন।",
    action_en: "Keep the area clean and dry; see a clinician within 48 hours.",
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
    action_en: "Warning signs present — visit the nearest health facility today.",
    facility: "District Hospital Emergency",
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

const PREVALENCE = {
  Tinea: {
    tips: "<strong>প্রতিরোধ টিপস:</strong> ত্বক পরিষ্কার ও শুষ্ক রাখুন, তোয়ালে ও কাপড় আলাদা রাখুন, ঢিলেঢালা সুতি কাপড় পরুন।<br><strong>Prevention:</strong> Keep skin dry, avoid sharing towels/clothing, wear breathable cotton.",
    points: [
      { name: "Chattogram", sev: "High" },
      { name: "Rajshahi", sev: "High" },
      { name: "Sylhet", sev: "High" },
      { name: "Dhaka", sev: "Medium" },
      { name: "Khulna", sev: "Medium" },
      { name: "Barishal", sev: "Medium" },
      { name: "Rangpur", sev: "Medium" },
      { name: "Mymensingh", sev: "Medium" },
    ],
  },
  Eczema: {
    tips: "<strong>প্রতিরোধ টিপস:</strong> সুগন্ধিহীন ময়েশ্চারাইজার ব্যবহার করুন, কড়া সাবান এড়িয়ে চলুন।<br><strong>Prevention:</strong> Moisturize daily and avoid harsh soaps or triggers.",
    points: [
      { name: "Dhaka", sev: "High" },
      { name: "Chattogram", sev: "High" },
      { name: "Sylhet", sev: "Medium" },
      { name: "Khulna", sev: "Medium" },
      { name: "Rajshahi", sev: "Medium" },
      { name: "Barishal", sev: "Low" },
      { name: "Rangpur", sev: "Low" },
      { name: "Mymensingh", sev: "Low" },
    ],
  },
  Scabies: {
    tips: "<strong>প্রতিরোধ টিপস:</strong> পরিবারের সবার একসাথে চিকিৎসা প্রয়োজন, বিছানার চাদর গরম পানিতে ধুয়ে রোদে শুকান।",
    points: [
      { name: "Chattogram", sev: "High" },
      { name: "Rangpur", sev: "High" },
      { name: "Sylhet", sev: "High" },
      { name: "Dhaka", sev: "Medium" },
      { name: "Khulna", sev: "Medium" },
      { name: "Barishal", sev: "Medium" },
      { name: "Rajshahi", sev: "Medium" },
      { name: "Mymensingh", sev: "Medium" },
    ],
  },
  Bacterial: {
    tips: "<strong>প্রতিরোধ টিপস:</strong> কাটা বা ক্ষত পরিষ্কার রাখুন; জ্বর বা লালচে ভাব দ্রুত ছড়ালে আজই ডাক্তার দেখান।",
    points: [
      { name: "Barishal", sev: "High" },
      { name: "Chattogram", sev: "High" },
      { name: "Khulna", sev: "Medium" },
      { name: "Dhaka", sev: "Medium" },
      { name: "Rajshahi", sev: "Medium" },
      { name: "Sylhet", sev: "Medium" },
      { name: "Rangpur", sev: "Low" },
      { name: "Mymensingh", sev: "Low" },
    ],
  },
  Psoriasis: {
    tips: "<strong>প্রতিরোধ টিপস:</strong> ত্বক আর্দ্র রাখুন, মানসিক চাপ কমান এবং চর্মরোগ বিশেষজ্ঞের পরামর্শ নিন।",
    points: [
      { name: "Dhaka", sev: "Medium" },
      { name: "Rajshahi", sev: "Medium" },
      { name: "Chattogram", sev: "Medium" },
      { name: "Sylhet", sev: "Low" },
      { name: "Khulna", sev: "Low" },
      { name: "Barishal", sev: "Low" },
      { name: "Rangpur", sev: "Low" },
      { name: "Mymensingh", sev: "Low" },
    ],
  },
};

const DOCTORS = [
  { name: "ডা. নুসরাত জাহান", en: "Dr. Nusrat Jahan", cred: "MBBS, DDV (Dermatology)", hosp: "Chattogram Medical College", fee: "৳500" },
  { name: "ডা. ফারহান আহমেদ", en: "Dr. Farhan Ahmed", cred: "MBBS, FCPS (Dermatology)", hosp: "Dhaka Medical College", fee: "৳700" },
  { name: "ডা. তাসনিম রহমান", en: "Dr. Tasnim Rahman", cred: "MBBS, MD (Skin & VD)", hosp: "Rajshahi Medical College", fee: "৳500" },
  { name: "ডা. কামাল হোসেন", en: "Dr. Kamal Hossain", cred: "MBBS, DDV", hosp: "Khulna Medical College", fee: "৳450" },
  { name: "ডা. সাদিয়া আফরিন", en: "Dr. Sadia Afrin", cred: "MBBS, FCPS", hosp: "Sylhet MAG Osmani MCH", fee: "৳550" },
  { name: "ডা. তানভীর চৌধুরী", en: "Dr. Tanvir Chowdhury", cred: "MBBS, MD", hosp: "Mymensingh Medical College", fee: "৳500" },
];

/* ---------- Tabs & Navigation ---------- */
function switchTab(tabId) {
  const isHome = tabId === "home";
  $("workspaceBar").classList.toggle("hidden", isHome);
  document.querySelectorAll(".tab-btn, .nav-link[data-tab]").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tabId);
  });
  document.querySelectorAll(".tab-panel").forEach((p) => {
    p.classList.toggle("active", p.id === "tab-" + tabId);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (tabId === "insights") setTimeout(renderInsights, 60);
}

document.querySelectorAll("[data-tab]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    switchTab(btn.dataset.tab);
  });
});

document.querySelectorAll("[data-scroll]").forEach((btn) => {
  btn.addEventListener("click", () => {
    switchTab("home");
    setTimeout(() => {
      const target = document.getElementById(btn.dataset.scroll);
      if (target) target.scrollIntoView({ behavior: "smooth" });
    }, 60);
  });
});

document.querySelectorAll("[data-insight]").forEach((btn) => {
  btn.addEventListener("click", () => {
    $("insightDisease").value = btn.dataset.insight;
    switchTab("insights");
  });
});

const I18N = {
  en: {
    nav_home: "Home",
    nav_dx: "Diagnosis",
    nav_ask: "Ask AI",
    nav_ref: "Referral",
    nav_ins: "Insights",
    nav_doc: "DocTime",
    nav_p2: "Phase 2",
    nav_imp: "Impact",
    cta_start: "Start Screening",
    hero_pill: "AI-Powered Skin Screening & Smart Triage",
    hero_h1: 'AI Skin Screening.<br />Find the <span class="teal-text">Right Care</span>',
    hero_lead: "AI-powered dermatological screening and smart triage for rural Bangladesh. Identify potential skin conditions early, get clinical guidance, and know when to see a doctor.",
    hero_cta1: "Start Skin Screening →",
    hero_cta2: "Explore Skin Guide",
  },
  bn: {
    nav_home: "হোম",
    nav_dx: "রোগ নির্ণয়",
    nav_ask: "প্রশ্ন করুন",
    nav_ref: "রেফারেল পত্র",
    nav_ins: "রোগ-পরিচিতি",
    nav_doc: "পরামর্শ",
    nav_p2: "নেটওয়ার্ক",
    nav_imp: "প্রভাব ও নীতি",
    cta_start: "স্ক্রিনিং শুরু করুন",
    hero_pill: "এআই-চালিত ত্বকের রোগ নির্ণয় ও স্মার্ট ট্রায়াজ",
    hero_h1: 'AI-তে ত্বক পরীক্ষা করুন,<br /><span class="teal-text">সঠিক চিকিৎসা</span> নিন।',
    hero_lead: "গ্রামীণ বাংলাদেশের জন্য এআই-চালিত চর্মরোগ স্ক্রিনিং ও স্মার্ট ট্রায়াজ। আপনার ত্বকের সমস্যা দ্রুত বুঝুন, পরামর্শ নিন এবং কখন ডাক্তার দেখাবেন তা জানুন।",
    hero_cta1: "স্ক্রিনিং শুরু করুন →",
    hero_cta2: "রোগ-পরিচিতি দেখুন",
  },
};
let currentLang = "en";

$("langToggle").addEventListener("click", () => {
  currentLang = currentLang === "en" ? "bn" : "en";
  const dict = I18N[currentLang];
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (dict[key]) el.innerHTML = dict[key];
  });
  $("langToggle").textContent = currentLang === "en" ? "BN / EN" : "EN / বাংলা";
});

/* ---------- Backend health ---------- */
async function checkBackend() {
  const dot = $("apiStatus");
  try {
    const res = await fetch("/health");
    if (!res.ok) throw new Error();
    const data = await res.json();
    dot.className = "status-dot ok";
    dot.title = data.model_loaded ? "Backend Ready (HF)" : "Backend Online";
  } catch {
    dot.className = "status-dot err";
    dot.title = "Backend Unreachable";
  }
}

/* ---------- 3-Step Screening Wizard ---------- */
function setWizardStep(step) {
  [1, 2, 3].forEach((n) => {
    const panel = $("wiz-step-" + n);
    if (panel) panel.classList.toggle("active", n === step);
    const pill = document.querySelector(`.w-step[data-wstep="${n}"]`);
    if (pill) {
      pill.classList.toggle("active", n === step);
      pill.classList.toggle("done", n < step);
    }
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("#areaChips .sel-chip, #symptomChips .sel-chip").forEach((chip) => {
  chip.addEventListener("click", () => chip.classList.toggle("active"));
});
document.querySelectorAll("#progChips .sel-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll("#progChips .sel-chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
  });
});

document.querySelectorAll(".pm-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".pm-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const isCam = tab.dataset.pm === "camera";
    if (isCam) $("photoInput").setAttribute("capture", "environment");
    else $("photoInput").removeAttribute("capture");
    $("camTitle").textContent = isCam ? "Camera is ready" : "Choose from gallery";
    $("camSub").textContent = isCam ? "Position the affected area in the frame" : "Select a clear skin photo from your device";
    $("camBtnLabel").innerHTML = isCam
      ? '<span class="material-symbols-outlined ic-btn">photo_camera</span> Capture Photo'
      : '<span class="material-symbols-outlined ic-btn">folder_open</span> Browse Files';
  });
});

$("toStep2Btn").addEventListener("click", () => setWizardStep(2));
$("backToStep1Btn").addEventListener("click", () => setWizardStep(1));
$("newScreeningBtn").addEventListener("click", () => setWizardStep(1));
$("retakeBtn").addEventListener("click", () => $("photoInput").click());

/* ---------- Voice / Mic ---------- */
$("micBtn").addEventListener("click", () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    $("micStatus").textContent = "Browser speech recognition not supported — type details above.";
    return;
  }
  const rec = new SR();
  rec.lang = "bn-BD";
  $("micStatus").textContent = "Listening… speak now";
  rec.onresult = (ev) => {
    const text = ev.results[0][0].transcript;
    $("symptomsText").value = ($("symptomsText").value ? $("symptomsText").value + ", " : "") + text;
    $("micStatus").textContent = "Captured: " + text;
  };
  rec.onerror = (ev) => { $("micStatus").textContent = "Mic error: " + ev.error; };
  rec.start();
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
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Encode failed"))), "image/jpeg", 0.85);
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
    $("previewPlaceholder").classList.add("hidden");
    $("retakeBtn").classList.remove("hidden");
    $("photoMeta").textContent = `Prepared: ${(selectedBlob.size / 1024).toFixed(0)} KB JPEG`;
    $("analyzeBtn").disabled = false;
  } catch (err) {
    $("photoMeta").textContent = err.message;
  }
});

/* ---------- Analyze Skin ---------- */
$("analyzeBtn").addEventListener("click", async () => {
  if (!selectedBlob) return;
  setWizardStep(3);
  $("resultBody").classList.add("hidden");
  $("resultError").classList.add("hidden");
  $("resultLoading").classList.remove("hidden");
  $("analyzeBtn").disabled = true;

  const flags = Array.from(document.querySelectorAll(".sel-chip.active[data-flag]")).map((el) => el.dataset.flag);
  const areas = Array.from(document.querySelectorAll("#areaChips .sel-chip.active")).map((el) => el.dataset.val);
  const syms = Array.from(document.querySelectorAll("#symptomChips .sel-chip.active")).map((el) => el.dataset.val);
  const prog = document.querySelector("#progChips .sel-chip.active")?.dataset.val || "";
  const extra = [
    $("pComplaint").value,
    $("pDur").value ? `duration: ${$("pDur").value}` : "",
    areas.length ? `areas: ${areas.join(", ")}` : "",
    syms.length ? `symptoms: ${syms.join(", ")}` : "",
    prog ? `progression: ${prog}` : "",
    $("pPrev").value ? `previous: ${$("pPrev").value}` : "",
    $("symptomsText").value,
  ].filter(Boolean).join("; ");

  const form = new FormData();
  form.append("image", selectedBlob, "skin.jpg");
  flags.forEach((f) => form.append("red_flags", f));
  form.append("symptoms_text", extra);
  form.append("district", $("districtSelect").value);
  form.append("consent", $("consentCheck").checked ? "true" : "false");

  try {
    let res = await fetch("/api/analyze", { method: "POST", body: form });
    if (res.status === 404) {
      const fb = new FormData();
      fb.append("image", selectedBlob, "skin.jpg");
      flags.forEach((f) => fb.append("red_flags", f));
      fb.append("district", $("districtSelect").value);
      fb.append("consent", $("consentCheck").checked ? "true" : "false");
      res = await fetch("/api/cases", { method: "POST", body: fb });
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
    $("referralEmptyBox").classList.add("hidden");
    $("referralReadyBox").classList.remove("hidden");
    $("referralSummary").innerHTML = `<strong>${r.disease}</strong> (${r.disease_bn || ""}) · Tier ${tier}<br><span class="muted small">${r.action_en || ""}</span>`;
    $("doctimeEmpty").classList.add("hidden");
    $("doctimeReady").classList.remove("hidden");
    $("doctimeSummary").innerHTML = `<strong>${r.disease}</strong> · Tier ${tier} — Ready to attach referral PDF for DocTime dermatologist.`;
  }
  $("resultBody").classList.remove("hidden");
}

/* ---------- Referral PDF ---------- */
async function downloadReferralPdf(useSample = false) {
  const data = useSample ? DEMO_CASES.tinea : lastResult;
  if (!data) return alert("Complete a diagnosis first.");
  try {
    const res = await fetch("/api/referral-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_name: ($("pName") && $("pName").value) || "Patient",
        age: ($("pAge") && $("pAge").value) || "30",
        district: $("districtSelect").value,
        symptoms: Array.from(document.querySelectorAll("#symptomChips .sel-chip.active")).map((el) => el.dataset.val),
        disease: data.disease || "",
        confidence: data.confidence || 0,
        tier: data.tier ?? 1,
        action_en: data.action_en || "",
        action_bn: data.action_bn || "",
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
$("downloadPdfBtn").addEventListener("click", () => downloadReferralPdf(false));
$("referralTabPdfBtn").addEventListener("click", () => downloadReferralPdf(false));
$("samplePdfBtn").addEventListener("click", () => downloadReferralPdf(true));

$("askAboutBtn").addEventListener("click", () => {
  switchTab("ask");
  if (lastResult && lastResult.disease) $("chatInput").value = `${lastResult.disease} সম্পর্কে বিস্তারিত ও করণীয় কী?`;
});
$("goDoctimeBtn").addEventListener("click", () => switchTab("doctime"));

/* ---------- Ask AI (ChatGPT-style Thread + Local Clinical Fallback) ---------- */
const LOCAL_QA = {
  "প্রতিরোধের উপায় কী?": "ত্বকের বিভিন্ন সমস্যা প্রতিরোধে কিছু সাধারণ নিয়ম মেনে চলা উচিত:\n1. নিয়মিত ত্বক পরিষ্কার ও আর্দ্র (moisturized) রাখুন।\n2. রোদে বের হওয়ার আগে সানস্ক্রিন বা ছাতা ব্যবহার করুন।\n3. তোয়ালে ও পোশাক আলাদা রাখুন এবং সুতি কাপড় পরুন।\n4. কোনো সংক্রমণ বা অস্বাভাবিক পরিবর্তন দেখলে দ্রুত চিকিৎসকের পরামর্শ নিন।",
  "কখন ডাক্তার দেখাবো?": "যদি আপনার ত্বকে নিচের লক্ষণগুলো দেখা যায়, তবে অবিলম্বে একজন চর্মরোগ বিশেষজ্ঞ বা ডাক্তারের পরামর্শ নেওয়া উচিত:\n• ত্বক হঠাৎ লাল হয়ে যাওয়া, ফুলে যাওয়া বা তীব্র চুলকানি হলে।\n• জ্বর বা পুঁজ বের হলে এবং দাগ দ্রুত ছড়িয়ে পড়লে।\n• কোনো ক্ষত বা ঘা স্বাভাবিক সময়ের মধ্যে না শুকালে।",
  "চিকিৎসা করণীয় কী?": "সঠিক চিকিৎসার জন্য আক্রান্ত স্থানের ছবি তুলে Diagnosis ট্যাবে পরীক্ষা করুন। ত্বক পরিষ্কার ও শুষ্ক রাখুন, নিজে থেকে স্টেরয়েড ক্রিম ব্যবহার করবেন না এবং প্রয়োজনে চিকিৎসকের পরামর্শ নিন।",
};

function appendMsg(role, text) {
  const row = document.createElement("div");
  row.className = "msg-row " + role;
  if (role === "bot") {
    const av = document.createElement("div");
    av.className = "bot-avatar";
    av.textContent = "AI";
    row.appendChild(av);
  }
  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.textContent = text;
  row.appendChild(bubble);
  $("chatLog").appendChild(row);
  $("chatLog").scrollTop = $("chatLog").scrollHeight;
  return bubble;
}

async function sendChat(question) {
  appendMsg("user", question);
  const pending = appendMsg("bot", "চিন্তা করছি… · Thinking…");
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, disease_context: lastResult ? lastResult.disease : null }),
    });
    if (res.status === 404) {
      pending.textContent = LOCAL_QA[question] || "আপনার প্রশ্নটি গ্রহণ করা হয়েছে। বিস্তারিত উত্তর পেতে অনুগ্রহ করে SkinAI Diagnosis ট্যাবে ছবি আপলোড করুন অথবা নিকটস্থ চিকিৎসকের পরামর্শ নিন। (লাইভ RAG চালু করতে webhook/api.py Hugging Face-এ আপডেট করুন।)";
      return;
    }
    const data = await res.json();
    pending.textContent = data.answer || data.error || "No response";
  } catch (err) {
    pending.textContent = LOCAL_QA[question] || ("Error: " + err.message);
  }
}

$("newChatBtn").addEventListener("click", () => {
  $("chatLog").innerHTML = "";
  appendMsg("bot", "নমস্কার / আসসালামু আলাইকুম! ত্বকের যেকোনো সমস্যা সম্পর্কে বাংলা বা ইংরেজিতে প্রশ্ন করতে পারেন।");
});

document.querySelectorAll(".hist-item").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".hist-item").forEach((i) => i.classList.remove("active"));
    item.classList.add("active");
    $("chatLog").innerHTML = "";
    const label = item.querySelector("span:last-child")?.textContent || "Skin health";
    sendChat(label);
  });
});

$("chatForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = $("chatInput").value.trim();
  if (!q) return;
  $("chatInput").value = "";
  sendChat(q);
});
document.querySelectorAll(".chat-chip").forEach((c) => c.addEventListener("click", () => sendChat(c.dataset.q)));

appendMsg("bot", "নমস্কার / আসসালামু আলাইকুম! ত্বকের যেকোনো সমস্যা সম্পর্কে বাংলা বা ইংরেজিতে প্রশ্ন করতে পারেন।");

/* ---------- Insights Map & Ranks (Rokkha OSM + 64-district GeoJSON) ---------- */
const BD_BOUNDS = [[20.55, 88.0], [26.65, 92.7]];
const MAP_COLORS = { low: "#CFD9CC", watch: "#E9B949", alert: "#B3392D", edge: "#6F7F73" };
let districtsGeo = null;
let geoLayer = null;

async function ensureDistrictsGeo() {
  if (districtsGeo) return districtsGeo;
  const res = await fetch("/geo/districts.json");
  if (res.ok) districtsGeo = await res.json();
  return districtsGeo;
}

async function renderInsights() {
  const disease = $("insightDisease").value;
  const info = PREVALENCE[disease] || PREVALENCE.Tinea;
  $("tipsContent").innerHTML = info.tips;

  const ranks = $("districtRanks");
  ranks.innerHTML = "";
  const sevMap = {};
  info.points.forEach((p) => {
    sevMap[p.name.toLowerCase()] = p.sev;
    const row = document.createElement("div");
    row.className = "rank-item";
    row.innerHTML = `<span>${p.name}</span><span class="sev-pill ${p.sev === "High" ? "high" : "med"}">${p.sev}</span>`;
    ranks.appendChild(row);
  });

  if (window.L) {
    if (!bdMap) {
      bdMap = L.map("bdMap", {
        center: [23.75, 90.35],
        zoom: 7,
        minZoom: 6,
        maxZoom: 16,
        maxBounds: BD_BOUNDS,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(bdMap);
      mapLayer = L.layerGroup().addTo(bdMap);
    }
    bdMap.invalidateSize();
    mapLayer.clearLayers();
    if (geoLayer) {
      bdMap.removeLayer(geoLayer);
      geoLayer = null;
    }

    const geo = await ensureDistrictsGeo();
    if (geo) {
      geoLayer = L.geoJSON(geo, {
        style: (feature) => {
          const div = (feature.properties?.division || "").toLowerCase();
          const name = (feature.properties?.name || "").toLowerCase();
          const sev = sevMap[div] || sevMap[name] || (div === "chittagong" ? sevMap["chattogram"] : null);
          const fillColor = sev === "High" ? MAP_COLORS.alert : sev === "Medium" ? MAP_COLORS.watch : MAP_COLORS.low;
          return {
            color: MAP_COLORS.edge,
            weight: 1,
            fillColor,
            fillOpacity: sev === "High" ? 0.62 : sev === "Medium" ? 0.55 : 0.42,
          };
        },
        onEachFeature: (feature, layer) => {
          const name = feature.properties?.name || "District";
          const divName = feature.properties?.division || "";
          const div = divName.toLowerCase();
          const sev = sevMap[div] || sevMap[name.toLowerCase()] || (div === "chittagong" ? sevMap["chattogram"] : "Low");
          layer.bindTooltip(`<strong>${name}</strong> (${divName})<br>${disease}: ${sev}`, { sticky: true });
        },
      }).addTo(bdMap);
    }
  }
}
$("insightDisease").addEventListener("change", renderInsights);

/* ---------- Hospitals (DocTime Tab) ---------- */
async function loadHospitals(params) {
  $("hospitalsStatus").textContent = "Searching nearby hospitals…";
  $("hospitalsGrid").innerHTML = "";
  try {
    const res = await fetch("/api/hospitals?" + new URLSearchParams(params).toString());
    if (res.status === 404) {
      $("hospitalsStatus").textContent = "Backend /api/hospitals not yet deployed on Hugging Face Space.";
      return;
    }
    const data = await res.json();
    const list = data.hospitals || [];
    $("hospitalsStatus").textContent = `Found ${list.length} facilities`;
    list.forEach((h) => {
      const card = document.createElement("div");
      card.className = "hospital-card";
      const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.lat + "," + h.lon)}`;
      card.innerHTML = `<strong>${h.name || "Hospital"}</strong><div class="muted small">${h.address || ""}</div><div class="small mt">${h.dist_km != null ? h.dist_km + " km" : ""} ${h.phone ? "· Tel: " + h.phone : ""}</div><a href="${mapUrl}" target="_blank" rel="noopener">Google Maps →</a>`;
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

/* ---------- Phase 2 Doctors ---------- */
let selectedDocIdx = 0;
function renderDoctors() {
  const grid = $("doctorsGrid");
  grid.innerHTML = "";
  DOCTORS.forEach((d, idx) => {
    const card = document.createElement("div");
    card.className = "doc-card" + (idx === selectedDocIdx ? " selected" : "");
    card.innerHTML = `
      <div class="small">⭐⭐⭐⭐⭐ <span class="g-pill">BMDC</span></div>
      <strong>${d.name}</strong>
      <span class="muted small">${d.en} · ${d.cred}</span>
      <span class="muted small">${d.hosp} · ${d.fee}</span>
      <button type="button" class="btn-secondary mt" data-doc="${idx}">${idx === selectedDocIdx ? "✓ Selected · নির্বাচিত" : "বেছে নিন · Select"}</button>
    `;
    grid.appendChild(card);
  });
  const sel = DOCTORS[selectedDocIdx];
  $("selectedDoctorCard").innerHTML = `<strong>${sel.name} (${sel.en})</strong> — ${sel.cred} · ${sel.hosp} · Consultation fee: <strong>${sel.fee}</strong>`;
  grid.querySelectorAll("[data-doc]").forEach((b) => {
    b.addEventListener("click", () => { selectedDocIdx = Number(b.dataset.doc); renderDoctors(); });
  });
}
document.querySelectorAll(".date-pill").forEach((p) => {
  p.addEventListener("click", () => {
    document.querySelectorAll(".date-pill").forEach((x) => x.classList.remove("active"));
    p.classList.add("active");
  });
});
$("confirmBookingBtn").addEventListener("click", () => {
  const name = $("bkName").value.trim() || "Patient";
  const doc = DOCTORS[selectedDocIdx];
  const date = document.querySelector(".date-pill.active")?.textContent || "23 Nov";
  $("bookingConfirmMsg").textContent = `✓ Appointment requested for ${name} with ${doc.en} on ${date}. (Phase 2 preview)`;
  $("bookingConfirmMsg").classList.remove("hidden");
});

renderDoctors();
checkBackend();
