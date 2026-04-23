# AI Host Microservice Setup for Windows

Tai lieu nay danh rieng cho truong hop:
- AI chi duoc cai tren `1 host Windows`
- AI duoc trien khai thanh `1 NestJS microservice`
- Cac service NestJS khac trong he thong chi goi microservice nay qua HTTP noi bo

Tai lieu nay khong huong dan Linux. Muc tieu la de team Windows co the lam theo tung buoc va dung ngay.

## 1. Kien truc muc tieu

```text
Client
  -> Main NestJS API
      -> AI Microservice (NestJS, port 3007)
          -> Ollama (chi local tren host, port 11434)
              -> Local model
```

Nguyen tac bat buoc:
- `Main API` khong goi truc tiep Ollama
- `Ollama` chi nghe tren host AI va chi cho `AI microservice` goi
- `AI microservice` la diem vao duy nhat cua he thong cho chat AI
- Khong expose port `11434` ra Internet

## 2. Mo hinh cau hinh

### Main API

Main API chi can biet endpoint cua AI service:

```env
AI_ENABLED=true
AI_PROVIDER=service
AI_SERVICE_URL=http://10.10.10.25:3007
AI_SERVICE_TIMEOUT_MS=20000
AI_SERVICE_API_KEY=change-this
```

### AI microservice

AI microservice chay tren host Windows va goi Ollama local:

```env
PORT=3007
AI_ENABLED=true
AI_PROVIDER=ollama
AI_SERVICE_API_KEY=change-this
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:4b
AI_FALLBACK_MODEL=qwen3:1.7b
AI_RESPONSE_TIMEOUT_MS=20000
AI_MAX_CONTEXT_CHUNKS=6
AI_CONFIDENCE_THRESHOLD=0.72
```

## 3. Yeu cau host Windows

Theo docs chinh thuc cua Ollama for Windows:
- Windows 10 22H2 hoac moi hon
- NVIDIA driver 452.39 tro len neu dung NVIDIA
- Ollama API mac dinh nghe tai `http://localhost:11434`

Tai lieu tham khao:
- Ollama Windows docs: https://docs.ollama.com/windows
- Ollama download for Windows: https://ollama.com/download/windows
- Ollama API intro: https://docs.ollama.com/api/introduction
- Ollama chat endpoint: https://docs.ollama.com/api/chat
- Qwen3 library: https://ollama.com/library/qwen3

## 4. Cac quy uoc se dung trong huong dan nay

Trong tai lieu nay, minh dung cac duong dan de xuat sau:

```text
C:\AIHost\
  apps\
    intellirent-ai\
  logs\
    intellirent-ai\
  models\
```

Giai thich:
- `C:\AIHost\apps\intellirent-ai`: source/build cua AI microservice
- `C:\AIHost\logs\intellirent-ai`: log file
- `C:\AIHost\models`: noi Ollama luu model

Neu host cua ban co o D hoac E rong hon, ban nen doi `models` sang o do.

## 5. Buoc 0 - Chuan bi thu muc

Mo PowerShell va tao thu muc:

```powershell
New-Item -ItemType Directory -Force -Path C:\AIHost\apps\intellirent-ai
New-Item -ItemType Directory -Force -Path C:\AIHost\logs\intellirent-ai
New-Item -ItemType Directory -Force -Path C:\AIHost\models
```

Kiem tra lai:

```powershell
Get-ChildItem C:\AIHost
```

Ket qua mong doi:
- co `apps`
- co `logs`
- co `models`

## 6. Buoc 1 - Cai Ollama tren Windows

### Cach don gian nhat: installer chinh thuc

Mo trinh duyet va tai:
- https://ollama.com/download/windows

Hoac dung PowerShell tu trang download chinh thuc:

```powershell
irm https://ollama.com/install.ps1 | iex
```

Sau khi cai xong:
1. Mo PowerShell moi
2. Chay:

```powershell
ollama --version
```

Neu lenh nay chay duoc, nghia la `ollama` da vao `PATH`.

### Luu y quan trong

Theo docs chinh thuc:
- installer khong bat buoc quyen Administrator
- Ollama mac dinh cai trong home directory cua user
- API se duoc phuc vu tai `http://localhost:11434`

