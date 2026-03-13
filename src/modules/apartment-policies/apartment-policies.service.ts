import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateApartmentPolicyDto, UpdateApartmentPolicyDto } from './dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ApartmentPoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all apartment-policy assignments, optionally filtered
   */
  async findAll(filters?: {
    apartmentId?: string;
    policyId?: string;
    isRequired?: boolean;
  }) {
    const where: Prisma.ApartmentPolicyWhereInput = {};
    if (filters?.apartmentId) where.apartmentId = filters.apartmentId;
    if (filters?.policyId) where.policyId = filters.policyId;
    if (filters?.isRequired !== undefined)
      where.isRequired = filters.isRequired;

    return this.prisma.apartmentPolicy.findMany({
      where,
      select: {
        id: true,
        apartmentId: true,
        policyId: true,
        isRequired: true,
        effectiveDate: true,
        expiryDate: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get apartment-policy assignment by ID with full details
   */
  async findOne(id: string) {
    const apartmentPolicy = await this.prisma.apartmentPolicy.findUnique({
      where: { id },
      include: {
        apartment: {
          select: {
            id: true,
            apartmentNumber: true,
            buildingName: true,
            newWardCode: true,
            oldWardCode: true,
          },
        },
        policy: {
          select: {
            id: true,
            policyType: true,
            title: true,
            version: true,
            isActive: true,
          },
        },
      },
    });

    if (!apartmentPolicy) {
      throw new NotFoundException('Apartment-policy assignment not found');
    }

    return apartmentPolicy;
  }

  /**
   * Get policies assigned to a specific apartment
   */
  async findByApartment(apartmentId: string, isRequired?: boolean) {
    const where: Prisma.ApartmentPolicyWhereInput = { apartmentId };
    if (isRequired !== undefined) where.isRequired = isRequired;

    return this.prisma.apartmentPolicy.findMany({
      where,
      include: {
        policy: {
          select: {
            id: true,
            policyType: true,
            title: true,
            content: true,
            version: true,
            language: true,
            isActive: true,
            requiresAcceptance: true,
          },
        },
      },
      orderBy: { effectiveDate: 'desc' },
    });
  }

  /**
   * Get apartments that have a specific policy assigned
   */
  async findByPolicy(policyId: string) {
    return this.prisma.apartmentPolicy.findMany({
      where: { policyId },
      include: {
        apartment: {
          select: {
            id: true,
            apartmentNumber: true,
            buildingName: true,
            newWardCode: true,
            oldWardCode: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Assign a policy to an apartment
   */
  async create(createDto: CreateApartmentPolicyDto) {
    // Validate apartment exists
    const apartment = await this.prisma.apartment.findUnique({
      where: { id: createDto.apartmentId },
      select: { id: true },
    });
    if (!apartment) throw new NotFoundException('Apartment not found');

    // Validate policy exists
    const policy = await this.prisma.policy.findUnique({
      where: { id: createDto.policyId },
      select: { id: true },
    });
    if (!policy) throw new NotFoundException('Policy not found');

    // Check for existing assignment
    const existing = await this.prisma.apartmentPolicy.findUnique({
      where: {
        apartmentId_policyId: {
          apartmentId: createDto.apartmentId,
          policyId: createDto.policyId,
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        'This policy is already assigned to this apartment',
      );
    }

    return this.prisma.apartmentPolicy.create({
      data: {
        apartment: { connect: { id: createDto.apartmentId } },
        policy: { connect: { id: createDto.policyId } },
        isRequired: createDto.isRequired ?? true,
        effectiveDate: createDto.effectiveDate
          ? new Date(createDto.effectiveDate)
          : new Date(),
        expiryDate: createDto.expiryDate
          ? new Date(createDto.expiryDate)
          : undefined,
        notes: createDto.notes,
      },
      select: {
        id: true,
        apartmentId: true,
        policyId: true,
        isRequired: true,
        effectiveDate: true,
        createdAt: true,
      },
    });
  }

  /**
   * Update an apartment-policy assignment
   */
  async update(id: string, updateDto: UpdateApartmentPolicyDto) {
    const apartmentPolicy = await this.prisma.apartmentPolicy.findUnique({
      where: { id },
    });
    if (!apartmentPolicy) {
      throw new NotFoundException('Apartment-policy assignment not found');
    }

    const data: Prisma.ApartmentPolicyUpdateInput = {
      isRequired: updateDto.isRequired,
      notes: updateDto.notes,
      ...(updateDto.effectiveDate && {
        effectiveDate: new Date(updateDto.effectiveDate),
      }),
      ...(updateDto.expiryDate && {
        expiryDate: new Date(updateDto.expiryDate),
      }),
    };

    return this.prisma.apartmentPolicy.update({
      where: { id },
      data,
      select: {
        id: true,
        apartmentId: true,
        policyId: true,
        isRequired: true,
        effectiveDate: true,
        expiryDate: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Remove a policy assignment from an apartment
   */
  async remove(id: string) {
    const apartmentPolicy = await this.prisma.apartmentPolicy.findUnique({
      where: { id },
    });
    if (!apartmentPolicy) {
      throw new NotFoundException('Apartment-policy assignment not found');
    }

    await this.prisma.apartmentPolicy.delete({ where: { id } });

    return { message: 'Apartment-policy assignment removed successfully' };
  }

  /**
   * Bulk assign a policy to multiple apartments
   */
  async bulkAssign(policyId: string, apartmentIds: string[]) {
    const policy = await this.prisma.policy.findUnique({
      where: { id: policyId },
      select: { id: true },
    });
    if (!policy) throw new NotFoundException('Policy not found');

    const results = await Promise.allSettled(
      apartmentIds.map(async (apartmentId) => {
        const existing = await this.prisma.apartmentPolicy.findUnique({
          where: {
            apartmentId_policyId: { apartmentId, policyId },
          },
        });
        if (existing) return { apartmentId, status: 'already_exists' };

        const created = await this.prisma.apartmentPolicy.create({
          data: {
            apartment: { connect: { id: apartmentId } },
            policy: { connect: { id: policyId } },
          },
          select: { id: true, apartmentId: true },
        });
        return { apartmentId, status: 'created', id: created.id };
      }),
    );

    return {
      policyId,
      results: results.map((r, i) => {
        if (r.status === 'fulfilled') {
          return r.value;
        }
        return {
          apartmentId: apartmentIds[i],
          status: 'failed',
          error: r.reason instanceof Error ? r.reason.message : 'Unknown error',
        };
      }),
    };
  }
}
