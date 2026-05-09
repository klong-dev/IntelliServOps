import { registerAs } from '@nestjs/config';

function parseBoolean(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export default registerAs('aiService', () => ({
  enabled: parseBoolean(process.env.AI_ENABLED, false),
  provider: process.env.AI_PROVIDER || 'gemini',
  serviceUrl: process.env.AI_SERVICE_URL || '',
  timeoutMs: parseInt(process.env.AI_SERVICE_TIMEOUT_MS || '20000', 10),
  apiKey: process.env.AI_SERVICE_API_KEY || '',
  openAiBaseUrl: process.env.OPENAI_BASE_URL || '',
  openAiApiKey: process.env.NINE_ROUTER_API_KEY || process.env.OPENAI_API_KEY || '',
  openAiModel: process.env.OPENAI_MODEL || 'main',
  openAiWireApi: process.env.OPENAI_WIRE_API || 'chat',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  confidenceThreshold: parseFloat(process.env.AI_CONFIDENCE_THRESHOLD || '0.72'),
  faqFile: process.env.AI_FAQ_FILE || 'documents/ai/faq.vi.jsonl',
  maxContextChunks: parseInt(process.env.AI_MAX_CONTEXT_CHUNKS || '6', 10),
}));
