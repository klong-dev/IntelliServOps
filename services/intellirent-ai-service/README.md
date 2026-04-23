# IntelliRent AI Service

Standalone NestJS AI microservice for IntelliRentOps.

## Endpoints

- `GET /health`
- `POST /v1/chat/respond`
- `GET /v1/meta/models`

## Quick Start

```powershell
Copy-Item .env.example .env
npm install
npm run build
npm start
```

This service expects Ollama to already be running on the same host.
