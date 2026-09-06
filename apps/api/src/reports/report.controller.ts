import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthClaims } from '../auth/auth.service.js';
import { ReportService } from './report.service.js';
type AuthRequest = FastifyRequest & { user: AuthClaims };
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportController {
  constructor(private readonly reports: ReportService) {}
  @Get('sales') sales(
    @Req() r: AuthRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.sales(r.user.tenantId, from, to);
  }
}
