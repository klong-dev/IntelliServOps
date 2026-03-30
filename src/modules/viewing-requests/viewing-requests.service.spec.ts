import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ViewingRequestsService } from './viewing-requests.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, mockStaffJwtPayload } from '../../test-utils';
import { AppointmentStatus } from '@prisma/client';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

describe('ViewingRequestsService', () => {
  let service: ViewingRequestsService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let eventEmitter: { emit: jest.Mock };

  const mockAppointment = (overrides = {}) => ({
    id: 'appt-123',
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

  describe('getMyAssigned', () => {
    it('should return assigned appointments for current staff', async () => {
      const staff = mockStaffJwtPayload();
      const staffData = { id: staff.sub };
      const appointments = [mockAppointment()];

      prisma.staff.findUnique.mockResolvedValue(staffData as any);
      prisma.appointment.findMany.mockResolvedValue(appointments as any);

      const result = await service.getMyAssigned(staff);

      expect(result).toEqual(appointments);
    });

    it('should throw NotFoundException if staff not found', async () => {
      const staff = mockStaffJwtPayload();
      prisma.staff.findUnique.mockResolvedValue(null);

      await expect(service.getMyAssigned(staff)).rejects.toThrow(
        NotFoundException,
      );
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
      const now = new Date('2026-02-15T08:00:00.000Z');
      prisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-123',
        assignedStaffId: staff.sub,
        status: AppointmentStatus.scheduled,
        apartmentId: 'apt-123',
        guest: { email: 'john@example.com' },
      } as any);
      prisma.user.findUnique.mockResolvedValue({ id: 'user-123' } as any);
      prisma.appointment.update.mockResolvedValue({
        id: 'appt-123',
        guestId: 'guest-123',
        apartmentId: 'apt-123',
        assignedStaffId: staff.sub,
        appointmentDate: new Date('2026-02-15'),
        appointmentTime: new Date('2026-02-15T10:00:00.000Z'),
        durationMinutes: 30,
        meetingLocation: null,
        type: 'physical_viewing',
        status: AppointmentStatus.confirmed,
        guestNotes: 'note',
        staffNotes: null,
        outcome: null,
        followupRequired: false,
        createdAt: now,
        updatedAt: now,
      } as any);

      const result = await service.confirmAppointment('appt-123', staff);

      expect(result).toMatchObject({
        id: 'appt-123',
        status: AppointmentStatus.confirmed,
        apartmentId: 'apt-123',
        assignedStaffId: staff.sub,
      });
      expect(prisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'appt-123' },
          data: { status: AppointmentStatus.confirmed },
        }),
      );
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
      const now = new Date('2026-02-15T08:00:00.000Z');
      prisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-123',
        assignedStaffId: staff.sub,
        status: AppointmentStatus.scheduled,
      } as any);
      prisma.appointment.update.mockResolvedValue({
        id: 'appt-123',
        guestId: 'guest-123',
        apartmentId: 'apt-123',
        assignedStaffId: staff.sub,
        appointmentDate: new Date('2026-02-15'),
        appointmentTime: new Date('2026-02-15T10:00:00.000Z'),
        durationMinutes: 30,
        meetingLocation: null,
        type: 'physical_viewing',
        status: AppointmentStatus.completed,
        guestNotes: 'note',
        staffNotes: null,
        outcome: null,
        followupRequired: false,
        createdAt: now,
        updatedAt: now,
      } as any);

      const result = await service.confirmDoneJob('appt-123', staff);

      expect(result).toMatchObject({
        id: 'appt-123',
        status: AppointmentStatus.completed,
        apartmentId: 'apt-123',
      });
      expect(prisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'appt-123' },
          data: { status: AppointmentStatus.completed },
        }),
      );
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

  describe('acceptViewingRequest', () => {
    it('should confirm appointment and notify user when assigned staff accepts', async () => {
      const staff = mockStaffJwtPayload();
      const now = new Date('2026-02-15T08:00:00.000Z');
      prisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-123',
        assignedStaffId: staff.sub,
        status: AppointmentStatus.scheduled,
        apartmentId: 'apt-123',
        guest: { email: 'john@example.com' },
      } as any);
      prisma.user.findUnique.mockResolvedValue({ id: 'user-123' } as any);
      prisma.appointment.update.mockResolvedValue({
        id: 'appt-123',
        guestId: 'guest-123',
        apartmentId: 'apt-123',
        assignedStaffId: staff.sub,
        appointmentDate: new Date('2026-02-15'),
        appointmentTime: new Date('2026-02-15T10:00:00.000Z'),
        durationMinutes: 30,
        meetingLocation: null,
        type: 'physical_viewing',
        status: AppointmentStatus.confirmed,
        guestNotes: 'note',
        staffNotes: null,
        outcome: null,
        followupRequired: false,
        createdAt: now,
        updatedAt: now,
      } as any);

      const result = await service.acceptViewingRequest(
        { appointmentId: 'appt-123' },
        staff,
      );

      expect(result).toMatchObject({
        id: 'appt-123',
        status: AppointmentStatus.confirmed,
        apartmentId: 'apt-123',
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
  });

  describe('denyViewingRequest', () => {
    it('should cancel appointment and notify user when assigned staff denies', async () => {
      const staff = mockStaffJwtPayload();
      const now = new Date('2026-02-15T08:00:00.000Z');
      prisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-123',
        assignedStaffId: staff.sub,
        status: AppointmentStatus.scheduled,
        apartmentId: 'apt-123',
        guest: { email: 'john@example.com' },
      } as any);
      prisma.user.findUnique.mockResolvedValue({ id: 'user-123' } as any);
      prisma.appointment.update.mockResolvedValue({
        id: 'appt-123',
        guestId: 'guest-123',
        apartmentId: 'apt-123',
        assignedStaffId: staff.sub,
        appointmentDate: new Date('2026-02-15'),
        appointmentTime: new Date('2026-02-15T10:00:00.000Z'),
        durationMinutes: 30,
        meetingLocation: null,
        type: 'physical_viewing',
        status: AppointmentStatus.cancelled,
        guestNotes: 'note',
        staffNotes: null,
        outcome: null,
        followupRequired: false,
        createdAt: now,
        updatedAt: now,
      } as any);

      const result = await service.denyViewingRequest(
        {
          appointmentId: 'appt-123',
          reason: 'Busy with emergency maintenance',
        },
        staff,
      );

      expect(result).toMatchObject({
        id: 'appt-123',
        status: AppointmentStatus.cancelled,
        apartmentId: 'apt-123',
      });
      expect(prisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'appt-123' },
          data: expect.objectContaining({
            status: AppointmentStatus.cancelled,
            cancellationReason: 'Busy with emergency maintenance',
          }),
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'viewing_request.denied_by_staff',
        {
          userId: 'user-123',
          appointmentId: 'appt-123',
          apartmentId: 'apt-123',
          reason: 'Busy with emergency maintenance',
        },
      );
    });

    it('should throw ForbiddenException when staff is not assigned', async () => {
      const staff = mockStaffJwtPayload();
      prisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-123',
        assignedStaffId: 'staff-other',
        status: AppointmentStatus.scheduled,
      } as any);

      await expect(
        service.denyViewingRequest({ appointmentId: 'appt-123' }, staff),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException for confirmed appointment', async () => {
      const staff = mockStaffJwtPayload();
      prisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-123',
        assignedStaffId: staff.sub,
        status: AppointmentStatus.confirmed,
      } as any);

      await expect(
        service.denyViewingRequest({ appointmentId: 'appt-123' }, staff),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for completed appointment', async () => {
      const staff = mockStaffJwtPayload();
      prisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-123',
        assignedStaffId: staff.sub,
        status: AppointmentStatus.completed,
      } as any);

      await expect(
        service.denyViewingRequest({ appointmentId: 'appt-123' }, staff),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelAppointment', () => {
    it('should allow assigned staff to cancel appointment', async () => {
      const staff = mockStaffJwtPayload();
      const now = new Date('2026-02-15T08:00:00.000Z');
      prisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-123',
        assignedStaffId: staff.sub,
        status: AppointmentStatus.scheduled,
        guest: { email: 'john@example.com' },
      } as any);
      prisma.appointment.update.mockResolvedValue({
        id: 'appt-123',
        guestId: 'guest-123',
        apartmentId: 'apt-123',
        assignedStaffId: staff.sub,
        appointmentDate: new Date('2026-02-15'),
        appointmentTime: new Date('2026-02-15T10:00:00.000Z'),
        durationMinutes: 30,
        meetingLocation: null,
        type: 'physical_viewing',
        status: AppointmentStatus.cancelled,
        guestNotes: 'note',
        staffNotes: null,
        outcome: null,
        followupRequired: false,
        createdAt: now,
        updatedAt: now,
      } as any);

      const result = await service.cancelAppointment('appt-123', staff as any);

      expect(result).toMatchObject({
        id: 'appt-123',
        status: AppointmentStatus.cancelled,
      });
      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        'viewing_request.user_cancelled',
        expect.anything(),
      );
    });

    it('should allow owner user to cancel appointment', async () => {
      const userPayload = {
        sub: 'user-123',
        email: 'john@example.com',
        role: 'user',
        actorType: 'user',
        type: 'access',
      };
      const now = new Date('2026-02-15T08:00:00.000Z');

      prisma.appointment.findUnique.mockResolvedValue({
        id: 'appt-123',
        assignedStaffId: 'staff-1',
        status: AppointmentStatus.scheduled,
        guest: { email: 'john@example.com' },
      } as any);
      prisma.user.findUnique.mockResolvedValue({
        email: 'john@example.com',
      } as any);
      prisma.appointment.update.mockResolvedValue({
        id: 'appt-123',
        guestId: 'guest-123',
        apartmentId: 'apt-123',
        assignedStaffId: 'staff-1',
        appointmentDate: new Date('2026-02-15'),
        appointmentTime: new Date('2026-02-15T10:00:00.000Z'),
        durationMinutes: 30,
        meetingLocation: null,
        type: 'physical_viewing',
        status: AppointmentStatus.cancelled,
        guestNotes: 'note',
        staffNotes: null,
        outcome: null,
        followupRequired: false,
        createdAt: now,
        updatedAt: now,
      } as any);

      const result = await service.cancelAppointment(
        'appt-123',
        userPayload as any,
      );

      expect(result).toMatchObject({
        id: 'appt-123',
        status: AppointmentStatus.cancelled,
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
