import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { connect, type MqttClient } from 'mqtt';
import {
  MQTT_BINARY_ACTIONS,
  MQTT_DEVICE_TOPICS,
  type IoTMqttGatewayStatus,
  type IoTMqttControlAckResult,
  type IoTMqttPublishResult,
  type IoTMqttSignalResult,
  type IoTMqttStatusEvent,
  type IoTMqttTelemetryEvent,
  type MqttBinaryAction,
  type MqttDeviceTopic,
} from './iot-mqtt.types';

const MQTT_STATUS_TOPIC_DEFAULT = 'HOMEIQ/+/status';
const MQTT_TELEMETRY_TOPIC_DEFAULT = 'HOMEIQ/+/telemetry';
const MQTT_RECONNECT_PERIOD_MS = 2000;
const MQTT_CONNECT_TIMEOUT_MS = 10_000;
const MQTT_SUBSCRIBE_QOS = 1;
const DEFAULT_TEST_HOLD_MS = 2000;
const DEFAULT_CONTROL_ACK_TIMEOUT_MS = 5000;
const MQTT_ALLOW_DEFAULT_DOOR_PASSWORD_FALLBACK = 'MQTT_ALLOW_DEFAULT_DOOR_PASSWORD_FALLBACK';

const MQTT_GET_DOOR_PASSWORD_TOPIC = 'get/door-password';
const MQTT_GET_TELEMETRY_TOPIC = 'get/telemetry';

const MQTT_MESSAGE_GET_TELEMETRY = 'GET_TELEMETRY';
const MQTT_MESSAGE_GET_DOOR_PASSWORD = 'GET_DOOR_PASSWORD';
const MQTT_MESSAGE_HEALTH_CHECK = 'ARE_YOU_OK';
const MQTT_MESSAGE_FIRE = 'FIRE';
const MQTT_MESSAGE_FIRE_ACK = 'FIRE_ACK';
const MQTT_MESSAGE_ONLINE = 'ONLINE';

@Injectable()
export class IoTMqttService implements OnModuleDestroy {
  private readonly logger = new Logger(IoTMqttService.name);
  private readonly brokerUrl: string | null;
  private readonly statusTopic: string;
  private readonly telemetryTopic: string;
  private readonly defaultDoorPassword: string | null;
  private readonly allowDefaultDoorPasswordFallback: boolean;
  private readonly runningTestSequences = new Set<string>();
  private client: MqttClient | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.brokerUrl = this.configService.get<string>('MQTT_BROKER_URL') ?? null;
    this.statusTopic =
      this.configService.get<string>('MQTT_STATUS_TOPIC') ??
      MQTT_STATUS_TOPIC_DEFAULT;
    this.telemetryTopic =
      this.configService.get<string>('MQTT_TELEMETRY_TOPIC') ??
      MQTT_TELEMETRY_TOPIC_DEFAULT;
    this.defaultDoorPassword =
      this.configService.get<string>('DEFAULT_DOOR_PASSWORD')?.trim() || null;
    this.allowDefaultDoorPasswordFallback =
      this.configService.get<string>(MQTT_ALLOW_DEFAULT_DOOR_PASSWORD_FALLBACK) ===
      'true';

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

