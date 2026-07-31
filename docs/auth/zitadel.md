# ZITADEL

```bash
AUTH_PROVIDER=zitadel
AUTH_ISSUER_URL=https://<instance>.zitadel.cloud
AUTH_CLIENT_ID=<client-id>
```

Or in `mcp-server.config.json` (see [README.md](./README.md#configuring-without-environment-variables)):

```jsonc
{
  "auth": {
    "provider": "zitadel",
    "issuerUrl": "https://<instance>.zitadel.cloud",
    "clientId": "<client-id>"
  }
}
```

- Create the application as a "User Agent" app (public, PKCE, no secret).
- Add your MCP client's redirect URI in the application's redirect URI settings.
- ZITADEL supports dynamic client registration; leave `AUTH_CLIENT_REGISTRATION` at its default
  (`provider`).
