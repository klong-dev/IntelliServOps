import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserViewingRequestDto, MyViewingRequestsQueryDto } from './dto';
import { CancelViewingRequestDto } from './dto/cancel-viewing-request.dto';
import { DoneViewingRequestDto } from './dto/done-viewing-request.dto';
import { StaffAcceptViewingRequestDto } from './dto/staff-accept-viewing-request.dto';
import { StaffDenyViewingRequestDto } from './dto/staff-deny-viewing-request.dto';
import {
  AppointmentStatus,
  PreferredContactMethod,
  Prisma,
  Staff,
} from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class ViewingRequestsService {
  private readonly defaultDurationMinutes = 30;
  private readonly maxDurationMinutes = 240;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Authenticated user books a viewing appointment.
   * Flow: validate apartment + user profile, check slot, and create appointment.
   */
  async createUserViewingBooking(
    createDto: CreateUserViewingRequestDto,
    currentUser: JwtPayload,
  ) {
    const appointmentTime = new Date(createDto.appointmentAt);
    const durationMinutes = this.resolveDurationMinutes(createDto);

    if (Number.isNaN(appointmentTime.getTime())) {
      throw new BadRequestException('Invalid appointmentAt datetime');
    }

    if (appointmentTime <= new Date()) {
      throw new BadRequestException('appointmentAt must be in the future');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new NotFoundException('User not found or inactive');
    }

    if (!user.phone) {
      throw new BadRequestException(
        'User phone number is required to book a viewing appointment',
      );
    }
    const apartment = await this.prisma.apartment.findUnique({
      where: { id: createDto.apartmentId },
      select: {
        id: true,
        apartmentNumber: true,
        buildingName: true,
        maxConcurrentViewings: true,
        status: true,
      },
    });

    if (!apartment) {
      throw new NotFoundException('Apartment not found');
    }

    if (apartment.status !== 'available') {
      throw new BadRequestException('Apartment is not available for viewing');
    }

    await this.ensureApartmentSlotAvailable(
      apartment.id,
      appointmentTime,
      durationMinutes,
    );

    const assignedStaff = this.assignStaff(
      await this.findBestMatchingStaff(appointmentTime, durationMinutes),
    );
    if (!assignedStaff) {
      throw new BadRequestException('No active staff available to assign');
    }

    const appointmentDate = new Date(appointmentTime);
    appointmentDate.setHours(0, 0, 0, 0);

    const normalizedNote = createDto.note?.trim() || null;

    const result = await this.prisma.$transaction(async (tx) => {
      let guest = await tx.guest.findUnique({
        where: { email: user.email },
      });

      if (!guest) {
        guest = await tx.guest.create({
          data: {
            email: user.email,
            phone: user.phone,
            fullName: user.fullName,
            preferredContactMethod: PreferredContactMethod.phone,
          },
        });
      }

      const slotStart = appointmentTime;
      const slotEnd = this.buildSlotEnd(slotStart, durationMinutes);
      const possibleOverlaps = await tx.appointment.findMany({
        where: {
          status: {
            in: [AppointmentStatus.scheduled, AppointmentStatus.confirmed],
          },
          appointmentTime: {
            lt: slotEnd,
            gte: this.buildSearchWindowStart(slotStart),
          },
          OR: [
            { guestId: guest.id },
            { apartmentId: apartment.id },
            { assignedStaffId: assignedStaff.id },
          ],
        },
        select: {
          id: true,
          guestId: true,
          apartmentId: true,
          assignedStaffId: true,
          appointmentTime: true,
          durationMinutes: true,
        },
      });

      const hasUserOverlap = possibleOverlaps.some(
        (item) =>
          item.guestId === guest.id &&
          this.hasAppointmentOverlap(
            slotStart,
            durationMinutes,
            item.appointmentTime,
            item.durationMinutes,
          ),
      );

      if (hasUserOverlap) {
        throw new ConflictException(
          'You already have another appointment that overlaps this time range.',
        );
      }

      const hasApartmentOverlap = possibleOverlaps.some(
        (item) =>
          item.apartmentId === apartment.id &&
          this.hasAppointmentOverlap(
            slotStart,
            durationMinutes,
            item.appointmentTime,
            item.durationMinutes,
          ),
      );

      if (hasApartmentOverlap) {
        throw new ConflictException(
          'This apartment already has another appointment in the selected time range.',
        );
      }

      const hasStaffOverlap = possibleOverlaps.some(
        (item) =>
          item.assignedStaffId === assignedStaff.id &&
          this.hasAppointmentOverlap(
            slotStart,
            durationMinutes,
            item.appointmentTime,
            item.durationMinutes,
          ),
      );

      if (hasStaffOverlap) {
        throw new ConflictException(
          'Assigned staff already has another appointment in the selected time range.',
        );
      }

      const appointment = await tx.appointment.create({
        data: {
          guest: { connect: { id: guest.id } },
          apartment: { connect: { id: apartment.id } },
          assignedStaff: { connect: { id: assignedStaff.id } },
          appointmentDate,
          appointmentTime,
          durationMinutes,
          guestNotes: normalizedNote,
          status: AppointmentStatus.scheduled,
        },
        select: {
          id: true,
          appointmentTime: true,
          durationMinutes: true,
          status: true,
        },
      });

      return {
        appointmentId: appointment.id,
        apartmentId: apartment.id,
        apartmentNumber: apartment.apartmentNumber,
        appointmentAt: appointment.appointmentTime,
        durationMinutes: appointment.durationMinutes,
        status: appointment.status,
        note: normalizedNote,
        assignedStaff: {
          id: assignedStaff.id,
          fullName: assignedStaff.fullName,
          phone: assignedStaff.phone,
        },
      };
    });

    this.eventEmitter.emit('viewing_request.staff_assigned', {
      staffId: result.assignedStaff.id,
      appointmentId: result.appointmentId,
      apartmentId: result.apartmentId,
      requesterName: user.fullName,
    });

    return result;
  }

  async getMyViewingRequests(
    currentUser: JwtPayload,
    query: MyViewingRequestsQueryDto,
  ) {
    const { status, page = 1, limit = 10 } = query;

    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.sub },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new NotFoundException('User not found or inactive');
    }

    const where = {
      guest: {
        email: user.email,
      },
      ...(status ? { status } : {}),
    };

    const skip = (page - 1) * limit;

    const [appointments, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        select: {
          id: true,
          appointmentTime: true,
          durationMinutes: true,
          status: true,
          guestNotes: true,
          cancellationReason: true,
          cancelledAt: true,
          createdAt: true,
          apartment: {
            select: {
              id: true,
              apartmentNumber: true,
              buildingName: true,
              wardCode: true,
              provinceCode: true,
              streetAddress: true,
            },
          },
          assignedStaff: {
            select: {
              id: true,
              fullName: true,
              phone: true,
            },
          },
        },
        orderBy: {
          appointmentTime: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    const items = appointments.map((appointment) => ({
      appointmentId: appointment.id,
      appointmentAt: appointment.appointmentTime,
      durationMinutes: appointment.durationMinutes,
      status: appointment.status,
      note: appointment.cancellationReason ?? appointment.guestNotes ?? null,
      cancellationReason: appointment.cancellationReason ?? null,
      cancelledAt: appointment.cancelledAt,
      apartment: appointment.apartment,
      assignedStaff: appointment.assignedStaff,
      createdAt: appointment.createdAt,
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
   * Get appointments assigned to the current staff.
   */
  async getMyAssigned(currentUser: JwtPayload) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: currentUser.sub },
      select: { id: true },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    return this.prisma.appointment.findMany({
      where: {
        assignedStaffId: currentUser.sub,
        status: {
          in: [AppointmentStatus.scheduled, AppointmentStatus.confirmed],
        },
      },
      select: {
        id: true,
        appointmentTime: true,
        durationMinutes: true,
        status: true,
        guestNotes: true,
        guest: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
          },
        },
        apartment: {
          select: {
            id: true,
            apartmentNumber: true,
            wardCode: true,
          },
        },
      },
      orderBy: { appointmentTime: 'asc' },
    });
  }

  /**
   * Get all appointments for an apartment on a specific date (for Staff to see)
   */
  async getApartmentAppointments(apartmentId: string, date: string) {
    const targetDate = new Date(date);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    return this.prisma.appointment.findMany({
      where: {
        apartmentId,
        appointmentDate: {
          gte: targetDate,
          lt: nextDay,
        },
        status: {
          in: [AppointmentStatus.scheduled, AppointmentStatus.confirmed],
        },
      },
      select: {
        id: true,
        appointmentTime: true,
        durationMinutes: true,
        status: true,
        assignedStaff: {
          select: { fullName: true },
        },
      },
      orderBy: { appointmentTime: 'asc' },
    });
  }

  /**
   * Staff confirms a viewing appointment.
   */
  async confirmAppointment(appointmentId: string, currentUser: JwtPayload) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        assignedStaffId: true,
        status: true,
        apartmentId: true,
        guest: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.assignedStaffId !== currentUser.sub) {
      throw new ForbiddenException('You are not assigned to this appointment');
    }

    if (
      appointment.status === AppointmentStatus.cancelled ||
      appointment.status === AppointmentStatus.completed
    ) {
      throw new BadRequestException(
        `Cannot confirm appointment with status '${appointment.status}'`,
      );
    }

    if (appointment.status !== AppointmentStatus.confirmed) {
      const confirmedAppointment = await this.prisma.appointment.update({
        where: { id: appointmentId },
        data: { status: AppointmentStatus.confirmed },
        select: {
          id: true,
          guestId: true,
          apartmentId: true,
          assignedStaffId: true,
          appointmentDate: true,
          appointmentTime: true,
          durationMinutes: true,
          meetingLocation: true,
          type: true,
          status: true,
          guestNotes: true,
          staffNotes: true,
          outcome: true,
          followupRequired: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (appointment.guest?.email) {
        const user = await this.prisma.user.findUnique({
          where: { email: appointment.guest.email },
          select: { id: true },
        });

        if (user) {
          this.eventEmitter.emit('viewing_request.confirmed_by_staff', {
            userId: user.id,
            appointmentId,
            apartmentId: appointment.apartmentId,
          });
        }
      }

      return confirmedAppointment;
    }

    return this.prisma.appointment.findUniqueOrThrow({
      where: { id: appointmentId },
      select: {
        id: true,
        guestId: true,
        apartmentId: true,
        assignedStaffId: true,
        appointmentDate: true,
        appointmentTime: true,
        durationMinutes: true,
        meetingLocation: true,
        type: true,
        status: true,
        guestNotes: true,
        staffNotes: true,
        outcome: true,
        followupRequired: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async acceptViewingRequest(
    dto: StaffAcceptViewingRequestDto,
    currentUser: JwtPayload,
  ) {
    return this.confirmAppointment(dto.appointmentId, currentUser);
  }

  async denyViewingRequest(
    dto: StaffDenyViewingRequestDto,
    currentUser: JwtPayload,
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: dto.appointmentId },
      select: {
        id: true,
        assignedStaffId: true,
        status: true,
        apartmentId: true,
        guest: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.assignedStaffId !== currentUser.sub) {
      throw new ForbiddenException('You are not assigned to this appointment');
    }

    if (
      appointment.status === AppointmentStatus.confirmed ||
      appointment.status === AppointmentStatus.completed ||
      appointment.status === AppointmentStatus.no_show
    ) {
      throw new BadRequestException(
        `Cannot deny appointment with status '${appointment.status}'`,
      );
    }

    let deniedAppointment;

    if (appointment.status !== AppointmentStatus.cancelled) {
      deniedAppointment = await this.prisma.appointment.update({
        where: { id: dto.appointmentId },
        data: {
          status: AppointmentStatus.cancelled,
          cancelledAt: new Date(),
          cancellationReason: dto.reason?.trim() || 'Denied by assigned staff',
        },
        select: {
          id: true,
          guestId: true,
          apartmentId: true,
          assignedStaffId: true,
          appointmentDate: true,
          appointmentTime: true,
          durationMinutes: true,
          meetingLocation: true,
          type: true,
          status: true,
          guestNotes: true,
          staffNotes: true,
          outcome: true,
          followupRequired: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (appointment.guest?.email) {
        const user = await this.prisma.user.findUnique({
          where: { email: appointment.guest.email },
          select: { id: true },
        });

        if (user) {
          this.eventEmitter.emit('viewing_request.denied_by_staff', {
            userId: user.id,
            appointmentId: appointment.id,
            apartmentId: appointment.apartmentId,
            reason: dto.reason,
          });
        }
      }

      return deniedAppointment;
    }

    return this.prisma.appointment.findUniqueOrThrow({
      where: { id: dto.appointmentId },
      select: {
        id: true,
        guestId: true,
        apartmentId: true,
        assignedStaffId: true,
        appointmentDate: true,
        appointmentTime: true,
        durationMinutes: true,
        meetingLocation: true,
        type: true,
        status: true,
        guestNotes: true,
        staffNotes: true,
        outcome: true,
        followupRequired: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Staff confirms a viewing job is done.
   */
  async confirmDoneJob(
    appointmentId: string,
    currentUser: JwtPayload,
    dto: DoneViewingRequestDto,
  ) {
    const normalizedNote = dto.note?.trim();

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        assignedStaffId: true,
        status: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.assignedStaffId !== currentUser.sub) {
      throw new ForbiddenException('You are not assigned to this appointment');
    }

    if (appointment.status !== AppointmentStatus.completed) {
      return this.prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.completed,
          ...(normalizedNote ? { staffNotes: normalizedNote } : {}),
        },
        select: {
          id: true,
          guestId: true,
          apartmentId: true,
          assignedStaffId: true,
          appointmentDate: true,
          appointmentTime: true,
          durationMinutes: true,
          meetingLocation: true,
          type: true,
          status: true,
          guestNotes: true,
          staffNotes: true,
          outcome: true,
          followupRequired: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    if (normalizedNote) {
      return this.prisma.appointment.update({
        where: { id: appointmentId },
        data: { staffNotes: normalizedNote },
        select: {
          id: true,
          guestId: true,
          apartmentId: true,
          assignedStaffId: true,
          appointmentDate: true,
          appointmentTime: true,
          durationMinutes: true,
          meetingLocation: true,
          type: true,
          status: true,
          guestNotes: true,
          staffNotes: true,
          outcome: true,
          followupRequired: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    return this.prisma.appointment.findUniqueOrThrow({
      where: { id: appointmentId },
      select: {
        id: true,
        guestId: true,
        apartmentId: true,
        assignedStaffId: true,
        appointmentDate: true,
        appointmentTime: true,
        durationMinutes: true,
        meetingLocation: true,
        type: true,
        status: true,
        guestNotes: true,
        staffNotes: true,
        outcome: true,
        followupRequired: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Assigned staff or appointment owner user cancels an appointment.
   */
  async cancelAppointment(
    appointmentId: string,
    currentUser: JwtPayload,
    dto: CancelViewingRequestDto,
  ) {
    const normalizedNote = dto.note?.trim();

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        assignedStaffId: true,
        status: true,
        guest: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (currentUser.actorType === 'staff') {
      if (appointment.assignedStaffId !== currentUser.sub) {
        throw new ForbiddenException(
          'You are not assigned to this appointment',
        );
      }
    } else if (currentUser.actorType === 'user') {
      const user = await this.prisma.user.findUnique({
        where: { id: currentUser.sub },
        select: { email: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (!appointment.guest || appointment.guest.email !== user.email) {
        throw new ForbiddenException(
          'You do not have permission to cancel this appointment',
        );
      }
    } else {
      throw new ForbiddenException('Only staff or user can cancel appointment');
    }

    if (appointment.status !== AppointmentStatus.cancelled) {
      const cancelledAppointment = await this.prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.cancelled,
          cancelledAt: new Date(),
          cancellationReason: normalizedNote
            ? normalizedNote
            : currentUser.actorType === 'staff'
              ? 'Cancelled by assigned staff'
              : 'Cancelled by user',
        },
        select: {
          id: true,
          guestId: true,
          apartmentId: true,
          assignedStaffId: true,
          appointmentDate: true,
          appointmentTime: true,
          durationMinutes: true,
          meetingLocation: true,
          type: true,
          status: true,
          guestNotes: true,
          staffNotes: true,
          outcome: true,
          followupRequired: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (currentUser.actorType === 'user') {
        this.eventEmitter.emit('viewing_request.user_cancelled', {
          staffId: appointment.assignedStaffId,
          appointmentId: appointment.id,
        });
      }

      return cancelledAppointment;
    }

    if (normalizedNote) {
      return this.prisma.appointment.update({
        where: { id: appointmentId },
        data: { cancellationReason: normalizedNote },
        select: {
          id: true,
          guestId: true,
          apartmentId: true,
          assignedStaffId: true,
          appointmentDate: true,
          appointmentTime: true,
          durationMinutes: true,
          meetingLocation: true,
          type: true,
          status: true,
          guestNotes: true,
          staffNotes: true,
          outcome: true,
          followupRequired: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    return this.prisma.appointment.findUniqueOrThrow({
      where: { id: appointmentId },
      select: {
        id: true,
        guestId: true,
        apartmentId: true,
        assignedStaffId: true,
        appointmentDate: true,
        appointmentTime: true,
        durationMinutes: true,
        meetingLocation: true,
        type: true,
        status: true,
        guestNotes: true,
        staffNotes: true,
        outcome: true,
        followupRequired: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  getRandomInt = (min: number, max: number): number => {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled); // The maximum is exclusive and the minimum is inclusive
  };

  assignStaff = (staffs: Staff[]) => {
    if (!staffs.length) {
      return null;
    }
    const r = this.getRandomInt(0, staffs.length - 1);
    return staffs[r];
  };

  /**
   * Find active customer service staff.
   * If appointment time is provided, exclude only staff that already has
   * an overlapping confirmed appointment in that time window.
   */
  private async findBestMatchingStaff(
    appointmentTime?: Date,
    durationMinutes = 30,
  ) {
    const baseWhere: Prisma.StaffWhereInput = {
      isActive: true,
      role: 'customer_service',
    };

    if (!appointmentTime) {
      return this.prisma.staff.findMany({ where: baseWhere });
    }

    const slotStart = appointmentTime;
    const slotEnd = this.buildSlotEnd(slotStart, durationMinutes);
    const possibleOverlaps = await this.prisma.appointment.findMany({
      where: {
        status: {
          in: [AppointmentStatus.scheduled, AppointmentStatus.confirmed],
        },
        appointmentTime: {
          lt: slotEnd,
          gte: this.buildSearchWindowStart(slotStart),
        },
      },
      select: {
        assignedStaffId: true,
        appointmentTime: true,
        durationMinutes: true,
      },
    });

    const occupiedStaffIds = new Set(
      possibleOverlaps
        .filter(
          (item) =>
            !!item.assignedStaffId &&
            this.hasAppointmentOverlap(
              slotStart,
              durationMinutes,
              item.appointmentTime,
              item.durationMinutes,
            ),
        )
        .map((item) => item.assignedStaffId)
        .filter((staffId): staffId is string => !!staffId),
    );

    return this.prisma.staff.findMany({
      where:
        occupiedStaffIds.size > 0
          ? {
              ...baseWhere,
              id: { notIn: Array.from(occupiedStaffIds) },
            }
          : baseWhere,
    });
  }

  private buildSlotEnd(start: Date, durationMinutes: number) {
    return new Date(start.getTime() + durationMinutes * 60000);
  }

  private resolveDurationMinutes(
    createDto: CreateUserViewingRequestDto,
  ): number {
    const maybeDuration = (createDto as { durationMinutes?: unknown })
      .durationMinutes;

    if (typeof maybeDuration === 'number' && Number.isFinite(maybeDuration)) {
      return maybeDuration;
    }

    return this.defaultDurationMinutes;
  }

  private buildSearchWindowStart(slotStart: Date) {
    return new Date(slotStart.getTime() - this.maxDurationMinutes * 60000);
  }

  private hasAppointmentOverlap(
    slotStart: Date,
    slotDurationMinutes: number,
    existingStart: Date,
    existingDurationMinutes: number,
  ) {
    const slotEnd = this.buildSlotEnd(slotStart, slotDurationMinutes);
    const existingEnd = this.buildSlotEnd(
      existingStart,
      existingDurationMinutes,
    );

    return existingStart < slotEnd && existingEnd > slotStart;
  }

  private async ensureApartmentSlotAvailable(
    apartmentId: string,
    appointmentTime: Date,
    durationMinutes: number,
  ) {
    const slotStart = appointmentTime;
    const slotEnd = this.buildSlotEnd(slotStart, durationMinutes);

    const possibleOverlaps = await this.prisma.appointment.findMany({
      where: {
        apartmentId,
        status: {
          in: [AppointmentStatus.scheduled, AppointmentStatus.confirmed],
        },
        appointmentTime: {
          lt: slotEnd,
          gte: this.buildSearchWindowStart(slotStart),
        },
      },
      select: {
        appointmentTime: true,
        durationMinutes: true,
      },
    });

    const hasOverlap = possibleOverlaps.some((item) =>
      this.hasAppointmentOverlap(
        slotStart,
        durationMinutes,
        item.appointmentTime,
        item.durationMinutes,
      ),
    );

    if (hasOverlap) {
      throw new ConflictException(
        'This apartment already has another appointment in the selected time range.',
      );
    }
  }
}
