import { Controller, Get } from '@nestjs/common';
import { MetricsService } from './metrics.service.js';

@Controller('health')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('metrics')
  metricsSnapshot() {
    return { status: 'ok', metrics: this.metrics.snapshot() };
  }
}
