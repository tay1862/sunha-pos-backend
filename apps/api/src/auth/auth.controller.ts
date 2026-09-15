import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import {
  authTokenSchema,
  loginSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  refreshTokenSchema,
  signUpSchema,
} from '@sunha/contracts';
import { AuthService, type AuthResult } from './auth.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { createHash, randomBytes } from 'node:crypto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  private async ownerSession(data: AuthResult) {
    if (!data.ownerEmployeeId || !data.ownerDeviceId) return { data };
    const device = await this.prisma.device.findFirst({
      where: { id: data.ownerDeviceId, tenantId: data.user.tenantId, status: 'ACTIVE' },
    });
    if (!device) return { data };
    const employeeSessionToken = randomBytes(32).toString('base64url');
    await this.prisma.employeeSession.create({
      data: {
        employeeId: data.ownerEmployeeId,
        deviceId: device.id,
        tokenHash: createHash('sha256').update(employeeSessionToken).digest('hex'),
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      },
    });
    return { data: { ...data, employeeSessionToken } };
  }

  @Post('signup')
  signup(@Body() body: unknown) {
    const parsed = signUpSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('INVALID_SIGNUP');
    return this.auth.signup(parsed.data).then((data) => this.ownerSession(data));
  }

  @Post('login')
  login(@Body() body: unknown) {
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('INVALID_LOGIN');
    return this.auth.login(parsed.data).then((data) => this.ownerSession(data));
  }

  @Post('refresh')
  refresh(@Body() body: unknown) {
    const parsed = refreshTokenSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('INVALID_REFRESH_REQUEST');
    return this.auth.refresh(parsed.data.refreshToken).then((data) => ({ data }));
  }

  @Post('logout')
  async logout(@Body() body: unknown) {
    const parsed = refreshTokenSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('INVALID_LOGOUT_REQUEST');
    await this.auth.logout(parsed.data.refreshToken);
    return { data: { success: true } };
  }

  @Post('verify-email')
  async verifyEmail(@Body() body: unknown) {
    const parsed = authTokenSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('INVALID_VERIFICATION_REQUEST');
    await this.auth.verifyEmail(parsed.data.token);
    return { data: { success: true } };
  }

  @Post('password-reset/request')
  requestPasswordReset(@Body() body: unknown) {
    const parsed = passwordResetRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('INVALID_PASSWORD_RESET_REQUEST');
    return this.auth
      .requestPasswordReset(parsed.data.email)
      .then((data) => ({ data: { accepted: true, ...data } }));
  }

  @Post('password-reset/confirm')
  async resetPassword(@Body() body: unknown) {
    const parsed = passwordResetSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('INVALID_PASSWORD_RESET_REQUEST');
    await this.auth.resetPassword(parsed.data.token, parsed.data.password);
    return { data: { success: true } };
  }
}
