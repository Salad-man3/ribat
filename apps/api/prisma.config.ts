import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Generate does not connect; CI and local migrate still use real DATABASE_URL when set.
    url:
      process.env.DATABASE_URL ??
      'postgresql://ribat:ribat@127.0.0.1:5432/ribat',
  },
});
