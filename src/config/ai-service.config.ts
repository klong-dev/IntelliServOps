import { registerAs } from '@nestjs/config';

function parseBoolean(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export default registerAs('aiService', () => ({
  enabled: parseBoolean(process.env.AI_ENABLED, false),
  provider: process.env.AI_PROVIDER || 'service',
  serviceUrl: process.env.AI_SERVICE_URL || '',
  timeoutMs: parseInt(process.env.AI_SERVICE_TIMEOUT_MS || '20000', 10),
  apiKey: process.env.AI_SERVICE_API_KEY || '',
  faqFile: process.env.AI_FAQ_FILE || 'documents/ai/faq.vi.jsonl',
  maxContextChunks: parseInt(process.env.AI_MAX_CONTEXT_CHUNKS || '6', 10),
}));
