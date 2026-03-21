import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);

  onModuleInit() {
    if (admin.apps.length > 0) return;

    const keyPath = path.resolve(
      process.cwd(),
      'config',
      'firebase-service-account.json',
    );

    if (!fs.existsSync(keyPath)) {
      this.logger.warn(
        `Firebase key not found at ${keyPath} — push notifications disabled`,
      );
      return;
    }

    admin.initializeApp({
      credential: admin.credential.cert(keyPath),
    });

    this.logger.log('🔥 Firebase Admin initialized');
  }

  private get messaging(): admin.messaging.Messaging | null {
    if (admin.apps.length === 0) return null;
    return admin.messaging();
  }

  /**
   * Send push notification to a single device.
   * Returns true if successful, false otherwise.
   */
  async sendToDevice(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    if (!this.messaging) return false;

    try {
      await this.messaging.send({
        token,
        notification: { title, body },
        data,
        android: {
          priority: 'high',
          notification: { sound: 'default', channelId: 'default' },
        },
        apns: {
          payload: { aps: { sound: 'default', badge: 1 } },
        },
      });
      return true;
    } catch (error: any) {
      this.logger.warn(`FCM send failed [${token.slice(0, 12)}...]: ${error.message}`);
      return false;
    }
  }

  /**
   * Send push notification to multiple devices.
   * Returns array of { token, success } results.
   */
  async sendToMultipleDevices(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ token: string; success: boolean }[]> {
    if (!this.messaging || tokens.length === 0) {
      return tokens.map((t) => ({ token: t, success: false }));
    }

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: { title, body },
      data,
      android: {
        priority: 'high',
        notification: { sound: 'default', channelId: 'default' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    };

    try {
      const response = await this.messaging.sendEachForMulticast(message);

      return response.responses.map((res, idx) => ({
        token: tokens[idx],
        success: res.success,
      }));
    } catch (error: any) {
      this.logger.error(`FCM multicast failed: ${error.message}`);
      return tokens.map((t) => ({ token: t, success: false }));
    }
  }

  /**
   * Send push notification to a topic.
   */
  async sendToTopic(
    topic: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    if (!this.messaging) return false;

    try {
      await this.messaging.send({
        topic,
        notification: { title, body },
        data,
      });
      return true;
    } catch (error: any) {
      this.logger.error(`FCM topic send failed [${topic}]: ${error.message}`);
      return false;
    }
  }
}
