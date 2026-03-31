/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PartnerRequestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { FptAiService } from '../../shared/services/fpt-ai.service';
import type { JwtPayload } from '../auth/auth.service';
import {
  CreateUserDto,
  UpdateUserDto,
  SearchUserDto,
  SearchUserByNationalIdDto,
  CreatePartnerRequestDto,
  UpdatePartnerRequestDto,
  ReviewPartnerRequestDto,
} from './dto';

export type UpdateIdentityCardResult = Prisma.UserGetPayload<{
  include: { identity: true };
}> & {
  aiVerification: {
    front: { success: boolean; extractedInfo: unknown } | null;
    back: { success: boolean; extractedInfo: unknown } | null;
  };
};

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

  async searchByNationalId(query: SearchUserByNationalIdDto) {
    const nationalId = query.nationalId.trim();

    const user = await this.prisma.user.findFirst({
      where: {
        identity: {
          nationalId,
        },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        isActive: true,
        isVerified: true,
        identity: {
          select: {
            nationalId: true,
            isVerified: true,
            verifiedAt: true,
          },
        },
      },
    });

    if (!user || !user.identity) {
      throw new NotFoundException('User not found for this national ID');
    }

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      isActive: user.isActive,
      isVerified: user.isVerified,
      identity: {
        nationalId: user.identity.nationalId,
        isVerified: user.identity.isVerified,
        verifiedAt: user.identity.verifiedAt,
      },
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
      select: {
        id: true,
        email: true,
        phone: true,
        fullName: true,
        dateOfBirth: true,
        profileImageUrl: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        isActive: true,
        isVerified: true,
        isPartner: true,
        lastLoginAt: true,
        companyName: true,
        taxCode: true,
        bankAccountNumber: true,
        bankName: true,
        address: true,
        commissionRate: true,
        contractStartDate: true,
        contractEndDate: true,
        paymentTerms: true,
        createdAt: true,
        updatedAt: true,
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
                    apartmentNumber: true,
                    wardCode: true,
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

    return this.toUnifiedUserDetail(user);
  }

  private toUnifiedUserDetail(user: any) {
    return {
      role: user.isPartner ? 'partner' : 'user',
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      dateOfBirth: user.dateOfBirth,
      profileImageUrl: user.profileImageUrl,
      emergencyContactName: user.emergencyContactName,
      emergencyContactPhone: user.emergencyContactPhone,
      companyName: user.companyName,
      taxCode: user.taxCode,
      bankAccountNumber: user.bankAccountNumber,
      bankName: user.bankName,
      address: user.address,
      commissionRate: user.commissionRate?.toString?.() ?? null,
      contractStartDate: user.contractStartDate,
      contractEndDate: user.contractEndDate,
      paymentTerms: user.paymentTerms,
      employeeCode: null,
      staffRole: null,
      department: null,
      workingCity: null,
      workingDistrict: null,
      hireDate: null,
      operatorShift: null,
      username: null,
      adminRoleLevel: null,
      permissions: null,
      isActive: user.isActive,
      isVerified: user.isVerified,
      lastLoginAt: user.lastLoginAt,
      identity: user.identity,
      contractMemberships: user.contractMemberships,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private toUnifiedStaffDetail(staff: any) {
    return {
      role: 'staff',
      id: staff.id,
      email: staff.email,
      phone: staff.phone,
      fullName: staff.fullName,
      dateOfBirth: null,
      profileImageUrl: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
      companyName: null,
      taxCode: null,
      bankAccountNumber: null,
      bankName: null,
      address: null,
      commissionRate: null,
      contractStartDate: null,
      contractEndDate: null,
      paymentTerms: null,
      employeeCode: staff.employeeCode,
      staffRole: staff.role,
      department: staff.department,
      workingCity: staff.workingCity,
      workingDistrict: staff.workingDistrict,
      hireDate: staff.hireDate,
      operatorShift: null,
      username: null,
      adminRoleLevel: null,
      permissions: null,
      isActive: staff.isActive,
      isVerified: null,
      lastLoginAt: null,
      identity: null,
      contractMemberships: null,
      createdAt: staff.createdAt,
      updatedAt: staff.updatedAt,
    };
  }

  private toUnifiedOperatorDetail(operator: any) {
    return {
      role: 'operator',
      id: operator.id,
      email: operator.email,
      phone: operator.phone,
      fullName: operator.fullName,
      dateOfBirth: null,
      profileImageUrl: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
      companyName: null,
      taxCode: null,
      bankAccountNumber: null,
      bankName: null,
      address: null,
      commissionRate: null,
      contractStartDate: null,
      contractEndDate: null,
      paymentTerms: null,
      employeeCode: operator.employeeCode,
      staffRole: null,
      department: null,
      workingCity: null,
      workingDistrict: null,
      hireDate: null,
      operatorShift: operator.shift,
      username: null,
      adminRoleLevel: null,
      permissions: null,
      isActive: operator.isActive,
      isVerified: null,
      lastLoginAt: null,
      identity: null,
      contractMemberships: null,
      createdAt: operator.createdAt,
      updatedAt: operator.updatedAt,
    };
  }

  private toUnifiedAdminDetail(admin: any) {
    return {
      role: 'admin',
      id: admin.id,
      email: admin.email,
      phone: admin.phone,
      fullName: admin.fullName,
      dateOfBirth: null,
      profileImageUrl: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
      companyName: null,
      taxCode: null,
      bankAccountNumber: null,
      bankName: null,
      address: null,
      commissionRate: null,
      contractStartDate: null,
      contractEndDate: null,
      paymentTerms: null,
      employeeCode: null,
      staffRole: null,
      department: null,
      workingCity: null,
      workingDistrict: null,
      hireDate: null,
      operatorShift: null,
      username: admin.username,
      adminRoleLevel: admin.roleLevel,
      permissions: admin.permissions,
      isActive: admin.isActive,
      isVerified: null,
      lastLoginAt: admin.lastLoginAt,
      identity: null,
      contractMemberships: null,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };
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
      select: {
        id: true,
        email: true,
        phone: true,
        fullName: true,
        dateOfBirth: true,
        profileImageUrl: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
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
   * Update user's identity card by uploading front + back images
   * AI extracts info from both sides - images are NOT stored in DB
   */
  async updateIdentityCard(
    userId: string,
    identityCardFrontFile: any,
    identityCardBackFile: any,
  ): Promise<UpdateIdentityCardResult> {
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
    let frontVerified = false;
    let backVerified = false;

    // Call FPT AI for both sides in parallel
    const frontBase64 = identityCardFrontFile.buffer.toString('base64');
    const backBase64 = identityCardBackFile.buffer.toString('base64');

    try {
      this.logger.log(`Verifying ID card (front + back) for user: ${userId}`);
      [frontResult, backResult] = await Promise.all([
        this.fptAiService.verifyIdCardFromBase64(frontBase64),
        this.fptAiService.verifyIdCardFromBase64(backBase64),
      ]);

      frontVerified = this.fptAiService.isVerificationSuccessfulForSide(
        frontResult,
        'front',
      );
      backVerified = this.fptAiService.isVerificationSuccessfulForSide(
        backResult,
        'back',
      );
      autoVerified = frontVerified && backVerified;

      if (!frontVerified) {
        this.logger.warn(
          `Front ID card verification failed for user: ${userId}, Error: ${frontResult.errorMessage}`,
        );
      }

      if (!backVerified) {
        this.logger.warn(
          `Back ID card verification failed for user: ${userId}, Error: ${backResult.errorMessage}`,
        );
      }

      if (!autoVerified) {
        throw new BadRequestException(
          'Khong the doc day du ca 2 mat CCCD. Vui long chup ro mat truoc va mat sau.',
        );
      }

      this.logger.log(
        `ID card verified (front + back) via AI for user: ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `FPT AI verification error for user ${userId}: ${error.message}`,
      );
      throw new BadRequestException(
        error?.message || 'Không thể xác thực CCCD bằng AI lúc này',
      );
    }

    // Merge extracted info from front and back
    const frontInfo = this.fptAiService.extractUserInfo(frontResult) || {};
    const backInfo = this.fptAiService.extractUserInfo(backResult) || {};
    const extractedInfo = { ...frontInfo, ...backInfo };

    // Prepare UserIdentity update data - always update with latest AI recognition
    const identityUpdateData: any = {};

    if (Object.keys(extractedInfo).length > 0) {
      if (extractedInfo.id) {
        identityUpdateData.nationalId = extractedInfo.id;
      }
      if (extractedInfo.name) {
        identityUpdateData.name = extractedInfo.name;
      }
      if (extractedInfo.dob) {
        identityUpdateData.dob = extractedInfo.dob;
      }
      if (extractedInfo.sex) {
        identityUpdateData.sex = extractedInfo.sex;
      }
      if (extractedInfo.nationality) {
        identityUpdateData.nationality = extractedInfo.nationality;
      }
      if (extractedInfo.ethnicity) {
        identityUpdateData.ethnicity = extractedInfo.ethnicity;
      }
      if (extractedInfo.home) {
        identityUpdateData.home = extractedInfo.home;
      }
      if (extractedInfo.address) {
        identityUpdateData.address = extractedInfo.address;
      }
      if (extractedInfo.features) {
        identityUpdateData.features = extractedInfo.features;
      }
      if (extractedInfo.issueDate) {
        identityUpdateData.issueDate = extractedInfo.issueDate;
      }
      if (extractedInfo.doe) {
        identityUpdateData.doe = extractedInfo.doe;
      }
      if (extractedInfo.province) {
        identityUpdateData.province = extractedInfo.province;
      }
      if (extractedInfo.district) {
        identityUpdateData.district = extractedInfo.district;
      }
      if (extractedInfo.ward) {
        identityUpdateData.ward = extractedInfo.ward;
      }
      if (extractedInfo.street) {
        identityUpdateData.street = extractedInfo.street;
      }

      this.logger.log(
        `Extracted ${Object.keys(extractedInfo).length} fields from ID card (front + back)`,
      );

      // Check if the national ID is already used by another account
      if (identityUpdateData.nationalId) {
        const existingIdentity = await this.prisma.userIdentity.findUnique({
          where: { nationalId: identityUpdateData.nationalId },
          select: { userId: true },
        });

        if (existingIdentity && existingIdentity.userId !== userId) {
          throw new ConflictException(
            'Số CCCD này đã được sử dụng bởi tài khoản khác',
          );
        }
      }

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
    let updatedUser: Prisma.UserGetPayload<{ include: { identity: true } }>;
    if (
      autoVerified &&
      this.configService.get<boolean>('fptAi.autoVerifyOnSuccess')
    ) {
      // Build update data: sync dob + fullName from extracted identity info
      const userUpdateData: any = { isVerified: true };

      if (extractedInfo.dob) {
        // Parse DD/MM/YYYY format from CCCD
        const parts = extractedInfo.dob.split('/');
        if (parts.length === 3) {
          const parsedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
          if (!isNaN(parsedDate.getTime())) {
            userUpdateData.dateOfBirth = parsedDate;
          }
        }
      }

      if (extractedInfo.name) {
        userUpdateData.fullName = extractedInfo.name;
      }

      updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: userUpdateData,
        include: { identity: true },
      });
      this.logger.log(
        `User ${userId} auto-verified after ID card check. Synced dob/fullName from identity.`,
      );
    } else {
      updatedUser = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        include: { identity: true },
      });
    }

    // Attach AI verification metadata to response
    return {
      ...updatedUser,
      aiVerification: {
        front: frontResult
          ? {
              success: this.fptAiService.isVerificationSuccessfulForSide(
                frontResult,
                'front',
              ),
              extractedInfo: this.fptAiService.extractUserInfo(frontResult),
            }
          : null,
        back: backResult
          ? {
              success: this.fptAiService.isVerificationSuccessfulForSide(
                backResult,
                'back',
              ),
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
          select: {
            id: true,
            email: true,
            phone: true,
            fullName: true,
            employeeCode: true,
            role: true,
            department: true,
            workingCity: true,
            workingDistrict: true,
            hireDate: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        if (!staff) throw new NotFoundException('Staff not found');
        return this.toUnifiedStaffDetail(staff);
      }
      case 'operator': {
        const operator = await this.prisma.operator.findUnique({
          where: { id: sub },
          select: {
            id: true,
            email: true,
            phone: true,
            fullName: true,
            employeeCode: true,
            shift: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        if (!operator) throw new NotFoundException('Operator not found');
        return this.toUnifiedOperatorDetail(operator);
      }
      case 'admin': {
        const admin = await this.prisma.admin.findUnique({
          where: { id: sub },
          select: {
            id: true,
            email: true,
            phone: true,
            fullName: true,
            username: true,
            roleLevel: true,
            permissions: true,
            lastLoginAt: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        if (!admin) throw new NotFoundException('Admin not found');
        return this.toUnifiedAdminDetail(admin);
      }
      default:
        return this.findOne(sub, currentUser);
    }
  }

  // ─── Partner Request CRUD (merged from PartnersService) ──────────

  async findAllPartnerRequests(status?: PartnerRequestStatus) {
    const where: Prisma.PartnerRequestWhereInput = {};
    if (status) where.status = status;

    return this.prisma.partnerRequest.findMany({
      where,
      select: {
        id: true,
        propertyType: true,
        address: true,
        city: true,
        district: true,
        status: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            fullName: true,
            companyName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMyPartnerRequests(currentUser: JwtPayload) {
    return this.prisma.partnerRequest.findMany({
      where: { userId: currentUser.sub },
      select: {
        id: true,
        propertyType: true,
        address: true,
        city: true,
        district: true,
        status: true,
        reviewNotes: true,
        rejectionReason: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOnePartnerRequest(id: string) {
    const request = await this.prisma.partnerRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            companyName: true,
            phone: true,
            email: true,
          },
        },
        reviewedByOperator: {
          select: { id: true, fullName: true },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Partner request not found');
    }

    return request;
  }

  async createPartnerRequest(
    createDto: CreatePartnerRequestDto,
    currentUser: JwtPayload,
  ) {
    return this.prisma.partnerRequest.create({
      data: {
        user: { connect: { id: currentUser.sub } },
        propertyType: createDto.propertyType,
        address: createDto.address,
        city: createDto.city,
        district: createDto.district,
        totalArea: createDto.totalArea,
        numberOfUnits: createDto.numberOfUnits,
        expectedRentPrice: createDto.expectedRentPrice,
        description: createDto.description,
        amenities: createDto.amenities,
      },
      select: {
        id: true,
        propertyType: true,
        address: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async updatePartnerRequest(
    id: string,
    updateDto: UpdatePartnerRequestDto,
    currentUser: JwtPayload,
  ) {
    const request = await this.prisma.partnerRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Partner request not found');
    }

    if (request.userId !== currentUser.sub) {
      throw new ForbiddenException('You can only update your own requests');
    }

    if (request.status !== PartnerRequestStatus.submitted) {
      throw new BadRequestException('Can only update submitted requests');
    }

    return this.prisma.partnerRequest.update({
      where: { id },
      data: updateDto,
      select: {
        id: true,
        propertyType: true,
        address: true,
        status: true,
        reviewNotes: true,
        updatedAt: true,
      },
    });
  }

  async reviewPartnerRequest(
    id: string,
    reviewDto: ReviewPartnerRequestDto,
    currentUser: JwtPayload,
  ) {
    const request = await this.prisma.partnerRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Partner request not found');
    }

    if (request.status !== PartnerRequestStatus.submitted) {
      throw new BadRequestException('Request is not in submitted status');
    }

    const data: Prisma.PartnerRequestUpdateInput = {
      status: reviewDto.status,
      reviewNotes: reviewDto.reviewNotes,
      reviewedByOperator: { connect: { id: currentUser.sub } },
    };

    if (reviewDto.status === PartnerRequestStatus.approved) {
      data.approvedAt = new Date();
    }

    if (reviewDto.status === PartnerRequestStatus.rejected) {
      data.rejectionReason = reviewDto.rejectionReason;
    }

    return this.prisma.partnerRequest.update({
      where: { id },
      data,
      select: {
        id: true,
        propertyType: true,
        address: true,
        status: true,
        reviewNotes: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
