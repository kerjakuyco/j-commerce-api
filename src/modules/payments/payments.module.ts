import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MidtransService } from './midtrans.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [AuthModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, MidtransService],
  exports: [PaymentsService, MidtransService],
})
export class PaymentsModule {}
