import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { FptAiService } from '../../shared/services/fpt-ai.service';
import {
  CreatePartnerRequestDto,
  UpdatePartnerRequestDto,
  UpdatePartnerProfileDto,
  ReviewPartnerRequestDto,
} from './dto';
import { PartnerRequestStatus, Prisma } from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class PartnersService {
  private readonly logger = new Logger(PartnersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fptAiService: FptAiService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Partner Profile ────────────────────────────────────────

  async findAllPartners(isActive?: string) {
    const where: Prisma.PartnerWhereInput = {};
    if (isActive === 'true') where.isActive = true;
    if (isActive === 'false') where.isActive = false;

    return this.prisma.partner.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        companyName: true,
        email: true,
        phone: true,
        address: true,
        isVerified: true,
        isActive: true,
        commissionRate: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOnePartner(id: string) {
    const partner = await this.prisma.partner.findUnique({
      where: { id },
      include: {
        identity: true,
        apartments: {
          select: {
            id: true,
            apartmentNumber: true,
            newWardCode: true,
            oldWardCode: true,
            status: true,
          },
        },
        partnerRequests: {
          select: {
            id: true,
            propertyType: true,
            status: true,
            city: true,
            district: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!partner) {
      throw new NotFoundException('Partner not found');
    }

    return partner;
  }

  async getMyProfile(currentUser: JwtPayload) {
    return this.findOnePartner(currentUser.sub);
  }

  // ─── Update Partner Profile ─────────────────────────────────

  async updateProfile(
    updateDto: UpdatePartnerProfileDto,
    currentUser: JwtPayload,
  ) {
    const partner = await this.prisma.partner.findUnique({
      where: { id: currentUser.sub },
    });

    if (!partner) {
      throw new NotFoundException('Partner not found');
    }

    // Check email uniqueness if being updated
    if (updateDto.email && updateDto.email !== partner.email) {
      const emailExists = await this.prisma.partner.findUnique({
        where: { email: updateDto.email },
      });
      if (emailExists) {
        throw new ConflictException('Email already in use');
      }
    }

    // Check taxCode uniqueness if being updated
    if (updateDto.taxCode && updateDto.taxCode !== partner.taxCode) {
      const taxCodeExists = await this.prisma.partner.findFirst({
        where: { taxCode: updateDto.taxCode },
      });
      if (taxCodeExists) {
        throw new ConflictException('Tax code already in use');
      }
    }

    return this.prisma.partner.update({
      where: { id: currentUser.sub },
      data: updateDto,
      select: {
        id: true,
        email: true,
        phone: true,
        fullName: true,
        companyName: true,
        taxCode: true,
        bankAccountNumber: true,
        bankName: true,
        address: true,
        isVerified: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  // ─── Verify Identity Card via AI ────────────────────────────

  /**
   * Update partner's identity card by uploading front + back images
   * AI extracts info from both sides - images are NOT stored in DB
   */
  async updateIdentityCard(
    partnerId: string,
    identityCardFrontFile: any,
    identityCardBackFile: any,
  ) {
    // Validate file types
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validMimeTypes.includes(identityCardFrontFile.mimetype)) {
      throw new BadRequestException(
        `Invalid front image format. Allowed: JPEG, PNG, WebP. Received: ${identityCardFrontFile.mimetype}`,
      );
    }
    if (!validMimeTypes.includes(identityCardBackFile.mimetype)) {
      throw new BadRequestException(
        `Invalid back image format. Allowed: JPEG, PNG, WebP. Received: ${identityCardBackFile.mimetype}`,
      );
    }

    const partner = await this.prisma.partner.findUnique({
      where: { id: partnerId },
      include: { identity: true },
    });

    if (!partner) {
      throw new NotFoundException('Partner not found');
    }

    let autoVerified = false;
    let frontResult: any = null;
    let backResult: any = null;

    // Call FPT AI for both sides in parallel
    const frontBase64 = identityCardFrontFile.buffer.toString('base64');
    const backBase64 = identityCardBackFile.buffer.toString('base64');

    try {
      this.logger.log(
        `Verifying ID card (front + back) for partner: ${partnerId}`,
      );
      [frontResult, backResult] = await Promise.all([
        this.fptAiService.verifyIdCardFromBase64(frontBase64),
        this.fptAiService.verifyIdCardFromBase64(backBase64),
      ]);

      if (this.fptAiService.isVerificationSuccessful(frontResult)) {
        autoVerified = true;
        this.logger.log(
          `Front ID card verified via AI for partner: ${partnerId}`,
        );
      } else {
        this.logger.warn(
          `Front ID card verification failed for partner: ${partnerId}, Error: ${frontResult.errorMessage}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `FPT AI verification error for partner ${partnerId}: ${error.message}`,
      );
      throw new BadRequestException(
        error?.message || 'Không thể xác thực CCCD bằng AI lúc này',
      );
    }

    // Merge extracted info from front and back
    const frontInfo = this.fptAiService.extractUserInfo(frontResult) || {};
    const backInfo = this.fptAiService.extractUserInfo(backResult) || {};
    const extractedInfo = { ...frontInfo, ...backInfo };

    // Prepare PartnerIdentity update data
    const identityUpdateData: any = {};

    if (Object.keys(extractedInfo).length > 0) {
      if (extractedInfo.id) identityUpdateData.nationalId = extractedInfo.id;
      if (extractedInfo.name) identityUpdateData.name = extractedInfo.name;
      if (extractedInfo.dob) identityUpdateData.dob = extractedInfo.dob;
      if (extractedInfo.sex) identityUpdateData.sex = extractedInfo.sex;
      if (extractedInfo.nationality)
        identityUpdateData.nationality = extractedInfo.nationality;
      if (extractedInfo.ethnicity)
        identityUpdateData.ethnicity = extractedInfo.ethnicity;
      if (extractedInfo.home) identityUpdateData.home = extractedInfo.home;
      if (extractedInfo.address)
        identityUpdateData.address = extractedInfo.address;
      if (extractedInfo.features)
        identityUpdateData.features = extractedInfo.features;
      if (extractedInfo.issueDate)
        identityUpdateData.issueDate = extractedInfo.issueDate;
      if (extractedInfo.doe) identityUpdateData.doe = extractedInfo.doe;
      if (extractedInfo.province)
        identityUpdateData.province = extractedInfo.province;
      if (extractedInfo.district)
        identityUpdateData.district = extractedInfo.district;
      if (extractedInfo.ward) identityUpdateData.ward = extractedInfo.ward;
      if (extractedInfo.street)
        identityUpdateData.street = extractedInfo.street;

      this.logger.log(
        `Extracted ${Object.keys(extractedInfo).length} fields from ID card (front + back) for partner`,
      );

      // Check if the national ID is already used by another partner
      if (identityUpdateData.nationalId) {
        const existingPartnerIdentity =
          await this.prisma.partnerIdentity.findUnique({
            where: { nationalId: identityUpdateData.nationalId },
            select: { partnerId: true },
          });

        if (
          existingPartnerIdentity &&
          existingPartnerIdentity.partnerId !== partnerId
        ) {
          throw new ConflictException(
            'Số CCCD này đã được sử dụng bởi tài khoản partner khác',
          );
        }

        // Also check against user identities
        const existingUserIdentity = await this.prisma.userIdentity.findUnique({
          where: { nationalId: identityUpdateData.nationalId },
          select: { userId: true },
        });

        if (existingUserIdentity) {
          throw new ConflictException(
            'Số CCCD này đã được sử dụng bởi tài khoản user khác',
          );
        }
      }

      if (autoVerified) {
        identityUpdateData.isVerified = true;
        identityUpdateData.verifiedAt = new Date();
      }
    }

    // Create or update PartnerIdentity record
    await (this.prisma.partnerIdentity.upsert as any)({
      where: { partnerId },
      create: {
        partnerId,
        ...(identityUpdateData as any),
      } as any,
      update: identityUpdateData as any,
    });

    // Auto-verify partner if AI confirms valid ID
    let updatedPartner: any;
    if (
      autoVerified &&
      this.configService.get<boolean>('fptAi.autoVerifyOnSuccess')
    ) {
      updatedPartner = await this.prisma.partner.update({
        where: { id: partnerId },
        data: { isVerified: true },
        include: { identity: true },
      });
      this.logger.log(`Partner ${partnerId} auto-verified after ID card check`);
    } else {
      updatedPartner = await this.prisma.partner.findUnique({
        where: { id: partnerId },
        include: { identity: true },
      });
      if (!updatedPartner) {
        throw new NotFoundException('Partner not found');
      }
    }

    // Attach AI verification metadata to response
    return {
      ...updatedPartner,
      aiVerification: {
        front: frontResult
          ? {
              success: this.fptAiService.isVerificationSuccessful(frontResult),
              extractedInfo: this.fptAiService.extractUserInfo(frontResult),
            }
          : null,
        back: backResult
          ? {
              success: this.fptAiService.isVerificationSuccessful(backResult),
              extractedInfo: this.fptAiService.extractUserInfo(backResult),
            }
          : null,
      },
    };
  }

  // ─── Partner Requests ───────────────────────────────────────

  async findAllRequests(status?: PartnerRequestStatus) {
    const where: Prisma.PartnerRequestWhereInput = {};
    if (status) where.status = status;

    return this.prisma.partnerRequest.findMany({
      where,
      select: {
        id: true,
        propertyType: true,
        address: true,
        city: true,
        district: true,
        status: true,
        createdAt: true,
        partner: {
          select: {
            id: true,
            fullName: true,
            companyName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneRequest(id: string) {
    const request = await this.prisma.partnerRequest.findUnique({
      where: { id },
      include: {
        partner: {
          select: {
            id: true,
            fullName: true,
            companyName: true,
            phone: true,
            email: true,
          },
        },
        reviewedByOperator: {
          select: { id: true, fullName: true },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Partner request not found');
    }

    return request;
  }

  async findMyRequests(currentUser: JwtPayload) {
    return this.prisma.partnerRequest.findMany({
      where: { partnerId: currentUser.sub },
      select: {
        id: true,
        propertyType: true,
        address: true,
        city: true,
        district: true,
        status: true,
        reviewNotes: true,
        rejectionReason: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRequest(
    createDto: CreatePartnerRequestDto,
    currentUser: JwtPayload,
  ) {
    return this.prisma.partnerRequest.create({
      data: {
        partner: { connect: { id: currentUser.sub } },
        propertyType: createDto.propertyType,
        address: createDto.address,
        city: createDto.city,
        district: createDto.district,
        totalArea: createDto.totalArea,
        numberOfUnits: createDto.numberOfUnits,
        expectedRentPrice: createDto.expectedRentPrice,
        description: createDto.description,
        amenities: createDto.amenities,
      },
      select: {
        id: true,
        propertyType: true,
        address: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async updateRequest(
    id: string,
    updateDto: UpdatePartnerRequestDto,
    currentUser: JwtPayload,
  ) {
    const request = await this.prisma.partnerRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Partner request not found');
    }

    if (request.partnerId !== currentUser.sub) {
      throw new BadRequestException('You can only update your own requests');
    }

    if (request.status !== PartnerRequestStatus.submitted) {
      throw new BadRequestException('Can only update submitted requests');
    }

    return this.prisma.partnerRequest.update({
      where: { id },
      data: updateDto as any,
      select: {
        id: true,
        address: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  async reviewRequest(
    id: string,
    reviewDto: ReviewPartnerRequestDto,
    currentUser: JwtPayload,
  ) {
    const request = await this.prisma.partnerRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Partner request not found');
    }

    if (request.status !== PartnerRequestStatus.submitted) {
      throw new BadRequestException('Request is not in submitted status');
    }

    const data: Prisma.PartnerRequestUpdateInput = {
      status: reviewDto.status,
      reviewNotes: reviewDto.reviewNotes,
      reviewedByOperator: { connect: { id: currentUser.sub } },
    };

    if (reviewDto.status === PartnerRequestStatus.approved) {
      data.approvedAt = new Date();
    }

    if (reviewDto.status === PartnerRequestStatus.rejected) {
      data.rejectionReason = reviewDto.rejectionReason;
    }

    return this.prisma.partnerRequest.update({
      where: { id },
      data,
      select: {
        id: true,
        address: true,
        status: true,
        reviewNotes: true,
        updatedAt: true,
      },
    });
  }
}
