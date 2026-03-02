import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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

  // ─── Policy (Chính sách căn hộ) ────────────────────────────────

  /**
   * Danh sách tất cả chính sách. Admin/Operator/Staff dùng để quản lý.
   */
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
        _count: { select: { apartmentPolicies: true } },
      },
      orderBy: [{ displayOrder: 'asc' }, { effectiveDate: 'desc' }],
    });
  }

  /**
   * Danh sách chính sách đang hiệu lực — dùng cho cư dân/khách xem
   * quy định chung của hệ thống quản lý căn hộ.
   */
  async findActivePolicies() {
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

  /**
   * Lấy tất cả chính sách áp dụng cho 1 căn hộ cụ thể.
   * Thông qua bảng ApartmentPolicy junction.
   */
  async findPoliciesByApartment(apartmentId: string) {
    // Kiểm tra căn hộ tồn tại
    const apartment = await this.prisma.apartment.findUnique({
      where: { id: apartmentId },
      select: { id: true, apartmentNumber: true },
    });
    if (!apartment) {
      throw new NotFoundException(`Apartment ${apartmentId} không tồn tại`);
    }

    return this.prisma.apartmentPolicy.findMany({
      where: {
        apartmentId,
        policy: {
          isActive: true,
          effectiveDate: { lte: new Date() },
          OR: [{ expiryDate: null }, { expiryDate: { gte: new Date() } }],
        },
      },
      select: {
        id: true,
        isRequired: true,
        effectiveDate: true,
        expiryDate: true,
        notes: true,
        policy: {
          select: {
            id: true,
            policyType: true,
            title: true,
            content: true,
            version: true,
            language: true,
            requiresAcceptance: true,
          },
        },
      },
      orderBy: { policy: { displayOrder: 'asc' } },
    });
  }

  /**
   * Chi tiết 1 chính sách, bao gồm danh sách căn hộ áp dụng.
   */
  async findOnePolicy(id: string) {
    const policy = await this.prisma.policy.findUnique({
      where: { id },
      include: {
        createdByAdmin: { select: { id: true, fullName: true } },
        approvedByAdmin: { select: { id: true, fullName: true } },
        apartmentPolicies: {
          select: {
            id: true,
            apartmentId: true,
            isRequired: true,
            effectiveDate: true,
            expiryDate: true,
            apartment: {
              select: {
                id: true,
                apartmentNumber: true,
                buildingName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!policy) {
      throw new NotFoundException('Chính sách không tồn tại');
    }

    return policy;
  }

  /**
   * Tạo chính sách mới cho hệ thống căn hộ.
   */
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
        ...(currentUser.actorType === 'admin' && {
          createdByAdminId: currentUser.sub,
        }),
      },
      select: {
        id: true,
        policyType: true,
        title: true,
        version: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Cập nhật chính sách.
   */
  async updatePolicy(id: string, updateDto: UpdatePolicyDto) {
    const policy = await this.prisma.policy.findUnique({ where: { id } });
    if (!policy) {
      throw new NotFoundException('Chính sách không tồn tại');
    }

    const data: Prisma.PolicyUpdateInput = {
      policyType: updateDto.policyType,
      title: updateDto.title,
      content: updateDto.content,
      version: updateDto.version,
      language: updateDto.language,
      requiresAcceptance: updateDto.requiresAcceptance,
      displayOrder: updateDto.displayOrder,
      isActive: updateDto.isActive,
      ...(updateDto.effectiveDate && {
        effectiveDate: new Date(updateDto.effectiveDate),
      }),
      ...(updateDto.expiryDate && {
        expiryDate: new Date(updateDto.expiryDate),
      }),
    };

    return this.prisma.policy.update({
      where: { id },
      data,
      select: {
        id: true,
        policyType: true,
        title: true,
        version: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Admin duyệt chính sách → kích hoạt.
   */
  async approvePolicy(id: string, currentUser: JwtPayload) {
    const policy = await this.prisma.policy.findUnique({ where: { id } });
    if (!policy) {
      throw new NotFoundException('Chính sách không tồn tại');
    }
    if (policy.approvedAt) {
      throw new BadRequestException('Chính sách đã được duyệt trước đó');
    }

    return this.prisma.policy.update({
      where: { id },
      data: {
        ...(currentUser.actorType === 'admin' && {
          approvedByAdminId: currentUser.sub,
        }),
        approvedAt: new Date(),
        isActive: true,
      },
      select: {
        id: true,
        title: true,
        isActive: true,
        approvedAt: true,
      },
    });
  }

  // ─── Legal Document (Tài liệu pháp lý) ────────────────────────

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
      throw new NotFoundException('Tài liệu pháp lý không tồn tại');
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
        tags: createDto.tags as Prisma.InputJsonValue,
        effectiveDate: createDto.effectiveDate
          ? new Date(createDto.effectiveDate)
          : undefined,
        ...(currentUser.actorType === 'admin' && {
          createdByAdminId: currentUser.sub,
        }),
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
    if (!doc) {
      throw new NotFoundException('Tài liệu pháp lý không tồn tại');
    }

    const data: Prisma.LegalDocumentUpdateInput = {
      documentType: updateDto.documentType,
      title: updateDto.title,
      description: updateDto.description,
      fileUrl: updateDto.fileUrl,
      fileType: updateDto.fileType,
      fileSizeBytes: updateDto.fileSizeBytes,
      category: updateDto.category,
      language: updateDto.language,
      version: updateDto.version,
      isTemplate: updateDto.isTemplate,
      requiresSignature: updateDto.requiresSignature,
      isPublic: updateDto.isPublic,
      tags: updateDto.tags as Prisma.InputJsonValue,
      ...(updateDto.effectiveDate && {
        effectiveDate: new Date(updateDto.effectiveDate),
      }),
    };

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
