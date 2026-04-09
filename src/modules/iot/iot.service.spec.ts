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
import {
  createPrismaMock,
  mockStaffJwtPayload,
  mockUserJwtPayload,
} from '../../test-utils';
import { IoTStatus, MeterStatus } from '@prisma/client';

describe('IoTService', () => {
  let service: IoTService;
  let prisma: ReturnType<typeof createPrismaMock>;

  const mqttService = {
    getGatewayStatus: jest.fn(),
    getTelemetry: jest.fn(),
    checkOnline: jest.fn(),
    controlDevice: jest.fn(),
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
      ],
    }).compile();

    service = module.get<IoTService>(IoTService);
    jest.clearAllMocks();
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

    it('should request telemetry and health checks through MQTT service', () => {
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

      expect(service.requestTelemetry('ESP_A101')).toMatchObject({
        success: true,
        message: 'Telemetry request sent',
      });
      expect(service.checkHealth('ESP_A101')).toMatchObject({
        success: true,
        message: 'Health check signal sent',
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
            mqttTopic: 'door',
            mqttDeviceId: 1,
            mqttState: 'OFF',
          }),
          expect.objectContaining({
            id: 'device-456',
            mqttTopic: 'light',
            mqttDeviceId: 2,
            mqttState: 'OFF',
          }),
        ]),
      );
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
    it('should publish light command through generic MQTT service', () => {
      mqttService.controlDevice.mockReturnValue({
        topic: 'ESP_A101/light',
        payload: 'ON_1',
        espId: 'ESP_A101',
        deviceTopic: 'light',
        deviceId: 1,
        action: 'ON',
        publishedAt: new Date('2026-03-30T00:00:00.000Z'),
      });

      const result = service.triggerLight('ESP_A101', 1, 'ON');

      expect(mqttService.controlDevice).toHaveBeenCalledWith(
        'ESP_A101',
        'ON',
        1,
        'light',
      );
      expect(result.success).toBe(true);
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
  });
});
