import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateApartmentDto,
  CancelPartnerCooperationContractDto,
  UpdatePartnerCooperationApartmentInUploadDto,
  UpdateApartmentDto,
  SearchApartmentDto,
  RateApartmentDto,
} from './dto';
import {
  ApartmentStatus,
  ActorType,
  ContractStatus,
  MemberStatus,
  PartnerCooperationContractStatus,
  Prisma,
} from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';
import axios from 'axios';
import {
  ContractPdfService,
  type PartnerCooperationPdfData,
} from '../contracts/contract-pdf.service';
import { NotificationsService } from '../notifications/notifications.service';
import * as crypto from 'crypto';

@Injectable()
export class ApartmentsService {
  private readonly provincesBaseUrl = 'https://provinces.open-api.vn';
  private readonly pdfTokenSecret =
    process.env.JWT_SECRET || 'pdf-token-secret';
  private readonly pdfTokenExpiry = 5 * 60 * 1000;
  private readonly cooperationVerifiedStatus = 'verified' as ApartmentStatus;
  private readonly cooperationPendingStatus = 'pending' as ApartmentStatus;

  constructor(
    private readonly prisma: PrismaService,
    private readonly contractPdfService: ContractPdfService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async notifySafely(params: {
    recipientType: ActorType;
    recipientId: string;
    title: string;
    message: string;
    actionUrl?: string;
    actionLabel?: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
  }): Promise<void> {
    try {
      await this.notificationsService.createAndPush({
        recipientType: params.recipientType,
        recipientId: params.recipientId,
        notificationType: 'info',
        channel: 'in_app',
        title: params.title,
        message: params.message,
        actionUrl: params.actionUrl,
        actionLabel: params.actionLabel,
        priority: 'high',
        relatedEntityType: params.relatedEntityType,
        relatedEntityId: params.relatedEntityId,
      });
    } catch {
      // Do not block business flow when notification delivery fails.
    }
  }

  private generatePdfToken(contractId: string): string {
    const expiry = Date.now() + this.pdfTokenExpiry;
    const data = `${contractId}:${expiry}`;
    const signature = crypto
      .createHmac('sha256', this.pdfTokenSecret)
      .update(data)
      .digest('hex');

    return Buffer.from(`${data}:${signature}`).toString('base64url');
  }

  private verifyPdfToken(token: string): string {
    try {
      const decoded = Buffer.from(token, 'base64url').toString();
      const [contractId, expiryStr, signature] = decoded.split(':');
      const expiry = Number(expiryStr);

      if (Date.now() > expiry) {
        throw new BadRequestException('PDF token expired');
      }

      const expectedSignature = crypto
        .createHmac('sha256', this.pdfTokenSecret)
        .update(`${contractId}:${expiryStr}`)
        .digest('hex');

      if (expectedSignature !== signature) {
        throw new BadRequestException('Invalid PDF token');
      }

      return contractId;
    } catch {
      throw new BadRequestException('Invalid PDF token');
    }
  }

  async getCooperationContractPdfPublic(token: string) {
    const contractId = this.verifyPdfToken(token);

    const contract = await this.prisma.partnerCooperationContract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        contractNumber: true,
        contractPdfData: true,
      },
    });

    if (!contract) {
      throw new NotFoundException('Cooperation contract not found');
    }

    if (!contract.contractPdfData) {
      throw new NotFoundException('Cooperation contract PDF not found');
    }

    return {
      buffer: Buffer.from(contract.contractPdfData),
      contractNumber: contract.contractNumber,
    };
  }

  async getCooperationContractPdf(contractId: string, currentUser: JwtPayload) {
    const contract = await this.prisma.partnerCooperationContract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        contractNumber: true,
        partnerId: true,
        contractPdfData: true,
      },
    });

    if (!contract) {
      throw new NotFoundException('Cooperation contract not found');
    }

    if (
      currentUser.actorType === 'user' &&
      contract.partnerId !== currentUser.sub
    ) {
      throw new ForbiddenException(
        'You can only access your own cooperation contract',
      );
    }

    if (!contract.contractPdfData) {
      throw new NotFoundException('Cooperation contract PDF not found');
    }

    return {
      buffer: Buffer.from(contract.contractPdfData),
      contractNumber: contract.contractNumber,
    };
  }

  async getCooperationContractByApartment(
    apartmentId: string,
    currentUser: JwtPayload,
  ) {
    const apartment = await this.prisma.apartment.findUnique({
      where: { id: apartmentId },
      select: {
        id: true,
        apartmentNumber: true,
        ownerId: true,
      },
    });

    if (!apartment) {
      throw new NotFoundException('Apartment not found');
    }

    if (
      currentUser.actorType === 'user' &&
      apartment.ownerId !== currentUser.sub
    ) {
      throw new ForbiddenException(
        'You can only access cooperation contract of your own apartment',
      );
    }

    const contract = await this.prisma.partnerCooperationContract.findFirst({
      where: { apartmentId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        contractNumber: true,
        status: true,
        startDate: true,
        endDate: true,
        commissionRate: true,
        signedAt: true,
        contractDocumentUrl: true,
        contractPdfData: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!contract) {
      throw new NotFoundException(
        'Cooperation contract not found for apartment',
      );
    }

    const token = contract.contractPdfData
      ? this.generatePdfToken(contract.id)
      : null;

    return {
      apartmentId: apartment.id,
      apartmentNumber: apartment.apartmentNumber,
      cooperationContractId: contract.id,
      cooperationContractNumber: contract.contractNumber,
      cooperationContractStatus: contract.status,
      startDate: contract.startDate,
      endDate: contract.endDate,
      commissionRate: Number(contract.commissionRate),
      signedDate: contract.signedAt,
      contractDocumentUrl: contract.contractDocumentUrl,
      cooperationContractPdfUrl: contract.contractPdfData
        ? `/apartments/cooperation-contracts/${contract.id}/pdf`
        : null,
      cooperationContractPublicPdfUrl: token
        ? `/apartments/cooperation-contracts/pdf/view?token=${token}`
        : null,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
    };
  }

  private formatDateDdMmYyyy(date: Date): string {
    const dd = date.getDate().toString().padStart(2, '0');
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  private formatCurrencyVnd(value: unknown): string {
    const normalized =
      typeof value === 'object' &&
      value !== null &&
      'toNumber' in value &&
      typeof (value as { toNumber: () => number }).toNumber === 'function'
        ? (value as { toNumber: () => number }).toNumber()
        : Number(value);

    return Number.isFinite(normalized)
      ? normalized.toLocaleString('vi-VN')
      : '0';
  }

  private async generateCooperationContractNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `COOP-${year}`;
    const count = await this.prisma.partnerCooperationContract.count({
      where: {
        contractNumber: { startsWith: prefix },
      },
    });

    return `${prefix}-${String(count + 1).padStart(5, '0')}`;
  }

  private toRoundedRating(value?: number | null): number | null {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return null;
    }
    return Number(value.toFixed(2));
  }

  async getAddressDivisions(
    version: 'v1' | 'v2' = 'v2',
    depth = 2,
    search?: string,
  ) {
    const endpoint =
      search && search.trim().length > 0
        ? `${this.provincesBaseUrl}/api/${version}/p/`
        : `${this.provincesBaseUrl}/api/${version}/`;

    const response = await axios.get(endpoint, {
      params: {
        ...(search && search.trim().length > 0
          ? { search: search.trim() }
          : { depth }),
      },
      timeout: 15000,
    });

    return response.data as unknown;
  }

  /**
   * Resolve province code from a v2 ward code via external API
   */
  private async resolveProvinceCodeFromWard(
    wardCode: number,
  ): Promise<number | undefined> {
    try {
      const response = await axios.get(
        `${this.provincesBaseUrl}/api/v2/w/${wardCode}`,
        { timeout: 15000 },
      );
      return response.data?.province_code ?? undefined;
    } catch {
      // If lookup fails, don't block the operation
      return undefined;
    }
  }

  /**
   * Search apartments with filters and pagination
   * By default returns all statuses unless status filter is provided
   */
  async search(searchDto: SearchApartmentDto) {
    const {
      provinceCode,
      wardCode,
      keyword,
      minBedrooms,
      maxBedrooms,
      minPrice,
      maxPrice,
      minArea,
      maxArea,
      furnishingStatus,
      status,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = searchDto;

    // Build address filter conditions
    const addressFilters: Prisma.ApartmentWhereInput[] = [];

    if (provinceCode !== undefined) {
      addressFilters.push({ provinceCode });
    }

    if (wardCode !== undefined) {
      addressFilters.push({ wardCode });
    }

    // Combine all AND conditions
    const andConditions: Prisma.ApartmentWhereInput[] = [];

    if (addressFilters.length > 0) {
      andConditions.push(...addressFilters);
    }

    if (keyword) {
      andConditions.push({
        OR: [
          {
            buildingName: {
              contains: keyword,
              mode: 'insensitive' as const,
            },
          },
          {
            apartmentNumber: {
              contains: keyword,
              mode: 'insensitive' as const,
            },
          },
          {
            description: {
              contains: keyword,
              mode: 'insensitive' as const,
            },
          },
        ],
      });
    }

    const where: Prisma.ApartmentWhereInput = {
      ...(status && { status }),
      ...(andConditions.length > 0 && { AND: andConditions }),
      ...((minBedrooms !== undefined || maxBedrooms !== undefined) && {
        numberOfBedrooms: {
          ...(minBedrooms !== undefined && { gte: minBedrooms }),
          ...(maxBedrooms !== undefined && { lte: maxBedrooms }),
        },
      }),
      ...((minPrice !== undefined || maxPrice !== undefined) && {
        baseRentPrice: {
          ...(minPrice !== undefined && { gte: minPrice }),
          ...(maxPrice !== undefined && { lte: maxPrice }),
        },
      }),
      ...((minArea !== undefined || maxArea !== undefined) && {
        totalArea: {
          ...(minArea !== undefined && { gte: minArea }),
          ...(maxArea !== undefined && { lte: maxArea }),
        },
      }),
      ...(furnishingStatus && { furnishingStatus }),
    };

    const skip = (page - 1) * limit;

    const apartmentSelect: Prisma.ApartmentSelect = {
      id: true,
      buildingName: true,
      apartmentNumber: true,
      floorNumber: true,
      totalArea: true,
      numberOfBedrooms: true,
      numberOfBathrooms: true,
      furnishingStatus: true,
      baseRentPrice: true,
      depositAmount: true,
      status: true,
      images: true,
      videoTourUrl: true,
      createdAt: true,
      updatedAt: true,
      wardCode: true,
      provinceCode: true,
      streetAddress: true,
    };

    const [apartments, total] = await Promise.all([
      this.prisma.apartment.findMany({
        where,
        select: apartmentSelect,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      this.prisma.apartment.count({ where }),
    ]);

    const apartmentIds = apartments.map((apartment) => apartment.id);
    const ratingRows = apartmentIds.length
      ? await this.prisma.apartmentRating.groupBy({
          by: ['apartmentId'],
          where: {
            apartmentId: {
              in: apartmentIds,
            },
          },
          _avg: {
            rating: true,
          },
        })
      : [];

    const ratingMap = new Map<string, number | null>(
      ratingRows.map((row) => [
        row.apartmentId,
        this.toRoundedRating(row._avg.rating),
      ]),
    );

    const items = apartments.map((apartment: any) => ({
      ...apartment,
      rating: ratingMap.get(apartment.id) ?? null,
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get apartment by ID with full details
   */
  async findOne(id: string) {
    const [apartment, ratingAggregate] = await Promise.all([
      this.prisma.apartment.findUnique({
        where: { id },

        include: {
          rooms: {
            select: {
              id: true,
              roomNumber: true,
              roomType: true,
              area: true,
              status: true,
            },
          },
          owner: {
            select: {
              id: true,
              companyName: true,
              fullName: true,
            },
          },
          iotDevices: {
            where: { status: 'active' },
            select: {
              id: true,
              deviceName: true,
              deviceType: true,
              status: true,
            },
          },
          utilityMeters: {
            where: { status: 'active' },
            select: {
              id: true,
              meterNumber: true,
              meterType: true,
              currentReading: true,
            },
          },
          userApartments: {
            where: {
              rentalContract: {
                status: ContractStatus.active,
              },
            },
            select: {
              id: true,
              status: true,
              isPrimaryTenant: true,
              moveInDate: true,
              moveOutDate: true,
              user: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
              rentalContract: {
                select: {
                  id: true,
                  contractNumber: true,
                  status: true,
                  members: {
                    select: {
                      id: true,
                      memberType: true,
                      isPrimaryContact: true,
                      status: true,
                      user: {
                        select: {
                          id: true,
                          fullName: true,
                        },
                      },
                    },
                    orderBy: {
                      createdAt: 'asc',
                    },
                  },
                },
              },
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      }),
      this.prisma.apartmentRating.aggregate({
        where: { apartmentId: id },
        _avg: { rating: true },
      }),
    ]);

    if (!apartment) {
      throw new NotFoundException('Apartment not found');
    }

    return {
      ...apartment,
      streetAddress: apartment.streetAddress,
      rating: this.toRoundedRating(ratingAggregate._avg.rating),
    };
  }

  async rateApartment(
    apartmentId: string,
    rateDto: RateApartmentDto,
    currentUser: JwtPayload,
  ) {
    const apartment = await this.prisma.apartment.findUnique({
      where: { id: apartmentId },
      select: { id: true },
    });

    if (!apartment) {
      throw new NotFoundException('Apartment not found');
    }

    const activeMembership = await this.prisma.userContractMember.findFirst({
      where: {
        userId: currentUser.sub,
        status: MemberStatus.active,
        rentalContract: {
          status: ContractStatus.active,
          apartmentId,
        },
      },
      select: {
        rentalContractId: true,
      },
    });

    if (!activeMembership) {
      throw new ForbiddenException(
        'You can only rate apartments in your active contracts',
      );
    }

    const existingRating = await this.prisma.apartmentRating.findUnique({
      where: {
        userId_apartmentId: {
          userId: currentUser.sub,
          apartmentId,
        },
      },
      select: { id: true },
    });

    if (existingRating) {
      throw new ConflictException('You have already rated this apartment');
    }

    const createdRating = await this.prisma.apartmentRating.create({
      data: {
        apartmentId,
        userId: currentUser.sub,
        rentalContractId: activeMembership.rentalContractId,
        rating: rateDto.rating,
        comment: rateDto.comment,
      },
      select: {
        id: true,
        apartmentId: true,
        userId: true,
        rating: true,
        comment: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const ratingAggregate = await this.prisma.apartmentRating.aggregate({
      where: { apartmentId },
      _avg: { rating: true },
    });

    return {
      ...createdRating,
      averageRating: this.toRoundedRating(ratingAggregate._avg.rating),
    };
  }

  /**
   * Create new apartment
   * Operator, Admin, or Partner can create
   */
  async create(
    createDto: CreateApartmentDto,
    currentUser: JwtPayload,
    media?: { imageUrls?: string[]; videoUrl?: string },
  ) {
    // Auto-resolve province code from ward code
    let provinceCode: number | undefined;
    if (createDto.wardCode) {
      provinceCode = await this.resolveProvinceCodeFromWard(createDto.wardCode);
    }

    const images = [
      ...(Array.isArray(createDto.images) ? createDto.images : []),
      ...(media?.imageUrls ?? []),
    ];
    const videoTourUrl = media?.videoUrl ?? createDto.videoTourUrl;

    const data: Prisma.ApartmentCreateInput = {
      buildingName: createDto.buildingName,
      apartmentNumber: createDto.apartmentNumber,
      floorNumber: createDto.floorNumber,
      wardCode: createDto.wardCode,
      provinceCode,
      streetAddress: createDto.streetAddress,
      latitude: createDto.latitude,
      longitude: createDto.longitude,
      totalArea: createDto.totalArea,
      usableArea: createDto.usableArea,
      numberOfBedrooms: createDto.numberOfBedrooms,
      numberOfBathrooms: createDto.numberOfBathrooms,
      furnishingStatus: createDto.furnishingStatus,
      amenities: createDto.amenities,
      baseRentPrice: createDto.baseRentPrice,
      depositAmount: createDto.depositAmount,
      description: createDto.description,
      images,
      videoTourUrl,
      yearBuilt: createDto.yearBuilt,
      status: ApartmentStatus.available,
    };

    // If user creates, link to their account
    if (currentUser.actorType === 'user') {
      data.owner = { connect: { id: currentUser.sub } };
    } else if (createDto.ownerId) {
      data.owner = { connect: { id: createDto.ownerId } };
    }

    return this.prisma.apartment.create({
      data,
      select: {
        id: true,
        apartmentNumber: true,
        wardCode: true,
        provinceCode: true,
        streetAddress: true,
        baseRentPrice: true,
        images: true,
        videoTourUrl: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Partner submits apartment cooperation info.
   * Media can be uploaded at submit step or later via cooperation-media endpoint.
   */
  async submitPartnerCooperation(
    createDto: Omit<CreateApartmentDto, 'images' | 'videoTourUrl'>,
    currentUser: JwtPayload,
    media?: { imageUrls?: string[]; videoUrl?: string },
  ) {
    const partnerIdentity = await this.prisma.user.findUnique({
      where: { id: currentUser.sub },
      select: {
        id: true,
        identity: {
          select: {
            isVerified: true,
          },
        },
      },
    });

    if (!partnerIdentity?.identity?.isVerified) {
      throw new ForbiddenException(
        'Partner must complete identity verification before submitting cooperation apartment',
      );
    }

    const imageUrls = media?.imageUrls ?? [];
    const videoUrl = media?.videoUrl;
    const shouldSetVerified = imageUrls.length > 0 && Boolean(videoUrl);

    const data: Prisma.ApartmentCreateInput = {
      buildingName: createDto.buildingName,
      apartmentNumber: createDto.apartmentNumber,
      floorNumber: createDto.floorNumber,
      wardCode: createDto.wardCode,
      streetAddress: createDto.streetAddress,
      latitude: createDto.latitude,
      longitude: createDto.longitude,
      totalArea: createDto.totalArea,
      usableArea: createDto.usableArea,
      numberOfBedrooms: createDto.numberOfBedrooms,
      numberOfBathrooms: createDto.numberOfBathrooms,
      furnishingStatus: createDto.furnishingStatus,
      amenities: createDto.amenities,
      baseRentPrice: createDto.baseRentPrice,
      depositAmount: createDto.depositAmount,
      description: createDto.description,
      images: imageUrls,
      videoTourUrl: videoUrl,
      yearBuilt: createDto.yearBuilt,
      status: shouldSetVerified
        ? this.cooperationVerifiedStatus
        : ApartmentStatus.inactive,
      owner: { connect: { id: currentUser.sub } },
    };

    const apartment = await this.prisma.apartment.create({
      data,
      select: {
        id: true,
        apartmentNumber: true,
        status: true,
        ownerId: true,
        images: true,
        videoTourUrl: true,
        createdAt: true,
      },
    });

    const partner = await this.prisma.user.findUnique({
      where: { id: currentUser.sub },
      select: {
        createdByStaffId: true,
      },
    });

    if (partner?.createdByStaffId) {
      await this.notifySafely({
        recipientType: ActorType.staff,
        recipientId: partner.createdByStaffId,
        title: 'Partner gui can ho hop tac moi',
        message: `Partner vua gui can ho ${apartment.apartmentNumber} cho quy trinh hop tac.`,
        actionUrl: `/apartments/${apartment.id}`,
        actionLabel: 'Xem can ho',
        relatedEntityType: 'Apartment',
        relatedEntityId: apartment.id,
      });
    }

    return apartment;
  }

  async uploadCooperationMedia(
    id: string,
    media: { imageUrls?: string[]; videoUrl?: string },
    currentUser: JwtPayload,
    updateDto?: UpdatePartnerCooperationApartmentInUploadDto,
  ) {
    const apartment = await this.prisma.apartment.findUnique({
      where: { id },
      select: {
        id: true,
        apartmentNumber: true,
        ownerId: true,
        status: true,
        images: true,
        videoTourUrl: true,
        approvedAt: true,
      },
    });

    if (!apartment) {
      throw new NotFoundException('Apartment not found');
    }

    if (
      currentUser.actorType === 'user' &&
      apartment.ownerId !== currentUser.sub
    ) {
      throw new ForbiddenException(
        'You can only upload media for your own cooperation apartment',
      );
    }

    if (apartment.approvedAt) {
      throw new BadRequestException(
        'Approved apartment cannot update cooperation media',
      );
    }

    const existingImages = Array.isArray(apartment.images)
      ? apartment.images.filter(
          (image): image is string => typeof image === 'string',
        )
      : [];
    const incomingImages = media.imageUrls ?? [];
    const mergedImages = [...existingImages, ...incomingImages];
    const effectiveVideoUrl = media.videoUrl ?? apartment.videoTourUrl;

    const shouldSetVerified =
      mergedImages.length > 0 &&
      Boolean(effectiveVideoUrl) &&
      (apartment.status === ApartmentStatus.inactive ||
        apartment.status === this.cooperationVerifiedStatus);

    const canUpdateInfo =
      updateDto &&
      Object.values(updateDto).some((value) => value !== undefined);

    const apartmentUpdateData: Prisma.ApartmentUpdateInput = {
      ...(incomingImages.length > 0 ? { images: mergedImages } : {}),
      ...(media.videoUrl ? { videoTourUrl: media.videoUrl } : {}),
      ...(shouldSetVerified ? { status: this.cooperationVerifiedStatus } : {}),
    };

    if (canUpdateInfo) {
      const blockedUpdateKeys = new Set(['ownerId', 'images', 'videoTourUrl']);
      const restUpdateDto = Object.fromEntries(
        Object.entries(updateDto).filter(
          ([key, value]) => !blockedUpdateKeys.has(key) && value !== undefined,
        ),
      );

      Object.assign(apartmentUpdateData, restUpdateDto);

      if (updateDto.wardCode !== undefined) {
        apartmentUpdateData.provinceCode =
          updateDto.wardCode !== null
            ? await this.resolveProvinceCodeFromWard(updateDto.wardCode)
            : null;
      }
    }

    return this.prisma.apartment.update({
      where: { id },
      data: apartmentUpdateData,
      select: {
        id: true,
        apartmentNumber: true,
        status: true,
        images: true,
        videoTourUrl: true,
        updatedAt: true,
      },
    });
  }

  async rejectPartnerCooperation(
    id: string,
    operatorId: string,
    reason: string,
  ) {
    const apartment = await this.prisma.apartment.findUnique({
      where: { id },
      select: {
        id: true,
        apartmentNumber: true,
        ownerId: true,
        status: true,
      },
    });

    if (!apartment) {
      throw new NotFoundException('Apartment not found');
    }

    if (
      apartment.status === ApartmentStatus.available ||
      apartment.status === ApartmentStatus.occupied ||
      apartment.status === ApartmentStatus.reserved
    ) {
      throw new ConflictException(
        'Apartment cannot be rejected in current status',
      );
    }

    const rejectedAt = new Date();

    const updatedApartment = await this.prisma.$transaction(async (tx) => {
      await tx.partnerCooperationContract.updateMany({
        where: {
          apartmentId: id,
          status: {
            in: [
              PartnerCooperationContractStatus.draft,
              PartnerCooperationContractStatus.pending,
              PartnerCooperationContractStatus.signed,
              PartnerCooperationContractStatus.active,
            ],
          },
        },
        data: {
          status: PartnerCooperationContractStatus.cancelled,
          notes: `Rejected by operator ${operatorId}: ${reason}`,
          endDate: rejectedAt,
        },
      });

      return tx.apartment.update({
        where: { id },
        data: {
          status: ApartmentStatus.inactive,
        },
        select: {
          id: true,
          apartmentNumber: true,
          status: true,
        },
      });
    });

    if (apartment.ownerId) {
      await this.notifySafely({
        recipientType: ActorType.user,
        recipientId: apartment.ownerId,
        title: 'Can ho hop tac bi tu choi',
        message: `Can ho ${apartment.apartmentNumber} da bi operator tu choi. Ly do: ${reason}`,
        actionUrl: `/apartments/${id}`,
        actionLabel: 'Xem chi tiet',
        relatedEntityType: 'Apartment',
        relatedEntityId: id,
      });
    }

    return {
      id: updatedApartment.id,
      apartmentNumber: updatedApartment.apartmentNumber,
      status: updatedApartment.status,
      rejectedAt,
      rejectionReason: reason,
    };
  }

  /**
   * Update apartment
   * Only owner (user) or Admin/Operator can update
   */
  async update(
    id: string,
    updateDto: UpdateApartmentDto,
    currentUser: JwtPayload,
    media?: { imageUrls?: string[]; videoUrl?: string },
  ) {
    const apartment = await this.prisma.apartment.findUnique({
      where: { id },
      select: { id: true, ownerId: true, images: true },
    });

    if (!apartment) {
      throw new NotFoundException('Apartment not found');
    }

    // Users can only update their own apartments
    if (
      currentUser.actorType === 'user' &&
      apartment.ownerId !== currentUser.sub
    ) {
      throw new ForbiddenException('You can only update your own apartments');
    }

    // Auto-resolve province code if wardCode is being updated
    const data: any = { ...updateDto };
    if (updateDto.wardCode !== undefined) {
      if (updateDto.wardCode !== null) {
        data.provinceCode = await this.resolveProvinceCodeFromWard(
          updateDto.wardCode,
        );
      } else {
        data.provinceCode = null;
      }
    }

    if (media?.imageUrls?.length) {
      const baseImages = Array.isArray(updateDto.images)
        ? updateDto.images
        : Array.isArray(apartment.images)
          ? apartment.images.filter(
              (image): image is string => typeof image === 'string',
            )
          : [];

      data.images = [...baseImages, ...media.imageUrls];
    }

    if (media?.videoUrl) {
      data.videoTourUrl = media.videoUrl;
    }

    return this.prisma.apartment.update({
      where: { id },
      data,
      select: {
        id: true,
        apartmentNumber: true,
        wardCode: true,
        provinceCode: true,
        streetAddress: true,
        baseRentPrice: true,
        images: true,
        videoTourUrl: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Delete apartment (soft delete by marking inactive)
   * Only Admin can delete
   */
  async remove(id: string) {
    const apartment = await this.prisma.apartment.findUnique({
      where: { id },
    });

    if (!apartment) {
      throw new NotFoundException('Apartment not found');
    }

    return this.prisma.apartment.update({
      where: { id },
      data: { status: ApartmentStatus.inactive },
      select: {
        id: true,
        apartmentNumber: true,
        status: true,
      },
    });
  }

  /**
   * Get apartments by owner (for owner dashboard)
   */
  async findByOwner(ownerId: string) {
    const apartments = await this.prisma.apartment.findMany({
      where: { ownerId },
      include: {
        rooms: {
          select: {
            id: true,
            roomNumber: true,
            roomType: true,
            area: true,
            status: true,
          },
        },
        owner: {
          select: {
            id: true,
            companyName: true,
            fullName: true,
          },
        },
        iotDevices: {
          where: { status: 'active' },
          select: {
            id: true,
            deviceName: true,
            deviceType: true,
            status: true,
          },
        },
        utilityMeters: {
          where: { status: 'active' },
          select: {
            id: true,
            meterNumber: true,
            meterType: true,
            currentReading: true,
          },
        },
        cooperationContracts: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            contractNumber: true,
            status: true,
            startDate: true,
            endDate: true,
            signedAt: true,
            contractDocumentUrl: true,
            contractPdfData: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const apartmentIds = apartments.map((apartment) => apartment.id);
    const ratingRows = apartmentIds.length
      ? await this.prisma.apartmentRating.groupBy({
          by: ['apartmentId'],
          where: {
            apartmentId: {
              in: apartmentIds,
            },
          },
          _avg: {
            rating: true,
          },
        })
      : [];

    const ratingMap = new Map<string, number | null>(
      ratingRows.map((row) => [
        row.apartmentId,
        this.toRoundedRating(row._avg.rating),
      ]),
    );

    return apartments.map((apartment) => {
      const latestCooperationContract = apartment.cooperationContracts?.[0];
      const contractToken = latestCooperationContract?.contractPdfData
        ? this.generatePdfToken(latestCooperationContract.id)
        : null;

      return {
        ...apartment,
        cooperationContracts: (apartment.cooperationContracts ?? []).map(
          (contract) => ({
            id: contract.id,
            contractNumber: contract.contractNumber,
            status: contract.status,
            startDate: contract.startDate,
            endDate: contract.endDate,
            signedDate: contract.signedAt,
            contractDocumentUrl: contract.contractDocumentUrl,
            cooperationContractPdfUrl: contract.contractPdfData
              ? `/apartments/cooperation-contracts/${contract.id}/pdf`
              : null,
            cooperationContractPublicPdfUrl: contractToken
              ? `/apartments/cooperation-contracts/pdf/view?token=${contractToken}`
              : null,
          }),
        ),
        cooperationContract: latestCooperationContract
          ? {
              id: latestCooperationContract.id,
              contractNumber: latestCooperationContract.contractNumber,
              status: latestCooperationContract.status,
              startDate: latestCooperationContract.startDate,
              endDate: latestCooperationContract.endDate,
              signedDate: latestCooperationContract.signedAt,
              contractDocumentUrl:
                latestCooperationContract.contractDocumentUrl,
              cooperationContractPdfUrl:
                latestCooperationContract.contractPdfData
                  ? `/apartments/cooperation-contracts/${latestCooperationContract.id}/pdf`
                  : null,
              cooperationContractPublicPdfUrl: contractToken
                ? `/apartments/cooperation-contracts/pdf/view?token=${contractToken}`
                : null,
            }
          : null,
        rating: ratingMap.get(apartment.id) ?? null,
      };
    });
  }

  /**
   * Update apartment status
   */
  async updateStatus(id: string, status: ApartmentStatus) {
    return this.prisma.apartment.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        apartmentNumber: true,
        status: true,
      },
    });
  }

  /**
   * Approve apartment (by operator)
   */
  async approve(id: string, operatorId: string) {
    return this.prisma.apartment.update({
      where: { id },
      data: {
        status: ApartmentStatus.available,
        approvedByOperator: { connect: { id: operatorId } },
        approvedAt: new Date(),
      },
      select: {
        id: true,
        apartmentNumber: true,
        status: true,
        approvedAt: true,
      },
    });
  }

  /**
   * Operator approves a partner cooperation apartment after staff has uploaded media.
   */
  async approvePartnerCooperation(id: string, operatorId: string) {
    const apartment = await this.prisma.apartment.findUnique({
      where: { id },
      select: {
        id: true,
        apartmentNumber: true,
        buildingName: true,
        ownerId: true,
        wardCode: true,
        streetAddress: true,
        totalArea: true,
        usableArea: true,
        numberOfBedrooms: true,
        numberOfBathrooms: true,
        baseRentPrice: true,
        depositAmount: true,
        status: true,
        images: true,
        videoTourUrl: true,
        approvedAt: true,
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            address: true,
            companyName: true,
            commissionRate: true,
            identity: {
              select: {
                nationalId: true,
                issueDate: true,
                address: true,
              },
            },
          },
        },
      },
    });

    if (!apartment) {
      throw new NotFoundException('Apartment not found');
    }

    if (apartment.approvedAt) {
      throw new BadRequestException('Apartment has already been approved');
    }

    const hasImages =
      Array.isArray(apartment.images) && apartment.images.length > 0;
    const hasVideo = Boolean(apartment.videoTourUrl);

    if (!hasImages || !hasVideo) {
      throw new BadRequestException(
        'Apartment must have at least one image and one video before approval',
      );
    }

    if (apartment.status !== this.cooperationVerifiedStatus) {
      throw new BadRequestException(
        'Only verified cooperation apartment can be approved',
      );
    }

    if (!apartment.ownerId || !apartment.owner) {
      throw new BadRequestException(
        'Partner owner information is required to create cooperation contract',
      );
    }
    const ownerId = apartment.ownerId;

    const contractNumber = await this.generateCooperationContractNumber();

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);

    const commissionRate =
      apartment.owner.commissionRate != null
        ? Number(apartment.owner.commissionRate)
        : 10;

    const pdfData: PartnerCooperationPdfData = {
      contractNumber,
      partnerName: apartment.owner.fullName,
      partnerCompanyName: apartment.owner.companyName ?? undefined,
      partnerPhone: apartment.owner.phone ?? undefined,
      partnerEmail: apartment.owner.email,
      apartmentAddress:
        apartment.streetAddress ?? apartment.buildingName ?? undefined,
      apartmentNumber: apartment.apartmentNumber,
      cooperationStartDate: this.formatDateDdMmYyyy(startDate),
      cooperationEndDate: this.formatDateDdMmYyyy(endDate),
      monthlyRevenueCommissionRate: commissionRate.toFixed(2),
      notes: 'Hop dong hop tac khai thac can ho giua partner va IntelliServOps',
    };

    const pdfBuffer =
      await this.contractPdfService.generatePartnerCooperationPdf(pdfData);

    const result = await this.prisma.$transaction(async (tx) => {
      const contract = await tx.partnerCooperationContract.create({
        data: {
          contractNumber,
          apartment: { connect: { id } },
          partner: { connect: { id: ownerId } },
          approvedByOperator: { connect: { id: operatorId } },
          startDate,
          endDate,
          commissionRate,
          status: PartnerCooperationContractStatus.pending,
          terms: 'COOPERATION_CONTRACT_TEMPLATE',
          notes:
            'Generated when operator approved partner cooperation apartment',
          contractPdfData: new Uint8Array(pdfBuffer),
        },
        select: {
          id: true,
          contractNumber: true,
          status: true,
        },
      });

      const approvedApartment = await tx.apartment.update({
        where: { id },
        data: {
          status: this.cooperationPendingStatus,
          approvedByOperator: { connect: { id: operatorId } },
          approvedAt: new Date(),
        },
        select: {
          id: true,
          apartmentNumber: true,
          status: true,
          images: true,
          videoTourUrl: true,
          approvedAt: true,
        },
      });

      return { approvedApartment, contract };
    });

    const token = this.generatePdfToken(result.contract.id);

    await this.notifySafely({
      recipientType: ActorType.user,
      recipientId: ownerId,
      title: 'Can ho hop tac da duoc duyet',
      message: `Can ho ${result.approvedApartment.apartmentNumber} da duoc operator duyet va tao hop dong hop tac.`,
      actionUrl: `/apartments/${id}/cooperation-contract`,
      actionLabel: 'Xem hop dong',
      relatedEntityType: 'Apartment',
      relatedEntityId: id,
    });

    return {
      ...result.approvedApartment,
      cooperationContractId: result.contract.id,
      cooperationContractNumber: result.contract.contractNumber,
      cooperationContractStatus: result.contract.status,
      cooperationContractPdfUrl: `/apartments/cooperation-contracts/${result.contract.id}/pdf`,
      cooperationContractPublicPdfUrl: `/apartments/cooperation-contracts/pdf/view?token=${token}`,
    };
  }

  async partnerSignCooperationContract(
    apartmentId: string,
    currentUser: JwtPayload,
    contractPdf: {
      mimetype: string;
      buffer: Buffer;
    },
    options?: { signedDate?: string; contractDocumentUrl?: string },
  ) {
    if (contractPdf.mimetype !== 'application/pdf') {
      throw new BadRequestException(
        `Invalid PDF format. Allowed: application/pdf. Received: ${contractPdf.mimetype}`,
      );
    }

    const apartment = await this.prisma.apartment.findUnique({
      where: { id: apartmentId },
      select: {
        id: true,
        apartmentNumber: true,
        ownerId: true,
        status: true,
      },
    });

    if (!apartment) {
      throw new NotFoundException('Apartment not found');
    }

    if (apartment.ownerId !== currentUser.sub) {
      throw new ForbiddenException(
        'You can only sign cooperation contract of your own apartment',
      );
    }

    if (apartment.status !== this.cooperationPendingStatus) {
      throw new BadRequestException(
        'Apartment must be pending before partner signs cooperation contract',
      );
    }

    const contract = await this.prisma.partnerCooperationContract.findFirst({
      where: {
        apartmentId,
        partnerId: currentUser.sub,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        contractNumber: true,
        status: true,
        approvedByOperatorId: true,
      },
    });

    if (!contract) {
      throw new NotFoundException(
        'Cooperation contract not found for apartment',
      );
    }

    if (
      contract.status === PartnerCooperationContractStatus.terminated ||
      contract.status === PartnerCooperationContractStatus.expired ||
      contract.status === PartnerCooperationContractStatus.cancelled
    ) {
      throw new ConflictException('Cooperation contract cannot be signed');
    }

    const signedDate = options?.signedDate
      ? new Date(options.signedDate)
      : new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const signedContract = await tx.partnerCooperationContract.update({
        where: { id: contract.id },
        data: {
          contractPdfData: new Uint8Array(contractPdf.buffer),
          contractDocumentUrl: options?.contractDocumentUrl,
          signedAt: signedDate,
          status: PartnerCooperationContractStatus.signed,
        },
        select: {
          id: true,
          contractNumber: true,
          status: true,
          signedAt: true,
          contractDocumentUrl: true,
        },
      });

      await tx.apartment.update({
        where: { id: apartmentId },
        data: {
          status: ApartmentStatus.available,
        },
      });

      return signedContract;
    });

    const token = this.generatePdfToken(updated.id);

    if (contract.approvedByOperatorId) {
      await this.notifySafely({
        recipientType: ActorType.operator,
        recipientId: contract.approvedByOperatorId,
        title: 'Partner da ky hop dong hop tac',
        message: `Partner da ky va upload hop dong cho can ho ${apartment.apartmentNumber}.`,
        actionUrl: `/apartments/${apartmentId}/cooperation-contract`,
        actionLabel: 'Xem hop dong',
        relatedEntityType: 'Apartment',
        relatedEntityId: apartmentId,
      });
    }

    return {
      apartmentId: apartment.id,
      apartmentNumber: apartment.apartmentNumber,
      apartmentStatus: ApartmentStatus.available,
      cooperationContractId: updated.id,
      cooperationContractNumber: updated.contractNumber,
      cooperationContractStatus: updated.status,
      signedDate: updated.signedAt,
      contractDocumentUrl: updated.contractDocumentUrl,
      cooperationContractPdfUrl: `/apartments/cooperation-contracts/${updated.id}/pdf`,
      cooperationContractPublicPdfUrl: `/apartments/cooperation-contracts/pdf/view?token=${token}`,
    };
  }

  async cancelPartnerCooperationContract(
    apartmentId: string,
    currentUser: JwtPayload,
    body?: CancelPartnerCooperationContractDto,
  ) {
    const apartment = await this.prisma.apartment.findUnique({
      where: { id: apartmentId },
      select: {
        id: true,
        apartmentNumber: true,
        ownerId: true,
      },
    });

    if (!apartment) {
      throw new NotFoundException('Apartment not found');
    }

    if (apartment.ownerId !== currentUser.sub) {
      throw new ForbiddenException(
        'You can only cancel cooperation contract of your own apartment',
      );
    }

    const contract = await this.prisma.partnerCooperationContract.findFirst({
      where: {
        apartmentId,
        partnerId: currentUser.sub,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        contractNumber: true,
        status: true,
        notes: true,
        approvedByOperatorId: true,
      },
    });

    if (!contract) {
      throw new NotFoundException(
        'Cooperation contract not found for apartment',
      );
    }

    if (
      contract.status === PartnerCooperationContractStatus.cancelled ||
      contract.status === PartnerCooperationContractStatus.terminated ||
      contract.status === PartnerCooperationContractStatus.expired
    ) {
      throw new ConflictException('Cooperation contract cannot be cancelled');
    }

    const cancelledAt = new Date();
    const cancelReason = body?.reason?.trim() || null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const cancelledContract = await tx.partnerCooperationContract.update({
        where: { id: contract.id },
        data: {
          status: PartnerCooperationContractStatus.cancelled,
          endDate: cancelledAt,
          notes: cancelReason
            ? `${contract.notes ?? ''}${contract.notes ? '\n' : ''}Cancelled by partner: ${cancelReason}`
            : contract.notes,
        },
        select: {
          id: true,
          contractNumber: true,
          status: true,
        },
      });

      const updatedApartment = await tx.apartment.update({
        where: { id: apartmentId },
        data: {
          status: ApartmentStatus.inactive,
        },
        select: {
          id: true,
          apartmentNumber: true,
          status: true,
        },
      });

      return { cancelledContract, updatedApartment };
    });

    if (contract.approvedByOperatorId) {
      await this.notifySafely({
        recipientType: ActorType.operator,
        recipientId: contract.approvedByOperatorId,
        title: 'Partner da huy hop dong hop tac',
        message: `Partner da huy hop dong hop tac cua can ho ${apartment.apartmentNumber}.`,
        actionUrl: `/apartments/${apartmentId}/cooperation-contract`,
        actionLabel: 'Xem hop dong',
        relatedEntityType: 'Apartment',
        relatedEntityId: apartmentId,
      });
    }

    return {
      apartmentId: updated.updatedApartment.id,
      apartmentNumber: updated.updatedApartment.apartmentNumber,
      apartmentStatus: updated.updatedApartment.status,
      cooperationContractId: updated.cancelledContract.id,
      cooperationContractNumber: updated.cancelledContract.contractNumber,
      cooperationContractStatus: updated.cancelledContract.status,
      cancelledAt,
      cancelReason,
    };
  }
}
