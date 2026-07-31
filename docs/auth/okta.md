# Okta

```bash
AUTH_PROVIDER=okta
AUTH_ISSUER_URL=https://<your-okta-domain>/oauth2/default
AUTH_CLIENT_ID=<client-id>
```

Or in `mcp-server.config.json` (see [README.md](./README.md#configuring-without-environment-variables)):

```jsonc
{
  "auth": {
    "provider": "okta",
    "issuerUrl": "https://<your-okta-domain>/oauth2/default",
    "clientId": "<client-id>"
  }
}
```

- Point at a custom (or `default`) authorization server issuer, not the org's root issuer — the
  root issuer only issues ID tokens, not usable access tokens.
- Create the app integration as an OIDC "Native Application" so it can use PKCE without a
  client secret.
- Okta supports RFC 7591 dynamic client registration when enabled on the authorization server;
  otherwise set `AUTH_CLIENT_REGISTRATION=static`.
