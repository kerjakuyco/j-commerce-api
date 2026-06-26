import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { QueryUserDto } from './dto/query-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  avatar: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.UserSelect;

type UserResponse = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryUserDto) {
    const {
      page = 1,
      limit = 20,
      search,
      role,
      isActive,
      sortBy = 'createdAt',
      sortDir = 'desc',
    } = query;
    const where: Prisma.UserWhereInput = { deletedAt: null };

    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const orderBy: Prisma.UserOrderByWithRelationInput[] = (() => {
      switch (sortBy) {
        case 'name':
          return [{ name: sortDir }, { id: 'asc' }];
        case 'email':
          return [{ email: sortDir }, { id: 'asc' }];
        case 'role':
          return [{ role: sortDir }, { id: 'asc' }];
        case 'isActive':
          return [{ isActive: sortDir }, { id: 'asc' }];
        case 'createdAt':
        default:
          return [{ createdAt: sortDir }, { id: 'asc' }];
      }
    })();

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundException('User tidak ditemukan');

    return user;
  }

  async update(id: string, actor: AuthenticatedUser, dto: UpdateUserDto) {
    const target = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!target) throw new NotFoundException('User tidak ditemukan');

    const isAdmin = actor.role === UserRole.ADMIN;
    if (!isAdmin && actor.id !== id) {
      throw new ForbiddenException('Anda hanya bisa mengubah profile sendiri');
    }

    if (!isAdmin && (dto.role !== undefined || dto.isActive !== undefined)) {
      throw new ForbiddenException('Role dan status aktif hanya bisa diubah admin');
    }

    if (isAdmin) {
      if (actor.id === target.id) {
        if (dto.isActive === false) {
          throw new ForbiddenException('Admin tidak bisa menonaktifkan akun sendiri');
        }
        if (dto.role !== undefined && dto.role !== UserRole.ADMIN) {
          throw new ForbiddenException('Admin tidak bisa menurunkan role sendiri');
        }
      }
      if (target.role === UserRole.ADMIN) {
        if (dto.isActive === false) {
          throw new ForbiddenException('Akun admin tidak bisa dinonaktifkan');
        }
        if (dto.role !== undefined && dto.role !== UserRole.ADMIN) {
          throw new ForbiddenException('Role admin tidak bisa diturunkan');
        }
      }
    }

    if (dto.email && dto.email !== target.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existing) throw new ConflictException('Email sudah digunakan');
    }

    const data: Prisma.UserUpdateInput = {
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      avatar: dto.avatar,
      ...(isAdmin ? { role: dto.role, isActive: dto.isActive } : {}),
    };

    return this.prisma.user.update({ where: { id }, data, select: USER_SELECT });
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<UserResponse> {
    const target = await this.findOne(id);
    this.assertAdminCanDeactivate(actor, target);

    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
      select: USER_SELECT,
    });
  }

  async toggleActive(id: string, actor: AuthenticatedUser, isActive: boolean) {
    const target = await this.findOne(id);
    if (!isActive) this.assertAdminCanDeactivate(actor, target);

    return this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: USER_SELECT,
    });
  }

  private assertAdminCanDeactivate(actor: AuthenticatedUser, target: UserResponse): void {
    if (actor.id === target.id) {
      throw new ForbiddenException('Admin tidak bisa menonaktifkan akun sendiri');
    }
    if (target.role === UserRole.ADMIN) {
      throw new ForbiddenException('Akun admin tidak bisa dinonaktifkan');
    }
  }
}
