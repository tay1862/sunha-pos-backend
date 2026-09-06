import { createHash, randomBytes } from 'node:crypto';
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import argon2 from 'argon2';
import { SignJWT, jwtVerify } from 'jose';
import type { LoginInput, SignUpInput, StoreSettings } from '@sunha/contracts';
import { PrismaService } from '../database/prisma.service.js';
import type { EmailDelivery } from './email.service.js';

export type AuthUser = { id: string; email: string; tenantId: string };
export type AuthStore = StoreSettings & { id: string; tenantId: string };
export type AuthResult = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
  store: AuthStore;
  ownerEmployeeId?: string;
  ownerDeviceId?: string;
  verificationToken?: string;
};
export type AuthClaims = AuthUser & { sub: string };

type StoredUser = AuthUser & { passwordHash: string; store: AuthStore; ownerEmployeeId?: string; ownerDeviceId?: string };
type StoredSession = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

export interface AuthRepository {
  findUserByEmail(email: string): Promise<StoredUser | null>;
  findUserById(id: string): Promise<StoredUser | null>;
  createSignup(input: {
    email: string;
    passwordHash: string;
    businessName: string;
    deviceName: string;
    publicKey?: string;
  }): Promise<StoredUser>;
  createSession(value: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  findSession(tokenHash: string): Promise<StoredSession | null>;
  revokeSession(id: string): Promise<void>;
  createAuthToken(value: {
    userId: string;
    type: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET';
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  consumeAuthToken(
    tokenHash: string,
    type: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET',
  ): Promise<string | null>;
  markEmailVerified(userId: string): Promise<void>;
  revokeAllSessions(userId: string): Promise<void>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
}

const configuredSecret = process.env.JWT_SECRET;
if (process.env.NODE_ENV === 'production' && (!configuredSecret || configuredSecret.length < 32))
  throw new Error('JWT_SECRET must be at least 32 characters in production');
const secret = new TextEncoder().encode(
  configuredSecret ?? 'sunha-local-development-secret-change-me',
);
const accessTokenSeconds = 900;
const refreshTokenDays = 30;

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        tenant: {
          include: { store: true, employees: { where: { role: 'OWNER' }, select: { id: true } } },
        },
      },
    });
    return user?.tenant.store
      ? this.mapUser(user, user.tenant.store, user.tenant.employees[0]?.id)
      : null;
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        tenant: {
          include: { store: true, employees: { where: { role: 'OWNER' }, select: { id: true } } },
        },
      },
    });
    return user?.tenant.store
      ? this.mapUser(user, user.tenant.store, user.tenant.employees[0]?.id)
      : null;
  }

  async createSignup(input: {
    email: string;
    passwordHash: string;
    businessName: string;
    deviceName: string;
    publicKey?: string;
  }): Promise<StoredUser> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: input.email } });
      if (existing) throw new ConflictException('EMAIL_ALREADY_REGISTERED');
      const tenant = await tx.tenant.create({
        data: { businessName: input.businessName, country: 'LA' },
      });
      const store = await tx.store.create({
        data: { tenantId: tenant.id, name: input.businessName },
      });
      const user = await tx.user.create({
        data: { tenantId: tenant.id, email: input.email, passwordHash: input.passwordHash },
      });
      const owner = await tx.employee.create({
        data: {
          tenantId: tenant.id,
          storeId: store.id,
          name: 'Owner',
          role: 'OWNER',
          pinHash: await argon2.hash(randomBytes(32).toString('hex'), { type: argon2.argon2id }),
        },
      });
      const device = await tx.device.create({
        data: {
          tenantId: tenant.id,
          storeId: store.id,
          name: input.deviceName,
          publicKey: input.publicKey,
          status: 'ACTIVE',
          offlineLeaseExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          lastSeenAt: new Date(),
          employees: { create: { employeeId: owner.id } },
        },
        select: { id: true },
      });
      return this.mapUser(user, store, owner.id, device.id);
    });
  }

  createSession(value: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    return this.prisma.authSession.create({ data: value }).then(() => undefined);
  }

  findSession(tokenHash: string): Promise<StoredSession | null> {
    return this.prisma.authSession.findUnique({ where: { tokenHash } });
  }

  revokeSession(id: string): Promise<void> {
    return this.prisma.authSession
      .update({ where: { id }, data: { revokedAt: new Date() } })
      .then(() => undefined);
  }

  createAuthToken(value: {
    userId: string;
    type: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET';
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    return this.prisma.authToken.create({ data: value }).then(() => undefined);
  }

  async consumeAuthToken(
    tokenHash: string,
    type: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET',
  ): Promise<string | null> {
    const token = await this.prisma.authToken.findFirst({
      where: { tokenHash, type, usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!token) return null;
    const updated = await this.prisma.authToken.updateMany({
      where: { id: token.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    return updated.count === 1 ? token.userId : null;
  }

  markEmailVerified(userId: string): Promise<void> {
    return this.prisma.user
      .update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } })
      .then(() => undefined);
  }

  revokeAllSessions(userId: string): Promise<void> {
    return this.prisma.authSession
      .updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })
      .then(() => undefined);
  }

  updatePassword(userId: string, passwordHash: string): Promise<void> {
    return this.prisma.user
      .update({ where: { id: userId }, data: { passwordHash } })
      .then(() => undefined);
  }

  private mapUser(
    user: { id: string; email: string; tenantId: string; passwordHash: string },
    store: {
      id: string;
      tenantId: string;
      name: string;
      address: string;
      phone: string;
      taxNumber: string;
      currency: string;
      timezone: string;
      language: string;
    },
    ownerEmployeeId?: string,
    ownerDeviceId?: string,
  ): StoredUser {
    return {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      passwordHash: user.passwordHash,
      ownerEmployeeId,
      ownerDeviceId,
      store: {
        id: store.id,
        tenantId: store.tenantId,
        name: store.name,
        address: store.address,
        phone: store.phone,
        taxNumber: store.taxNumber,
        currency: 'LAK',
        timezone: store.timezone,
        language: store.language === 'en' ? 'en' : 'lo',
      },
    };
  }
}