## 7. Buoc 2 - Chuyen noi luu model sang o rieng

Khong nen de model trong home directory neu host dung lau dai.

Theo docs Ollama for Windows, hay dat bien moi truong `OLLAMA_MODELS`.

### Cach dat bang PowerShell

```powershell
[Environment]::SetEnvironmentVariable('OLLAMA_MODELS', 'C:\AIHost\models', 'User')
```

Sau do:
1. Tat Ollama tray neu dang chay
2. Mo lai Ollama tu Start Menu
3. Mo PowerShell moi

Kiem tra bien moi truong:

```powershell
echo $env:OLLAMA_MODELS
```

Ket qua mong doi:

```text
C:\AIHost\models
```

### Neu muon dat trong giao dien Windows

Theo docs chinh thuc:
1. Mo Settings hoac Control Panel
2. Tim `environment variables`
3. Chon `Edit environment variables for your account`
4. Tao variable `OLLAMA_MODELS`
5. Dat value la `C:\AIHost\models`
6. Bam `OK/Apply`

## 8. Buoc 3 - Kiem tra Ollama API tren host

Truoc khi tai model, kiem tra API da song chua:

```powershell
Invoke-WebRequest http://127.0.0.1:11434/api/tags
```

Neu tra ve `200 OK`, nghia la Ollama server dang chay.

Neu khong len:
- mo Ollama tu Start Menu
- doi 10-20 giay
- chay lai lenh tren

## 9. Buoc 4 - Tai model cho host

### Model khuyen nghi

Cho host Windows GPU yeu:
- mac dinh: `qwen3:4b`
- fallback: `qwen3:1.7b`

Ly do:
- `qwen3:4b` la model nho, phu hop chat service
- `qwen3:1.7b` la duong ha cap khi host khong du VRAM/RAM

### Tai model mac dinh

```powershell
ollama pull qwen3:4b
```

### Tai model fallback

```powershell
ollama pull qwen3:1.7b
```

### Kiem tra model da co

```powershell
ollama list
```

Ban mong doi thay it nhat:
- `qwen3:4b`
- `qwen3:1.7b`

## 10. Buoc 5 - Test model truc tiep bang CLI

Chat thu:

```powershell
ollama run qwen3:4b
```

Nhap:

```text
Tra loi ngan gon bang tieng Viet: he thong AI da san sang chua?
```

Neu response ra noi dung hop le, host da chay duoc model.

Thoat bang:

```text
/bye
```

## 11. Buoc 6 - Test API chat cua Ollama

Theo docs `POST /api/chat`, test bang PowerShell:

```powershell
$body = @{
  model = 'qwen3:4b'
  stream = $false
  messages = @(
    @{
      role = 'user'
      content = 'Tra loi 1 cau ngan gon bang tieng Viet: host AI da san sang chua?'
    }
  )
} | ConvertTo-Json -Depth 10

Invoke-WebRequest `
  -Method POST `
  -Uri http://127.0.0.1:11434/api/chat `
  -ContentType 'application/json' `
  -Body $body
```

Ket qua mong doi:
- HTTP `200`
- body JSON co `message.content`

Neu muon doc de hon:

```powershell
(Invoke-WebRequest `
  -Method POST `
  -Uri http://127.0.0.1:11434/api/chat `
  -ContentType 'application/json' `
  -Body $body).Content | ConvertFrom-Json
```

## 12. Buoc 7 - Dat code AI microservice len host

Phan nay danh cho app NestJS AI microservice cua ban.

Copy source code vao:

```text
C:\AIHost\apps\intellirent-ai
```

Sau khi copy, mo PowerShell tai thu muc do va chay:

```powershell
Set-Location C:\AIHost\apps\intellirent-ai
npm ci
npm run build
```

Neu app dung Prisma hoac migration rieng, thuc hien them theo dung repo cua AI service.

## 13. Buoc 8 - Tao file `.env` cho AI microservice

Tao file `.env` trong:

```text
C:\AIHost\apps\intellirent-ai\.env
```

Noi dung goi y:

