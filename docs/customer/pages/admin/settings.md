# Settings

## Purpose

Device theme plus operator guidance for auth, Zyra AI, and federation (configured via Helm / env).

## When to use it

- Switch light / dark appearance on this browser
- Confirm how to enable OIDC, API keys, LLM, or federated peers

## How to get there

- Route: `/settings`
- Nav: **Settings**

## Operate from the console

1. Choose **Light** or **Dark** — preference is stored locally.
2. Read the Auth / Zyra AI / Federation panels for Helm keys (`server.auth.*`, `server.llm.*`, `cluster.federated`).
3. Auth and LLM changes require a Helm upgrade; they are not edited in the UI.

## Related pages

- [Help](../support/help.md) · [Install](../../../install.md)
