import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { UserResponseEntity } from './entities/auth-response.entity';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface RefreshJwtPayload {
  sub: string;
  type: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ============================================
  // REGISTER
  // ============================================
  async register(dto: RegisterDto): Promise<{ user: UserResponseEntity; tokens: AuthTokens }> {
    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const normalizedPhone = dto.phone ? this.normalizePhone(dto.phone) : null;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: dto.email,
            password: hashedPassword,
            name: dto.name,
            phone: normalizedPhone,
            role: UserRole.CUSTOMER,
          },
        });

        const tokens = await this.generateTokensInTx(tx, user.id, user.email, user.role);
        return { user: this.toUserResponse(user), tokens };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Email sudah terdaftar');
      }
      throw err;
    }
  }

  // ============================================
  // LOGIN
  // ============================================
  async login(dto: LoginDto): Promise<{ user: UserResponseEntity; tokens: AuthTokens }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Email atau password salah');
    }
    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Email atau password salah');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    return { user: this.toUserResponse(user), tokens };
  }

  // ============================================
  // REFRESH TOKENS
  // ============================================
  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    let payload: RefreshJwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshJwtPayload>(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token tidak valid');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Refresh token tidak valid');
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });
    if (
      !stored ||
      stored.userId !== payload.sub ||
      stored.revokedAt ||
      stored.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Refresh token sudah tidak berlaku');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User tidak aktif');
    }

    // Rotate atomically: revoke old and issue new inside a transaction
    return this.prisma.$transaction(async (tx) => {
      const revoked = await tx.$executeRaw`
        UPDATE refresh_tokens
        SET revokedAt = NOW()
        WHERE id = ${stored.id} AND revokedAt IS NULL
      `;
      if (revoked === 0) {
        // Token was already revoked: potential reuse. Revoke the entire token
        // family (all active refresh tokens for this user) so a stolen token
        // that was rotated first can no longer be used, then reject.
        console.warn(`[AUTH] Refresh token reuse detected for user ${stored.userId}`);
        await tx.refreshToken.updateMany({
          where: { userId: stored.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        throw new UnauthorizedException('Refresh token sudah tidak berlaku');
      }

      return this.generateTokensInTx(tx, user.id, user.email, user.role);
    });
  }

  // ============================================
  // LOGOUT (revoke refresh token)
  // ============================================
  async logout(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ============================================
  // FORGOT PASSWORD (mock)
  // ============================================
  async forgotPassword(email: string): Promise<void> {
    // In production, send email with reset link
    // For portfolio scope, just log
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      console.log(`[MOCK] Password reset email would be sent to: ${email}`);
    }
    // Always return success to prevent email enumeration
  }

  // ============================================
  // CHANGE PASSWORD
  // ============================================
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }
    const oldValid = await bcrypt.compare(dto.oldPassword, user.password);
    if (!oldValid) {
      throw new UnauthorizedException('Password lama salah');
    }
    const hashedNew = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNew },
    });
    // Revoke all refresh tokens (force re-login on other devices)
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ============================================
  // GET PROFILE
  // ============================================
  async getProfile(userId: string): Promise<UserResponseEntity> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }
    return this.toUserResponse(user);
  }

  // ============================================
  // HELPERS
  // ============================================
  private async generateTokens(userId: string, email: string, role: UserRole): Promise<AuthTokens> {
    return this.prisma.$transaction(async (tx) => this.generateTokensInTx(tx, userId, email, role));
  }

  private async generateTokensInTx(
    tx: Prisma.TransactionClient,
    userId: string,
    email: string,
    role: UserRole,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: userId, email, role };
    const accessExpires = this.configService.get<string>('jwt.expiresIn', '15m');
    const refreshExpires = this.configService.get<string>('jwt.refreshExpiresIn', '7d');

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: accessExpires,
    });
    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, type: 'refresh' },
      {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: refreshExpires,
      },
    );

    // Persist refresh token
    const expiresAt = this.parseExpiry(refreshExpires);
    await tx.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt,
      },
    });

    // Calculate access token TTL in seconds
    const expiresInSeconds = this.parseExpirySeconds(accessExpires);

    return { accessToken, refreshToken, expiresIn: expiresInSeconds };
  }

  private toUserResponse(user: User): UserResponseEntity {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  private parseExpiry(expiry: string): Date {
    const ms = this.parseExpirySeconds(expiry) * 1000;
    return new Date(Date.now() + ms);
  }

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('62')) {
      return `+${digits}`;
    }
    if (digits.startsWith('0')) {
      return `+62${digits.slice(1)}`;
    }
    return `+${digits}`;
  }

  private parseExpirySeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // default 15 min
    const value = parseInt(match[1]!, 10);
    const unit = match[2];
    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 900;
    }
  }
}
