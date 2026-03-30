import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
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
    triggerLight: jest.fn(),
    triggerAlarm: jest.fn(),
    triggerDoor: jest.fn(),
    triggerCurtain: jest.fn(),
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
        controlType: 'door',
        channelId: 1,
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

  describe('getGatewayStatus', () => {
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
        mqttControlType: 'door',
        mqttChannelId: 1,
      });

      expect(prisma.ioTDevice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            configuration: expect.objectContaining({
              vendor: 'ESP32',
              mqtt: {
                espId: 'ESP_A101',
                controlType: 'door',
                channelId: 1,
              },
            }),
          }),
        }),
      );
      expect(result.mqttEspId).toBe('ESP_A101');
      expect(result.mqttControlType).toBe('door');
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
        configuration: { vendor: 'ESP32', mqtt: { espId: 'OLD', channelId: 1 } },
      } as any);
      prisma.ioTDevice.update.mockResolvedValue({ id: 'device-123' } as any);
      prisma.ioTDevice.findUnique.mockResolvedValueOnce(
        mockDeviceDetail({
          configuration: {
            vendor: 'ESP32',
            mqtt: {
              espId: 'ESP_A101',
              controlType: 'door',
              channelId: 2,
            },
          },
        }) as any,
      );

      const result = await service.updateDevice('device-123', {
        mqttEspId: 'ESP_A101',
        mqttControlType: 'door',
        mqttChannelId: 2,
      });

      expect(prisma.ioTDevice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            configuration: expect.objectContaining({
              vendor: 'ESP32',
              mqtt: {
                espId: 'ESP_A101',
                channelId: 2,
                controlType: 'door',
              },
            }),
          }),
        }),
      );
      expect(result.mqttChannelId).toBe(2);
    });

    it('should throw NotFoundException when device does not exist', async () => {
      prisma.ioTDevice.findUnique.mockResolvedValue(null);

      await expect(service.updateDevice('missing', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('controlDevice', () => {
    it('should map lock/unlock commands to MQTT door actions', async () => {
      const user = mockUserJwtPayload();
      prisma.ioTDevice.findUnique.mockResolvedValue({
        id: 'device-123',
        deviceType: 'smart_lock',
        status: IoTStatus.active,
        isControllableByTenant: true,
        configuration: { mqtt: { espId: 'ESP_A101', channelId: 2 } },
        apartment: {
          rentalContracts: [
            { id: 'contract-1', members: [{ userId: user.sub }] },
          ],
        },
      } as any);
      mqttService.triggerDoor.mockReturnValue({
        espId: 'ESP_A101',
        controlType: 'door',
        channelId: 2,
        topic: 'ESP_A101/door',
        payload: 'open_2',
        publishedAt: new Date('2026-03-30T00:00:00.000Z'),
      });

      const result = await service.controlDevice('device-123', 'unlock', user);

      expect(mqttService.triggerDoor).toHaveBeenCalledWith('ESP_A101', 'open', 2);
      expect(result.mqttPayload).toBe('open_2');
      expect(result.mqttControlType).toBe('door');
    });

    it('should throw ForbiddenException when tenant cannot control the device', async () => {
      prisma.ioTDevice.findUnique.mockResolvedValue({
        id: 'device-123',
        deviceType: 'light',
        status: IoTStatus.active,
        isControllableByTenant: false,
        configuration: { mqtt: { espId: 'ESP_A101', controlType: 'light', channelId: 1 } },
        apartment: { rentalContracts: [] },
      } as any);

      await expect(
        service.controlDevice('device-123', 'on', mockUserJwtPayload()),
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
        service.controlDevice('device-123', 'on', mockStaffJwtPayload()),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('direct MQTT wrappers', () => {
    it('should publish light command through MQTT service', () => {
      mqttService.triggerLight.mockReturnValue({
        topic: 'ESP_A101/light',
        payload: 'on_1',
      });

      const result = service.triggerLight('ESP_A101', 1, 'on');

      expect(mqttService.triggerLight).toHaveBeenCalledWith('ESP_A101', 'on', 1);
      expect(result.success).toBe(true);
    });

    it('should proxy test sequence execution', async () => {
      mqttService.runTestSequence.mockResolvedValue({ success: true, steps: [] });

      await expect(service.runDeviceTestSequence('ESP_A101', 500)).resolves.toEqual({
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
});
