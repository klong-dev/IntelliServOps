import { Test, TestingModule } from '@nestjs/testing';
import { ApartmentsService } from './apartments.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  createPrismaMock,
  mockPartnerJwtPayload,
  mockOperatorJwtPayload,
  mockAdminJwtPayload,
} from '../../test-utils';
import {
  CreateApartmentDto,
  UpdateApartmentDto,
  SearchApartmentDto,
} from './dto';
import { ApartmentStatus } from '@prisma/client';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('ApartmentsService', () => {
  let service: ApartmentsService;
  let prisma: ReturnType<typeof createPrismaMock>;

  const mockApartment = (overrides = {}) => ({
    id: 'apt-123',
    buildingName: 'Building A',
    apartmentNumber: '101',
    floorNumber: 1,
    address: '123 Main St',
    city: 'Hồ Chí Minh',
    district: 'Quận 1',
    ward: 'Phường Bến Nghé',
    latitude: 10.7769,
    longitude: 106.7009,
    totalArea: 100,
    usableArea: 90,
    numberOfBedrooms: 2,
    numberOfBathrooms: 2,
    furnishingStatus: 'fully_furnished',
    amenities: ['wifi', 'parking'],
    baseRentPrice: 10000000,
    depositAmount: 20000000,
    status: ApartmentStatus.available,
    partnerId: 'partner-123',
    description: 'Nice apartment',
    images: [],
    videoTourUrl: null,
    yearBuilt: 2020,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApartmentsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<ApartmentsService>(ApartmentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    const searchDto: SearchApartmentDto = {
      city: 'Hồ Chí Minh',
      status: ApartmentStatus.available,
      page: 1,
      limit: 20,
    };

    it('should return paginated apartments', async () => {
      const apartments = [mockApartment(), mockApartment({ id: 'apt-124' })];
      prisma.apartment.findMany.mockResolvedValue(apartments as any);
      prisma.apartment.count.mockResolvedValue(2);

      const result = await service.search(searchDto);

      expect(result.data).toEqual(apartments);
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('should filter by city', async () => {
      prisma.apartment.findMany.mockResolvedValue([]);
      prisma.apartment.count.mockResolvedValue(0);

      await service.search(searchDto);

      expect(prisma.apartment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            city: { equals: 'Hồ Chí Minh', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('should filter by district', async () => {
      const dtoWithDistrict = { ...searchDto, district: 'Quận 1' };
      prisma.apartment.findMany.mockResolvedValue([]);
      prisma.apartment.count.mockResolvedValue(0);

      await service.search(dtoWithDistrict);

      expect(prisma.apartment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            district: { equals: 'Quận 1', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('should filter by keyword', async () => {
      const dtoWithKeyword = { ...searchDto, keyword: 'building' };
      prisma.apartment.findMany.mockResolvedValue([]);
      prisma.apartment.count.mockResolvedValue(0);

      await service.search(dtoWithKeyword);

      expect(prisma.apartment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { buildingName: { contains: 'building', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });

    it('should filter by price range', async () => {
      const dtoWithPrice = {
        ...searchDto,
        minPrice: 5000000,
        maxPrice: 15000000,
      };
      prisma.apartment.findMany.mockResolvedValue([]);
      prisma.apartment.count.mockResolvedValue(0);

      await service.search(dtoWithPrice);

      expect(prisma.apartment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            baseRentPrice: { gte: 5000000, lte: 15000000 },
          }),
        }),
      );
    });

    it('should filter by bedrooms', async () => {
      const dtoWithBedrooms = { ...searchDto, minBedrooms: 1, maxBedrooms: 3 };
      prisma.apartment.findMany.mockResolvedValue([]);
      prisma.apartment.count.mockResolvedValue(0);

      await service.search(dtoWithBedrooms);

      expect(prisma.apartment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            numberOfBedrooms: { gte: 1, lte: 3 },
          }),
        }),
      );
    });

    it('should handle pagination', async () => {
      const page2 = { ...searchDto, page: 2, limit: 10 };
      prisma.apartment.findMany.mockResolvedValue([]);
      prisma.apartment.count.mockResolvedValue(25);

      await service.search(page2);

      expect(prisma.apartment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return apartment with full details', async () => {
      const apartment = mockApartment();
      prisma.apartment.findUnique.mockResolvedValue(apartment as any);

      const result = await service.findOne('apt-123');

      expect(result).toEqual(apartment);
      expect(prisma.apartment.findUnique).toHaveBeenCalledWith({
        where: { id: 'apt-123' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.apartment.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    const createDto: CreateApartmentDto = {
      buildingName: 'New Building',
      apartmentNumber: '102',
      floorNumber: 1,
      address: '456 Second St',
      city: 'Hà Nội',
      district: 'Ba Đình',
      ward: 'Phường Liễu Giai',
      totalArea: 80,
      usableArea: 72,
      numberOfBedrooms: 2,
      numberOfBathrooms: 1,
      furnishingStatus: 'semi_furnished' as any,
      amenities: ['wifi'],
      baseRentPrice: 8000000,
      depositAmount: 16000000,
      description: 'New apartment',
    };

    it('should create apartment as partner', async () => {
      const partner = mockPartnerJwtPayload();
      const created = mockApartment(createDto);
      prisma.apartment.create.mockResolvedValue(created as any);

      const result = await service.create(createDto, partner);

      expect(result).toEqual(created);
      expect(prisma.apartment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            buildingName: createDto.buildingName,
            partner: { connect: { id: partner.sub } },
          }),
        }),
      );
    });

    it('should create apartment as operator with partnerId', async () => {
      const operator = mockOperatorJwtPayload();
      const dtoWithPartner = { ...createDto, partnerId: 'partner-456' };
      const created = mockApartment();
      prisma.apartment.create.mockResolvedValue(created as any);

      const result = await service.create(dtoWithPartner, operator);

      expect(result).toEqual(created);
      expect(prisma.apartment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            partner: { connect: { id: 'partner-456' } },
          }),
        }),
      );
    });

    it('should create apartment without partner link', async () => {
      const operator = mockOperatorJwtPayload();
      const created = mockApartment();
      prisma.apartment.create.mockResolvedValue(created as any);

      await service.create(createDto, operator);

      expect(prisma.apartment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            partner: expect.anything(),
          }),
        }),
      );
    });
  });

  describe('update', () => {
    const updateDto: UpdateApartmentDto = {
      baseRentPrice: 12000000,
      status: ApartmentStatus.rented,
    };

    it('should update apartment as admin', async () => {
      const admin = mockAdminJwtPayload();
      const apartment = mockApartment();
      const updated = { ...apartment, ...updateDto };

      prisma.apartment.findUnique.mockResolvedValue(apartment as any);
      prisma.apartment.update.mockResolvedValue(updated as any);

      const result = await service.update('apt-123', updateDto, admin);

      expect(result).toEqual(updated);
    });

    it('should update own apartment as partner', async () => {
      const partner = mockPartnerJwtPayload();
      const apartment = mockApartment({ partnerId: partner.sub });
      const updated = { ...apartment, ...updateDto };

      prisma.apartment.findUnique.mockResolvedValue(apartment as any);
      prisma.apartment.update.mockResolvedValue(updated as any);

      const result = await service.update('apt-123', updateDto, partner);

      expect(result).toEqual(updated);
    });

    it('should throw ForbiddenException if partner updates others apartment', async () => {
      const partner = mockPartnerJwtPayload();
      const apartment = mockApartment({ partnerId: 'other-partner' });

      prisma.apartment.findUnique.mockResolvedValue(apartment as any);

      await expect(
        service.update('apt-123', updateDto, partner),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if apartment not found', async () => {
      const admin = mockAdminJwtPayload();
      prisma.apartment.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent', updateDto, admin),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete apartment', async () => {
      const apartment = mockApartment();
      const deleted = { ...apartment, status: ApartmentStatus.inactive };

      prisma.apartment.findUnique.mockResolvedValue(apartment as any);
      prisma.apartment.update.mockResolvedValue(deleted as any);

      const result = await service.remove('apt-123');

      expect(result.status).toBe(ApartmentStatus.inactive);
      expect(prisma.apartment.update).toHaveBeenCalledWith({
        where: { id: 'apt-123' },
        data: { status: ApartmentStatus.inactive },
        select: expect.any(Object),
      });
    });

    it('should throw NotFoundException if apartment not found', async () => {
      prisma.apartment.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByPartner', () => {
    it('should return all apartments for a partner', async () => {
      const apartments = [
        mockApartment({ partnerId: 'partner-123' }),
        mockApartment({ id: 'apt-124', partnerId: 'partner-123' }),
      ];
      prisma.apartment.findMany.mockResolvedValue(apartments as any);

      const result = await service.findByPartner('partner-123');

      expect(result).toEqual(apartments);
      expect(prisma.apartment.findMany).toHaveBeenCalledWith({
        where: { partnerId: 'partner-123' },
        select: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('updateStatus', () => {
    it('should update apartment status', async () => {
      const apartment = { ...mockApartment(), status: ApartmentStatus.rented };
      prisma.apartment.update.mockResolvedValue(apartment as any);

      const result = await service.updateStatus(
        'apt-123',
        ApartmentStatus.rented,
      );

      expect(result.status).toBe(ApartmentStatus.rented);
      expect(prisma.apartment.update).toHaveBeenCalledWith({
        where: { id: 'apt-123' },
        data: { status: ApartmentStatus.rented },
        select: expect.any(Object),
      });
    });
  });

  describe('approve', () => {
    it('should approve apartment by operator', async () => {
      const apartment = {
        ...mockApartment(),
        status: ApartmentStatus.available,
        approvedAt: new Date(),
      };
      prisma.apartment.update.mockResolvedValue(apartment as any);

      const result = await service.approve('apt-123', 'operator-123');

      expect(result.status).toBe(ApartmentStatus.available);
      expect(result.approvedAt).toBeDefined();
      expect(prisma.apartment.update).toHaveBeenCalledWith({
        where: { id: 'apt-123' },
        data: {
          status: ApartmentStatus.available,
          approvedByOperator: { connect: { id: 'operator-123' } },
          approvedAt: expect.any(Date),
        },
        select: expect.any(Object),
      });
    });
  });
});
