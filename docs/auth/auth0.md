# Auth0

```bash
AUTH_PROVIDER=auth0
AUTH_ISSUER_URL=https://<tenant>.<region>.auth0.com/
AUTH_CLIENT_ID=<client-id>
```

Or in `mcp-server.config.json` (see [README.md](./README.md#configuring-without-environment-variables)):

```jsonc
{
  "auth": {
    "provider": "auth0",
    "issuerUrl": "https://<tenant>.<region>.auth0.com/",
    "clientId": "<client-id>"
  }
}
```

- Create the Auth0 Application as "Native" or "SPA" — MCP clients use PKCE with no client
  secret.
- Add your MCP client's redirect URI to the application's Allowed Callback URLs.
- Dynamic client registration is off by default in Auth0 tenants; either enable it (tenant
  settings → OIDC Dynamic Application Registration) or set `AUTH_CLIENT_REGISTRATION=static`.
