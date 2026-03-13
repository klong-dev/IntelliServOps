import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserRoomDto, UpdateUserRoomDto } from './dto';
import { UserRoomStatus, Prisma } from '@prisma/client';

@Injectable()
export class UserRoomsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all user-room assignments, optionally filtered
   */
  async findAll(filters?: {
    userId?: string;
    roomId?: string;
    rentalContractId?: string;
    status?: UserRoomStatus;
  }) {
    const where: Prisma.UserRoomWhereInput = {};
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.roomId) where.roomId = filters.roomId;
    if (filters?.rentalContractId)
      where.rentalContractId = filters.rentalContractId;
    if (filters?.status) where.status = filters.status;

    return this.prisma.userRoom.findMany({
      where,
      select: {
        id: true,
        userId: true,
        roomId: true,
        rentalContractId: true,
        moveInDate: true,
        moveOutDate: true,
        isPrimary: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get user-room assignment by ID with full details
   */
  async findOne(id: string) {
    const userRoom = await this.prisma.userRoom.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        room: {
          select: {
            id: true,
            roomNumber: true,
            roomType: true,
            area: true,
            status: true,
          },
        },
        rentalContract: {
          select: { id: true, contractNumber: true, status: true },
        },
      },
    });

    if (!userRoom) {
      throw new NotFoundException('User-room assignment not found');
    }

    return userRoom;
  }

  /**
   * Get rooms assigned to a specific user
   */
  async findByUser(userId: string, status?: UserRoomStatus) {
    const where: Prisma.UserRoomWhereInput = { userId };
    if (status) where.status = status;

    return this.prisma.userRoom.findMany({
      where,
      include: {
        room: {
          select: {
            id: true,
            roomNumber: true,
            roomType: true,
            area: true,
            status: true,
            apartment: {
              select: {
                id: true,
                apartmentNumber: true,
                buildingName: true,
                newWardCode: true,
                oldWardCode: true,
              },
            },
          },
        },
        rentalContract: {
          select: { id: true, contractNumber: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get users assigned to a specific room
   */
  async findByRoom(roomId: string, status?: UserRoomStatus) {
    const where: Prisma.UserRoomWhereInput = { roomId };
    if (status) where.status = status;

    return this.prisma.userRoom.findMany({
      where,
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        rentalContract: {
          select: { id: true, contractNumber: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create a new user-room assignment
   * Validates that user, room, and contract exist and are consistent
   */
  async create(createDto: CreateUserRoomDto) {
    // Validate user exists
    const user = await this.prisma.user.findUnique({
      where: { id: createDto.userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    // Validate room exists and get apartment info
    const room = await this.prisma.room.findUnique({
      where: { id: createDto.roomId },
      select: { id: true, apartmentId: true, maxOccupancy: true },
    });
    if (!room) throw new NotFoundException('Room not found');

    // Validate rental contract exists and belongs to same apartment
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id: createDto.rentalContractId },
      select: { id: true, apartmentId: true, status: true },
    });
    if (!contract) throw new NotFoundException('Rental contract not found');

    if (contract.apartmentId !== room.apartmentId) {
      throw new BadRequestException(
        'Room does not belong to the apartment in the rental contract',
      );
    }

    // Check if contract is active
    if (contract.status !== 'active' && contract.status !== 'pending') {
      throw new BadRequestException(
        'Rental contract must be active or pending to assign rooms',
      );
    }

    // Check for existing active assignment
    const existing = await this.prisma.userRoom.findUnique({
      where: {
        userId_roomId_rentalContractId: {
          userId: createDto.userId,
          roomId: createDto.roomId,
          rentalContractId: createDto.rentalContractId,
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        'User is already assigned to this room for this contract',
      );
    }

    // Check room occupancy limit
    const activeAssignments = await this.prisma.userRoom.count({
      where: {
        roomId: createDto.roomId,
        status: UserRoomStatus.active,
      },
    });
    if (activeAssignments >= room.maxOccupancy) {
      throw new BadRequestException(
        `Room has reached maximum occupancy (${room.maxOccupancy})`,
      );
    }

    return this.prisma.userRoom.create({
      data: {
        user: { connect: { id: createDto.userId } },
        room: { connect: { id: createDto.roomId } },
        rentalContract: { connect: { id: createDto.rentalContractId } },
        moveInDate: createDto.moveInDate
          ? new Date(createDto.moveInDate)
          : undefined,
        moveOutDate: createDto.moveOutDate
          ? new Date(createDto.moveOutDate)
          : undefined,
        isPrimary: createDto.isPrimary ?? true,
        notes: createDto.notes,
      },
      select: {
        id: true,
        userId: true,
        roomId: true,
        rentalContractId: true,
        isPrimary: true,
        status: true,
        createdAt: true,
      },
    });
  }

  /**
   * Update a user-room assignment
   */
  async update(id: string, updateDto: UpdateUserRoomDto) {
    const userRoom = await this.prisma.userRoom.findUnique({
      where: { id },
    });
    if (!userRoom) {
      throw new NotFoundException('User-room assignment not found');
    }

    const data: Prisma.UserRoomUpdateInput = {
      isPrimary: updateDto.isPrimary,
      status: updateDto.status,
      notes: updateDto.notes,
      ...(updateDto.moveInDate && {
        moveInDate: new Date(updateDto.moveInDate),
      }),
      ...(updateDto.moveOutDate && {
        moveOutDate: new Date(updateDto.moveOutDate),
      }),
    };

    return this.prisma.userRoom.update({
      where: { id },
      data,
      select: {
        id: true,
        userId: true,
        roomId: true,
        rentalContractId: true,
        isPrimary: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Move out a user from a room (soft status change)
   */
  async moveOut(id: string) {
    const userRoom = await this.prisma.userRoom.findUnique({
      where: { id },
    });
    if (!userRoom) {
      throw new NotFoundException('User-room assignment not found');
    }

    if (userRoom.status === UserRoomStatus.moved_out) {
      throw new BadRequestException('User has already moved out of this room');
    }

    return this.prisma.userRoom.update({
      where: { id },
      data: {
        status: UserRoomStatus.moved_out,
        moveOutDate: new Date(),
      },
      select: {
        id: true,
        userId: true,
        roomId: true,
        status: true,
        moveOutDate: true,
      },
    });
  }

  /**
   * Delete a user-room assignment (hard delete)
   */
  async remove(id: string) {
    const userRoom = await this.prisma.userRoom.findUnique({
      where: { id },
    });
    if (!userRoom) {
      throw new NotFoundException('User-room assignment not found');
    }

    await this.prisma.userRoom.delete({ where: { id } });

    return { message: 'User-room assignment deleted successfully' };
  }
}
