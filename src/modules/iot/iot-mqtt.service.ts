import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, type MqttClient } from 'mqtt';
import {
  type IoTMqttGatewayStatus,
  type IoTMqttPublishResult,
  type MqttControlType,
} from './iot-mqtt.types';

const MQTT_STATUS_TOPIC_DEFAULT = 'HOMEIQ/+/status';
const MQTT_RECONNECT_PERIOD_MS = 2000;
const MQTT_CONNECT_TIMEOUT_MS = 10_000;
const DEFAULT_TEST_HOLD_MS = 2000;

@Injectable()
export class IoTMqttService implements OnModuleDestroy {
  private readonly logger = new Logger(IoTMqttService.name);
  private readonly brokerUrl: string | null;
  private readonly statusTopic: string;
  private readonly runningTestSequences = new Set<string>();
  private client: MqttClient | null = null;

  constructor(private readonly configService: ConfigService) {
    this.brokerUrl = this.configService.get<string>('MQTT_BROKER_URL') ?? null;
    this.statusTopic =
      this.configService.get<string>('MQTT_STATUS_TOPIC') ??
      MQTT_STATUS_TOPIC_DEFAULT;

    if (!this.brokerUrl) {
      this.logger.warn(
        'MQTT_BROKER_URL is not configured. MQTT control endpoints will be unavailable.',
      );
      return;
    }

    this.client = connect(this.brokerUrl, {
      reconnectPeriod: MQTT_RECONNECT_PERIOD_MS,
      connectTimeout: MQTT_CONNECT_TIMEOUT_MS,
    });

    this.client.on('connect', () => {
      this.logger.log(`Connected to MQTT broker ${this.brokerUrl}`);
      this.client?.subscribe(this.statusTopic, (error) => {
        if (error) {
          this.logger.error(
            `Failed to subscribe to MQTT status topic ${this.statusTopic}: ${error.message}`,
          );
          return;
        }

        this.logger.log(`Subscribed to MQTT status topic ${this.statusTopic}`);
      });
    });

    this.client.on('reconnect', () => {
      this.logger.warn('Reconnecting to MQTT broker...');
    });

    this.client.on('error', (error) => {
      this.logger.error(`MQTT error: ${error.message}`);
    });

    this.client.on('message', (topic, message) => {
      const payload = message.toString();
      this.logger.debug(`MQTT message received on ${topic}: ${payload}`);
    });
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.end(true);
    }
  }

  getGatewayStatus(): IoTMqttGatewayStatus {
    return {
      success: true,
      mqttConnected: Boolean(this.client?.connected),
      brokerUrl: this.brokerUrl,
      statusTopic: this.statusTopic,
    };
  }

  triggerLight(
    espId: string,
    action: string,
    lightId: number,
  ): IoTMqttPublishResult {
    this.validateBinaryAction(action, 'light');
    return this.publish(espId, 'light', lightId, action, `light_${lightId}`);
  }

  triggerAlarm(
    espId: string,
    action: string,
    alarmId: number,
  ): IoTMqttPublishResult {
    this.validateBinaryAction(action, 'alarm');
    return this.publish(espId, 'alarm', alarmId, action, `alarm_${alarmId}`);
  }

  triggerDoor(
    espId: string,
    action: string,
    doorId: number,
  ): IoTMqttPublishResult {
    this.validateOpenCloseAction(action, 'door');
    return this.publish(espId, 'door', doorId, action, `door_${doorId}`);
  }

  triggerCurtain(
    espId: string,
    action: string,
    curtainId: number,
  ): IoTMqttPublishResult {
    this.validateOpenCloseAction(action, 'curtain');
    return this.publish(
      espId,
      'curtain',
      curtainId,
      action,
      `curtain_${curtainId}`,
    );
  }

  sendDoorPassword(
    espId: string,
    doorId: number,
    password: string,
  ): IoTMqttPublishResult {
    const normalizedPassword = password.trim();
    if (!normalizedPassword) {
      throw new BadRequestException('password is required');
    }

    return this.publishRaw(
      espId,
      'get/door-password',
      normalizedPassword,
      'door',
      doorId,
    );
  }

  async runTestSequence(
    espId: string,
    holdMs?: number,
  ): Promise<{
    success: boolean;
    message: string;
    holdMs: number;
    totalSteps: number;
    steps: Array<{
      order: number;
      action: string;
      details: IoTMqttPublishResult;
    }>;
  }> {
    const normalizedEspId = this.normalizeEspId(espId);
    if (this.runningTestSequences.has(normalizedEspId)) {
      throw new ConflictException(
        `A test sequence is already running for ${normalizedEspId}`,
      );
    }

    const waitTime =
      typeof holdMs === 'number' && holdMs > 0 ? holdMs : DEFAULT_TEST_HOLD_MS;

    const sequence = [
      { name: 'LIGHT_1_ON', run: () => this.triggerLight(normalizedEspId, 'on', 1) },
      { name: 'LIGHT_1_OFF', run: () => this.triggerLight(normalizedEspId, 'off', 1) },
      { name: 'LIGHT_2_ON', run: () => this.triggerLight(normalizedEspId, 'on', 2) },
      { name: 'LIGHT_2_OFF', run: () => this.triggerLight(normalizedEspId, 'off', 2) },
      { name: 'ALARM_1_ON', run: () => this.triggerAlarm(normalizedEspId, 'on', 1) },
      { name: 'ALARM_1_OFF', run: () => this.triggerAlarm(normalizedEspId, 'off', 1) },
      {
        name: 'CURTAIN_1_OPEN',
        run: () => this.triggerCurtain(normalizedEspId, 'open', 1),
      },
      {
        name: 'CURTAIN_1_CLOSE',
        run: () => this.triggerCurtain(normalizedEspId, 'close', 1),
      },
      { name: 'DOOR_1_OPEN', run: () => this.triggerDoor(normalizedEspId, 'open', 1) },
      {
        name: 'DOOR_1_CLOSE',
        run: () => this.triggerDoor(normalizedEspId, 'close', 1),
      },
    ];

    const steps: Array<{
      order: number;
      action: string;
      details: IoTMqttPublishResult;
    }> = [];

    this.runningTestSequences.add(normalizedEspId);

    try {
      for (let index = 0; index < sequence.length; index++) {
        const item = sequence[index];
        steps.push({
          order: index + 1,
          action: item.name,
          details: item.run(),
        });

        if (index < sequence.length - 1) {
          await this.sleep(waitTime);
        }
      }

      return {
        success: true,
        message: 'Test sequence completed',
        holdMs: waitTime,
        totalSteps: steps.length,
        steps,
      };
    } finally {
      this.runningTestSequences.delete(normalizedEspId);
    }
  }

  private publish(
    espId: string,
    controlType: MqttControlType,
    channelId: number,
    action: string,
    label: string,
  ): IoTMqttPublishResult {
    const payload = `${action}_${channelId}`;
    return this.publishRaw(espId, controlType, payload, controlType, channelId);
  }

  private publishRaw(
    espId: string,
    topicSuffix: string,
    payload: string,
    controlType: MqttControlType,
    channelId: number,
  ): IoTMqttPublishResult {
    const normalizedEspId = this.normalizeEspId(espId);
    const normalizedChannelId = this.normalizeChannelId(channelId);
    const topic = `${normalizedEspId}/${topicSuffix}`;

    this.ensureConnected();
    this.client!.publish(topic, payload);

    return {
      brokerUrl: this.brokerUrl,
      topic,
      payload,
      espId: normalizedEspId,
      controlType,
      channelId: normalizedChannelId,
      publishedAt: new Date(),
    };
  }

  private ensureConnected() {
    if (!this.brokerUrl) {
      throw new ServiceUnavailableException(
        'MQTT_BROKER_URL is not configured',
      );
    }

    if (!this.client?.connected) {
      throw new ServiceUnavailableException(
        'MQTT client is not connected yet',
      );
    }
  }

  private normalizeEspId(espId: string): string {
    const normalized = espId.trim();
    if (!normalized) {
      throw new BadRequestException('espId is required');
    }

    return normalized;
  }

  private normalizeChannelId(channelId: number): number {
    if (!Number.isInteger(channelId) || channelId <= 0) {
      throw new BadRequestException('device channel id must be a positive integer');
    }

    return channelId;
  }

  private validateBinaryAction(action: string, controlType: string) {
    if (action !== 'on' && action !== 'off') {
      throw new BadRequestException(
        `${controlType} action must be 'on' or 'off'`,
      );
    }
  }

  private validateOpenCloseAction(action: string, controlType: string) {
    if (action !== 'open' && action !== 'close') {
      throw new BadRequestException(
        `${controlType} action must be 'open' or 'close'`,
      );
    }
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
