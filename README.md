# HARUKO Voice Chat

Next.js、Ollama、Gemma 4 12B Unified、COEIROINKを組み合わせたローカルLLM音声チャットです。

- テキストチャット: Ollama
- 常時音声入力: Gemma 4 12B Unified
- 音声合成: COEIROINK
- 会話履歴: PostgreSQL + Prisma
- UI/API: Next.js App Router

既存のテキストチャットを維持しながら、ブラウザで検出した発話区間をGemma 4へ直接渡します。
Web Speech APIとWhisperは使用しません。

## Architecture

```text
Browser
  ├─ Text ────────────────> Next.js /api/chat ─────> Ollama
  ├─ 16kHz mono WAV ──────> Next.js /api/chat/audio
  │                                      └─────────> FastAPI + Gemma 4 12B
  └─ TTS playback <─────── Next.js /api/voice/synthesize
                                         └─────────> COEIROINK

Next.js ── Prisma ── PostgreSQL
```

Docker Composeでは次のサービスを起動します。

| Service | Port | Role |
| --- | ---: | --- |
| `app` | `3000` | Next.js UI、API、Prisma |
| `postgres` | `5432` | 会話履歴、モデル設定、音声メタデータ |
| `gemma-audio` | `8082` | Gemma 4による音声理解と回答生成 |

OllamaとCOEIROINKはホストOSで起動し、コンテナから `host.docker.internal` 経由で接続します。

## Voice Flow

```text
音声会話開始
→ Web Audio APIで発話開始を検出
→ MediaRecorderで発話区間を録音
→ 約1秒の無音、または30秒経過で録音終了
→ 16kHz・モノラル・PCM16 WAVへ変換
→ Gemma 4へ音声を直接送信
→ transcriptとresponseを履歴へ保存
→ COEIROINKで回答を読み上げ
→ 再生終了500ms後にマイク待機へ復帰
```

TTS再生中はマイクの録音と発話検知を停止するため、HARUKO自身の音声へ反応しません。

## Requirements

推奨環境:

- Windows 11 + WSL2
- Docker Desktop
- Docker Compose
- NVIDIA GPUとNVIDIA Container Toolkit対応環境
- Ollama
- COEIROINK
- Hugging Faceアカウント
- マイクを利用できるChromium系ブラウザ

現在の既定構成は、VRAM 8GB環境でも12Bモデルを維持するため、Gemma 4を4bit量子化してCPUで実行します。
DockerイメージはCUDA版PyTorchを使用し、Composeにも `gpus: all` を指定しているため、
CPU実行設定でもNVIDIAコンテナランタイムが必要です。

目安:

- RAM: 16GB以上
- 空きディスク: 30GB以上
- 初回モデル取得にはインターネット接続が必要

CPU推論は低速です。実機確認では短い音声でも回答まで数分かかる場合があります。

## External Services

### Ollama

OllamaをホストOSで起動し、`LLM_MODEL` に設定したテキストチャット用モデルを用意してください。

```bash
ollama list
ollama serve
```

既定の接続先は `http://127.0.0.1:11434`、Dockerコンテナからは
`http://host.docker.internal:11434` です。

### Hugging Face / Gemma 4

1. Hugging Faceで `google/gemma-4-12B-it` の利用条件を承認します。
2. モデルを読み取れるアクセストークンを発行します。
3. `src/.env` の `HF_TOKEN` に設定します。

```dotenv
HF_TOKEN="hf_..."
```

トークンをGitへコミットしないでください。

### COEIROINK

COEIROINK本体をホストOSで起動し、ローカルAPIを有効にしてください。

- ホストからの接続先: `http://127.0.0.1:50032`
- Dockerからの接続先: `http://host.docker.internal:50032`

「蔓歌せら（げんき！）」をCOEIROINKへ導入する必要があります。

## Environment Setup

環境変数ファイルを作成します。

```bash
cd src
cp .env.example .env
```

主な環境変数:

| Variable | Default | Description |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL local URL | Prisma接続先 |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama API |
| `LLM_MODEL` | `gemma4:12b` | テキストチャット用Ollamaモデル |
| `GEMMA_AUDIO_SERVICE_URL` | `http://127.0.0.1:8082` | Gemma音声サービス |
| `GEMMA_AUDIO_TIMEOUT_MS` | `600000` | CPU推論を考慮した音声APIタイムアウト |
| `HF_TOKEN` | empty | gatedモデル取得用トークン |
| `TTS_SERVICE_URL` | `http://127.0.0.1:50032` | COEIROINK API |
| `TTS_SPEAKER_UUID` | project default | COEIROINK話者UUID |
| `TTS_STYLE_ID` | `2` | COEIROINKスタイルID |

Docker Compose内ではサービス間接続用URLが自動的に上書きされます。

## Start With Docker