@Injectable()
export class AuthService {
  constructor(private readonly repository: AuthRepository, private readonly email?: EmailDelivery) {}

  async signup(input: SignUpInput): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const user = await this.repository.createSignup({
      email,
      passwordHash,
      businessName: input.businessName.trim(),
      deviceName: input.deviceName ?? 'Owner device',
      publicKey: input.publicKey,
    });
    const verificationToken = randomBytes(32).toString('base64url');
    await this.repository.createAuthToken({
      userId: user.id,
      type: 'EMAIL_VERIFICATION',
      tokenHash: hashToken(verificationToken),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await this.email?.sendVerification(email, verificationToken);
    return this.issue(
      user,
      process.env.AUTH_TOKEN_OUTPUT === 'true' ? verificationToken : undefined,
    );
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.repository.findUserByEmail(input.email.trim().toLowerCase());
    if (!user || !(await argon2.verify(user.passwordHash, input.password)))
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    return this.issue(user);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const session = await this.repository.findSession(hashToken(refreshToken));
    if (!session || session.revokedAt || session.expiresAt <= new Date())
      throw new UnauthorizedException('INVALID_REFRESH_TOKEN');
    await this.repository.revokeSession(session.id);
    const user = await this.repository.findUserById(session.userId);
    if (!user) throw new UnauthorizedException('INVALID_REFRESH_TOKEN');
    return this.issue(user);
  }

  async logout(refreshToken: string): Promise<void> {
    const session = await this.repository.findSession(hashToken(refreshToken));
    if (session) await this.repository.revokeSession(session.id);
  }

  async verifyEmail(token: string): Promise<void> {
    const userId = await this.repository.consumeAuthToken(hashToken(token), 'EMAIL_VERIFICATION');
    if (!userId) throw new UnauthorizedException('INVALID_EMAIL_VERIFICATION_TOKEN');
    await this.repository.markEmailVerified(userId);
  }

  async requestPasswordReset(email: string): Promise<{ resetToken?: string }> {
    const user = await this.repository.findUserByEmail(email.trim().toLowerCase());
    if (!user) return {};
    const token = randomBytes(32).toString('base64url');
    await this.repository.createAuthToken({
      userId: user.id,
      type: 'PASSWORD_RESET',
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    await this.email?.sendPasswordReset(user.email, token);
    return process.env.AUTH_TOKEN_OUTPUT === 'true' ? { resetToken: token } : {};
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const userId = await this.repository.consumeAuthToken(hashToken(token), 'PASSWORD_RESET');
    if (!userId) throw new UnauthorizedException('INVALID_PASSWORD_RESET_TOKEN');
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await this.repository.updatePassword(userId, passwordHash);
    await this.repository.revokeAllSessions(userId);
  }

  private async issue(user: StoredUser, verificationToken?: string): Promise<AuthResult> {
    const claims: AuthClaims = {
      sub: user.id,
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
    };
    const accessToken = await new SignJWT(claims)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('sunha-pos')
      .setAudience('sunha-pos')
      .setIssuedAt()
      .setExpirationTime(`${accessTokenSeconds}s`)
      .sign(secret);
    const refreshToken = randomBytes(32).toString('base64url');
    await this.repository.createSession({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + refreshTokenDays * 86400000),
    });
    return {
      accessToken,
      refreshToken,
      expiresIn: accessTokenSeconds,
      user: { id: user.id, email: user.email, tenantId: user.tenantId },
      store: user.store,
      ownerEmployeeId: user.ownerEmployeeId,
      ownerDeviceId: user.ownerDeviceId,
      verificationToken,
    };
  }
}

export function verifyAccessToken(token: string): Promise<AuthClaims> {
  return jwtVerify<AuthClaims>(token, secret, { issuer: 'sunha-pos', audience: 'sunha-pos' }).then(
    (result) => result.payload as AuthClaims,
  );
}

function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