```env
NODE_ENV=production
PORT=3007

AI_ENABLED=true
AI_PROVIDER=ollama
AI_SERVICE_API_KEY=change-this

OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:4b
AI_FALLBACK_MODEL=qwen3:1.7b
AI_RESPONSE_TIMEOUT_MS=20000
AI_MAX_CONTEXT_CHUNKS=6
AI_CONFIDENCE_THRESHOLD=0.72
```

Y nghia:
- `PORT=3007`: port public cua AI microservice trong LAN/private network
- `OLLAMA_BASE_URL`: AI microservice goi local Ollama
- `AI_SERVICE_API_KEY`: khoa bao mat giua main API va AI service

## 14. Buoc 9 - Chay thu AI microservice bang tay

Tai folder app:

```powershell
Set-Location C:\AIHost\apps\intellirent-ai
node dist\main.js
```

Neu service dung file entry khac, doi lai theo app cua ban.

Khi service da len, test:

```powershell
Invoke-WebRequest http://127.0.0.1:3007/health
```

Neu response `200`, service da song.

## 15. Buoc 10 - Test endpoint chat cua AI microservice

Gia su AI service cua ban co endpoint:
- `POST /v1/chat/respond`

Test:

```powershell
$headers = @{
  Authorization = 'Bearer change-this'
}

$body = @{
  conversationId = 'demo-conv'
  actorType = 'guest'
  message = 'Can nay co cho nuoi meo khong?'
} | ConvertTo-Json

Invoke-WebRequest `
  -Method POST `
  -Uri http://127.0.0.1:3007/v1/chat/respond `
  -Headers $headers `
  -ContentType 'application/json' `
  -Body $body
```

Ban mong doi:
- HTTP `200`
- body co cau tra loi cua AI

## 16. Buoc 11 - Cau hinh Firewall dung cach

Chi mo port microservice, khong mo port Ollama.

### Cho phep port 3007 trong private network

Chay PowerShell voi quyen Administrator:

```powershell
New-NetFirewallRule `
  -DisplayName 'IntelliRent AI Microservice 3007' `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort 3007 `
  -Profile Private
```

### Chan/khong mo port 11434 ra ngoai

Muc tieu:
- `11434` chi local
- service khac tren host van goi duoc qua `127.0.0.1`
- may ben ngoai khong duoc truy cap

Neu da tung mo 11434, xoa rule cu hoac disable rule do.

## 17. Buoc 12 - Tao startup script cho AI microservice

De de van hanh, tao file:

```text
C:\AIHost\apps\intellirent-ai\start-ai-service.cmd
```

Noi dung:

```bat
@echo off
setlocal
cd /d C:\AIHost\apps\intellirent-ai
node dist\main.js >> C:\AIHost\logs\intellirent-ai\stdout.log 2>> C:\AIHost\logs\intellirent-ai\stderr.log
```

File nay giup:
- chay dung thu muc
- ghi stdout vao log
- ghi stderr vao log

## 18. Buoc 13 - Dang ky auto-start cho AI microservice

Co 2 cach:

### Cach A - De nhat: Task Scheduler

Mo `Task Scheduler` va tao task moi:
1. Chon `Create Task`
2. Dat ten: `IntelliRent AI Microservice`
3. Tab `General`:
   - tick `Run whether user is logged on or not`
   - tick `Run with highest privileges`
4. Tab `Triggers`:
   - `New...`
   - `Begin the task`: `At startup`
5. Tab `Actions`:
   - `New...`
   - `Program/script`: `C:\AIHost\apps\intellirent-ai\start-ai-service.cmd`
6. Tab `Settings`:
   - bat `Restart task if it fails`

Sau khi tao xong:
- chon task
- bam `Run`
- xem co process Node len khong

### Cach B - Dung dong lenh `schtasks`

Mo PowerShell voi quyen Administrator:

```powershell
schtasks /Create `
  /TN "IntelliRent AI Microservice" `
  /SC ONSTART `
  /RL HIGHEST `
  /TR "C:\AIHost\apps\intellirent-ai\start-ai-service.cmd" `
  /F
