import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ViewingRequestsService } from './viewing-requests.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, mockStaffJwtPayload } from '../../test-utils';
import {
  ContactRequestStatus,
  AppointmentStatus,
  PreferredContactMethod,
  ContactSource,
} from '@prisma/client';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

describe('ViewingRequestsService', () => {
  let service: ViewingRequestsService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let eventEmitter: { emit: jest.Mock };

  const mockContactRequest = (overrides = {}) => ({
    id: 'contact-123',
    fullName: 'John Doe',
    phone: '+84909123456',
    email: 'john@example.com',
    status: ContactRequestStatus.new,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const mockAppointment = (overrides = {}) => ({
    id: 'appt-123',
    contactRequestId: 'contact-123',
    apartmentId: 'apt-123',
    staffId: 'staff-123',
    appointmentDate: new Date('2026-02-15'),
    appointmentTime: new Date('2026-02-15T10:00:00'),
    durationMinutes: 30,
    status: AppointmentStatus.scheduled,
    createdAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    prisma = createPrismaMock();
    eventEmitter = { emit: jest.fn() };
    prisma.$transaction.mockImplementation(async (cb: any) =>
      cb(prisma as any),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ViewingRequestsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<ViewingRequestsService>(ViewingRequestsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      fullName: 'John Doe',
      phone: '+84909123456',
      email: 'john@example.com',
      apartmentId: 'apt-123',
      message: 'Interested in viewing',
    };

    it('should create viewing request and assign matching staff', async () => {
      const apartment = {
        id: 'apt-123',
        city: 'Hồ Chí Minh',
        district: 'Quận 1',
        status: 'available',
      };
      const guest = { id: 'guest-123', email: 'john@example.com' };
      const staff = {
        id: 'staff-123',
        fullName: 'Staff One',
        phone: '+84909000001',
      };

      prisma.apartment.findUnique.mockResolvedValue(apartment as any);
      prisma.guest.findUnique.mockResolvedValue(null);
      prisma.guest.create.mockResolvedValue(guest as any);
      prisma.staff.findMany.mockResolvedValue([staff] as any);
      prisma.contactRequest.create.mockResolvedValue({
        id: 'contact-123',
        fullName: 'John Doe',
        phone: '+84909123456',
        email: 'john@example.com',
        status: ContactRequestStatus.new,
        apartment: {
          apartmentNumber: 'A101',
          address: '123 Main',
          city: 'HCM',
          district: 'Q1',
        },
      } as any);

      const result = await service.create(createDto as any);

      expect(result.id).toBe('contact-123');
      expect(result.assignedStaff).toBeDefined();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'viewing_request.staff_assigned',
        expect.objectContaining({
          staffId: 'staff-123',
          contactRequestId: 'contact-123',
        }),
      );
    });

    it('should throw NotFoundException if apartment not found', async () => {
      prisma.apartment.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if apartment not available', async () => {
      const apartment = {
        id: 'apt-123',
        city: 'HCM',
        district: 'Q1',
        status: 'rented',
      };
      prisma.apartment.findUnique.mockResolvedValue(apartment as any);

      await expect(service.create(createDto as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getMyAssigned', () => {
    it('should return requests for staff working area', async () => {
      const staff = mockStaffJwtPayload();
      const staffData = {
        workingCity: 'Hồ Chí Minh',
        workingDistrict: 'Quận 1',
      };
      const requests = [mockContactRequest()];

      prisma.staff.findUnique.mockResolvedValue(staffData as any);
      prisma.contactRequest.findMany.mockResolvedValue(requests as any);

      const result = await service.getMyAssigned(staff);

      expect(result).toEqual(requests);
    });

    it('should throw NotFoundException if staff not found', async () => {
      const staff = mockStaffJwtPayload();
      prisma.staff.findUnique.mockResolvedValue(null);

      await expect(service.getMyAssigned(staff)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createAppointment', () => {
    const createDto = {
      appointmentDate: '2026-02-15',
      appointmentTime: '10:00',
      durationMinutes: 30,
    };

    it('should create appointment if slot available', async () => {
      const staff = mockStaffJwtPayload();
      const contactRequest = {
        id: 'contact-123',
        status: ContactRequestStatus.new,
        apartment: {
          id: 'apt-123',
          buildingName: 'Building A',
          maxConcurrentViewings: 3,
        },
        guest: { id: 'guest-123' },
      };

      prisma.contactRequest.findUnique.mockResolvedValue(contactRequest as any);
      prisma.appointment.count.mockResolvedValue(2); // 2 existing, max is 3
      prisma.appointment.create.mockResolvedValue(mockAppointment() as any);
      prisma.contactRequest.update.mockResolvedValue({} as any);

      const result = await service.createAppointment(
        'contact-123',
        createDto as any,
        staff,
      );

      expect(result.id).toBe('appt-123');
    });

    it('should throw ConflictException if slot full', async () => {
      const staff = mockStaffJwtPayload();
      const contactRequest = {
        id: 'contact-123',
        status: ContactRequestStatus.new,
        apartment: {
          id: 'apt-123',
          buildingName: 'Building A',
          maxConcurrentViewings: 3,
        },
        guest: null,
      };

      prisma.contactRequest.findUnique.mockResolvedValue(contactRequest as any);
      prisma.appointment.count.mockResolvedValue(3); // Already full

      await expect(
        service.createAppointment('contact-123', createDto as any, staff),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if contact request not found', async () => {
      const staff = mockStaffJwtPayload();
      prisma.contactRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.createAppointment('non-existent', createDto as any, staff),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if no apartment', async () => {
      const staff = mockStaffJwtPayload();
      const contactRequest = { id: 'contact-123', apartment: null };

      prisma.contactRequest.findUnique.mockResolvedValue(contactRequest as any);

      await expect(
        service.createAppointment('contact-123', createDto as any, staff),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getApartmentAppointments', () => {
    it('should return appointments for apartment on date', async () => {
      const appointments = [mockAppointment()];
      prisma.appointment.findMany.mockResolvedValue(appointments as any);

      const result = await service.getApartmentAppointments(
        'apt-123',
        '2026-02-15',
      );

      expect(result).toEqual(appointments);
    });
  });

  describe('confirmAppointment', () => {
    it('should set appointment confirmed for assigned staff', async () => {
      const staff = mockStaffJwtPayload();
      prisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-123',
        assignedStaffId: staff.sub,
        status: AppointmentStatus.scheduled,
        apartmentId: 'apt-123',
        guest: { email: 'john@example.com' },
      } as any);
      prisma.user.findUnique.mockResolvedValue({ id: 'user-123' } as any);
      prisma.appointment.update.mockResolvedValue({} as any);

      const result = await service.confirmAppointment('appt-123', staff);

      expect(result).toEqual({
        message: 'Appointment confirmed successfully.',
      });
      expect(prisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 'appt-123' },
        data: { status: AppointmentStatus.confirmed },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'viewing_request.confirmed_by_staff',
        {
          userId: 'user-123',
          appointmentId: 'appt-123',
          apartmentId: 'apt-123',
        },
      );
    });

    it('should throw NotFoundException if appointment does not exist', async () => {
      const staff = mockStaffJwtPayload();
      prisma.appointment.findUnique.mockResolvedValue(null);

      await expect(
        service.confirmAppointment('appt-missing', staff),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if staff is not assigned', async () => {
      const staff = mockStaffJwtPayload();
      prisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-123',
        assignedStaffId: 'staff-other',
        status: AppointmentStatus.scheduled,
      } as any);

      await expect(
        service.confirmAppointment('appt-123', staff),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException for cancelled/completed appointment', async () => {
      const staff = mockStaffJwtPayload();
      prisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-123',
        assignedStaffId: staff.sub,
        status: AppointmentStatus.cancelled,
      } as any);

      await expect(
        service.confirmAppointment('appt-123', staff),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirmDoneJob', () => {
    it('should set appointment completed for assigned staff', async () => {
      const staff = mockStaffJwtPayload();
      prisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-123',
        assignedStaffId: staff.sub,
        status: AppointmentStatus.scheduled,
      } as any);
      prisma.appointment.update.mockResolvedValue({} as any);

      const result = await service.confirmDoneJob('appt-123', staff);

      expect(result).toEqual({
        message: 'Done job confirmed. Appointment marked as completed.',
      });
      expect(prisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 'appt-123' },
        data: { status: AppointmentStatus.completed },
      });
    });

    it('should throw NotFoundException if appointment does not exist', async () => {
      const staff = mockStaffJwtPayload();
      prisma.appointment.findUnique.mockResolvedValue(null);

      await expect(
        service.confirmDoneJob('appt-missing', staff),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if staff is not assigned to appointment', async () => {
      const staff = mockStaffJwtPayload();
      prisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-123',
        assignedStaffId: 'staff-other',
        status: AppointmentStatus.scheduled,
      } as any);

      await expect(service.confirmDoneJob('appt-123', staff)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('cancelAppointment', () => {
    it('should allow assigned staff to cancel appointment', async () => {
      const staff = mockStaffJwtPayload();
      prisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-123',
        assignedStaffId: staff.sub,
        status: AppointmentStatus.scheduled,
        guest: { email: 'john@example.com' },
      } as any);
      prisma.appointment.update.mockResolvedValue({} as any);

      const result = await service.cancelAppointment('appt-123', staff as any);

      expect(result).toEqual({
        message: 'Appointment cancelled successfully.',
      });
      expect(prisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 'appt-123' },
        data: {
          status: AppointmentStatus.cancelled,
          cancelledAt: expect.any(Date),
        },
      });
    });

    it('should allow owner user to cancel appointment', async () => {
      const userPayload = {
        sub: 'user-123',
        email: 'john@example.com',
        role: 'user',
        actorType: 'user',
        type: 'access',
      };

      prisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-123',
        assignedStaffId: 'staff-1',
        status: AppointmentStatus.scheduled,
        guest: { email: 'john@example.com' },
      } as any);
      prisma.user.findUnique.mockResolvedValue({
        email: 'john@example.com',
      } as any);
      prisma.appointment.update.mockResolvedValue({} as any);

      const result = await service.cancelAppointment(
        'appt-123',
        userPayload as any,
      );

      expect(result).toEqual({
        message: 'Appointment cancelled successfully.',
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'viewing_request.user_cancelled',
        {
          staffId: 'staff-1',
          appointmentId: 'appt-123',
        },
      );
    });

    it('should throw ForbiddenException when non-owner user cancels appointment', async () => {
      const userPayload = {
        sub: 'user-123',
        email: 'john@example.com',
        role: 'user',
        actorType: 'user',
        type: 'access',
      };

      prisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-123',
        assignedStaffId: 'staff-1',
        status: AppointmentStatus.scheduled,
        guest: { email: 'other@example.com' },
      } as any);
      prisma.user.findUnique.mockResolvedValue({
        email: 'john@example.com',
      } as any);

      await expect(
        service.cancelAppointment('appt-123', userPayload as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
