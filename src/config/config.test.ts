import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const AUTH_ENV_VARS = [
  'AUTH_PROVIDER',
  'AUTH_ISSUER_URL',
  'AUTH_CLIENT_ID',
  'AUTH_TENANT_ID',
  'AUTH_SCOPES',
  'AUTH_COMPATIBILITY_PROXY',
];

let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {};
  for (const key of AUTH_ENV_VARS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of AUTH_ENV_VARS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe('loadConfig auth', () => {
  it('defaults AUTH_PROVIDER to none, meaning auth is disabled', () => {
    const config = loadConfig();
    expect(config.auth.provider).toBe('none');
  });

  it('throws if credentials are set while AUTH_PROVIDER is left as none', () => {
    process.env.AUTH_ISSUER_URL = 'https://issuer.example.com';
    process.env.AUTH_CLIENT_ID = 'client-123';

    expect(() => loadConfig()).toThrow(/AUTH_PROVIDER/);
  });

  it('enables auth by setting AUTH_PROVIDER and derives generic-oidc defaults', () => {
    process.env.AUTH_PROVIDER = 'auth0';
    process.env.AUTH_ISSUER_URL = 'https://tenant.auth0.com';
    process.env.AUTH_CLIENT_ID = 'client-123';

    const config = loadConfig();

    expect(config.auth.provider).toBe('auth0');
    expect(config.auth.compatibilityProxy).toBe(false);
    expect(config.auth.scopes).toEqual(['openid', 'profile', 'email', 'offline_access']);
  });

  it('throws if AUTH_PROVIDER is set but issuer/client id are missing', () => {
    process.env.AUTH_PROVIDER = 'auth0';

    expect(() => loadConfig()).toThrow(/AUTH_ISSUER_URL/);
  });

  it('enables the Entra compatibility proxy only when provider is entra', () => {
    process.env.AUTH_PROVIDER = 'entra';
    process.env.AUTH_TENANT_ID = 'tenant-abc';
    process.env.AUTH_CLIENT_ID = 'client-123';

    const config = loadConfig();

    expect(config.auth.compatibilityProxy).toBe(true);
    expect(config.auth.issuerUrl).toBe('https://login.microsoftonline.com/tenant-abc/v2.0');
  });

  it('accepts an explicit provider passed via overrides instead of env vars', () => {
    const config = loadConfig({
      auth: {
        provider: 'keycloak',
        issuerUrl: 'https://keycloak.example.com/realms/demo',
        clientId: 'client-123',
      },
    });

    expect(config.auth.provider).toBe('keycloak');
  });
});

describe('loadConfig mcp-server.config.json', () => {
  let dir: string;
  let savedInitCwd: string | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mcp-server-config-test-'));
    savedInitCwd = process.env.INIT_CWD;
    process.env.INIT_CWD = dir;
  });

  afterEach(() => {
    if (savedInitCwd === undefined) delete process.env.INIT_CWD;
    else process.env.INIT_CWD = savedInitCwd;
    rmSync(dir, { recursive: true, force: true });
  });

  it('reads auth defaults committed to the file', () => {
    writeFileSync(
      join(dir, 'mcp-server.config.json'),
      JSON.stringify({
        auth: { provider: 'okta', issuerUrl: 'https://example.okta.com', clientId: 'client-123' },
      }),
    );

    const config = loadConfig();

    expect(config.auth.provider).toBe('okta');
    expect(config.auth.issuerUrl).toBe('https://example.okta.com');
  });

  it('lets mcp-server.config.local.json override mcp-server.config.json', () => {
    writeFileSync(
      join(dir, 'mcp-server.config.json'),
      JSON.stringify({ auth: { provider: 'okta', clientId: 'shared-client' } }),
    );
    writeFileSync(
      join(dir, 'mcp-server.config.local.json'),
      JSON.stringify({ auth: { issuerUrl: 'https://local.okta.com' } }),
    );

    const config = loadConfig();

    expect(config.auth.provider).toBe('okta');
    expect(config.auth.clientId).toBe('shared-client');
    expect(config.auth.issuerUrl).toBe('https://local.okta.com');
  });

  it('rejects an unknown key with a specific error instead of ignoring it', () => {
    writeFileSync(
      join(dir, 'mcp-server.config.json'),
      JSON.stringify({ auth: { provder: 'okta' } }),
    );

    expect(() => loadConfig()).toThrow(/mcp-server\.config\.json/);
  });

  it('rejects a provider value that is not in the enum', () => {
    writeFileSync(
      join(dir, 'mcp-server.config.json'),
      JSON.stringify({ auth: { provider: 'not-a-real-provider' } }),
    );

    expect(() => loadConfig()).toThrow(/mcp-server\.config\.json/);
  });
});
