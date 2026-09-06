import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  verifyEmployeePinSchema,
} from '@sunha/contracts';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthClaims } from '../auth/auth.service.js';
import { EmployeeService } from './employee.service.js';

type AuthRequest = FastifyRequest & { user: AuthClaims };

@Controller('employees')
@UseGuards(JwtAuthGuard)
export class EmployeeController {
  constructor(private readonly employees: EmployeeService) {}

  @Get()
  list(@Req() request: AuthRequest) {
    return this.employees.list(request.user.tenantId);
  }

  @Post()
  create(@Req() request: AuthRequest, @Body() body: unknown) {
    const parsed = createEmployeeSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('INVALID_EMPLOYEE');
    return this.employees.create(request.user.tenantId, this.actor(request), parsed.data);
  }

  @Patch(':id')
  update(@Req() request: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    const parsed = updateEmployeeSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('INVALID_EMPLOYEE');
    return this.employees.update(request.user.tenantId, this.actor(request), id, parsed.data);
  }

  @Post('verify-pin')
  verifyPin(@Req() request: AuthRequest, @Body() body: unknown) {
    const parsed = verifyEmployeePinSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('INVALID_EMPLOYEE_PIN');
    return this.employees.verifyPin(request.user.tenantId, parsed.data);
  }

  private actor(request: AuthRequest): string {
    const actor = request.headers['x-employee-id'];
    if (typeof actor !== 'string') throw new BadRequestException('EMPLOYEE_REQUIRED');
    return actor;
  }
}
