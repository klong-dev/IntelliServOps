import type { Express } from 'express';
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { FptAiService } from '../../shared/services/fpt-ai.service';
import type { JwtPayload } from '../auth/auth.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly fptAiService: FptAiService,
    private readonly configService: ConfigService,
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
      include: {
        identity: true,
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
      include: {
        identity: true,
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
        profileImageUrl: createUserDto.profileImageUrl,
        emergencyContactName: createUserDto.emergencyContactName,
        emergencyContactPhone: createUserDto.emergencyContactPhone,
        createdByStaffId,
      },
      include: {
        identity: true,
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
   * Update user's identity card by uploading image files
   * Files are stored directly in database as binary data
   * AI extracts info from images and auto-verifies if valid
   */
  async updateIdentityCard(
    userId: string,
    identityCardFrontFile?: any,
    identityCardBackFile?: any,
  ) {
    // Validate front file is provided
    if (!identityCardFrontFile) {
      throw new BadRequestException('Front identity card image is required');
    }

    // Validate file types
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validMimeTypes.includes(identityCardFrontFile.mimetype)) {
      throw new BadRequestException(
        `Invalid front image format. Allowed formats: JPEG, PNG, WebP. Received: ${identityCardFrontFile.mimetype}`,
      );
    }

    if (identityCardBackFile && !validMimeTypes.includes(identityCardBackFile.mimetype)) {
      throw new BadRequestException(
        `Invalid back image format. Allowed formats: JPEG, PNG, WebP. Received: ${identityCardBackFile.mimetype}`,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { identity: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let autoVerified = false;
    let aiVerificationResult = null;

    // Convert file to base64 for AI verification
    const frontFileBase64 = identityCardFrontFile.buffer.toString('base64');

    // Call FPT AI to verify ID card using base64
    try {
      this.logger.log(`Verifying ID card for user: ${userId}`);
      const aiResponse = await this.fptAiService.verifyIdCardFromBase64(
        frontFileBase64,
      );

      aiVerificationResult = aiResponse;

      // If verification successful, auto-verify user
      if (this.fptAiService.isVerificationSuccessful(aiResponse)) {
        autoVerified = true;
        this.logger.log(`ID card verified via AI for user: ${userId}`);
      } else {
        this.logger.warn(
          `ID card verification failed for user: ${userId}, Error: ${aiResponse.errorMessage}`,
        );
      }
    } catch (error) {
      // Log error but don't fail the update
      this.logger.error(
        `FPT AI verification error for user ${userId}: ${error.message}`,
      );
      // Continue with update even if AI verification fails
    }

    // Prepare UserIdentity update data with binary file data
    const identityUpdateData: any = {
      identityCardFrontData: identityCardFrontFile.buffer,
    };

    if (identityCardBackFile) {
      identityUpdateData.identityCardBackData = identityCardBackFile.buffer;
    }

    // Extract and save user information from AI response to UserIdentity
    if (aiVerificationResult && this.fptAiService.isVerificationSuccessful(aiVerificationResult)) {
      const extractedInfo = this.fptAiService.extractUserInfo(aiVerificationResult);

      if (extractedInfo) {
        // Map AI field names to UserIdentity field names
        if (extractedInfo.id && !user.identity?.nationalId) {
          identityUpdateData.nationalId = extractedInfo.id;
          this.logger.debug(`Applied nationalId: ${extractedInfo.id}`);
        }

        if (extractedInfo.sex && !user.identity?.sex) {
          identityUpdateData.sex = extractedInfo.sex;
          this.logger.debug(`Applied sex: ${extractedInfo.sex}`);
        }

        if (extractedInfo.nationality && !user.identity?.nationality) {
          identityUpdateData.nationality = extractedInfo.nationality;
          this.logger.debug(`Applied nationality: ${extractedInfo.nationality}`);
        }

        if (extractedInfo.home && !user.identity?.home) {
          identityUpdateData.home = extractedInfo.home;
          this.logger.debug(`Applied home: ${extractedInfo.home}`);
        }

        if (extractedInfo.address && !user.identity?.address) {
          identityUpdateData.address = extractedInfo.address;
          this.logger.debug(`Applied address: ${extractedInfo.address}`);
        }

        // Save address entities to UserIdentity
        if (extractedInfo.province && !user.identity?.province) {
          identityUpdateData.province = extractedInfo.province;
          this.logger.debug(`Applied province: ${extractedInfo.province}`);
        }
        if (extractedInfo.district && !user.identity?.district) {
          identityUpdateData.district = extractedInfo.district;
          this.logger.debug(`Applied district: ${extractedInfo.district}`);
        }
        if (extractedInfo.ward && !user.identity?.ward) {
          identityUpdateData.ward = extractedInfo.ward;
          this.logger.debug(`Applied ward: ${extractedInfo.ward}`);
        }
        if (extractedInfo.street && !user.identity?.street) {
          identityUpdateData.street = extractedInfo.street;
          this.logger.debug(`Applied street: ${extractedInfo.street}`);
        }

        this.logger.log(`Extracted ${Object.keys(extractedInfo).length} fields from ID card`);

        // Mark as verified if AI succeeded
        if (autoVerified) {
          identityUpdateData.isVerified = true;
          identityUpdateData.verifiedAt = new Date();
          this.logger.log(`Identity card verified at ${identityUpdateData.verifiedAt}`);
        }
      }
    }

    // Create or update UserIdentity record with binary file data
    // Using raw SQL due to Prisma client generation issue on Windows
    const identity = await (this.prisma.userIdentity.upsert as any)({
      where: { userId },
      create: {
        userId,
        ...(identityUpdateData as any),
      } as any,
      update: identityUpdateData as any,
    });

    // Auto-verify user if AI confirms valid ID
    let updatedUser: any;
    if (autoVerified && this.configService.get<boolean>('fptAi.autoVerifyOnSuccess')) {
      updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: { isVerified: true },
        include: { identity: true },
      });
      this.logger.log(`User ${userId} auto-verified after ID card check`);
    } else {
      // Refresh user data with identity
      updatedUser = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { identity: true },
      });
      if (!updatedUser) {
        throw new NotFoundException('User not found');
      }
    }

    // Don't return binary data in response - it's too large
    if (updatedUser.identity?.identityCardFrontData) {
      delete updatedUser.identity.identityCardFrontData;
    }
    if (updatedUser.identity?.identityCardBackData) {
      delete updatedUser.identity.identityCardBackData;
    }

    // Attach AI verification metadata to response if available
    return {
      ...updatedUser,
      aiVerification: aiVerificationResult
        ? {
            success: this.fptAiService.isVerificationSuccessful(aiVerificationResult),
            extractedId: this.fptAiService.extractIdNumber(aiVerificationResult),
            extractedInfo: this.fptAiService.extractUserInfo(aiVerificationResult),
          }
        : null,
    };
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
