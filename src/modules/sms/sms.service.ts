import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private supabase: SupabaseClient | null = null;
  private supabaseEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    // Initialize Supabase client
    const supabaseUrl = this.configService.get<string>('supabase.url');
    const supabaseAnonKey = this.configService.get<string>('supabase.anonKey');
    this.supabaseEnabled =
      this.configService.get<boolean>('supabase.enabled') || false;

    if (this.supabaseEnabled && supabaseUrl && supabaseAnonKey) {
      this.supabase = createClient(supabaseUrl, supabaseAnonKey);
      this.logger.log('Supabase Auth OTP configured successfully');
    } else {
      this.logger.warn(
        'Supabase not configured. OTP will be logged only (dev mode).',
      );
    }
  }

  /**
   * Generate a random 6-digit OTP code (used in dev mode only)
   */
  generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send OTP via Supabase Auth signInWithOtp
   * Supabase handles OTP generation, sending SMS, and rate limiting
   */
  async sendOtp(
    phone: string,
  ): Promise<{ success: boolean; devOtpCode?: string }> {
    const formattedPhone = this.formatPhoneNumber(phone);
    const maskedPhone = this.maskPhone(formattedPhone);

    if (this.supabaseEnabled && this.supabase) {
      this.logger.log(`Sending OTP to ${maskedPhone} via Supabase Auth...`);

      const { data, error } = await this.supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });

      if (error) {
        this.logger.error(`Supabase OTP error: ${error.message}`);
        throw new Error(`Failed to send OTP: ${error.message}`);
      }

      this.logger.log(`✓ OTP sent via Supabase to ${maskedPhone}`);
      return { success: true };
    }

    // Dev mode: generate and log OTP (not actually sent)
    const devOtpCode = this.generateOtpCode();
    this.logger.log(`[DEV MODE] OTP for ${maskedPhone}: ${devOtpCode}`);
    return { success: true, devOtpCode };
  }

  /**
   * Verify OTP via Supabase Auth verifyOtp
   */
  async verifyOtp(
    phone: string,
    otpCode: string,
  ): Promise<{ success: boolean; supabaseUserId?: string }> {
    const formattedPhone = this.formatPhoneNumber(phone);
    const maskedPhone = this.maskPhone(formattedPhone);

    if (this.supabaseEnabled && this.supabase) {
      this.logger.log(`Verifying OTP for ${maskedPhone} via Supabase Auth...`);

      const { data, error } = await this.supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otpCode,
        type: 'sms',
      });

      if (error) {
        this.logger.error(`Supabase OTP verification error: ${error.message}`);
        throw new Error(`OTP verification failed: ${error.message}`);
      }

      this.logger.log(`✓ OTP verified for ${maskedPhone}`);
      return {
        success: true,
        supabaseUserId: data.user?.id,
      };
    }

    // Dev mode: always return success (OTP was logged to console)
    this.logger.log(`[DEV MODE] OTP verified for ${maskedPhone}`);
    return { success: true };
  }

  /**
   * Mask phone number for logging (e.g., +84901234567 -> +849***4567)
   */
  private maskPhone(phone: string): string {
    if (phone.length <= 6) return '***';
    return phone.slice(0, 4) + '***' + phone.slice(-4);
  }

  /**
   * Format phone number to international format
   * @param phone - Phone number (e.g., 0901234567)
   * @returns International format (e.g., +84901234567)
   */
  formatPhoneNumber(phone: string): string {
    // Remove all spaces and special characters
    phone = phone.replace(/[\s\-\(\)]/g, '');

    // Remove leading 0 if exists and add Vietnam country code
    if (phone.startsWith('0')) {
      return '+84' + phone.substring(1);
    }
    // If already has +, return as is
    if (phone.startsWith('+')) {
      return phone;
    }
    // Otherwise add +84
    return '+84' + phone;
  }
}
