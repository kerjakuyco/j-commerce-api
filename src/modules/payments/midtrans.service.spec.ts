import { ConfigService } from '@nestjs/config';
import { PaymentStatus } from '@prisma/client';
import { createHash } from 'crypto';
import { MidtransNotificationDto } from './dto/midtrans-notification.dto';
import { MidtransService } from './midtrans.service';

describe('MidtransService', () => {
  const serverKey = 'server-secret';
  const config = {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === 'midtrans.serverKey') return serverKey;
      if (key === 'midtrans.clientKey') return 'client-key';
      if (key === 'midtrans.isProduction') return false;
      return fallback;
    }),
  } as unknown as ConfigService;
  const service = new MidtransService(config);

  const notification = (status: string): MidtransNotificationDto => {
    const base = {
      order_id: 'INV-20260616-ABCDE',
      status_code: '200',
      gross_amount: '100000.00',
      transaction_status: status,
      transaction_id: 'trx-1',
      fraud_status: 'accept',
    };
    const signature_key = createHash('sha512')
      .update(`${base.order_id}${base.status_code}${base.gross_amount}${serverKey}`)
      .digest('hex');

    return { ...base, signature_key };
  };

  it('verifies valid webhook signature', () => {
    expect(service.verifySignature(notification('settlement'))).toBe(true);
  });

  it('rejects invalid webhook signature', () => {
    expect(
      service.verifySignature({
        ...notification('settlement'),
        signature_key: 'invalid',
      }),
    ).toBe(false);
  });

  it('maps settlement to PAID', () => {
    expect(service.mapPaymentStatus(notification('settlement'))).toBe(PaymentStatus.PAID);
  });
});
