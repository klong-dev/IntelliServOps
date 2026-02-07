import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePartnerRequestDto,
  UpdatePartnerRequestDto,
  ReviewPartnerRequestDto,
} from './dto';
import { PartnerRequestStatus, Prisma } from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class PartnersService {
  constructor(private readonly prisma: PrismaService) {}

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
        apartments: {
          select: {
            id: true,
            apartmentNumber: true,
            address: true,
            city: true,
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
