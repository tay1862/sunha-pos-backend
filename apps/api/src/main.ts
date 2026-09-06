import crypto from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { IncomingMessage } from 'node:http';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';
  const bodyLimit = Number(process.env.BODY_LIMIT_BYTES ?? 1_048_576);
  if (!Number.isSafeInteger(bodyLimit) || bodyLimit < 16_384) {
    throw new Error('BODY_LIMIT_BYTES must be a safe integer of at least 16384');
  }
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit,
      requestIdHeader: 'x-correlation-id',
      genReqId: (request: IncomingMessage) =>
        request.headers['x-correlation-id']?.toString() ?? crypto.randomUUID(),
      logger: {
        level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'warn'),
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          '*.password',
          '*.pin',
          '*.token',
        ],
      },
    }),
  );
  const server = app.getHttpAdapter().getInstance();
  await server.register(helmet as unknown as Parameters<typeof server.register>[0], {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
  await server.register(rateLimit as unknown as Parameters<typeof server.register>[0], {
    global: true,
    max: Number(process.env.RATE_LIMIT_MAX ?? 120),
    timeWindow: process.env.RATE_LIMIT_WINDOW ?? '1 minute',
    ban: 2,
    allowList: ['/v1/health', '/v1/health/ready'],
  });
  server.addHook('onSend', async (request, reply) => {
    reply.header('x-correlation-id', request.id);
  });
  server.addHook('preSerialization', (_request, _reply, payload, done) => {
    try {
      const json = JSON.stringify(payload, (_key, value: unknown) =>
        typeof value === 'bigint' ? value.toString() : value,
      );
      done(null, json === undefined ? payload : JSON.parse(json));
    } catch (error) {
      done(error instanceof Error ? error : new Error('SERIALIZATION_FAILED'));
    }
  });
  app.setGlobalPrefix('v1');
  const configuredOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: configuredOrigins.length > 0 ? configuredOrigins : isProduction ? false : true,
    credentials: true,
  });
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3001), process.env.HOST ?? '0.0.0.0');
}

void bootstrap();