```

Chay task ngay:

```powershell
schtasks /Run /TN "IntelliRent AI Microservice"
```

## 19. Buoc 14 - Auto-start cho Ollama

Voi ban cai dat standard installer, Ollama chay dang native Windows app va phuc vu API nen cach don gian nhat la:
- dang nhap bang account van hanh host
- dam bao Ollama da cai va mo duoc
- kiem tra lai API `http://127.0.0.1:11434/api/tags`

Neu ban can chay Ollama nhu service dung nghia:
- docs Windows cua Ollama co noi ve `standalone CLI`
- docs cung neu ro co the chay `ollama serve` qua cong cu nhu `NSSM`

Tham khao chinh thuc:
- https://docs.ollama.com/windows

Trong giai doan dau, uu tien installer mode vi de setup va de debug hon.

## 20. Buoc 15 - Cau hinh main API tro toi host AI

Tren main API, dat:

```env
AI_ENABLED=true
AI_PROVIDER=service
AI_SERVICE_URL=http://10.10.10.25:3007
AI_SERVICE_TIMEOUT_MS=20000
AI_SERVICE_API_KEY=change-this
```

Neu main API cung chay tren Windows va muon test thu:

```powershell
Invoke-WebRequest `
  -Method GET `
  -Uri http://10.10.10.25:3007/health
```

Neu health check OK thi main API co the noi duong toi host AI.

## 21. Buoc 16 - Checklist nghiem thu

### Tren host AI

Kiem tra 1:

```powershell
ollama --version
```

Kiem tra 2:

```powershell
ollama list
```

Kiem tra 3:

```powershell
Invoke-WebRequest http://127.0.0.1:11434/api/tags
```

Kiem tra 4:

```powershell
Invoke-WebRequest http://127.0.0.1:3007/health
```

Kiem tra 5:
- `C:\AIHost\logs\intellirent-ai\stdout.log` co noi dung
- `C:\AIHost\logs\intellirent-ai\stderr.log` khong co loi nghiem trong

### Tren main API

Kiem tra 6:
- service goi duoc `AI_SERVICE_URL`

Kiem tra 7:
- gui 1 message chat that
- AI microservice tra ve response
- main API luu message vao conversation nhu mong doi

## 22. Loi thuong gap va cach xu ly

### `ollama` khong tim thay

Nguyen nhan:
- terminal cu chua nhan `PATH`

Cach xu ly:
- dong PowerShell cu
- mo PowerShell moi
- chay lai `ollama --version`

### Da set `OLLAMA_MODELS` nhung model van vao cho cu

Nguyen nhan:
- Ollama dang chay tu truoc khi set env

Cach xu ly:
- quit Ollama tray
- mo lai tu Start Menu
- mo terminal moi

### `11434` song nhung `3007` khong len

Nguyen nhan:
- AI microservice chua build
- file `.env` sai
- entrypoint sai

Cach xu ly:
- chay tay `node dist\main.js`
- doc `stderr.log`

### Main API khong goi duoc AI host

Nguyen nhan:
- sai `AI_SERVICE_URL`
- firewall chua mo `3007`
- host AI khong nghe tren `0.0.0.0`

Cach xu ly:
- test `/health` tu may main API
- kiem tra firewall rule
- kiem tra app bind dung port va interface

### Model qua cham

Cach xu ly:
- doi `OLLAMA_MODEL=qwen3:1.7b`
- dong app khac dang an GPU/RAM
- giam timeout neu can phat hien loi nhanh, hoac tang timeout neu host yeu

## 23. Sai lam can tranh

- De main API goi truc tiep `http://host-ai:11434`
- Expose `11434` public
- Dat `OLLAMA_BASE_URL` tren main API thay vi tren AI microservice
- Khong co `AI_SERVICE_API_KEY`
- Khong ghi log cho startup process
- Khong co health check endpoint

## 24. Chot lai cach lam dung

Neu lam dung theo runbook nay:
- host Windows chi chay `Ollama + AI microservice`
- `Ollama` chi phuc vu local tren host
- `AI microservice` expose `3007` cho noi bo
- `Main API` chi goi `AI_SERVICE_URL`

Day la mo hinh phu hop nhat khi AI la mot microservice doc lap trong he thong NestJS.
