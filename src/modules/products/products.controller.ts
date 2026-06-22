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
  CreateProductDto,
  ProductLimitQueryDto,
  QueryProductDto,
  UpdateProductDto,
} from './dto/product.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List products with filters, sort, pagination' })
  findAll(@Query() query: QueryProductDto) {
    return this.productsService.findAll(query);
  }

  @Public()
  @Get('featured')
  @ApiOperation({ summary: 'Get featured products' })
  findFeatured(@Query() query: ProductLimitQueryDto) {
    return this.productsService.findFeatured(query.limit);
  }

  @Public()
  @Get('flash-sale')
  @ApiOperation({ summary: 'Get flash sale products' })
  findFlashSale(@Query() query: ProductLimitQueryDto) {
    return this.productsService.findFlashSale(query.limit);
  }

  @Public()
  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Get product detail by ID or slug' })
  findOne(@Param('idOrSlug') idOrSlug: string) {
    return this.productsService.findOne(idOrSlug);
  }

  @Public()
  @Get(':id/related')
  @ApiOperation({ summary: 'Get related products (same category)' })
  findRelated(@Param('id') id: string, @Query() query: ProductLimitQueryDto) {
    return this.productsService.findRelated(id, query.limit);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create product (admin only)' })
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update product (admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete product (admin only)' })
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
