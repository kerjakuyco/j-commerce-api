import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  it('rejects creating a product with discountPrice greater than basePrice', async () => {
    const prisma = { product: { create: jest.fn() } };
    const service = new ProductsService(prisma as never);

    await expect(
      service.create({
        name: 'Bad Discount',
        slug: 'bad-discount',
        brand: 'J Commerce',
        description: 'Discount price is higher than base price',
        categoryId: 'category-1',
        basePrice: 100000,
        discountPrice: 125000,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('rejects lowering basePrice below an existing discountPrice', async () => {
    const prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue({
          basePrice: new Prisma.Decimal(100000),
          discountPrice: new Prisma.Decimal(80000),
        }),
        update: jest.fn(),
      },
    };
    const service = new ProductsService(prisma as never);

    await expect(service.update('product-1', { basePrice: 75000 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('returns not found before validating an update for a missing product', async () => {
    const prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };
    const service = new ProductsService(prisma as never);

    await expect(service.update('missing', { discountPrice: 10000 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.product.update).not.toHaveBeenCalled();
  });
});
