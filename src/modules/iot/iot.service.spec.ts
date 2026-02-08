import { Test, TestingModule } from '@nestjs/testing';
import { IoTService } from './iot.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, mockUserJwtPayload, mockStaffJwtPayload } from '../../test-utils';
import { IoTStatus, MeterStatus } from '@prisma/client';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

describe('IoTService', () => {
  let service: IoTService;
  let prisma: ReturnType<typeof createPrismaMock>;

  const mockDevice = (overrides = {}) => ({
    id: 'device-123',
    apartmentId: 'apt-123',
    deviceName: 'Smart Lock',
    deviceType: 'door_lock',
    status: IoTStatus.active,
    ...overrides,
  });

  const mockMeter = (overrides = {}) => ({
    id: 'meter-123',
    apartmentId: 'apt-123',
    meterNumber: 'E-001',
    meterType: 'electricity',
    currentReading: 1000,
    status: MeterStatus.active,
    ...overrides,
  });

  beforeEach(async () => {
    prisma = createPrismaMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [IoTService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<IoTService>(IoTService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAllDevices', () => {
    it('should return all devices', async () => {
      prisma.ioTDevice.findMany.mockResolvedValue([mockDevice()] as any);
      const result = await service.findAllDevices();
      expect(result).toHaveLength(1);
    });
  });

  describe('findOneDevice', () => {
    it('should return device by ID', async () => {
      prisma.ioTDevice.findUnique.mockResolvedValue(mockDevice() as any);
      const result = await service.findOneDevice('device-123');
      expect(result.id).toBe('device-123');
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.ioTDevice.findUnique.mockResolvedValue(null);
      await expect(service.findOneDevice('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findDevicesByApartment', () => {
    it('should return devices for authorized user', async () => {
      const user = mockUserJwtPayload();
      prisma.rentalContract.findFirst.mockResolvedValue({ id: 'c' } as any);
      prisma.ioTDevice.findMany.mockResolvedValue([mockDevice()] as any);
      const result = await service.findDevicesByApartment('apt-123', user);
      expect(result).toHaveLength(1);
    });

    it('should throw ForbiddenException if no contract', async () => {
      prisma.rentalContract.findFirst.mockResolvedValue(null);
      await expect(service.findDevicesByApartment('apt-123', mockUserJwtPayload())).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createDevice', () => {
    it('should create device', async () => {
      prisma.apartment.findUnique.mockResolvedValue({ id: 'apt-123' } as any);
      prisma.ioTDevice.create.mockResolvedValue(mockDevice() as any);
      const result = await service.createDevice({ apartmentId: 'apt-123', deviceName: 'D', deviceType: 'sensor' as any, tuyaDeviceId: 't' });
      expect(result.id).toBe('device-123');
    });
  });

  describe('controlDevice', () => {
    it('should control device for authorized user', async () => {
      const user = mockUserJwtPayload();
      prisma.ioTDevice.findUnique.mockResolvedValue(mockDevice() as any);
      prisma.rentalContract.findFirst.mockResolvedValue({ id: 'c' } as any);
      const result = await service.controlDevice('device-123', 'on', user);
      expect(result.message).toBeDefined();
    });
  });

  describe('findAllMeters', () => {
    it('should return all meters', async () => {
      prisma.utilityMeter.findMany.mockResolvedValue([mockMeter()] as any);
      const result = await service.findAllMeters();
      expect(result).toHaveLength(1);
    });
  });

  describe('createReading', () => {
    it('should create reading', async () => {
      prisma.utilityMeter.findUnique.mockResolvedValue(mockMeter() as any);
      prisma.utilityReading.findFirst.mockResolvedValue({ readingValue: 1000 } as any);
      prisma.utilityReading.create.mockResolvedValue({ id: 'r-1', readingValue: 1100 } as any);
      prisma.utilityMeter.update.mockResolvedValue({} as any);
      const result = await service.createReading({ utilityMeterId: 'meter-123', readingValue: 1100 }, mockStaffJwtPayload());
      expect(result.readingValue).toBe(1100);
    });

    it('should throw if reading lower than previous', async () => {
      prisma.utilityMeter.findUnique.mockResolvedValue(mockMeter({ currentReading: 1200 }) as any);
      prisma.utilityReading.findFirst.mockResolvedValue({ readingValue: 1200 } as any);
      await expect(service.createReading({ utilityMeterId: 'meter-123', readingValue: 1100 }, mockStaffJwtPayload())).rejects.toThrow(BadRequestException);
    });
  });

  describe('getReadings', () => {
    it('should return readings', async () => {
      prisma.utilityReading.findMany.mockResolvedValue([{ id: 'r-1' }] as any);
      const result = await service.getReadings('meter-123');
      expect(result).toHaveLength(1);
    });
  });
});
