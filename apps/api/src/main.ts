import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('preSerialization', (_request, _reply, payload, done) => {
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
  app.enableCors();
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3001), process.env.HOST ?? '0.0.0.0');
}

void bootstrap();
