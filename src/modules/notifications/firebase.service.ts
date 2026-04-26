import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private firebaseKeyPath: string | null = null;
  private firebaseProjectId: string | null = null;
  private firebaseClientEmail: string | null = null;

  onModuleInit() {
    if (admin.apps.length > 0) {
      this.captureExistingAppDiagnostics();
      return;
    }

    const keyPath = path.resolve(
      process.cwd(),
      'config',
      'firebase-service-account.json',
    );

    if (!fs.existsSync(keyPath)) {
      this.logger.warn(
        `Firebase key not found at ${keyPath} - push notifications disabled`,
      );
      return;
    }

    const serviceAccount = JSON.parse(
      fs.readFileSync(keyPath, 'utf8'),
    ) as admin.ServiceAccount & {
      project_id?: string;
      client_email?: string;
    };

    this.firebaseKeyPath = keyPath;
    this.firebaseProjectId = serviceAccount.project_id ?? null;
    this.firebaseClientEmail = serviceAccount.client_email ?? null;

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: this.firebaseProjectId ?? undefined,
    });

    this.logger.log(
      `Firebase Admin initialized with projectId=${this.firebaseProjectId ?? 'unknown'} clientEmail=${this.firebaseClientEmail ?? 'unknown'}`,
    );
  }

  getDiagnostics() {
    return {
      initialized: admin.apps.length > 0,
      keyPath: this.firebaseKeyPath,
      projectId: this.firebaseProjectId,
      clientEmail: this.firebaseClientEmail,
      appProjectId:
        admin.apps.length > 0 ? (admin.app().options.projectId ?? null) : null,
    };
  }

  private get messaging(): admin.messaging.Messaging | null {
    if (admin.apps.length === 0) return null;
    return admin.messaging();
  }

  private captureExistingAppDiagnostics() {
    const app = admin.app();
    this.firebaseProjectId = app.options.projectId ?? this.firebaseProjectId;
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
      this.logger.warn(
        `FCM send failed [${token.slice(0, 12)}...]: ${error.message}`,
      );
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
  ): Promise<
    {
      token: string;
      success: boolean;
      errorCode?: string;
      errorMessage?: string;
    }[]
  > {
    if (tokens.length === 0) {
      return [];
    }

    if (!this.messaging) {
      return tokens.map((t) => ({
        token: t,
        success: false,
        errorCode: 'firebase/not-initialized',
        errorMessage: 'Firebase Admin SDK is not initialized',
      }));
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
        ...(res.error?.code ? { errorCode: res.error.code } : {}),
        ...(res.error?.message ? { errorMessage: res.error.message } : {}),
      }));
    } catch (error: any) {
      this.logger.error(`FCM multicast failed: ${error.message}`);
      return tokens.map((t) => ({
        token: t,
        success: false,
        errorCode: error.code ?? 'firebase/multicast-failed',
        errorMessage: error.message,
      }));
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
