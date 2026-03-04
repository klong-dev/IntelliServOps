import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReservationDto } from './dto';

@Injectable()
export class ReservationsService {
  constructor(private readonly prisma: PrismaService) {}

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
      select: { id: true, status: true, apartmentNumber: true, address: true },
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

    // 6. Create reservation + set apartment status to reserved (transaction)
    const reservation = await this.prisma.$transaction(async (tx) => {
      // Update apartment status to reserved
      await tx.apartment.update({
        where: { id: createReservationDto.apartmentId },
        data: { status: 'reserved' },
      });

      // Create the reservation
      return tx.reservation.create({
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
              address: true,
              baseRentPrice: true,
            },
          },
        },
      });
    });

    return reservation;
  }

  /**
   * Get all reservations for the current user
   */
  async findMyReservations(userId: string) {
    return this.prisma.reservation.findMany({
      where: { userId },
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
            address: true,
            baseRentPrice: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
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
            address: true,
            baseRentPrice: true,
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

    return reservation;
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
              address: true,
              baseRentPrice: true,
            },
          },
        },
      });
    });
  }
}
