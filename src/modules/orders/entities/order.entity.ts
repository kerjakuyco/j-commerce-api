import { OrderStatus, PaymentStatus, ShippingMethod } from '@prisma/client';

export interface OrderSummaryEntity {
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  shippingMethod: ShippingMethod;
  subtotal: number;
  shippingCost: number;
  discount: number;
  total: number;
}
