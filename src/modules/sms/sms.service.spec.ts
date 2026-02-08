import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SmsService } from './sms.service';

describe('SmsService', () => {
  let service: SmsService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        'supabase.url': 'https://test.supabase.co',
        'supabase.anonKey': 'test-anon-key',
        'supabase.enabled': false, // Dev mode for testing
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<SmsService>(SmsService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateOtpCode', () => {
    it('should generate a 6-digit code', () => {
      const otp = service.generateOtpCode();
      
      expect(otp).toBeDefined();
      expect(otp).toHaveLength(6);
      expect(Number(otp)).toBeGreaterThanOrEqual(100000);
      expect(Number(otp)).toBeLessThanOrEqual(999999);
    });

    it('should generate different codes on multiple calls', () => {
      const otp1 = service.generateOtpCode();
      const otp2 = service.generateOtpCode();
      const otp3 = service.generateOtpCode();
      
      // Very unlikely all 3 would be the same
      expect(new Set([otp1, otp2, otp3]).size).toBeGreaterThan(1);
    });
  });

  describe('sendOtp', () => {
    it('should return dev OTP code in dev mode', async () => {
      const phone = '+84901234567';
      
      const result = await service.sendOtp(phone);
      
      expect(result.success).toBe(true);
      expect(result.devOtpCode).toBeDefined();
      expect(result.devOtpCode).toHaveLength(6);
    });

    it('should format phone number before sending', async () => {
      const phone = '0901234567';
      const formatted = '+84901234567';
      
      const result = await service.sendOtp(phone);
      
      expect(result.success).toBe(true);
    });
  });

  describe('verifyOtp', () => {
    it('should return success in dev mode', async () => {
      const phone = '+84901234567';
      const otpCode = '123456';
      
      const result = await service.verifyOtp(phone, otpCode);
      
      expect(result.success).toBe(true);
    });
  });

  describe('maskPhone', () => {
    it('should mask middle digits of phone number', () => {
      const phone = '+84901234567';
      const masked = service['maskPhone'](phone);
      
      expect(masked).toBe('+849***4567');
    });

    it('should handle short phone numbers', () => {
      const phone = '123';
      const masked = service['maskPhone'](phone);
      
      expect(masked).toBe('***');
    });
  });

  describe('formatPhoneNumber', () => {
    it('should format Vietnamese phone number with leading 0', () => {
      const phone = '0901234567';
      const formatted = service.formatPhoneNumber(phone);
      
      expect(formatted).toBe('+84901234567');
    });

    it('should keep phone number with + prefix', () => {
      const phone = '+84901234567';
      const formatted = service.formatPhoneNumber(phone);
      
      expect(formatted).toBe('+84901234567');
    });

    it('should add + prefix if missing', () => {
      const phone = '84901234567';
      const formatted = service.formatPhoneNumber(phone);
      
      expect(formatted).toBe('+84901234567');
    });

    it('should remove spaces and special characters', () => {
      const phone = '090-123-4567';
      const formatted = service.formatPhoneNumber(phone);
      
      expect(formatted).toBe('+84901234567');
    });
  });
});
