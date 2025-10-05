import { logger } from '../lib/logger.ts';

type RatesResponse = {
  data?: {
    rates?: Record<string, string>;
  };
};

type CachedPrice = {
  value: number;
  fetchedAt: number;
};

/**
 * PriceService handles Coinbase rate fetching and pricing calculations
 */
export class PriceService {
  private readonly COINBASE_URL = 'https://api.coinbase.com/v2/exchange-rates?currency=BTC';
  private readonly cacheTtlMs: number;
  private cache: Map<string, CachedPrice> = new Map();

  constructor(cacheTtlSeconds = 60) {
    this.cacheTtlMs = cacheTtlSeconds * 1000;
  }

  /**
   * Get current BTC price for a fiat currency (e.g. USD, EUR)
   * Caches results for a short TTL to reduce rate-limit pressure
   */
  public async getBtcPrice(fiatCurrency: string): Promise<number> {
    const currency = fiatCurrency.toUpperCase();
    const cached = this.cache.get(currency);
    const now = Date.now();
    if (cached && now - cached.fetchedAt < this.cacheTtlMs) {
      return cached.value;
    }

    try {
      const resp = await fetch(this.COINBASE_URL, { method: 'GET' });
      if (!resp.ok) {
        throw new Error(`Coinbase responded ${resp.status}`);
      }
      const data = (await resp.json()) as RatesResponse;
      const raw = data?.data?.rates?.[currency];
      const price = raw ? parseFloat(raw) : NaN;
      if (!price || Number.isNaN(price)) {
        throw new Error(`Missing/invalid rate for ${currency}`);
      }
      this.cache.set(currency, { value: price, fetchedAt: now });
      return price;
    } catch (error) {
      logger.error('Failed to fetch BTC price from Coinbase:', error);
      throw new Error('Failed to fetch BTC price');
    }
  }

  /**
   * Apply margin to a BTC price and compute derived amounts (Laravel parity)
   * - Negative margin: discount price, increase fiat
   * - Positive margin: increase price, decrease fiat portion
   */
  public calculatePricing(marginPct: number, currentBtcPrice: number, fiatAmount: number) {
    const margin = Number(marginPct);
    const price =
      margin < 0
        ? ((100 - Math.abs(margin)) / 100) * currentBtcPrice
        : ((100 + margin) / 100) * currentBtcPrice;

    const fiatAmountWithMargin =
      margin < 0
        ? ((100 + Math.abs(margin)) / 100) * fiatAmount
        : ((100 - Math.abs(margin)) / 100) * fiatAmount;

    const btcAmountWithMargin = fiatAmountWithMargin / currentBtcPrice;
    const roundedPrice = Math.round(price * 100) / 100; // 2 dp
    const roundedFiat = Math.round(fiatAmountWithMargin * 100) / 100; // 2 dp
    const roundedBtc = Math.round(btcAmountWithMargin * 1e8) / 1e8; // 8 dp

    return {
      price: roundedPrice,
      fiat_amount_with_margin: roundedFiat,
      btc_amount_with_margin: roundedBtc,
    };
  }

  /**
   * Convert fiat to BTC using the current market price
   */
  public convertFiatToBtc(fiatAmount: number, currentBtcPrice: number): number {
    const btc = fiatAmount / currentBtcPrice;
    return Math.round(btc * 1e8) / 1e8;
  }
}
