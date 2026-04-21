/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { connect } from 'mqtt';
import { IoTMqttService } from './iot-mqtt.service';

jest.mock('mqtt', () => ({
  connect: jest.fn(),
}));

describe('IoTMqttService', () => {
  const connectMock = connect as jest.MockedFunction<typeof connect>;

  const createClient = (connected = true) => {
    const handlers: Record<string, (...args: any[]) => void> = {};
    const client = {
      connected,
      publish: jest.fn(),
      subscribe: jest.fn((topic, callback) => callback?.()),
      on: jest.fn((event: string, handler: (...args: any[]) => void) => {
        handlers[event] = handler;
        return client;
      }),
      end: jest.fn(),
      handlers,
    };

    return client;
  };

  const createService = (overrides?: Record<string, string | undefined>) => {
    const client = createClient();
    const listeners = new Map<string, Set<(payload: unknown) => void>>();
    const eventEmitter = {
      emit: jest.fn((event: string, payload: unknown) => {
        const handlers = listeners.get(event);
        if (!handlers) {
          return false;
        }

        for (const handler of handlers) {
          handler(payload);
        }

        return true;
      }),
      on: jest.fn((event: string, handler: (payload: unknown) => void) => {
        const handlers = listeners.get(event) ?? new Set();
        handlers.add(handler);
        listeners.set(event, handlers);
      }),
      off: jest.fn((event: string, handler: (payload: unknown) => void) => {
        listeners.get(event)?.delete(handler);
      }),
    };

    connectMock.mockReturnValue(client);

    const service = new IoTMqttService(
      {
        get: jest.fn((key: string) => {
          const defaults: Record<string, string | undefined> = {
            MQTT_BROKER_URL: 'mqtt://broker.hivemq.com:1883',
            DEFAULT_DOOR_PASSWORD: '290304',
          };

          return { ...defaults, ...overrides }[key];
        }),
      } as unknown as ConfigService,
      eventEmitter as unknown as EventEmitter2,
    );

    return { service, client, eventEmitter };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should connect to MQTT broker using configured options', () => {
    const { service } = createService();

    expect(connectMock).toHaveBeenCalledWith('mqtt://broker.hivemq.com:1883', {
      reconnectPeriod: 2000,
      connectTimeout: 10000,
    });
    expect(service.getGatewayStatus()).toEqual({
      success: true,
      mqttConnected: true,
      brokerUrl: 'mqtt://broker.hivemq.com:1883',
      statusTopic: 'HOMEIQ/+/status',
      telemetryTopic: 'HOMEIQ/+/telemetry',
    });
  });

  it('should publish a generic device command to the expected topic and payload', () => {
    const { service, client } = createService();

    const result = service.controlDevice('ESP_A101', 'ON', 1, 'light');

    expect(client.publish).toHaveBeenCalledWith('ESP_A101/light', 'ON_1');
    expect(result.topic).toBe('ESP_A101/light');
    expect(result.payload).toBe('ON_1');
    expect(result.deviceTopic).toBe('light');
    expect(result.deviceId).toBe(1);
  });

  it('should publish door password to the expected topic', () => {
    const { service, client } = createService();

    const result = service.sendDoorPassword('ESP_A101', 1, '290304');

    expect(client.publish).toHaveBeenCalledWith(
      'ESP_A101/get/door-password',
      '290304',
    );
    expect(result.doorId).toBe(1);
  });

  it('should publish telemetry and health-check signals', () => {
    const { service, client } = createService();

    service.getTelemetry('ESP_A101');
    service.checkOnline('ESP_A101');

    expect(client.publish).toHaveBeenNthCalledWith(
      1,
      'ESP_A101/get/telemetry',
      'GET_TELEMETRY',
    );
    expect(client.publish).toHaveBeenNthCalledWith(
      2,
      'HOMEIQ/ESP_A101/status',
      'ARE_YOU_OK',
    );
  });

  it('should reject invalid device actions', () => {
    const { service } = createService();

    expect(() => service.controlDevice('ESP_A101', 'OPEN', 1, 'door')).toThrow(
      BadRequestException,
    );
  });

  it('should reject publish requests when MQTT client is disconnected', () => {
    const client = createClient(false);
    const eventEmitter = { emit: jest.fn() };
    connectMock.mockReturnValue(client);

    const service = new IoTMqttService(
      {
        get: jest.fn((key: string) =>
          key === 'MQTT_BROKER_URL'
            ? 'mqtt://broker.hivemq.com:1883'
            : undefined,
        ),
      } as unknown as ConfigService,
      eventEmitter as unknown as EventEmitter2,
    );

    expect(() => service.controlDevice('ESP_A101', 'ON', 1, 'light')).toThrow(
      ServiceUnavailableException,
    );
  });

  it('should run the MQTT test sequence in the expected order', async () => {
    jest.useFakeTimers();
    const { service, client } = createService();

    const promise = service.runTestSequence('ESP_A101', 1);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(client.publish).toHaveBeenCalledTimes(10);
    expect(client.publish).toHaveBeenNthCalledWith(1, 'ESP_A101/light', 'ON_1');
    expect(client.publish).toHaveBeenNthCalledWith(
      10,
      'ESP_A101/door',
      'OFF_1',
    );
    expect(result.totalSteps).toBe(10);
    jest.useRealTimers();
  });

  it('should prevent overlapping test sequences for the same ESP id', async () => {
    jest.useFakeTimers();
    const { service } = createService();

    const pending = service.runTestSequence('ESP_A101', 50);

    await expect(service.runTestSequence('ESP_A101', 50)).rejects.toThrow(
      ConflictException,
    );

    await jest.runAllTimersAsync();
    await pending;
    jest.useRealTimers();
  });

  it('should emit telemetry events from subscribed telemetry topics', () => {
    const { client, eventEmitter } = createService();

    client.handlers.message(
      'HOMEIQ/ESP_A101/telemetry',
      Buffer.from('{"water_total":12.5,"energy_total":3.2}'),
    );

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'iot.mqtt.telemetry',
      expect.objectContaining({
        espId: 'ESP_A101',
        waterTotal: 12.5,
        energyTotal: 3.2,
      }),
    );
  });

  it('should auto-send fallback door password when board requests it', () => {
    const { client, eventEmitter } = createService({
      MQTT_ALLOW_DEFAULT_DOOR_PASSWORD_FALLBACK: 'true',
    });

    client.handlers.message(
      'HOMEIQ/ESP_A101/status',
      Buffer.from('GET_DOOR_PASSWORD'),
    );

    expect(client.publish).toHaveBeenCalledWith(
      'ESP_A101/get/door-password',
      '290304',
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'iot.mqtt.status',
      expect.objectContaining({
        espId: 'ESP_A101',
        type: 'door_password_requested',
      }),
    );
  });

  it('should ignore self-published health-check probes on status topic', () => {
    const { client, eventEmitter } = createService();

    client.handlers.message('HOMEIQ/ESP_A101/status', Buffer.from('ARE_YOU_OK'));

    expect(eventEmitter.emit).not.toHaveBeenCalledWith(
      'iot.mqtt.status',
      expect.anything(),
    );
  });

  it('should parse door PIN update ACK from status messages', () => {
    const { client, eventEmitter } = createService();

    client.handlers.message(
      'HOMEIQ/ESP_A101/status',
      Buffer.from('{"event":"PIN_UPDATED","deviceId":1,"result":"success"}'),
    );

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'iot.mqtt.status',
      expect.objectContaining({
        espId: 'ESP_A101',
        type: 'door_pin_update',
        deviceTopic: 'door',
        deviceId: 1,
        pinUpdateResult: 'success',
      }),
    );
  });

  it('should parse legacy plain-text PWD_UPDATED status as door PIN update success', () => {
    const { client, eventEmitter } = createService();

    client.handlers.message('HOMEIQ/ESP_A101/status', Buffer.from('PWD_UPDATED'));

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'iot.mqtt.status',
      expect.objectContaining({
        espId: 'ESP_A101',
        type: 'door_pin_update',
        deviceTopic: 'door',
        pinUpdateResult: 'success',
      }),
    );
  });

  it('should send door password and resolve when matching ACK is received', async () => {
    const { service, client } = createService();

    const promise = service.sendDoorPasswordAndWaitForAck(
      'ESP_A101',
      1,
      '290304',
      200,
    );

    client.handlers.message('HOMEIQ/ESP_A101/status', Buffer.from('PWD_UPDATED'));

    await expect(promise).resolves.toMatchObject({
      timedOut: false,
      timeoutMs: 200,
      statusEvent: expect.objectContaining({
        espId: 'ESP_A101',
        type: 'door_pin_update',
        pinUpdateResult: 'success',
      }),
    });
    expect(client.publish).toHaveBeenCalledWith(
      'ESP_A101/get/door-password',
      '290304',
    );
  });
});
