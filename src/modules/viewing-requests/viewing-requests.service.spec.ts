import { Test, TestingModule } from '@nestjs/testing';
import { ViewingRequestsService } from './viewing-requests.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, mockStaffJwtPayload } from '../../test-utils';
import { CreateViewingRequestDto, CreateAppointmentDto } from './dto';
import { ContactRequestStatus, AppointmentStatus, PreferredContactMethod, ContactSource } from '@prisma/client';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('ViewingRequestsService', () => {
  let service: ViewingRequestsService;
  let prisma: ReturnType<typeof createPrismaMock>;

  const mockContactRequest = (overrides = {}) => ({
    id: 'contact-123',
    fullName: 'John Doe',
    phone: '+84909123456',
    email: 'john@example.com',
    preferredContactMethod: PreferredContactMethod.phone,
    apartmentId: 'apt-123',
    message: 'I want to view this apartment',
    source: ContactSource.website,
    status: ContactRequestStatus.new,
    assignedToStaffId: 'staff-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const mockAppointment = (overrides = {}) => ({
    id: 'appt-123',
    contactRequestId: 'contact-123',
    apartmentId: 'apt-123',
    staffId: 'staff-123',
    appointmentTime: new Date('2026-02-15T10:00:00'),
    durationMinutes: 60,
    status: AppointmentStatus.scheduled,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ViewingRequestsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<ViewingRequestsService>(ViewingRequestsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateViewingRequestDto = {
      fullName: 'John Doe',
      phone: '+84909123456',
      email: 'john@example.com',
      preferredContactMethod: PreferredContactMethod.phone as any,
      apartmentId: 'apt-123',
      message: 'Interested in viewing',
    };

    it('should create viewing request and assign matching staff', async () => {
      const apartment = {
        id: 'apt-123',
        city: 'Hồ Chí Minh',
        district: 'Quận 1',
        buildingName: 'Building A',
      };
      const staff = { id: 'staff-123', workingDistrict: 'Quận 1', workingCity: 'Hồ Chí Minh' };
      const created = mockContactRequest();

      prisma.apartment.findUnique.mockResolvedValue(apartment as any);
      prisma.staff.findFirst.mockResolvedValue(staff as any);
      prisma.contactRequest.create.mockResolvedValue(created as any);

      const result = await service.create(createDto);

      expect(result).toEqual(created);
      expect(prisma.contactRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fullName: createDto.fullName,
          apartmentId: createDto.apartmentId,
          assignedToStaffId: staff.id,
        }),
      });
    });

    it('should throw NotFoundException if apartment not found', async () => {
      prisma.apartment.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should assign any staff if no matching staff found', async () => {
      const apartment = { id: 'apt-123', city: 'Hà Nội', district: 'Ba Đình' };
      const anyStaff = { id: 'staff-999', workingDistrict: 'Quận 1', workingCity: 'Hồ Chí Minh' };

      prisma.apartment.findUnique.mockResolvedValue(apartment as any);
      prisma.staff.findFirst
        .mockResolvedValueOnce(null) // No exact match
        .mockResolvedValueOnce(null) // No city match
        .mockResolvedValueOnce(anyStaff as any); // Any staff

      prisma.contactRequest.create.mockResolvedValue(mockContactRequest() as any);

      await service.create(createDto);

      expect(prisma.staff.findFirst).toHaveBeenCalledTimes(3);
    });
  });

  describe('getMyAssigned', () => {
    it('should return requests assigned to staff', async () => {
      const staff = mockStaffJwtPayload();
      const requests = [mockContactRequest({ assignedToStaffId: staff.sub })];

      prisma.contactRequest.findMany.mockResolvedValue(requests as any);

      const result = await service.getMyAssigned(staff);

      expect(result).toEqual(requests);
      expect(prisma.contactRequest.findMany).toHaveBeenCalledWith({
        where: { assignedToStaffId: staff.sub },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('createAppointment', () => {
    const createDto: CreateAppointmentDto = {
      appointmentTime: '2026-02-15T10:00:00Z',
      durationMinutes: 60,
      notes: 'Bring ID',
    };

    it('should create appointment if slot available', async () => {
      const staff = mockStaffJwtPayload();
      const contactRequest = mockContactRequest({ apartmentId: 'apt-123' });
      const apartment = {
        id: 'apt-123',
        buildingName: 'Building A',
        apartmentType: 'Type A',
        maxViewingSlots: 3,
      };
      const appointment = mockAppointment();

      prisma.contactRequest.findUnique.mockResolvedValue(contactRequest as any);
      prisma.apartment.findUnique.mockResolvedValue(apartment as any);
      prisma.appointment.count.mockResolvedValue(2); // 2 existing, max is 3
      prisma.appointment.create.mockResolvedValue(appointment as any);
      prisma.contactRequest.update.mockResolvedValue({
        ...contactRequest,
        status: ContactRequestStatus.scheduled,
      } as any);

      const result = await service.createAppointment('contact-123', createDto, staff);

      expect(result).toEqual(appointment);
      expect(prisma.appointment.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if slot full', async () => {
      const staff = mockStaffJwtPayload();
      const contactRequest = mockContactRequest({ apartmentId: 'apt-123' });
      const apartment = {
        id: 'apt-123',
        buildingName: 'Building A',
        apartmentType: 'Type A',
        maxViewingSlots: 3,
      };

      prisma.contactRequest.findUnique.mockResolvedValue(contactRequest as any);
      prisma.apartment.findUnique.mockResolvedValue(apartment as any);
      prisma.appointment.count.mockResolvedValue(3); // Already full

      await expect(service.createAppointment('contact-123', createDto, staff)).rejects.toThrow(
        ConflictException
      );
    });

    it('should throw BadRequestException if already scheduled', async () => {
      const staff = mockStaffJwtPayload();
      const contactRequest = mockContactRequest({
        status: ContactRequestStatus.scheduled,
      });

      prisma.contactRequest.findUnique.mockResolvedValue(contactRequest as any);

      await expect(service.createAppointment('contact-123', createDto, staff)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw NotFoundException if contact request not found', async () => {
      const staff = mockStaffJwtPayload();
      prisma.contactRequest.findUnique.mockResolvedValue(null);

      await expect(service.createAppointment('non-existent', createDto, staff)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('getApartmentAppointments', () => {
    it('should return appointments for apartment on date', async () => {
      const appointments = [mockAppointment(), mockAppointment({ id: 'appt-124' })];
      prisma.appointment.findMany.mockResolvedValue(appointments as any);

      const result = await service.getApartmentAppointments('apt-123', '2026-02-15');

      expect(result).toEqual(appointments);
      expect(prisma.appointment.findMany).toHaveBeenCalledWith({
        where: {
          apartmentId: 'apt-123',
          appointmentTime: {
            gte: expect.any(Date),
            lt: expect.any(Date),
          },
        },
        include: expect.any(Object),
        orderBy: { appointmentTime: 'asc' },
      });
    });
  });

  describe('findBestMatchingStaff', () => {
    it('should find staff with exact district match', async () => {
      const staff = { id: 'staff-123', workingDistrict: 'Quận 1', workingCity: 'Hồ Chí Minh' };
      prisma.staff.findFirst.mockResolvedValue(staff as any);

      const result = await service.findBestMatchingStaff('Hồ Chí Minh', 'Quận 1');

      expect(result).toEqual(staff);
      expect(prisma.staff.findFirst).toHaveBeenCalledWith({
        where: {
          isActive: true,
          workingCity: 'Hồ Chí Minh',
          workingDistrict: 'Quận 1',
        },
        select: expect.any(Object),
      });
    });

    it('should fall back to city match if no district match', async () => {
      const cityStaff = { id: 'staff-124', workingDistrict: 'Quận 2', workingCity: 'Hồ Chí Minh' };
      prisma.staff.findFirst
        .mockResolvedValueOnce(null) // No exact match
        .mockResolvedValueOnce(cityStaff as any); // City match

      const result = await service.findBestMatchingStaff('Hồ Chí Minh', 'Quận 3');

      expect(result).toEqual(cityStaff);
    });

    it('should fall back to any active staff', async () => {
      const anyStaff = { id: 'staff-125', workingDistrict: 'Ba Đình', workingCity: 'Hà Nội' };
      prisma.staff.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(anyStaff as any);

      const result = await service.findBestMatchingStaff('Đà Nẵng', 'Hải Châu');

      expect(result).toEqual(anyStaff);
    });

    it('should return null if no staff available', async () => {
      prisma.staff.findFirst.mockResolvedValue(null);

      const result = await service.findBestMatchingStaff('Hồ Chí Minh', 'Quận 1');

      expect(result).toBeNull();
    });
  });

  describe('checkSlotAvailability', () => {
    it('should return true if slots available', async () => {
      prisma.appointment.count.mockResolvedValue(2);

      const result = await service.checkSlotAvailability(
        'apt-123',
        'Building A',
        'Type A',
        new Date('2026-02-15T10:00:00'),
        60,
        3
      );

      expect(result).toBe(true);
    });

    it('should return false if slots full', async () => {
      prisma.appointment.count.mockResolvedValue(3);

      const result = await service.checkSlotAvailability(
        'apt-123',
        'Building A',
        'Type A',
        new Date('2026-02-15T10:00:00'),
        60,
        3
      );

      expect(result).toBe(false);
    });

    it('should check overlapping time slots', async () => {
      prisma.appointment.count.mockResolvedValue(1);

      await service.checkSlotAvailability(
        'apt-123',
        'Building A',
        'Type A',
        new Date('2026-02-15T10:00:00'),
        60,
        3
      );

      expect(prisma.appointment.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          appointmentTime: {
            gte: expect.any(Date),
            lt: expect.any(Date),
          },
        }),
      });
    });
  });
});
