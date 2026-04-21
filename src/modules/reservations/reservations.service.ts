import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReservationDto } from './dto';
import { ContractsService } from '../contracts/contracts.service';
import { resolveContractPartyAFields } from '../contracts/contract-party-a-defaults';
import { ContractStatus, MemberStatus } from '@prisma/client';

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contractsService: ContractsService,
  ) {}

  /**
   * Create a reservation
   * - User must be verified (isVerified === true)
   * - Apartment must be available
   * - Sets apartment status to 'reserved'
   */
  async create(userId: string, createReservationDto: CreateReservationDto) {
    // 1. Check user is verified
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isVerified: true, isActive: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.isActive) {
      throw new BadRequestException('User account is inactive');
    }

    if (!user.isVerified) {
      throw new BadRequestException(
        'User must be verified before making a reservation. Please upload your identity card and wait for staff verification.',
      );
    }

    // 2. Check apartment exists and is available
    const apartment = await this.prisma.apartment.findUnique({
      where: { id: createReservationDto.apartmentId },
      select: {
        id: true,
        status: true,
        apartmentNumber: true,
        wardCode: true,
      },
    });

    if (!apartment) {
      throw new NotFoundException('Apartment not found');
    }

    if (apartment.status !== 'available') {
      throw new ConflictException(
        `Apartment ${apartment.apartmentNumber} is not available (current status: ${apartment.status})`,
      );
    }

    // 3. Validate dates
    const desiredStart = new Date(createReservationDto.desiredStartDate);
    const desiredEnd = new Date(createReservationDto.desiredEndDate);

    if (desiredEnd <= desiredStart) {
      throw new BadRequestException('End date must be after start date');
    }

    if (desiredStart < new Date()) {
      throw new BadRequestException('Start date cannot be in the past');
    }

    // 4. Check user doesn't already have an active reservation for this apartment
    const existingReservation = await this.prisma.reservation.findFirst({
      where: {
        userId,
        apartmentId: createReservationDto.apartmentId,
        status: { in: ['pending', 'confirmed'] },
      },
    });

    if (existingReservation) {
      throw new ConflictException(
        'You already have an active reservation for this apartment',
      );
    }

    // 5. Set expiration (48 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    // 6. Fetch apartment info for draft contract
    const fullApartment = await this.prisma.apartment.findUnique({
      where: { id: createReservationDto.apartmentId },
    });

    const normalizedNationalIds = Array.from(
      new Set(
        (createReservationDto.additionalMemberNationalIds ?? [])
          .map((id) => id.trim())
          .filter((id) => id.length > 0),
      ),
    );

    let additionalMemberUserIds: string[] = [];
    if (normalizedNationalIds.length > 0) {
      const verifiedIdentities = await this.prisma.userIdentity.findMany({
        where: {
          nationalId: { in: normalizedNationalIds },
          isVerified: true,
          user: {
            isActive: true,
            isVerified: true,
          },
        },
        select: {
          nationalId: true,
          userId: true,
        },
      });

      const verifiedNationalIds = new Set(
        verifiedIdentities
          .map((identity) => identity.nationalId)
          .filter((identity): identity is string => !!identity),
      );

      const invalidNationalIds = normalizedNationalIds.filter(
        (nationalId) => !verifiedNationalIds.has(nationalId),
      );

      if (invalidNationalIds.length > 0) {
        throw new BadRequestException(
          `These CCCD numbers are not linked to active verified users: ${invalidNationalIds.join(', ')}`,
        );
      }

      additionalMemberUserIds = Array.from(
        new Set(
          verifiedIdentities
            .map((identity) => identity.userId)
            .filter((memberUserId) => memberUserId !== userId),
        ),
      );
    }

    const occupancyLimit = fullApartment?.maxOccupants ?? 0;
    const totalContractMembers = 1 + additionalMemberUserIds.length;
    if (occupancyLimit > 0 && totalContractMembers > occupancyLimit) {
      throw new BadRequestException(
        `Reservation contract can have at most ${occupancyLimit} members based on apartment max occupants`,
      );
    }

    if (
      occupancyLimit > 0 &&
      typeof createReservationDto.numberOfOccupants === 'number' &&
      createReservationDto.numberOfOccupants > occupancyLimit
    ) {
      throw new BadRequestException(
        `numberOfOccupants cannot exceed apartment max occupants (${occupancyLimit})`,
      );
    }

    // 7. Generate contract number
    const contractNumber = await this.generateContractNumber();
    const defaultPartyAFields = resolveContractPartyAFields();

    // 8. Create reservation + draft contract in transaction
    const reservation = await this.prisma.$transaction(async (tx) => {
      // Update apartment status to reserved
      await tx.apartment.update({
        where: { id: createReservationDto.apartmentId },
        data: { status: 'reserved' },
      });

      // Create the reservation
      const newReservation = await tx.reservation.create({
        data: {
          userId,
          apartmentId: createReservationDto.apartmentId,
          desiredStartDate: desiredStart,
          desiredEndDate: desiredEnd,
          numberOfOccupants: createReservationDto.numberOfOccupants,
          specialRequests: createReservationDto.specialRequests,
          status: 'pending',
          expiresAt,
        },
        select: {
          id: true,
          userId: true,
          apartmentId: true,
          desiredStartDate: true,
          desiredEndDate: true,
          numberOfOccupants: true,
          specialRequests: true,
          status: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
          apartment: {
            select: {
              id: true,
              apartmentNumber: true,
              wardCode: true,
              baseRentPrice: true,
            },
          },
        },
      });

      // Create draft contract
      const contract = await tx.rentalContract.create({
        data: {
          contractNumber,
          apartment: { connect: { id: createReservationDto.apartmentId } },
          startDate: desiredStart,
          endDate: desiredEnd,
          monthlyRent: fullApartment?.baseRentPrice ?? 0,
          depositAmount: fullApartment?.depositAmount ?? 0,
          paymentDueDay: 5,
          paymentMethod: 'bank_transfer',
          specialConditions: createReservationDto.specialRequests,
          ...defaultPartyAFields,
          status: ContractStatus.draft,
        },
      });

      // Link contract to reservation
      await tx.reservation.update({
        where: { id: newReservation.id },
        data: { createdContractId: contract.id },
      });

      // Add user as primary contract member
      await tx.userContractMember.create({
        data: {
          userId,
          rentalContractId: contract.id,
          memberType: 'primary',
          isPrimaryContact: true,
          status: MemberStatus.active,
        },
      });

      if (additionalMemberUserIds.length > 0) {
        await tx.userContractMember.createMany({
          data: additionalMemberUserIds.map((memberUserId) => ({
            userId: memberUserId,
            rentalContractId: contract.id,
            memberType: 'co_tenant',
            isPrimaryContact: false,
            status: MemberStatus.active,
          })),
        });
      }

      return { ...newReservation, contractId: contract.id, contractNumber };
    });

    // 9. Generate contract PDF (async, after transaction)
    try {
      await this.contractsService.regenerateContractPdf(reservation.contractId);

      this.logger.log(
        `Draft contract ${contractNumber} created with PDF for reservation ${reservation.id}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to generate contract PDF for reservation ${reservation.id}: ${errorMessage}`,
      );
      // Don't fail the reservation if PDF generation fails
    }

    return reservation;
  }

  /**
   * Get all reservations for the current user
   */
  async findMyReservations(userId: string) {
    const reservations = await this.prisma.reservation.findMany({
      where: { userId },
      select: {
        id: true,
        userId: true,
        apartmentId: true,
        createdContractId: true,
        desiredStartDate: true,
        desiredEndDate: true,
        numberOfOccupants: true,
        specialRequests: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
        apartment: {
          select: {
            id: true,
            apartmentNumber: true,
            wardCode: true,
            baseRentPrice: true,
          },
        },
        createdContract: {
          select: {
            id: true,
            contractNumber: true,
            status: true,
            contractPdfData: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform to include pdfUrl with signed token
    return reservations.map((reservation) => {
      const { createdContract, ...rest } = reservation;
      const pdfToken = createdContract?.contractPdfData
        ? this.contractsService.generatePdfToken(createdContract.id)
        : null;
      return {
        ...rest,
        createdContract: createdContract
          ? {
              id: createdContract.id,
              contractNumber: createdContract.contractNumber,
              status: createdContract.status,
              hasPdf: !!createdContract.contractPdfData,
              pdfUrl: pdfToken ? `/contracts/pdf/view?token=${pdfToken}` : null,
            }
          : null,
      };
    });
  }

  /**
   * Get a specific reservation by ID
   */
  async findOne(id: string, userId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        apartmentId: true,
        createdContractId: true,
        desiredStartDate: true,
        desiredEndDate: true,
        numberOfOccupants: true,
        specialRequests: true,
        status: true,
        cancelReason: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
        apartment: {
          select: {
            id: true,
            apartmentNumber: true,
            wardCode: true,
            baseRentPrice: true,
          },
        },
        createdContract: {
          select: {
            id: true,
            contractNumber: true,
            status: true,
            contractPdfData: true,
          },
        },
      },
    });

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    if (reservation.userId !== userId) {
      throw new NotFoundException('Reservation not found');
    }

    // Transform to include pdfUrl with signed token
    const { createdContract, ...restData } = reservation;
    const pdfToken = createdContract?.contractPdfData
      ? this.contractsService.generatePdfToken(createdContract.id)
      : null;

    return {
      ...restData,
      createdContract: createdContract
        ? {
            id: createdContract.id,
            contractNumber: createdContract.contractNumber,
            status: createdContract.status,
            hasPdf: !!createdContract.contractPdfData,
            pdfUrl: pdfToken ? `/contracts/pdf/view?token=${pdfToken}` : null,
          }
        : null,
    };
  }

  /**
   * Cancel a reservation
   * - Sets reservation status to cancelled
   * - Sets apartment status back to available
   */
  async cancel(id: string, userId: string, reason?: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      select: { id: true, userId: true, apartmentId: true, status: true },
    });

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    if (reservation.userId !== userId) {
      throw new NotFoundException('Reservation not found');
    }

    if (reservation.status === 'cancelled') {
      throw new BadRequestException('Reservation is already cancelled');
    }

    if (reservation.status === 'expired') {
      throw new BadRequestException('Cannot cancel an expired reservation');
    }

    return this.prisma.$transaction(async (tx) => {
      // Set apartment back to available
      await tx.apartment.update({
        where: { id: reservation.apartmentId },
        data: { status: 'available' },
      });

      // Cancel the reservation
      return tx.reservation.update({
        where: { id },
        data: {
          status: 'cancelled',
          cancelReason: reason,
        },
        select: {
          id: true,
          userId: true,
          apartmentId: true,
          status: true,
          cancelReason: true,
          updatedAt: true,
          apartment: {
            select: {
              id: true,
              apartmentNumber: true,
              wardCode: true,
              baseRentPrice: true,
            },
          },
        },
      });
    });
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
