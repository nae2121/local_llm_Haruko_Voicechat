# HARUKO Voice Chat

Next.js、Ollama、faster-whisper、COEIROINKを組み合わせたローカル音声チャットです。

- テキストチャット: Ollama / Gemma
- 日本語文字起こし: faster-whisper `small`
- 音声合成: COEIROINK
- 会話履歴: PostgreSQL + Prisma
- UI/API: Next.js App Router

## Architecture

```text
Browser
  ├─ Text ─────────────────> Next.js /api/chat ─────────> Ollama
  ├─ Recorded audio ───────> Next.js /api/voice/transcribe
  │                                      └──────────────> FastAPI + faster-whisper
  └─ TTS playback <──────── Next.js /api/voice/synthesize
                                         └──────────────> COEIROINK

Next.js ── Prisma ── PostgreSQL
```

Docker Composeで起動するサービス:

| Service | Port | Role |
| --- | ---: | --- |
| `app` | `3000` | Next.js UI、API、Prisma |
| `postgres` | `5432` | 会話履歴とモデル設定 |
| `stt` | `8001` | faster-whisperによる日本語文字起こし |

OllamaとCOEIROINKはホストOSで起動し、コンテナから
`host.docker.internal` 経由で接続します。

## Voice Flow

```text
音声会話開始
→ Web Audio APIで発話開始を検出
→ MediaRecorderで発話区間を録音
→ 16kHz・モノラル・PCM16 WAVへ変換
→ STTサービスで日本語文字起こし
→ 文字起こし結果をチャット欄へ表示
→ 既存のテキストチャットAPIからOllamaへ送信
→ Gemmaの回答を表示
→ COEIROINKで回答を読み上げ
→ 再生終了500ms後にマイク待機へ復帰
```

TTS再生中は録音と発話検知を停止するため、HARUKO自身の音声には反応しません。
待機中、聞き取り中、考え中、発話中の状態は `haruko.png` とともに表示されます。

## Requirements

- Windows 11 + WSL2
- Docker Desktop / Docker Compose
- Ollama
- COEIROINK
- マイクを利用できるChromium系ブラウザ
- 初回モデル取得用のインターネット接続

STTはCPUで `compute_type="int8"`、言語 `ja`、モデル `small` を使用します。
モデルキャッシュはDocker volume `stt-huggingface-cache` に保持されます。

## Setup

Ollamaにチャット用モデルを用意し、COEIROINKのローカルAPIを起動します。

```bash
ollama list
ollama serve
```

環境変数を準備してDocker Composeを起動します。

```bash
cd src
cp .env.example .env
docker compose up -d --build
```

ブラウザで `http://localhost:3000/chat` を開きます。

主な環境変数:

| Variable | Default | Description |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL local URL | Prisma接続先 |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama API |
| `LLM_MODEL` | `gemma4:12b` | Ollamaモデル |
| `STT_BASE_URL` | `http://127.0.0.1:8001` | STT API |
| `TTS_SERVICE_URL` | `http://127.0.0.1:50032` | COEIROINK API |
| `TTS_SPEAKER_UUID` | project default | COEIROINK話者UUID |
| `TTS_STYLE_ID` | `2` | COEIROINKスタイルID |

Docker内では `STT_BASE_URL=http://stt:8001` が設定されます。

## STT API

ヘルスチェック:

```bash
curl http://127.0.0.1:8001/health
```

文字起こし:

```bash
curl -X POST http://127.0.0.1:8001/transcribe \
  -F "file=@sample.wav"
```

レスポンス:

```json
{
  "text": "文字起こし結果"
}
```

## Development

```bash
cd src
docker compose up -d postgres stt
npm install
npx prisma generate
npx prisma db push
npm run dev
```

検証コマンド:

```bash
npm run lint
npx tsc --noEmit
npm run build
docker compose config --quiet
docker compose logs --tail=100 stt
```

## Troubleshooting

STTへ接続できない場合:

```bash
docker compose ps
curl http://127.0.0.1:8001/health
docker compose logs --tail=200 stt
docker compose exec app node -e \
  "fetch('http://stt:8001/health').then(r => r.text()).then(console.log)"
```

Ollamaへ接続できない場合:

```bash
curl http://127.0.0.1:11434/api/tags
docker compose exec app node -e \
  "fetch('http://host.docker.internal:11434/api/tags').then(r => r.text()).then(console.log)"
```

COEIROINKへ接続できない場合:

```bash
curl http://127.0.0.1:50032/v1/speakers
```

マイクを利用できない場合は、ブラウザとOSのマイク権限、MediaRecorder対応、
`localhost` またはHTTPSでのアクセスを確認してください。

## Voice Credit

音声合成には **COEIROINK:蔓歌せら（げんき！）** を使用します。

- COEIROINK: https://coeiroink.com/
- COEIROINK利用規約: https://coeiroink.com/terms
- 蔓歌せら / 音源管理者「さっぱりあんずジャム」利用規約:
  https://sapparianzujamu.wixsite.com/sapparianzu/%E5%88%A9%E7%94%A8%E8%A6%8F%E7%B4%84

`src/Tsuruka_sera-genki/` の音声モデル、音声サンプル、画像は再配布しません。
