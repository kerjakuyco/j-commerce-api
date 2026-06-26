import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BannersService } from './banners.service';
import { CreateBannerDto, UpdateBannerDto } from './dto/banner.dto';

@ApiTags('banners')
@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List active banners' })
  findAll() {
    return this.bannersService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Get('admin/all')
  @ApiOperation({ summary: 'List all banners including inactive (admin only)' })
  findAllAdmin() {
    return this.bannersService.findAllAdmin();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get active banner by ID' })
  findOne(@Param('id') id: string) {
    return this.bannersService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create banner (admin only)' })
  create(@Body() dto: CreateBannerDto) {
    return this.bannersService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update banner (admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.bannersService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Delete(':id/permanent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently delete banner (admin only)' })
  removePermanent(@Param('id') id: string) {
    return this.bannersService.removePermanent(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate banner (admin only)' })
  remove(@Param('id') id: string) {
    return this.bannersService.remove(id);
  }
}
