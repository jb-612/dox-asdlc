---
name: security-review
description: Dedicated security review — OWASP Top 10, dependency audit, secret scanning, input validation. Runs as part of code-review or standalone.
argument-hint: "[scope or file-path]"
allowed-tools: Read, Glob, Grep, Bash
context: fork
agent: reviewer
---

Security review for $ARGUMENTS:

## OWASP Top 10 Check

Review code for common vulnerabilities:

1. **Injection** — SQL, command, LDAP injection via unsanitized input
2. **Broken Auth** — Weak session management, credential exposure
3. **Sensitive Data Exposure** — Unencrypted secrets, PII in logs
4. **XML External Entities** — XXE in parsers
5. **Broken Access Control** — Missing authorization checks
6. **Security Misconfiguration** — Default credentials, debug enabled
7. **XSS** — Reflected/stored cross-site scripting
8. **Insecure Deserialization** — Untrusted data deserialization
9. **Known Vulnerabilities** — Outdated dependencies with CVEs
10. **Insufficient Logging** — Missing audit trails for security events

## Dependency Audit

```bash
# Python dependencies
./tools/sca.sh requirements.txt

# Node dependencies (if applicable)
cd docker/hitl-ui && npm audit
```

## Secret Scanning

Verify no credentials in code:
- No API keys, tokens, or passwords in source files
- No `.env` files committed
- `LLM_CONFIG_ENCRYPTION_KEY` and similar are environment-only
- Check for hardcoded URLs with credentials

## Input Validation

Verify validation at system boundaries:
- HTTP request parameters validated and sanitized
- File paths normalized (no path traversal)
- JSON payloads validated against schemas
- User-supplied data never used in `eval`, `exec`, or shell commands

## Output

Create GitHub issues for all findings:
```bash
gh issue create --title "Security: <finding>" --label "security,code-review"
```

Severity levels: Critical (must fix before merge), High (should fix), Medium (track), Low (note).

## Cross-References

- `@code-review` — Invokes security review as part of comprehensive review
- `@testing` — SAST and SCA quality gates
