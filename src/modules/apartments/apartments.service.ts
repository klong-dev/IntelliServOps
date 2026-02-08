import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateApartmentDto, UpdateApartmentDto, SearchApartmentDto } from './dto';
import { ApartmentStatus, Prisma } from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class ApartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Search apartments with filters and pagination
   * Public access for available apartments
   */
  async search(searchDto: SearchApartmentDto) {
    const {
      city,
      district,
      keyword,
      minBedrooms,
      maxBedrooms,
      minPrice,
      maxPrice,
      minArea,
      maxArea,
      furnishingStatus,
      status = ApartmentStatus.available,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = searchDto;

    const where: Prisma.ApartmentWhereInput = {
      status,
      ...(city && { city: { equals: city, mode: 'insensitive' } }),
      ...(district && { district: { equals: district, mode: 'insensitive' } }),
      ...(keyword && {
        OR: [
          { buildingName: { contains: keyword, mode: 'insensitive' } },
          { address: { contains: keyword, mode: 'insensitive' } },
          { description: { contains: keyword, mode: 'insensitive' } },
        ],
      }),
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

    const [apartments, total] = await Promise.all([
      this.prisma.apartment.findMany({
        where,
        select: {
          id: true,
          buildingName: true,
          apartmentNumber: true,
          floorNumber: true,
          address: true,
          city: true,
          district: true,
          totalArea: true,
          numberOfBedrooms: true,
          numberOfBathrooms: true,
          furnishingStatus: true,
          baseRentPrice: true,
          depositAmount: true,
          status: true,
          images: true,
          createdAt: true,
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      this.prisma.apartment.count({ where }),
    ]);

    return {
      data: apartments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get apartment by ID with full details
   */
  async findOne(id: string) {
    const apartment = await this.prisma.apartment.findUnique({
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
        partner: {
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
    });

    if (!apartment) {
      throw new NotFoundException('Apartment not found');
    }

    return apartment;
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
      address: createDto.address,
      city: createDto.city,
      district: createDto.district,
      ward: createDto.ward,
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

    // If partner creates, link to their account
    if (currentUser.actorType === 'partner') {
      data.partner = { connect: { id: currentUser.sub } };
    } else if (createDto.partnerId) {
      data.partner = { connect: { id: createDto.partnerId } };
    }

    return this.prisma.apartment.create({
      data,
      select: {
        id: true,
        apartmentNumber: true,
        address: true,
        city: true,
        district: true,
        baseRentPrice: true,
        status: true,
        createdAt: true,
      },
    });
  }

  /**
   * Update apartment
   * Only owner (partner) or Admin/Operator can update
   */
  async update(id: string, updateDto: UpdateApartmentDto, currentUser: JwtPayload) {
    const apartment = await this.prisma.apartment.findUnique({
      where: { id },
      select: { id: true, partnerId: true },
    });

    if (!apartment) {
      throw new NotFoundException('Apartment not found');
    }

    // Partners can only update their own apartments
    if (
      currentUser.actorType === 'partner' &&
      apartment.partnerId !== currentUser.sub
    ) {
      throw new ForbiddenException('You can only update your own apartments');
    }

    return this.prisma.apartment.update({
      where: { id },
      data: updateDto as any,
      select: {
        id: true,
        apartmentNumber: true,
        address: true,
        city: true,
        district: true,
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
   * Get apartments by partner (for partner dashboard)
   */
  async findByPartner(partnerId: string) {
    return this.prisma.apartment.findMany({
      where: { partnerId },
      select: {
        id: true,
        buildingName: true,
        apartmentNumber: true,
        address: true,
        city: true,
        district: true,
        numberOfBedrooms: true,
        baseRentPrice: true,
        status: true,
        createdAt: true,
        rentalContracts: {
          where: { status: 'active' },
          select: {
            id: true,
            contractNumber: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
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
}
