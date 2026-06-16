import {
  NotificationType,
  Prisma,
  PrismaClient,
  UserRole,
  VoucherType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('🌱 Seeding database...');

  // Cleanup in correct order
  await prisma.notification.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.wishlistItem.deleteMany({});
  await prisma.cartItem.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.address.deleteMany({});
  await prisma.productImage.deleteMany({});
  await prisma.productVariant.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.voucher.deleteMany({});
  await prisma.banner.deleteMany({});
  await prisma.user.deleteMany({});

  // ============================================
  // USERS
  // ============================================
  const adminPassword = await bcrypt.hash('admin123', 12);
  const customerPassword = await bcrypt.hash('demo1234', 12);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@jcommerce.com',
      password: adminPassword,
      name: 'Admin j-commerce',
      phone: '+6281234567890',
      role: UserRole.ADMIN,
      avatar: 'https://i.pravatar.cc/300?u=admin',
    },
  });

  const customer = await prisma.user.create({
    data: {
      email: 'demo@jcommerce.com',
      password: customerPassword,
      name: 'Demo User',
      phone: '+6281234567890',
      role: UserRole.CUSTOMER,
      avatar: 'https://i.pravatar.cc/300?u=demo',
    },
  });

  // eslint-disable-next-line no-console
  console.log(`✅ Users: ${[admin.email, customer.email].join(', ')}`);

  // ============================================
  // CATEGORIES
  // ============================================
  const categoryData = [
    { name: 'Elektronik', slug: 'elektronik', icon: '📱', sortOrder: 1 },
    { name: 'Fashion Pria', slug: 'fashion-pria', icon: '👕', sortOrder: 2 },
    { name: 'Fashion Wanita', slug: 'fashion-wanita', icon: '👗', sortOrder: 3 },
    { name: 'Kecantikan', slug: 'kecantikan', icon: '💄', sortOrder: 4 },
    { name: 'Rumah Tangga', slug: 'rumah-tangga', icon: '🏠', sortOrder: 5 },
    { name: 'Olahraga', slug: 'olahraga', icon: '⚽', sortOrder: 6 },
    { name: 'Makanan', slug: 'makanan', icon: '🍔', sortOrder: 7 },
    { name: 'Buku', slug: 'buku', icon: '📚', sortOrder: 8 },
  ];
  const categories = await Promise.all(
    categoryData.map((c) => prisma.category.create({ data: c })),
  );
  // eslint-disable-next-line no-console
  console.log(`✅ Categories: ${categories.length}`);

  const findCat = (slug: string) => categories.find((c) => c.slug === slug)!;

  // ============================================
  // PRODUCTS + VARIANTS + IMAGES
  // ============================================
  const productData: Array<{
    name: string;
    slug: string;
    brand: string;
    description: string;
    category: string;
    basePrice: number;
    discountPrice?: number;
    isFeatured?: boolean;
    isFlashSale?: boolean;
    flashSaleEndsAt?: Date;
    images: string[];
    variants: Array<{
      name: string;
      sku: string;
      price: Prisma.Decimal | number;
      stock: number;
    }>;
  }> = [
    {
      name: 'iPhone 15 Pro Max 256GB',
      slug: 'iphone-15-pro-max-256gb',
      brand: 'Apple',
      description:
        'iPhone 15 Pro Max dengan chip A17 Pro, kamera 48MP, dan baterai tahan lama. Body titanium ringan dan tahan lama.',
      category: 'elektronik',
      basePrice: 21999000,
      discountPrice: 19999000,
      isFeatured: true,
      images: [
        'https://picsum.photos/seed/iphone1/600/600',
        'https://picsum.photos/seed/iphone2/600/600',
        'https://picsum.photos/seed/iphone3/600/600',
      ],
      variants: [
        { name: 'Natural Titanium', sku: 'IP15PM-NT', price: 19999000, stock: 25 },
        { name: 'Blue Titanium', sku: 'IP15PM-BT', price: 19999000, stock: 18 },
        { name: 'White Titanium', sku: 'IP15PM-WT', price: 19999000, stock: 0 },
      ],
    },
    {
      name: 'Samsung Galaxy S24 Ultra',
      slug: 'samsung-galaxy-s24-ultra',
      brand: 'Samsung',
      description:
        'Samsung Galaxy S24 Ultra dengan S Pen built-in, kamera 200MP, dan AI features terbaru.',
      category: 'elektronik',
      basePrice: 19999000,
      discountPrice: 17999000,
      isFeatured: true,
      isFlashSale: true,
      flashSaleEndsAt: new Date('2026-12-31T23:59:59Z'),
      images: [
        'https://picsum.photos/seed/samsung1/600/600',
        'https://picsum.photos/seed/samsung2/600/600',
      ],
      variants: [
        { name: 'Titanium Black', sku: 'S24U-TB', price: 17999000, stock: 30 },
        { name: 'Titanium Gray', sku: 'S24U-TG', price: 17999000, stock: 22 },
      ],
    },
    {
      name: 'Kemeja Slim Fit Premium',
      slug: 'kemeja-slim-fit-premium',
      brand: 'Eiger',
      description:
        'Kemeja slim fit dari bahan katun premium, nyaman dipakai sehari-hari atau ke kantor.',
      category: 'fashion-pria',
      basePrice: 299000,
      discountPrice: 199000,
      isFeatured: true,
      images: [
        'https://picsum.photos/seed/kemeja1/600/600',
        'https://picsum.photos/seed/kemeja2/600/600',
      ],
      variants: [
        { name: 'M - Putih', sku: 'KSF-M-WH', price: 199000, stock: 50 },
        { name: 'L - Putih', sku: 'KSF-L-WH', price: 199000, stock: 45 },
        { name: 'M - Biru', sku: 'KSF-M-BL', price: 199000, stock: 38 },
      ],
    },
    {
      name: 'Dress Wanita Elegan',
      slug: 'dress-wanita-elegan',
      brand: 'Zara',
      description:
        'Dress wanita elegan cocok untuk acara formal maupun casual. Bahan adem dan jatuh.',
      category: 'fashion-wanita',
      basePrice: 599000,
      discountPrice: 399000,
      isFlashSale: true,
      flashSaleEndsAt: new Date('2026-12-20T23:59:59Z'),
      images: [
        'https://picsum.photos/seed/dress1/600/600',
        'https://picsum.photos/seed/dress2/600/600',
      ],
      variants: [
        { name: 'S - Hitam', sku: 'DWE-S-BK', price: 399000, stock: 20 },
        { name: 'M - Hitam', sku: 'DWE-M-BK', price: 399000, stock: 25 },
        { name: 'L - Merah', sku: 'DWE-L-RD', price: 399000, stock: 15 },
      ],
    },
    {
      name: 'Lipstick Matte Premium',
      slug: 'lipstick-matte-premium',
      brand: 'Maybelline',
      description: 'Lipstick matte tahan lama 12 jam, tidak luntur, melembabkan bibir.',
      category: 'kecantikan',
      basePrice: 129000,
      discountPrice: 89000,
      isFeatured: true,
      images: ['https://picsum.photos/seed/lipstick1/600/600'],
      variants: [
        { name: 'Red Classic', sku: 'LM-RC', price: 89000, stock: 100 },
        { name: 'Pink Nude', sku: 'LM-PN', price: 89000, stock: 80 },
      ],
    },
    {
      name: 'Sofa Minimalis 3 Seater',
      slug: 'sofa-minimalis-3-seater',
      brand: 'IKEA',
      description:
        'Sofa minimalis modern untuk ruang tamu, bahan fabric premium, busa rebound.',
      category: 'rumah-tangga',
      basePrice: 4999000,
      discountPrice: 3999000,
      images: ['https://picsum.photos/seed/sofa1/600/600'],
      variants: [
        { name: 'Abu-abu', sku: 'SM3-GR', price: 3999000, stock: 10 },
        { name: 'Biru Navy', sku: 'SM3-NV', price: 3999000, stock: 8 },
      ],
    },
    {
      name: 'Sepatu Lari Pria',
      slug: 'sepatu-lari-pria',
      brand: 'Nike',
      description:
        'Sepatu lari ringan dengan teknologi Air Zoom, nyaman untuk lari jarak jauh.',
      category: 'olahraga',
      basePrice: 1499000,
      discountPrice: 1199000,
      isFeatured: true,
      images: ['https://picsum.photos/seed/sepatu1/600/600'],
      variants: [
        { name: '42 - Hitam', sku: 'SLP-42-BK', price: 1199000, stock: 30 },
        { name: '43 - Putih', sku: 'SLP-43-WH', price: 1199000, stock: 25 },
      ],
    },
    {
      name: 'Kopi Arabica Premium 500g',
      slug: 'kopi-arabica-premium-500g',
      brand: 'Kapal Api',
      description:
        'Kopi Arabica premium dari Aceh Gayo, diproses dengan teknik khusus untuk rasa terbaik.',
      category: 'makanan',
      basePrice: 199000,
      discountPrice: 149000,
      isFlashSale: true,
      flashSaleEndsAt: new Date('2026-12-18T23:59:59Z'),
      images: ['https://picsum.photos/seed/kopi1/600/600'],
      variants: [
        { name: 'Whole Bean', sku: 'KAP-WB', price: 149000, stock: 60 },
        { name: 'Ground', sku: 'KAP-GR', price: 149000, stock: 45 },
      ],
    },
  ];

  let productsCreated = 0;
  for (const p of productData) {
    const { variants, images, category, ...data } = p;
    const product = await prisma.product.create({
      data: {
        ...data,
        basePrice: data.basePrice,
        discountPrice: data.discountPrice,
        categoryId: findCat(category).id,
        images: {
          create: images.map((url, idx) => ({ url, sortOrder: idx })),
        },
        variants: {
          create: variants,
        },
      },
    });
    productsCreated++;
    // Add a sample review for each product
    await prisma.review.create({
      data: {
        productId: product.id,
        userId: customer.id,
        rating: 5,
        comment: `Produk ${product.name} sangat bagus! Recommended.`,
        isVerified: true,
      },
    });
  }
  // eslint-disable-next-line no-console
  console.log(`✅ Products: ${productsCreated} (with variants, images, and 1 review each)`);

  // ============================================
  // BANNERS
  // ============================================
  await prisma.banner.createMany({
    data: [
      {
        title: 'Diskon 50% Elektronik',
        image: 'https://picsum.photos/seed/banner1/800/400',
        link: '/catalog?category=1',
        sortOrder: 1,
      },
      {
        title: 'Gratis Ongkir Se-Indonesia',
        image: 'https://picsum.photos/seed/banner2/800/400',
        link: '/catalog',
        sortOrder: 2,
      },
      {
        title: 'Flash Sale 12.12',
        image: 'https://picsum.photos/seed/banner3/800/400',
        link: '/catalog?flash=true',
        sortOrder: 3,
      },
    ],
  });
  // eslint-disable-next-line no-console
  console.log(`✅ Banners: 3`);

  // ============================================
  // VOUCHERS
  // ============================================
  await prisma.voucher.createMany({
    data: [
      {
        code: 'HEMAT10',
        type: VoucherType.FIXED,
        value: 10000,
        description: 'Diskon Rp 10.000 untuk semua produk',
        minPurchase: 50000,
        quota: 1000,
        expiresAt: new Date('2026-12-31T23:59:59Z'),
      },
      {
        code: 'DISKON20',
        type: VoucherType.FIXED,
        value: 20000,
        description: 'Diskon Rp 20.000 untuk min. purchase Rp 200.000',
        minPurchase: 200000,
        quota: 500,
        expiresAt: new Date('2026-12-31T23:59:59Z'),
      },
      {
        code: 'GRATIS',
        type: VoucherType.PERCENTAGE,
        value: 100,
        description: 'Gratis ongkir (mock - diskon 100% dari ongkir)',
        minPurchase: 0,
        quota: 100,
        expiresAt: new Date('2026-12-31T23:59:59Z'),
      },
    ],
  });
  // eslint-disable-next-line no-console
  console.log(`✅ Vouchers: 3`);

  // ============================================
  // ADDRESS for customer
  // ============================================
  await prisma.address.create({
    data: {
      userId: customer.id,
      label: 'Rumah',
      recipient: customer.name,
      phone: customer.phone ?? '+6281234567890',
      province: 'DKI Jakarta',
      city: 'Jakarta Selatan',
      district: 'Kebayoran Baru',
      postalCode: '12150',
      fullAddress: 'Jl. Senopati No. 1',
      isDefault: true,
    },
  });

  // ============================================
  // NOTIFICATIONS for customer
  // ============================================
  await prisma.notification.createMany({
    data: [
      {
        userId: customer.id,
        type: NotificationType.SYSTEM,
        title: 'Selamat Datang di j-commerce!',
        body: 'Temukan ribuan produk menarik dengan harga terbaik.',
      },
      {
        userId: customer.id,
        type: NotificationType.PROMO,
        title: 'Flash Sale Dimulai!',
        body: 'Diskon hingga 50% untuk kategori Elektronik. Buruan!',
      },
      {
        userId: customer.id,
        type: NotificationType.ORDER,
        title: 'Pesanan Sedang Dikirim',
        body: 'Pesanan INV-12345678 sedang dalam perjalanan.',
        data: { orderId: 'sample' },
      },
    ],
  });
  // eslint-disable-next-line no-console
  console.log(`✅ Notifications: 3 (seeded for demo user)`);

  // eslint-disable-next-line no-console
  console.log('✨ Seeding complete!');
  // eslint-disable-next-line no-console
  console.log('\n📝 Demo accounts:');
  // eslint-disable-next-line no-console
  console.log('   Admin:    admin@jcommerce.com / admin123');
  // eslint-disable-next-line no-console
  console.log('   Customer: demo@jcommerce.com  / demo1234');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
