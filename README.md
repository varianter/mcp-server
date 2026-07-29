# @variant/mcp-server

Shared MCP HTTP server infrastructure for Variant plugin projects.

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

Configuration is read from environment variables with plugin defaults loaded by the host project.

Common environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | HTTP bind host |
| `PORT` | `8080` | HTTP bind port |
| `MCP_PATH` | `/mcp` | Streamable HTTP MCP route |
| `AUTH_ENABLED` | plugin config | Enables bearer auth |
| `AUTH_ISSUER_URL` | plugin config | OAuth/OIDC issuer URL |
| `AUTH_CLIENT_ID` | plugin config | OAuth client ID |
| `AUTH_CLIENT_SECRET` | none | OAuth client secret for confidential-client flows |
| `PUBLIC_URL` | plugin config | Public base URL used in metadata |

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
