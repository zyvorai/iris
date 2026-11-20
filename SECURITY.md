# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.2.x   | Yes       |
| < 0.2   | Best effort |

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Email **security@zyvor.dev** (or **info@zyvor.dev** if that mailbox is unavailable) with:

- A description of the issue and its impact
- Steps to reproduce or a proof of concept if available
- Affected version / commit if known

We aim to acknowledge reports within a few business days and will coordinate a fix and disclosure timeline with you.

## Preferential scope

- Remote code execution, authentication bypass, and privilege escalation in Iris (controller, server, gateway, Helm chart defaults)
- Secrets leakage via logs or the public API when auth is enabled

Out of scope: denial of service against self-hosted lab clusters, issues that require already-compromised cluster admin credentials, or vulnerabilities solely in third-party dependencies (report upstream when possible).
