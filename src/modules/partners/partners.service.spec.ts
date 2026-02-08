import { Test, TestingModule } from '@nestjs/testing';
import { PartnersService } from './partners.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, mockPartnerJwtPayload, mockOperatorJwtPayload } from '../../test-utils';
import { CreatePartnerRequestDto, UpdatePartnerRequestDto, ReviewPartnerRequestDto } from './dto';
import { PartnerRequestStatus } from '@prisma/client';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('PartnersService', () => {
  let service: PartnersService;
  let prisma: ReturnType<typeof createPrismaMock>;

  const mockPartner = (overrides = {}) => ({
    id: 'partner-123',
    fullName: 'John Partner',
    companyName: 'ABC Corp',
    email: 'partner@example.com',
    phone: '+84909123456',
    address: '123 Main St',
    isVerified: true,
    isActive: true,
    commissionRate: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const mockPartnerRequest = (overrides = {}) => ({
    id: 'request-123',
    partnerId: 'partner-123',
    propertyType: 'apartment',
    address: '456 Second St',
    city: 'Hồ Chí Minh',
    district: 'Quận 1',
    totalArea: 100,
    numberOfUnits: 5,
    expectedRentPrice: 10000000,
    status: PartnerRequestStatus.submitted,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartnersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PartnersService>(PartnersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAllPartners', () => {
    it('should return all partners', async () => {
      const partners = [mockPartner(), mockPartner({ id: 'partner-124' })];
      prisma.partner.findMany.mockResolvedValue(partners as any);

      const result = await service.findAllPartners();

      expect(result).toEqual(partners);
    });

    it('should filter by isActive', async () => {
      prisma.partner.findMany.mockResolvedValue([]);

      await service.findAllPartners('true');

      expect(prisma.partner.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        })
      );
    });
  });

  describe('findOnePartner', () => {
    it('should return partner by ID', async () => {
      const partner = mockPartner();
      prisma.partner.findUnique.mockResolvedValue(partner as any);

      const result = await service.findOnePartner('partner-123');

      expect(result).toEqual(partner);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.partner.findUnique.mockResolvedValue(null);

      await expect(service.findOnePartner('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMyProfile', () => {
    it('should return current partner profile', async () => {
      const partner = mockPartnerJwtPayload();
      const profile = mockPartner({ id: partner.sub });
      prisma.partner.findUnique.mockResolvedValue(profile as any);

      const result = await service.getMyProfile(partner);

      expect(result).toEqual(profile);
    });
  });

  describe('findAllRequests', () => {
    it('should return all partner requests', async () => {
      const requests = [mockPartnerRequest()];
      prisma.partnerRequest.findMany.mockResolvedValue(requests as any);

      const result = await service.findAllRequests();

      expect(result).toEqual(requests);
    });

    it('should filter by status', async () => {
      prisma.partnerRequest.findMany.mockResolvedValue([]);

      await service.findAllRequests(PartnerRequestStatus.approved);

      expect(prisma.partnerRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: PartnerRequestStatus.approved },
        })
      );
    });
  });

  describe('createRequest', () => {
    const createDto: CreatePartnerRequestDto = {
      propertyType: 'apartment' as any,
      address: '789 Third St',
      city: 'Hà Nội',
      district: 'Ba Đình',
      totalArea: 200,
      numberOfUnits: 10,
      expectedRentPrice: 15000000,
    };

    it('should create partner request', async () => {
      const partner = mockPartnerJwtPayload();
      const created = mockPartnerRequest(createDto);
      prisma.partnerRequest.create.mockResolvedValue(created as any);

      const result = await service.createRequest(createDto, partner);

      expect(result).toEqual(created);
    });
  });

  describe('updateRequest', () => {
    const updateDto: UpdatePartnerRequestDto = {
      expectedRentPrice: 18000000,
    };

    it('should update own request', async () => {
      const partner = mockPartnerJwtPayload();
      const request = mockPartnerRequest({ partnerId: partner.sub });
      const updated = { ...request, ...updateDto };

      prisma.partnerRequest.findUnique.mockResolvedValue(request as any);
      prisma.partnerRequest.update.mockResolvedValue(updated as any);

      const result = await service.updateRequest('request-123', updateDto, partner);

      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException if not found', async () => {
      const partner = mockPartnerJwtPayload();
      prisma.partnerRequest.findUnique.mockResolvedValue(null);

      await expect(service.updateRequest('non-existent', updateDto, partner)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if not own request', async () => {
      const partner = mockPartnerJwtPayload();
      const request = mockPartnerRequest({ partnerId: 'other-partner' });
      prisma.partnerRequest.findUnique.mockResolvedValue(request as any);

      await expect(service.updateRequest('request-123', updateDto, partner)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if not submitted status', async () => {
      const partner = mockPartnerJwtPayload();
      const request = mockPartnerRequest({ partnerId: partner.sub, status: PartnerRequestStatus.approved });
      prisma.partnerRequest.findUnique.mockResolvedValue(request as any);

      await expect(service.updateRequest('request-123', updateDto, partner)).rejects.toThrow(BadRequestException);
    });
  });

  describe('reviewRequest', () => {
    it('should approve request', async () => {
      const operator = mockOperatorJwtPayload();
      const request = mockPartnerRequest();
      const reviewDto: ReviewPartnerRequestDto = {
        status: PartnerRequestStatus.approved,
        reviewNotes: 'Approved',
      };
      const reviewed = { ...request, ...reviewDto, approvedAt: new Date() };

      prisma.partnerRequest.findUnique.mockResolvedValue(request as any);
      prisma.partnerRequest.update.mockResolvedValue(reviewed as any);

      const result = await service.reviewRequest('request-123', reviewDto, operator);

      expect(result.status).toBe(PartnerRequestStatus.approved);
    });

    it('should reject request with reason', async () => {
      const operator = mockOperatorJwtPayload();
      const request = mockPartnerRequest();
      const reviewDto: ReviewPartnerRequestDto = {
        status: PartnerRequestStatus.rejected,
        rejectionReason: 'Documents incomplete',
      };
      const reviewed = { ...request, ...reviewDto };

      prisma.partnerRequest.findUnique.mockResolvedValue(request as any);
      prisma.partnerRequest.update.mockResolvedValue(reviewed as any);

      const result = await service.reviewRequest('request-123', reviewDto, operator);

      expect(result.status).toBe(PartnerRequestStatus.rejected);
    });

    it('should throw BadRequestException if already processed', async () => {
      const operator = mockOperatorJwtPayload();
      const request = mockPartnerRequest({ status: PartnerRequestStatus.approved });
      const reviewDto: ReviewPartnerRequestDto = {
        status: PartnerRequestStatus.rejected,
      };

      prisma.partnerRequest.findUnique.mockResolvedValue(request as any);

      await expect(service.reviewRequest('request-123', reviewDto, operator)).rejects.toThrow(BadRequestException);
    });
  });
});
