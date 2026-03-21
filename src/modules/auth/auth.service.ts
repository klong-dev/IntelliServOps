/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  LoginDto,
  LoginActorType,
  RegisterDto,
  GoogleAuthDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from './dto';
import { ActorType } from '@prisma/client';

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
    availableRoles: ActorType[];
  };
  tokens: TokenPair;
}

interface ActorRecord {
  id: string;
  email: string;
  passwordHash: string | null;
  fullName: string | null;
  isActive?: boolean;
  role?: string;
  roleLevel?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SALT_ROUNDS = 12;
  private readonly PASSWORD_RESET_EXPIRY_HOURS = 1;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Login for any actor type (User, Staff, Operator, Admin)
   * Supports multi-role: finds all roles for the email, returns available roles.
   * If actorType not specified, defaults to 'user' if available.
   */
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { identifier, password, actorType } = loginDto;

    // Detect if identifier is email or phone
    const isEmail = identifier.includes('@');

    // Find ALL available roles for this identifier
    const availableRoles = isEmail
      ? await this.findAllRolesForEmail(identifier)
      : await this.findAllRolesForPhone(identifier);

    if (availableRoles.length === 0) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Determine which role to login as
    let targetType: ActorType;
    if (actorType) {
      const mapped = this.mapLoginActorType(actorType);
      if (!availableRoles.includes(mapped)) {
        throw new UnauthorizedException(
          `You do not have the '${actorType}' role. Available roles: ${availableRoles.join(', ')}`,
        );
      }
      targetType = mapped;
    } else {
      // Default to 'user' if available, otherwise first available role
      targetType = availableRoles.includes(ActorType.user)
        ? ActorType.user
        : availableRoles[0];
    }

    // Find the specific actor record
    const actor = isEmail
      ? await this.findActorByType(identifier, targetType)
      : await this.findActorByTypeAndPhone(identifier, targetType);

    if (!actor) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if actor is active
    if ('isActive' in actor && actor.isActive === false) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Verify password
    if (!actor.passwordHash) {
      throw new UnauthorizedException(
        'This account uses social login. Please use Google OAuth.',
      );
    }

