import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto, LoginActorType } from './dto';
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
   * Login for any actor type (User, Staff, Operator, Admin, Partner)
   */
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password, actorType } = loginDto;

    // Find actor by email, optionally filtering by type
    const { actor, foundActorType } = await this.findActorByEmail(email, actorType);

    if (!actor) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if actor is active
    if ('isActive' in actor && actor.isActive === false) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await this.comparePassword(password, actor.passwordHash);
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
      { type: ActorType.user, enabled: !actorType || actorType === LoginActorType.USER },
      { type: ActorType.staff, enabled: !actorType || actorType === LoginActorType.STAFF },
      { type: ActorType.operator, enabled: !actorType || actorType === LoginActorType.OPERATOR },
      { type: ActorType.admin, enabled: !actorType || actorType === LoginActorType.ADMIN },
      { type: ActorType.partner, enabled: !actorType || actorType === LoginActorType.PARTNER },
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

  private async findActorByType(email: string, type: ActorType): Promise<ActorRecord | null> {
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
    const expiresIn = this.configService.get<string>('jwt.refreshExpiresIn') || '30d';
    const days = parseInt(expiresIn.replace('d', ''), 10) || 30;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private async updateLastLogin(actorId: string, actorType: ActorType): Promise<void> {
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
}
