import { registerAs } from '@nestjs/config';

export default registerAs('supabase', () => ({
  url: process.env.SUPABASE_URL || '',
  anonKey: process.env.SUPABASE_ANON_KEY || '',
  enabled: process.env.SUPABASE_ENABLED === 'true',
  chatImagesBucket: process.env.SUPABASE_CHAT_IMAGES_BUCKET || 'chat-images',
  redirectUrl:
    process.env.SUPABASE_REDIRECT_URL || 'http://localhost:3000/auth/callback',
  allowedRedirectUrls: (process.env.SUPABASE_ALLOWED_REDIRECT_URLS || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean),
}));
