import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePolicyDto,
  UpdatePolicyDto,
  CreateLegalDocumentDto,
  UpdateLegalDocumentDto,
} from './dto';
import { Prisma, PolicyType, DocumentType } from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class PoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Policy ─────────────────────────────────────────────────

  async findAllPolicies(policyType?: PolicyType, isActive?: boolean) {
    const where: Prisma.PolicyWhereInput = {};
    if (policyType) where.policyType = policyType;
    if (isActive !== undefined) where.isActive = isActive;

    return this.prisma.policy.findMany({
      where,
      select: {
        id: true,
        policyType: true,
        title: true,
        version: true,
        language: true,
        effectiveDate: true,
        expiryDate: true,
        isActive: true,
        requiresAcceptance: true,
        displayOrder: true,
        createdAt: true,
      },
      orderBy: [{ displayOrder: 'asc' }, { effectiveDate: 'desc' }],
    });
  }

  async findActivePublicPolicies() {
    return this.prisma.policy.findMany({
      where: {
        isActive: true,
        effectiveDate: { lte: new Date() },
        OR: [{ expiryDate: null }, { expiryDate: { gte: new Date() } }],
      },
      select: {
        id: true,
        policyType: true,
        title: true,
        content: true,
        version: true,
        language: true,
        requiresAcceptance: true,
        displayOrder: true,
      },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async findOnePolicy(id: string) {
    const policy = await this.prisma.policy.findUnique({
      where: { id },
      include: {
        createdByAdmin: { select: { id: true, fullName: true } },
        approvedByAdmin: { select: { id: true, fullName: true } },
      },
    });

    if (!policy) {
      throw new NotFoundException('Policy not found');
    }

    return policy;
  }

  async createPolicy(createDto: CreatePolicyDto, currentUser: JwtPayload) {
    return this.prisma.policy.create({
      data: {
        policyType: createDto.policyType,
        title: createDto.title,
        content: createDto.content,
        version: createDto.version,
        language: createDto.language ?? 'vi',
        effectiveDate: new Date(createDto.effectiveDate),
        expiryDate: createDto.expiryDate
          ? new Date(createDto.expiryDate)
          : undefined,
        requiresAcceptance: createDto.requiresAcceptance ?? false,
        displayOrder: createDto.displayOrder ?? 0,
        createdByAdmin: { connect: { id: currentUser.sub } },
      },
      select: {
        id: true,
        policyType: true,
        title: true,
        version: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async updatePolicy(id: string, updateDto: UpdatePolicyDto) {
    const policy = await this.prisma.policy.findUnique({ where: { id } });
    if (!policy) throw new NotFoundException('Policy not found');

    const data: any = { ...updateDto };
    if (updateDto.effectiveDate)
      data.effectiveDate = new Date(updateDto.effectiveDate);
    if (updateDto.expiryDate) data.expiryDate = new Date(updateDto.expiryDate);

    return this.prisma.policy.update({
      where: { id },
      data,
      select: {
        id: true,
        title: true,
        version: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  async approvePolicy(id: string, currentUser: JwtPayload) {
    return this.prisma.policy.update({
      where: { id },
      data: {
        approvedByAdmin: { connect: { id: currentUser.sub } },
        approvedAt: new Date(),
        isActive: true,
      },
      select: { id: true, title: true, isActive: true, approvedAt: true },
    });
  }

  // ─── Legal Document ─────────────────────────────────────────

  async findAllDocuments(documentType?: DocumentType, isPublic?: boolean) {
    const where: Prisma.LegalDocumentWhereInput = {};
    if (documentType) where.documentType = documentType;
    if (isPublic !== undefined) where.isPublic = isPublic;

    return this.prisma.legalDocument.findMany({
      where,
      select: {
        id: true,
        documentType: true,
        title: true,
        description: true,
        fileUrl: true,
        fileType: true,
        category: true,
        language: true,
        version: true,
        isTemplate: true,
        isPublic: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPublicDocuments() {
    return this.prisma.legalDocument.findMany({
      where: { isPublic: true },
      select: {
        id: true,
        documentType: true,
        title: true,
        description: true,
        fileUrl: true,
        fileType: true,
        language: true,
        version: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneDocument(id: string) {
    const doc = await this.prisma.legalDocument.findUnique({
      where: { id },
      include: {
        createdByAdmin: { select: { id: true, fullName: true } },
      },
    });

    if (!doc) {
      throw new NotFoundException('Legal document not found');
    }

    return doc;
  }

  async createDocument(
    createDto: CreateLegalDocumentDto,
    currentUser: JwtPayload,
  ) {
    return this.prisma.legalDocument.create({
      data: {
        documentType: createDto.documentType,
        title: createDto.title,
        description: createDto.description,
        fileUrl: createDto.fileUrl,
        fileType: createDto.fileType,
        fileSizeBytes: createDto.fileSizeBytes,
        category: createDto.category,
        language: createDto.language ?? 'vi',
        version: createDto.version,
        isTemplate: createDto.isTemplate ?? false,
        requiresSignature: createDto.requiresSignature ?? false,
        isPublic: createDto.isPublic ?? false,
        tags: createDto.tags,
        effectiveDate: createDto.effectiveDate
          ? new Date(createDto.effectiveDate)
          : undefined,
        createdByAdmin: { connect: { id: currentUser.sub } },
      },
      select: {
        id: true,
        documentType: true,
        title: true,
        isPublic: true,
        createdAt: true,
      },
    });
  }

  async updateDocument(id: string, updateDto: UpdateLegalDocumentDto) {
    const doc = await this.prisma.legalDocument.findUnique({
      where: { id },
    });
    if (!doc) throw new NotFoundException('Legal document not found');

    const data: any = { ...updateDto };
    if (updateDto.effectiveDate)
      data.effectiveDate = new Date(updateDto.effectiveDate);

    return this.prisma.legalDocument.update({
      where: { id },
      data,
      select: {
        id: true,
        title: true,
        version: true,
        isPublic: true,
        updatedAt: true,
      },
    });
  }
}
