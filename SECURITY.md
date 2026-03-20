# Security Policy

## Reporting a vulnerability

Please do **not** open a public issue with exploit details.

Preferred reporting method:

1. Use the repository's **Security** tab.
2. Use **Private vulnerability reporting** if it is enabled for the repository.

If private reporting is not available yet:

1. Open a normal GitHub issue that only says you need a private reporting channel.
2. Do **not** include the exploit, payload, token, screenshot of secrets, or reproduction details in that public issue.
3. Wait for maintainers to move the discussion to a private channel.

## What to include

Please include:

- a short description of the issue
- affected file(s) or feature(s)
- steps to reproduce
- impact assessment
- any suggested remediation

## Response goals

Target response goals for this repository:

- initial acknowledgment within 7 days
- remediation plan or triage update within 30 days when feasible

## Scope

This repository is a local-load Chrome extension project. Reports are especially helpful for:

- unsafe URL handling
- accidental exposure of configuration data
- permission creep
- supply-chain risks in automation or CI
- repository leaks involving secrets or credentials
