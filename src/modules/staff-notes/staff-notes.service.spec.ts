import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { StaffNotesService } from './staff-notes.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('StaffNotesService', () => {
  let service: StaffNotesService;

  const mockStaffNote = {
    id: 'note-id-1',
    staffId: 'staff-id-1',
    userId: 'user-id-1',
    content: 'Customer called about lease renewal',
    createdAt: new Date('2026-02-27T10:00:00Z'),
    updatedAt: new Date('2026-02-27T10:00:00Z'),
    staff: { id: 'staff-id-1', fullName: 'Staff A', email: 'staff@example.com' },
    user: { id: 'user-id-1', fullName: 'User B', email: 'user@example.com' },
  };

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
    staffNote: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffNotesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<StaffNotesService>(StaffNotesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ==========================================================================
  // Create
  // ==========================================================================
  describe('create', () => {
    it('should create a staff note', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'user-id-1' });
      mockPrisma.staffNote.create.mockResolvedValueOnce(mockStaffNote);

      const result = await service.create('staff-id-1', {
        userId: 'user-id-1',
        content: 'Customer called about lease renewal',
      });

      expect(result.id).toBe('note-id-1');
      expect(result.content).toBe('Customer called about lease renewal');
      expect(result.staff.id).toBe('staff-id-1');
      expect(result.user.id).toBe('user-id-1');
      expect(mockPrisma.staffNote.create).toHaveBeenCalledWith({
        data: {
          staffId: 'staff-id-1',
          userId: 'user-id-1',
          content: 'Customer called about lease renewal',
        },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.create('staff-id-1', {
          userId: 'nonexistent-user',
          content: 'Some note',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================================================================
  // Find By User ID
  // ==========================================================================
  describe('findByUserId', () => {
    it('should return paginated notes for a user', async () => {
      mockPrisma.staffNote.findMany.mockResolvedValueOnce([mockStaffNote]);
      mockPrisma.staffNote.count.mockResolvedValueOnce(1);

      const result = await service.findByUserId('user-id-1', 1, 20);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should handle pagination correctly', async () => {
      mockPrisma.staffNote.findMany.mockResolvedValueOnce([]);
      mockPrisma.staffNote.count.mockResolvedValueOnce(25);

      const result = await service.findByUserId('user-id-1', 2, 10);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(25);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(3);

      expect(mockPrisma.staffNote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should return empty when no notes exist', async () => {
      mockPrisma.staffNote.findMany.mockResolvedValueOnce([]);
      mockPrisma.staffNote.count.mockResolvedValueOnce(0);

      const result = await service.findByUserId('user-id-1');

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  // ==========================================================================
  // Find One
  // ==========================================================================
  describe('findOne', () => {
    it('should return a note by id', async () => {
      mockPrisma.staffNote.findUnique.mockResolvedValueOnce(mockStaffNote);

      const result = await service.findOne('note-id-1');

      expect(result.id).toBe('note-id-1');
      expect(result.content).toBe('Customer called about lease renewal');
    });

    it('should throw NotFoundException if note not found', async () => {
      mockPrisma.staffNote.findUnique.mockResolvedValueOnce(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==========================================================================
  // Update
  // ==========================================================================
  describe('update', () => {
    it('should update a note by the creator', async () => {
      mockPrisma.staffNote.findUnique.mockResolvedValueOnce({
        id: 'note-id-1',
        staffId: 'staff-id-1',
      });
      const updatedNote = { ...mockStaffNote, content: 'Updated content' };
      mockPrisma.staffNote.update.mockResolvedValueOnce(updatedNote);

      const result = await service.update('note-id-1', 'staff-id-1', {
        content: 'Updated content',
      });

      expect(result.content).toBe('Updated content');
      expect(mockPrisma.staffNote.update).toHaveBeenCalledWith({
        where: { id: 'note-id-1' },
        data: { content: 'Updated content' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if note not found', async () => {
      mockPrisma.staffNote.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.update('nonexistent', 'staff-id-1', {
          content: 'Updated',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if not the creator', async () => {
      mockPrisma.staffNote.findUnique.mockResolvedValueOnce({
        id: 'note-id-1',
        staffId: 'staff-id-1',
      });

      await expect(
        service.update('note-id-1', 'different-staff-id', {
          content: 'Updated',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ==========================================================================
  // Remove
  // ==========================================================================
  describe('remove', () => {
    it('should delete a note by the creator', async () => {
      mockPrisma.staffNote.findUnique.mockResolvedValueOnce({
        id: 'note-id-1',
        staffId: 'staff-id-1',
      });
      mockPrisma.staffNote.delete.mockResolvedValueOnce({});

      const result = await service.remove('note-id-1', 'staff-id-1');

      expect(result.message).toContain('deleted');
      expect(mockPrisma.staffNote.delete).toHaveBeenCalledWith({
        where: { id: 'note-id-1' },
      });
    });

    it('should allow admin to delete any note', async () => {
      mockPrisma.staffNote.findUnique.mockResolvedValueOnce({
        id: 'note-id-1',
        staffId: 'staff-id-1',
      });
      mockPrisma.staffNote.delete.mockResolvedValueOnce({});

      const result = await service.remove(
        'note-id-1',
        'different-staff-id',
        true,
      );

      expect(result.message).toContain('deleted');
    });

    it('should throw NotFoundException if note not found', async () => {
      mockPrisma.staffNote.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.remove('nonexistent', 'staff-id-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if not creator and not admin', async () => {
      mockPrisma.staffNote.findUnique.mockResolvedValueOnce({
        id: 'note-id-1',
        staffId: 'staff-id-1',
      });

      await expect(
        service.remove('note-id-1', 'different-staff-id', false),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
