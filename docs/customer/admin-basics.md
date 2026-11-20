# Admin Basics (Iris)

## Ports / access

| Port | Service |
|------|--------|
| **31847** | UI NodePort (common) |
| **8080** | Controller / server |

## Auth

OIDC + API key. `server.auth.mode` defaults to **`none`** — no login required at all —
**set it to `api_key` or `oidc` before any internet-facing or production install.**

```bash
helm upgrade --install iris charts/iris -n iris-system \
  --set server.auth.mode=api_key --set server.auth.apiKey="a-real-key"
```

### Session secret

Sessions are signed with `IRIS_SESSION_SECRET`. This is auto-generated (random, 64
chars) by the chart on first install and preserved across upgrades — never set it to a
fixed value checked into source control, since it's the token-signing key, not a login
credential. Retrieve it if needed:

```bash
kubectl -n iris-system get secret iris-session-secret -o jsonpath='{.data.session-secret}' | base64 -d; echo
```

If you run `iris-server` **outside this chart** (standalone binary, `docker run`,
`docker-compose`), you must set `IRIS_SESSION_SECRET` yourself — without it, the binary
falls back to a hardcoded development default and logs a warning; that fallback value is
public (it's in the source), so relying on it is not safe for anything other than local dev.

## Install sketch

Follow the product README and deploy/Helm docs in the repository. Verify health endpoints or CLI status before opening the UI.

## Related

- [Getting Started](getting-started.md)

## Operate from the console (UX)

1. Open this route from the nav or command palette and wait for live API data.
2. Use filters/search when present; drill into a row for detail.
3. For mutating actions: confirm role gates and impact before applying.
4. **Empty / fail:** Check service health, auth, and that required CRDs/backends for this domain are installed.
5. **Success:** Live data loads; created/updated objects appear without error toasts.

