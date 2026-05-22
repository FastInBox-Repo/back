import { Injectable } from '@nestjs/common';

import { newId } from '../../common/ids';

export interface ProviderIntent {
  providerIntentId: string;
  redirectUrl: string;
  expiresAt: Date;
}

@Injectable()
export class MockPaymentProvider {
  createIntent(orderId: string, amountCents: number): ProviderIntent {
    const providerIntentId = `tx_${newId()}`;
    const expiresAt = new Date(Date.now() + 90 * 60 * 1000);
    const redirectUrl = `https://checkout.fastinbox.app/${providerIntentId}?order=${orderId}&amount=${amountCents}`;
    return { providerIntentId, redirectUrl, expiresAt };
  }
}