      [this.statusTopic, this.telemetryTopic].forEach((topic) => {
        this.client?.subscribe(topic, { qos: MQTT_SUBSCRIBE_QOS }, (error) => {
          if (error) {
            this.logger.error(
              `Failed to subscribe to MQTT topic ${topic}: ${error.message}`,
            );
            return;
          }

          this.logger.log(
            `Subscribed to MQTT topic ${topic} with QoS ${MQTT_SUBSCRIBE_QOS}`,
          );
        });
      });
    });

    this.client.on('reconnect', () => {
      this.logger.warn('Reconnecting to MQTT broker...');
    });

    this.client.on('error', (error) => {
      this.logger.error(`MQTT error: ${error.message}`);
    });

    this.client.on('message', (topic, message) => {
      this.handleIncomingMessage(topic, message.toString());
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
      telemetryTopic: this.telemetryTopic,
    };
  }

  controlDevice(
    espId: string,
    action: string,
    deviceId: number,
    topic: MqttDeviceTopic,
  ): IoTMqttPublishResult {
    const normalizedEspId = this.normalizeEspId(espId);
    const normalizedTopic = this.normalizeDeviceTopic(topic);
    const normalizedAction = this.normalizeBinaryAction(action);
    const normalizedDeviceId = this.normalizeDeviceId(deviceId);

    return this.publishDeviceCommand(
      normalizedEspId,
      normalizedTopic,
      normalizedDeviceId,
      normalizedAction,
    );
  }

  async controlDeviceAndWaitForAck(
    espId: string,
    action: string,
    deviceId: number,
    topic: MqttDeviceTopic,
    timeoutMs = DEFAULT_CONTROL_ACK_TIMEOUT_MS,
  ): Promise<IoTMqttControlAckResult> {
    const normalizedEspId = this.normalizeEspId(espId);
    const normalizedTopic = this.normalizeDeviceTopic(topic);
    const normalizedAction = this.normalizeBinaryAction(action);
    const normalizedDeviceId = this.normalizeDeviceId(deviceId);

    return new Promise<IoTMqttControlAckResult>((resolve, reject) => {
      let dispatch: IoTMqttPublishResult;
      let timer: NodeJS.Timeout | null = null;

      const handler = (event: IoTMqttStatusEvent) => {
        if (
          event.espId !== normalizedEspId ||
          event.deviceTopic !== normalizedTopic ||
          event.deviceId !== normalizedDeviceId
        ) {
          return;
        }

        cleanup();
        resolve({
          dispatch,
          statusEvent: event,
          timeoutMs,
          timedOut: false,
        });
      };

      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
        }
        this.eventEmitter.off('iot.mqtt.status', handler);
      };

      this.eventEmitter.on('iot.mqtt.status', handler);

      try {
        dispatch = this.publishDeviceCommand(
          normalizedEspId,
          normalizedTopic,
          normalizedDeviceId,
          normalizedAction,
        );
      } catch (error) {
        cleanup();
        reject(error);
        return;
      }

      timer = setTimeout(() => {
        cleanup();
        resolve({
          dispatch,
          statusEvent: null,
          timeoutMs,
          timedOut: true,
        });
      }, timeoutMs);
    });
  }

  async sendDoorPasswordAndWaitForAck(
    espId: string,
    doorId: number,
    password: string,
    timeoutMs = DEFAULT_CONTROL_ACK_TIMEOUT_MS,
  ): Promise<{
    dispatch: IoTMqttSignalResult & { doorId: number; password: string };
    statusEvent: IoTMqttStatusEvent | null;
    timeoutMs: number;
    timedOut: boolean;
  }> {
    const normalizedEspId = this.normalizeEspId(espId);
    const normalizedDoorId = this.normalizeDeviceId(doorId);

    return new Promise((resolve, reject) => {
      let dispatch: IoTMqttSignalResult & { doorId: number; password: string };
      let timer: NodeJS.Timeout | null = null;

      const handler = (event: IoTMqttStatusEvent) => {
        if (
          event.espId !== normalizedEspId ||
          event.type !== 'door_pin_update' ||
          event.deviceTopic !== 'door'
        ) {
          return;
        }

        if (
          event.deviceId !== undefined &&
          event.deviceId !== normalizedDoorId
        ) {
          return;
        }

        cleanup();
        resolve({
          dispatch,
          statusEvent: event,
          timeoutMs,
          timedOut: false,
        });
      };

      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
        }
        this.eventEmitter.off('iot.mqtt.status', handler);
      };

      this.eventEmitter.on('iot.mqtt.status', handler);

      try {
        dispatch = this.sendDoorPassword(
          normalizedEspId,
          normalizedDoorId,
          password,
        );
      } catch (error) {
        cleanup();
        reject(error);
        return;
      }

      timer = setTimeout(() => {
        cleanup();
        resolve({
          dispatch,
          statusEvent: null,
          timeoutMs,
          timedOut: true,
        });
      }, timeoutMs);
    });
  }

  waitForStatusEvent(
    matcher: (event: IoTMqttStatusEvent) => boolean,
    timeoutMs = DEFAULT_CONTROL_ACK_TIMEOUT_MS,
  ): Promise<IoTMqttStatusEvent | null> {
    return new Promise<IoTMqttStatusEvent | null>((resolve) => {
      let timer: NodeJS.Timeout | null = null;

      const handler = (event: IoTMqttStatusEvent) => {
        if (!matcher(event)) {
          return;
        }

        cleanup();
        resolve(event);
      };

      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
        }
        this.eventEmitter.off('iot.mqtt.status', handler);
      };

      this.eventEmitter.on('iot.mqtt.status', handler);

      timer = setTimeout(() => {
        cleanup();
        resolve(null);
      }, timeoutMs);
    });
  }

  triggerLight(
    espId: string,
    action: string,
    lightId: number,
  ): IoTMqttPublishResult {
    return this.controlDevice(espId, action, lightId, 'light');
  }

  triggerAlarm(
    espId: string,
    action: string,
    alarmId: number,
  ): IoTMqttPublishResult {
    return this.controlDevice(espId, action, alarmId, 'alarm');
  }

  triggerDoor(
    espId: string,
    action: string,
    doorId: number,
  ): IoTMqttPublishResult {
    return this.controlDevice(espId, action, doorId, 'door');
  }

  triggerCurtain(
    espId: string,
    action: string,
    curtainId: number,
  ): IoTMqttPublishResult {
    return this.controlDevice(espId, action, curtainId, 'curtain');
  }

  sendDoorPassword(
    espId: string,
    doorId: number,
    password: string,
  ): IoTMqttSignalResult & { doorId: number; password: string } {
    const normalizedEspId = this.normalizeEspId(espId);
    const normalizedDoorId = this.normalizeDeviceId(doorId);
    const normalizedPassword = password.trim();

    if (!normalizedPassword) {
      throw new BadRequestException('password is required');
    }

    return {
      ...this.publishSignal(
        `${normalizedEspId}/${MQTT_GET_DOOR_PASSWORD_TOPIC}`,
        normalizedPassword,
        normalizedEspId,
      ),
      password: normalizedPassword,
      doorId: normalizedDoorId,
    };
  }

  getTelemetry(espId: string): IoTMqttSignalResult {
    const normalizedEspId = this.normalizeEspId(espId);

    return this.publishSignal(
      `${normalizedEspId}/${MQTT_GET_TELEMETRY_TOPIC}`,
      MQTT_MESSAGE_GET_TELEMETRY,
      normalizedEspId,
    );
  }

  checkOnline(espId: string): IoTMqttSignalResult {
    const normalizedEspId = this.normalizeEspId(espId);

    return this.publishSignal(
      `HOMEIQ/${normalizedEspId}/status`,
      MQTT_MESSAGE_HEALTH_CHECK,
      normalizedEspId,
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

    const sequence: Array<{
      topic: MqttDeviceTopic;
      deviceId: number;
      action: MqttBinaryAction;
    }> = [
      { topic: 'light', deviceId: 1, action: 'ON' },
      { topic: 'light', deviceId: 1, action: 'OFF' },
      { topic: 'light', deviceId: 2, action: 'ON' },
      { topic: 'light', deviceId: 2, action: 'OFF' },
      { topic: 'alarm', deviceId: 1, action: 'ON' },
      { topic: 'alarm', deviceId: 1, action: 'OFF' },
      { topic: 'curtain', deviceId: 1, action: 'ON' },
      { topic: 'curtain', deviceId: 1, action: 'OFF' },
      { topic: 'door', deviceId: 1, action: 'ON' },
      { topic: 'door', deviceId: 1, action: 'OFF' },
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
          action: `${item.topic}_${item.deviceId}_${item.action}`,
          details: this.controlDevice(
            normalizedEspId,
            item.action,
            item.deviceId,
            item.topic,
          ),
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

  private handleIncomingMessage(topic: string, message: string) {
    this.logger.debug(`MQTT message received on ${topic}: ${message}`);
    const receivedAt = new Date();

    if (this.isTelemetryTopic(topic)) {
      const telemetryEvent = this.buildTelemetryEvent(
        topic,
        message,
        receivedAt,
      );
      this.logger.log(
        `[METER] espId=${telemetryEvent.espId}, message=${telemetryEvent.message}`,
      );
      this.eventEmitter.emit('iot.mqtt.telemetry', telemetryEvent);
      return;
    }

    if (!this.isStatusTopic(topic)) {
      return;
    }

    // Ignore backend-originated health-check probes that are published to the
    // same status topic we subscribe to. Only board replies should affect
    // online/offline state.
    if (message.trim().toUpperCase() === MQTT_MESSAGE_HEALTH_CHECK) {
      this.logger.debug(
        `Ignoring self-published health check probe on ${topic}: ${message}`,
      );
      return;
    }

    const statusEvent = this.buildStatusEvent(topic, message, receivedAt);

    switch (statusEvent.type) {
      case 'door_password_requested':
        this.logger.log(
          `[${statusEvent.espId}] requested door password from MQTT status topic`,
        );
        if (
          this.allowDefaultDoorPasswordFallback &&
          this.defaultDoorPassword
        ) {
          try {
            this.sendDoorPassword(
              statusEvent.espId,
              statusEvent.deviceId ?? 1,
              this.defaultDoorPassword,
            );
          } catch (error) {
            const mqttError =
              error instanceof Error ? error.message : 'Unknown MQTT error';
            this.logger.error(
              `Failed to send fallback door password to ${statusEvent.espId}: ${mqttError}`,
            );
          }
        }
        break;
      case 'fire':
        this.logger.warn(`[${statusEvent.espId}] fire alarm activated`);
        break;
      case 'fire_ack':
        this.logger.log(`[${statusEvent.espId}] fire alarm acknowledged`);
        break;
      case 'online':
        this.logger.log(`[${statusEvent.espId}] ONLINE`);
        break;
      case 'device_state':
        this.logger.log(
          `[${statusEvent.espId}] ${statusEvent.deviceTopic ?? 'device'} state=${statusEvent.state ?? statusEvent.message}`,
        );
        break;
      default:
        break;
    }

    this.eventEmitter.emit('iot.mqtt.status', statusEvent);
  }

  private publishDeviceCommand(
    espId: string,
    topic: MqttDeviceTopic,
    deviceId: number,
    action: MqttBinaryAction,
  ): IoTMqttPublishResult {
    this.ensureConnected();
    const mqttTopic = `${espId}/${topic}`;
    const payload = `${action}_${deviceId}`;
    this.client!.publish(mqttTopic, payload);

    return {
      brokerUrl: this.brokerUrl,
      topic: mqttTopic,
      payload,
      espId,
      deviceTopic: topic,
      deviceId,
      action,
      publishedAt: new Date(),
    };
  }

  private publishSignal(
    topic: string,
    payload: string,
    espId: string,
  ): IoTMqttSignalResult {
    this.ensureConnected();
    this.client!.publish(topic, payload);

    return {
      brokerUrl: this.brokerUrl,
      topic,
      payload,
      espId,
      publishedAt: new Date(),
    };
  }

  private buildStatusEvent(
    topic: string,
    message: string,
    receivedAt: Date,
  ): IoTMqttStatusEvent {
    const espId = this.extractEspIdFromTopic(topic);
    const normalizedMessage = message.trim();
    const upperMessage = normalizedMessage.toUpperCase();

    const doorPinUpdate = this.parseDoorPinUpdateStatusMessage(normalizedMessage);
    if (doorPinUpdate) {
      return {
        espId,
        rawTopic: topic,
        message: normalizedMessage,
        receivedAt,
        type: 'door_pin_update',
        ...doorPinUpdate,
      };
    }

    if (upperMessage === MQTT_MESSAGE_GET_DOOR_PASSWORD) {
      return {
        espId,
        rawTopic: topic,
        message: normalizedMessage,
        receivedAt,
        type: 'door_password_requested',
        deviceTopic: 'door',
        deviceId: 1,
        state: 'PASSWORD_REQUESTED',
      };
    }

    const fireStatus = this.parseFireStatusMessage(normalizedMessage);
    if (fireStatus) {
      return {
        espId,
        rawTopic: topic,
        message: normalizedMessage,
        receivedAt,
        type: fireStatus.type,
        deviceTopic: 'alarm',
        ...(fireStatus.deviceId !== undefined
          ? { deviceId: fireStatus.deviceId }
          : {}),
        state: fireStatus.state,
      };
    }

    if (upperMessage === MQTT_MESSAGE_ONLINE) {
      return {
        espId,
        rawTopic: topic,
        message: normalizedMessage,
        receivedAt,
        type: 'online',
        state: 'ONLINE',
      };
    }

    const inferred = this.parseStructuredStatusMessage(normalizedMessage);

    if (
      inferred.deviceTopic ||
      inferred.deviceId !== undefined ||
      inferred.state
    ) {
      return {
        espId,
        rawTopic: topic,
        message: normalizedMessage,
        receivedAt,
        type: 'device_state',
        ...inferred,
      };
    }

    return {
      espId,
      rawTopic: topic,
      message: normalizedMessage,
      receivedAt,
      type: 'unknown',
    };
  }

  private buildTelemetryEvent(
    topic: string,
    message: string,
    receivedAt: Date,
  ): IoTMqttTelemetryEvent {
    const espId = this.extractEspIdFromTopic(topic);
    const parsedPayload =
      this.tryParseJsonObject(message) ??
      this.parseTelemetryKeyValuePairs(message);

    return {
      espId,
      rawTopic: topic,
      message,
      receivedAt,
      waterTotal: this.readTelemetryNumber(parsedPayload, [
        ['water_total'],
        ['waterTotal'],
        ['telemetry', 'water_total'],
        ['telemetry', 'waterTotal'],
        ['water'],
      ]),
      energyTotal: this.readTelemetryNumber(parsedPayload, [
        ['energy_total'],
        ['energyTotal'],
        ['telemetry', 'energy_total'],
        ['telemetry', 'energyTotal'],
        ['electricity_total'],
        ['electricityTotal'],
        ['energy'],
      ]),
      ...(parsedPayload ? { parsedPayload } : {}),
    };
  }

  private parseStructuredStatusMessage(message: string): {
    deviceTopic?: MqttDeviceTopic;
    deviceId?: number;
    state?: string;
  } {
    const parsedJson = this.tryParseJsonObject(message);

    if (parsedJson) {
      const deviceTopic = this.readDeviceTopicFromUnknown(
        parsedJson.topic ??
          parsedJson.deviceTopic ??
          parsedJson.type ??
          parsedJson.deviceType,
      );
      const deviceId = this.readPositiveIntegerFromUnknown(
        parsedJson.deviceId ?? parsedJson.id ?? parsedJson.channelId,
      );
      const state = this.normalizeIncomingState(
        deviceTopic,
        parsedJson.state ??
          parsedJson.status ??
          parsedJson.action ??
          parsedJson.message,
      );

      return {
        ...(deviceTopic ? { deviceTopic } : {}),
        ...(deviceId !== undefined ? { deviceId } : {}),
        ...(state ? { state } : {}),
      };
    }

    const tokens = message
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .split('_')
      .filter(Boolean);

    const topicToken = tokens.find((token) =>
      ['LIGHT', 'ALARM', 'DOOR', 'CURTAIN', 'LOCK', 'SMARTLOCK'].includes(
        token,
      ),
    );

    const deviceIdToken = tokens.find((token) => /^\d+$/.test(token));
    const state = this.normalizeIncomingState(
      this.readDeviceTopicFromUnknown(topicToken),
      tokens.join('_'),
    );

    return {
      ...(this.readDeviceTopicFromUnknown(topicToken)
        ? { deviceTopic: this.readDeviceTopicFromUnknown(topicToken) }
        : {}),
      ...(deviceIdToken ? { deviceId: Number(deviceIdToken) } : {}),
      ...(state ? { state } : {}),
    };
  }

  private parseFireStatusMessage(message: string):
    | {
        type: 'fire' | 'fire_ack';
        state: 'FIRE' | 'FIRE_ACK';
        deviceId?: number;
      }
    | null {
    const parsedJson = this.tryParseJsonObject(message);

    if (parsedJson) {
      const rawEvent =
        parsedJson.event ??
        parsedJson.type ??
        parsedJson.status ??
        parsedJson.state ??
        parsedJson.message ??
        parsedJson.action;
      const normalizedEvent =
        typeof rawEvent === 'string' ? rawEvent.trim().toUpperCase() : '';
      const deviceId = this.readPositiveIntegerFromUnknown(
        parsedJson.deviceId ?? parsedJson.id ?? parsedJson.channelId,
      );

      if (normalizedEvent === MQTT_MESSAGE_FIRE) {
        return {
          type: 'fire',
          state: 'FIRE',
          ...(deviceId !== undefined ? { deviceId } : {}),
        };
      }

      if (normalizedEvent === MQTT_MESSAGE_FIRE_ACK) {
        return {
          type: 'fire_ack',
          state: 'FIRE_ACK',
          ...(deviceId !== undefined ? { deviceId } : {}),
        };
      }

      return null;
    }

    const tokens = message
      .trim()
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .filter(Boolean);

    if (tokens.length === 0) {
      return null;
    }

    const deviceId = tokens
      .map((token) => Number.parseInt(token, 10))
      .find((value) => Number.isInteger(value) && value > 0);

    if (tokens.includes('FIRE') && tokens.includes('ACK')) {
      return {
        type: 'fire_ack',
        state: 'FIRE_ACK',
        ...(deviceId !== undefined ? { deviceId } : {}),
      };
    }

    if (tokens.includes('FIRE')) {
      return {
        type: 'fire',
        state: 'FIRE',
        ...(deviceId !== undefined ? { deviceId } : {}),
      };
    }

    return null;
  }

  private parseDoorPinUpdateStatusMessage(message: string): {
    deviceTopic: 'door';
    deviceId?: number;
    state: string;
    pinUpdateResult: 'success' | 'failed';
  } | null {
    const parsedJson = this.tryParseJsonObject(message);

    if (parsedJson) {
      const rawEvent = [
        parsedJson.event,
        parsedJson.action,
        parsedJson.type,
        parsedJson.status,
        parsedJson.message,
      ]
        .filter((value) => typeof value === 'string')
        .join('_')
        .toUpperCase();

      const mentionsDoorPin =
        rawEvent.includes('PIN') ||
        rawEvent.includes('PASSWORD') ||
        rawEvent.includes('CHANGE_PIN') ||
        rawEvent.includes('SET_PIN');

      if (!mentionsDoorPin) {
        return null;
      }

      const deviceId = this.readPositiveIntegerFromUnknown(
        parsedJson.deviceId ??
          parsedJson.id ??
          parsedJson.channelId ??
          parsedJson.doorId,
      );
      const normalizedResult = this.normalizeDoorPinUpdateResult(
        parsedJson.result ?? parsedJson.status ?? parsedJson.message ?? rawEvent,
      );

      if (!normalizedResult) {
        return null;
      }

      return {
        deviceTopic: 'door',
        ...(deviceId !== undefined ? { deviceId } : {}),
        state:
          normalizedResult === 'success'
            ? 'PIN_UPDATED'
            : 'PIN_UPDATE_FAILED',
        pinUpdateResult: normalizedResult,
      };
    }

    const upperMessage = message.trim().toUpperCase();
    const mentionsDoorPin =
      upperMessage.includes('PIN') ||
      upperMessage.includes('PASSWORD') ||
      upperMessage.includes('PWD');
    if (!mentionsDoorPin) {
      return null;
    }

    const normalizedResult = this.normalizeDoorPinUpdateResult(upperMessage);
    if (!normalizedResult) {
      return null;
    }

    const deviceIdMatch = upperMessage.match(/(?:DOOR|ID|DEVICE|CHANNEL)[_\s:-]?(\d+)/);

    return {
      deviceTopic: 'door',
      ...(deviceIdMatch ? { deviceId: Number(deviceIdMatch[1]) } : {}),
      state:
        normalizedResult === 'success' ? 'PIN_UPDATED' : 'PIN_UPDATE_FAILED',
      pinUpdateResult: normalizedResult,
    };
  }

  private normalizeDoorPinUpdateResult(
    value: unknown,
  ): 'success' | 'failed' | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim().toUpperCase();
    if (!normalized) {
      return undefined;
    }

    if (
      normalized.includes('SUCCESS') ||
      normalized.includes('UPDATED') ||
      normalized.includes('CHANGED') ||
      normalized.includes('SAVED') ||
      normalized.includes('STORED') ||
      normalized.includes('DONE') ||
      normalized.includes('SET_OK') ||
      normalized.includes('PIN_OK') ||
      normalized.includes('PASSWORD_OK') ||
      normalized.includes('OK')
    ) {
      return 'success';
    }

    if (
      normalized.includes('FAIL') ||
      normalized.includes('ERROR') ||
      normalized.includes('INVALID') ||
      normalized.includes('DENIED')
    ) {
      return 'failed';
    }

    return undefined;
  }

  private tryParseJsonObject(
    value: string,
  ): Record<string, unknown> | undefined {
    try {
      const parsed: unknown = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return undefined;
      }

      return parsed as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }

  private parseTelemetryKeyValuePairs(
    message: string,
  ): Record<string, unknown> | undefined {
    const result: Record<string, unknown> = {};
    const matches = message.matchAll(
      /([a-zA-Z_][a-zA-Z0-9_]*)\s*[:=]\s*(-?\d+(?:\.\d+)?)/g,
    );

    for (const match of matches) {
      result[match[1]] = Number(match[2]);
    }

    return Object.keys(result).length > 0 ? result : undefined;
  }

  private readTelemetryNumber(
    source: Record<string, unknown> | undefined,
    candidatePaths: string[][],
  ): number | undefined {
    if (!source) {
      return undefined;
    }

    for (const path of candidatePaths) {
      let current: unknown = source;

      for (const segment of path) {
        if (!current || typeof current !== 'object' || Array.isArray(current)) {
          current = undefined;
          break;
        }

        current = (current as Record<string, unknown>)[segment];
      }

      const parsed = this.readNumberFromUnknown(current);
      if (parsed !== undefined) {
        return parsed;
      }
    }

    return undefined;
  }

  private normalizeIncomingState(
    topic: MqttDeviceTopic | undefined,
    value: unknown,
  ): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim().toUpperCase();
    if (!normalized) {
      return undefined;
    }

    if (normalized.includes('FIRE_ACK')) {
      return 'FIRE_ACK';
    }

    if (normalized.includes('FIRE')) {
      return 'FIRE';
    }

    if (normalized.includes('ONLINE')) {
      return 'ONLINE';
    }

    if (normalized.includes('OFFLINE')) {
      return 'OFFLINE';
    }

    if (
      normalized.includes('OPEN') ||
      normalized.includes('UNLOCK') ||
      (topic &&
        (topic === 'door' || topic === 'curtain') &&
        normalized === 'ON')
    ) {
      return 'OPEN';
    }

    if (
      normalized.includes('CLOSE') ||
      normalized.includes('CLOSED') ||
      normalized.includes('LOCK') ||
      (topic &&
        (topic === 'door' || topic === 'curtain') &&
        normalized === 'OFF')
    ) {
      return 'CLOSED';
    }

    if (normalized.includes('ON')) {
      return 'ON';
    }

    if (normalized.includes('OFF')) {
      return 'OFF';
    }

    return normalized;
  }

  private readDeviceTopicFromUnknown(
    value: unknown,
  ): MqttDeviceTopic | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim().toLowerCase();

    if (normalized === 'lock' || normalized === 'smartlock') {
      return 'door';
    }

    return MQTT_DEVICE_TOPICS.find((topic) => topic === normalized);
  }

  private readPositiveIntegerFromUnknown(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      return value;
    }

    if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
      const parsed = Number(value.trim());
      return parsed > 0 ? parsed : undefined;
    }

    return undefined;
  }

  private readNumberFromUnknown(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return undefined;
  }

  private isStatusTopic(topic: string) {
    return topic.endsWith('/status');
  }

  private isTelemetryTopic(topic: string) {
    return topic.endsWith('/telemetry') || topic.endsWith('/meter');
  }

  private extractEspIdFromTopic(topic: string) {
    const parts = topic.split('/').filter(Boolean);

    if (parts[0] === 'HOMEIQ' && parts.length > 1) {
      return parts[1];
    }

    if (parts.length > 0) {
      return parts[0];
    }

    return 'UNKNOWN';
  }

  private ensureConnected() {
    if (!this.brokerUrl) {
      throw new ServiceUnavailableException(
        'MQTT_BROKER_URL is not configured',
      );
    }

    if (!this.client?.connected) {
      throw new ServiceUnavailableException('MQTT client is not connected yet');
    }
  }

  private normalizeEspId(espId: string): string {
    const normalized = espId.trim();
    if (!normalized) {
      throw new BadRequestException('espId is required');
    }

    return normalized;
  }

  private normalizeDeviceId(deviceId: number): number {
    if (!Number.isInteger(deviceId) || deviceId <= 0) {
      throw new BadRequestException('deviceId must be a positive integer');
    }

    return deviceId;
  }

  private normalizeBinaryAction(action: string): MqttBinaryAction {
    const normalized = action.trim().toUpperCase();
    if (!MQTT_BINARY_ACTIONS.some((candidate) => candidate === normalized)) {
      throw new BadRequestException(
        "Invalid action. Only 'ON' or 'OFF' are accepted",
      );
    }

    return normalized as MqttBinaryAction;
  }

  private normalizeDeviceTopic(topic: string): MqttDeviceTopic {
    const normalized = topic.trim().toLowerCase();
    const matched = MQTT_DEVICE_TOPICS.find(
      (candidate) => candidate === normalized,
    );

    if (!matched) {
      throw new BadRequestException(
        `Unsupported topic. Allowed topics: ${MQTT_DEVICE_TOPICS.join(', ')}`,
      );
    }

    return matched;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
