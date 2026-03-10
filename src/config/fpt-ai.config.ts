import { registerAs } from '@nestjs/config';

export default registerAs('fptAi', () => ({
  apiKey: process.env.FPT_AI_API_KEY || '',
  apiUrl: process.env.FPT_AI_API_URL || 'https://api.fpt.ai/vision/idr/vnm/',
  enabled: process.env.FPT_AI_ENABLED === 'true' || true,
  autoVerifyOnSuccess: process.env.FPT_AI_AUTO_VERIFY === 'true' || true,
}));
