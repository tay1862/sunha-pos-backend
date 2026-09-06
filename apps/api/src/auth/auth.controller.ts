import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { loginSchema, refreshTokenSchema, signUpSchema } from '@sunha/contracts';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('signup')
  signup(@Body() body: unknown) {
    const parsed = signUpSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('INVALID_SIGNUP');
    return this.auth.signup(parsed.data).then((data) => ({ data }));
  }

  @Post('login')
  login(@Body() body: unknown) {
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('INVALID_LOGIN');
    return this.auth.login(parsed.data).then((data) => ({ data }));
  }

  @Post('refresh')
  refresh(@Body() body: unknown) {
    const parsed = refreshTokenSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('INVALID_REFRESH_REQUEST');
    return this.auth.refresh(parsed.data.refreshToken).then((data) => ({ data }));
  }
}
