import { BadRequestException, Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { cashMovementSchema, closeShiftSchema, openShiftSchema } from '@sunha/contracts';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthClaims } from '../auth/auth.service.js';
import { ShiftService } from './shift.service.js';
type AuthRequest = FastifyRequest & { user: AuthClaims };
@Controller('shifts')
@UseGuards(JwtAuthGuard)
export class ShiftController {
  constructor(private readonly shifts: ShiftService) {}
  @Post('open') open(@Req() r: AuthRequest, @Body() body: unknown) {
    const p = openShiftSchema.safeParse(body);
    if (!p.success) throw new BadRequestException('INVALID_OPEN_SHIFT');
    return this.shifts.open(r.user.tenantId, String(r.headers['x-employee-id']), p.data);
  }
  @Post('cash-movements') movement(@Req() r: AuthRequest, @Body() body: unknown) {
    const p = cashMovementSchema.safeParse(body);
    if (!p.success) throw new BadRequestException('INVALID_CASH_MOVEMENT');
    return this.shifts.movement(r.user.tenantId, String(r.headers['x-employee-id']), p.data);
  }
  @Post('close') close(@Req() r: AuthRequest, @Body() body: unknown) {
    const p = closeShiftSchema.safeParse(body);
    if (!p.success) throw new BadRequestException('INVALID_CLOSE_SHIFT');
    return this.shifts.close(r.user.tenantId, String(r.headers['x-employee-id']), p.data);
  }
}
