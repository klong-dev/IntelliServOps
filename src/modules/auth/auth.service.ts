import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import {
  LoginDto,
  LoginActorType,
  SubmitGuestInfoDto,
  RequestOtpDto,
  VerifyOtpDto,
} from './dto';
import { ActorType, PendingRegistrationStatus } from '@prisma/client';
import { SmsService } from '../sms/sms.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  actorType: ActorType;
  type: 'access' | 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    fullName: string | null;
    role: string;
    actorType: ActorType;
  };
  tokens: TokenPair;
}

interface ActorRecord {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string | null;
  isActive?: boolean;
  role?: string;
  roleLevel?: string;
}

@Injectable()
export class AuthService {
  private readonly SALT_ROUNDS = 12;
  private readonly OTP_EXPIRY_MINUTES = 5;
  private readonly MAX_OTP_ATTEMPTS = 5;
  private readonly PENDING_REGISTRATION_EXPIRY_DAYS = 30;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly smsService: SmsService,
  ) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Login for any actor type (User, Staff, Operator, Admin, Partner)
   */
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password, actorType } = loginDto;

    // Find actor by email, optionally filtering by type
    const { actor, foundActorType } = await this.findActorByEmail(
      email,
      actorType,
    );

    if (!actor) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if actor is active
    if ('isActive' in actor && actor.isActive === false) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await this.comparePassword(
      password,
      actor.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Determine role based on actor type
    const role = this.determineRole(actor, foundActorType);

    // Generate tokens
    const tokens = this.generateTokens({
      sub: actor.id,
      email: actor.email,
      role,
      actorType: foundActorType,
    });

    // Store refresh token in database
    await this.storeRefreshToken(actor.id, foundActorType, tokens.refreshToken);

    // Update last login
    await this.updateLastLogin(actor.id, foundActorType);

    return {
      user: {
        id: actor.id,
        email: actor.email,
        fullName: actor.fullName,
        role,
        actorType: foundActorType,
      },
      tokens,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    try {
      // Verify refresh token
      const payload = this.verifyRefreshToken(refreshToken);

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Check if refresh token exists in database
      const storedToken = await this.prisma.refreshToken.findFirst({
        where: {
          token: refreshToken,
          actorId: payload.sub,
          actorType: payload.actorType,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      if (!storedToken) {
        throw new UnauthorizedException('Token has been revoked or expired');
      }

      // Generate new tokens
      const tokens = this.generateTokens({
        sub: payload.sub,
        email: payload.email,
        role: payload.role,
        actorType: payload.actorType,
      });

      // Revoke old refresh token and store new one (token rotation)
      await this.prisma.$transaction([
        this.prisma.refreshToken.update({
          where: { id: storedToken.id },
          data: { revokedAt: new Date() },
        }),
        this.prisma.refreshToken.create({
          data: {
            token: tokens.refreshToken,
            actorId: payload.sub,
            actorType: payload.actorType,
            expiresAt: this.getRefreshTokenExpiry(),
          },
        }),
      ]);

      return tokens;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Logout - revoke refresh token
   */
  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = this.verifyRefreshToken(refreshToken);

      await this.prisma.refreshToken.updateMany({
        where: {
          token: refreshToken,
          actorId: payload.sub,
        },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Silently ignore invalid tokens during logout
    }
  }

  /**
   * Revoke all refresh tokens for an actor
   */
  async revokeAllTokens(actorId: string, actorType: ActorType): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        actorId,
        actorType,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  generateTokens(payload: Omit<JwtPayload, 'type'>): TokenPair {
    const accessToken = this.jwtService.sign(
      { ...payload, type: 'access' },
      {
        secret: this.configService.get('jwt.secret'),
        expiresIn: this.configService.get('jwt.expiresIn'),
      },
    );

    const refreshToken = this.jwtService.sign(
      { ...payload, type: 'refresh' },
      {
        secret: this.configService.get('jwt.refreshSecret'),
        expiresIn: this.configService.get('jwt.refreshExpiresIn'),
      },
    );

    return { accessToken, refreshToken };
  }

  verifyAccessToken(token: string): JwtPayload {
    return this.jwtService.verify(token, {
      secret: this.configService.get('jwt.secret'),
    });
  }

  verifyRefreshToken(token: string): JwtPayload {
    return this.jwtService.verify(token, {
      secret: this.configService.get('jwt.refreshSecret'),
    });
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async findActorByEmail(
    email: string,
    actorType?: LoginActorType,
  ): Promise<{ actor: ActorRecord | null; foundActorType: ActorType }> {
    // Search order: User -> Staff -> Operator -> Admin -> Partner
    const searchOrder: { type: ActorType; enabled: boolean }[] = [
      {
        type: ActorType.user,
        enabled: !actorType || actorType === LoginActorType.USER,
      },
      {
        type: ActorType.staff,
        enabled: !actorType || actorType === LoginActorType.STAFF,
      },
      {
        type: ActorType.operator,
        enabled: !actorType || actorType === LoginActorType.OPERATOR,
      },
      {
        type: ActorType.admin,
        enabled: !actorType || actorType === LoginActorType.ADMIN,
      },
      {
        type: ActorType.partner,
        enabled: !actorType || actorType === LoginActorType.PARTNER,
      },
    ];

    for (const { type, enabled } of searchOrder) {
      if (!enabled) continue;

      const actor = await this.findActorByType(email, type);
      if (actor) {
        return { actor, foundActorType: type };
      }
    }

    return { actor: null, foundActorType: ActorType.user };
  }

  private async findActorByType(
    email: string,
    type: ActorType,
  ): Promise<ActorRecord | null> {
    switch (type) {
      case ActorType.user:
        return this.prisma.user.findUnique({ where: { email } });
      case ActorType.staff:
        return this.prisma.staff.findUnique({ where: { email } });
      case ActorType.operator:
        return this.prisma.operator.findUnique({ where: { email } });
      case ActorType.admin:
        return this.prisma.admin.findUnique({ where: { email } });
      case ActorType.partner:
        return this.prisma.partner.findUnique({ where: { email } });
      default:
        return null;
    }
  }

  private determineRole(actor: ActorRecord, actorType: ActorType): string {
    switch (actorType) {
      case ActorType.user:
        return 'user';
      case ActorType.staff:
        return actor.role || 'staff';
      case ActorType.operator:
        return 'operator';
      case ActorType.admin:
        return actor.roleLevel || 'admin';
      case ActorType.partner:
        return 'partner';
      default:
        return 'guest';
    }
  }

  private async storeRefreshToken(
    actorId: string,
    actorType: ActorType,
    token: string,
  ): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        token,
        actorId,
        actorType,
        expiresAt: this.getRefreshTokenExpiry(),
      },
    });
  }

  private getRefreshTokenExpiry(): Date {
    const expiresIn =
      this.configService.get<string>('jwt.refreshExpiresIn') || '30d';
    const days = parseInt(expiresIn.replace('d', ''), 10) || 30;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private async updateLastLogin(
    actorId: string,
    actorType: ActorType,
  ): Promise<void> {
    const now = new Date();

    switch (actorType) {
      case ActorType.user:
        await this.prisma.user.update({
          where: { id: actorId },
          data: { lastLoginAt: now },
        });
        break;
      case ActorType.admin:
        await this.prisma.admin.update({
          where: { id: actorId },
          data: { lastLoginAt: now },
        });
        break;
      // Staff, Operator, Partner don't have lastLoginAt field
    }
  }

  // ============================================================================
  // Guest Registration Flow Methods
  // ============================================================================

  /**
   * Staff submits guest information after rental agreement
   * Creates a pending registration that guest can complete via mobile app
   */
  async submitGuestInfo(
    submitGuestInfoDto: SubmitGuestInfoDto,
    staffId: string,
  ): Promise<{ message: string; pendingRegistrationId: string }> {
    const {
      phone,
      email,
      fullName,
      dateOfBirth,
      nationalId,
      passportNumber,
      emergencyContactName,
      emergencyContactPhone,
      notes,
    } = submitGuestInfoDto;

    // Check if phone already registered as User
    const existingUser = await this.prisma.user.findFirst({
      where: { phone },
    });

    if (existingUser) {
      throw new ConflictException('This phone number is already registered');
    }

    // Check if email already registered (if provided)
    if (email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existingEmail) {
        throw new ConflictException('This email is already registered');
      }
    }

    // Check if there's already a pending registration for this phone
    const existingPending =
      await this.prisma.pendingGuestRegistration.findUnique({
        where: { phone },
      });

    if (existingPending) {
      // Update existing pending registration
      const updated = await this.prisma.pendingGuestRegistration.update({
        where: { id: existingPending.id },
        data: {
          email,
          fullName,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
          nationalId,
          passportNumber,
          emergencyContactName,
          emergencyContactPhone,
          notes,
          submittedByStaffId: staffId,
          status: PendingRegistrationStatus.pending,
          expiresAt: new Date(
            Date.now() +
              this.PENDING_REGISTRATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
          ),
          updatedAt: new Date(),
        },
      });

      return {
        message:
          'Guest information updated. Guest can now register via mobile app.',
        pendingRegistrationId: updated.id,
      };
    }

    // Create new pending registration
    const pendingRegistration =
      await this.prisma.pendingGuestRegistration.create({
        data: {
          phone,
          email,
          fullName,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
          nationalId,
          passportNumber,
          emergencyContactName,
          emergencyContactPhone,
          notes,
          submittedByStaffId: staffId,
          status: PendingRegistrationStatus.pending,
          expiresAt: new Date(
            Date.now() +
              this.PENDING_REGISTRATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
          ),
        },
      });

    return {
      message:
        'Guest information submitted. Guest can now register via mobile app.',
      pendingRegistrationId: pendingRegistration.id,
    };
  }

  /**
   * Guest requests OTP via mobile app
   * Phone must match a pending registration submitted by Staff
   */
  async requestOtp(
    requestOtpDto: RequestOtpDto,
  ): Promise<{ message: string; expiresIn: number }> {
    const { phone } = requestOtpDto;

    // Check if there's a pending registration for this phone
    const pendingRegistration =
      await this.prisma.pendingGuestRegistration.findUnique({
        where: { phone },
      });

    if (!pendingRegistration) {
      throw new NotFoundException(
        'No pending registration found for this phone number. Please contact staff.',
      );
    }

    // Check if pending registration is expired
    if (pendingRegistration.expiresAt < new Date()) {
      throw new BadRequestException(
        'Registration has expired. Please contact staff to submit your information again.',
      );
    }

    // Check if already completed
    if (pendingRegistration.status === PendingRegistrationStatus.completed) {
      throw new BadRequestException(
        'Registration already completed. Please login.',
      );
    }

    // Check rate limiting - max 1 OTP per minute
    const recentOtp = await this.prisma.otpVerification.findFirst({
      where: {
        phone,
        createdAt: { gt: new Date(Date.now() - 60 * 1000) },
      },
    });

    if (recentOtp) {
      throw new BadRequestException(
        'Please wait 1 minute before requesting a new OTP.',
      );
    }

    // Generate OTP
    const otpCode = this.smsService.generateOtpCode();
    const expiresAt = new Date(
      Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000,
    );

    // Save OTP to database
    await this.prisma.otpVerification.create({
      data: {
        phone,
        code: otpCode,
        purpose: 'registration',
        expiresAt,
      },
    });

    // Update pending registration status
    await this.prisma.pendingGuestRegistration.update({
      where: { id: pendingRegistration.id },
      data: { status: PendingRegistrationStatus.otp_sent },
    });

    // Send OTP via SMS
    await this.smsService.sendOtpSms({ phone, otpCode });

    return {
      message: 'OTP has been sent to your phone number.',
      expiresIn: this.OTP_EXPIRY_MINUTES * 60, // in seconds
    };
  }

  /**
   * Guest verifies OTP and completes registration
   * After successful verification, Guest becomes User
   */
  async verifyOtpAndRegister(
    verifyOtpDto: VerifyOtpDto,
  ): Promise<AuthResponse> {
    const { phone, otpCode, password } = verifyOtpDto;

    // Find pending registration
    const pendingRegistration =
      await this.prisma.pendingGuestRegistration.findUnique({
        where: { phone },
      });

    if (!pendingRegistration) {
      throw new NotFoundException(
        'No pending registration found for this phone number.',
      );
    }

    if (pendingRegistration.status === PendingRegistrationStatus.completed) {
      throw new BadRequestException(
        'Registration already completed. Please login.',
      );
    }

    if (pendingRegistration.expiresAt < new Date()) {
      throw new BadRequestException(
        'Registration has expired. Please contact staff.',
      );
    }

    // Find valid OTP
    const otpRecord = await this.prisma.otpVerification.findFirst({
      where: {
        phone,
        code: otpCode,
        purpose: 'registration',
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      // Increment attempts on the most recent OTP
      const latestOtp = await this.prisma.otpVerification.findFirst({
        where: { phone, purpose: 'registration', isUsed: false },
        orderBy: { createdAt: 'desc' },
      });

      if (latestOtp) {
        await this.prisma.otpVerification.update({
          where: { id: latestOtp.id },
          data: { attempts: { increment: 1 } },
        });

        if (latestOtp.attempts + 1 >= this.MAX_OTP_ATTEMPTS) {
          throw new BadRequestException(
            'Too many failed attempts. Please request a new OTP.',
          );
        }
      }

      throw new BadRequestException('Invalid or expired OTP code.');
    }

    // Check max attempts
    if (otpRecord.attempts >= this.MAX_OTP_ATTEMPTS) {
      throw new BadRequestException(
        'Too many failed attempts. Please request a new OTP.',
      );
    }

    // Hash password
    const passwordHash = await this.hashPassword(password);

    // Create User and mark OTP as used in a transaction
    const user = await this.prisma.$transaction(async (tx) => {
      // Mark OTP as used
      await tx.otpVerification.update({
        where: { id: otpRecord.id },
        data: { isUsed: true, usedAt: new Date() },
      });

      // Update pending registration status
      await tx.pendingGuestRegistration.update({
        where: { id: pendingRegistration.id },
        data: { status: PendingRegistrationStatus.completed },
      });

      // Create new User
      const newUser = await tx.user.create({
        data: {
          phone: pendingRegistration.phone,
          email:
            pendingRegistration.email || `${phone}@temp.intellirentops.com`,
          fullName: pendingRegistration.fullName,
          dateOfBirth: pendingRegistration.dateOfBirth,
          nationalId: pendingRegistration.nationalId,
          passportNumber: pendingRegistration.passportNumber,
          emergencyContactName: pendingRegistration.emergencyContactName,
          emergencyContactPhone: pendingRegistration.emergencyContactPhone,
          passwordHash,
          isActive: true,
          isVerified: true, // Phone verified via OTP
          createdByStaffId: pendingRegistration.submittedByStaffId,
        },
      });

      return newUser;
    });

    // Generate tokens
    const tokens = this.generateTokens({
      sub: user.id,
      email: user.email,
      role: 'user',
      actorType: ActorType.user,
    });

    // Store refresh token
    await this.storeRefreshToken(user.id, ActorType.user, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: 'user',
        actorType: ActorType.user,
      },
      tokens,
    };
  }

  /**
   * Resend OTP for guest registration
   */
  async resendOtp(
    phone: string,
  ): Promise<{ message: string; expiresIn: number }> {
    // Invalidate old OTPs
    await this.prisma.otpVerification.updateMany({
      where: {
        phone,
        purpose: 'registration',
        isUsed: false,
      },
      data: { isUsed: true },
    });

    // Request new OTP
    return this.requestOtp({ phone });
  }
}
