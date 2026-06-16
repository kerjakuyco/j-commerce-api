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
import { CreateProductImageDto, ReorderImagesDto } from './dto/product-image.dto';
import { ProductImagesService } from './product-images.service';

@ApiTags('product-images')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller()
export class ProductImagesController {
  constructor(private readonly imagesService: ProductImagesService) {}

  @Post('products/:productId/images')
  @ApiOperation({ summary: 'Add product image (admin only)' })
  create(@Param('productId') productId: string, @Body() dto: CreateProductImageDto) {
    return this.imagesService.create(productId, dto);
  }

  @Patch('products/:productId/images/reorder')
  @ApiOperation({ summary: 'Reorder product images (admin only)' })
  reorder(@Param('productId') productId: string, @Body() dto: ReorderImagesDto) {
    return this.imagesService.reorder(productId, dto);
  }

  @Delete('images/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete product image (admin only)' })
  remove(@Param('id') id: string) {
    return this.imagesService.remove(id);
  }
}
