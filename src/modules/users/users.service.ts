import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User, UserRole } from '@prisma/client';
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

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryUserDto) {
    const { page = 1, limit = 20, search, role } = query;
    const where: Prisma.UserWhereInput = { deletedAt: null };

    if (role) where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { createdAt: 'desc' },
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

  async remove(id: string): Promise<User> {
    await this.findOne(id);

    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async toggleActive(id: string, isActive: boolean) {
    await this.findOne(id);

    return this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: USER_SELECT,
    });
  }
}
