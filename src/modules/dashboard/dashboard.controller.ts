import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DashboardService } from './dashboard.service';
import { RevenueQueryDto, TopProductsQueryDto } from './dto/dashboard-query.dto';

@ApiTags('dashboard')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Admin dashboard overview stats' })
  getOverview() {
    return this.dashboardService.getOverview();
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Revenue chart by period' })
  getRevenueChart(@Query() query: RevenueQueryDto) {
    return this.dashboardService.getRevenueChart(query.period);
  }

  @Get('top-products')
  @ApiOperation({ summary: 'Top products by quantity sold' })
  getTopProducts(@Query() query: TopProductsQueryDto) {
    return this.dashboardService.getTopProducts(query.limit);
  }

  @Get('order-status')
  @ApiOperation({ summary: 'Order status breakdown' })
  getOrderStatusBreakdown() {
    return this.dashboardService.getOrderStatusBreakdown();
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Operational dashboard alerts' })
  getAlerts() {
    return this.dashboardService.getAlerts();
  }
}
