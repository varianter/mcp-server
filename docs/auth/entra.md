# Microsoft Entra ID

```bash
AUTH_PROVIDER=entra
AUTH_TENANT_ID=<tenant-guid-or-domain>
AUTH_CLIENT_ID=<application-client-id>
```

Or in `mcp-server.config.json` (see [README.md](./README.md#configuring-without-environment-variables)):

```jsonc
{
  "auth": {
    "provider": "entra",
    "tenantId": "<tenant-guid-or-domain>",
    "clientId": "<application-client-id>"
  }
}
```

- `AUTH_TENANT_ID` derives `AUTH_ISSUER_URL` for you; set `AUTH_ISSUER_URL` directly instead if
  you need a non-default cloud (e.g. Entra Government).
- Expose an API scope on the app registration (e.g. `access_as_user`) — Entra access tokens
  carry `scp`/`roles`, not the plain OAuth `scope` MCP clients request.
- The compatibility proxy (`AUTH_COMPATIBILITY_PROXY`, on by default for `entra`) rewrites
  requested scopes to `{clientId}/.default` and retries the token exchange as a public client if
  the app has no client secret — Entra otherwise rejects that request with `AADSTS700025`.
- Entra has no RFC 7591 dynamic client registration, so `AUTH_CLIENT_REGISTRATION` defaults to
  `static` and always returns `AUTH_CLIENT_ID`.
