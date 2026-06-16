import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from faster_whisper import WhisperModel
from starlette.concurrency import run_in_threadpool

MODEL_SIZE = os.getenv("WHISPER_MODEL", "small")
model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")

app = FastAPI(title="HARUKO STT")


def transcribe_audio(path: str) -> str:
    segments, _ = model.transcribe(path, language="ja")
    return "".join(segment.text for segment in segments).strip()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)) -> dict[str, str]:
    suffix = Path(file.filename or "audio.wav").suffix or ".wav"
    temp_path = ""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_path = temp_file.name
            while chunk := await file.read(1024 * 1024):
                temp_file.write(chunk)

        if os.path.getsize(temp_path) == 0:
            raise HTTPException(status_code=400, detail="音声ファイルが空です。")

        text = await run_in_threadpool(transcribe_audio, temp_path)
        return {"text": text}
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail="文字起こしに失敗しました。") from error
    finally:
        await file.close()
        if temp_path:
            Path(temp_path).unlink(missing_ok=True)
