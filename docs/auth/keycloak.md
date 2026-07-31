# Keycloak

```bash
AUTH_PROVIDER=keycloak
AUTH_ISSUER_URL=https://<host>/realms/<realm>
AUTH_CLIENT_ID=<client-id>
```

Or in `mcp-server.config.json` (see [README.md](./README.md#configuring-without-environment-variables)):

```jsonc
{
  "auth": {
    "provider": "keycloak",
    "issuerUrl": "https://<host>/realms/<realm>",
    "clientId": "<client-id>"
  }
}
```

- Create the client with "Standard flow" enabled and "Client authentication" off (public
  client, PKCE).
- Add your MCP client's redirect URI under Valid Redirect URIs.
- Keycloak supports dynamic client registration per realm policy; leave
  `AUTH_CLIENT_REGISTRATION` at its default (`provider`) unless the realm has it disabled.
