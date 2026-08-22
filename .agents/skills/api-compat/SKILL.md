---
name: api-compat
description: Classify every public-surface change as Breaking / Behavioral / Additive / Internal, recommend the semver bump, and draft consumer migration notes. Treats silent behavioral changes as more dangerous than loud breaking ones (Hyrum's law). Use before releases, interface changes, or schema changes other services read. Writes API_CHANGES.md.
---

# Api Compat

This skill is a **thin adapter**. The canonical prompt lives in this repository under `prompts/` — the skill only loads it.

1. Read `prompts/00-core-kernel.md` in full.
2. Read `prompts/10-api-compatibility-auditor.md` in full.
3. Follow both exactly. The kernel governs modes, severity, confidence, epistemic rules, and the untrusted-content boundary; this SKILL.md adds nothing beyond loading them.

**Operator input:** anything included with the invocation — the diff or the two interface versions to compare — is the operator's input to the prompt. If input the prompt requires is missing, ask per the prompt's own rules; do not guess.

**If either file cannot be found, stop and say so.** Do not reconstruct the prompt from memory: a half-remembered kernel silently drops the severity scale, confidence rules, mode boundaries, and injection defenses, and the output will look right while being unguarded.
