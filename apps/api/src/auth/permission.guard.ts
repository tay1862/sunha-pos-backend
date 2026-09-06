import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { PrismaService } from '../database/prisma.service.js';

export const PERMISSION_KEY = 'sunha_permission';
export type Permission =
  | 'SELL'
  | 'VIEW_RECEIPTS'
  | 'APPLY_DISCOUNT'
  | 'REFUND'
  | 'MANAGE_ITEMS'
  | 'MANAGE_STOCK'
  | 'MANAGE_EMPLOYEES'
  | 'MANAGE_SETTINGS'
  | 'VIEW_REPORTS'
  | 'MANAGE_DEVICES';

export const RequirePermission = (permission: Permission) =>
  SetMetadata(PERMISSION_KEY, permission);

const ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  OWNER: [
    'SELL',
    'VIEW_RECEIPTS',
    'APPLY_DISCOUNT',
    'REFUND',
    'MANAGE_ITEMS',
    'MANAGE_STOCK',
    'MANAGE_EMPLOYEES',
    'MANAGE_SETTINGS',
    'VIEW_REPORTS',
    'MANAGE_DEVICES',
  ],
  MANAGER: [
    'SELL',
    'VIEW_RECEIPTS',
    'APPLY_DISCOUNT',
    'REFUND',
    'MANAGE_ITEMS',
    'MANAGE_STOCK',
    'VIEW_REPORTS',
    'MANAGE_DEVICES',
  ],
  CASHIER: ['SELL', 'VIEW_RECEIPTS', 'APPLY_DISCOUNT'],
};

type RequestWithUser = FastifyRequest & {
  user: { tenantId: string };
  employee?: { id: string; storeId: string; role: string };
};

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<Permission>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permission) return true;
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const employeeId = request.headers['x-employee-id'];
    if (typeof employeeId !== 'string') throw new ForbiddenException('EMPLOYEE_REQUIRED');
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId: request.user.tenantId, active: true },
      select: { id: true, storeId: true, role: true },
    });
    if (!employee || !ROLE_PERMISSIONS[employee.role]?.includes(permission))
      throw new ForbiddenException('PERMISSION_DENIED');
    request.employee = employee;
    return true;
  }
}
