import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionGuard, RequirePermission } from '../auth/permission.guard.js';
import type { AuthClaims } from '../auth/auth.service.js';
import { ReportService } from './report.service.js';
type AuthRequest = FastifyRequest & { user: AuthClaims };
@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ReportController {
  constructor(private readonly reports: ReportService) {}
  @RequirePermission('VIEW_REPORTS')
  @Get('sales')
  sales(@Req() r: AuthRequest, @Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.sales(r.user.tenantId, from, to);
  }

  @RequirePermission('VIEW_REPORTS') @Get('payments') payments(@Req() r: AuthRequest, @Query('from') from?: string, @Query('to') to?: string) { return this.reports.payments(r.user.tenantId, from, to); }
  @RequirePermission('VIEW_REPORTS') @Get('discounts') discounts(@Req() r: AuthRequest, @Query('from') from?: string, @Query('to') to?: string) { return this.reports.discounts(r.user.tenantId, from, to); }
  @RequirePermission('VIEW_REPORTS') @Get('refunds') refunds(@Req() r: AuthRequest, @Query('from') from?: string, @Query('to') to?: string) { return this.reports.refunds(r.user.tenantId, from, to); }
  @RequirePermission('VIEW_REPORTS') @Get('shifts') shifts(@Req() r: AuthRequest, @Query('from') from?: string, @Query('to') to?: string) { return this.reports.shifts(r.user.tenantId, from, to); }
  @RequirePermission('VIEW_REPORTS') @Get('stock') stock(@Req() r: AuthRequest) { return this.reports.stock(r.user.tenantId); }
  @RequirePermission('VIEW_REPORTS') @Get('audit') audit(@Req() r: AuthRequest, @Query('from') from?: string, @Query('to') to?: string) { return this.reports.audit(r.user.tenantId, from, to); }
  @RequirePermission('VIEW_REPORTS') @Get('export.csv') async exportCsv(@Req() r: AuthRequest, @Res({ passthrough: true }) response: FastifyReply, @Query('kind') kind = 'sales', @Query('from') from?: string, @Query('to') to?: string) { response.header('content-type', 'text/csv; charset=utf-8'); return this.reports.csv(r.user.tenantId, kind, from, to); }
}
