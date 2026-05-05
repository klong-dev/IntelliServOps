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

type WardLookupResponse = {
  name?: string;
  district_code?: number;
  district_name?: string;
  province_code?: number;
  province_name?: string;
};

type WardAddressInfo = {
  wardCode: number;
  wardName: string | null;
  districtCode: number | null;
  districtName: string | null;
  provinceCode: number | null;
  provinceName: string | null;
  fullAddress: string | null;
};

@Injectable()
export class ApartmentsService {
  private readonly provincesBaseUrl = 'https://provinces.open-api.vn';
  private readonly wardAddressCache = new Map<number, WardAddressInfo | null>();
  private readonly pdfTokenSecret =
    process.env.JWT_SECRET || 'pdf-token-secret';
  private readonly pdfTokenExpiry = 5 * 60 * 1000;
  private readonly cooperationVerifiedStatus = 'verified' as ApartmentStatus;
  private readonly cooperationPendingStatus = 'pending' as ApartmentStatus;
  private readonly defaultPartnerCommissionRate = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly contractPdfService: ContractPdfService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async ensureOwnerPartnerDefaultCommission(
    ownerId?: string | null,
  ): Promise<void> {
    if (!ownerId) {
      return;
    }

    await this.prisma.user.updateMany({
      where: {
        id: ownerId,
        isPartner: true,
        commissionRate: null,
      },
      data: {
        commissionRate: new Prisma.Decimal(this.defaultPartnerCommissionRate),
      },
    });
  }

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

  private normalizeApartmentMediaUrl(url?: string | null): string | null {
    if (!url) {
      return null;
    }

    const trimmed = url.trim();
    if (!trimmed) {
      return null;
    }

    const uploadDir = (process.env.LOCAL_UPLOAD_DIR || 'uploads').replace(
      /^\/+|\/+$/g,
      '',
    );
    const configuredBaseUrl = (process.env.APP_PUBLIC_BASE_URL || '')
      .trim()
      .replace(/\/+$/g, '');

    const rewriteUploadPath = (pathname: string) => {
      const marker = `/${uploadDir}/`;
      const markerIndex = pathname.indexOf(marker);

      if (markerIndex < 0) {
        return null;
      }

      const relativePath = pathname
        .slice(markerIndex + marker.length)
        .replace(/^\/+/, '');

      if (!relativePath) {
        return null;
      }

      return configuredBaseUrl
        ? `${configuredBaseUrl}/${uploadDir}/${relativePath}`
        : `/${uploadDir}/${relativePath}`;
    };

    try {
      const parsedUrl = new URL(trimmed);
      return rewriteUploadPath(parsedUrl.pathname) ?? trimmed;
    } catch {
      return rewriteUploadPath(trimmed) ?? trimmed;
    }
  }

