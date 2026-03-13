import { registerAs } from '@nestjs/config';

export default registerAs('fptAi', () => ({
  apiKey: process.env.FPT_AI_API_KEY || process.env.FPT_API_KEY || '',
  apiUrl:
    process.env.FPT_AI_API_URL ||
    process.env.FPT_API_URL ||
    'https://api.fpt.ai/vision/idr/vnm/',
  enabled:
    process.env.FPT_AI_ENABLED === undefined
      ? true
      : process.env.FPT_AI_ENABLED === 'true',
  autoVerifyOnSuccess:
    process.env.FPT_AI_AUTO_VERIFY === undefined
      ? true
      : process.env.FPT_AI_AUTO_VERIFY === 'true',
}));
