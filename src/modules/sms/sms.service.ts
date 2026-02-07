import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from '../../queue/queue.module';
import { Twilio } from 'twilio';

export interface SendSmsPayload {
  phone: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface OtpSmsPayload {
  phone: string;
  otpCode: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private twilioClient: Twilio | null = null;

  constructor(
    @InjectQueue(QUEUE_NAMES.SMS) private readonly smsQueue: Queue,
    private readonly configService: ConfigService,
  ) {
    // Initialize Twilio client if credentials are provided
    const accountSid = this.configService.get<string>('twilio.accountSid');
    const authToken = this.configService.get<string>('twilio.authToken');
    const enabled = this.configService.get<boolean>('twilio.enabled');

    if (enabled && accountSid && authToken) {
      this.twilioClient = new Twilio(accountSid, authToken);
      this.logger.log('Twilio client initialized successfully');
    } else {
      this.logger.warn(
        'Twilio credentials not configured. SMS will be logged only (dev mode).',
      );
    }
  }

  /**
   * Generate a random 6-digit OTP code
   */
  generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send OTP via SMS
   */
  async sendOtpSms(payload: OtpSmsPayload): Promise<void> {
    const message = `[IntelliRentOps] Ma xac thuc OTP cua ban la: ${payload.otpCode}. Ma co hieu luc trong 5 phut. Vui long khong chia se ma nay voi bat ky ai.`;

    await this.queueSms({
      phone: payload.phone,
      message,
      metadata: {
        type: 'otp',
        otpCode: payload.otpCode,
      },
    });

    const maskedPhone = this.maskPhone(payload.phone);
    this.logger.log(`OTP SMS queued for phone: ${maskedPhone}`);
  }

  /**
   * Queue SMS for sending
   */
  async queueSms(payload: SendSmsPayload): Promise<void> {
    await this.smsQueue.add('send-sms', payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  /**
   * Mask phone number for logging (e.g., 0901234567 -> 090***4567)
   */
  private maskPhone(phone: string): string {
    if (phone.length <= 6) return '***';
    return phone.slice(0, 3) + '***' + phone.slice(-4);
  }

  /**
   * Send SMS directly via Twilio (for processor)
   */
  async sendSmsDirectly(payload: SendSmsPayload): Promise<boolean> {
    const maskedPhone = this.maskPhone(payload.phone);

    try {
      // If Twilio is configured, use it
      if (this.twilioClient) {
        const fromNumber = this.configService.get<string>('twilio.phoneNumber');

        if (!fromNumber) {
          throw new Error('Twilio phone number not configured');
        }

        // Format phone number for international format (add +84 for Vietnam)
        const formattedPhone = this.formatPhoneNumber(payload.phone);

        const message = await this.twilioClient.messages.create({
          body: payload.message,
          from: fromNumber,
          to: formattedPhone,
        });

        this.logger.log(
          `SMS sent via Twilio to ${maskedPhone}. SID: ${message.sid}, Status: ${message.status}`,
        );

        return true;
      }

      // Fallback: Development mode - just log
      const truncatedMessage = payload.message.substring(0, 50);
      this.logger.log(`[DEV MODE] SMS to ${maskedPhone}: ${truncatedMessage}...`);

      if (this.configService.get('app.nodeEnv') === 'development') {
        this.logger.debug(`[DEV] Full SMS Content: ${payload.message}`);
      }

      return true;
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${maskedPhone}:`, error);
      throw error;
    }
  }

  /**
   * Format phone number to international format
   * @param phone - Phone number (e.g., 0901234567)
   * @returns International format (e.g., +84901234567)
   */
  private formatPhoneNumber(phone: string): string {
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
