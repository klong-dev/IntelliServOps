import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import type { JwtPayload } from '../auth/auth.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Find all users with optional search/filter
   * Only accessible by ADMIN, OPERATOR
   */
  async findAll(search?: string) {
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { fullName: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search } },
          ],
        }
      : {};

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        phone: true,
        fullName: true,
        dateOfBirth: true,
        profileImageUrl: true,
        identityCardFrontUrl: true,
        identityCardBackUrl: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find user by ID
   * USER can only view their own profile
   * STAFF, OPERATOR, ADMIN can view any
   */
  async findOne(id: string, currentUser: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        phone: true,
        fullName: true,
        dateOfBirth: true,
        nationalId: true,
        passportNumber: true,
        profileImageUrl: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        isActive: true,
        isVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        contractMemberships: {
          where: { status: 'active' },
          select: {
            id: true,
            memberType: true,
            moveInDate: true,
            sharePercentage: true,
            rentalContract: {
              select: {
                id: true,
                contractNumber: true,
                status: true,
                startDate: true,
                endDate: true,
                apartment: {
                  select: {
                    id: true,
                    address: true,
                    apartmentNumber: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check access: USER can only view their own profile
    const actorType = currentUser.actorType;
    if (actorType === 'user' && currentUser.sub !== id) {
      throw new ForbiddenException('You can only view your own profile');
    }

    return user;
  }

  /**
   * Create new user
   * Only STAFF (authorized) can create users
   */
  async create(createUserDto: CreateUserDto, createdByStaffId?: string) {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Check if nationalId is unique (if provided)
    if (createUserDto.nationalId) {
      const existingNationalId = await this.prisma.user.findUnique({
        where: { nationalId: createUserDto.nationalId },
      });

      if (existingNationalId) {
        throw new ConflictException('National ID already registered');
      }
    }

    // Hash password
    const passwordHash = await this.authService.hashPassword(
      createUserDto.password,
    );

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        phone: createUserDto.phone,
        fullName: createUserDto.fullName,
        passwordHash,
        dateOfBirth: createUserDto.dateOfBirth
          ? new Date(createUserDto.dateOfBirth)
          : undefined,
        nationalId: createUserDto.nationalId,
        passportNumber: createUserDto.passportNumber,
        profileImageUrl: createUserDto.profileImageUrl,
        emergencyContactName: createUserDto.emergencyContactName,
        emergencyContactPhone: createUserDto.emergencyContactPhone,
        createdByStaffId,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        fullName: true,
        dateOfBirth: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
      },
    });

    return user;
  }

  /**
   * Update user
   * USER can update their own profile (limited fields)
   * ADMIN, OPERATOR can update any user
   */
  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    currentUser: JwtPayload,
  ) {
    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    // Check access
    const actorType = currentUser.actorType;
    if (actorType === 'user' && currentUser.sub !== id) {
      throw new ForbiddenException('You can only update your own profile');
    }

    // Users cannot update isActive or isVerified
    if (actorType === 'user') {
      delete updateUserDto.isActive;
      delete updateUserDto.isVerified;
    }

    // Check email uniqueness if being updated
    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      const emailExists = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });
      if (emailExists) {
        throw new ConflictException('Email already in use');
      }
    }

    // Prepare update data
    const updateData: any = { ...updateUserDto };

    // Handle password update
    if (updateUserDto.password) {
      updateData.passwordHash = await this.authService.hashPassword(
        updateUserDto.password,
      );
      delete updateData.password;
    }

    // Handle date conversion
    if (updateUserDto.dateOfBirth) {
      updateData.dateOfBirth = new Date(updateUserDto.dateOfBirth);
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        phone: true,
        fullName: true,
        dateOfBirth: true,
        profileImageUrl: true,
        isActive: true,
        isVerified: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Soft delete user
   * Only ADMIN can delete users
   */
  async remove(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Soft delete - just mark as inactive
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });
  }

  /**
   * Verify user identity
   * Only STAFF, OPERATOR, ADMIN can verify users
   */
  async verifyUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isVerified) {
      throw new ConflictException('User is already verified');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { isVerified: true },
      select: {
        id: true,
        email: true,
        fullName: true,
        profileImageUrl: true,
        isVerified: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Update user's identity card (profileImageUrl)
   * User can only update their own profile image
   */
  async updateIdentityCard(
    userId: string,
    identityCardFrontUrl: string,
    identityCardBackUrl?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: { identityCardFrontUrl: string; identityCardBackUrl?: string } = {
      identityCardFrontUrl,
    };

    if (identityCardBackUrl) {
      updateData.identityCardBackUrl = identityCardBackUrl;
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        fullName: true,
        identityCardFrontUrl: true,
        identityCardBackUrl: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Get current user's profile
   */
  async getProfile(userId: string) {
    return this.findOne(userId, {
      sub: userId,
      actorType: 'user',
    } as JwtPayload);
  }
}
