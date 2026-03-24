import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateApartmentDto,
  UpdateApartmentDto,
  SearchApartmentDto,
  RateApartmentDto,
} from './dto';
import {
  ApartmentStatus,
  ContractStatus,
  MemberStatus,
  Prisma,
} from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';
import axios from 'axios';

@Injectable()
export class ApartmentsService {
  private readonly provincesBaseUrl = 'https://provinces.open-api.vn';

  constructor(private readonly prisma: PrismaService) {}

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

    return response.data;
  }

  async lookupNewWardFromLegacy(legacyName?: string, legacyCode?: number) {
    if (!legacyName && !legacyCode) {
      return [];
    }

    const response = await axios.get(
      `${this.provincesBaseUrl}/api/v2/w/from-legacy/`,
      {
        params: {
          ...(legacyName ? { legacy_name: legacyName } : {}),
          ...(legacyCode ? { legacy_code: legacyCode } : {}),
        },
        timeout: 15000,
      },
    );

    return response.data;
  }

  async lookupLegacyWardsFromNew(newWardCode: number) {
    const response = await axios.get(
      `${this.provincesBaseUrl}/api/v2/w/${newWardCode}/to-legacies/`,
      {
        timeout: 15000,
      },
    );

    return response.data;
  }

  private async resolveNewWardAddress(
    wardCode: number,
    cache: Map<string, any>,
  ) {
    const wardKey = `v2:w:${wardCode}`;
    let ward = cache.get(wardKey);
    if (!ward) {
      const wardResponse = await axios.get(
        `${this.provincesBaseUrl}/api/v2/w/${wardCode}`,
        {
          timeout: 15000,
        },
      );
      ward = wardResponse.data;
      cache.set(wardKey, ward);
    }

    let provinceName: string | null = null;
    if (ward?.province_code) {
      const provinceKey = `v2:p:${ward.province_code}`;
      let province = cache.get(provinceKey);
      if (!province) {
        const provinceResponse = await axios.get(
          `${this.provincesBaseUrl}/api/v2/p/${ward.province_code}`,
          {
            timeout: 15000,
          },
        );
        province = provinceResponse.data;
        cache.set(provinceKey, province);
      }
      provinceName = province?.name ?? null;
    }

    const wardName = ward?.name ?? null;
    const fullAddress = [wardName, provinceName].filter(Boolean).join(', ');

    return {
      wardCode,
      wardName,
      districtCode: null,
      districtName: null,
      provinceCode: ward?.province_code ?? null,
      provinceName,
      fullAddress,
    };
  }

  private async resolveOldWardAddress(
    wardCode: number,
    cache: Map<string, any>,
  ) {
    const wardKey = `v1:w:${wardCode}`;
    let ward = cache.get(wardKey);
    if (!ward) {
      const wardResponse = await axios.get(
        `${this.provincesBaseUrl}/api/v1/w/${wardCode}`,
        {
          timeout: 15000,
        },
      );
      ward = wardResponse.data;
      cache.set(wardKey, ward);
    }

    let district: any = null;
    if (ward?.district_code) {
      const districtKey = `v1:d:${ward.district_code}`;
      district = cache.get(districtKey);
      if (!district) {
        const districtResponse = await axios.get(
          `${this.provincesBaseUrl}/api/v1/d/${ward.district_code}`,
          {
            timeout: 15000,
          },
        );
        district = districtResponse.data;
        cache.set(districtKey, district);
      }
    }

    let province: any = null;
    if (district?.province_code) {
      const provinceKey = `v1:p:${district.province_code}`;
      province = cache.get(provinceKey);
      if (!province) {
        const provinceResponse = await axios.get(
          `${this.provincesBaseUrl}/api/v1/p/${district.province_code}`,
          {
            timeout: 15000,
          },
        );
        province = provinceResponse.data;
        cache.set(provinceKey, province);
      }
    }

    const wardName = ward?.name ?? null;
    const districtName = district?.name ?? null;
    const provinceName = province?.name ?? null;
    const fullAddress = [wardName, districtName, provinceName]
      .filter(Boolean)
      .join(', ');

    return {
      wardCode,
      wardName,
      districtCode: ward?.district_code ?? null,
      districtName,
      provinceCode: district?.province_code ?? null,
      provinceName,
      fullAddress,
    };
  }

  async getWardAddressByCode(
    wardCode: number,
    addressType: 'new' | 'old' = 'new',
    cache?: Map<string, any>,
  ) {
    const lookupCache = cache ?? new Map<string, any>();
    return addressType === 'new'
      ? this.resolveNewWardAddress(wardCode, lookupCache)
      : this.resolveOldWardAddress(wardCode, lookupCache);
  }

  async getApartmentAddressByWardCodes(
    newWardCode?: number | null,
    oldWardCode?: number | null,
    addressType: 'new' | 'old' | 'both' = 'both',
    cache?: Map<string, any>,
  ) {
    const lookupCache = cache ?? new Map<string, any>();
    const includeNew = addressType === 'new' || addressType === 'both';
    const includeOld = addressType === 'old' || addressType === 'both';

    let resolvedNewWardCode = newWardCode ?? null;
    let resolvedOldWardCode = oldWardCode ?? null;

    // Fallback: if only old ward code exists, map legacy(old) -> new ward code
    if (
      includeNew &&
      resolvedNewWardCode == null &&
      resolvedOldWardCode != null
    ) {
      const mapKey = `legacy_to_new:${resolvedOldWardCode}`;
      let mapped = lookupCache.get(mapKey);
      if (!mapped) {
        mapped = await this.lookupNewWardFromLegacy(
          undefined,
          resolvedOldWardCode,
        );
        lookupCache.set(mapKey, mapped);
      }

      const first = Array.isArray(mapped) ? mapped[0] : null;
      const rawCode =
        first?.ward?.code ?? first?.code ?? first?.ward_code ?? null;
      const codeFromMapping =
        typeof rawCode === 'number' ? rawCode : Number(rawCode);
      if (Number.isFinite(codeFromMapping)) {
        resolvedNewWardCode = codeFromMapping;
      }
    }

    // Fallback: if only new ward code exists, map new ward code -> legacy(old)
    if (
      includeOld &&
      resolvedOldWardCode == null &&
      resolvedNewWardCode != null
    ) {
      const mapKey = `new_to_legacy:${resolvedNewWardCode}`;
      let mapped = lookupCache.get(mapKey);
      if (!mapped) {
        mapped = await this.lookupLegacyWardsFromNew(resolvedNewWardCode);
        lookupCache.set(mapKey, mapped);
      }

      const first = Array.isArray(mapped) ? mapped[0] : null;
      const candidateCode =
        Array.isArray(mapped) && mapped.length > 1
          ? (mapped.find(
              (item: any) => Number(item?.code) !== resolvedNewWardCode,
            )?.code ?? first?.code)
          : first?.code;
      const rawCode =
        candidateCode ?? first?.legacy_code ?? first?.ward_code ?? null;
      const codeFromMapping =
        typeof rawCode === 'number' ? rawCode : Number(rawCode);
      if (Number.isFinite(codeFromMapping)) {
        resolvedOldWardCode = codeFromMapping;
      }
    }

    const newAddress =
      includeNew && resolvedNewWardCode != null
        ? await this.resolveNewWardAddress(resolvedNewWardCode, lookupCache)
        : null;

    const oldAddress =
      includeOld && resolvedOldWardCode != null
        ? await this.resolveOldWardAddress(resolvedOldWardCode, lookupCache)
        : null;

    const displayAddress =
      addressType === 'new'
        ? (newAddress?.fullAddress ?? null)
        : addressType === 'old'
          ? (oldAddress?.fullAddress ?? null)
          : (newAddress?.fullAddress ?? oldAddress?.fullAddress ?? null);

    return {
      newAddress,
      oldAddress,
      displayAddress,
    };
  }

  /**
   * Search apartments with filters and pagination
   * By default returns all statuses unless status filter is provided
   */
  async search(searchDto: SearchApartmentDto) {
    const {
      wardCode,
      keyword,
      addressType = 'both',
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

    // Build ward-code filter based on addressType
    const addressFilters: Prisma.ApartmentWhereInput[] = [];

    if (wardCode !== undefined) {
      if (addressType === 'new' || addressType === 'both') {
        addressFilters.push({
          newWardCode: wardCode,
        });
      }
      if (addressType === 'old' || addressType === 'both') {
        addressFilters.push({
          oldWardCode: wardCode,
        });
      }
    }

    // Combine all AND conditions
    const andConditions: Prisma.ApartmentWhereInput[] = [];

    if (addressFilters.length === 1) {
      andConditions.push(addressFilters[0]);
    } else if (addressFilters.length > 1) {
      andConditions.push({ OR: addressFilters });
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

    // Build dynamic select based on addressType
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
      createdAt: true,
    };

    // Include only relevant address fields based on addressType
    if (addressType === 'new' || addressType === 'both') {
      apartmentSelect.newWardCode = true;
    }
    if (addressType === 'old' || addressType === 'both') {
      apartmentSelect.oldWardCode = true;
    }

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

    const lookupCache = new Map<string, any>();
    const items = await Promise.all(
      apartments.map(async (apartment: any) => {
        const addressInfo = await this.getApartmentAddressByWardCodes(
          apartment.newWardCode,
          apartment.oldWardCode,
          'both',
          lookupCache,
        );

        const displayAddress =
          addressType === 'new'
            ? (addressInfo.newAddress?.fullAddress ?? null)
            : addressType === 'old'
              ? (addressInfo.oldAddress?.fullAddress ?? null)
              : (addressInfo.newAddress?.fullAddress ??
                addressInfo.oldAddress?.fullAddress ??
                null);

        return {
          ...apartment,
          rating: ratingMap.get(apartment.id) ?? null,
          newAddress: addressInfo.newAddress,
          oldAddress: addressInfo.oldAddress,
          address: displayAddress,
        };
      }),
    );

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
  async findOne(id: string, addressType: 'new' | 'old' | 'both' = 'both') {
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

    const addressInfo = await this.getApartmentAddressByWardCodes(
      apartment.newWardCode,
      apartment.oldWardCode,
      'both',
      new Map<string, any>(),
    );

    const address =
      addressType === 'new'
        ? (addressInfo.newAddress?.fullAddress ?? null)
        : addressType === 'old'
          ? (addressInfo.oldAddress?.fullAddress ?? null)
          : (addressInfo.newAddress?.fullAddress ??
            addressInfo.oldAddress?.fullAddress ??
            null);

    return {
      ...apartment,
      rating: this.toRoundedRating(ratingAggregate._avg.rating),
      newAddress: addressInfo.newAddress,
      oldAddress: addressInfo.oldAddress,
      address,
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
  async create(createDto: CreateApartmentDto, currentUser: JwtPayload) {
    const data: Prisma.ApartmentCreateInput = {
      buildingName: createDto.buildingName,
      apartmentNumber: createDto.apartmentNumber,
      floorNumber: createDto.floorNumber,
      newWardCode: createDto.newWardCode,
      oldWardCode: createDto.oldWardCode,
      latitude: createDto.latitude,
      longitude: createDto.longitude,
      totalArea: createDto.totalArea,
      usableArea: createDto.usableArea,
      numberOfBedrooms: createDto.numberOfBedrooms,
      numberOfBathrooms: createDto.numberOfBathrooms,
      furnishingStatus: createDto.furnishingStatus,
      amenities: createDto.amenities as any,
      baseRentPrice: createDto.baseRentPrice,
      depositAmount: createDto.depositAmount,
      description: createDto.description,
      images: createDto.images as any,
      videoTourUrl: createDto.videoTourUrl,
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
        newWardCode: true,
        oldWardCode: true,
        baseRentPrice: true,
        status: true,
        createdAt: true,
      },
    });
  }

  /**
   * Update apartment
   * Only owner (user) or Admin/Operator can update
   */
  async update(
    id: string,
    updateDto: UpdateApartmentDto,
    currentUser: JwtPayload,
  ) {
    const apartment = await this.prisma.apartment.findUnique({
      where: { id },
      select: { id: true, ownerId: true },
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

    return this.prisma.apartment.update({
      where: { id },
      data: updateDto as any,
      select: {
        id: true,
        apartmentNumber: true,
        newWardCode: true,
        oldWardCode: true,
        baseRentPrice: true,
        status: true,
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

    return apartments.map((apartment) => ({
      ...apartment,
      rating: ratingMap.get(apartment.id) ?? null,
    }));
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
}
