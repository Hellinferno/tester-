/**
 * Centralized, validated environment config for the JS/TS side (Next.js on Vercel).
 * Mirrors packages/shared-python settings. Import `env` and read typed fields.
 */
import { z } from 'zod';

const bool = z.preprocess((v) => v === true || v === 'true', z.boolean());

const schema = z.object({
  appEnv: z.enum(['development', 'staging', 'production']).default('development'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Supabase
  supabaseUrl: z.string().url(),
  supabaseAnonKey: z.string().min(1),
  supabaseServiceRoleKey: z.string().default(''),
  databaseUrl: z.string().optional(),

  // Upstash / Redis
  redisUrl: z.string().optional(),
  upstashRedisRestUrl: z.string().optional(),
  upstashRedisRestToken: z.string().optional(),

  // Service URLs
  orchestratorUrl: z.string().url(),
  ocrServiceUrl: z.string().url(),
  sttServiceUrl: z.string().url(),
  analysisEngineUrl: z.string().url(),
  routerServiceUrl: z.string().url(),
  serviceAuthToken: z.string().min(1),

  // OpenRouter
  openrouterApiKey: z.string().optional(),
  openrouterApiKeys: z.string().optional(),
  openrouterBaseUrl: z.string().url().default('https://openrouter.ai/api/v1'),
  analysisSlmModel: z.string().default('meta-llama/llama-3.1-8b-instruct'),
  openrouterTimeoutMs: z.coerce.number().int().positive().default(30_000),
  openrouterMaxRetries: z.coerce.number().int().nonnegative().default(3),

  // Deepgram / Google
  deepgramApiKey: z.string().optional(),
  googleSearchApiKey: z.string().optional(),
  googleSearchCx: z.string().optional(),
  googleMapsApiKey: z.string().optional(),

  // Limits
  maxImageSizeBytes: z.coerce.number().int().positive().default(20 * 1024 * 1024),
  maxVoiceDurationSeconds: z.coerce.number().int().positive().default(300),
  maxTextLength: z.coerce.number().int().positive().default(32_000),
  rateLimitPerMinute: z.coerce.number().int().positive().default(100),
  rateLimitApiKeyPerMinute: z.coerce.number().int().positive().default(1000),

  // Storage
  storageBucketImages: z.string().default('images'),
  storageBucketAudio: z.string().default('audio'),

  // CORS
  corsAllowedOrigins: z.string().default('http://localhost:3000'),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/**
 * Parse + validate process.env. Throws with a readable message if required
 * vars are missing. Cache the result per process.
 */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  if (cached) return cached;

  const parsed = schema.safeParse(mapEnv(source));
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Validate arbitrary env values without touching process.env or the cache. Tests only. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  return schema.parse(mapEnv(source));
}

/** Reset the cache — tests only. */
export function _resetEnvCache(): void {
  cached = null;
}

function mapEnv(source: Record<string, string | undefined>): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  const keys: Array<keyof Env> = [
    'appEnv', 'logLevel', 'supabaseUrl', 'supabaseAnonKey', 'supabaseServiceRoleKey',
    'databaseUrl', 'redisUrl', 'upstashRedisRestUrl', 'upstashRedisRestToken',
    'orchestratorUrl', 'ocrServiceUrl', 'sttServiceUrl', 'analysisEngineUrl',
    'routerServiceUrl', 'serviceAuthToken', 'openrouterApiKey', 'openrouterApiKeys',
    'openrouterBaseUrl', 'analysisSlmModel', 'openrouterTimeoutMs', 'openrouterMaxRetries',
    'deepgramApiKey', 'googleSearchApiKey', 'googleSearchCx', 'googleMapsApiKey',
    'maxImageSizeBytes', 'maxVoiceDurationSeconds', 'maxTextLength',
    'rateLimitPerMinute', 'rateLimitApiKeyPerMinute', 'storageBucketImages',
    'storageBucketAudio', 'corsAllowedOrigins',
  ];
  for (const k of keys) {
    const upper = k.replace(/[A-Z]/g, (m) => '_' + m).toUpperCase();
    const v = source[upper] ?? source[k];
    if (v !== undefined) picked[k] = v;
  }
  return picked;
}

export { schema as envSchema };
