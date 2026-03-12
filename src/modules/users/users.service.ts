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
import { CreateUserDto, UpdateUserDto, SearchUserDto } from './dto';
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
  async findAll(query: SearchUserDto) {
    const { search, page = 1, limit = 20 } = query;

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { fullName: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search } },
          ],
        }
      : {};

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          identity: {
            select: {
              id: true,
              nationalId: true,

              isVerified: true,
              verifiedAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
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
        identity: {
          select: {
            id: true,
            userId: true,
            nationalId: true,
            passportNumber: true,
            name: true,
            dob: true,
            sex: true,
            nationality: true,
            ethnicity: true,
            home: true,
            address: true,
            province: true,
            district: true,
            ward: true,
            street: true,
            features: true,
            issueDate: true,
            doe: true,
            isVerified: true,
            verifiedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
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
   * Update user's identity card by uploading front + back images
   * AI extracts info from both sides - images are NOT stored in DB
   */
  async updateIdentityCard(
    userId: string,
    identityCardFrontFile: any,
    identityCardBackFile: any,
  ) {
    // Validate file types
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validMimeTypes.includes(identityCardFrontFile.mimetype)) {
      throw new BadRequestException(
        `Invalid front image format. Allowed: JPEG, PNG, WebP. Received: ${identityCardFrontFile.mimetype}`,
      );
    }
    if (!validMimeTypes.includes(identityCardBackFile.mimetype)) {
      throw new BadRequestException(
        `Invalid back image format. Allowed: JPEG, PNG, WebP. Received: ${identityCardBackFile.mimetype}`,
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
    let frontResult = null;
    let backResult = null;

    // Call FPT AI for both sides in parallel
    const frontBase64 = identityCardFrontFile.buffer.toString('base64');
    const backBase64 = identityCardBackFile.buffer.toString('base64');

    try {
      this.logger.log(`Verifying ID card (front + back) for user: ${userId}`);
      [frontResult, backResult] = await Promise.all([
        this.fptAiService.verifyIdCardFromBase64(frontBase64),
        this.fptAiService.verifyIdCardFromBase64(backBase64),
      ]);

      if (this.fptAiService.isVerificationSuccessful(frontResult)) {
        autoVerified = true;
        this.logger.log(`Front ID card verified via AI for user: ${userId}`);
      } else {
        this.logger.warn(
          `Front ID card verification failed for user: ${userId}, Error: ${frontResult.errorMessage}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `FPT AI verification error for user ${userId}: ${error.message}`,
      );
    }

    // Merge extracted info from front and back
    const frontInfo = this.fptAiService.extractUserInfo(frontResult) || {};
    const backInfo = this.fptAiService.extractUserInfo(backResult) || {};
    const extractedInfo = { ...frontInfo, ...backInfo };

    // Prepare UserIdentity update data
    const identityUpdateData: any = {};

    if (Object.keys(extractedInfo).length > 0) {
      if (extractedInfo.id && !user.identity?.nationalId) {
        identityUpdateData.nationalId = extractedInfo.id;
      }
      if (extractedInfo.name && !user.identity?.name) {
        identityUpdateData.name = extractedInfo.name;
      }
      if (extractedInfo.dob && !user.identity?.dob) {
        identityUpdateData.dob = extractedInfo.dob;
      }
      if (extractedInfo.sex && !user.identity?.sex) {
        identityUpdateData.sex = extractedInfo.sex;
      }
      if (extractedInfo.nationality && !user.identity?.nationality) {
        identityUpdateData.nationality = extractedInfo.nationality;
      }
      if (extractedInfo.ethnicity && !user.identity?.ethnicity) {
        identityUpdateData.ethnicity = extractedInfo.ethnicity;
      }
      if (extractedInfo.home && !user.identity?.home) {
        identityUpdateData.home = extractedInfo.home;
      }
      if (extractedInfo.address && !user.identity?.address) {
        identityUpdateData.address = extractedInfo.address;
      }
      if (extractedInfo.features && !user.identity?.features) {
        identityUpdateData.features = extractedInfo.features;
      }
      if (extractedInfo.issueDate && !user.identity?.issueDate) {
        identityUpdateData.issueDate = extractedInfo.issueDate;
      }
      if (extractedInfo.doe && !user.identity?.doe) {
        identityUpdateData.doe = extractedInfo.doe;
      }
      if (extractedInfo.province && !user.identity?.province) {
        identityUpdateData.province = extractedInfo.province;
      }
      if (extractedInfo.district && !user.identity?.district) {
        identityUpdateData.district = extractedInfo.district;
      }
      if (extractedInfo.ward && !user.identity?.ward) {
        identityUpdateData.ward = extractedInfo.ward;
      }
      if (extractedInfo.street && !user.identity?.street) {
        identityUpdateData.street = extractedInfo.street;
      }

      this.logger.log(
        `Extracted ${Object.keys(extractedInfo).length} fields from ID card (front + back)`,
      );

      if (autoVerified) {
        identityUpdateData.isVerified = true;
        identityUpdateData.verifiedAt = new Date();
      }
    }

    // Create or update UserIdentity record
    await (this.prisma.userIdentity.upsert as any)({
      where: { userId },
      create: {
        userId,
        ...(identityUpdateData as any),
      } as any,
      update: identityUpdateData as any,
    });

    // Auto-verify user if AI confirms valid ID
    let updatedUser: any;
    if (
      autoVerified &&
      this.configService.get<boolean>('fptAi.autoVerifyOnSuccess')
    ) {
      updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: { isVerified: true },
        include: { identity: true },
      });
      this.logger.log(`User ${userId} auto-verified after ID card check`);
    } else {
      updatedUser = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { identity: true },
      });
      if (!updatedUser) {
        throw new NotFoundException('User not found');
      }
    }

    // Attach AI verification metadata to response
    return {
      ...updatedUser,
      aiVerification: {
        front: frontResult
          ? {
              success: this.fptAiService.isVerificationSuccessful(frontResult),
              extractedInfo: this.fptAiService.extractUserInfo(frontResult),
            }
          : null,
        back: backResult
          ? {
              success: this.fptAiService.isVerificationSuccessful(backResult),
              extractedInfo: this.fptAiService.extractUserInfo(backResult),
            }
          : null,
      },
    };
  }

  /**
   * Get current user's profile based on actorType
   */
  async getProfile(currentUser: JwtPayload) {
    const { sub, actorType } = currentUser;

    switch (actorType) {
      case 'staff': {
        const staff = await this.prisma.staff.findUnique({
          where: { id: sub },
        });
        if (!staff) throw new NotFoundException('Staff not found');
        return staff;
      }
      case 'operator': {
        const operator = await this.prisma.operator.findUnique({
          where: { id: sub },
        });
        if (!operator) throw new NotFoundException('Operator not found');
        return operator;
      }
      case 'admin': {
        const admin = await this.prisma.admin.findUnique({
          where: { id: sub },
        });
        if (!admin) throw new NotFoundException('Admin not found');
        return admin;
      }
      default:
        return this.findOne(sub, currentUser);
    }
  }
}
