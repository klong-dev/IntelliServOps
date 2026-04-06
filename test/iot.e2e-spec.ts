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

  const apartmentId = '11111111-1111-4111-8111-111111111111';
  const deviceId = '22222222-2222-4222-8222-222222222222';

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

  it('lists MQTT boards', async () => {
    prisma.ioTDevice.findMany.mockResolvedValue([
      {
        id: deviceId,
        apartmentId,
        deviceName: 'Front Door Lock',
        deviceType: 'smart_lock',
        status: 'active',
        isControllableByTenant: true,
        lastOnlineAt: new Date('2026-03-31T00:00:00.000Z'),
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-31T00:00:00.000Z'),
        configuration: {
          mqtt: {
            espId: 'ESP_A101',
            boardName: 'A101 Main Board',
            topic: 'door',
            deviceId: 1,
            state: 'CLOSED',
          },
        },
        apartment: {
          id: apartmentId,
          apartmentNumber: 'A101',
          streetAddress: '123 Nguyen Hue',
        },
        room: null,
      },
    ] as any);

    const response = await request(app.getHttpServer())
      .get('/api/v1/iot/boards')
      .expect(200);

    expect(response.body.data[0].id).toBe('ESP_A101');
  });

  it('creates an MQTT board', async () => {
    prisma.apartment.findUnique.mockResolvedValue({ id: apartmentId } as any);
    prisma.ioTDevice.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: deviceId,
        apartmentId,
        deviceName: 'Front Door Lock',
        deviceType: 'smart_lock',
        status: 'active',
        isControllableByTenant: true,
        lastOnlineAt: null,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-31T00:00:00.000Z'),
        configuration: {
          mqtt: {
            espId: 'ESP_A101',
            boardName: 'A101 Main Board',
            topic: 'door',
            deviceId: 1,
          },
        },
        apartment: {
          id: apartmentId,
          apartmentNumber: 'A101',
          streetAddress: '123 Nguyen Hue',
        },
        room: null,
      },
    ] as any);
    prisma.$transaction.mockResolvedValue([{ id: deviceId }] as any);

    const response = await request(app.getHttpServer())
      .post('/api/v1/iot/boards')
      .send({
        boardId: 'ESP_A101',
        boardName: 'A101 Main Board',
        apartmentId,
        devices: [
          {
            deviceName: 'Front Door Lock',
            deviceType: 'smart_lock',
            mqttTopic: 'door',
            mqttDeviceId: 1,
          },
        ],
      })
      .expect(201);

    expect(response.body.data.id).toBe('ESP_A101');
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

  it('accepts generic MQTT control', async () => {
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

    expect(response.body.data.details.payload).toBe('ON_1');
  });

  it('allows meter reading creation and verification', async () => {
    prisma.utilityMeter.findUnique.mockResolvedValue({
      id: meterId,
      currentReading: 1000,
    } as any);
    prisma.utilityReading.create.mockResolvedValue({
      id: readingId,
      readingDate: new Date('2026-03-31T00:00:00.000Z'),
      readingValue: 1100,
      previousReadingValue: 1000,
      consumption: 100,
      readingType: 'manual',
    } as any);
    prisma.utilityMeter.update.mockResolvedValue({ id: meterId } as any);
    prisma.utilityReading.update.mockResolvedValue({
      id: readingId,
      isVerified: true,
      verifiedAt: new Date('2026-03-31T01:00:00.000Z'),
    } as any);

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/iot/readings')
      .send({
        utilityMeterId: meterId,
        readingDate: '2026-03-31',
        readingValue: 1100,
      })
      .expect(201);

    expect(createResponse.body.data.readingValue).toBe(1100);

    const verifyResponse = await request(app.getHttpServer())
      .patch(`/api/v1/iot/readings/${readingId}/verify`)
      .expect(200);

    expect(verifyResponse.body.data.isVerified).toBe(true);
  });
});
