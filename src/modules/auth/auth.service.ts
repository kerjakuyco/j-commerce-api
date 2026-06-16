import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
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
  async register(dto: RegisterDto): Promise<{ user: User; tokens: AuthTokens }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email sudah terdaftar');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        phone: dto.phone,
        role: UserRole.CUSTOMER,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    return { user, tokens };
  }

  // ============================================
  // LOGIN
  // ============================================
  async login(dto: LoginDto): Promise<{ user: User; tokens: AuthTokens }> {
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
    return { user, tokens };
  }

  // ============================================
  // REFRESH TOKENS
  // ============================================
  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token tidak valid');
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token sudah tidak berlaku');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User tidak aktif');
    }

    // Rotate: revoke old, issue new
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.generateTokens(user.id, user.email, user.role);
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
  async getProfile(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }
    return user;
  }

  // ============================================
  // HELPERS
  // ============================================
  private async generateTokens(userId: string, email: string, role: UserRole): Promise<AuthTokens> {
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
    await this.prisma.refreshToken.create({
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

  private parseExpiry(expiry: string): Date {
    const ms = this.parseExpirySeconds(expiry) * 1000;
    return new Date(Date.now() + ms);
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
