import { Test, TestingModule } from '@nestjs/testing';
import { PoliciesService } from './policies.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, mockAdminJwtPayload } from '../../test-utils';
import { CreatePolicyDto, UpdatePolicyDto, CreateLegalDocumentDto } from './dto';
import { PolicyType, DocumentType } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('PoliciesService', () => {
  let service: PoliciesService;
  let prisma: ReturnType<typeof createPrismaMock>;

  const mockPolicy = (overrides = {}) => ({
    id: 'policy-123',
    policyType: PolicyType.terms_and_conditions,
    title: 'Terms of Service',
    content: 'Policy content...',
    version: '1.0',
    language: 'vi',
    effectiveDate: new Date('2026-01-01'),
    isActive: true,
    requiresAcceptance: true,
    displayOrder: 1,
    createdAt: new Date(),
    ...overrides,
  });

  const mockDocument = (overrides = {}) => ({
    id: 'doc-123',
    documentType: DocumentType.contract,
    title: 'Rental Contract Template',
    description: 'Standard rental contract',
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

  describe('findAllPolicies', () => {
    it('should return all policies', async () => {
      const policies = [mockPolicy()];
      prisma.policy.findMany.mockResolvedValue(policies as any);

      const result = await service.findAllPolicies();

      expect(result).toEqual(policies);
    });

    it('should filter by policyType', async () => {
      prisma.policy.findMany.mockResolvedValue([]);

      await service.findAllPolicies(PolicyType.privacy_policy);

      expect(prisma.policy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { policyType: PolicyType.privacy_policy },
        })
      );
    });

    it('should filter by isActive', async () => {
      prisma.policy.findMany.mockResolvedValue([]);

      await service.findAllPolicies(undefined, true);

      expect(prisma.policy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        })
      );
    });
  });

  describe('findActivePublicPolicies', () => {
    it('should return active public policies', async () => {
      const policies = [mockPolicy()];
      prisma.policy.findMany.mockResolvedValue(policies as any);

      const result = await service.findActivePublicPolicies();

      expect(result).toEqual(policies);
    });
  });

  describe('findOnePolicy', () => {
    it('should return policy by ID', async () => {
      const policy = mockPolicy();
      prisma.policy.findUnique.mockResolvedValue(policy as any);

      const result = await service.findOnePolicy('policy-123');

      expect(result).toEqual(policy);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.policy.findUnique.mockResolvedValue(null);

      await expect(service.findOnePolicy('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createPolicy', () => {
    const createDto: CreatePolicyDto = {
      policyType: PolicyType.terms_and_conditions,
      title: 'New Policy',
      content: 'Policy content',
      version: '1.0',
      effectiveDate: '2026-01-01',
    };

    it('should create policy', async () => {
      const admin = mockAdminJwtPayload();
      const created = mockPolicy();
      prisma.policy.create.mockResolvedValue(created as any);

      const result = await service.createPolicy(createDto, admin);

      expect(result).toEqual(created);
    });
  });

  describe('updatePolicy', () => {
    const updateDto: UpdatePolicyDto = {
      title: 'Updated Policy',
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

      await expect(service.updatePolicy('non-existent', updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('approvePolicy', () => {
    it('should approve policy', async () => {
      const admin = mockAdminJwtPayload();
      const approved = { ...mockPolicy(), approvedAt: new Date() };
      prisma.policy.update.mockResolvedValue(approved as any);

      const result = await service.approvePolicy('policy-123', admin);

      expect(result.approvedAt).toBeDefined();
    });
  });

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

      await expect(service.findOneDocument('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createDocument', () => {
    const createDto: CreateLegalDocumentDto = {
      documentType: DocumentType.contract,
      title: 'New Contract',
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
      const updated = { ...doc, title: 'Updated' };

      prisma.legalDocument.findUnique.mockResolvedValue(doc as any);
      prisma.legalDocument.update.mockResolvedValue(updated as any);

      const result = await service.updateDocument('doc-123', { title: 'Updated' });

      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.legalDocument.findUnique.mockResolvedValue(null);

      await expect(service.updateDocument('non-existent', {})).rejects.toThrow(NotFoundException);
    });
  });
});
