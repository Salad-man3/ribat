import { z } from 'zod';

/** `z.coerce.boolean()` reads the string "false" as true; environment flags need this instead. */
const flag = z
  .enum(['true', 'false', '1', '0', ''])
  .default('false')
  .transform((v) => v === 'true' || v === '1');

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(1),
  DEPLOY_MODE: z.enum(['self_host', 'hosted'] as const).default('self_host'),
  APP_URL: z.string().url().default('http://localhost:5173'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const)
    .default('info'),
  NODE_ENV: z
    .enum(['development', 'test', 'production'] as const)
    .default('development'),
  SERVE_WEB: flag,
  /** Swagger UI at /api/docs and the spec at /api/docs-json. On for the public demo only (06-api-outline). */
  API_DOCS: flag,
  WEB_DIST_PATH: z.string().optional(),
  /** Android TWA package id; served in /.well-known/assetlinks.json when fingerprints are set. */
  TWA_PACKAGE_NAME: z.string().min(1).default('app.ribat.android'),
  /** Comma-separated SHA-256 cert fingerprints (upload keystore and Play App Signing). */
  TWA_SHA256_CERT_FINGERPRINTS: z
    .string()
    .default('')
    .transform((s) =>
      s
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean),
    ),
  /**
   * BullMQ worker (ADR-0006): `inline` runs it inside the API process (dev, single-container
   * demo), `only` boots a worker-only process, `off` runs no worker (the API with a separate
   * worker service, and e2e tests).
   */
  JOBS_WORKER: z.enum(['inline', 'only', 'off'] as const).default('inline'),
});

export type Env = z.infer<typeof envSchema>;

const EXAMPLE_SESSION_SECRET = 'local-dev-change-me-before-production';

function databasePassword(databaseUrl: string): string | null {
  try {
    const u = new URL(databaseUrl.replace(/^postgresql:\/\//, 'http://'));
    return u.password ? decodeURIComponent(u.password) : null;
  } catch {
    return null;
  }
}

/** Returns a human-readable reason when production must not start; null when ok. */
export function productionEnvBlockReason(env: Env): string | null {
  if (env.NODE_ENV !== 'production') return null;
  if (env.SESSION_SECRET === EXAMPLE_SESSION_SECRET) {
    return 'SESSION_SECRET is still the .env.example placeholder';
  }
  if (databasePassword(env.DATABASE_URL) === 'ribat') {
    return 'DATABASE_URL uses the example dev password "ribat"';
  }
  return null;
}

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(
      'Invalid environment configuration:',
      parsed.error.flatten().fieldErrors,
    );
    process.exit(1);
  }
  const block = productionEnvBlockReason(parsed.data);
  if (block) {
    console.error(`Refusing to start in production: ${block}`);
    process.exit(1);
  }
  return parsed.data;
}
