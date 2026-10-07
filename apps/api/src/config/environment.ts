import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  DATABASE_HOST: z.string().default('localhost'),
  DATABASE_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  DATABASE_NAME: z.string().default('inventory'),
  DATABASE_USER: z.string().default('inventory'),
  DATABASE_PASSWORD: z.string().min(1).default('inventory_local'),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  OIDC_ISSUER: z.string().url().default('http://localhost:8080/realms/inventory'),
  OIDC_AUDIENCE: z.string().min(1).default('inventory-api'),
  OIDC_JWKS_URI: z.string().url().default('http://localhost:8080/realms/inventory/protocol/openid-connect/certs'),
  OBJECT_STORAGE_ENDPOINT: z.string().url().default('http://localhost:4566'),
  OBJECT_STORAGE_BUCKET: z.string().min(3).default('inventory'),
  OBJECT_STORAGE_ACCESS_KEY: z.string().min(1).default('test'),
  OBJECT_STORAGE_SECRET_KEY: z.string().min(1).default('test'),
  OBJECT_STORAGE_REGION: z.string().default('us-east-1'),
});

export function validateEnvironment(environment: Record<string, unknown>) {
  const parsed = environmentSchema.parse(environment);
  if (parsed.NODE_ENV === 'production' && (!parsed.OIDC_ISSUER.startsWith('https://') || !parsed.OIDC_JWKS_URI.startsWith('https://'))) {
    throw new Error('OIDC_ISSUER and OIDC_JWKS_URI must use HTTPS in production');
  }
  return parsed;
}
