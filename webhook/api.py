"""
webhook/api.py — REST API router for the split Vercel frontend.

Exposes the full SkinAI Bangladesh backend modules (BD-SkinNet, severity triage,
RAG medical Q&A, hospital finder, and Bengali/English referral PDF) over HTTP JSON
so an external frontend on Vercel can consume them.
"""

from __future__ import annotations

import logging
import threading
from typing import Optional

from fastapi import APIRouter, File, Form, Query, Request, Response, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

logger = logging.getLogger("webhook.api")
router = APIRouter(prefix="/api", tags=["api"])

_MAX_IMAGE_BYTES = 5 * 1024 * 1024
_rag_lock = threading.Lock()
_rag_ready = False

_RED_FLAG_KEYWORDS = {
    "fever": "জ্বর",
    "spreading": "দ্রুত ছড়াচ্ছে",
    "pain": "তীব্র ব্যথা",
    "bleeding": "রক্ত",
}


def _ensure_rag_loaded() -> bool:
    global _rag_ready
    if _rag_ready:
        return True
    with _rag_lock:
        if _rag_ready:
            return True
        try:
            from rag.retriever import load_index
            _rag_ready = bool(load_index())
        except Exception as exc:
            logger.warning("Failed to load RAG index: %s", exc)
            _rag_ready = False
    return _rag_ready


class ChatRequest(BaseModel):
    question: str
    lang: Optional[str] = None
    disease_context: Optional[str] = None


class ReferralPdfRequest(BaseModel):
    patient_name: str = ""
    age: str = ""
    gender: str = ""
    district: str = ""
    symptoms: list[str] = []
    associated_symptoms: list[str] = []
    disease: str = ""
    confidence: float = 0.0
    tier: int = 1
    action_en: str = ""
    action_bn: str = ""


@router.post("/analyze")
async def analyze_skin(
    request: Request,
    image: UploadFile = File(...),
    red_flags: list[str] = Form(default=[]),
    symptoms_text: str = Form(default=""),
    district: str = Form(default=""),
    consent: str = Form(default="false"),
) -> JSONResponse:
    """Run BD-SkinNet + severity triage on an uploaded skin image."""
    from webhook.server import _api_rate_ok, _client_ip
    from whatsapp import router as wa_router

    if not _api_rate_ok(_client_ip(request)):
        return JSONResponse({"error": "rate_limited"}, status_code=429)

    img_bytes = await image.read(_MAX_IMAGE_BYTES + 1)
    if not img_bytes:
        return JSONResponse({"error": "empty_image"}, status_code=400)
    if len(img_bytes) > _MAX_IMAGE_BYTES:
        return JSONResponse({"error": "image_too_large", "max_bytes": _MAX_IMAGE_BYTES}, status_code=413)

    blur = wa_router._laplacian_variance(img_bytes)
    if blur < 0:
        return JSONResponse({"error": "unreadable_image"}, status_code=400)
    if blur < 50.0:
        return JSONResponse({"error": "blurry_image", "blur": round(blur, 1)}, status_code=422)

    from model import service as model_service
    pred = model_service.run_inference(img_bytes)
    if not pred.get("available"):
        return JSONResponse(
            {
                "error": "model_unavailable",
                "message_en": model_service.UNAVAILABLE_EN,
                "message_bn": model_service.UNAVAILABLE_BN,
            },
            status_code=503,
        )

    from model.disease_labels import get_bengali
    from severity.engine import compute_tier, explain_tier

    flag_text = " ".join(_RED_FLAG_KEYWORDS[f] for f in red_flags if f in _RED_FLAG_KEYWORDS)
    transcript = " ".join(part for part in (flag_text, symptoms_text.strip()) if part)

    tier_result = compute_tier(pred["disease"], pred["confidence"], transcript)
    reasons = explain_tier(pred["disease"], pred["confidence"], transcript)

    case_id = None
    if consent.strip().lower() in ("true", "1", "yes", "on"):
        from cases.store import add_case
        case_id = add_case(
            consent=True,
            source="web",
            image=img_bytes,
            ai_disease=pred["disease"],
            ai_conf=pred["confidence"],
            ai_tier=tier_result["tier"],
            reasons=reasons,
            red_flags=[f for f in red_flags if f in _RED_FLAG_KEYWORDS],
            district=district,
        )

    top2 = [
        {
            "disease": t["disease"],
            "disease_bn": get_bengali(t["disease"]),
            "confidence": round(t["confidence"], 4),
        }
        for t in pred.get("top2", [])
    ]

    return JSONResponse({
        "case_id": case_id,
        "disease": pred["disease"],
        "disease_bn": get_bengali(pred["disease"]),
        "confidence": round(pred["confidence"], 4),
        "top2": top2,
        "tier": tier_result["tier"],
        "urgency_label": tier_result["urgency_label"],
        "action_en": tier_result["action"],
        "action_bn": tier_result["bengali_text"],
        "facility": tier_result["facility"],
        "reasons": reasons,
    })


@router.post("/chat")
def chat_rag(payload: ChatRequest) -> JSONResponse:
    """Answer a Bengali or English skin-health question using the RAG pipeline."""
    q = (payload.question or "").strip()
    if not q:
        return JSONResponse({"error": "empty_question"}, status_code=400)

    _ensure_rag_loaded()
    from rag.retriever import _detect_lang, answer_question

    lang = payload.lang or _detect_lang(q)
    answer = answer_question(q, lang=lang, disease_context=payload.disease_context)
    return JSONResponse({"answer": answer, "lang": lang})


@router.get("/hospitals")
def list_hospitals(
    district: str = Query(default="Dhaka"),
    lat: Optional[float] = Query(default=None),
    lon: Optional[float] = Query(default=None),
    n: int = Query(default=6, ge=1, le=15),
) -> JSONResponse:
    """Find nearest hospitals by district name or GPS coordinates."""
    from map.hospital_finder import find_nearest_hospitals, get_district_coords

    resolved_lat, resolved_lon = lat, lon
    if resolved_lat is None or resolved_lon is None:
        coords = get_district_coords(district) or get_district_coords("dhaka")
        if coords is None:
            return JSONResponse({"error": "unknown_district"}, status_code=400)
        resolved_lat, resolved_lon = coords

    hospitals = find_nearest_hospitals(resolved_lat, resolved_lon, n=n)
    return JSONResponse({
        "district": district,
        "lat": resolved_lat,
        "lon": resolved_lon,
        "hospitals": hospitals,
    })


@router.post("/referral-pdf")
def create_referral_pdf(payload: ReferralPdfRequest) -> Response:
    """Generate and return a 4-section bilingual referral PDF."""
    from pdf_gen.referral import generate_referral_pdf

    session_data = {
        "patient_name": payload.patient_name,
        "age": payload.age,
        "gender": payload.gender,
        "district": payload.district,
        "symptoms": payload.symptoms,
        "associated_symptoms": payload.associated_symptoms,
        "disease": payload.disease,
        "confidence": payload.confidence,
        "tier": payload.tier,
        "triage_action_en": payload.action_en,
        "triage_action_bn": payload.action_bn,
    }
    pdf_bytes = generate_referral_pdf(session_data)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="skinai-referral.pdf"'},
    )
