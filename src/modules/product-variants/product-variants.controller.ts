import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateVariantDto, UpdateVariantDto } from './dto/variant.dto';
import { ProductVariantsService } from './product-variants.service';

@ApiTags('product-variants')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller()
export class ProductVariantsController {
  constructor(private readonly variantsService: ProductVariantsService) {}

  @Post('products/:productId/variants')
  @ApiOperation({ summary: 'Create product variant (admin only)' })
  create(@Param('productId') productId: string, @Body() dto: CreateVariantDto) {
    return this.variantsService.create(productId, dto);
  }

  @Patch('variants/:id')
  @ApiOperation({ summary: 'Update product variant (admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateVariantDto) {
    return this.variantsService.update(id, dto);
  }

  @Delete('variants/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete product variant (admin only)' })
  remove(@Param('id') id: string) {
    return this.variantsService.remove(id);
  }
}
