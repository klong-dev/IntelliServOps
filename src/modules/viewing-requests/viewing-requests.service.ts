import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateViewingRequestDto, CreateAppointmentDto } from './dto';
import {
  ContactRequestStatus,
  AppointmentStatus,
  PreferredContactMethod,
  ContactSource,
} from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class ViewingRequestsService {
  constructor(private readonly prisma: PrismaService) {}

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
        city: true,
        district: true,
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

    // Find best matching staff (same district > same city > any active)
    const assignedStaff = await this.findBestMatchingStaff(
      apartment.city,
      apartment.district,
    );

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
            address: true,
            city: true,
            district: true,
          },
        },
      },
    });

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

    // Find contact requests in staff's working area
    const where: any = {
      status: {
        in: [ContactRequestStatus.new, ContactRequestStatus.contacted],
      },
      apartmentId: { not: null },
    };

    if (staff.workingDistrict) {
      where.apartment = { is: { district: staff.workingDistrict } };
    } else if (staff.workingCity) {
      where.apartment = { is: { city: staff.workingCity } };
    }

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
            address: true,
            city: true,
            district: true,
            apartmentType: true,
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
            apartmentType: true,
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
      contactRequest.apartment.apartmentType,
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
          select: { apartmentNumber: true, address: true },
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
   * Find best matching staff based on proximity to apartment location.
   * Priority: Same district > Same city > Any active staff
   */
  private async findBestMatchingStaff(city: string, district: string) {
    // First try: Same district
    let staff = await this.prisma.staff.findFirst({
      where: {
        isActive: true,
        workingDistrict: district,
      },
      select: { id: true, fullName: true, phone: true },
    });

    if (staff) return staff;

    // Second try: Same city
    staff = await this.prisma.staff.findFirst({
      where: {
        isActive: true,
        workingCity: city,
      },
      select: { id: true, fullName: true, phone: true },
    });

    if (staff) return staff;

    // Fallback: Any active staff
    return this.prisma.staff.findFirst({
      where: { isActive: true },
      select: { id: true, fullName: true, phone: true },
    });
  }

  /**
   * Check if slot is available for the given time.
   * Counts existing appointments at same building/type and time.
   */
  private async checkSlotAvailability(
    apartmentId: string,
    buildingName: string | null,
    apartmentType: string | null,
    appointmentTime: Date,
    durationMinutes: number,
    maxSlots: number,
  ) {
    const slotStart = appointmentTime;
    const slotEnd = new Date(
      appointmentTime.getTime() + durationMinutes * 60000,
    );

    // Build filter for same building and type
    const apartmentFilter: any = {};

    if (buildingName && apartmentType) {
      apartmentFilter.buildingName = buildingName;
      apartmentFilter.apartmentType = apartmentType;
    } else {
      // No building/type grouping, check only the specific apartment
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
