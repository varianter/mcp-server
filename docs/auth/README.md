# Authentication

There's no separate on/off flag: `AUTH_PROVIDER` defaults to `none` (auth disabled), and setting
it to a real provider is what turns auth on. Setting `AUTH_ISSUER_URL` or `AUTH_CLIENT_ID` while
`AUTH_PROVIDER` is left as `none` fails startup with an error rather than being silently ignored.
There is no default *real* provider: this is a shared package used by many plugins, so it never
guesses which one you want.

## Providers

| `AUTH_PROVIDER` | Guide |
| --- | --- |
| `none` (default) | auth disabled — no guide needed |
| `entra` | [entra.md](./entra.md) |
| `auth0` | [auth0.md](./auth0.md) |
| `okta` | [okta.md](./okta.md) |
| `keycloak` | [keycloak.md](./keycloak.md) |
| `cognito` | [cognito.md](./cognito.md) |
| `zitadel` | [zitadel.md](./zitadel.md) |
| `generic-oidc`, `oidc` | [generic-oidc.md](./generic-oidc.md) |

Every provider is verified the same way (standard OIDC discovery + JWKS); `entra` additionally
adds Microsoft-specific issuer/audience/claim handling and defaults the compatibility proxy on.
Each guide shows the env var form; see
[Configuring without environment variables](#configuring-without-environment-variables) for the
`mcp-server.config.json` / programmatic equivalent.

## Full reference

### Core

| Variable | Default | Description |
| --- | --- | --- |
| `AUTH_PROVIDER` | `none` | Turns auth on by naming a real provider; see table above. |
| `AUTH_ISSUER_URL` | none (or derived from `AUTH_TENANT_ID` for `entra`) | OIDC issuer to discover metadata + JWKS from. |
| `AUTH_CLIENT_ID` | none | OAuth client id; also the default JWT audience. |
| `AUTH_CLIENT_SECRET` | none | Only for confidential-client flows. |
| `AUTH_TENANT_ID` | — | `entra`-only shortcut for `AUTH_ISSUER_URL`. |

### Token verification

| Variable | Default | Description |
| --- | --- | --- |
| `AUTH_AUDIENCE` | `AUTH_CLIENT_ID` | Expected JWT `aud` claim. |
| `AUTH_ACCEPTED_AUDIENCES` | — | Extra accepted audiences (comma-separated), on top of the provider's defaults. |
| `AUTH_ACCEPTED_ISSUERS` | — | Extra accepted issuers (comma-separated), on top of the provider's defaults. |
| `AUTH_SCOPES` | `openid profile email offline_access` (or, for `entra`, `openid {clientId}/.default offline_access`) | Scopes requested during authorization. |

### Compatibility & client registration

| Variable | Default | Description |
| --- | --- | --- |
| `AUTH_COMPATIBILITY_PROXY` | `true` for `entra`, `false` otherwise | Runs local `/authorize` and `/token` routes that normalize params/scopes the provider needs but MCP clients don't send. |
| `AUTH_SCOPE_ALIASES` | — | Comma-separated scope names to rewrite to `{clientId}/.default` (compatibility proxy only). |
| `AUTH_CLIENT_REGISTRATION` | `static` if the compatibility proxy is on, else `provider` | `none`: no registration endpoint advertised. `provider`: advertise the upstream RFC 7591 endpoint. `static`: serve a local `/register` that always returns `AUTH_CLIENT_ID`, for providers without dynamic registration. |
| `AUTH_ALLOWED_REDIRECT_ORIGINS` | `http://localhost`, `http://127.0.0.1`, `https://claude.ai` | Origins allowed in `redirect_uris` accepted by the static `/register` endpoint. |

## Configuring without environment variables

Every field below also has an `AUTH_*` env var; use whichever fits how the plugin is deployed.
Precedence is: **programmatic overrides > env vars > `mcp-server.config.json`**.

### `mcp-server.config.json`

A plugin can commit shared defaults instead of (or alongside) env vars. The file is found by
walking up from the process's working directory, so keep it at the plugin root.
`mcp-server.config.local.json` overrides it for local development and should not be committed.
Both are validated on load — an unknown key or wrong type fails startup with a specific error
instead of being silently ignored.

Add `"$schema"` for editor autocomplete and inline validation (VS Code, JetBrains, etc. all
support this):

```jsonc
// mcp-server.config.json
{
  "$schema": "./node_modules/@variant/mcp-server/mcp-server.config.schema.json",
  "auth": {
    "provider": "auth0",
    "issuerUrl": "https://your-tenant.auth0.com",
    "clientId": "your-client-id",
    "scopes": ["openid", "profile", "email"]
  }
}
```

### Programmatic overrides

`readPluginMcpServerConfig` and `loadConfig` both accept a `runtime` override object that wins
over both env vars and `mcp-server.config.json` — useful for tests or a plugin that hardcodes its
own provider:

```typescript
import { createAndStartMcpServer, readPluginMcpServerConfig } from '@variant/mcp-server';

const config = readPluginMcpServerConfig({
  runtime: {
    auth: {
      provider: 'auth0',
      issuerUrl: 'https://your-tenant.auth0.com',
      clientId: 'your-client-id',
    },
  },
});

await createAndStartMcpServer(config, registerTools);
```

## Reading the authenticated user in a tool

```typescript
import { getRequestContext } from '@variant/mcp-server';

const context = getRequestContext(); // undefined when auth is disabled
context?.userId; // `${issuer}#${subject}` — stable across requests, prefer for authorization
context?.email;
context?.scopes;
```