OllamaとCOEIROINKを先に起動してから、アプリを起動します。

```bash
cd src
docker compose up -d --build
```

状態を確認します。

```bash
docker compose ps
docker compose logs -f app gemma-audio
```

ブラウザで次を開きます。

```text
http://localhost:3000/chat
```

Next.jsコンテナ起動時に `prisma db push` とPrisma Client生成を実行します。

## Gemma Warmup

Gemmaサービスは起動後、バックグラウンドでモデルをロードします。

```bash
curl http://127.0.0.1:8082/health
```

利用可能な状態:

```json
{
  "status": "ok",
  "model": "google/gemma-4-12B-it",
  "modelLoaded": true,
  "deviceMode": "cpu"
}
```

手動でロード完了を待つ場合:

```bash
curl -X POST http://127.0.0.1:8082/warmup
```

初回はHugging Faceからモデルをダウンロードするため時間がかかります。
モデルキャッシュはDocker volume `gemma-huggingface-cache` に保持されます。

## Local Development

PostgreSQLとGemma音声サービスだけをDockerで起動できます。

```bash
cd src
docker compose up -d postgres gemma-audio
```

Node.js 24環境でNext.jsをホスト起動します。

```bash
cd src
npm install
npx prisma generate
npx prisma db push
npm run dev
```

この場合、`src/.env` のURLはホスト向けの値を使用します。

### Common Commands

```bash
cd src

npm run dev
npm run lint
npx tsc --noEmit
npm run build
npx prisma generate
npx prisma db push
```

Docker内で確認する場合:

```bash
docker compose exec app npx tsc --noEmit
docker compose exec app npm run build
docker compose logs --tail=100 gemma-audio
```

## Storage

- PostgreSQL: Docker volume `haruko-postgres-data`
- Gemmaモデル: Docker volume `gemma-huggingface-cache`
- Gemmaオフロード領域: Docker volume `gemma-offload`
- 入出力音声: `src/storage/audio/`

音声ファイルはGit管理対象外です。

## Troubleshooting

### Gemma音声サービスへ接続できない

```bash
docker compose ps
curl http://127.0.0.1:8082/health
docker compose logs --tail=200 gemma-audio
```

Next.jsコンテナから確認:

```bash
docker compose exec app node -e \
  "fetch('http://gemma-audio:8082/health').then(r => r.text()).then(console.log)"
```

### `modelLoaded` が `false`

起動直後はモデルをロード中です。ログを確認するか、warmupを実行します。

```bash
curl -X POST http://127.0.0.1:8082/warmup
```

### Hugging Face認証エラー

- `google/gemma-4-12B-it` の利用条件を承認したか確認
- `src/.env` の `HF_TOKEN` を確認
- コンテナを再作成

```bash
docker compose up -d --force-recreate gemma-audio app
```

### Ollamaへ接続できない

```bash
curl http://127.0.0.1:11434/api/tags
docker compose exec app node -e \
  "fetch('http://host.docker.internal:11434/api/tags').then(r => r.text()).then(console.log)"
```

### COEIROINKへ接続できない

COEIROINK本体とローカルAPIが起動していることを確認します。

```bash
curl http://127.0.0.1:50032/v1/speakers
```

### マイクを利用できない

- ブラウザのマイク権限を許可
- `localhost` またはHTTPSでアクセス
- MediaRecorder対応ブラウザを使用
- OS側のマイク利用許可を確認

## Current Limitations

- OllamaのChat APIは音声入力に対応していないため、音声処理は別FastAPIサービスです。
- 8GB VRAMではGemma 4 12B UnifiedをGPUへ収められないため、既定はCPU 4bit実行です。
- CPU実行では応答に数分かかる場合があります。
- 音声入力は最大30秒です。
- 音声回答は最大32生成トークンです。
- GemmaのJSON解析に失敗した場合、元の生成結果を回答として保持します。

## Voice Credit

音声合成には **COEIROINK:蔓歌せら（げんき！）** を使用します。

- COEIROINK: https://coeiroink.com/
- COEIROINK利用規約: https://coeiroink.com/terms
- 蔓歌せら / 音源管理者「さっぱりあんずジャム」利用規約:
  https://sapparianzujamu.wixsite.com/sapparianzu/%E5%88%A9%E7%94%A8%E8%A6%8F%E7%B4%84

`src/Tsuruka_sera-genki/` の音声モデル、音声サンプル、画像はこのリポジトリでは再配布しません。
利用者自身で正規配布元から入手し、COEIROINKへインストールしてください。

生成音声を公開・配布する場合は、最新のCOEIROINK利用規約と音源提供者の利用規約を確認してください。
批判・攻撃、政治・宗教への勧誘、モデルや音声素材の再配布、機械学習用途など、
各規約で禁止されている用途には使用しないでください。
