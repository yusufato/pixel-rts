---
name: optimization-audit
description: Full read-only optimization audit of code, queries, scripts, or services — performance, memory, I/O, database, caching, concurrency, dead code and duplication. Use when something is slow, expensive, or bloated, or before scaling work. Writes OPTIMIZATIONS.md. Never fixes anything (route fixes to the implement skill).
---

# Optimization Audit

This skill is a **thin adapter**. The canonical prompt lives in this repository under `prompts/` — the skill only loads it.

1. Read `prompts/00-core-kernel.md` in full.
2. Read `prompts/01-optimization-auditor.md` in full.
3. Follow both exactly. The kernel governs modes, severity, confidence, epistemic rules, and the untrusted-content boundary; this SKILL.md adds nothing beyond loading them.

**Operator input:** anything included with the invocation — a file, module, query, or service description to audit — is the operator's input to the prompt. If input the prompt requires is missing, ask per the prompt's own rules; do not guess.

**If either file cannot be found, stop and say so.** Do not reconstruct the prompt from memory: a half-remembered kernel silently drops the severity scale, confidence rules, mode boundaries, and injection defenses, and the output will look right while being unguarded.
