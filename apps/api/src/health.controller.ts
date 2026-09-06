import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './database/prisma.service.js';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  health(): { status: 'ok'; service: 'sunha-api'; database: 'not_checked' } {
    return { status: 'ok', service: 'sunha-api', database: 'not_checked' };
  }

  @Get('health/ready')
  async readiness(): Promise<{ status: 'ready' | 'not_ready'; database: 'ok' | 'unavailable' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', database: 'ok' };
    } catch {
      return { status: 'not_ready', database: 'unavailable' };
    }
  }
}
