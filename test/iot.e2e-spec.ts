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
    triggerLight: jest.fn(),
    triggerAlarm: jest.fn(),
    triggerDoor: jest.fn(),
    triggerCurtain: jest.fn(),
    sendDoorPassword: jest.fn(),
    runTestSequence: jest.fn(),
  };

  const apartmentId = '11111111-1111-4111-8111-111111111111';
  const deviceId = '22222222-2222-4222-8222-222222222222';
  const meterId = '33333333-3333-4333-8333-333333333333';
  const readingId = '44444444-4444-4444-8444-444444444444';

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

  it('accepts direct MQTT control without auth and normalizes uppercase action', async () => {
    mqttService.triggerLight.mockImplementation(
      (espId: string, action: string, channelId: number) => ({
        brokerUrl: 'mqtt://broker.hivemq.com:1883',
        topic: `${espId}/light`,
        payload: `${action}_${channelId}`,
        espId,
        controlType: 'light',
        channelId,
        publishedAt: new Date('2026-03-31T00:00:00.000Z'),
      }),
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/iot/devices/ESP_A101/light/1')
      .send({ action: 'ON' })
      .expect(201);

    expect(mqttService.triggerLight).toHaveBeenCalledWith('ESP_A101', 'on', 1);
    expect(response.body.message).toBe('The lights have been turned on');
    expect(response.body.data.details.payload).toBe('on_1');
  });

  it('allows apartment device listing without auth for test mode', async () => {
    prisma.ioTDevice.findMany.mockResolvedValue([
      {
        id: deviceId,
        deviceName: 'Smart Lock A101',
        deviceType: 'smart_lock',
        brand: 'ESP',
        model: 'ESP32',
        serialNumber: 'SN-001',
        status: 'inactive',
        isControllableByTenant: false,
        lastOnlineAt: null,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        apartment: {
          id: apartmentId,
          apartmentNumber: 'A101',
          streetAddress: '123 Nguyen Hue',
        },
        room: null,
      },
    ] as any);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/iot/apartments/${apartmentId}/devices`)
      .expect(200);

    expect(prisma.ioTDevice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          apartmentId,
        },
      }),
    );
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].status).toBe('inactive');
  });

  it('allows deviceId control without auth and still publishes lowercase MQTT payload', async () => {
    prisma.ioTDevice.findUnique.mockResolvedValue({
      id: deviceId,
      deviceType: 'light',
      status: 'active',
      isControllableByTenant: false,
      configuration: {
        mqtt: {
          espId: 'ESP_A101',
          controlType: 'light',
          channelId: 1,
        },
      },
      apartment: {
        rentalContracts: [],
      },
    } as any);
    mqttService.triggerLight.mockImplementation(
      (espId: string, action: string, channelId: number) => ({
        brokerUrl: 'mqtt://broker.hivemq.com:1883',
        topic: `${espId}/light`,
        payload: `${action}_${channelId}`,
        espId,
        controlType: 'light',
        channelId,
        publishedAt: new Date('2026-03-31T00:00:00.000Z'),
      }),
    );

    const response = await request(app.getHttpServer())
      .post(`/api/v1/iot/devices/${deviceId}/control`)
      .send({ command: 'ON' })
      .expect(201);

    expect(mqttService.triggerLight).toHaveBeenCalledWith('ESP_A101', 'on', 1);
    expect(response.body.data.mqttPayload).toBe('on_1');
  });

  it('allows meter reading creation and verification without auth', async () => {
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
    expect(prisma.utilityReading.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          readByStaff: undefined,
        }),
      }),
    );

    const verifyResponse = await request(app.getHttpServer())
      .patch(`/api/v1/iot/readings/${readingId}/verify`)
      .expect(200);

    expect(verifyResponse.body.data.isVerified).toBe(true);
    expect(
      prisma.utilityReading.update.mock.calls[0][0].data.verifiedByStaff,
    ).toBeUndefined();
  });
});
