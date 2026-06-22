import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CompleteMockPaymentDto } from './dto/complete-mock-payment.dto';
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

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Post('midtrans/mock-complete')
  @ApiOperation({ summary: 'Complete mock Midtrans payment in local/dev mode' })
  completeMockPayment(@CurrentUser() user: AuthenticatedUser, @Body() dto: CompleteMockPaymentDto) {
    return this.paymentsService.completeMockPayment(user, dto);
  }

  // The MidtransNotificationDto is marked with @LooseValidation() so the global
  // RouteAwareValidationPipe strips (instead of 400-ing on) the method-specific
  // extra fields Midtrans sends (GoPay/QRIS/card/VA/refund_*/channel_response_*).
  // Without this, forbidNonWhitelisted would reject the whole notification and
  // leave the order UNPAID while Midtrans retried forever.
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
