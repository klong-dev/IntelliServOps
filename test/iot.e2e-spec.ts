/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard, RolesGuard } from '../src/common/guards';
import { TransformInterceptor } from '../src/common/interceptors';
import { IoTController } from '../src/modules/iot/iot.controller';
import { IoTMqttService } from '../src/modules/iot/iot-mqtt.service';
import { IoTService } from '../src/modules/iot/iot.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createPrismaMock } from '../src/test-utils';

describe('IoTController (e2e)', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof createPrismaMock>;

  const mqttService = {
    getGatewayStatus: jest.fn(),
    getTelemetry: jest.fn(),
    checkOnline: jest.fn(),
    controlDevice: jest.fn(),
    sendDoorPassword: jest.fn(),
    runTestSequence: jest.fn(),
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [IoTController],
      providers: [
        IoTService,
        { provide: PrismaService, useValue: prisma },
        { provide: IoTMqttService, useValue: mqttService },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns gateway status', async () => {
    mqttService.getGatewayStatus.mockReturnValue({
      success: true,
      mqttConnected: true,
      brokerUrl: 'mqtt://broker.hivemq.com:1883',
      statusTopic: 'HOMEIQ/+/status',
      telemetryTopic: 'HOMEIQ/+/telemetry',
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/iot/online')
      .expect(200);

    expect(response.body.data.mqttConnected).toBe(true);
  });

  it('sends door password', async () => {
    mqttService.sendDoorPassword.mockReturnValue({
      brokerUrl: 'mqtt://broker.hivemq.com:1883',
      topic: 'ESP_A101/get/door-password',
      payload: '290304',
      espId: 'ESP_A101',
      publishedAt: new Date('2026-03-31T00:00:00.000Z'),
      doorId: 1,
      password: '290304',
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/iot/devices/ESP_A101/config-door-password/1')
      .send({ password: '290304' })
      .expect(201);

    expect(response.body.data.details.payload).toBe('290304');
  });

  it('requests telemetry and health signals', async () => {
    mqttService.getTelemetry.mockReturnValue({
      brokerUrl: 'mqtt://broker.hivemq.com:1883',
      topic: 'ESP_A101/get/telemetry',
      payload: 'GET_TELEMETRY',
      espId: 'ESP_A101',
      publishedAt: new Date('2026-03-31T00:00:00.000Z'),
    });
    mqttService.checkOnline.mockReturnValue({
      brokerUrl: 'mqtt://broker.hivemq.com:1883',
      topic: 'HOMEIQ/ESP_A101/status',
      payload: 'ARE_YOU_OK',
      espId: 'ESP_A101',
      publishedAt: new Date('2026-03-31T00:00:00.000Z'),
    });

    await request(app.getHttpServer())
      .post('/api/v1/iot/devices/ESP_A101/get-telemetry')
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/v1/iot/devices/ESP_A101/check-health')
      .expect(200);

    expect(mqttService.getTelemetry).toHaveBeenCalledWith('ESP_A101');
    expect(mqttService.checkOnline).toHaveBeenCalledWith('ESP_A101');
  });

  it('runs the test sequence', async () => {
    mqttService.runTestSequence.mockResolvedValue({
      success: true,
      message: 'Test sequence completed',
      holdMs: 500,
      totalSteps: 1,
      steps: [],
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/iot/devices/ESP_A101/test-sequence')
      .send({ holdMs: 500 })
      .expect(201);

    expect(response.body.data.totalSteps).toBe(1);
  });

  it('accepts generic MQTT control and publishes ON/OFF payload', async () => {
    mqttService.controlDevice.mockImplementation(
      (espId: string, action: string, mqttDeviceId: number, topic: string) => ({
        brokerUrl: 'mqtt://broker.hivemq.com:1883',
        topic: `${espId}/${topic}`,
        payload: `${action}_${mqttDeviceId}`,
        espId,
        deviceTopic: topic,
        deviceId: mqttDeviceId,
        action,
        publishedAt: new Date('2026-03-31T00:00:00.000Z'),
      }),
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/iot/devices/ESP_A101/1')
      .send({ topic: 'light', action: 'ON' })
      .expect(201);

    expect(mqttService.controlDevice).toHaveBeenCalledWith(
      'ESP_A101',
      'ON',
      1,
      'light',
    );
    expect(response.body.data.details.payload).toBe('ON_1');
  });
});
