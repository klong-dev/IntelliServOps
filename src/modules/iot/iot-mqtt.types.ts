export const MQTT_CONTROL_TYPES = ['light', 'alarm', 'door', 'curtain'] as const;

export type MqttControlType = (typeof MQTT_CONTROL_TYPES)[number];

export interface DeviceMqttControlConfig {
  espId: string;
  controlType: MqttControlType;
  channelId: number;
  doorPasswordChannelId?: number | null;
}

export interface IoTMqttPublishResult {
  brokerUrl: string | null;
  topic: string;
  payload: string;
  espId: string;
  controlType: MqttControlType;
  channelId: number;
  publishedAt: Date;
}

export interface IoTMqttGatewayStatus {
  success: boolean;
  mqttConnected: boolean;
  brokerUrl: string | null;
  statusTopic: string;
}
