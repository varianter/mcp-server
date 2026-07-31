// Config holds runtime configuration loaded from environment variables plus optional
// committed mcp-server.config.json defaults. Environment variables always win.
//
// There is no separate auth on/off flag: AUTH_PROVIDER defaults to "none" (auth disabled) and
// selecting any real provider is what turns auth on — see validateConfig. Setting
// AUTH_ISSUER_URL/AUTH_CLIENT_ID without picking a provider is rejected rather than guessed.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import { z } from 'zod';
import { AUTH_PROVIDER_KINDS } from '../auth/adapters.js';

/** `none` means auth is disabled; every other value is a real, verifiable provider. */
export const AUTH_PROVIDER_SELECTION_VALUES = ['none', ...AUTH_PROVIDER_KINDS] as const;
export type AuthProviderSelection = (typeof AUTH_PROVIDER_SELECTION_VALUES)[number];

export const CLIENT_REGISTRATION_VALUES = ['none', 'provider', 'static'] as const;
export type ClientRegistration = (typeof CLIENT_REGISTRATION_VALUES)[number];

export interface Config {
  host: string;
  port: number;
  mcpPath: string;
  publicUrl: string;
  allowedRedirectOrigins: string[];
  mcpMaxSessions: number;
  rateLimitPerMinute: number;
  trustProxy: string | number | boolean;
  auth: {
    /** `none` (the default) means auth is disabled; any other value turns it on. */
    provider: AuthProviderSelection;
    issuerUrl: string;
    clientId: string;
    clientSecret: string;
    audience: string;
    /** Additional JWT audiences to accept, beyond provider defaults. */
    acceptedAudiences: string[];
    /** Additional JWT issuers to accept, beyond provider defaults. */
    acceptedIssuers: string[];
    scopes: string[];
    /** Extra scope names to rewrite to `{clientId}/.default` (Entra compatibility proxy only). */
    scopeAliases: string[];
    compatibilityProxy: boolean;
    /** `static` exposes local /register returning AUTH_CLIENT_ID for Claude/MCP clients. */
    clientRegistration: ClientRegistration;
  };
}

export type ConfigOverrides = Partial<Omit<Config, 'auth'>> & {
  auth?: Partial<Config['auth']>;
};

const MCP_SERVER_CONFIG_FILE_AUTH_SCHEMA = z
  .object({
    provider: z.enum(AUTH_PROVIDER_SELECTION_VALUES),
    tenantId: z.string(),
    issuerUrl: z.string(),
    clientId: z.string(),
    audience: z.string(),
    acceptedAudiences: z.array(z.string()),
    acceptedIssuers: z.array(z.string()),
    scopes: z.array(z.string()),
    scopeAliases: z.array(z.string()),
    compatibilityProxy: z.boolean(),
    clientRegistration: z.enum(CLIENT_REGISTRATION_VALUES),
    allowedRedirectOrigins: z.array(z.string()),
  })
  .partial()
  .strict();

/** Schema for `mcp-server.config.json` / `mcp-server.config.local.json`. Also published as
 *  `mcp-server.config.schema.json` (see scripts/generate-config-schema.mjs) for editor
 *  autocomplete via a `$schema` reference in the config file. */
export const McpServerConfigFileSchema = z
  .object({
    $schema: z.string(),
    mcpPath: z.string(),
    auth: MCP_SERVER_CONFIG_FILE_AUTH_SCHEMA,
    limits: z
      .object({
        maxSessions: z.number().int().positive(),
        rateLimitPerMinute: z.number().int().positive(),
      })
      .partial()
      .strict(),
  })
  .partial()
  .strict();

export type McpServerConfigFile = z.infer<typeof McpServerConfigFileSchema>;

