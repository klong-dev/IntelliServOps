import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect } from 'mqtt';
import { IoTMqttService } from './iot-mqtt.service';

jest.mock('mqtt', () => ({
  connect: jest.fn(),
}));

describe('IoTMqttService', () => {
  const connectMock = connect as jest.MockedFunction<typeof connect>;

  const createClient = (connected = true) =>
    ({
      connected,
      publish: jest.fn(),
      subscribe: jest.fn(),
      on: jest.fn(),
      end: jest.fn(),
    }) as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should connect to MQTT broker using configured options', () => {
    const client = createClient();
    connectMock.mockReturnValue(client);

    const service = new IoTMqttService({
      get: jest.fn((key: string) =>
        key === 'MQTT_BROKER_URL' ? 'mqtt://broker.hivemq.com:1883' : undefined,
      ),
    } as unknown as ConfigService);

    expect(connectMock).toHaveBeenCalledWith('mqtt://broker.hivemq.com:1883', {
      reconnectPeriod: 2000,
      connectTimeout: 10000,
    });
    expect(service.getGatewayStatus().mqttConnected).toBe(true);
  });

  it('should publish light command to the expected topic and payload', () => {
    const client = createClient();
    connectMock.mockReturnValue(client);
    const service = new IoTMqttService({
      get: jest.fn((key: string) =>
        key === 'MQTT_BROKER_URL' ? 'mqtt://broker.hivemq.com:1883' : undefined,
      ),
    } as unknown as ConfigService);

    const result = service.triggerLight('ESP_A101', 'on', 1);

    expect(client.publish).toHaveBeenCalledWith('ESP_A101/light', 'on_1');
    expect(result.topic).toBe('ESP_A101/light');
    expect(result.payload).toBe('on_1');
  });

  it('should publish door password to the expected topic', () => {
    const client = createClient();
    connectMock.mockReturnValue(client);
    const service = new IoTMqttService({
      get: jest.fn((key: string) =>
        key === 'MQTT_BROKER_URL' ? 'mqtt://broker.hivemq.com:1883' : undefined,
      ),
    } as unknown as ConfigService);

    const result = service.sendDoorPassword('ESP_A101', 1, '290304');

    expect(client.publish).toHaveBeenCalledWith(
      'ESP_A101/get/door-password',
      '290304',
    );
    expect(result.controlType).toBe('door');
  });

  it('should reject invalid door actions', () => {
    const client = createClient();
    connectMock.mockReturnValue(client);
    const service = new IoTMqttService({
      get: jest.fn((key: string) =>
        key === 'MQTT_BROKER_URL' ? 'mqtt://broker.hivemq.com:1883' : undefined,
      ),
    } as unknown as ConfigService);

    expect(() => service.triggerDoor('ESP_A101', 'lock', 1)).toThrow(
      BadRequestException,
    );
  });

  it('should reject publish requests when MQTT client is disconnected', () => {
    const client = createClient(false);
    connectMock.mockReturnValue(client);
    const service = new IoTMqttService({
      get: jest.fn((key: string) =>
        key === 'MQTT_BROKER_URL' ? 'mqtt://broker.hivemq.com:1883' : undefined,
      ),
    } as unknown as ConfigService);

    expect(() => service.triggerLight('ESP_A101', 'on', 1)).toThrow(
      ServiceUnavailableException,
    );
  });

  it('should run the MQTT test sequence in the expected order', async () => {
    jest.useFakeTimers();
    const client = createClient();
    connectMock.mockReturnValue(client);
    const service = new IoTMqttService({
      get: jest.fn((key: string) =>
        key === 'MQTT_BROKER_URL' ? 'mqtt://broker.hivemq.com:1883' : undefined,
      ),
    } as unknown as ConfigService);

    const promise = service.runTestSequence('ESP_A101', 1);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(client.publish).toHaveBeenCalledTimes(10);
    expect(client.publish).toHaveBeenNthCalledWith(1, 'ESP_A101/light', 'on_1');
    expect(client.publish).toHaveBeenNthCalledWith(10, 'ESP_A101/door', 'close_1');
    expect(result.totalSteps).toBe(10);
    jest.useRealTimers();
  });

  it('should prevent overlapping test sequences for the same ESP id', async () => {
    jest.useFakeTimers();
    const client = createClient();
    connectMock.mockReturnValue(client);
    const service = new IoTMqttService({
      get: jest.fn((key: string) =>
        key === 'MQTT_BROKER_URL' ? 'mqtt://broker.hivemq.com:1883' : undefined,
      ),
    } as unknown as ConfigService);

    const pending = service.runTestSequence('ESP_A101', 50);

    await expect(service.runTestSequence('ESP_A101', 50)).rejects.toThrow(
      ConflictException,
    );

    await jest.runAllTimersAsync();
    await pending;
    jest.useRealTimers();
  });
});
