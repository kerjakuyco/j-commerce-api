import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { RouteAwareValidationPipe } from './common/pipes/route-aware-validation.pipe';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  const nodeEnv = configService.get<string>('app.nodeEnv', 'development');
  const uploadDir = configService.get<string>('upload.dir', './uploads');

  // Global API prefix
  app.setGlobalPrefix('api/v1');

  // Static assets for uploaded files
  app.useStaticAssets(uploadDir, { prefix: '/uploads/' });

  // Helmet: keep protections in production. In non-production Swagger UI is
  // enabled at /api/docs and its inline scripts break under Helmet's default
  // CSP (script-src 'self'), so disable CSP only when docs are served.
  app.use(
    helmet({
      contentSecurityPolicy: nodeEnv === 'production' ? undefined : false,
    }),
  );
  app.use(compression());

  // CORS
  const corsOrigins = configService
    .get<string>('app.corsOrigins', 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation pipe — DTO validation. RouteAwareValidationPipe keeps
  // the strict profile (whitelist + forbidNonWhitelisted + transform) app-wide
  // but switches to a loose profile (strip extras, no 400) for DTOs marked
  // with @LooseValidation() — currently the Midtrans webhook DTO, which would
  // otherwise be rejected by forbidNonWhitelisted before handleNotification
  // runs (method-specific extra fields).
  app.useGlobalPipes(new RouteAwareValidationPipe());

  // Global filters & interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Swagger / OpenAPI (non-production only)
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('j-commerce API')
      .setDescription('Backend API untuk j-commerce mobile & admin')
      .setVersion('1.0.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .addTag('auth', 'Authentication endpoints')
      .addTag('users', 'User management')
      .addTag('categories', 'Category CRUD')
      .addTag('products', 'Product catalog')
      .addTag('cart', 'Shopping cart')
      .addTag('wishlist', 'User wishlist')
      .addTag('addresses', 'User addresses')
      .addTag('orders', 'Order management')
      .addTag('payments', 'Midtrans payment integration')
      .addTag('vouchers', 'Voucher codes')
      .addTag('notifications', 'In-app notifications')
      .addTag('banners', 'Home banners')
      .addTag('reviews', 'Product reviews')
      .addTag('upload', 'File upload')
      .addTag('dashboard', 'Admin stats')
      .addTag('health', 'Health check')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
    console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
  }

  await app.listen(port);
  console.log(`🚀 j-commerce API running on http://localhost:${port}`);
  console.log(`🌍 Environment: ${nodeEnv}`);
}

void bootstrap();
