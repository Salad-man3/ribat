import { productionEnvBlockReason, type Env } from './env';

const base: Env = {
  DATABASE_URL: 'postgresql://ribat:secret@127.0.0.1:5435/ribat',
  REDIS_URL: 'redis://127.0.0.1:16379',
  SESSION_SECRET: 'long-random-production-secret',
  DEPLOY_MODE: 'self_host',
  APP_URL: 'https://example.com',
  PORT: 3000,
  LOG_LEVEL: 'info',
  NODE_ENV: 'development',
  SERVE_WEB: false,
  API_DOCS: false,
  TWA_PACKAGE_NAME: 'app.ribat.android',
  TWA_SHA256_CERT_FINGERPRINTS: [],
  JOBS_WORKER: 'off',
};

describe('productionEnvBlockReason', () => {
  it('allows development with example secrets', () => {
    expect(
      productionEnvBlockReason({
        ...base,
        SESSION_SECRET: 'local-dev-change-me-before-production',
        DATABASE_URL: 'postgresql://ribat:ribat@127.0.0.1:5435/ribat',
      }),
    ).toBeNull();
  });

  it('blocks example session secret in production', () => {
    expect(
      productionEnvBlockReason({
        ...base,
        NODE_ENV: 'production',
        SESSION_SECRET: 'local-dev-change-me-before-production',
      }),
    ).toMatch(/SESSION_SECRET/);
  });

  it('blocks example database password in production', () => {
    expect(
      productionEnvBlockReason({
        ...base,
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://ribat:ribat@postgres:5432/ribat',
      }),
    ).toMatch(/ribat/);
  });
});
