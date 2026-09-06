import { BadRequestException, Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { checkoutOrderSchema } from '@sunha/contracts';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionGuard, RequirePermission } from '../auth/permission.guard.js';
import type { AuthClaims } from '../auth/auth.service.js';
import { OrderService } from './order.service.js';
type AuthRequest = FastifyRequest & { user: AuthClaims };
@Controller('orders')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class OrderController {
  constructor(private readonly orders: OrderService) {}
  @RequirePermission('SELL')
  @Post('checkout')
  checkout(@Req() request: AuthRequest, @Body() body: unknown) {
    const parsed = checkoutOrderSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('INVALID_CHECKOUT');
    const employeeId = request.headers['x-employee-id'];
    if (typeof employeeId !== 'string') throw new BadRequestException('EMPLOYEE_REQUIRED');
    return this.orders.checkout(request.user.tenantId, employeeId, parsed.data);
  }
}
