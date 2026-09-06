import { Injectable } from '@nestjs/common';

type MetricName = 'requests' | 'errors' | 'checkout' | 'sync' | 'receipt' | 'printer';

@Injectable()
export class MetricsService {
  private readonly counters: Record<MetricName, number> = {
    requests: 0,
    errors: 0,
    checkout: 0,
    sync: 0,
    receipt: 0,
    printer: 0,
  };

  observeRequest(statusCode: number, route: string): void {
    this.counters.requests += 1;
    if (statusCode >= 500) this.counters.errors += 1;
    if (route.includes('checkout')) this.counters.checkout += 1;
    if (route.includes('sync')) this.counters.sync += 1;
    if (route.includes('receipt')) this.counters.receipt += 1;
    if (route.includes('printer')) this.counters.printer += 1;
  }

  snapshot(): Readonly<Record<MetricName, number>> {
    return { ...this.counters };
  }
}
