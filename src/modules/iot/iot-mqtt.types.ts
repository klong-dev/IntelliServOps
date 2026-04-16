export const MQTT_DEVICE_TOPICS = [
  'light',
  'alarm',
  'door',
  'curtain',
  'electric',
  'water',
] as const;
export const MQTT_CONTROL_TYPES = MQTT_DEVICE_TOPICS;
export const MQTT_BINARY_ACTIONS = ['ON', 'OFF'] as const;

export type MqttDeviceTopic = (typeof MQTT_DEVICE_TOPICS)[number];
export type MqttControlType = MqttDeviceTopic;
export type MqttBinaryAction = (typeof MQTT_BINARY_ACTIONS)[number];

export interface DeviceMqttControlConfig {
  espId: string;
  topic: MqttDeviceTopic;
  deviceId: number;
  doorPasswordDeviceId?: number | null;
  state?: string | null;
}

export interface IoTMqttPublishResult {
  brokerUrl: string | null;
  topic: string;
  payload: string;
  espId: string;
  deviceTopic: MqttDeviceTopic;
  deviceId: number;
  action?: MqttBinaryAction;
  publishedAt: Date;
}

export interface IoTMqttSignalResult {
  brokerUrl: string | null;
  topic: string;
  payload: string;
  espId: string;
  publishedAt: Date;
}

export interface IoTMqttGatewayStatus {
  success: boolean;
  mqttConnected: boolean;
  brokerUrl: string | null;
  statusTopic: string;
  telemetryTopic: string;
}

export interface IoTMqttStatusEvent {
  espId: string;
  rawTopic: string;
  message: string;
  receivedAt: Date;
  type:
    | 'door_password_requested'
    | 'door_pin_update'
    | 'fire'
    | 'fire_ack'
    | 'online'
    | 'device_state'
    | 'unknown';
  deviceTopic?: MqttDeviceTopic;
  deviceId?: number;
  state?: string;
  pinUpdateResult?: 'success' | 'failed';
}

export interface IoTMqttTelemetryEvent {
  espId: string;
  rawTopic: string;
  message: string;
  receivedAt: Date;
  waterTotal?: number;
  energyTotal?: number;
  parsedPayload?: Record<string, unknown>;
}

export interface IoTMqttControlAckResult {
  dispatch: IoTMqttPublishResult;
  statusEvent: IoTMqttStatusEvent | null;
  timeoutMs: number;
  timedOut: boolean;
}
