import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContractDto, UpdateContractDto } from './dto';
import { ContractStatus, ApartmentStatus, MemberStatus, Prisma } from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all contracts with filters
   * Admin/Operator see all, Staff see assigned, User see own
   */
  async findAll(currentUser: JwtPayload, status?: ContractStatus) {
    const where: Prisma.RentalContractWhereInput = {
      ...(status && { status }),
    };

    // Users can only see their own contracts
    if (currentUser.actorType === 'user') {
      where.members = {
        some: { userId: currentUser.sub },
      };
    }

    return this.prisma.rentalContract.findMany({
      where,
      select: {
        id: true,
        contractNumber: true,
        startDate: true,
        endDate: true,
        monthlyRent: true,
        status: true,
        createdAt: true,
        apartment: {
          select: {
            id: true,
            apartmentNumber: true,
            address: true,
            city: true,
          },
        },
        members: {
          select: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
            memberType: true,
            isPrimaryContact: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get contract by ID with full details
   */
  async findOne(id: string, currentUser: JwtPayload) {
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id },
      include: {
        apartment: {
          select: {
            id: true,
            apartmentNumber: true,
            address: true,
            city: true,
            district: true,
            numberOfBedrooms: true,
            numberOfBathrooms: true,
            totalArea: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        createdByStaff: {
          select: {
            id: true,
            fullName: true,
          },
        },
        invoices: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            status: true,
            dueDate: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    // Users can only see their own contracts
    if (currentUser.actorType === 'user') {
      const isMember = contract.members.some(m => m.user.id === currentUser.sub);
      if (!isMember) {
        throw new NotFoundException('Contract not found');
      }
    }

    return contract;
  }

  /**
   * Create new rental contract
   */
  async create(createDto: CreateContractDto, currentUser: JwtPayload) {
    // Check if apartment is available
    const apartment = await this.prisma.apartment.findUnique({
      where: { id: createDto.apartmentId },
      select: { id: true, status: true },
    });

    if (!apartment) {
      throw new NotFoundException('Apartment not found');
    }

    if (apartment.status !== ApartmentStatus.available) {
      throw new ConflictException('Apartment is not available for rent');
    }

    // Check for overlapping contracts
    const overlapping = await this.prisma.rentalContract.findFirst({
      where: {
        apartmentId: createDto.apartmentId,
        status: { in: ['active', 'pending'] },
        OR: [
          {
            startDate: { lte: new Date(createDto.endDate) },
            endDate: { gte: new Date(createDto.startDate) },
          },
        ],
      },
    });

    if (overlapping) {
      throw new ConflictException('Apartment has an overlapping contract');
    }

    // Validate at least one primary member
    const hasPrimary = createDto.members.some(m => m.memberType === 'primary');
    if (!hasPrimary) {
      throw new BadRequestException('At least one primary tenant is required');
    }

    // Generate contract number
    const contractNumber = await this.generateContractNumber();

    // Create contract with members in transaction
    return this.prisma.$transaction(async (tx) => {
      const contract = await tx.rentalContract.create({
        data: {
          contractNumber,
          apartment: { connect: { id: createDto.apartmentId } },
          startDate: new Date(createDto.startDate),
          endDate: new Date(createDto.endDate),
          monthlyRent: createDto.monthlyRent,
          depositAmount: createDto.depositAmount,
          paymentDueDay: createDto.paymentDueDay,
          paymentMethod: createDto.paymentMethod,
          utilitiesIncluded: createDto.utilitiesIncluded as any,
          utilitiesCharges: createDto.utilitiesCharges as any,
          contractTerms: createDto.contractTerms,
          specialConditions: createDto.specialConditions,
          status: ContractStatus.draft,
          createdByStaff: currentUser.actorType === 'staff'
            ? { connect: { id: currentUser.sub } }
            : undefined,
        },
        select: {
          id: true,
          contractNumber: true,
        },
      });

      // Create contract members
      await tx.userContractMember.createMany({
        data: createDto.members.map(m => ({
          userId: m.userId,
          rentalContractId: contract.id,
          memberType: m.memberType,
          isPrimaryContact: m.isPrimaryContact ?? (m.memberType === 'primary'),
          sharePercentage: m.sharePercentage,
          status: MemberStatus.active,
        })),
      });

      return contract;
    });
  }

  /**
   * Update contract
   */
  async update(id: string, updateDto: UpdateContractDto) {
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    // Prevent editing active/signed contracts (except status changes)
    if (
      contract.status === ContractStatus.active &&
      updateDto.status !== ContractStatus.terminated
    ) {
      throw new ConflictException('Cannot modify active contract');
    }

    const updateData: any = { ...updateDto };

    if (updateDto.startDate) {
      updateData.startDate = new Date(updateDto.startDate);
    }
    if (updateDto.endDate) {
      updateData.endDate = new Date(updateDto.endDate);
    }
    if (updateDto.signedDate) {
      updateData.signedDate = new Date(updateDto.signedDate);
    }
    if (updateDto.terminationDate) {
      updateData.terminationDate = new Date(updateDto.terminationDate);
    }

    return this.prisma.rentalContract.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        contractNumber: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Activate contract (sign)
   */
  async activate(id: string) {
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id },
      include: { apartment: true },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.status !== ContractStatus.pending) {
      throw new ConflictException('Contract must be pending to activate');
    }

    // Update contract and apartment status in transaction
    return this.prisma.$transaction([
      this.prisma.rentalContract.update({
        where: { id },
        data: {
          status: ContractStatus.active,
          signedDate: new Date(),
        },
      }),
      this.prisma.apartment.update({
        where: { id: contract.apartmentId },
        data: { status: ApartmentStatus.occupied },
      }),
    ]);
  }

  /**
   * Terminate contract
   */
  async terminate(id: string, reason: string, terminationFee?: number) {
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id },
      include: { apartment: true },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.status !== ContractStatus.active) {
      throw new ConflictException('Only active contracts can be terminated');
    }

    return this.prisma.$transaction([
      this.prisma.rentalContract.update({
        where: { id },
        data: {
          status: ContractStatus.terminated,
          terminationDate: new Date(),
          terminationReason: reason,
          earlyTerminationFee: terminationFee,
        },
      }),
      this.prisma.apartment.update({
        where: { id: contract.apartmentId },
        data: { status: ApartmentStatus.available },
      }),
      this.prisma.userContractMember.updateMany({
        where: { rentalContractId: id },
        data: { status: MemberStatus.moved_out, moveOutDate: new Date() },
      }),
    ]);
  }

  private async generateContractNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.rentalContract.count({
      where: {
        contractNumber: { startsWith: `CTR-${year}` },
      },
    });
    return `CTR-${year}-${String(count + 1).padStart(5, '0')}`;
  }
}