export function loadConfig(overrides: ConfigOverrides = {}): Config {
  const fileConfig = loadMcpServerConfigFile();

  const host = process.env.HOST ?? '0.0.0.0';
  const port = parsePort(process.env.PORT);
  const mcpPath = parseMcpPath(process.env.MCP_PATH ?? fileConfig.mcpPath ?? '/mcp');

  const provider = parseProvider(process.env.AUTH_PROVIDER ?? fileConfig.auth?.provider ?? 'none');
  const clientId = process.env.AUTH_CLIENT_ID ?? fileConfig.auth?.clientId ?? '';
  const tenantId = process.env.AUTH_TENANT_ID ?? fileConfig.auth?.tenantId;
  const issuerUrl =
    process.env.AUTH_ISSUER_URL ??
    fileConfig.auth?.issuerUrl ??
    (tenantId ? `https://login.microsoftonline.com/${tenantId}/v2.0` : '');
  const clientSecret = process.env.AUTH_CLIENT_SECRET ?? '';
  const scopes = parseScopes(
    process.env.AUTH_SCOPES ??
      fileConfig.auth?.scopes?.join(' ') ??
      defaultScopes(clientId, provider),
  );

  const scopeAliases = parseCsvOrArray(
    process.env.AUTH_SCOPE_ALIASES,
    fileConfig.auth?.scopeAliases,
  );
  const compatibilityProxy = parseAuthCompatibilityProxy(
    process.env.AUTH_COMPATIBILITY_PROXY,
    provider,
    fileConfig.auth?.compatibilityProxy,
  );
  const defaultPublicHost = host === '0.0.0.0' ? 'localhost' : host;

  const allowedRedirectOrigins = parseCsvOrArray(
    process.env.AUTH_ALLOWED_REDIRECT_ORIGINS,
    fileConfig.auth?.allowedRedirectOrigins ?? [
      'http://localhost',
      'http://127.0.0.1',
      'https://claude.ai',
    ],
  );

  const config: Config = {
    host,
    port,
    mcpPath,
    publicUrl: parseUrl(
      process.env.PUBLIC_URL ?? `http://${defaultPublicHost}:${port}`,
      'PUBLIC_URL',
    ),
    allowedRedirectOrigins,
    mcpMaxSessions: parsePositiveInt(
      process.env.MCP_MAX_SESSIONS,
      fileConfig.limits?.maxSessions ?? 200,
      'MCP_MAX_SESSIONS',
    ),
    rateLimitPerMinute: parsePositiveInt(
      process.env.RATE_LIMIT_REQUESTS_PER_MINUTE,
      fileConfig.limits?.rateLimitPerMinute ?? 60,
      'RATE_LIMIT_REQUESTS_PER_MINUTE',
    ),
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
    auth: {
      provider,
      issuerUrl,
      clientId,
      clientSecret,
      audience: process.env.AUTH_AUDIENCE ?? fileConfig.auth?.audience ?? '',
      acceptedAudiences: parseCsvOrArray(
        process.env.AUTH_ACCEPTED_AUDIENCES,
        fileConfig.auth?.acceptedAudiences,
      ),
      acceptedIssuers: parseCsvOrArray(
        process.env.AUTH_ACCEPTED_ISSUERS,
        fileConfig.auth?.acceptedIssuers,
      ),
      scopes,
      scopeAliases,
      compatibilityProxy,
      clientRegistration: parseClientRegistration(
        process.env.AUTH_CLIENT_REGISTRATION,
        compatibilityProxy,
        fileConfig.auth?.clientRegistration,
      ),
    },
  };

  const merged = { ...config, ...overrides, auth: { ...config.auth, ...overrides.auth } };
  validateConfig(merged);
  return merged;
}

function loadMcpServerConfigFile(): McpServerConfigFile {
  const configDir = findMcpServerConfigDir();
  if (!configDir) return {};

  const base = readMcpServerConfigFile(join(configDir, 'mcp-server.config.json'));
  const local = readMcpServerConfigFile(join(configDir, 'mcp-server.config.local.json'));
  return mergeMcpServerConfigFiles(base, local);
}

function findMcpServerConfigDir(): string | undefined {
  const starts = [...new Set([process.env.INIT_CWD, process.cwd()].filter(Boolean) as string[])];
  for (const start of starts) {
    let dir = start;
    const root = parse(dir).root;
    while (true) {
      if (
        existsSync(join(dir, 'mcp-server.config.json')) ||
        existsSync(join(dir, 'mcp-server.config.local.json'))
      ) {
        return dir;
      }
      if (dir === root) break;
      dir = dirname(dir);
    }
  }
  return undefined;
}

