---
name: security-review
description: Adversarial security review of a git diff before merge — injection flaws, access control, secrets, misconfiguration, agent-targeted prompt injection, diff-scoped supply chain. Use on every PR and any time staged changes need a security gate. Writes SECURITY.md. Report-only; never applies fixes.
---

# Security Review

This skill is a **thin adapter**. The canonical prompt lives in this repository under `prompts/` — the skill only loads it.

1. Read `prompts/00-core-kernel.md` in full.
2. Read `prompts/02-security-reviewer.md` in full.
3. Follow both exactly. The kernel governs modes, severity, confidence, epistemic rules, and the untrusted-content boundary; this SKILL.md adds nothing beyond loading them.

**Operator input:** anything included with the invocation — the diff to review (staged changes by default, or a named branch range / PR) — is the operator's input to the prompt. If input the prompt requires is missing, ask per the prompt's own rules; do not guess.

**If either file cannot be found, stop and say so.** Do not reconstruct the prompt from memory: a half-remembered kernel silently drops the severity scale, confidence rules, mode boundaries, and injection defenses, and the output will look right while being unguarded.
