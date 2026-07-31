# Generic OIDC (`generic-oidc` / `oidc`)

For any standards-compliant OIDC provider without a dedicated guide.

```bash
AUTH_PROVIDER=generic-oidc
AUTH_ISSUER_URL=https://<issuer>
AUTH_CLIENT_ID=<client-id>
```

Or in `mcp-server.config.json` (see [README.md](./README.md#configuring-without-environment-variables)):

```jsonc
{
  "auth": {
    "provider": "generic-oidc",
    "issuerUrl": "https://<issuer>",
    "clientId": "<client-id>"
  }
}
```

- The issuer must serve `/.well-known/openid-configuration` with a `jwks_uri`.
- Register the client as public (PKCE, no secret) if the provider allows it; set
  `AUTH_CLIENT_SECRET` only for confidential-client flows.
- If the provider doesn't support RFC 7591 dynamic client registration, set
  `AUTH_CLIENT_REGISTRATION=static`.
