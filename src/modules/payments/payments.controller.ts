import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateSnapTokenDto } from './dto/create-snap-token.dto';
import { MidtransNotificationDto } from './dto/midtrans-notification.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Post('midtrans/snap-token')
  @ApiOperation({ summary: 'Create Midtrans Snap token for order' })
  createSnapToken(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSnapTokenDto) {
    return this.paymentsService.createSnapToken(user, dto);
  }

  @Public()
  @Post('midtrans/notification')
  @ApiOperation({ summary: 'Midtrans payment notification webhook' })
  handleNotification(@Body() dto: MidtransNotificationDto) {
    return this.paymentsService.handleNotification(dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get('order/:orderId')
  @ApiOperation({ summary: 'Get payment by order ID or order number' })
  getByOrderId(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string) {
    return this.paymentsService.getByOrderId(user, orderId);
  }
}
