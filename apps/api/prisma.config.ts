import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Prisma Client generation does not connect to the database. The CLI uses the
  // real DATABASE_URL for migrate commands when it is present at runtime.
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://placeholder:placeholder@localhost:5432/sunha',
  },
});
