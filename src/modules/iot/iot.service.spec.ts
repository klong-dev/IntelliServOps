/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { IoTService } from './iot.service';
import { IoTMqttService } from './iot-mqtt.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  createPrismaMock,
  mockStaffJwtPayload,
  mockUserJwtPayload,
} from '../../test-utils';
import { IoTStatus, MeterStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

describe('IoTService', () => {
  let service: IoTService;
  let prisma: ReturnType<typeof createPrismaMock>;

  const notificationsService = {
    createAndPush: jest.fn(),
  };

  const mqttService = {
    getGatewayStatus: jest.fn(),
    getTelemetry: jest.fn(),
    checkOnline: jest.fn(),
    controlDevice: jest.fn(),
    controlDeviceAndWaitForAck: jest.fn(),
    sendDoorPasswordAndWaitForAck: jest.fn(),
    waitForStatusEvent: jest.fn(),
    sendDoorPassword: jest.fn(),
    runTestSequence: jest.fn(),
  };

  const mockDeviceDetail = (overrides = {}) => ({
    id: 'device-123',
    apartmentId: 'apt-123',
    deviceName: 'Smart Lock',
    deviceType: 'smart_lock',
    brand: 'ESP',
    model: 'ESP32',
    serialNumber: 'SN-123',
    macAddress: 'AA:BB:CC:DD:EE:FF',
    locationDescription: 'Front door',
    firmwareVersion: '1.0.0',
    status: IoTStatus.active,
    isControllableByTenant: true,
    lastOnlineAt: null,
    lastMaintenanceDate: null,
    nextMaintenanceDate: null,
    installationDate: new Date('2026-01-01'),
    warrantyExpiryDate: null,
    configuration: {
      vendor: 'ESP32',
      mqtt: {
        espId: 'ESP_A101',
        boardName: 'A101 Main Board',
        topic: 'door',
        deviceId: 1,
        state: 'OFF',
      },
    },
    accessLogsEnabled: true,
    notes: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    apartment: {
      id: 'apt-123',
      apartmentNumber: 'A101',
      streetAddress: '123 Nguyen Hue',
    },
    room: null,
    ...overrides,
  });

  const mockMeter = (overrides = {}) => ({
    id: 'meter-123',
    apartmentId: 'apt-123',
    meterNumber: 'E-001',
    meterType: 'electricity',
    currentReading: 1000,
    status: MeterStatus.active,
    apartment: {
      id: 'apt-123',
      apartmentNumber: 'A101',
      streetAddress: '123 Nguyen Hue',
    },
    readings: [],
    ...overrides,
  });

  const mockBoardSourceDevice = (overrides = {}) => ({
    id: 'device-123',
    apartmentId: 'apt-123',
    deviceName: 'Front Door Lock',
    deviceType: 'smart_lock',
    status: IoTStatus.active,
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
        state: 'OFF',
      },
    },
    apartment: {
      id: 'apt-123',
      apartmentNumber: 'A101',
      streetAddress: '123 Nguyen Hue',
    },
    room: null,
    ...overrides,
  });

  beforeEach(async () => {
    prisma = createPrismaMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IoTService,
        { provide: PrismaService, useValue: prisma },
        { provide: IoTMqttService, useValue: mqttService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get<IoTService>(IoTService);
    jest.clearAllMocks();
    notificationsService.createAndPush.mockResolvedValue({
      id: 'notification-123',
    });
    prisma.utilityMeter.findMany.mockResolvedValue([] as any);
  });

  describe('gateway helpers', () => {
    it('should proxy MQTT gateway status', () => {
      mqttService.getGatewayStatus.mockReturnValue({
        success: true,
        mqttConnected: true,
      });

      expect(service.getGatewayStatus()).toEqual({
        success: true,
        mqttConnected: true,
      });
    });

    it('should request telemetry and return simple online status for health checks', async () => {
      const now = Date.now();
      mqttService.getTelemetry.mockReturnValue({
        brokerUrl: 'mqtt://broker.hivemq.com:1883',
        topic: 'ESP_A101/get/telemetry',
        payload: 'GET_TELEMETRY',
        espId: 'ESP_A101',
        publishedAt: new Date('2026-03-30T00:00:00.000Z'),
      });
      mqttService.checkOnline.mockReturnValue({
        brokerUrl: 'mqtt://broker.hivemq.com:1883',
        topic: 'HOMEIQ/ESP_A101/status',
        payload: 'ARE_YOU_OK',
        espId: 'ESP_A101',
        publishedAt: new Date('2026-03-30T00:00:00.000Z'),
      });
      prisma.ioTBoard.findUnique.mockResolvedValue({
        id: 'ESP_A101',
        name: 'A101 Main Board',
        status: IoTStatus.active,
        lastOnlineAt: new Date(now - 10_000),
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-30T00:00:00.000Z'),
        apartment: null,
      } as any);
      prisma.ioTDevice.findMany.mockResolvedValue([
        mockBoardSourceDevice({
          lastOnlineAt: new Date(now - 5_000),
          configuration: {
            mqtt: {
              espId: 'ESP_A101',
              boardName: 'A101 Main Board',
              topic: 'door',
              deviceId: 1,
              state: 'OFF',
              lastMessage: 'ONLINE',
              lastMessageAt: new Date(now - 4_000).toISOString(),
              lastTelemetryMessage: '{"energy_total":12.5}',
              lastTelemetryAt: new Date(now - 3_000).toISOString(),
            },
          },
        }),
      ] as any);

      expect(service.requestTelemetry('ESP_A101')).toMatchObject({
        success: true,
        message: 'Telemetry request sent',
      });
      await expect(service.checkHealth('ESP_A101')).resolves.toMatchObject({
        espId: 'ESP_A101',
        online: true,
        lastSeenAt: expect.any(Date),
      });
    });

    it('should return offline when board has not been seen recently', async () => {
      mqttService.checkOnline.mockReturnValue({
        brokerUrl: 'mqtt://broker.hivemq.com:1883',
        topic: 'HOMEIQ/ESP_A101/status',
        payload: 'ARE_YOU_OK',
        espId: 'ESP_A101',
        publishedAt: new Date('2026-03-30T00:00:00.000Z'),
      });
      prisma.ioTBoard.findUnique.mockResolvedValue({
        id: 'ESP_A101',
        name: 'A101 Main Board',
        status: IoTStatus.active,
        lastOnlineAt: new Date(Date.now() - 120_000),
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-30T00:00:00.000Z'),
        apartment: null,
      } as any);
      prisma.ioTDevice.findMany.mockResolvedValue([
        mockBoardSourceDevice({
          lastOnlineAt: new Date(Date.now() - 120_000),
          configuration: {
            mqtt: {
              espId: 'ESP_A101',
              boardName: 'A101 Main Board',
              topic: 'door',
              deviceId: 1,
              state: 'OFF',
              lastMessage: 'ONLINE',
              lastMessageAt: new Date(Date.now() - 120_000).toISOString(),
            },
          },
        }),
      ] as any);

      await expect(service.checkHealth('ESP_A101')).resolves.toMatchObject({
        espId: 'ESP_A101',
        online: false,
        lastSeenAt: expect.any(Date),
      });
    });
  });

  describe('boards', () => {
    it('should group devices by MQTT board id', async () => {
      prisma.ioTDevice.findMany.mockResolvedValue([
        mockBoardSourceDevice(),
        mockBoardSourceDevice({
          id: 'device-456',
          deviceName: 'Living Room Light',
          deviceType: 'light',
          configuration: {
            mqtt: {
              espId: 'ESP_A101',
              boardName: 'A101 Main Board',
              topic: 'light',
              deviceId: 2,
              state: 'OFF',
            },
          },
        }),
      ] as any);

      const result = await service.findAllBoards();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'ESP_A101',
        name: 'A101 Main Board',
        deviceCount: 2,
      });
      expect(result[0].devices).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'device-123',
            topic: 'door',
            deviceId: 1,
            state: 'OFF',
          }),
          expect.objectContaining({
            id: 'device-456',
            topic: 'light',
            deviceId: 2,
            state: 'OFF',
          }),
        ]),
      );
      expect(result[0].devices[0]).not.toHaveProperty('mqttControlType');
      expect(result[0].devices[0]).not.toHaveProperty('mqttChannelId');
      expect(result[0].devices[0]).not.toHaveProperty('room');
    });

    it('should create a board and propagate board metadata to child devices', async () => {
      prisma.apartment.findUnique.mockResolvedValue({ id: 'apt-123' } as any);
      prisma.ioTBoard.findMany.mockResolvedValueOnce([] as any).mockResolvedValueOnce([
        {
          id: 'ESP_A101',
          name: 'A101 Main Board',
          status: IoTStatus.active,
          lastOnlineAt: null,
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
          updatedAt: new Date('2026-03-31T00:00:00.000Z'),
          apartment: {
            id: 'apt-123',
            apartmentNumber: 'A101',
            streetAddress: '123 Nguyen Hue',
          },
        },
      ] as any);
      prisma.ioTDevice.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          mockBoardSourceDevice(),
          mockBoardSourceDevice({
            id: 'device-456',
            deviceName: 'Living Room Light',
            deviceType: 'light',
            configuration: {
              mqtt: {
                espId: 'ESP_A101',
                boardName: 'A101 Main Board',
                topic: 'light',
                deviceId: 2,
              },
            },
          }),
        ] as any);
      prisma.$transaction.mockResolvedValue([
        { id: 'device-123' },
        { id: 'device-456' },
      ] as any);

      const result = await service.createBoard({
        boardId: 'ESP_A101',
        boardName: 'A101 Main Board',
        apartmentId: 'apt-123',
        devices: [
          {
            deviceName: 'Front Door Lock',
            mqttTopic: 'door',
            mqttDeviceId: 1,
            state: 'OFF',
          },
          {
            deviceName: 'Living Room Light',
            mqttTopic: 'light',
            mqttDeviceId: 2,
            state: 'OFF',
          },
        ],
      });

      expect(prisma.ioTDevice.create).toHaveBeenCalledTimes(2);
      expect(prisma.ioTDevice.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          data: expect.objectContaining({
            apartmentId: 'apt-123',
            configuration: expect.objectContaining({
              mqtt: expect.objectContaining({
                espId: 'ESP_A101',
                boardName: 'A101 Main Board',
                topic: 'door',
                deviceId: 1,
              }),
            }),
          }),
        }),
      );
      expect(result).toMatchObject({
        id: 'ESP_A101',
        name: 'A101 Main Board',
        deviceCount: 2,
      });
    });

    it('should create a board without requiring devices', async () => {
      prisma.apartment.findUnique.mockResolvedValue({ id: 'apt-123' } as any);
      prisma.ioTBoard.findUnique
        .mockResolvedValueOnce(null as any)
        .mockResolvedValueOnce({
          id: 'ESP_A101',
          name: 'ESP_A101',
          status: IoTStatus.active,
          lastOnlineAt: null,
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
          updatedAt: new Date('2026-03-31T00:00:00.000Z'),
          apartment: {
            id: 'apt-123',
            apartmentNumber: 'A101',
            streetAddress: '123 Nguyen Hue',
          },
        } as any);
      prisma.ioTDevice.findMany.mockResolvedValue([] as any);

      const result = await service.createBoard({
        id: 'ESP_A101',
        apartmentId: 'apt-123',
        devices: [],
      });

      expect(prisma.ioTBoard.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: 'ESP_A101',
            name: 'ESP_A101',
            apartmentId: 'apt-123',
          }),
        }),
      );
      expect(prisma.ioTDevice.create).not.toHaveBeenCalled();
      expect(result).toMatchObject({ id: 'ESP_A101', deviceCount: 0 });
    });

    it('should create an electricity utility meter when adding an electric utility board device', async () => {
      prisma.ioTBoard.findUnique.mockResolvedValue({
        id: 'ESP_A101',
        name: 'A101 Main Board',
        status: IoTStatus.active,
        lastOnlineAt: null,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-31T00:00:00.000Z'),
        apartment: {
          id: 'apt-123',
          apartmentNumber: 'A101',
          streetAddress: '123 Nguyen Hue',
        },
      } as any);
      prisma.ioTDevice.findMany
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce([
          mockBoardSourceDevice({
            id: 'device-electricity',
            deviceName: 'Electricity Meter',
            deviceType: 'sensor',
            configuration: {
              mqtt: {
                espId: 'ESP_A101',
                boardName: 'A101 Main Board',
                topic: 'electric',
                deviceId: 5,
                state: 'ON',
              },
            },
          }),
        ] as any);
      prisma.ioTDevice.create.mockResolvedValue({ id: 'device-electricity' } as any);
      prisma.utilityMeter.findFirst.mockResolvedValue(null as any);
      prisma.utilityMeter.create.mockResolvedValue({ id: 'meter-electricity' } as any);
      prisma.ioTDevice.findUnique.mockResolvedValue(
        mockDeviceDetail({
          id: 'device-electricity',
          deviceName: 'Electricity Meter',
          deviceType: 'sensor',
          configuration: {
            mqtt: {
              espId: 'ESP_A101',
              boardName: 'A101 Main Board',
              topic: 'electric',
              deviceId: 5,
              state: 'ON',
            },
          },
        }) as any,
      );
      prisma.utilityMeter.findMany.mockResolvedValue([
        mockMeter({
          id: 'meter-electricity',
          meterType: 'electricity',
          meterNumber: 'UTILITY-ESP_A101-electric-5',
          currentReading: 1200,
        }),
      ] as any);

      const result = await service.createBoardDevice('ESP_A101', {
        deviceName: 'Electricity Meter',
        topic: 'electric' as any,
        deviceId: 5,
        state: 'ON',
      });

      expect(prisma.utilityMeter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            apartmentId: 'apt-123',
            meterType: 'electricity',
            meterNumber: 'UTILITY-ESP_A101-electric-5',
          }),
        }),
      );
      expect(result).toMatchObject({
        id: 'device-electricity',
        mqttTopic: 'electric',
        isUtilityMeter: true,
        utilityMeterId: 'meter-electricity',
      });
    });

    it('should exclude utility devices from board devices response', async () => {
      prisma.ioTDevice.findMany.mockResolvedValue([
        mockBoardSourceDevice({
          id: 'device-door',
          deviceName: 'Front Door Lock',
          configuration: {
            mqtt: {
              espId: 'ESP_A101',
              boardName: 'A101 Main Board',
              topic: 'door',
              deviceId: 1,
              state: 'OFF',
            },
          },
        }),
        mockBoardSourceDevice({
          id: 'device-electric',
          deviceName: 'Electric Meter',
          deviceType: 'sensor',
          configuration: {
            mqtt: {
              espId: 'ESP_A101',
              boardName: 'A101 Main Board',
              topic: 'electric',
              deviceId: 5,
              state: 'ON',
            },
          },
        }),
      ] as any);

      const result = await service.findAllBoards();

      expect(result[0].devices).toHaveLength(1);
      expect(result[0].devices[0]).toMatchObject({
        id: 'device-door',
        deviceName: 'Front Door Lock',
        topic: 'door',
        deviceId: 1,
        state: 'OFF',
      });
      expect(result[0].devices.find((device) => device.id === 'device-electric')).toBeUndefined();
    });

    it('should return electric and water meters separately for an apartment', async () => {
      prisma.utilityMeter.findMany.mockResolvedValue([
        mockMeter({
          id: 'meter-electricity',
          meterType: 'electricity',
          meterNumber: 'UTILITY-ESP_A101-electric-5',
          currentReading: 1200,
          previousReading: 1100,
          ratePerUnit: 3500,
          unitOfMeasurement: 'kWh',
          readingDate: new Date('2026-04-15T00:00:00.000Z'),
        }),
        mockMeter({
          id: 'meter-water',
          meterType: 'water',
          meterNumber: 'UTILITY-ESP_A101-water-6',
          currentReading: 80,
          previousReading: 75,
          ratePerUnit: 12000,
          unitOfMeasurement: 'm3',
          readingDate: new Date('2026-04-15T00:00:00.000Z'),
        }),
      ] as any);

      const result = await service.findUtilityMeters(undefined, 'apt-123');

      expect(result).toMatchObject({
        boardId: null,
        apartmentId: 'apt-123',
        electric: {
          id: 'meter-electricity',
          meterType: 'electricity',
          currentReading: '1200',
        },
        water: {
          id: 'meter-water',
          meterType: 'water',
          currentReading: '80',
        },
      });
    });

    it('should resolve apartment from board id when listing utility meters', async () => {
      prisma.ioTBoard.findUnique.mockResolvedValue({
        id: 'ESP_A101',
        name: 'A101 Main Board',
        status: IoTStatus.active,
        lastOnlineAt: null,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-31T00:00:00.000Z'),
        apartment: {
          id: 'apt-123',
          apartmentNumber: 'A101',
          streetAddress: '123 Nguyen Hue',
        },
      } as any);
      prisma.ioTDevice.findMany.mockResolvedValue([
        mockBoardSourceDevice({
          id: 'device-door',
          deviceName: 'Front Door Lock',
        }),
      ] as any);
      prisma.utilityMeter.findMany.mockResolvedValue([
        mockMeter({
          id: 'meter-electricity',
          meterType: 'electricity',
          meterNumber: 'UTILITY-ESP_A101-electric-5',
        }),
      ] as any);

      const result = await service.findUtilityMeters('ESP_A101');

      expect(result.boardId).toBe('ESP_A101');
      expect(result.apartmentId).toBe('apt-123');
      expect(result.electric).toMatchObject({
        id: 'meter-electricity',
        meterType: 'electricity',
      });
      expect(result.water).toBeNull();
    });

    it('should accept legacy device name field when creating a board', async () => {
      prisma.apartment.findUnique.mockResolvedValue({ id: 'apt-123' } as any);
      prisma.ioTBoard.findMany.mockResolvedValueOnce([] as any).mockResolvedValueOnce([
        {
          id: 'ESP_A101',
          name: 'A101 Main Board',
          status: IoTStatus.active,
          lastOnlineAt: null,
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
          updatedAt: new Date('2026-03-31T00:00:00.000Z'),
          apartment: null,
        },
      ] as any);
      prisma.ioTDevice.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          mockBoardSourceDevice({
            configuration: {
              mqtt: {
                espId: 'ESP_A101',
                boardName: 'A101 Main Board',
                topic: 'door',
                deviceId: 1,
                state: 'OFF',
              },
            },
          }),
        ] as any);
      prisma.$transaction.mockResolvedValue([{ id: 'device-123' }] as any);

      await service.createBoard({
        id: 'ESP_A101',
        devices: [
          {
            name: 'Front Door Lock',
            mqttTopic: 'door',
            mqttDeviceId: 1,
            state: 'OFF',
          } as any,
        ],
      });

      expect(prisma.ioTDevice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deviceName: 'Front Door Lock',
          }),
        }),
      );
    });

    it('should fall back to device-derived boards when iot_boards table is missing', async () => {
      prisma.ioTBoard.findMany.mockRejectedValue(
        {
          code: 'P2021',
          message:
            'The table `public.iot_boards` does not exist in the current database.',
        } as any,
      );
      prisma.ioTDevice.findMany.mockResolvedValue([mockBoardSourceDevice()] as any);

      const result = await service.findAllBoards();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'ESP_A101',
        name: 'A101 Main Board',
        deviceCount: 1,
      });
    });

    it('should prefer stored board createdAt over derived device createdAt', async () => {
      prisma.ioTBoard.findMany.mockResolvedValue([
        {
          id: 'ESP_A101',
          name: 'A101 Main Board',
          status: IoTStatus.active,
          lastOnlineAt: null,
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
          updatedAt: new Date('2026-04-02T00:00:00.000Z'),
          apartment: null,
        },
      ] as any);
      prisma.ioTDevice.findMany.mockResolvedValue([
        mockBoardSourceDevice({
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
          updatedAt: new Date('2026-04-03T00:00:00.000Z'),
        }),
      ] as any);

      const result = await service.findAllBoards();

      expect(result[0].createdAt).toEqual(new Date('2026-04-01T00:00:00.000Z'));
      expect(result[0].updatedAt).toEqual(new Date('2026-04-03T00:00:00.000Z'));
    });

    it('should update board status and propagate it to child devices', async () => {
      prisma.ioTBoard.findUnique
        .mockResolvedValueOnce({
          id: 'ESP_A101',
          name: 'A101 Main Board',
          status: IoTStatus.active,
          lastOnlineAt: null,
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
          updatedAt: new Date('2026-04-02T00:00:00.000Z'),
          apartment: {
            id: 'apt-123',
            apartmentNumber: 'A101',
            streetAddress: '123 Nguyen Hue',
          },
        } as any)
        .mockResolvedValueOnce({
          id: 'ESP_A101',
          name: 'A101 Main Board',
          status: IoTStatus.inactive,
          lastOnlineAt: null,
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
          updatedAt: new Date('2026-04-03T00:00:00.000Z'),
          apartment: {
            id: 'apt-123',
            apartmentNumber: 'A101',
            streetAddress: '123 Nguyen Hue',
          },
        } as any);
      prisma.ioTDevice.findMany
        .mockResolvedValueOnce([mockBoardSourceDevice()] as any)
        .mockResolvedValueOnce([
          mockBoardSourceDevice({ status: IoTStatus.inactive }),
        ] as any);
      prisma.ioTBoard.upsert.mockResolvedValue({ id: 'ESP_A101' } as any);
      prisma.ioTDevice.updateMany.mockResolvedValue({ count: 1 } as any);

      const result = await service.updateBoard('ESP_A101', {
        status: IoTStatus.inactive,
      });

      expect(prisma.ioTBoard.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ESP_A101' },
          update: expect.objectContaining({
            apartmentId: 'apt-123',
            status: IoTStatus.inactive,
          }),
        }),
      );
      expect(prisma.ioTDevice.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['device-123'] } },
        data: { status: IoTStatus.inactive },
      });
      expect(result).toMatchObject({
        id: 'ESP_A101',
        status: IoTStatus.inactive,
        devices: [
          expect.objectContaining({
            id: 'device-123',
            status: IoTStatus.inactive,
          }),
        ],
      });
    });

    it('should allow linking an apartment to an unlinked board', async () => {
      prisma.apartment.findUnique.mockResolvedValue({ id: 'apt-456' } as any);
      prisma.ioTBoard.findUnique
        .mockResolvedValueOnce({
          id: 'ESP_A101',
          name: 'A101 Main Board',
          status: IoTStatus.active,
          lastOnlineAt: null,
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
          updatedAt: new Date('2026-04-02T00:00:00.000Z'),
          apartment: null,
        } as any)
        .mockResolvedValueOnce({
          id: 'ESP_A101',
          name: 'A101 Main Board',
          status: IoTStatus.active,
          lastOnlineAt: null,
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
          updatedAt: new Date('2026-04-03T00:00:00.000Z'),
          apartment: {
            id: 'apt-456',
            apartmentNumber: 'B202',
            streetAddress: '456 Le Loi',
          },
        } as any);
      prisma.ioTDevice.findMany
        .mockResolvedValueOnce([
          mockBoardSourceDevice({ apartmentId: null, apartment: null }),
        ] as any)
        .mockResolvedValueOnce([
          mockBoardSourceDevice({
            apartmentId: 'apt-456',
            apartment: {
              id: 'apt-456',
              apartmentNumber: 'B202',
              streetAddress: '456 Le Loi',
            },
          }),
        ] as any);
      prisma.ioTBoard.upsert.mockResolvedValue({ id: 'ESP_A101' } as any);
      prisma.ioTDevice.updateMany.mockResolvedValue({ count: 1 } as any);

      const result = await service.updateBoard('ESP_A101', {
        apartmentId: 'apt-456',
      });

      expect(prisma.ioTBoard.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ESP_A101' },
          update: expect.objectContaining({
            apartmentId: 'apt-456',
          }),
        }),
      );
      expect(prisma.ioTDevice.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['device-123'] } },
        data: { apartmentId: 'apt-456' },
      });
      expect(result).toMatchObject({
        id: 'ESP_A101',
        apartment: {
          id: 'apt-456',
          apartmentNumber: 'B202',
        },
      });
    });

    it('should reject linking a different apartment before unlinking the board', async () => {
      prisma.ioTBoard.findUnique.mockResolvedValue({
        id: 'ESP_A101',
        name: 'A101 Main Board',
        status: IoTStatus.active,
        lastOnlineAt: null,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-02T00:00:00.000Z'),
        apartment: {
          id: 'apt-123',
          apartmentNumber: 'A101',
          streetAddress: '123 Nguyen Hue',
        },
      } as any);
      prisma.ioTDevice.findMany.mockResolvedValue([
        mockBoardSourceDevice(),
      ] as any);

      await expect(
        service.updateBoard('ESP_A101', {
          apartmentId: 'apt-456',
        }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.apartment.findUnique).not.toHaveBeenCalled();
      expect(prisma.ioTBoard.upsert).not.toHaveBeenCalled();
      expect(prisma.ioTDevice.updateMany).not.toHaveBeenCalled();
    });

    it('should unlink apartment from a board and its devices', async () => {
      prisma.ioTBoard.findUnique.mockResolvedValue({
        id: 'ESP_A101',
        name: 'A101 Main Board',
        status: IoTStatus.active,
        lastOnlineAt: null,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-02T00:00:00.000Z'),
        apartment: {
          id: 'apt-123',
          apartmentNumber: 'A101',
          streetAddress: '123 Nguyen Hue',
        },
      } as any);
      prisma.ioTDevice.findMany.mockResolvedValue([
        mockBoardSourceDevice(),
        mockBoardSourceDevice({ id: 'device-456' }),
      ] as any);
      prisma.ioTBoard.updateMany.mockResolvedValue({ count: 1 } as any);
      prisma.ioTDevice.updateMany.mockResolvedValue({ count: 2 } as any);

      const result = await service.unlinkBoardApartment('ESP_A101');

      expect(prisma.ioTBoard.updateMany).toHaveBeenCalledWith({
        where: { id: 'ESP_A101' },
        data: { apartmentId: null },
      });
      expect(prisma.ioTDevice.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['device-123', 'device-456'] } },
        data: { apartmentId: null },
      });
      expect(result).toEqual({
        boardId: 'ESP_A101',
        boardName: 'A101 Main Board',
        previousApartmentId: 'apt-123',
        affectedDevices: 2,
      });
    });

    it('should unlink all boards by apartment id', async () => {
      prisma.apartment.findUnique.mockResolvedValue({ id: 'apt-123' } as any);
      prisma.ioTBoard.findMany.mockResolvedValue([
        {
          id: 'ESP_A101',
          name: 'A101 Main Board',
          status: IoTStatus.active,
          lastOnlineAt: null,
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
          updatedAt: new Date('2026-04-02T00:00:00.000Z'),
          apartment: {
            id: 'apt-123',
            apartmentNumber: 'A101',
            streetAddress: '123 Nguyen Hue',
          },
        },
      ] as any);
      prisma.ioTDevice.findMany.mockResolvedValue([
        mockBoardSourceDevice({ apartmentId: 'apt-123' }),
      ] as any);
      prisma.ioTBoard.updateMany.mockResolvedValue({ count: 1 } as any);
      prisma.ioTDevice.updateMany.mockResolvedValue({ count: 1 } as any);

      const result = await service.unlinkBoardsByApartment('apt-123');

      expect(prisma.ioTBoard.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['ESP_A101'] } },
        data: { apartmentId: null },
      });
      expect(prisma.ioTDevice.updateMany).toHaveBeenCalledWith({
        where: { apartmentId: 'apt-123' },
        data: { apartmentId: null },
      });
      expect(result).toEqual({
        apartmentId: 'apt-123',
        affectedBoards: 1,
        affectedDevices: 1,
      });
    });

    it('should reject duplicate board assignments on the same board', async () => {
      prisma.apartment.findUnique.mockResolvedValue({ id: 'apt-123' } as any);
      prisma.ioTDevice.findMany.mockResolvedValue([] as any);

      await expect(
        service.createBoard({
          boardId: 'ESP_A101',
          boardName: 'A101 Main Board',
          apartmentId: 'apt-123',
          devices: [
            {
              deviceName: 'Light 1',
              mqttTopic: 'light',
              mqttDeviceId: 1,
            },
            {
              deviceName: 'Light 2',
              mqttTopic: 'light',
              mqttDeviceId: 1,
            },
          ],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should update board child device status', async () => {
      prisma.ioTBoard.findUnique.mockResolvedValue({
        id: 'ESP_A101',
        name: 'A101 Main Board',
        status: IoTStatus.active,
        lastOnlineAt: null,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-02T00:00:00.000Z'),
        apartment: {
          id: 'apt-123',
          apartmentNumber: 'A101',
          streetAddress: '123 Nguyen Hue',
        },
      } as any);
      prisma.ioTDevice.findMany.mockResolvedValue([
        mockBoardSourceDevice({
          id: 'device-123',
          deviceName: 'Living Room Light',
          deviceType: 'light',
          configuration: {
            mqtt: {
              espId: 'ESP_A101',
              boardName: 'A101 Main Board',
              topic: 'light',
              deviceId: 2,
              state: 'OFF',
            },
          },
        }),
      ] as any);
      prisma.ioTDevice.findUnique
        .mockResolvedValueOnce({
          configuration: {
            mqtt: {
              espId: 'ESP_A101',
              boardName: 'A101 Main Board',
              topic: 'light',
              deviceId: 2,
              state: 'OFF',
            },
          },
        } as any)
        .mockResolvedValueOnce(
          mockDeviceDetail({
            id: 'device-123',
            deviceName: 'Living Room Light',
            deviceType: 'light',
            status: IoTStatus.inactive,
            configuration: {
              mqtt: {
                espId: 'ESP_A101',
                boardName: 'A101 Main Board',
                topic: 'light',
                deviceId: 2,
                state: 'OFF',
              },
            },
          }) as any,
        );
      prisma.ioTDevice.update.mockResolvedValue({ id: 'device-123' } as any);

      const result = await service.updateBoardDevice('ESP_A101', 'device-123', {
        status: IoTStatus.inactive,
      });

      expect(prisma.ioTDevice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'device-123' },
          data: expect.objectContaining({
            status: IoTStatus.inactive,
          }),
        }),
      );
      expect(result).toMatchObject({
        id: 'device-123',
        status: IoTStatus.inactive,
      });
    });
  });

  describe('createDevice', () => {
    it('should merge MQTT metadata into configuration', async () => {
      prisma.apartment.findUnique.mockResolvedValue({ id: 'apt-123' } as any);
      prisma.ioTDevice.create.mockResolvedValue({ id: 'device-123' } as any);
      prisma.ioTDevice.findUnique.mockResolvedValue(mockDeviceDetail() as any);

      const result = await service.createDevice({
        apartmentId: 'apt-123',
        deviceName: 'Smart Lock',
        deviceType: 'smart_lock' as any,
        configuration: { vendor: 'ESP32' },
        mqttEspId: 'ESP_A101',
        mqttBoardName: 'A101 Main Board',
        mqttTopic: 'door',
        mqttDeviceId: 1,
        mqttState: 'CLOSED',
      });

      expect(prisma.ioTDevice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            configuration: expect.objectContaining({
              vendor: 'ESP32',
              mqtt: {
                espId: 'ESP_A101',
                boardName: 'A101 Main Board',
                topic: 'door',
                deviceId: 1,
                state: 'CLOSED',
              },
            }),
          }),
        }),
      );
      expect(result.mqttEspId).toBe('ESP_A101');
      expect(result.mqttTopic).toBe('door');
      expect(result.mqttDeviceId).toBe(1);
      expect(result).not.toHaveProperty('room');
    });

    it('should reject partial MQTT metadata', async () => {
      prisma.apartment.findUnique.mockResolvedValue({ id: 'apt-123' } as any);

      await expect(
        service.createDevice({
          apartmentId: 'apt-123',
          deviceName: 'Lamp',
          deviceType: 'light' as any,
          mqttEspId: 'ESP_A101',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should ignore roomId in incoming payloads', async () => {
      prisma.apartment.findUnique.mockResolvedValue({ id: 'apt-123' } as any);
      prisma.ioTDevice.create.mockResolvedValue({ id: 'device-123' } as any);
      prisma.ioTDevice.findUnique.mockResolvedValue(mockDeviceDetail() as any);

      await service.createDevice({
        apartmentId: 'apt-123',
        deviceName: 'Smart Lock',
        deviceType: 'smart_lock' as any,
        roomId: 'room-123',
      } as any);

      expect(prisma.ioTDevice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            roomId: 'room-123',
          }),
        }),
      );
    });
  });

  describe('updateDevice', () => {
    it('should merge MQTT config with existing configuration', async () => {
      prisma.ioTDevice.findUnique.mockResolvedValueOnce({
        id: 'device-123',
        apartmentId: 'apt-123',
        configuration: {
          vendor: 'ESP32',
          mqtt: { espId: 'OLD', topic: 'door', deviceId: 1 },
        },
        apartment: {
          rentalContracts: [],
        },
      } as any);
      prisma.ioTDevice.update.mockResolvedValue({ id: 'device-123' } as any);
      prisma.ioTDevice.findUnique.mockResolvedValueOnce(
        mockDeviceDetail({
          configuration: {
            vendor: 'ESP32',
            mqtt: {
              espId: 'ESP_A101',
              topic: 'door',
              deviceId: 2,
              state: 'OPEN',
            },
          },
        }) as any,
      );

      const result = await service.updateDevice('device-123', {
        mqttEspId: 'ESP_A101',
        mqttDeviceId: 2,
        mqttState: 'OPEN',
      });

      expect(prisma.ioTDevice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            configuration: expect.objectContaining({
              vendor: 'ESP32',
              mqtt: expect.objectContaining({
                espId: 'ESP_A101',
                topic: 'door',
                deviceId: 2,
                state: 'OPEN',
              }),
            }),
          }),
        }),
      );
      expect(result.mqttDeviceId).toBe(2);
      expect(result.mqttState).toBe('ON');
    });

    it('should allow tenants to rename a device only', async () => {
      const user = mockUserJwtPayload();
      prisma.ioTDevice.findUnique.mockResolvedValueOnce({
        id: 'device-123',
        apartmentId: 'apt-123',
        configuration: {
          mqtt: { espId: 'ESP_A101', topic: 'door', deviceId: 1 },
        },
        apartment: {
          rentalContracts: [{ members: [{ userId: user.sub }] }],
        },
      } as any);
      prisma.ioTDevice.update.mockResolvedValue({ id: 'device-123' } as any);
      prisma.ioTDevice.findUnique.mockResolvedValueOnce(
        mockDeviceDetail({
          deviceName: 'Tên mới',
        }) as any,
      );

      const result = await service.updateDevice(
        'device-123',
        { deviceName: 'Tên mới' },
        user,
      );

      expect(result.deviceName).toBe('Tên mới');
    });

    it('should reject tenant updates beyond device name', async () => {
      const user = mockUserJwtPayload();
      prisma.ioTDevice.findUnique.mockResolvedValue({
        id: 'device-123',
        apartmentId: 'apt-123',
        configuration: {
          mqtt: { espId: 'ESP_A101', topic: 'door', deviceId: 1 },
        },
        apartment: {
          rentalContracts: [{ members: [{ userId: user.sub }] }],
        },
      } as any);

      await expect(
        service.updateDevice(
          'device-123',
          { deviceName: 'Tên mới', mqttState: 'OPEN' },
          user,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when device does not exist', async () => {
      prisma.ioTDevice.findUnique.mockResolvedValue(null);

      await expect(service.updateDevice('missing', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('controlDevice', () => {
    it('should map unlock command to ON for door topics', async () => {
      const user = mockUserJwtPayload();
      prisma.ioTDevice.findUnique.mockResolvedValue({
        id: 'device-123',
        deviceType: 'smart_lock',
        status: IoTStatus.active,
        isControllableByTenant: true,
        configuration: {
          mqtt: { espId: 'ESP_A101', topic: 'door', deviceId: 2 },
        },
        apartment: {
          rentalContracts: [
            { id: 'contract-1', members: [{ userId: user.sub }] },
          ],
        },
      } as any);
      mqttService.controlDevice.mockReturnValue({
        espId: 'ESP_A101',
        deviceTopic: 'door',
        deviceId: 2,
        topic: 'ESP_A101/door',
        payload: 'ON_2',
        action: 'ON',
        publishedAt: new Date('2026-03-30T00:00:00.000Z'),
      });

      const result = await service.controlDevice('device-123', 'unlock', user);

      expect(mqttService.controlDevice).toHaveBeenCalledWith(
        'ESP_A101',
        'ON',
        2,
        'door',
      );
      expect(result.mqttPayload).toBe('ON_2');
      expect(result.mqttTopic).toBe('door');
    });

    it('should allow unauthenticated control for end-to-end device testing', async () => {
      prisma.ioTDevice.findUnique.mockResolvedValue({
        id: 'device-123',
        deviceType: 'light',
        status: IoTStatus.active,
        isControllableByTenant: false,
        configuration: {
          mqtt: { espId: 'ESP_A101', topic: 'light', deviceId: 1 },
        },
        apartment: { rentalContracts: [] },
      } as any);
      mqttService.controlDevice.mockReturnValue({
        espId: 'ESP_A101',
        deviceTopic: 'light',
        deviceId: 1,
        topic: 'ESP_A101/light',
        payload: 'ON_1',
        action: 'ON',
        publishedAt: new Date('2026-03-30T00:00:00.000Z'),
      });

      const result = await service.controlDevice('device-123', 'ON');

      expect(mqttService.controlDevice).toHaveBeenCalledWith(
        'ESP_A101',
        'ON',
        1,
        'light',
      );
      expect(result.mqttPayload).toBe('ON_1');
    });

    it('should throw ForbiddenException when tenant cannot control the device', async () => {
      prisma.ioTDevice.findUnique.mockResolvedValue({
        id: 'device-123',
        deviceType: 'light',
        status: IoTStatus.active,
        isControllableByTenant: false,
        configuration: {
          mqtt: { espId: 'ESP_A101', topic: 'light', deviceId: 1 },
        },
        apartment: { rentalContracts: [] },
      } as any);

      await expect(
        service.controlDevice('device-123', 'ON', mockUserJwtPayload()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when MQTT metadata is missing', async () => {
      prisma.ioTDevice.findUnique.mockResolvedValue({
        id: 'device-123',
        deviceType: 'sensor',
        status: IoTStatus.active,
        isControllableByTenant: true,
        configuration: {},
        apartment: { rentalContracts: [] },
      } as any);

      await expect(
        service.controlDevice('device-123', 'ON', mockStaffJwtPayload()),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('direct MQTT wrappers', () => {
    it('should unlock door for authorized tenant via board door route', async () => {
      const user = mockUserJwtPayload();
      prisma.ioTBoard.findUnique.mockResolvedValue({
        id: 'ESP_A101',
        name: 'A101 Main Board',
        status: IoTStatus.active,
        lastOnlineAt: null,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-31T00:00:00.000Z'),
        apartment: {
          id: 'apt-123',
          apartmentNumber: 'A101',
          streetAddress: '123 Nguyen Hue',
        },
      } as any);
      prisma.ioTDevice.findMany.mockResolvedValue([
        mockBoardSourceDevice({
          id: 'door-device-1',
          configuration: {
            mqtt: {
              espId: 'ESP_A101',
              boardName: 'A101 Main Board',
              topic: 'door',
              deviceId: 1,
              state: 'OFF',
            },
          },
        }),
      ] as any);
      prisma.ioTDevice.findUnique.mockResolvedValue({
        id: 'door-device-1',
        configuration: {
          mqtt: {
            espId: 'ESP_A101',
            boardName: 'A101 Main Board',
            topic: 'door',
            deviceId: 1,
            state: 'OFF',
          },
        },
        deviceType: 'smart_lock',
      } as any);
      prisma.userApartment.findFirst.mockResolvedValue({
        id: 'ua-1',
        isPrimaryTenant: true,
      } as any);
      mqttService.controlDeviceAndWaitForAck.mockResolvedValue({
        dispatch: {
          brokerUrl: 'mqtt://broker.hivemq.com:1883',
          topic: 'ESP_A101/door',
          payload: 'ON_1',
          espId: 'ESP_A101',
          deviceTopic: 'door',
          deviceId: 1,
          action: 'ON',
          publishedAt: new Date('2026-03-30T00:00:00.000Z'),
        },
        statusEvent: {
          espId: 'ESP_A101',
          rawTopic: 'HOMEIQ/ESP_A101/status',
          message: 'DOOR_1_OPEN',
          receivedAt: new Date('2026-03-30T00:00:01.000Z'),
          type: 'device_state',
          deviceTopic: 'door',
          deviceId: 1,
          state: 'OPEN',
        },
        timeoutMs: 7000,
        timedOut: false,
      });

      await expect(
        service.controlDoor('ESP_A101', 1, 'UNLOCK', user),
      ).resolves.toMatchObject({ success: true });
    });

    it('should unlock door with valid PIN', async () => {
      const user = mockUserJwtPayload();
      const pinHash = await bcrypt.hash('258036', 4);

      prisma.ioTBoard.findUnique.mockResolvedValue({
        id: 'ESP_A101',
        name: 'A101 Main Board',
        status: IoTStatus.active,
        lastOnlineAt: null,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-31T00:00:00.000Z'),
        apartment: {
          id: 'apt-123',
          apartmentNumber: 'A101',
          streetAddress: '123 Nguyen Hue',
        },
      } as any);
      prisma.ioTDevice.findMany.mockResolvedValue([
        mockBoardSourceDevice({
          id: 'door-device-1',
          configuration: {
            mqtt: {
              espId: 'ESP_A101',
              boardName: 'A101 Main Board',
              topic: 'door',
              deviceId: 1,
              state: 'OFF',
              pinHash,
            },
          },
        }),
      ] as any);
      prisma.ioTDevice.findUnique.mockResolvedValue({
        id: 'door-device-1',
        configuration: {
          mqtt: {
            espId: 'ESP_A101',
            boardName: 'A101 Main Board',
            topic: 'door',
            deviceId: 1,
            state: 'OFF',
            pinHash,
          },
        },
        deviceType: 'smart_lock',
      } as any);
      prisma.userApartment.findFirst.mockResolvedValue({
        id: 'ua-1',
        isPrimaryTenant: true,
      } as any);
      mqttService.controlDeviceAndWaitForAck.mockResolvedValue({
        dispatch: {
          brokerUrl: 'mqtt://broker.hivemq.com:1883',
          topic: 'ESP_A101/door',
          payload: 'ON_1',
          espId: 'ESP_A101',
          deviceTopic: 'door',
          deviceId: 1,
          action: 'ON',
          publishedAt: new Date('2026-03-30T00:00:00.000Z'),
        },
        statusEvent: {
          espId: 'ESP_A101',
          rawTopic: 'HOMEIQ/ESP_A101/status',
          message: 'DOOR_1_OPEN',
          receivedAt: new Date('2026-03-30T00:00:01.000Z'),
          type: 'device_state',
          deviceTopic: 'door',
          deviceId: 1,
          state: 'OPEN',
        },
        timeoutMs: 7000,
        timedOut: false,
      });

      await expect(
        service.unlockDoor('ESP_A101', 1, '258036', user),
      ).resolves.toMatchObject({ success: true });
      expect(mqttService.controlDeviceAndWaitForAck).toHaveBeenCalledWith(
        'ESP_A101',
        'ON',
        1,
        'door',
        7000,
      );
    });

    it('should not unlock door when PIN is invalid', async () => {
      const user = mockUserJwtPayload();
      const pinHash = await bcrypt.hash('258036', 4);

      prisma.ioTBoard.findUnique.mockResolvedValue({
        id: 'ESP_A101',
        name: 'A101 Main Board',
        status: IoTStatus.active,
        lastOnlineAt: null,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-31T00:00:00.000Z'),
        apartment: {
          id: 'apt-123',
          apartmentNumber: 'A101',
          streetAddress: '123 Nguyen Hue',
        },
      } as any);
      prisma.ioTDevice.findMany.mockResolvedValue([
        mockBoardSourceDevice({
          id: 'door-device-1',
          configuration: {
            mqtt: {
              espId: 'ESP_A101',
              boardName: 'A101 Main Board',
              topic: 'door',
              deviceId: 1,
              state: 'OFF',
              pinHash,
            },
          },
        }),
      ] as any);
      prisma.ioTDevice.findUnique.mockResolvedValue({
        id: 'door-device-1',
        configuration: {
          mqtt: {
            espId: 'ESP_A101',
            boardName: 'A101 Main Board',
            topic: 'door',
            deviceId: 1,
            state: 'OFF',
            pinHash,
          },
        },
        deviceType: 'smart_lock',
      } as any);
      prisma.userApartment.findFirst.mockResolvedValue({
        id: 'ua-1',
        isPrimaryTenant: true,
      } as any);

      await expect(
        service.unlockDoor('ESP_A101', 1, '000000', user),
      ).resolves.toEqual({
        success: false,
        message: 'Invalid door PIN.',
      });
      expect(mqttService.controlDeviceAndWaitForAck).not.toHaveBeenCalled();
    });

    it('should update door PIN for primary tenant when board ack succeeds', async () => {
      const user = mockUserJwtPayload();
      const pinHash = await bcrypt.hash('258036', 4);

      prisma.ioTBoard.findUnique.mockResolvedValue({
        id: 'ESP_A101',
        name: 'A101 Main Board',
        status: IoTStatus.active,
        lastOnlineAt: null,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-31T00:00:00.000Z'),
        apartment: {
          id: 'apt-123',
          apartmentNumber: 'A101',
          streetAddress: '123 Nguyen Hue',
        },
      } as any);
      prisma.ioTDevice.findMany.mockResolvedValue([
        mockBoardSourceDevice({
          id: 'door-device-1',
          configuration: {
            mqtt: {
              espId: 'ESP_A101',
              boardName: 'A101 Main Board',
              topic: 'door',
              deviceId: 1,
              state: 'OFF',
              pinHash,
            },
          },
        }),
      ] as any);
      prisma.ioTDevice.findUnique.mockResolvedValue({
        id: 'door-device-1',
        configuration: {
          mqtt: {
            espId: 'ESP_A101',
            boardName: 'A101 Main Board',
            topic: 'door',
            deviceId: 1,
            state: 'OFF',
            pinHash,
          },
        },
        deviceType: 'smart_lock',
      } as any);
      prisma.userApartment.findFirst.mockResolvedValue({
        id: 'ua-1',
        isPrimaryTenant: true,
      } as any);
      prisma.ioTDevice.update.mockResolvedValue({ id: 'door-device-1' } as any);
      prisma.activityLog.create.mockResolvedValue({ id: 'log-1' } as any);
      mqttService.sendDoorPasswordAndWaitForAck.mockResolvedValue({
        dispatch: {
          brokerUrl: 'mqtt://broker.hivemq.com:1883',
          topic: 'ESP_A101/get/door-password',
          payload: '290304',
          espId: 'ESP_A101',
          publishedAt: new Date('2026-03-30T00:00:00.000Z'),
          doorId: 1,
          password: '290304',
        },
        statusEvent: {
          espId: 'ESP_A101',
          rawTopic: 'HOMEIQ/ESP_A101/status',
          message: 'PIN_UPDATED_OK_DOOR_1',
          receivedAt: new Date('2026-03-30T00:00:01.000Z'),
          type: 'door_pin_update',
          deviceTopic: 'door',
          deviceId: 1,
          state: 'PIN_UPDATED',
          pinUpdateResult: 'success',
        },
        timeoutMs: 7000,
        timedOut: false,
      });

      await expect(
        service.updateDoorPin('ESP_A101', 1, '258036', '290304', user),
      ).resolves.toMatchObject({ success: true });
      expect(mqttService.sendDoorPasswordAndWaitForAck).toHaveBeenCalledWith(
        'ESP_A101',
        1,
        '290304',
      );
    });

    it('should accept door PIN ack without deviceId (legacy PWD_UPDATED format)', async () => {
      const user = mockUserJwtPayload();
      const pinHash = await bcrypt.hash('258036', 4);

      prisma.ioTBoard.findUnique.mockResolvedValue({
        id: 'ESP_A101',
        name: 'A101 Main Board',
        status: IoTStatus.active,
        lastOnlineAt: null,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-31T00:00:00.000Z'),
        apartment: {
          id: 'apt-123',
          apartmentNumber: 'A101',
          streetAddress: '123 Nguyen Hue',
        },
      } as any);
      prisma.ioTDevice.findMany.mockResolvedValue([
        mockBoardSourceDevice({
          id: 'door-device-1',
          configuration: {
            mqtt: {
              espId: 'ESP_A101',
              boardName: 'A101 Main Board',
              topic: 'door',
              deviceId: 1,
              state: 'OFF',
              pinHash,
            },
          },
        }),
      ] as any);
      prisma.ioTDevice.findUnique.mockResolvedValue({
        id: 'door-device-1',
        configuration: {
          mqtt: {
            espId: 'ESP_A101',
            boardName: 'A101 Main Board',
            topic: 'door',
            deviceId: 1,
            state: 'OFF',
            pinHash,
          },
        },
        deviceType: 'smart_lock',
      } as any);
      prisma.userApartment.findFirst.mockResolvedValue({
        id: 'ua-1',
        isPrimaryTenant: true,
      } as any);
      prisma.ioTDevice.update.mockResolvedValue({ id: 'door-device-1' } as any);
      prisma.activityLog.create.mockResolvedValue({ id: 'log-1' } as any);
      mqttService.sendDoorPasswordAndWaitForAck.mockResolvedValue({
        dispatch: {
          brokerUrl: 'mqtt://broker.hivemq.com:1883',
          topic: 'ESP_A101/get/door-password',
          payload: '290304',
          espId: 'ESP_A101',
          publishedAt: new Date('2026-03-30T00:00:00.000Z'),
          doorId: 1,
          password: '290304',
        },
        statusEvent: {
          espId: 'ESP_A101',
          rawTopic: 'HOMEIQ/ESP_A101/status',
          message: 'PWD_UPDATED',
          receivedAt: new Date('2026-03-30T00:00:01.000Z'),
          type: 'door_pin_update',
          deviceTopic: 'door',
          state: 'PIN_UPDATED',
          pinUpdateResult: 'success',
        },
        timeoutMs: 7000,
        timedOut: false,
      });

      await expect(
        service.updateDoorPin('ESP_A101', 1, '258036', '290304', user),
      ).resolves.toMatchObject({ success: true });
    });

    it('should allow first-time door PIN setup without oldPin when no pinHash exists', async () => {
      const user = mockUserJwtPayload();

      prisma.ioTBoard.findUnique.mockResolvedValue({
        id: 'ESP_A101',
        name: 'A101 Main Board',
        status: IoTStatus.active,
        lastOnlineAt: null,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-31T00:00:00.000Z'),
        apartment: {
          id: 'apt-123',
          apartmentNumber: 'A101',
          streetAddress: '123 Nguyen Hue',
        },
      } as any);
      prisma.ioTDevice.findMany.mockResolvedValue([
        mockBoardSourceDevice({
          id: 'door-device-1',
          configuration: {
            mqtt: {
              espId: 'ESP_A101',
              boardName: 'A101 Main Board',
              topic: 'door',
              deviceId: 1,
              state: 'OFF',
              pinHash: null,
            },
          },
        }),
      ] as any);
      prisma.ioTDevice.findUnique.mockResolvedValue({
        id: 'door-device-1',
        configuration: {
          mqtt: {
            espId: 'ESP_A101',
            boardName: 'A101 Main Board',
            topic: 'door',
            deviceId: 1,
            state: 'OFF',
            pinHash: null,
          },
        },
        deviceType: 'smart_lock',
      } as any);
      prisma.userApartment.findFirst.mockResolvedValue({
        id: 'ua-1',
        isPrimaryTenant: true,
      } as any);
      prisma.ioTDevice.update.mockResolvedValue({ id: 'door-device-1' } as any);
      prisma.activityLog.create.mockResolvedValue({ id: 'log-1' } as any);
      mqttService.sendDoorPasswordAndWaitForAck.mockResolvedValue({
        dispatch: {
          brokerUrl: 'mqtt://broker.hivemq.com:1883',
          topic: 'ESP_A101/get/door-password',
          payload: '290304',
          espId: 'ESP_A101',
          publishedAt: new Date('2026-03-30T00:00:00.000Z'),
          doorId: 1,
          password: '290304',
        },
        statusEvent: {
          espId: 'ESP_A101',
          rawTopic: 'HOMEIQ/ESP_A101/status',
          message: 'PIN_UPDATED_OK_DOOR_1',
          receivedAt: new Date('2026-03-30T00:00:01.000Z'),
          type: 'door_pin_update',
          deviceTopic: 'door',
          deviceId: 1,
          state: 'PIN_UPDATED',
          pinUpdateResult: 'success',
        },
        timeoutMs: 7000,
        timedOut: false,
      });

      await expect(
        service.updateDoorPin('ESP_A101', 1, undefined, '290304', user),
      ).resolves.toMatchObject({ success: true });
      expect(mqttService.sendDoorPasswordAndWaitForAck).toHaveBeenCalledWith(
        'ESP_A101',
        1,
        '290304',
      );
    });

    it('should reject door PIN update when old PIN does not match', async () => {
      const user = mockUserJwtPayload();
      const pinHash = await bcrypt.hash('258036', 4);

      prisma.ioTBoard.findUnique.mockResolvedValue({
        id: 'ESP_A101',
        name: 'A101 Main Board',
        status: IoTStatus.active,
        lastOnlineAt: null,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-31T00:00:00.000Z'),
        apartment: {
          id: 'apt-123',
          apartmentNumber: 'A101',
          streetAddress: '123 Nguyen Hue',
        },
      } as any);
      prisma.ioTDevice.findMany.mockResolvedValue([
        mockBoardSourceDevice({
          id: 'door-device-1',
          configuration: {
            mqtt: {
              espId: 'ESP_A101',
              boardName: 'A101 Main Board',
              topic: 'door',
              deviceId: 1,
              state: 'OFF',
              pinHash,
            },
          },
        }),
      ] as any);
      prisma.ioTDevice.findUnique.mockResolvedValue({
        id: 'door-device-1',
        configuration: {
          mqtt: {
            espId: 'ESP_A101',
            boardName: 'A101 Main Board',
            topic: 'door',
            deviceId: 1,
            state: 'OFF',
            pinHash,
          },
        },
        deviceType: 'smart_lock',
      } as any);
      prisma.userApartment.findFirst.mockResolvedValue({
        id: 'ua-1',
        isPrimaryTenant: true,
      } as any);

      await expect(
        service.updateDoorPin('ESP_A101', 1, '000000', '290304', user),
      ).rejects.toThrow(BadRequestException);
    });

    it('should list door history from activity logs', async () => {
      prisma.activityLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          actorType: 'system',
          actorId: 'ESP_A101',
          action: 'IOT_DOOR_OPENED',
          entityId: 'ESP_A101',
          description: 'Door 1 on board ESP_A101 opened',
          status: 'success',
          metadata: {
            apartmentId: 'apt-123',
            deviceId: 1,
          },
          createdAt: new Date('2026-04-20T10:00:00.000Z'),
        },
      ] as any);
      prisma.activityLog.count.mockResolvedValue(1 as any);

      const result = await service.findDoorHistory({
        boardId: 'ESP_A101',
        limit: 10,
      });

      expect(prisma.activityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entityId: 'ESP_A101',
          }),
          take: 10,
        }),
      );
      expect(result).toMatchObject({
        total: 1,
        limit: 10,
        items: [
          expect.objectContaining({
            action: 'IOT_DOOR_OPENED',
            boardId: 'ESP_A101',
            apartmentId: 'apt-123',
            deviceId: 1,
          }),
        ],
      });
    });

    it('should allow users to view door history for their own apartment', async () => {
      const user = mockUserJwtPayload();
      prisma.userApartment.findMany.mockResolvedValue([
        { apartmentId: 'apt-123' },
      ] as any);
      prisma.activityLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          actorType: 'system',
          actorId: 'ESP_A101',
          action: 'IOT_DOOR_OPENED',
          entityId: 'ESP_A101',
          description: 'Door opened',
          status: 'success',
          metadata: {
            apartmentId: 'apt-123',
            deviceId: 1,
          },
          createdAt: new Date('2026-04-20T10:00:00.000Z'),
        },
      ] as any);
      prisma.activityLog.count.mockResolvedValue(1 as any);

      const result = await service.findDoorHistory(
        {
          apartmentId: 'apt-123',
          limit: 20,
        },
        user,
      );

      expect(prisma.userApartment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: user.sub,
            apartmentId: 'apt-123',
            status: 'active',
          }),
        }),
      );
      expect(prisma.activityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              {
                metadata: {
                  path: ['apartmentId'],
                  equals: 'apt-123',
                },
              },
            ],
          }),
        }),
      );
      expect(result.total).toBe(1);
    });

    it('should reject users viewing door history outside their apartment membership', async () => {
      const user = mockUserJwtPayload();
      prisma.userApartment.findMany.mockResolvedValue([] as any);

      await expect(
        service.findDoorHistory(
          {
            apartmentId: 'apt-999',
            limit: 20,
          },
          user,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.activityLog.findMany).not.toHaveBeenCalled();
    });

    it('should fail apartment PIN sync when apartment has no door device', async () => {
      jest.spyOn(service, 'findAllBoards').mockResolvedValue([
        {
          id: 'ESP_A101',
          apartment: {
            id: 'apt-123',
            apartmentNumber: 'A101',
            address: '123 Nguyen Hue',
          },
          devices: [
            {
              id: 'device-light-1',
              deviceId: 2,
              topic: 'light',
            },
          ],
        },
      ] as any);

      await expect(
        service.syncApartmentDoorPin('apt-123', '250304'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should fail apartment PIN reset when apartment has no door device', async () => {
      jest.spyOn(service, 'findAllBoards').mockResolvedValue([] as any);

      await expect(
        service.clearApartmentDoorPinHash('apt-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return success only when board ack state matches requested action', async () => {
      prisma.ioTBoard.findUnique.mockResolvedValue({
        id: 'ESP_A101',
        name: 'A101 Main Board',
        status: IoTStatus.active,
        lastOnlineAt: null,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-31T00:00:00.000Z'),
        apartment: null,
      } as any);
      prisma.ioTDevice.findMany.mockResolvedValue([
        mockBoardSourceDevice({
          id: 'device-light-1',
          deviceName: 'Light 1',
          deviceType: 'light',
          configuration: {
            mqtt: {
              espId: 'ESP_A101',
              boardName: 'A101 Main Board',
              topic: 'light',
              deviceId: 1,
              state: 'OFF',
            },
          },
          apartment: null,
        }),
      ] as any);
      mqttService.controlDeviceAndWaitForAck.mockResolvedValue({
        dispatch: {
          brokerUrl: 'mqtt://broker.hivemq.com:1883',
          topic: 'ESP_A101/light',
          payload: 'ON_1',
          espId: 'ESP_A101',
          deviceTopic: 'light',
          deviceId: 1,
          action: 'ON',
          publishedAt: new Date('2026-03-30T00:00:00.000Z'),
        },
        statusEvent: {
          espId: 'ESP_A101',
          rawTopic: 'HOMEIQ/ESP_A101/status',
          message: 'LIGHT_1_ON',
          receivedAt: new Date('2026-03-30T00:00:01.000Z'),
          type: 'device_state',
          deviceTopic: 'light',
          deviceId: 1,
          state: 'ON',
        },
        timeoutMs: 7000,
        timedOut: false,
      });

      await expect(
        service.controlBoardDevice('ESP_A101', 1, 'light', 'ON'),
      ).resolves.toMatchObject({
        success: true,
      });
    });

    it('should return failure when board does not respond with expected state', async () => {
      prisma.ioTBoard.findUnique.mockResolvedValue({
        id: 'ESP_A101',
        name: 'A101 Main Board',
        status: IoTStatus.active,
        lastOnlineAt: null,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-31T00:00:00.000Z'),
        apartment: null,
      } as any);
      prisma.ioTDevice.findMany.mockResolvedValue([
        mockBoardSourceDevice({
          id: 'device-light-1',
          deviceName: 'Light 1',
          deviceType: 'light',
          configuration: {
            mqtt: {
              espId: 'ESP_A101',
              boardName: 'A101 Main Board',
              topic: 'light',
              deviceId: 1,
              state: 'OFF',
            },
          },
          apartment: null,
        }),
      ] as any);
      mqttService.controlDeviceAndWaitForAck.mockResolvedValue({
        dispatch: {
          brokerUrl: 'mqtt://broker.hivemq.com:1883',
          topic: 'ESP_A101/light',
          payload: 'ON_1',
          espId: 'ESP_A101',
          deviceTopic: 'light',
          deviceId: 1,
          action: 'ON',
          publishedAt: new Date('2026-03-30T00:00:00.000Z'),
        },
        statusEvent: {
          espId: 'ESP_A101',
          rawTopic: 'HOMEIQ/ESP_A101/status',
          message: 'LIGHT_1_OFF',
          receivedAt: new Date('2026-03-30T00:00:01.000Z'),
          type: 'device_state',
          deviceTopic: 'light',
          deviceId: 1,
          state: 'OFF',
        },
        timeoutMs: 7000,
        timedOut: false,
      });

      await expect(
        service.controlBoardDevice('ESP_A101', 1, 'light', 'ON'),
      ).resolves.toMatchObject({
        success: false,
      });
    });

    it('should publish light command through generic MQTT service', () => {
      mqttService.controlDeviceAndWaitForAck.mockResolvedValue({
        dispatch: {
          topic: 'ESP_A101/light',
          payload: 'ON_1',
          espId: 'ESP_A101',
          deviceTopic: 'light',
          deviceId: 1,
          action: 'ON',
          publishedAt: new Date('2026-03-30T00:00:00.000Z'),
        },
        statusEvent: {
          espId: 'ESP_A101',
          rawTopic: 'HOMEIQ/ESP_A101/status',
          message: 'LIGHT_1_ON',
          receivedAt: new Date('2026-03-30T00:00:01.000Z'),
          type: 'device_state',
          deviceTopic: 'light',
          deviceId: 1,
          state: 'ON',
        },
        timeoutMs: 7000,
        timedOut: false,
      });

      return expect(service.triggerLight('ESP_A101', 1, 'ON')).resolves.toMatchObject({
        success: true,
      });
    });

    it('should proxy test sequence execution', async () => {
      mqttService.runTestSequence.mockResolvedValue({
        success: true,
        steps: [],
      });

      await expect(
        service.runDeviceTestSequence('ESP_A101', 500),
      ).resolves.toEqual({
        success: true,
        steps: [],
      });
      expect(mqttService.runTestSequence).toHaveBeenCalledWith('ESP_A101', 500);
    });
  });

  describe('findAllMeters', () => {
    it('should return all meters', async () => {
      prisma.utilityMeter.findMany.mockResolvedValue([mockMeter()] as any);

      const result = await service.findAllMeters();

      expect(result).toHaveLength(1);
      expect(result[0].apartment.address).toBe('123 Nguyen Hue');
    });
  });

  describe('createReading', () => {
    it('should create reading and update meter snapshot', async () => {
      prisma.utilityMeter.findUnique.mockResolvedValue(mockMeter() as any);
      prisma.utilityReading.create.mockResolvedValue({
        id: 'reading-1',
        readingValue: 1100,
        consumption: 100,
      } as any);
      prisma.utilityMeter.update.mockResolvedValue({} as any);

      const result = await service.createReading(
        {
          utilityMeterId: 'meter-123',
          readingValue: 1100,
          readingDate: '2026-02-08',
        } as any,
        mockStaffJwtPayload(),
      );

      expect(result.readingValue).toBe(1100);
      expect(prisma.utilityMeter.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currentReading: 1100,
          }),
        }),
      );
    });

    it('should throw NotFoundException if meter is missing', async () => {
      prisma.utilityMeter.findUnique.mockResolvedValue(null);

      await expect(
        service.createReading(
          {
            utilityMeterId: 'missing',
            readingValue: 1100,
            readingDate: '2026-02-08',
          } as any,
          mockStaffJwtPayload(),
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('mqtt event handlers', () => {
    it('should update device runtime state on MQTT status events', async () => {
      prisma.ioTDevice.findMany.mockResolvedValue([
        {
          id: 'device-123',
          apartmentId: 'apt-123',
          deviceType: 'smart_lock',
          configuration: {
            mqtt: {
              espId: 'ESP_A101',
              topic: 'door',
              deviceId: 1,
              state: 'OFF',
            },
          },
        },
      ] as any);
      prisma.ioTDevice.update.mockResolvedValue({ id: 'device-123' } as any);

      await service.onMqttStatusEvent({
        espId: 'ESP_A101',
        rawTopic: 'HOMEIQ/ESP_A101/status',
        message: 'DOOR_1_OPEN',
        receivedAt: new Date('2026-04-01T00:00:00.000Z'),
        type: 'device_state',
        deviceTopic: 'door',
        deviceId: 1,
        state: 'OPEN',
      });

      expect(prisma.ioTDevice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastOnlineAt: new Date('2026-04-01T00:00:00.000Z'),
            configuration: expect.objectContaining({
              mqtt: expect.objectContaining({
                state: 'ON',
                lastMessage: 'DOOR_1_OPEN',
              }),
            }),
          }),
        }),
      );
      expect(prisma.activityLog.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            expect.objectContaining({
              action: 'IOT_DOOR_OPENED',
              actorType: 'system',
              actorId: 'ESP_A101',
            }),
          ],
        }),
      );
    });

    it('should notify active residents when a fire alert is detected', async () => {
      prisma.ioTDevice.findMany.mockResolvedValue([
        {
          id: 'device-123',
          apartmentId: 'apt-123',
          deviceType: 'alarm',
          configuration: {
            mqtt: {
              espId: 'ESP_A101',
              topic: 'alarm',
              deviceId: 3,
              state: 'OFF',
            },
          },
        },
      ] as any);
      prisma.ioTDevice.update.mockResolvedValue({ id: 'device-123' } as any);
      prisma.userApartment.findMany.mockResolvedValue([
        {
          apartmentId: 'apt-123',
          userId: 'user-123',
          apartment: {
            apartmentNumber: 'A101',
            streetAddress: '123 Nguyen Hue',
          },
        },
        {
          apartmentId: 'apt-123',
          userId: 'user-456',
          apartment: {
            apartmentNumber: 'A101',
            streetAddress: '123 Nguyen Hue',
          },
        },
      ] as any);

      await service.onMqttStatusEvent({
        espId: 'ESP_A101',
        rawTopic: 'HOMEIQ/ESP_A101/status',
        message: 'FIRE',
        receivedAt: new Date('2026-04-24T06:38:29.000Z'),
        type: 'fire',
        deviceTopic: 'alarm',
        state: 'FIRE',
      });

      expect(prisma.userApartment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            apartmentId: { in: ['apt-123'] },
            status: 'active',
          }),
        }),
      );
      expect(notificationsService.createAndPush).toHaveBeenCalledTimes(2);
      expect(notificationsService.createAndPush).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          recipientType: 'user',
          recipientId: 'user-123',
          notificationType: 'error',
          channel: 'in_app',
          priority: 'high',
          title: 'Fire alert detected',
          message: expect.stringContaining('apartment A101'),
          actionUrl: '/apartments/apt-123',
          relatedEntityType: 'Apartment',
          relatedEntityId: 'apt-123',
        }),
      );
    });

    it('should suppress duplicate fire notifications during the cooldown window', async () => {
      prisma.ioTDevice.findMany.mockResolvedValue([
        {
          id: 'device-123',
          apartmentId: 'apt-123',
          deviceType: 'alarm',
          configuration: {
            mqtt: {
              espId: 'ESP_A101',
              topic: 'alarm',
              deviceId: 3,
              state: 'OFF',
            },
          },
        },
      ] as any);
      prisma.ioTDevice.update.mockResolvedValue({ id: 'device-123' } as any);
      prisma.userApartment.findMany.mockResolvedValue([
        {
          apartmentId: 'apt-123',
          userId: 'user-123',
          apartment: {
            apartmentNumber: 'A101',
            streetAddress: '123 Nguyen Hue',
          },
        },
      ] as any);

      await service.onMqttStatusEvent({
        espId: 'ESP_A101',
        rawTopic: 'HOMEIQ/ESP_A101/status',
        message: 'FIRE',
        receivedAt: new Date('2026-04-24T06:38:29.000Z'),
        type: 'fire',
        deviceTopic: 'alarm',
        state: 'FIRE',
      });
      await service.onMqttStatusEvent({
        espId: 'ESP_A101',
        rawTopic: 'HOMEIQ/ESP_A101/status',
        message: 'FIRE_ACK',
        receivedAt: new Date('2026-04-24T06:38:45.000Z'),
        type: 'fire_ack',
        deviceTopic: 'alarm',
        state: 'FIRE_ACK',
      });

      expect(notificationsService.createAndPush).toHaveBeenCalledTimes(1);
      expect(prisma.userApartment.findMany).toHaveBeenCalledTimes(1);
    });

    it('should sync telemetry into automatic utility readings', async () => {
      prisma.ioTDevice.findMany.mockResolvedValue([
        {
          id: 'device-123',
          apartmentId: 'apt-123',
          deviceType: 'light',
          configuration: {
            mqtt: { espId: 'ESP_A101', topic: 'light', deviceId: 1 },
          },
        },
      ] as any);
      prisma.ioTDevice.update.mockResolvedValue({ id: 'device-123' } as any);
      prisma.utilityMeter.findFirst.mockResolvedValue({
        id: 'meter-123',
        currentReading: 100,
      } as any);
      prisma.utilityReading.create.mockResolvedValue({
        id: 'reading-1',
      } as any);
      prisma.utilityMeter.update.mockResolvedValue({ id: 'meter-123' } as any);

      await service.onMqttTelemetryEvent({
        espId: 'ESP_A101',
        rawTopic: 'HOMEIQ/ESP_A101/telemetry',
        message: '{"water_total":120.5}',
        receivedAt: new Date('2026-04-01T00:00:00.000Z'),
        waterTotal: 120.5,
      });

      expect(prisma.utilityReading.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            readingType: 'automatic',
            readingValue: 120.5,
          }),
        }),
      );
    });

    it('should auto-create a utility meter from telemetry when the apartment has none', async () => {
      prisma.ioTDevice.findMany.mockResolvedValue([
        {
          id: 'device-123',
          apartmentId: 'apt-123',
          deviceType: 'light',
          configuration: {
            mqtt: { espId: 'ESP_A101', topic: 'light', deviceId: 1 },
          },
        },
      ] as any);
      prisma.ioTDevice.update.mockResolvedValue({ id: 'device-123' } as any);
      prisma.utilityMeter.findFirst
        .mockResolvedValueOnce(null as any)
        .mockResolvedValueOnce({ id: 'meter-auto', currentReading: null } as any);
      prisma.utilityMeter.create.mockResolvedValue({
        id: 'meter-auto',
        currentReading: null,
      } as any);
      prisma.utilityReading.create.mockResolvedValue({ id: 'reading-1' } as any);
      prisma.utilityMeter.update.mockResolvedValue({ id: 'meter-auto' } as any);

      await service.onMqttTelemetryEvent({
        espId: 'ESP_A101',
        rawTopic: 'HOMEIQ/ESP_A101/telemetry',
        message: '{"energy_total":0.056}',
        receivedAt: new Date('2026-04-16T08:55:41.000Z'),
        energyTotal: 0.056,
      });

      expect(prisma.utilityMeter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            apartmentId: 'apt-123',
            meterType: 'electricity',
            meterNumber: 'AUTO-ESP_A101-apt-123-electric',
            unitOfMeasurement: 'kWh',
            isDigital: true,
          }),
        }),
      );
      expect(prisma.utilityReading.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            readingType: 'automatic',
            readingValue: 0.06,
          }),
        }),
      );
    });
  });
});
