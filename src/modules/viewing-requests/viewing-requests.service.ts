import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateViewingRequestDto,
  CreateAppointmentDto,
  CreateUserViewingRequestDto,
  MyViewingRequestsQueryDto,
} from './dto';
import {
  ContactRequestStatus,
  AppointmentStatus,
  PreferredContactMethod,
  ContactSource,
  Staff,
} from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class ViewingRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Guest submits a viewing request for an apartment.
   * Auto-assigns the closest Staff based on district/city matching.
   */
  async create(createDto: CreateViewingRequestDto) {
    // Verify apartment exists and is available
    const apartment = await this.prisma.apartment.findUnique({
      where: { id: createDto.apartmentId },
      select: {
        id: true,
        apartmentNumber: true,
        status: true,
      },
    });

    if (!apartment) {
      throw new NotFoundException('Apartment not found');
    }

    if (apartment.status !== 'available') {
      throw new BadRequestException('Apartment is not available for viewing');
    }

    // Find or create guest
    let guest = await this.prisma.guest.findUnique({
      where: { email: createDto.email },
    });

    if (!guest) {
      guest = await this.prisma.guest.create({
        data: {
          email: createDto.email,
          phone: createDto.phone,
          fullName: createDto.fullName,
          preferredContactMethod: PreferredContactMethod.phone,
        },
      });
    }

    // Find active staff (location-based matching removed after address schema refactor)

    const assignedStaff = this.assignStaff(await this.findBestMatchingStaff());
    // Create contact request
    const contactRequest = await this.prisma.contactRequest.create({
      data: {
        guest: { connect: { id: guest.id } },
        apartment: { connect: { id: createDto.apartmentId } },
        fullName: createDto.fullName,
        email: createDto.email,
        phone: createDto.phone,
        preferredMoveInDate: createDto.preferredMoveInDate
          ? new Date(createDto.preferredMoveInDate)
          : undefined,
        message: createDto.message,
        numberOfOccupants: createDto.numberOfOccupants,
        preferredContactTime: createDto.preferredContactTime,
        preferredContactMethod: PreferredContactMethod.phone,
        source: ContactSource.website,
        status: ContactRequestStatus.new,
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        status: true,
        apartment: {
          select: {
            apartmentNumber: true,
            newWardCode: true,
            oldWardCode: true,
          },
        },
      },
    });

    if (assignedStaff) {
      this.eventEmitter.emit('viewing_request.staff_assigned', {
        staffId: assignedStaff.id,
        contactRequestId: contactRequest.id,
        apartmentId: createDto.apartmentId,
        requesterName: createDto.fullName,
      });
    }

    return {
      ...contactRequest,
      assignedStaff: assignedStaff
        ? {
            id: assignedStaff.id,
            fullName: assignedStaff.fullName,
            phone: assignedStaff.phone,
          }
        : null,
      message: assignedStaff
        ? 'Request submitted. Staff will contact you soon.'
        : 'Request submitted. Our team will contact you soon.',
    };
  }

  /**
   * Authenticated user books a viewing appointment.
   * Flow: validate apartment + user profile, check slot, create contact request and appointment.
   */
  async createUserViewingBooking(
    createDto: CreateUserViewingRequestDto,
    currentUser: JwtPayload,
  ) {
    const appointmentTime = new Date(createDto.appointmentAt);
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
    const userPhone = user.phone;

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

    const assignedStaff = this.assignStaff(await this.findBestMatchingStaff());
    if (!assignedStaff) {
      throw new BadRequestException('No active staff available to assign');
    }

    await this.checkSlotAvailability(
      apartment.id,
      apartment.buildingName,
      appointmentTime,
      30,
      apartment.maxConcurrentViewings,
    );

    const appointmentDate = new Date(appointmentTime);
    appointmentDate.setHours(0, 0, 0, 0);

    const result = await this.prisma.$transaction(async (tx) => {
      let guest = await tx.guest.findUnique({
        where: { email: user.email },
      });

      if (!guest) {
        guest = await tx.guest.create({
          data: {
            email: user.email,
            phone: userPhone,
            fullName: user.fullName,
            preferredContactMethod: PreferredContactMethod.phone,
          },
        });
      }

      const contactRequest = await tx.contactRequest.create({
        data: {
          guest: { connect: { id: guest.id } },
          apartment: { connect: { id: apartment.id } },
          fullName: user.fullName,
          email: user.email,
          phone: userPhone,
          message: createDto.note,
          notes: createDto.note,
          preferredContactMethod: PreferredContactMethod.phone,
          source: ContactSource.mobile_app,
          status: ContactRequestStatus.scheduled,
          firstContactedAt: new Date(),
        },
        select: {
          id: true,
        },
      });

      const appointment = await tx.appointment.create({
        data: {
          guest: { connect: { id: guest.id } },
          apartment: { connect: { id: apartment.id } },
          contactRequest: { connect: { id: contactRequest.id } },
          assignedStaff: { connect: { id: assignedStaff.id } },
          appointmentDate,
          appointmentTime,
          durationMinutes: 30,
          guestNotes: createDto.note,
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
        contactRequestId: contactRequest.id,
        appointmentId: appointment.id,
        apartmentId: apartment.id,
        apartmentNumber: apartment.apartmentNumber,
        appointmentAt: appointment.appointmentTime,
        durationMinutes: appointment.durationMinutes,
        status: appointment.status,
        note: createDto.note,
        assignedStaff: {
          id: assignedStaff.id,
          fullName: assignedStaff.fullName,
          phone: assignedStaff.phone,
        },
      };
    });

    this.eventEmitter.emit('viewing_request.staff_assigned', {
      staffId: result.assignedStaff.id,
      contactRequestId: result.contactRequestId,
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
          cancelledAt: true,
          createdAt: true,
          apartment: {
            select: {
              id: true,
              apartmentNumber: true,
              buildingName: true,
              newWardCode: true,
              oldWardCode: true,
            },
          },
          assignedStaff: {
            select: {
              id: true,
              fullName: true,
              phone: true,
            },
          },
          contactRequest: {
            select: {
              id: true,
              status: true,
              message: true,
              notes: true,
              receivedAt: true,
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
      note: appointment.guestNotes ?? appointment.contactRequest?.notes ?? null,
      cancelledAt: appointment.cancelledAt,
      apartment: appointment.apartment,
      assignedStaff: appointment.assignedStaff,
      contactRequest: appointment.contactRequest,
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
   * Get viewing requests assigned to the current staff.
   * Matches based on staff's working district/city.
   */
  async getMyAssigned(currentUser: JwtPayload) {
    // Get staff's location
    const staff = await this.prisma.staff.findUnique({
      where: { id: currentUser.sub },
      select: { workingCity: true, workingDistrict: true },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    // Find contact requests to be handled by staff
    const where: any = {
      status: {
        in: [ContactRequestStatus.new, ContactRequestStatus.contacted],
      },
      apartmentId: { not: null },
    };

    return this.prisma.contactRequest.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        preferredContactTime: true,
        message: true,
        status: true,
        receivedAt: true,
        apartment: {
          select: {
            id: true,
            apartmentNumber: true,
            newWardCode: true,
            oldWardCode: true,
          },
        },
      },
      orderBy: { receivedAt: 'desc' },
    });
  }

  /**
   * Staff creates appointment from viewing request.
   * Checks slot limit before creating.
   */
  async createAppointment(
    contactRequestId: string,
    createDto: CreateAppointmentDto,
    currentUser: JwtPayload,
  ) {
    // Get contact request with apartment details
    const contactRequest = await this.prisma.contactRequest.findUnique({
      where: { id: contactRequestId },
      include: {
        apartment: {
          select: {
            id: true,
            maxConcurrentViewings: true,
            buildingName: true,
          },
        },
        guest: { select: { id: true } },
      },
    });

    if (!contactRequest) {
      throw new NotFoundException('Contact request not found');
    }

    if (!contactRequest.apartment) {
      throw new BadRequestException(
        'Contact request has no associated apartment',
      );
    }

    // Parse appointment datetime
    const appointmentDate = new Date(createDto.appointmentDate);
    const [hours, minutes] = createDto.appointmentTime.split(':').map(Number);
    const appointmentTime = new Date(createDto.appointmentDate);
    appointmentTime.setHours(hours, minutes, 0, 0);

    // Check slot limit for this time slot
    const slotLimit = contactRequest.apartment.maxConcurrentViewings;
    await this.checkSlotAvailability(
      contactRequest.apartment.id,
      contactRequest.apartment.buildingName,
      appointmentTime,
      createDto.durationMinutes || 30,
      slotLimit,
    );

    // Create appointment
    const appointment = await this.prisma.appointment.create({
      data: {
        apartment: { connect: { id: contactRequest.apartment.id } },
        contactRequest: { connect: { id: contactRequestId } },
        assignedStaff: { connect: { id: currentUser.sub } },
        ...(contactRequest.guest && {
          guest: { connect: { id: contactRequest.guest.id } },
        }),
        appointmentDate,
        appointmentTime,
        durationMinutes: createDto.durationMinutes || 30,
        meetingLocation: createDto.meetingLocation,
        staffNotes: createDto.staffNotes,
        status: AppointmentStatus.scheduled,
      },
      select: {
        id: true,
        appointmentDate: true,
        appointmentTime: true,
        durationMinutes: true,
        status: true,
        apartment: {
          select: {
            apartmentNumber: true,
            newWardCode: true,
            oldWardCode: true,
          },
        },
        assignedStaff: {
          select: { fullName: true, phone: true },
        },
      },
    });

    // Update contact request status
    await this.prisma.contactRequest.update({
      where: { id: contactRequestId },
      data: {
        status: ContactRequestStatus.scheduled,
        firstContactedAt: new Date(),
      },
    });

    return appointment;
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
      await this.prisma.appointment.update({
        where: { id: appointmentId },
        data: { status: AppointmentStatus.confirmed },
      });
    }

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

    return {
      message: 'Appointment confirmed successfully.',
    };
  }

  /**
   * Staff confirms a viewing job is done.
   */
  async confirmDoneJob(appointmentId: string, currentUser: JwtPayload) {
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
      await this.prisma.appointment.update({
        where: { id: appointmentId },
        data: { status: AppointmentStatus.completed },
      });
    }

    return {
      message: 'Done job confirmed. Appointment marked as completed.',
    };
  }

  /**
   * Staff or user cancels an appointment.
   */
  async cancelAppointment(appointmentId: string, currentUser: JwtPayload) {
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
      await this.prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.cancelled,
          cancelledAt: new Date(),
        },
      });

      if (currentUser.actorType === 'user') {
        this.eventEmitter.emit('viewing_request.user_cancelled', {
          staffId: appointment.assignedStaffId,
          appointmentId: appointment.id,
        });
      }
    }

    return {
      message: 'Appointment cancelled successfully.',
    };
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
   * Find available active staff
   */
  private async findBestMatchingStaff() {
    return await this.prisma.staff.findMany({
      where: {
        isActive: true,
        role: 'customer_service',
        appointments: {
          none: {
            status: {
              in: [AppointmentStatus.scheduled, AppointmentStatus.confirmed],
            },
          },
        },
      },
    });
  }

  /**
   * Check if slot is available for the given time.
   * Counts existing appointments at same building/type and time.
   */
  private async checkSlotAvailability(
    apartmentId: string,
    buildingName: string | null,
    appointmentTime: Date,
    durationMinutes: number,
    maxSlots: number,
  ) {
    const slotStart = appointmentTime;
    const slotEnd = new Date(
      appointmentTime.getTime() + durationMinutes * 60000,
    );

    // Build filter for same building
    const apartmentFilter: any = {};

    if (buildingName) {
      apartmentFilter.buildingName = buildingName;
    } else {
      // No building grouping, check only the specific apartment
      apartmentFilter.id = apartmentId;
    }

    // Count overlapping appointments
    const existingCount = await this.prisma.appointment.count({
      where: {
        apartment: apartmentFilter,
        status: {
          in: [AppointmentStatus.scheduled, AppointmentStatus.confirmed],
        },
        OR: [
          {
            // Starts during our slot
            appointmentTime: { gte: slotStart, lt: slotEnd },
          },
          {
            // We start during their slot
            AND: [
              { appointmentTime: { lte: slotStart } },
              {
                appointmentTime: {
                  gt: new Date(slotStart.getTime() - durationMinutes * 60000),
                },
              },
            ],
          },
        ],
      },
    });

    if (existingCount >= maxSlots) {
      throw new ConflictException(
        `Slot is full. Maximum ${maxSlots} viewings allowed at this time for this apartment type.`,
      );
    }
  }
}
