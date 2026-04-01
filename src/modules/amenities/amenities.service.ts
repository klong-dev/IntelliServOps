import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAmenityDto, UpdateAmenityDto } from './dto';

@Injectable()
export class AmenitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters?: { isActive?: boolean; keyword?: string }) {
    const amenities = await this.prisma.amenity.findMany({
      where: {
        ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
        ...(filters?.keyword
          ? {
              OR: [
                { name: { contains: filters.keyword, mode: 'insensitive' } },
                { code: { contains: filters.keyword, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        _count: {
          select: {
            apartmentAmenities: true,
          },
        },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });

    return amenities.map((amenity) => ({
      ...amenity,
      linkedApartments: amenity._count.apartmentAmenities,
    }));
  }

  async findOne(id: string) {
    const amenity = await this.prisma.amenity.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            apartmentAmenities: true,
          },
        },
      },
    });

    if (!amenity) {
      throw new NotFoundException('Amenity not found');
    }

    return {
      ...amenity,
      linkedApartments: amenity._count.apartmentAmenities,
    };
  }

  async create(createDto: CreateAmenityDto) {
    const code = createDto.code.trim().toLowerCase();

    const existingByCode = await this.prisma.amenity.findUnique({
      where: { code },
      select: { id: true },
    });

    if (existingByCode) {
      throw new ConflictException('Amenity code already exists');
    }

    const amenity = await this.prisma.amenity.create({
      data: {
        code,
        name: createDto.name.trim(),
        description: createDto.description?.trim(),
        icon: createDto.icon?.trim(),
        isActive: createDto.isActive ?? true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return amenity;
  }

  async update(id: string, updateDto: UpdateAmenityDto) {
    const existing = await this.prisma.amenity.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Amenity not found');
    }

    let normalizedCode: string | undefined;
    if (updateDto.code !== undefined) {
      normalizedCode = updateDto.code.trim().toLowerCase();
      if (!normalizedCode) {
        throw new BadRequestException('Amenity code cannot be empty');
      }

      const duplicatedCode = await this.prisma.amenity.findFirst({
        where: {
          code: normalizedCode,
          id: { not: id },
        },
        select: { id: true },
      });

      if (duplicatedCode) {
        throw new ConflictException('Amenity code already exists');
      }
    }

    return this.prisma.amenity.update({
      where: { id },
      data: {
        ...(normalizedCode !== undefined && { code: normalizedCode }),
        ...(updateDto.name !== undefined && { name: updateDto.name.trim() }),
        ...(updateDto.description !== undefined && {
          description: updateDto.description?.trim() || null,
        }),
        ...(updateDto.icon !== undefined && {
          icon: updateDto.icon?.trim() || null,
        }),
        ...(updateDto.isActive !== undefined && {
          isActive: updateDto.isActive,
        }),
      },
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.amenity.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Amenity not found');
    }

    return this.prisma.amenity.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
