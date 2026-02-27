import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStaffNoteDto, UpdateStaffNoteDto } from './dto';

@Injectable()
export class StaffNotesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new staff note about a user
   */
  async create(staffId: string, createDto: CreateStaffNoteDto) {
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: createDto.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.staffNote.create({
      data: {
        staffId,
        userId: createDto.userId,
        content: createDto.content,
      },
      include: {
        staff: {
          select: { id: true, fullName: true, email: true },
        },
        user: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }

  /**
   * Get all notes for a specific user (visible to all staff)
   */
  async findByUserId(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [notes, total] = await Promise.all([
      this.prisma.staffNote.findMany({
        where: { userId },
        include: {
          staff: {
            select: { id: true, fullName: true, email: true },
          },
          user: {
            select: { id: true, fullName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.staffNote.count({ where: { userId } }),
    ]);

    return {
      items: notes,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single note by ID
   */
  async findOne(id: string) {
    const note = await this.prisma.staffNote.findUnique({
      where: { id },
      include: {
        staff: {
          select: { id: true, fullName: true, email: true },
        },
        user: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    if (!note) {
      throw new NotFoundException('Staff note not found');
    }

    return note;
  }

  /**
   * Update a staff note (only the staff who created it can update)
   */
  async update(id: string, staffId: string, updateDto: UpdateStaffNoteDto) {
    const note = await this.prisma.staffNote.findUnique({
      where: { id },
    });

    if (!note) {
      throw new NotFoundException('Staff note not found');
    }

    if (note.staffId !== staffId) {
      throw new ForbiddenException('You can only update your own notes');
    }

    return this.prisma.staffNote.update({
      where: { id },
      data: { content: updateDto.content },
      include: {
        staff: {
          select: { id: true, fullName: true, email: true },
        },
        user: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }

  /**
   * Delete a staff note (only the creator or admin can delete)
   */
  async remove(id: string, staffId: string, isAdmin = false) {
    const note = await this.prisma.staffNote.findUnique({
      where: { id },
    });

    if (!note) {
      throw new NotFoundException('Staff note not found');
    }

    if (!isAdmin && note.staffId !== staffId) {
      throw new ForbiddenException('You can only delete your own notes');
    }

    await this.prisma.staffNote.delete({ where: { id } });

    return { message: 'Staff note deleted successfully' };
  }
}
