# Amazon Cognito

```bash
AUTH_PROVIDER=cognito
AUTH_ISSUER_URL=https://cognito-idp.<region>.amazonaws.com/<userPoolId>
AUTH_CLIENT_ID=<app-client-id>
AUTH_CLIENT_REGISTRATION=static
```

Or in `mcp-server.config.json` (see [README.md](./README.md#configuring-without-environment-variables)):

```jsonc
{
  "auth": {
    "provider": "cognito",
    "issuerUrl": "https://cognito-idp.<region>.amazonaws.com/<userPoolId>",
    "clientId": "<app-client-id>",
    "clientRegistration": "static"
  }
}
```

- Create the app client as a "Public client" (no secret) with the Authorization Code + PKCE
  flow enabled.
- Cognito has no RFC 7591 dynamic client registration endpoint — set
  `AUTH_CLIENT_REGISTRATION=static`.
- Custom scopes must come from a Cognito resource server and look like
  `<resourceServerIdentifier>/<scope>`; set `AUTH_SCOPES` accordingly.