  private normalizeApartmentMediaFields<
    T extends { images?: unknown; videoTourUrl?: string | null },
  >(apartment: T): T {
    const normalizedImages = Array.isArray(apartment.images)
      ? apartment.images.map((image) =>
          typeof image === 'string'
            ? (this.normalizeApartmentMediaUrl(image) ?? image)
            : image,
        )
      : apartment.images;

    return {
      ...apartment,
      ...(normalizedImages !== undefined ? { images: normalizedImages } : {}),
      videoTourUrl: this.normalizeApartmentMediaUrl(apartment.videoTourUrl),
    };
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private buildApartmentSlugSource(params: {
    buildingName?: string | null;
    apartmentNumber?: string | null;
  }): string {
    return params.buildingName?.trim() ?? '';
  }

  private slugifyApartmentSource(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
  }

  private buildBaseApartmentSlug(params: {
    buildingName?: string | null;
    apartmentNumber?: string | null;
  }): string {
    const buildingNameSlug = this.slugifyApartmentSource(
      this.buildApartmentSlugSource(params),
    );

    return buildingNameSlug || 'apartment';
  }

  private async generateUniqueApartmentSlug(params: {
    buildingName?: string | null;
    apartmentNumber?: string | null;
    excludedId?: string;
  }): Promise<string> {
    const baseSlug = this.buildBaseApartmentSlug(params);
    const existingSlugs = await this.prisma.apartment.findMany({
      where: {
        slug: { startsWith: baseSlug },
        ...(params.excludedId ? { NOT: { id: params.excludedId } } : {}),
      },
      select: { slug: true },
    });

    const usedSlugs = new Set(existingSlugs.map((item) => item.slug));
    if (!usedSlugs.has(baseSlug)) {
      return baseSlug;
    }

    let suffix = 2;
    while (usedSlugs.has(`${baseSlug}-${suffix}`)) {
      suffix += 1;
    }

    return `${baseSlug}-${suffix}`;
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

  async getCooperationContractPdfByToken(token: string) {
    if (!token || !token.trim()) {
      throw new BadRequestException('PDF token is required');
    }

    const contractId = this.verifyPdfToken(token.trim());
    const contract = await this.prisma.partnerCooperationContract.findUnique({
      where: { id: contractId },
      select: {
        contractNumber: true,
        contractPdfData: true,
      },
    });

    if (!contract || !contract.contractPdfData) {
      throw new NotFoundException('Cooperation contract or PDF not found');
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

  private resolveGlobalCommissionRate(at: Date) {
    return this.prisma.cooperationCommissionPhase.findFirst({
      where: {
        isActive: true,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }],
      },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        phaseName: true,
        commissionRate: true,
      },
    });
  }

  private mapApartmentAmenities(
    apartmentAmenities:
      | Array<{
          amenity: {
            id: string;
            code: string;
            name: string;
            icon: string | null;
          };
        }>
      | undefined,
  ) {
    if (!apartmentAmenities || apartmentAmenities.length === 0) {
      return [];
    }

    return apartmentAmenities.map((item) => ({
      id: item.amenity.id,
      code: item.amenity.code,
      name: item.amenity.name,
      icon: item.amenity.icon,
    }));
  }

  private async validateAmenityIds(amenityIds: string[]) {
    if (!amenityIds.length) {
      return;
    }

    const uniqueAmenityIds = Array.from(new Set(amenityIds));
    const existingAmenities = await this.prisma.amenity.findMany({
      where: {
        id: { in: uniqueAmenityIds },
        isActive: true,
      },
      select: { id: true },
    });

    if (existingAmenities.length !== uniqueAmenityIds.length) {
      throw new BadRequestException('One or more amenity IDs are invalid');
    }
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
    const cached = this.wardAddressCache.get(wardCode);
    if (cached) {
      return cached.provinceCode ?? undefined;
    }

    try {
      const response = await axios.get<WardLookupResponse>(
        `${this.provincesBaseUrl}/api/v2/w/${wardCode}`,
        { timeout: 15000 },
      );
      return response.data.province_code;
    } catch {
      // If lookup fails, don't block the operation
      return undefined;
    }
  }

  private normalizeWardName(value: string | undefined): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private async resolveWardAddressFromWardCode(
    wardCode: number,
  ): Promise<WardAddressInfo | null> {
    if (this.wardAddressCache.has(wardCode)) {
      return this.wardAddressCache.get(wardCode) ?? null;
    }

    try {
      const response = await axios.get<WardLookupResponse>(
        `${this.provincesBaseUrl}/api/v2/w/${wardCode}`,
        { timeout: 15000 },
      );

      const data = response.data;
      const wardName = this.normalizeWardName(data.name);
      const districtName = this.normalizeWardName(data.district_name);
      const provinceName = this.normalizeWardName(data.province_name);

      const fullAddressParts = [wardName, districtName, provinceName].filter(
        (part): part is string => typeof part === 'string',
      );

      const address: WardAddressInfo = {
        wardCode,
        wardName,
        districtCode:
          typeof data.district_code === 'number' ? data.district_code : null,
        districtName,
        provinceCode:
          typeof data.province_code === 'number' ? data.province_code : null,
        provinceName,
        fullAddress:
          fullAddressParts.length > 0 ? fullAddressParts.join(', ') : null,
      };

      this.wardAddressCache.set(wardCode, address);
      return address;
    } catch {
      this.wardAddressCache.set(wardCode, null);
      return null;
    }
  }

  private async enrichApartmentsWithWardAddress<
    T extends {
      wardCode?: number | null;
      provinceCode?: number | null;
      images?: unknown;
      videoTourUrl?: string | null;
    },
  >(
    apartments: T[],
  ): Promise<
    Array<
      T & {
        wardName: string | null;
        districtCode: number | null;
        districtName: string | null;
        provinceName: string | null;
        fullAddress: string | null;
      }
    >
  > {
    if (!apartments.length) {
      return apartments.map((apartment) => ({
        ...this.normalizeApartmentMediaFields(apartment),
        wardName: null,
        districtCode: null,
        districtName: null,
        provinceName: null,
        fullAddress: null,
      }));
    }

    const uniqueWardCodes = Array.from(
      new Set(
        apartments
          .map((apartment) => apartment.wardCode)
          .filter((code): code is number => typeof code === 'number'),
      ),
    );

    if (uniqueWardCodes.length === 0) {
      return apartments.map((apartment) => ({
        ...this.normalizeApartmentMediaFields(apartment),
        wardName: null,
        districtCode: null,
        districtName: null,
        provinceName: null,
        fullAddress: null,
      }));
    }

    const resolvedEntries = await Promise.all(
      uniqueWardCodes.map(async (wardCode) => {
        return [
          wardCode,
          await this.resolveWardAddressFromWardCode(wardCode),
        ] as const;
      }),
    );

    const wardAddressMap = new Map<
      number,
      Awaited<ReturnType<typeof this.resolveWardAddressFromWardCode>>
    >(resolvedEntries);

    return apartments.map((apartment) => {
      const wardAddress =
        typeof apartment.wardCode === 'number'
          ? wardAddressMap.get(apartment.wardCode)
          : null;

      return {
        ...this.normalizeApartmentMediaFields(apartment),
        wardName: wardAddress?.wardName ?? null,
        districtCode: wardAddress?.districtCode ?? null,
        districtName: wardAddress?.districtName ?? null,
        provinceName: wardAddress?.provinceName ?? null,
        fullAddress: wardAddress?.fullAddress ?? null,
      };
    });
  }

  /**
   * Search apartments with filters and pagination
   * By default returns all statuses unless status filter is provided
   */
  async search(searchDto: SearchApartmentDto) {
    const {
      provinceCode,
      wardCode,
      ownerId,
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
      ...(ownerId && { ownerId }),
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

    const apartmentSelect = Prisma.validator<Prisma.ApartmentSelect>()({
      id: true,
      slug: true,
      buildingName: true,
      apartmentNumber: true,
      floorNumber: true,
      totalArea: true,
      maxOccupants: true,
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
      owner: {
        select: {
          id: true,
          companyName: true,
          fullName: true,
          email: true,
          phone: true,
          profileImageUrl: true,
        },
      },
      wardCode: true,
      provinceCode: true,
      streetAddress: true,
      apartmentAmenities: {
        select: {
          amenity: {
            select: {
              id: true,
              code: true,
              name: true,
              icon: true,
            },
          },
        },
      },
    });

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

    const items = apartments.map((apartment) => ({
      ...apartment,
      amenities: this.mapApartmentAmenities(apartment.apartmentAmenities),
      rating: ratingMap.get(apartment.id) ?? null,
    }));

    const enrichedItems = await this.enrichApartmentsWithWardAddress(items);

    return {
      items: enrichedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get apartment by ID with full details
   */
  async findOne(id: string, currentUser?: JwtPayload) {
    const apartmentDetailQuery = {
      include: {
        owner: {
          select: {
            id: true,
            companyName: true,
            fullName: true,
            email: true,
            phone: true,
            profileImageUrl: true,
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
        apartmentAmenities: {
          select: {
            amenity: {
              select: {
                id: true,
                code: true,
                name: true,
                icon: true,
              },
            },
          },
        },
      },
    } satisfies Omit<Prisma.ApartmentFindUniqueArgs, 'where'>;

    const apartment = this.isUuid(id)
      ? await this.prisma.apartment.findUnique({
          where: { id },
          ...apartmentDetailQuery,
        })
      : await this.prisma.apartment.findUnique({
          where: { slug: id },
          ...apartmentDetailQuery,
        });

    if (!apartment) {
      throw new NotFoundException('Apartment not found');
    }

    const [ratingAggregate, cooperationContract] = await Promise.all([
      this.prisma.apartmentRating.aggregate({
        where: { apartmentId: apartment.id },
        _avg: { rating: true },
      }),
      this.prisma.partnerCooperationContract.findFirst({
        where: { apartmentId: apartment.id },
        orderBy: { createdAt: 'desc' },
        select: {
          startDate: true,
          endDate: true,
        },
      }),
    ]);

    let canRateApartment = false;
    let hasRatedApartment = false;
    let ratingEligibilityReason:
      | 'not_authenticated'
      | 'not_user_role'
      | 'no_active_contract'
      | 'already_rated'
      | null = null;

    if (!currentUser) {
      ratingEligibilityReason = 'not_authenticated';
    } else if (currentUser.actorType !== 'user') {
      ratingEligibilityReason = 'not_user_role';
    }

    if (currentUser?.actorType === 'user') {
      const [activeMembership, existingRating] = await Promise.all([
        this.prisma.userContractMember.findFirst({
          where: {
            userId: currentUser.sub,
            status: MemberStatus.active,
            rentalContract: {
              status: ContractStatus.active,
              apartmentId: apartment.id,
            },
          },
          select: { id: true },
        }),
        this.prisma.apartmentRating.findUnique({
          where: {
            userId_apartmentId: {
              userId: currentUser.sub,
              apartmentId: apartment.id,
            },
          },
          select: { id: true },
        }),
      ]);

      hasRatedApartment = !!existingRating;
      canRateApartment = !!activeMembership && !hasRatedApartment;

      if (hasRatedApartment) {
        ratingEligibilityReason = 'already_rated';
      } else if (!activeMembership) {
        ratingEligibilityReason = 'no_active_contract';
      } else {
        ratingEligibilityReason = null;
      }
    }

    const [enrichedApartment] = await this.enrichApartmentsWithWardAddress([
      apartment,
    ]);
    const {
      rooms: _rooms,
      apartmentAmenities: _apartmentAmenities,
      ...apartmentWithoutRooms
    } = apartment as typeof apartment & { rooms?: unknown };
    void _rooms;
    void _apartmentAmenities;

    return {
      ...apartmentWithoutRooms,
      amenities: this.mapApartmentAmenities(apartment.apartmentAmenities),
      streetAddress: apartment.streetAddress,
      rating: this.toRoundedRating(ratingAggregate._avg.rating),
      cooperationContractStartDate: cooperationContract?.startDate ?? null,
      cooperationContractEndDate: cooperationContract?.endDate ?? null,
      canRateApartment,
      hasRatedApartment,
      ratingEligibilityReason,
      wardName: enrichedApartment.wardName,
      districtCode: enrichedApartment.districtCode,
      districtName: enrichedApartment.districtName,
      provinceName: enrichedApartment.provinceName,
      fullAddress: enrichedApartment.fullAddress,
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
    if (createDto.amenityIds?.length) {
      await this.validateAmenityIds(createDto.amenityIds);
    }

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
    const slug = await this.generateUniqueApartmentSlug({
      buildingName: createDto.buildingName,
      apartmentNumber: createDto.apartmentNumber,
    });
    const ownerId =
      currentUser.actorType === 'user' ? currentUser.sub : createDto.ownerId;

    const data: Prisma.ApartmentCreateInput = {
      buildingName: createDto.buildingName,
      apartmentNumber: createDto.apartmentNumber,
      slug,
      floorNumber: createDto.floorNumber,
      wardCode: createDto.wardCode,
      provinceCode,
      streetAddress: createDto.streetAddress,
      latitude: createDto.latitude,
      longitude: createDto.longitude,
      totalArea: createDto.totalArea,
      usableArea: createDto.usableArea,
      maxOccupants: createDto.maxOccupants,
      numberOfBedrooms: createDto.numberOfBedrooms,
      numberOfBathrooms: createDto.numberOfBathrooms,
      furnishingStatus: createDto.furnishingStatus,
      baseRentPrice: createDto.baseRentPrice,
      depositAmount: createDto.depositAmount,
      description: createDto.description,
      images,
      videoTourUrl,
      yearBuilt: createDto.yearBuilt,
      status: ApartmentStatus.available,
      ...(createDto.amenityIds?.length
        ? {
            apartmentAmenities: {
              create: createDto.amenityIds.map((amenityId) => ({
                amenity: { connect: { id: amenityId } },
              })),
            },
          }
        : {}),
    };

    // If user creates, link to their account
    if (ownerId) {
      data.owner = { connect: { id: ownerId } };
    }

    const apartment = await this.prisma.apartment.create({
      data,
      select: {
        id: true,
        slug: true,
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

    await this.ensureOwnerPartnerDefaultCommission(ownerId);

    return this.normalizeApartmentMediaFields(apartment);
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
    if (createDto.amenityIds?.length) {
      await this.validateAmenityIds(createDto.amenityIds);
    }

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
    let provinceCode: number | undefined;
    if (createDto.wardCode) {
      provinceCode = await this.resolveProvinceCodeFromWard(createDto.wardCode);
    }
    const slug = await this.generateUniqueApartmentSlug({
      buildingName: createDto.buildingName,
      apartmentNumber: createDto.apartmentNumber,
    });

    const data: Prisma.ApartmentCreateInput = {
      buildingName: createDto.buildingName,
      apartmentNumber: createDto.apartmentNumber,
      slug,
      floorNumber: createDto.floorNumber,
      wardCode: createDto.wardCode,
      provinceCode,
      streetAddress: createDto.streetAddress,
      latitude: createDto.latitude,
      longitude: createDto.longitude,
      totalArea: createDto.totalArea,
      usableArea: createDto.usableArea,
      maxOccupants: createDto.maxOccupants,
      numberOfBedrooms: createDto.numberOfBedrooms,
      numberOfBathrooms: createDto.numberOfBathrooms,
      furnishingStatus: createDto.furnishingStatus,
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
      ...(createDto.amenityIds?.length
        ? {
            apartmentAmenities: {
              create: createDto.amenityIds.map((amenityId) => ({
                amenity: { connect: { id: amenityId } },
              })),
            },
          }
        : {}),
    };

    const apartment = await this.prisma.apartment.create({
      data,
      select: {
        id: true,
        slug: true,
        apartmentNumber: true,
        wardCode: true,
        provinceCode: true,
        streetAddress: true,
        status: true,
        ownerId: true,
        images: true,
        videoTourUrl: true,
        createdAt: true,
      },
    });

    await this.ensureOwnerPartnerDefaultCommission(currentUser.sub);

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
        title: 'Partner gửi căn hộ hợp tác mới',
        message: `Partner vừa gửi căn hộ ${apartment.apartmentNumber} cho quy trình hợp tác.`,
        actionUrl: `/apartments/${apartment.id}`,
        actionLabel: 'Xem căn hộ',
        relatedEntityType: 'Apartment',
        relatedEntityId: apartment.id,
      });
    }

    return this.normalizeApartmentMediaFields(apartment);
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
        slug: true,
        buildingName: true,
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
      const blockedUpdateKeys = new Set([
        'ownerId',
        'images',
        'videoTourUrl',
        'amenityIds',
      ]);
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

      if (
        updateDto.buildingName !== undefined ||
        updateDto.apartmentNumber !== undefined
      ) {
        apartmentUpdateData.slug = await this.generateUniqueApartmentSlug({
          buildingName: updateDto.buildingName ?? apartment.buildingName,
          apartmentNumber:
            updateDto.apartmentNumber ?? apartment.apartmentNumber,
          excludedId: id,
        });
      }
    }

    if (updateDto?.amenityIds) {
      await this.validateAmenityIds(updateDto.amenityIds);
    }

    return this.prisma.$transaction(async (tx) => {
      if (updateDto?.amenityIds) {
        await tx.apartmentAmenity.deleteMany({ where: { apartmentId: id } });
      }

      return tx.apartment.update({
        where: { id },
        data: {
          ...apartmentUpdateData,
          ...(updateDto?.amenityIds
            ? {
                apartmentAmenities: {
                  create: updateDto.amenityIds.map((amenityId) => ({
                    amenity: { connect: { id: amenityId } },
                  })),
                },
              }
            : {}),
        },
        select: {
          id: true,
          slug: true,
          apartmentNumber: true,
          status: true,
          images: true,
          videoTourUrl: true,
          updatedAt: true,
        },
      });
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
        title: 'Căn hộ hợp tác bị từ chối',
        message: `Căn hộ ${apartment.apartmentNumber} đã bị operator từ chối. Lý do: ${reason}`,
        actionUrl: `/apartments/${id}`,
        actionLabel: 'Xem chi tiết',
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
      select: {
        id: true,
        ownerId: true,
        images: true,
        buildingName: true,
        apartmentNumber: true,
        status: true,
      },
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

    // Do not allow bypassing cooperation signing flow via generic apartment update.
    if (
      updateDto.status === ApartmentStatus.available &&
      apartment.status === this.cooperationPendingStatus
    ) {
      const pendingCooperationContract =
        await this.prisma.partnerCooperationContract.findFirst({
          where: {
            apartmentId: id,
            status: PartnerCooperationContractStatus.pending,
          },
          select: { id: true },
        });

      if (pendingCooperationContract) {
        throw new BadRequestException(
          'Cannot set apartment to available while cooperation contract is pending partner signature',
        );
      }
    }

    // Auto-resolve province code if wardCode is being updated
    const data: any = { ...updateDto };
    delete data.amenityIds;
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

    if (updateDto.amenityIds) {
      await this.validateAmenityIds(updateDto.amenityIds);
    }

    if (
      updateDto.buildingName !== undefined ||
      updateDto.apartmentNumber !== undefined
    ) {
      data.slug = await this.generateUniqueApartmentSlug({
        buildingName: updateDto.buildingName ?? apartment.buildingName,
        apartmentNumber: updateDto.apartmentNumber ?? apartment.apartmentNumber,
        excludedId: id,
      });
    }

    const updatedApartment = await this.prisma.$transaction(async (tx) => {
      if (updateDto.amenityIds) {
        await tx.apartmentAmenity.deleteMany({ where: { apartmentId: id } });
      }

      return tx.apartment.update({
        where: { id },
        data: {
          ...data,
          ...(updateDto.amenityIds
            ? {
                apartmentAmenities: {
                  create: updateDto.amenityIds.map((amenityId) => ({
                    amenity: { connect: { id: amenityId } },
                  })),
                },
              }
            : {}),
        },
        select: {
          id: true,
          slug: true,
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
    });

    return this.normalizeApartmentMediaFields(updatedApartment);
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
        owner: {
          select: {
            id: true,
            companyName: true,
            fullName: true,
            email: true,
            phone: true,
            profileImageUrl: true,
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
        apartmentAmenities: {
          select: {
            amenity: {
              select: {
                id: true,
                code: true,
                name: true,
                icon: true,
              },
            },
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

    const apartmentWithRating = apartments.map((apartment) => {
      const cooperationContracts = (apartment.cooperationContracts ?? []).map(
        (contract) => {
          const contractToken = contract.contractPdfData
            ? this.generatePdfToken(contract.id)
            : null;

          return {
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
          };
        },
      );
      const latestCooperationContract = cooperationContracts[0] ?? null;
      const {
        rooms: _rooms,
        apartmentAmenities: _apartmentAmenities,
        cooperationContracts: _cooperationContracts,
        ...apartmentWithoutRooms
      } = apartment as typeof apartment & { rooms?: unknown };
      void _rooms;
      void _apartmentAmenities;
      void _cooperationContracts;

      return {
        ...apartmentWithoutRooms,
        amenities: this.mapApartmentAmenities(apartment.apartmentAmenities),
        cooperationContracts,
        cooperationContract: latestCooperationContract,
        rating: ratingMap.get(apartment.id) ?? null,
      };
    });

    return this.enrichApartmentsWithWardAddress(apartmentWithRating);
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

    const activeCommissionPhase =
      await this.resolveGlobalCommissionRate(startDate);
    const commissionRate =
      activeCommissionPhase?.commissionRate != null
        ? Number(activeCommissionPhase.commissionRate)
        : apartment.owner.commissionRate != null
          ? Number(apartment.owner.commissionRate)
          : this.defaultPartnerCommissionRate;

    const pdfData: PartnerCooperationPdfData = {
      contractNumber,
      partyAName: 'Công ty TNHH IntelliServOps',
      partyATaxCode: process.env.INTELLISERVOPS_TAX_CODE || '0312345678',
      partyAAddress:
        process.env.INTELLISERVOPS_ADDRESS || 'TP. Hồ Chí Minh, Việt Nam',
      partyAPhone: process.env.INTELLISERVOPS_PHONE || '1900 0000',
      partyARepresentative:
        process.env.INTELLISERVOPS_REPRESENTATIVE || 'Đại diện theo ủy quyền',
      partyASignature: null,
      partnerName: apartment.owner.fullName,
      partnerCompanyName: apartment.owner.companyName ?? undefined,
      partnerPhone: apartment.owner.phone ?? undefined,
      partnerEmail: apartment.owner.email,
      partnerSignature: null,
      apartmentAddress:
        apartment.streetAddress ?? apartment.buildingName ?? undefined,
      apartmentNumber: apartment.apartmentNumber,
      cooperationStartDate: this.formatDateDdMmYyyy(startDate),
      cooperationEndDate: this.formatDateDdMmYyyy(endDate),
      monthlyRevenueCommissionRate: commissionRate.toFixed(2),
      notes: activeCommissionPhase
        ? `Mức hoa hồng áp dụng theo giai đoạn: ${activeCommissionPhase.phaseName}`
        : 'Hợp đồng hợp tác khai thác căn hộ giữa partner và IntelliServOps',
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
          notes: activeCommissionPhase
            ? `Generated when operator approved partner cooperation apartment | Applied phase: ${activeCommissionPhase.phaseName}`
            : 'Generated when operator approved partner cooperation apartment',
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
      title: 'Căn hộ hợp tác đã được duyệt',
      message: `Căn hộ ${result.approvedApartment.apartmentNumber} đã được operator duyệt và tạo hợp đồng hợp tác.`,
      actionUrl: `/apartments/${id}/cooperation-contract`,
      actionLabel: 'Xem hợp đồng',
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
        title: 'Partner đã ký hợp đồng hợp tác',
        message: `Partner đã ký và tải lên hợp đồng cho căn hộ ${apartment.apartmentNumber}.`,
        actionUrl: `/apartments/${apartmentId}/cooperation-contract`,
        actionLabel: 'Xem hợp đồng',
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
        title: 'Partner đã hủy hợp đồng hợp tác',
        message: `Partner đã hủy hợp đồng hợp tác của căn hộ ${apartment.apartmentNumber}.`,
        actionUrl: `/apartments/${apartmentId}/cooperation-contract`,
        actionLabel: 'Xem hợp đồng',
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
