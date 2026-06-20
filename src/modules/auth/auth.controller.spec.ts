import { UserRole } from '@prisma/client';
import { AuthController } from './auth.controller';
import { AuthService, AuthTokens } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UserResponseEntity } from './entities/auth-response.entity';

describe('AuthController', () => {
  const user: UserResponseEntity = {
    id: 'user-1',
    email: 'admin@jcommerce.com',
    name: 'Admin User',
    phone: null,
    avatar: null,
    role: UserRole.ADMIN,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const tokens: AuthTokens = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresIn: 900,
  };

  it('returns the client auth response contract on login', async () => {
    const authService = {
      login: jest.fn().mockResolvedValue({ user, tokens }),
    } as Pick<AuthService, 'login'> as AuthService;
    const controller = new AuthController(authService);

    const dto: LoginDto = {
      email: user.email,
      password: 'password123',
    };

    await expect(controller.login(dto)).resolves.toEqual({
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    });
  });

  it('returns the client auth response contract on register', async () => {
    const authService = {
      register: jest.fn().mockResolvedValue({ user, tokens }),
    } as Pick<AuthService, 'register'> as AuthService;
    const controller = new AuthController(authService);

    const dto: RegisterDto = {
      email: 'new@jcommerce.com',
      name: 'New Customer',
      phone: '081234567890',
      password: 'password123',
    };

    await expect(controller.register(dto)).resolves.toEqual({
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    });
  });
});
