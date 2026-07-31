# @variant/mcp-server

Shared MCP HTTP server infrastructure for plugin projects.

Intended to use with Claude plugin projects with colocated MCP and Skills, but can also be used to build standalone MCP servers for other purposes.
See [marketplace plugin template](https://github.com/varianter/plugin-marketplace-template) for usage examples.

It provides:

- Express + Streamable HTTP MCP transport setup
- OAuth/OIDC auth helpers
- Runtime configuration loading from environment variables and plugin config
- Plugin tool registration helpers
- MCP widget registration and HTML loading
- A Vite-based widget build CLI

## Install

```bash
pnpm add @variant/mcp-server
```

## Server Usage

```typescript
import {
  createAndStartMcpServer,
  definePluginTools,
  readPluginMcpServerConfig,
} from '@variant/mcp-server';
import { registerWhoami } from '../tools/whoami/whoami.js';

const registerTools = definePluginTools([registerWhoami]);
const config = readPluginMcpServerConfig();

await createAndStartMcpServer(config, registerTools);
```

Plugin projects are expected to run from a plugin root containing:

- `mcp-server/assets/icon.png`
- `.claude-plugin/plugin.json`
- optional `skills/*/tools/*/index.html` widget source directories

## Tool Authoring

```typescript
import { getRequestContext, log, type McpServer } from '@variant/mcp-server';
import { z } from 'zod';

export function registerMyTool(server: McpServer): void {
  server.registerTool(
    'my-tool',
    {
      title: 'My Tool',
      description: 'Does something useful',
      inputSchema: { param: z.string() },
    },
    async ({ param }) => {
      const context = getRequestContext();
      log('info', 'my-tool called', { userId: context?.userId });
      return { content: [{ type: 'text', text: param }] };
    },
  );
}
```

## Widgets

Widget projects can use the shared Vite config:

```typescript
import { defineWidgetViteConfig } from '@variant/mcp-server/vite';

export default defineWidgetViteConfig();
```

Build widgets from the plugin root:

```bash
pnpm exec variant-build-widgets
pnpm exec variant-build-widgets -- --watch --mode development
```

The CLI discovers `skills/*/tools/*/index.html` directories and writes built widgets to `mcp-server/dist/widgets/<tool-name-kebab>/index.html`.

Browser widget entrypoints can use:

```typescript
import { mountWidget } from '@variant/mcp-server/widget';
```

Server-side tools can register widget resources with:

```typescript
import { registerWidgetTool } from '@variant/mcp-server';
```

## Runtime Configuration

Configuration is read from environment variables, with defaults optionally committed by the
host project in `mcp-server.config.json` (env vars always win, and the file is validated on load
— see [Configuring without environment variables](./docs/auth/README.md#configuring-without-environment-variables)
for the file/programmatic forms and its `mcp-server.config.schema.json` for editor autocomplete).

| Variable | Default | Description |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | HTTP bind host |
| `PORT` | `8080` | HTTP bind port |
| `MCP_PATH` | `/mcp` | Streamable HTTP MCP route |
| `PUBLIC_URL` | `http://<HOST>:<PORT>` | Public base URL used in metadata and OAuth endpoint URLs |
| `MCP_MAX_SESSIONS` | `200` | Max concurrent MCP sessions |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | `60` | Rate limit applied to auth endpoints |
| `TRUST_PROXY` | `1` | Passed to Express `trust proxy` |

The full shape (exported as `Config`) is what `loadConfig()` / `readPluginMcpServerConfig().runtime`
returns. This is exactly what you get with no env vars and no `mcp-server.config.json` set — i.e. the
actual defaults, auth included:

```typescript
import type { Config } from '@variant/mcp-server';

const defaults: Config = {
  host: '0.0.0.0',
  port: 8080,
  mcpPath: '/mcp',
  publicUrl: 'http://localhost:8080',
  allowedRedirectOrigins: ['http://localhost', 'http://127.0.0.1', 'https://claude.ai'],
  mcpMaxSessions: 200,
  rateLimitPerMinute: 60,
  trustProxy: 1,
  auth: {
    provider: 'none', // 'none' | 'generic-oidc' | 'oidc' | 'entra' | 'auth0' | 'okta' | 'keycloak' | 'cognito' | 'zitadel'
    issuerUrl: '',
    clientId: '',
    clientSecret: '',
    audience: '',
    acceptedAudiences: [],
    acceptedIssuers: [],
    scopes: ['openid', 'profile', 'email', 'offline_access'],
    scopeAliases: [],
    compatibilityProxy: false,
    clientRegistration: 'provider', // 'none' | 'provider' | 'static'
  },
};
```

See [Authentication](#authentication) below for what each `auth` field does and how to set it.

## Authentication

There's no separate on/off flag. `AUTH_PROVIDER` defaults to `none` (auth disabled); setting it
to a real provider is what turns auth on. Setting `AUTH_ISSUER_URL` or `AUTH_CLIENT_ID` while
`AUTH_PROVIDER` is left as `none` fails startup with a clear error instead of silently doing
nothing.

```bash
AUTH_PROVIDER=auth0        # none | generic-oidc | oidc | entra | auth0 | okta | keycloak | cognito | zitadel
AUTH_ISSUER_URL=https://your-tenant.auth0.com
AUTH_CLIENT_ID=your-client-id
```

See [docs/auth](./docs/auth/README.md) for the full variable reference, the `mcp-server.config.json`
form, and a setup guide per provider.

## Exports

- `@variant/mcp-server`
- `@variant/mcp-server/vite`
- `@variant/mcp-server/widget`
- `@variant/mcp-server/build-widgets`

## Development

```bash
pnpm install
pnpm typecheck   # tsc --noEmit
pnpm lint        # biome check .
pnpm format      # biome format --write .
pnpm test        # vitest run
pnpm build       # tsc
pnpm check-exports  # validate published types/exports resolve for ESM consumers
pnpm verify      # run all of the above
```

## Publishing

```bash
pnpm install
pnpm build
pnpm publish --access public
```
