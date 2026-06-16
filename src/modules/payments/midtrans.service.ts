import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Order, OrderItem, PaymentStatus } from '@prisma/client';
import { createHash } from 'crypto';
import midtransClient from 'midtrans-client';
import { MidtransNotificationDto } from './dto/midtrans-notification.dto';

type OrderForSnap = Order & {
  user: { name: string; email: string; phone: string | null };
  items: OrderItem[];
};

@Injectable()
export class MidtransService {
  private readonly logger = new Logger(MidtransService.name);

  constructor(private readonly configService: ConfigService) {}

  async createSnapTransaction(
    order: OrderForSnap,
  ): Promise<{ token: string; redirectUrl: string }> {
    const serverKey = this.configService.get<string>('midtrans.serverKey', '');
    const clientKey = this.configService.get<string>('midtrans.clientKey', '');
    const isProduction = this.configService.get<boolean>('midtrans.isProduction', false);

    if (!serverKey || serverKey.includes('XXXXXXXX')) {
      const token = `mock-snap-${order.orderNumber}`;
      return {
        token,
        redirectUrl: `https://app.sandbox.midtrans.com/snap/v2/vtweb/${token}`,
      };
    }

    const snap = new midtransClient.Snap({ isProduction, serverKey, clientKey });
    const payload = {
      transaction_details: {
        order_id: order.orderNumber,
        gross_amount: Number(order.total),
      },
      customer_details: {
        first_name: order.user.name,
        email: order.user.email,
        phone: order.user.phone ?? undefined,
      },
      item_details: [
        ...order.items.map((item) => ({
          id: item.variantId,
          name: `${item.productName} - ${item.variantName}`.slice(0, 50),
          price: Number(item.price),
          quantity: item.quantity,
        })),
        {
          id: 'shipping',
          name: `Shipping ${order.shippingMethod}`,
          price: Number(order.shippingCost),
          quantity: 1,
        },
        ...(Number(order.discount) > 0
          ? [
              {
                id: 'discount',
                name: 'Discount',
                price: -Number(order.discount),
                quantity: 1,
              },
            ]
          : []),
      ],
    };

    this.logger.log(`Creating Midtrans Snap transaction for ${order.orderNumber}`);
    const response = await snap.createTransaction(payload);

    return { token: response.token, redirectUrl: response.redirect_url };
  }

  verifySignature(notification: MidtransNotificationDto): boolean {
    const serverKey = this.configService.get<string>('midtrans.serverKey', '');
    if (!serverKey || serverKey.includes('XXXXXXXX')) return false;

    const input = `${notification.order_id}${notification.status_code}${notification.gross_amount}${serverKey}`;
    const expected = createHash('sha512').update(input).digest('hex');

    return expected === notification.signature_key;
  }

  mapPaymentStatus(notification: MidtransNotificationDto): PaymentStatus {
    const status = notification.transaction_status;
    if (status === 'settlement') return PaymentStatus.PAID;
    if (status === 'capture') {
      return notification.fraud_status === 'challenge' ? PaymentStatus.UNPAID : PaymentStatus.PAID;
    }
    if (status === 'expire') return PaymentStatus.EXPIRED;
    if (['cancel', 'deny', 'failure'].includes(status)) return PaymentStatus.FAILED;
    if (['refund', 'partial_refund'].includes(status)) return PaymentStatus.REFUNDED;

    return PaymentStatus.UNPAID;
  }
}