function readMcpServerConfigFile(path: string): McpServerConfigFile {
  if (!existsSync(path)) return {};

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new Error(`invalid ${path}: ${err instanceof Error ? err.message : String(err)}`);
  }

  const result = McpServerConfigFileSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`invalid ${path}:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

function mergeMcpServerConfigFiles(
  base: McpServerConfigFile,
  local: McpServerConfigFile,
): McpServerConfigFile {
  return {
    ...base,
    ...local,
    auth: { ...base.auth, ...local.auth },
    limits: { ...base.limits, ...local.limits },
  };
}

function parsePort(rawPort: string | undefined): number {
  if (!rawPort) return 8080;
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`invalid PORT "${rawPort}": must be an integer between 1 and 65535`);
  }
  return port;
}

function parseMcpPath(raw: string): string {
  if (!raw.startsWith('/')) throw new Error(`invalid MCP_PATH "${raw}": must start with /`);
  return raw;
}

function parseUrl(raw: string, name: string): string {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('bad protocol');
    return url.toString().replace(/\/$/, '');
  } catch {
    throw new Error(`invalid ${name} "${raw}": must be an absolute http(s) URL`);
  }
}

function parsePositiveInt(raw: string | undefined, defaultValue: number, name: string): number {
  if (!raw) return defaultValue;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`invalid ${name} "${raw}": must be a positive integer`);
  }
  return n;
}

function parseTrustProxy(raw: string | undefined): string | number | boolean {
  if (!raw) return 1;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const n = parseInt(raw, 10);
  if (!Number.isNaN(n) && String(n) === raw) return n;
  return raw;
}

function parseProvider(raw: string): AuthProviderSelection {
  const normalized = raw === 'generic' ? 'generic-oidc' : raw;
  if (isOneOf(normalized, AUTH_PROVIDER_SELECTION_VALUES)) return normalized;
  throw new Error(
    `invalid AUTH_PROVIDER "${raw}": expected ${AUTH_PROVIDER_SELECTION_VALUES.join(', ')}`,
  );
}

function parseClientRegistration(
  raw: string | undefined,
  compatibilityProxy: boolean,
  defaultValue: ClientRegistration | undefined,
): ClientRegistration {
  if (!raw) return defaultValue ?? (compatibilityProxy ? 'static' : 'provider');
  if (isOneOf(raw, CLIENT_REGISTRATION_VALUES)) return raw;
  throw new Error(
    `invalid AUTH_CLIENT_REGISTRATION "${raw}": expected ${CLIENT_REGISTRATION_VALUES.join(', ')}`,
  );
}

function isOneOf<const T extends readonly string[]>(value: string, values: T): value is T[number] {
  return (values as readonly string[]).includes(value);
}

function parseAuthCompatibilityProxy(
  raw: string | undefined,
  provider: AuthProviderSelection,
  defaultValue: boolean | undefined,
): boolean {
  if (!raw) return defaultValue ?? provider === 'entra';
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  throw new Error(`invalid AUTH_COMPATIBILITY_PROXY "${raw}": expected true or false`);
}

function parseScopes(raw: string): string[] {
  return raw.split(/[ ,]+/).filter(Boolean);
}

function parseCsvOrArray(raw: string | undefined, defaultValue: string[] = []): string[] {
  if (!raw) return defaultValue;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function defaultScopes(clientId: string, provider: AuthProviderSelection): string {
  if (provider === 'entra' && clientId) return `openid ${clientId}/.default offline_access`;
  return 'openid profile email offline_access';
}

function hasAuthCredentials(config: Config): boolean {
  return !!(config.auth.issuerUrl || config.auth.clientId);
}

function validateConfig(config: Config): void {
  if (config.auth.provider === 'none') {
    if (hasAuthCredentials(config)) {
      throw new Error(
        'AUTH_ISSUER_URL/AUTH_CLIENT_ID are set but AUTH_PROVIDER is "none" (the default); set AUTH_PROVIDER to enable auth',
      );
    }
    return;
  }

  const missing: string[] = [];
  if (!config.auth.issuerUrl) missing.push('AUTH_ISSUER_URL (or AUTH_TENANT_ID for entra)');
  if (!config.auth.clientId) missing.push('AUTH_CLIENT_ID');
  if (missing.length > 0) {
    throw new Error(
      `AUTH_PROVIDER is "${config.auth.provider}" but required config is missing: ${missing.join(', ')}`,
    );
  }
  parseUrl(config.auth.issuerUrl, 'AUTH_ISSUER_URL');
  if (config.auth.scopes.length === 0) {
    throw new Error('auth is enabled but AUTH_SCOPES resolved to an empty scope list');
  }
}
