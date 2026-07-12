# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.0.x   | ✅        |

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Instead, report it privately via
[GitHub Security Advisories](https://github.com/ARIELL03XY/GreekDir/security/advisories/new)
("Report a vulnerability"). You should receive a response within a few days.

Relevant context: GreekDir runs entirely locally, never connects to the
internet, and its renderer runs with `contextIsolation: true` and
`nodeIntegration: false`. Reports about the IPC surface
(`electron/preload.ts`) or filesystem handling are especially appreciated.
