---
name: deps-audit
description: Audit the whole dependency set — vulnerabilities (verification commands only, never CVE IDs from memory), maintenance and bus-factor risk, trust/provenance, licensing, weight. Use periodically or before releases. Writes DEPENDENCIES.md. For dependency changes inside a single diff, use security-review instead.
---

# Deps Audit

This skill is a **thin adapter**. The canonical prompt lives in this repository under `prompts/` — the skill only loads it.

1. Read `prompts/00-core-kernel.md` in full.
2. Read `prompts/11-dependency-supply-chain-auditor.md` in full.
3. Follow both exactly. The kernel governs modes, severity, confidence, epistemic rules, and the untrusted-content boundary; this SKILL.md adds nothing beyond loading them.

**Operator input:** anything included with the invocation — the manifest and lockfile (and dependency tree output if available) — is the operator's input to the prompt. If input the prompt requires is missing, ask per the prompt's own rules; do not guess.

**If either file cannot be found, stop and say so.** Do not reconstruct the prompt from memory: a half-remembered kernel silently drops the severity scale, confidence rules, mode boundaries, and injection defenses, and the output will look right while being unguarded.
