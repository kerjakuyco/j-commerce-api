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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CreateVoucherDto,
  QueryVoucherDto,
  UpdateVoucherDto,
  ValidateVoucherDto,
} from './dto/voucher.dto';
import { VouchersService } from './vouchers.service';

@ApiTags('vouchers')
@Controller('vouchers')
export class VouchersController {
  constructor(private readonly vouchersService: VouchersService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List active vouchers' })
  findAll(@Query() query: QueryVoucherDto) {
    return this.vouchersService.findAll(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Get('admin/all')
  @ApiOperation({
    summary: 'List ALL vouchers (admin only — active, inactive, expired, exhausted)',
  })
  findAllForAdmin(@Query() query: QueryVoucherDto) {
    return this.vouchersService.findAllForAdmin(query);
  }

  @Public()
  @Get(':code')
  @ApiOperation({ summary: 'Get active voucher by code' })
  findByCode(@Param('code') code: string) {
    return this.vouchersService.findByCode(code);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Post('validate')
  @ApiOperation({ summary: 'Validate voucher and calculate discount' })
  validate(@Body() dto: ValidateVoucherDto) {
    return this.vouchersService.validate(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create voucher (admin only)' })
  create(@Body() dto: CreateVoucherDto) {
    return this.vouchersService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update voucher (admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateVoucherDto) {
    return this.vouchersService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Delete(':id/permanent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently delete unused voucher (admin only)' })
  removePermanent(@Param('id') id: string) {
    return this.vouchersService.removePermanent(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate voucher (admin only)' })
  remove(@Param('id') id: string) {
    return this.vouchersService.remove(id);
  }
}
