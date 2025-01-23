import { DRIZZLE, DrizzleDb } from '@modules/drizzle';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { paymentMethods, paymentTransactions } from '@schemas/finance';
import { sql } from 'drizzle-orm';
import { LRUCache } from 'lru-cache';
import { PaymentMethodProviderNames, PaymentMethodProviderSchema } from './dto';
import * as CountryData from '../../assets/countries.json';
import { from, mergeMap, distinct, toArray } from 'rxjs';
import { z } from 'zod';

type ExchangeRateResponse = {
  base: string;
  date: Date;
  rates: Record<string, number>;
  success: boolean;
  timestamp: number;
};

async function doFetchExchangeRates(
  src: string,
  dest: string,
  key: string,
  logger: Logger,
  signal?: AbortSignal,
) {
  const url = new URL('/exchangerates_data/latest', 'https://api.apilayer.com');
  url.searchParams.set('symbols', dest);
  url.searchParams.set('base', src);
  logger.debug(
    `Looking up exchange rates for ${src} -> ${dest} from ${url.origin}`,
  );
  return await fetch(url, { headers: { apikey: key }, signal })
    .then((res) => res.json())
    .then((d) => d as ExchangeRateResponse);
}

@Injectable()
export class FinanceService {
  private logger = new Logger(FinanceService.name);
  private readonly rateCache = new LRUCache<string, Record<string, number>>({
    size: 300,
    maxSize: 500,
    sizeCalculation: () => 1,
    ttl: 3600 * 1000 * 12,
    fetchMethod: async (key, value, { signal }) => {
      const [src, dest] = key.split('-');
      const apiKey = this.configService.getOrThrow<string>('API_LAYER_KEY');

      const res = await doFetchExchangeRates(
        src,
        dest,
        apiKey,
        this.logger,
        signal,
      );
      if (res.success) {
        return res.rates;
      }
    },
  });
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDb,
    private configService: ConfigService,
  ) {}

  getPaymentMethods() {
    const productionProviders = [
      {
        label: 'MTN Mobile Money',
        name: 'momo',
        image:
          'https://upload.wikimedia.org/wikipedia/commons/4/48/Mtn_mobile_money_logo.png',
      },
    ];
    const devProviders = [{ label: 'Virtual Transfers', name: 'virtual' }];
    const ans: any = [...productionProviders];
    if (this.configService.get<string>('NODE_ENV') === 'development')
      ans.push(...devProviders);

    return z.array(PaymentMethodProviderSchema).parse(ans);
  }

  getCurrencies() {
    return from(CountryData).pipe(
      mergeMap((c) => c.currencies ?? []),
      distinct(({ code }) => code),
      toArray(),
    );
  }

  async findUserPaymentMethods(user: number) {
    const paymentMethods = await this.db.query.paymentMethods.findMany({
      columns: {
        provider: true,
        status: true,
      },
      where: (method, { eq }) => eq(method.owner, user),
    });
    return paymentMethods;
  }

  async registerPaymentMethod(
    owner: number,
    provider: PaymentMethodProviderNames,
    params: Record<string, any>,
  ) {
    await this.db.transaction((t) =>
      t
        .insert(paymentMethods)
        .values({
          owner,
          provider,
          status: 'active',
          params,
        })
        .onConflictDoUpdate({
          target: [paymentMethods.provider, paymentMethods.owner],
          set: {
            params: sql.raw(`excluded.${paymentMethods.params.name}`),
            status: sql.raw(`excluded.${paymentMethods.status.name}`),
          },
        }),
    );
  }

  async findPaymentMethodParmsByOwner(
    owner: number,
    provider: PaymentMethodProviderNames,
  ) {
    return await this.db.query.paymentMethods.findFirst({
      columns: { params: true },
      where: (pm, { eq, and }) =>
        and(eq(pm.owner, owner), eq(pm.provider, provider)),
    });
  }

  async collectVirtualFunds(
    currency: string,
    amount: number,
    walletTransaction?: string,
  ) {
    this.logger.log('collecting virtual funds');
    const { XAF } = await this.getExchangeRate(currency, 'XAF');
    const convertedAmount = Number(amount * XAF).toFixed(2);
    const [obj] = await this.db.transaction((t) =>
      t
        .insert(paymentTransactions)
        .values({
          inbound: true,
          currency,
          paymentMethod: 'virtual',
          exchangeRateSnapshot: XAF,
          status: 'complete',
          convertedValue: Number(convertedAmount),
          value: amount,
          completedAt: new Date(),
          walletTransaction,
        })
        .returning({
          id: paymentTransactions.id,
          walletTransaction: paymentTransactions.walletTransaction,
        }),
    );
    return obj;
  }

  async getExchangeRate(src: string, ...dest: string[]) {
    const cacheKey = [src, '-', dest.join(',')].join('');

    if (!this.rateCache.has(cacheKey)) {
      const result = await this.rateCache.fetch(cacheKey);
      return result as Record<string, number>;
    }
    return this.rateCache.get(cacheKey) as Record<string, number>;
  }
}
