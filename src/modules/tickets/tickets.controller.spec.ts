import { Test, TestingModule } from '@nestjs/testing';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import {
  mockTicket,
  mockUserJwtPayload,
  mockStaffJwtPayload,
} from '../../test-utils';
import { CreateTicketDto, UpdateTicketDto } from './dto';
import { TicketStatus, Priority } from '@prisma/client';

describe('TicketsController', () => {
  let controller: TicketsController;
  let ticketsService: TicketsService;

  const mockTicketsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    assign: jest.fn(),
    resolve: jest.fn(),
    close: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [
        {
          provide: TicketsService,
          useValue: mockTicketsService,
        },
      ],
    }).compile();

    controller = module.get<TicketsController>(TicketsController);
    ticketsService = module.get<TicketsService>(TicketsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all tickets for user', async () => {
      const currentUser = mockUserJwtPayload();
      const tickets = [mockTicket({ userId: currentUser.sub })];
      mockTicketsService.findAll.mockResolvedValue(tickets);

      const result = await controller.findAll(currentUser);

      expect(result).toEqual(tickets);
      expect(ticketsService.findAll).toHaveBeenCalledWith(
        currentUser,
        undefined,
      );
    });

    it('should filter tickets by status', async () => {
      const currentUser = mockUserJwtPayload();
      const tickets = [mockTicket({ status: TicketStatus.open })];
      mockTicketsService.findAll.mockResolvedValue(tickets);

      const result = await controller.findAll(currentUser, TicketStatus.open);

      expect(result).toEqual(tickets);
      expect(ticketsService.findAll).toHaveBeenCalledWith(
        currentUser,
        TicketStatus.open,
      );
    });
  });

  describe('findOne', () => {
    it('should return ticket by ID', async () => {
      const ticket = mockTicket();
      mockTicketsService.findOne.mockResolvedValue(ticket);

      const result = await controller.findOne(ticket.id);

      expect(result).toEqual(ticket);
      expect(ticketsService.findOne).toHaveBeenCalledWith(ticket.id);
    });
  });

  describe('create', () => {
    const createDto: CreateTicketDto = {
      subject: 'Billing Issue',
      description: 'Problem with invoice',
      category: 'billing' as any,
      priority: 'medium' as any,
    };

    it('should create new ticket', async () => {
      const currentUser = mockUserJwtPayload();
      const createdTicket = mockTicket(createDto);
      mockTicketsService.create.mockResolvedValue(createdTicket);

      const result = await controller.create(createDto, currentUser);

      expect(result).toEqual(createdTicket);
      expect(ticketsService.create).toHaveBeenCalledWith(
        createDto,
        currentUser,
      );
    });
  });

  describe('update', () => {
    const updateDto: UpdateTicketDto = {
      status: TicketStatus.in_progress,
      priority: 'high' as any,
    };

    it('should update ticket', async () => {
      const ticket = mockTicket();
      const updatedTicket = { ...ticket, ...updateDto };
      mockTicketsService.update.mockResolvedValue(updatedTicket);

      const result = await controller.update(ticket.id, updateDto);

      expect(result).toEqual(updatedTicket);
      expect(ticketsService.update).toHaveBeenCalledWith(ticket.id, updateDto);
    });
  });

  describe('assign', () => {
    it('should assign ticket to staff', async () => {
      const ticket = mockTicket();
      const assignedTicket = { ...ticket, assignedToStaffId: 'staff-123' };
      mockTicketsService.assign.mockResolvedValue(assignedTicket);

      const result = await controller.assign(ticket.id, {
        staffId: 'staff-123',
      });

      expect(result).toEqual(assignedTicket);
      expect(ticketsService.assign).toHaveBeenCalledWith(
        ticket.id,
        'staff-123',
      );
    });
  });

  describe('resolve', () => {
    it('should resolve ticket', async () => {
      const ticket = mockTicket();
      const resolvedTicket = { ...ticket, status: TicketStatus.resolved };
      const resolveDto = { resolutionNotes: 'Issue resolved' };
      mockTicketsService.resolve.mockResolvedValue(resolvedTicket);

      const result = await controller.resolve(ticket.id, resolveDto);

      expect(result).toEqual(resolvedTicket);
      expect(ticketsService.resolve).toHaveBeenCalledWith(
        ticket.id,
        resolveDto.resolutionNotes,
      );
    });
  });

  describe('close', () => {
    it('should close ticket', async () => {
      const ticket = mockTicket();
      const closedTicket = { ...ticket, status: TicketStatus.closed };
      mockTicketsService.close.mockResolvedValue(closedTicket);

      const result = await controller.close(ticket.id);

      expect(result).toEqual(closedTicket);
      expect(ticketsService.close).toHaveBeenCalledWith(ticket.id);
    });
  });
});
