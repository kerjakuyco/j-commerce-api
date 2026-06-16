import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as public (no JWT auth required).
 * Use on controller methods that should be accessible without a token
 * (e.g., /auth/login, /auth/register, /auth/refresh).
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
