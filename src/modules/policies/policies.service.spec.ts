import { Test, TestingModule } from '@nestjs/testing';
import { PoliciesService } from './policies.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, mockAdminJwtPayload } from '../../test-utils';
import {
  CreatePolicyDto,
  UpdatePolicyDto,
  CreateLegalDocumentDto,
} from './dto';
import { PolicyType, DocumentType } from '@prisma/client';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('PoliciesService', () => {
  let service: PoliciesService;
  let prisma: ReturnType<typeof createPrismaMock>;

  const mockPolicy = (overrides = {}) => ({
    id: 'policy-123',
    policyType: PolicyType.building_regulations,
    title: 'Nội quy tòa nhà',
    content: 'Cư dân phải tuân thủ giờ giấc sinh hoạt chung...',
    version: '1.0',
    language: 'vi',
    effectiveDate: new Date('2026-01-01'),
    isActive: true,
    requiresAcceptance: true,
    displayOrder: 1,
    approvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const mockDocument = (overrides = {}) => ({
    id: 'doc-123',
    documentType: DocumentType.contract_template,
    title: 'Mẫu hợp đồng thuê nhà',
    description: 'Hợp đồng mẫu cho căn hộ chung cư',
    fileUrl: 'https://example.com/doc.pdf',
    fileType: 'pdf',
    isPublic: true,
    isTemplate: true,
    version: '1.0',
    language: 'vi',
    createdAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PoliciesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PoliciesService>(PoliciesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findAllPolicies ───────────────────────────────────────────

  describe('findAllPolicies', () => {
    it('should return all policies with apartment count', async () => {
      const policies = [mockPolicy()];
      prisma.policy.findMany.mockResolvedValue(policies as any);

      const result = await service.findAllPolicies();

      expect(result).toEqual(policies);
      expect(prisma.policy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            _count: { select: { apartmentPolicies: true } },
          }),
        }),
      );
    });

    it('should filter by policyType', async () => {
      prisma.policy.findMany.mockResolvedValue([]);

      await service.findAllPolicies(PolicyType.parking_rules);

      expect(prisma.policy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { policyType: PolicyType.parking_rules },
        }),
      );
    });

    it('should filter by isActive', async () => {
      prisma.policy.findMany.mockResolvedValue([]);

      await service.findAllPolicies(undefined, true);

      expect(prisma.policy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        }),
      );
    });
  });

  // ─── findActivePolicies ────────────────────────────────────────

  describe('findActivePolicies', () => {
    it('should return active policies within effective dates', async () => {
      const policies = [mockPolicy({ isActive: true })];
      prisma.policy.findMany.mockResolvedValue(policies as any);

      const result = await service.findActivePolicies();

      expect(result).toEqual(policies);
      expect(prisma.policy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
          }),
        }),
      );
    });
  });

  // ─── findPoliciesByApartment ───────────────────────────────────

  describe('findPoliciesByApartment', () => {
    it('should throw NotFoundException if apartment not found', async () => {
      prisma.apartment.findUnique.mockResolvedValue(null);

      await expect(
        service.findPoliciesByApartment('non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return policies for a specific apartment', async () => {
      prisma.apartment.findUnique.mockResolvedValue({
        id: 'apt-1',
        apartmentNumber: 'R1-801',
      } as any);
      const policies = [
        {
          id: 'ap-1',
          isRequired: true,
          policy: mockPolicy(),
        },
      ];
      prisma.apartmentPolicy.findMany.mockResolvedValue(policies as any);

      const result = await service.findPoliciesByApartment('apt-1');

      expect(result).toEqual(policies);
    });
  });

  // ─── findOnePolicy ────────────────────────────────────────────

  describe('findOnePolicy', () => {
    it('should return policy with apartment associations', async () => {
      const policy = {
        ...mockPolicy(),
        apartmentPolicies: [],
        createdByAdmin: null,
        approvedByAdmin: null,
      };
      prisma.policy.findUnique.mockResolvedValue(policy as any);

      const result = await service.findOnePolicy('policy-123');

      expect(result).toEqual(policy);
      expect(prisma.policy.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            apartmentPolicies: expect.any(Object),
          }),
        }),
      );
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.policy.findUnique.mockResolvedValue(null);

      await expect(service.findOnePolicy('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── createPolicy ────────────────────────────────────────────

  describe('createPolicy', () => {
    const createDto: CreatePolicyDto = {
      policyType: PolicyType.building_regulations,
      title: 'Nội quy tòa nhà mới',
      content: 'Nội dung nội quy...',
      version: '1.0',
      effectiveDate: '2026-01-01',
    };

    it('should create apartment policy', async () => {
      const admin = mockAdminJwtPayload();
      const created = mockPolicy();
      prisma.policy.create.mockResolvedValue(created as any);

      const result = await service.createPolicy(createDto, admin);

      expect(result).toEqual(created);
      expect(prisma.policy.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            policyType: PolicyType.building_regulations,
            title: 'Nội quy tòa nhà mới',
          }),
        }),
      );
    });
  });

  // ─── updatePolicy ────────────────────────────────────────────

  describe('updatePolicy', () => {
    const updateDto: UpdatePolicyDto = {
      title: 'Nội quy tòa nhà (cập nhật)',
    };

    it('should update policy', async () => {
      const policy = mockPolicy();
      const updated = { ...policy, ...updateDto };

      prisma.policy.findUnique.mockResolvedValue(policy as any);
      prisma.policy.update.mockResolvedValue(updated as any);

      const result = await service.updatePolicy('policy-123', updateDto);

      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.policy.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePolicy('non-existent', updateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── approvePolicy ───────────────────────────────────────────

  describe('approvePolicy', () => {
    it('should approve policy and activate', async () => {
      const admin = mockAdminJwtPayload();
      const policy = mockPolicy({ approvedAt: null });
      const approved = {
        ...policy,
        approvedAt: new Date(),
        isActive: true,
      };

      prisma.policy.findUnique.mockResolvedValue(policy as any);
      prisma.policy.update.mockResolvedValue(approved as any);

      const result = await service.approvePolicy('policy-123', admin);

      expect(result.approvedAt).toBeDefined();
      expect(result.isActive).toBe(true);
    });

    it('should throw NotFoundException if not found', async () => {
      const admin = mockAdminJwtPayload();
      prisma.policy.findUnique.mockResolvedValue(null);

      await expect(
        service.approvePolicy('non-existent', admin),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if already approved', async () => {
      const admin = mockAdminJwtPayload();
      const policy = mockPolicy({ approvedAt: new Date() });
      prisma.policy.findUnique.mockResolvedValue(policy as any);

      await expect(service.approvePolicy('policy-123', admin)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── Legal Documents ──────────────────────────────────────────

  describe('findAllDocuments', () => {
    it('should return all documents', async () => {
      const docs = [mockDocument()];
      prisma.legalDocument.findMany.mockResolvedValue(docs as any);

      const result = await service.findAllDocuments();

      expect(result).toEqual(docs);
    });
  });

  describe('findPublicDocuments', () => {
    it('should return public documents', async () => {
      const docs = [mockDocument()];
      prisma.legalDocument.findMany.mockResolvedValue(docs as any);

      const result = await service.findPublicDocuments();

      expect(result).toEqual(docs);
    });
  });

  describe('findOneDocument', () => {
    it('should return document by ID', async () => {
      const doc = mockDocument();
      prisma.legalDocument.findUnique.mockResolvedValue(doc as any);

      const result = await service.findOneDocument('doc-123');

      expect(result).toEqual(doc);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(null);

      await expect(service.findOneDocument('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createDocument', () => {
    const createDto: CreateLegalDocumentDto = {
      documentType: DocumentType.contract_template,
      title: 'Mẫu hợp đồng mới',
      fileUrl: 'https://example.com/new.pdf',
      fileType: 'pdf',
      version: '1.0',
    };

    it('should create document', async () => {
      const admin = mockAdminJwtPayload();
      const created = mockDocument();
      prisma.legalDocument.create.mockResolvedValue(created as any);

      const result = await service.createDocument(createDto, admin);

      expect(result).toEqual(created);
    });
  });

  describe('updateDocument', () => {
    it('should update document', async () => {
      const doc = mockDocument();
      const updated = { ...doc, title: 'Cập nhật' };

      prisma.legalDocument.findUnique.mockResolvedValue(doc as any);
      prisma.legalDocument.update.mockResolvedValue(updated as any);

      const result = await service.updateDocument('doc-123', {
        title: 'Cập nhật',
      });

      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(null);

      await expect(service.updateDocument('non-existent', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