    const isPasswordValid = await this.comparePassword(
      password,
      actor.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Determine role based on actor type
    const role = this.determineRole(actor, targetType);

    // Generate tokens
    const tokens = this.generateTokens({
      sub: actor.id,
      email: actor.email,
      role,
      actorType: targetType,
    });

    // Store refresh token in database
    await this.storeRefreshToken(actor.id, targetType, tokens.refreshToken);

    // Update last login
    await this.updateLastLogin(actor.id, targetType);

    return {
      user: {
        id: actor.id,
        email: actor.email,
        fullName: actor.fullName,
        role,
        actorType: targetType,
        availableRoles,
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

  /**
   * Find ALL roles/actor types for an email across all actor tables
   */
  private async findAllRolesForEmail(email: string): Promise<ActorType[]> {
    const roles: ActorType[] = [];

    const [user, staff, operator, admin] = await Promise.all([
      this.prisma.user.findUnique({ where: { email }, select: { id: true } }),
      this.prisma.staff.findUnique({ where: { email }, select: { id: true } }),
      this.prisma.operator.findUnique({
        where: { email },
        select: { id: true },
      }),
      this.prisma.admin.findUnique({ where: { email }, select: { id: true } }),
    ]);

    if (user) roles.push(ActorType.user);
    if (staff) roles.push(ActorType.staff);
    if (operator) roles.push(ActorType.operator);
    if (admin) roles.push(ActorType.admin);

    return roles;
  }

  /**
   * Find ALL roles/actor types for a phone number across all actor tables.
   * Searches both formats: 0xxxxxxxxx and +84xxxxxxxxx
   */
  private async findAllRolesForPhone(phone: string): Promise<ActorType[]> {
    const roles: ActorType[] = [];
    const phoneVariants = this.getPhoneVariants(phone);

    const [user, staff, operator, admin] = await Promise.all([
      this.prisma.user.findFirst({
        where: { phone: { in: phoneVariants } },
        select: { id: true },
      }),
      this.prisma.staff.findFirst({
        where: { phone: { in: phoneVariants } },
        select: { id: true },
      }),
      this.prisma.operator.findFirst({
        where: { phone: { in: phoneVariants } },
        select: { id: true },
      }),
      this.prisma.admin.findFirst({
        where: { phone: { in: phoneVariants } },
        select: { id: true },
      }),
    ]);

    if (user) roles.push(ActorType.user);
    if (staff) roles.push(ActorType.staff);
    if (operator) roles.push(ActorType.operator);
    if (admin) roles.push(ActorType.admin);

    return roles;
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
      default:
        return null;
    }
  }

  /**
   * Find actor by phone number and type.
   * Searches both formats: 0xxxxxxxxx and +84xxxxxxxxx
   */
  private async findActorByTypeAndPhone(
    phone: string,
    type: ActorType,
  ): Promise<ActorRecord | null> {
    const phoneVariants = this.getPhoneVariants(phone);

    switch (type) {
      case ActorType.user:
        return this.prisma.user.findFirst({
          where: { phone: { in: phoneVariants } },
        });
      case ActorType.staff:
        return this.prisma.staff.findFirst({
          where: { phone: { in: phoneVariants } },
        });
      case ActorType.operator:
        return this.prisma.operator.findFirst({
          where: { phone: { in: phoneVariants } },
        });
      case ActorType.admin:
        return this.prisma.admin.findFirst({
          where: { phone: { in: phoneVariants } },
        });
      default:
        return null;
    }
  }

  /**
   * Get both phone format variants for searching:
   * 0901234567 → ['0901234567', '+84901234567']
   * +84901234567 → ['+84901234567', '0901234567']
   */
  private getPhoneVariants(phone: string): string[] {
    if (phone.startsWith('+84')) {
      return [phone, '0' + phone.slice(3)];
    }
    if (phone.startsWith('0')) {
      return [phone, '+84' + phone.slice(1)];
    }
    return [phone];
  }

  private mapLoginActorType(actorType: LoginActorType): ActorType {
    const map: Record<LoginActorType, ActorType> = {
      [LoginActorType.USER]: ActorType.user,
      [LoginActorType.STAFF]: ActorType.staff,
      [LoginActorType.OPERATOR]: ActorType.operator,
      [LoginActorType.ADMIN]: ActorType.admin,
    };
    return map[actorType];
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
      // Staff, Operator don't have lastLoginAt field
    }
  }

  // ============================================================================
  // Supabase Config
  // ============================================================================

  /**
   * Return full Supabase Google OAuth login URL for frontend to open popup
   */
  getSupabaseUrl(): { url: string } {
    const supabaseUrl = this.configService.get<string>('supabase.url');
    const redirectUrl =
      this.configService.get<string>('supabase.redirectUrl') || '';

    if (!supabaseUrl) {
      throw new BadRequestException(
        'Supabase is not configured on this server',
      );
    }

    const url = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}`;

    return { url };
  }

  // ============================================================================
  // Registration
  // ============================================================================

  /**
   * Register a new user account (web self-service)
   * Default role = user
   */
  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, phone, fullName, password } = registerDto;

    // Check if email already registered as User
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    // Check phone uniqueness if provided (search both 0xx and +84xx formats)
    if (phone) {
      const phoneVariants = this.getPhoneVariants(phone);
      const existingPhone = await this.prisma.user.findFirst({
        where: { phone: { in: phoneVariants } },
      });
      if (existingPhone) {
        throw new ConflictException('Phone number is already registered');
      }
    }

    // Hash password and create user
    const passwordHash = await this.hashPassword(password);

    const user = await this.prisma.user.create({
      data: {
        email,
        phone,
        fullName,
        passwordHash,
        isActive: true,
        isVerified: false,
      },
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
        availableRoles: [ActorType.user],
      },
      tokens,
    };
  }

  // ============================================================================
  // Google OAuth
  // ============================================================================

  /**
   * Login/Register via Google OAuth using Supabase access token.
   * If user doesn't exist, creates a new user account.
   */
  async googleAuth(googleAuthDto: GoogleAuthDto): Promise<AuthResponse> {
    const { accessToken } = googleAuthDto;

    const supabaseUrl = this.configService.get<string>('supabase.url');
    const supabaseKey = this.configService.get<string>('supabase.anonKey');

    if (!supabaseUrl || !supabaseKey) {
      throw new BadRequestException('Google OAuth is not configured');
    }

    // Verify the Supabase access token via REST API
    let supabaseUser: {
      id: string;
      email: string;
      user_metadata?: { full_name?: string; avatar_url?: string };
    };
    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseKey,
        },
      });

      if (!response.ok) {
        throw new Error('Invalid token');
      }

      supabaseUser = await response.json();
    } catch {
      throw new UnauthorizedException('Invalid or expired Google OAuth token');
    }

    if (!supabaseUser?.email) {
      throw new BadRequestException(
        'Could not retrieve email from Google account',
      );
    }

    // Find or create user in our database
    let user = await this.prisma.user.findUnique({
      where: { email: supabaseUser.email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: supabaseUser.email,
          fullName:
            supabaseUser.user_metadata?.full_name ||
            supabaseUser.email.split('@')[0],
          supabaseId: supabaseUser.id,
          profileImageUrl: supabaseUser.user_metadata?.avatar_url,
          isActive: true,
          isVerified: true,
        },
      });
    } else if (!user.supabaseId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { supabaseId: supabaseUser.id },
      });
    }

    const availableRoles = await this.findAllRolesForEmail(user.email);

    const tokens = this.generateTokens({
      sub: user.id,
      email: user.email,
      role: 'user',
      actorType: ActorType.user,
    });

    await this.storeRefreshToken(user.id, ActorType.user, tokens.refreshToken);
    await this.updateLastLogin(user.id, ActorType.user);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: 'user',
        actorType: ActorType.user,
        availableRoles,
      },
      tokens,
    };
  }

  // ============================================================================
  // Password Management
  // ============================================================================

  /**
   * Request a password reset token.
   * In production, this would send an email with the reset link.
   */
  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const { email } = forgotPasswordDto;

    const availableRoles = await this.findAllRolesForEmail(email);

    if (availableRoles.length === 0) {
      // Don't reveal that the email doesn't exist
      return {
        message:
          'If a matching account was found, a password reset link has been sent to your email.',
      };
    }

    // Invalidate previous reset tokens
    await this.prisma.passwordResetToken.updateMany({
      where: { email, isUsed: false },
      data: { isUsed: true },
    });

    const token = randomUUID();
    const expiresAt = new Date(
      Date.now() + this.PASSWORD_RESET_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    await this.prisma.passwordResetToken.create({
      data: { email, token, expiresAt },
    });

    // TODO: Send email with reset link (integrate email service)
    this.logger.log(`Password reset token generated for ${email}: ${token}`);

    return {
      message:
        'If a matching account was found, a password reset link has been sent to your email.',
    };
  }

  /**
   * Reset password using a valid reset token
   */
  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    const { token, newPassword } = resetPasswordDto;

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (resetToken.isUsed) {
      throw new BadRequestException('This reset token has already been used');
    }

    if (resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Reset token has expired');
    }

    const passwordHash = await this.hashPassword(newPassword);
    const email = resetToken.email;

    await this.prisma.$transaction(async (tx) => {
      // Mark token as used
      await tx.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { isUsed: true, usedAt: new Date() },
      });

      // Update password across all actor tables
      const user = await tx.user.findUnique({ where: { email } });
      if (user) {
        await tx.user.update({ where: { email }, data: { passwordHash } });
      }

      const staff = await tx.staff.findUnique({ where: { email } });
      if (staff) {
        await tx.staff.update({ where: { email }, data: { passwordHash } });
      }

      const operator = await tx.operator.findUnique({ where: { email } });
      if (operator) {
        await tx.operator.update({
          where: { email },
          data: { passwordHash },
        });
      }

      const admin = await tx.admin.findUnique({ where: { email } });
      if (admin) {
        await tx.admin.update({ where: { email }, data: { passwordHash } });
      }
    });

    return { message: 'Password has been reset successfully' };
  }

  /**
   * Change password for an authenticated user
   */
  async changePassword(
    actorId: string,
    actorType: ActorType,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const { currentPassword, newPassword } = changePasswordDto;

    // Find actor
    let actor: ActorRecord | null = null;

    switch (actorType) {
      case ActorType.user:
        actor = await this.prisma.user.findUnique({ where: { id: actorId } });
        break;
      case ActorType.staff:
        actor = await this.prisma.staff.findUnique({ where: { id: actorId } });
        break;
      case ActorType.operator:
        actor = await this.prisma.operator.findUnique({
          where: { id: actorId },
        });
        break;
      case ActorType.admin:
        actor = await this.prisma.admin.findUnique({ where: { id: actorId } });
        break;
    }

    if (!actor) {
      throw new NotFoundException('Account not found');
    }

    if (!actor.passwordHash) {
      throw new BadRequestException(
        'Cannot change password for social login accounts. Please set a password first.',
      );
    }

    const isValid = await this.comparePassword(
      currentPassword,
      actor.passwordHash,
    );
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await this.hashPassword(newPassword);

    switch (actorType) {
      case ActorType.user:
        await this.prisma.user.update({
          where: { id: actorId },
          data: { passwordHash },
        });
        break;
      case ActorType.staff:
        await this.prisma.staff.update({
          where: { id: actorId },
          data: { passwordHash },
        });
        break;
      case ActorType.operator:
        await this.prisma.operator.update({
          where: { id: actorId },
          data: { passwordHash },
        });
        break;
      case ActorType.admin:
        await this.prisma.admin.update({
          where: { id: actorId },
          data: { passwordHash },
        });
        break;
    }

    // Revoke all tokens to force re-login
    await this.revokeAllTokens(actorId, actorType);

    return { message: 'Password changed successfully. Please login again.' };
  }
}
