import { registerAs } from '@nestjs/config';

export default registerAs('tuya', () => ({
  accessId: process.env.TUYA_ACCESS_ID,
  accessSecret: process.env.TUYA_ACCESS_SECRET,
  apiEndpoint: process.env.TUYA_API_ENDPOINT || 'https://openapi.tuyaus.com',
}));
