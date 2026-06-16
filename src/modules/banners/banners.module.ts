import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BannersController } from './banners.controller';
import { BannersService } from './banners.service';

@Module({
  imports: [AuthModule],
  controllers: [BannersController],
  providers: [BannersService],
})
export class BannersModule {}
