import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock, mockTicket, mockUserJwtPayload, mockStaffJwtPayload, mockRentalContract, MockPrisma } from '../../test-utils';
import { CreateTicketDto, UpdateTicketDto } from './dto';
import { TicketStatus, Priority, ActorType } from '@prisma/client';

describe('TicketsService', () => {
  let service: TicketsService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all tickets for admin', async () => {
      const tickets = [mockTicket(), mockTicket({ id: 'ticket-2' })];
      const adminUser = mockUserJwtPayload({ actorType: ActorType.admin });
      prisma.ticket.findMany.mockResolvedValue(tickets);

      const result = await service.findAll(adminUser);

      expect(result).toEqual(tickets);
    });

    it('should filter tickets for user (only own tickets)', async () => {
      const userJwt = mockUserJwtPayload();
      const tickets = [mockTicket({ userId: userJwt.sub })];
      prisma.ticket.findMany.mockResolvedValue(tickets);

      await service.findAll(userJwt);

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ userId: userJwt.sub }),
      }));
    });

    it('should filter tickets for staff (only assigned tickets)', async () => {
      const staffUser = mockStaffJwtPayload();
      const tickets = [mockTicket({ assignedToStaffId: staffUser.sub })];
      prisma.ticket.findMany.mockResolvedValue(tickets);

      await service.findAll(staffUser);

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ assignedToStaffId: staffUser.sub }),
      }));
    });

    it('should filter tickets by status', async () => {
      const adminUser = mockUserJwtPayload({ actorType: ActorType.admin });
      const tickets = [mockTicket({ status: TicketStatus.open })];
      prisma.ticket.findMany.mockResolvedValue(tickets);

      await service.findAll(adminUser, TicketStatus.open);

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ status: TicketStatus.open }),
      }));
    });
  });

  describe('findOne', () => {
    it('should return ticket with relations', async () => {
      const ticket = mockTicket();
      prisma.ticket.findUnique.mockResolvedValue(ticket);

      const result = await service.findOne(ticket.id);

      expect(result).toEqual(ticket);
      expect(prisma.ticket.findUnique).toHaveBeenCalledWith({
        where: { id: ticket.id },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if ticket not found', async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const createDto: CreateTicketDto = {
      subject: 'Billing Issue',
      description: 'Problem with invoice',
      category: 'billing' as any,
      priority: 'medium' as any,
      rentalContractId: 'contract-123',
    };

    it('should create ticket with provided contract ID', async () => {
      const userJwt = mockUserJwtPayload();
      const createdTicket = mockTicket(createDto);
      prisma.ticket.count.mockResolvedValue(0);
      prisma.ticket.create.mockResolvedValue(createdTicket);

      const result = await service.create(createDto, userJwt);

      expect(result).toEqual(createdTicket);
      expect(prisma.ticket.create).toHaveBeenCalled();
    });

    it('should auto-find contract for user if not provided', async () => {
      const userJwt = mockUserJwtPayload();
      const createDtoWithoutContract = { ...createDto, rentalContractId: undefined };
      const activeContract = mockRentalContract();
      prisma.rentalContract.findFirst.mockResolvedValue(activeContract);
      prisma.ticket.count.mockResolvedValue(0);
      prisma.ticket.create.mockResolvedValue(mockTicket({ rentalContractId: activeContract.id }));

      await service.create(createDtoWithoutContract, userJwt);

      expect(prisma.rentalContract.findFirst).toHaveBeenCalledWith({
        where: {
          members: { some: { userId: userJwt.sub } },
          status: 'active',
        },
      });
    });

    it('should throw BadRequestException if no active contract found', async () => {
      const userJwt = mockUserJwtPayload();
      const createDtoWithoutContract = { ...createDto, rentalContractId: undefined };
      prisma.rentalContract.findFirst.mockResolvedValue(null);

      await expect(service.create(createDtoWithoutContract, userJwt)).rejects.toThrow(BadRequestException);
      await expect(service.create(createDtoWithoutContract, userJwt)).rejects.toThrow('No active contract found');
    });

    it('should generate unique ticket number', async () => {
      const userJwt = mockUserJwtPayload();
      prisma.ticket.count.mockResolvedValue(5);
      prisma.ticket.create.mockResolvedValue(mockTicket({ ticketNumber: 'TKT-2026-00006' }));

      await service.create(createDto, userJwt);

      expect(prisma.ticket.count).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const updateDto: UpdateTicketDto = {
      status: TicketStatus.in_progress,
      priority: 'high' as any,
    };

    it('should update ticket successfully', async () => {
      const ticket = mockTicket();
      const updatedTicket = { ...ticket, ...updateDto };
      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticket.update.mockResolvedValue(updatedTicket);

      const result = await service.update(ticket.id, updateDto);

      expect(result).toEqual(updatedTicket);
    });

    it('should throw NotFoundException if ticket not found', async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should set resolvedAt when status is resolved', async () => {
      const ticket = mockTicket();
      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticket.update.mockResolvedValue({ ...ticket, status: TicketStatus.resolved, resolvedAt: new Date() });

      await service.update(ticket.id, { status: TicketStatus.resolved });

      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ resolvedAt: expect.any(Date) }),
        })
      );
    });

    it('should set closedAt when status is closed', async () => {
      const ticket = mockTicket();
      prisma.ticket.findUnique.mockResolvedValue(ticket);
      prisma.ticket.update.mockResolvedValue({ ...ticket, status: TicketStatus.closed, closedAt: new Date() });

      await service.update(ticket.id, { status: TicketStatus.closed });

      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ closedAt: expect.any(Date) }),
        })
      );
    });
  });

  describe('assign', () => {
    it('should assign ticket to staff', async () => {
      const ticket = mockTicket();
      const assignedTicket = { ...ticket, assignedToStaffId: 'staff-123', status: TicketStatus.in_progress };
      prisma.ticket.update.mockResolvedValue(assignedTicket);

      const result = await service.assign(ticket.id, 'staff-123');

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: ticket.id },
        data: {
          assignedToStaff: { connect: { id: 'staff-123' } },
          status: TicketStatus.in_progress,
        },
      });
    });
  });

  describe('resolve', () => {
    it('should resolve ticket with notes', async () => {
      const ticket = mockTicket();
      const resolutionNotes = 'Issue resolved';
      const resolvedTicket = {
        ...ticket,
        status: TicketStatus.resolved,
        resolutionNotes,
        resolvedAt: new Date(),
      };
      prisma.ticket.update.mockResolvedValue(resolvedTicket);

      const result = await service.resolve(ticket.id, resolutionNotes);

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: ticket.id },
        data: {
          status: TicketStatus.resolved,
          resolutionNotes,
          resolvedAt: expect.any(Date),
        },
      });
    });
  });

  describe('close', () => {
    it('should close ticket', async () => {
      const ticket = mockTicket();
      const closedTicket = { ...ticket, status: TicketStatus.closed, closedAt: new Date() };
      prisma.ticket.update.mockResolvedValue(closedTicket);

      const result = await service.close(ticket.id);

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: ticket.id },
        data: {
          status: TicketStatus.closed,
          closedAt: expect.any(Date),
        },
      });
    });
  });

  describe('generateTicketNumber', () => {
    it('should generate ticket number with year and counter', async () => {
      prisma.ticket.count.mockResolvedValue(42);

      const ticketNumber = await service['generateTicketNumber']();

      const year = new Date().getFullYear();
      expect(ticketNumber).toBe(`TKT-${year}-00043`);
    });

    it('should pad counter to 5 digits', async () => {
      prisma.ticket.count.mockResolvedValue(0);

      const ticketNumber = await service['generateTicketNumber']();

      expect(ticketNumber).toMatch(/TKT-\d{4}-00001/);
    });
  });
});
