import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import argon2 from 'argon2';
import type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  VerifyEmployeePinInput,
} from '@sunha/contracts';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class EmployeeService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.employee.findMany({
      where: { tenantId },
      select: { id: true, name: true, role: true, active: true, createdAt: true, updatedAt: true },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  }

  async create(tenantId: string, actorId: string, input: CreateEmployeeInput) {
    await this.requireManager(tenantId, actorId);
    const store = await this.prisma.store.findUnique({ where: { tenantId }, select: { id: true } });
    if (!store) throw new NotFoundException('STORE_NOT_FOUND');
    const pinHash = await argon2.hash(input.pin, { type: argon2.argon2id });
    return this.prisma.employee.create({
      data: { tenantId, storeId: store.id, name: input.name, role: input.role, pinHash },
      select: { id: true, name: true, role: true, active: true, createdAt: true },
    });
  }

  async update(tenantId: string, actorId: string, id: string, input: UpdateEmployeeInput) {
    await this.requireManager(tenantId, actorId);
    const employee = await this.prisma.employee.findFirst({ where: { id, tenantId } });
    if (!employee) throw new NotFoundException('EMPLOYEE_NOT_FOUND');
    if (employee.role === 'OWNER') throw new ForbiddenException('OWNER_CANNOT_BE_MODIFIED');
    if (input.active === false) {
      const activeManagers = await this.prisma.employee.count({
        where: { tenantId, role: 'MANAGER', active: true, id: { not: id } },
      });
      if (employee.role === 'MANAGER' && activeManagers === 0)
        throw new ConflictException('LAST_MANAGER_CANNOT_BE_DEACTIVATED');
    }
    const pinHash = input.pin ? await argon2.hash(input.pin, { type: argon2.argon2id }) : undefined;
    return this.prisma.employee.update({
      where: { id },
      data: { name: input.name, role: input.role, active: input.active, pinHash },
      select: { id: true, name: true, role: true, active: true, updatedAt: true },
    });
  }

  async verifyPin(tenantId: string, input: VerifyEmployeePinInput) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: input.employeeId, tenantId, active: true },
    });
    if (!employee || !(await argon2.verify(employee.pinHash, input.pin)))
      throw new UnauthorizedException('INVALID_EMPLOYEE_PIN');
    return { id: employee.id, name: employee.name, role: employee.role };
  }

  private async requireManager(tenantId: string, actorId: string) {
    const actor = await this.prisma.employee.findFirst({
      where: { id: actorId, tenantId, active: true },
    });
    if (!actor || !['OWNER', 'MANAGER'].includes(actor.role))
      throw new ForbiddenException('MANAGER_PERMISSION_REQUIRED');
    return actor;
  }
}
