import json
import io
import os
import re
import tempfile
import threading
import wave
from functools import lru_cache
from pathlib import Path
from typing import Any

import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from transformers import BitsAndBytesConfig, GenerationConfig, pipeline

MODEL_ID = os.getenv("GEMMA_AUDIO_MODEL_ID", "google/gemma-4-12B-it")
MAX_AUDIO_BYTES = 1_000_000
GPU_MAX_MEMORY = os.getenv("GEMMA_GPU_MAX_MEMORY", "7GiB")
CPU_MAX_MEMORY = os.getenv("GEMMA_CPU_MAX_MEMORY", "12GiB")
OFFLOAD_DIR = os.getenv("GEMMA_OFFLOAD_DIR", "/models/offload")
DEVICE_MODE = os.getenv("GEMMA_DEVICE", "cpu")
MAX_NEW_TOKENS = int(os.getenv("GEMMA_AUDIO_MAX_TOKENS", "32"))

app = FastAPI(title="HARUKO Gemma Audio Service")
model_loaded = False


@app.on_event("startup")
def start_model_warmup():
    threading.Thread(target=get_pipeline, name="gemma-warmup", daemon=True).start()


@lru_cache(maxsize=1)
def get_pipeline():
    global model_loaded
    Path(OFFLOAD_DIR).mkdir(parents=True, exist_ok=True)
    quantization_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        llm_int8_enable_fp32_cpu_offload=True,
    )
    model_kwargs: dict[str, Any] = {"quantization_config": quantization_config}
    if DEVICE_MODE == "cpu":
        device_map: str | dict[str, str] = {"": "cpu"}
    else:
        device_map = "auto"
        model_kwargs.update(
            {
                "max_memory": {0: GPU_MAX_MEMORY, "cpu": CPU_MAX_MEMORY},
                "offload_folder": OFFLOAD_DIR,
                "offload_state_dict": True,
            }
        )
    pipeline_kwargs: dict[str, Any] = {
        "task": "any-to-any",
        "model": MODEL_ID,
        "device_map": device_map,
        "dtype": "auto",
        "model_kwargs": model_kwargs,
    }
    if DEVICE_MODE == "cpu":
        pipeline_kwargs["device"] = -1
    audio_pipeline = pipeline(**pipeline_kwargs)
    model_loaded = True
    return audio_pipeline


def parse_context(value: str) -> dict[str, Any]:
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="context_json is invalid JSON") from exc
    return parsed if isinstance(parsed, dict) else {}


def extract_generated_text(outputs: Any) -> str:
    if isinstance(outputs, list) and outputs:
        item = outputs[0]
        if isinstance(item, dict):
            value = item.get("generated_text")
            if isinstance(value, str):
                return value.strip()
    if isinstance(outputs, dict) and isinstance(outputs.get("generated_text"), str):
        return outputs["generated_text"].strip()
    return str(outputs).strip()


def parse_model_json(raw_output: str) -> tuple[str, str]:
    cleaned = raw_output.replace("<turn|>", "").strip()
    candidates = [cleaned]
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", cleaned, re.DOTALL)
    if fenced:
        candidates.insert(0, fenced.group(1))
    first_brace = cleaned.find("{")
    last_brace = cleaned.rfind("}")
    if first_brace >= 0 and last_brace > first_brace:
        candidates.append(cleaned[first_brace : last_brace + 1])

    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if not isinstance(parsed, dict):
            continue
        transcript = parsed.get("transcript")
        response = parsed.get("response")
        if isinstance(transcript, str) and isinstance(response, str) and response.strip():
            return transcript.strip() or "[音声入力]", response.strip()

    # Preserve the model's original answer when structured output parsing fails.
    return "[音声入力]", cleaned or "音声への回答を生成できませんでした。"


def build_messages(context: dict[str, Any], audio_path: str) -> list[dict[str, Any]]:
    messages: list[dict[str, Any]] = []
    system_prompt = str(context.get("systemPrompt") or "").strip()
    if system_prompt:
        messages.append(
            {"role": "system", "content": [{"type": "text", "text": system_prompt}]}
        )

    history = context.get("history")
    if isinstance(history, list):
        for item in history[-12:]:
            if not isinstance(item, dict) or item.get("role") not in {"user", "assistant"}:
                continue
            content = str(item.get("content") or "").strip()
            if content:
                messages.append(
                    {
                        "role": item["role"],
                        "content": [{"type": "text", "text": content}],
                    }
                )

    instruction = (
        "次の日本語音声を理解し、音声の文字起こしとHARUKOとしての返答を生成してください。"
        "必ずJSONオブジェクトだけを出力し、改行やMarkdownコードフェンスを付けないでください。"
        '形式: {"transcript":"認識したユーザーの発話","response":"HARUKOとしての回答"}'
    )
    messages.append(
        {
            "role": "user",
            "content": [
                {"type": "text", "text": instruction},
                {"type": "audio", "audio": audio_path},
            ],
        }
    )
    return messages


def validate_wav(audio_bytes: bytes) -> int:
    try:
        with wave.open(io.BytesIO(audio_bytes), "rb") as wav_file:
            channels = wav_file.getnchannels()
            sample_rate = wav_file.getframerate()
            frames = wav_file.getnframes()
    except wave.Error as exc:
        raise HTTPException(status_code=400, detail="invalid WAV file") from exc
    if channels != 1 or sample_rate != 16_000:
        raise HTTPException(status_code=400, detail="16kHz mono WAV is required")
    duration_ms = round(frames / sample_rate * 1000)
    if duration_ms <= 0 or duration_ms > 30_050:
        raise HTTPException(status_code=400, detail="audio duration must be 30 seconds or less")
    return duration_ms


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": MODEL_ID,
        "modelLoaded": model_loaded,
        "cudaAvailable": torch.cuda.is_available(),
        "authenticated": bool(os.getenv("HF_TOKEN")),
        "deviceMode": DEVICE_MODE,
    }


@app.post("/warmup")
def warmup():
    get_pipeline()
    return {"status": "ready", "model": MODEL_ID}


@app.post("/chat/audio")
async def chat_audio(
    file: UploadFile = File(...),
    context_json: str = Form("{}"),
):
    if file.content_type not in {"audio/wav", "audio/x-wav"}:
        raise HTTPException(status_code=415, detail="16kHz mono WAV is required")

    audio_bytes = await file.read(MAX_AUDIO_BYTES + 1)
    if not audio_bytes or len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=400, detail="audio file is empty or too large")

    context = parse_context(context_json)
    duration_ms = validate_wav(audio_bytes)
    temp_path = ""
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
            temp_file.write(audio_bytes)
            temp_path = temp_file.name

        generation_config = GenerationConfig.from_pretrained(MODEL_ID)
        generation_config.max_new_tokens = min(
            int(context.get("maxTokens") or MAX_NEW_TOKENS),
            MAX_NEW_TOKENS,
        )
        generation_config.temperature = float(context.get("temperature") or 1.0)
        generation_config.top_p = float(context.get("topP") or 0.95)
        generation_config.top_k = int(context.get("topK") or 64)
        generation_config.do_sample = generation_config.temperature > 0

        outputs = get_pipeline()(
            text=build_messages(context, temp_path),
            return_full_text=False,
            generate_kwargs={"generation_config": generation_config},
        )
        raw_output = extract_generated_text(outputs)
        transcript, response = parse_model_json(raw_output)
        return {
            "transcript": transcript,
            "response": response,
            "rawOutput": raw_output,
            "durationMs": duration_ms,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        if temp_path:
            Path(temp_path).unlink(missing_ok=True)
