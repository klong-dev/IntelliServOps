# AI Dev Setup

Neu AI duoc trien khai nhu `microservice rieng tren host AI`, uu tien doc tai lieu nay cung voi:
- `documents/ai-host-microservice-setup.md`

Tai lieu nay huong dan developer setup ha tang AI local cho IntelliRentOps tren Windows.

Muc tieu cua ban setup nay:
- Chay local LLM qua Ollama
- Tai model nho phu hop may dev/GPU yeu
- Co smoke test de kiem tra API local truoc khi noi vao `ChatModule`

## 1. Yeu cau toi thieu

- Windows 10 22H2 hoac moi hon
- Node.js da cai
- NVIDIA driver hoat dong, co the kiem tra bang:

```powershell
nvidia-smi
```

Ollama phuc vu API mac dinh tai `http://localhost:11434`.

## 2. Cach chon model cho may dev

Uu tien cho may GPU yeu:
- Mac dinh: `qwen3:4b`
- Fallback khi VRAM khong du hoac latency cao: `gemma3:1b-it-qat` hoac `qwen3:1.7b`

Khuyen nghi cho host:
- RTX 3050 4GB: thu `qwen3:4b`, neu bi swap/OOM thi ha xuong `qwen3:1.7b`
- GTX 1060 6GB: van uu tien `qwen3:4b`
- CPU-only: dung `qwen3:1.7b` hoac `gemma3:1b-it-qat`

Khong nen dung model 7B/8B cho vong lap dev tren may yeu.

## 3. Cai Ollama tren Windows

Tai installer tu Ollama:
- https://ollama.com/download

Sau khi cai xong, mo PowerShell moi va kiem tra:

```powershell
ollama --version
```

Neu muon doi thu muc luu model, tao bien moi truong user:

```powershell
[Environment]::SetEnvironmentVariable('OLLAMA_MODELS', 'D:\ollama-models', 'User')
```

Sau do tat Ollama tray va mo lai.

## 4. Tai model

Tai model mac dinh:

```powershell
ollama pull qwen3:4b
```

Tai model fallback:

```powershell
ollama pull qwen3:1.7b
ollama pull gemma3:1b-it-qat
```

Kiem tra danh sach model:

```powershell
ollama list
```

Chat thu truc tiep:

```powershell
ollama run qwen3:4b
```

## 5. Cau hinh cho repo

Them vao file `.env`:

```env
AI_ENABLED=true
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:4b
AI_FALLBACK_MODEL=qwen3:1.7b
AI_RESPONSE_TIMEOUT_MS=20000
AI_MAX_CONTEXT_CHUNKS=6
AI_CONFIDENCE_THRESHOLD=0.72
AI_FAQ_FILE=documents/ai/faq.vi.jsonl
```

Giai thich nhanh:
- `OLLAMA_BASE_URL`: endpoint local cua Ollama
- `OLLAMA_MODEL`: model mac dinh dung cho chat
- `AI_FALLBACK_MODEL`: model ha cap khi may dev khong keo noi model chinh
- `AI_RESPONSE_TIMEOUT_MS`: timeout cho 1 lan goi model

## 6. Khoi dong database va cache cua repo

Neu can dung day du backend:

```powershell
docker compose up -d postgres redis
```

Neu may chua cai Docker, phan AI local van co the test doc lap chi voi Ollama.

## 7. Smoke test nhanh

Sau khi cai xong Ollama va tai model, chay:

```powershell
npm run ai:smoke
```

Mac dinh script se dung:
- `OLLAMA_BASE_URL` neu co
- Model `qwen3:4b` neu chua set env

Co the override:

```powershell
$env:OLLAMA_MODEL='qwen3:1.7b'
npm run ai:smoke
```

Neu muon test truc tiep API:

```powershell
Invoke-WebRequest -Method POST `
  -Uri http://localhost:11434/api/chat `
  -ContentType 'application/json' `
  -Body '{"model":"qwen3:4b","messages":[{"role":"user","content":"Tra loi ngan gon: xin chao"}],"stream":false}'
```

## 8. Checklist hoan tat

- `ollama --version` chay duoc
- `ollama list` thay model da tai
- `npm run ai:smoke` tra ve noi dung hop le
- `http://localhost:11434/api/chat` respond JSON

## 9. Loi thuong gap

`ollama` khong nhan lenh:
- Dong terminal cu, mo terminal moi
- Kiem tra Ollama da them vao `PATH` chua

Model chay qua cham:
- Ha `OLLAMA_MODEL` tu `qwen3:4b` xuong `qwen3:1.7b`
- Dong app nang GPU/VRAM

Khong du o dia:
- Doi `OLLAMA_MODELS` sang o dung luong lon hon

Request timeout:
- Tang `AI_RESPONSE_TIMEOUT_MS`
- Dung model nho hon

## 10. Muc tieu sau setup

Sau khi buoc setup nay xong, backend co the noi local LLM theo luong:
- User message -> AI orchestrator
- Retrieve context tu FAQ/policy/apartment public
- Goi Ollama local
- Ghi `system` message vao conversation

## Nguon tham khao

- Ollama Windows docs: https://docs.ollama.com/windows
- Ollama Quickstart: https://docs.ollama.com/quickstart
- Ollama model library `qwen3`: https://ollama.com/library/qwen3
- Ollama model library `gemma3`: https://ollama.com/library/gemma3
