export default () => ({
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '', // Your Twilio phone number (e.g., +1234567890)
    enabled: process.env.TWILIO_ENABLED === 'true',
  },
});
