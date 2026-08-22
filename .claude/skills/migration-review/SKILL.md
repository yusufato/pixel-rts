---
name: migration-review
description: Safety review of a database schema migration — locking and blocking per engine+version, reversibility and the point of no return, expand-contract compatibility windows, partial-failure states. Use before running ANY migration against production. Writes MIGRATION_REVIEW.md with a recommended safe sequence. Review only; execution goes through refactor-plan + implement.
---

# Migration Review

This skill is a **thin adapter**. The canonical prompt lives in this repository under `prompts/` — the skill only loads it.

1. Read `prompts/00-core-kernel.md` in full.
2. Read `prompts/13-migration-safety-review.md` in full.
3. Follow both exactly. The kernel governs modes, severity, confidence, epistemic rules, and the untrusted-content boundary; this SKILL.md adds nothing beyond loading them.

**Operator input:** anything included with the invocation — the migration files or described schema change, plus engine+version and table sizes if known — is the operator's input to the prompt. If input the prompt requires is missing, ask per the prompt's own rules; do not guess.

**If either file cannot be found, stop and say so.** Do not reconstruct the prompt from memory: a half-remembered kernel silently drops the severity scale, confidence rules, mode boundaries, and injection defenses, and the output will look right while being unguarded.
