import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApartmentsService } from './apartments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ContractPdfService } from '../contracts/contract-pdf.service';
import { NotificationsService } from '../notifications/notifications.service';
import axios from 'axios';
import {
  createPrismaMock,
  mockAdminJwtPayload,
  mockUserJwtPayload,
} from '../../test-utils';
import { ApartmentStatus, FurnishingStatus } from '@prisma/client';

jest.mock('axios');

const mockedAxios = jest.mocked(axios, true);

describe('ApartmentsService', () => {
  let service: ApartmentsService;
  let prisma: ReturnType<typeof createPrismaMock>;

  const contractPdfService = {
    generatePartnerCooperationPdf: jest.fn(),
  };

  const notificationsService = {
    createAndPush: jest.fn(),
  };

  const mockApartmentListItem = (overrides = {}) => ({
    id: 'apt-123',
    buildingName: 'Vinhomes Central Park',
    apartmentNumber: 'A-1501',
    floorNumber: 15,
    totalArea: 75.5,
    numberOfBedrooms: 2,
    numberOfBathrooms: 2,
    furnishingStatus: FurnishingStatus.unfurnished,
    baseRentPrice: 15000000,
    depositAmount: 30000000,
    status: ApartmentStatus.available,
    images: [],
    videoTourUrl: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    wardCode: 26728,
    provinceCode: 79,
    streetAddress: '12 Nguyen Hue',
    ...overrides,
  });

  const mockApartmentDetail = (overrides = {}) => ({
    ...mockApartmentListItem(overrides),
    ownerId: 'user-123',
    rooms: [],
    owner: { id: 'user-123', companyName: null, fullName: 'Owner' },
    iotDevices: [],
    utilityMeters: [],
    userApartments: [],
  });

  beforeEach(async () => {
    prisma = createPrismaMock();

    mockedAxios.get.mockResolvedValue({
      data: {
        name: 'Phường Bến Nghé',
        district_code: 760,
        district_name: 'Quận 1',
        province_code: 79,
        province_name: 'Thành phố Hồ Chí Minh',
      },
    } as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApartmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ContractPdfService, useValue: contractPdfService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get<ApartmentsService>(ApartmentsService);
    jest.clearAllMocks();
  });

  it('should return paginated apartment search results with rating', async () => {
    prisma.apartment.findMany.mockResolvedValue([
      mockApartmentListItem(),
      mockApartmentListItem({ id: 'apt-124', apartmentNumber: 'A-1502' }),
    ] as any);
    prisma.apartment.count.mockResolvedValue(2);
    prisma.apartmentRating.groupBy.mockResolvedValue([
      { apartmentId: 'apt-123', _avg: { rating: 4.5 } },
      { apartmentId: 'apt-124', _avg: { rating: null } },
    ] as any);

    const result = await service.search({
      provinceCode: 79,
      wardCode: 26728,
      minPrice: 10000000,
      maxPrice: 20000000,
      page: 1,
      limit: 20,
    });

    expect(result.total).toBe(2);
    expect(result.items[0].rating).toBe(4.5);
    expect(prisma.apartment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { provinceCode: 79 },
            { wardCode: 26728 },
          ]),
          baseRentPrice: { gte: 10000000, lte: 20000000 },
        }),
      }),
    );
  });

  it('should return apartment detail with rounded rating', async () => {
    prisma.apartment.findUnique.mockResolvedValue(mockApartmentDetail() as any);
    prisma.apartmentRating.aggregate.mockResolvedValue({
      _avg: { rating: 4.666 },
    } as any);

    const result = await service.findOne('apt-123');

    expect(result.id).toBe('apt-123');
    expect(result.rating).toBe(4.67);
    expect(result.canRateApartment).toBe(false);
    expect(result.hasRatedApartment).toBe(false);
    expect(result.ratingEligibilityReason).toBe('not_authenticated');
  });

  it('should mark canRateApartment=true for user with active contract and no previous rating', async () => {
    const user = mockUserJwtPayload();

    prisma.apartment.findUnique.mockResolvedValue(mockApartmentDetail() as any);
    prisma.apartmentRating.aggregate.mockResolvedValue({
      _avg: { rating: 4.2 },
    } as any);
    prisma.userContractMember.findFirst.mockResolvedValue({ id: 'm-1' } as any);
    prisma.apartmentRating.findUnique.mockResolvedValue(null);

    const result = await service.findOne('apt-123', user);

    expect(result.canRateApartment).toBe(true);
    expect(result.hasRatedApartment).toBe(false);
    expect(result.ratingEligibilityReason).toBeNull();
  });

  it('should mark canRateApartment=false when user already rated apartment', async () => {
    const user = mockUserJwtPayload();

    prisma.apartment.findUnique.mockResolvedValue(mockApartmentDetail() as any);
    prisma.apartmentRating.aggregate.mockResolvedValue({
      _avg: { rating: 4.2 },
    } as any);
    prisma.userContractMember.findFirst.mockResolvedValue({ id: 'm-1' } as any);
    prisma.apartmentRating.findUnique.mockResolvedValue({ id: 'r-1' } as any);

    const result = await service.findOne('apt-123', user);

    expect(result.canRateApartment).toBe(false);
    expect(result.hasRatedApartment).toBe(true);
    expect(result.ratingEligibilityReason).toBe('already_rated');
  });

  it('should mark reason=no_active_contract when user has no active membership', async () => {
    const user = mockUserJwtPayload();

    prisma.apartment.findUnique.mockResolvedValue(mockApartmentDetail() as any);
    prisma.apartmentRating.aggregate.mockResolvedValue({
      _avg: { rating: 4.2 },
    } as any);
    prisma.userContractMember.findFirst.mockResolvedValue(null);
    prisma.apartmentRating.findUnique.mockResolvedValue(null);

    const result = await service.findOne('apt-123', user);

    expect(result.canRateApartment).toBe(false);
    expect(result.hasRatedApartment).toBe(false);
    expect(result.ratingEligibilityReason).toBe('no_active_contract');
  });

  it('should throw NotFoundException when apartment detail is missing', async () => {
    prisma.apartment.findUnique.mockResolvedValue(null);
    prisma.apartmentRating.aggregate.mockResolvedValue({
      _avg: { rating: null },
    } as any);

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('should create apartment for owner and merge uploaded media', async () => {
    prisma.apartment.create.mockResolvedValue({
      id: 'apt-123',
      apartmentNumber: 'A-1501',
      wardCode: null,
      provinceCode: undefined,
      streetAddress: '12 Nguyen Hue',
      baseRentPrice: 15000000,
      images: ['https://cdn.example.com/img-1.jpg'],
      videoTourUrl: 'https://cdn.example.com/video.mp4',
      status: ApartmentStatus.available,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const result = await service.create(
      {
        apartmentNumber: 'A-1501',
        totalArea: 75.5,
        numberOfBedrooms: 2,
        numberOfBathrooms: 2,
        baseRentPrice: 15000000,
        streetAddress: '12 Nguyen Hue',
        images: ['https://existing.example.com/img.jpg'],
      } as any,
      mockUserJwtPayload(),
      {
        imageUrls: ['https://cdn.example.com/img-1.jpg'],
        videoUrl: 'https://cdn.example.com/video.mp4',
      },
    );

    expect(result.images).toEqual(['https://cdn.example.com/img-1.jpg']);
    expect(prisma.apartment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          owner: { connect: { id: 'user-123' } },
          images: [
            'https://existing.example.com/img.jpg',
            'https://cdn.example.com/img-1.jpg',
          ],
          videoTourUrl: 'https://cdn.example.com/video.mp4',
        }),
      }),
    );
  });

  it('should prevent users from updating apartments they do not own', async () => {
    prisma.apartment.findUnique.mockResolvedValue({
      id: 'apt-123',
      ownerId: 'other-user',
      images: [],
    } as any);

    await expect(
      service.update(
        'apt-123',
        { baseRentPrice: 18000000 },
        mockUserJwtPayload(),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should append uploaded images when updating an apartment', async () => {
    prisma.apartment.findUnique.mockResolvedValue({
      id: 'apt-123',
      ownerId: 'user-123',
      images: ['https://existing.example.com/img.jpg'],
    } as any);
    prisma.apartment.update.mockResolvedValue({
      id: 'apt-123',
      apartmentNumber: 'A-1501',
      wardCode: null,
      provinceCode: null,
      streetAddress: '12 Nguyen Hue',
      baseRentPrice: 18000000,
      images: [
        'https://existing.example.com/img.jpg',
        'https://cdn.example.com/img-2.jpg',
      ],
      videoTourUrl: null,
      status: ApartmentStatus.available,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    prisma.$transaction.mockImplementation(async (callback) =>
      callback(prisma as any),
    );

    const result = await service.update(
      'apt-123',
      { baseRentPrice: 18000000 },
      mockUserJwtPayload(),
      {
        imageUrls: ['https://cdn.example.com/img-2.jpg'],
      },
    );

    expect(result.images).toHaveLength(2);
    expect(prisma.apartment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          images: [
            'https://existing.example.com/img.jpg',
            'https://cdn.example.com/img-2.jpg',
          ],
        }),
      }),
    );
  });

  it('should soft-delete apartment', async () => {
    prisma.apartment.findUnique.mockResolvedValue({ id: 'apt-123' } as any);
    prisma.apartment.update.mockResolvedValue({
      id: 'apt-123',
      apartmentNumber: 'A-1501',
      status: ApartmentStatus.inactive,
    } as any);

    const result = await service.remove('apt-123');

    expect(result.status).toBe(ApartmentStatus.inactive);
  });

  it('should return apartments by owner with rating', async () => {
    prisma.apartment.findMany.mockResolvedValue([
      {
        ...mockApartmentListItem(),
        owner: { id: 'user-123', companyName: null, fullName: 'Owner' },
        rooms: [],
        iotDevices: [],
        utilityMeters: [],
        cooperationContracts: [
          {
            id: 'coop-123',
            contractNumber: 'COOP-2026-00001',
            status: 'signed',
            startDate: new Date('2026-01-01'),
            endDate: new Date('2026-12-31'),
            signedAt: new Date('2026-01-01'),
            contractDocumentUrl:
              'https://storage.example.com/cooperation/coop-123.pdf',
            contractPdfData: Buffer.from('pdf'),
          },
        ],
      },
    ] as any);
    prisma.apartmentRating.groupBy.mockResolvedValue([
      { apartmentId: 'apt-123', _avg: { rating: 4.2 } },
    ] as any);

    const result = await service.findByOwner('user-123');

    expect(result[0].rating).toBe(4.2);
    expect(result[0].cooperationContract).toMatchObject({
      id: 'coop-123',
      contractNumber: 'COOP-2026-00001',
      status: 'signed',
    });
    expect(result[0].cooperationContract.cooperationContractPdfUrl).toBe(
      '/apartments/cooperation-contracts/coop-123/pdf',
    );
    expect(
      result[0].cooperationContract.cooperationContractPublicPdfUrl,
    ).toContain('/apartments/cooperation-contracts/pdf/view?token=');
    expect(prisma.apartment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId: 'user-123' },
      }),
    );
  });

  it('should approve apartment as admin/operator flow', async () => {
    prisma.apartment.update.mockResolvedValue({
      id: 'apt-123',
      apartmentNumber: 'A-1501',
      status: ApartmentStatus.available,
      approvedAt: new Date(),
    } as any);

    const result = await service.approve('apt-123', mockAdminJwtPayload().sub);

    expect(result.status).toBe(ApartmentStatus.available);
    expect(result.approvedAt).toBeDefined();
  });
});
