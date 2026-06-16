import { PaymentStatus } from '@prisma/client';

export interface SnapTokenEntity {
  orderId: string;
  orderNumber: string;
  token: string;
  redirectUrl: string;
  status: PaymentStatus;
}
