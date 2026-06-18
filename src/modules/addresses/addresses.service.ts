import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Address, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';
import { REGIONS } from './regions.data';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  getRegions() {
    return REGIONS;
  }

  findAll(userId: string): Promise<Address[]> {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(userId: string, dto: CreateAddressDto): Promise<Address> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockUserAddressSet(tx, userId);
      const totalAddresses = await tx.address.count({ where: { userId } });
      const makeDefault = dto.isDefault === true || totalAddresses === 0;

      if (makeDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.address.create({
        data: {
          ...dto,
          userId,
          isDefault: makeDefault,
        },
      });
    });
  }

  async update(userId: string, id: string, dto: UpdateAddressDto): Promise<Address> {
    const address = await this.findOwnedAddress(userId, id);
    const { isDefault, ...data } = dto;

    if (isDefault === false && address.isDefault) {
      throw new BadRequestException(
        'Alamat default tidak bisa dinonaktifkan langsung. Pilih alamat default lain terlebih dahulu.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await this.lockUserAddressSet(tx, userId);
      if (isDefault === true) {
        await tx.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.address.update({
        where: { id },
        data: {
          ...data,
          ...(isDefault !== undefined ? { isDefault } : {}),
        },
      });
    });
  }

  async remove(userId: string, id: string): Promise<{ message: string }> {
    const address = await this.findOwnedAddress(userId, id);

    await this.prisma.$transaction(async (tx) => {
      await this.lockUserAddressSet(tx, userId);
      await tx.address.delete({ where: { id } });

      if (address.isDefault) {
        const nextDefault = await tx.address.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        });

        if (nextDefault) {
          await tx.address.update({
            where: { id: nextDefault.id },
            data: { isDefault: true },
          });
        }
      }
    });

    return { message: 'Alamat berhasil dihapus' };
  }

  async setDefault(userId: string, id: string): Promise<Address> {
    await this.findOwnedAddress(userId, id);

    return this.prisma.$transaction(async (tx) => {
      await this.lockUserAddressSet(tx, userId);
      await tx.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });

      return tx.address.update({
        where: { id },
        data: { isDefault: true },
      });
    });
  }

  private async findOwnedAddress(userId: string, id: string): Promise<Address> {
    const address = await this.prisma.address.findFirst({
      where: { id, userId },
    });
    if (!address) {
      throw new NotFoundException('Alamat tidak ditemukan');
    }

    return address;
  }

  private async lockUserAddressSet(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    await tx.$executeRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
  }
}
