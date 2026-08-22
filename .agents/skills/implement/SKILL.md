---
name: implement
description: Execute an approved plan (plans/<slug>.md) or a scoped direct instruction — the ONLY skill that modifies source code. Scope is locked to the plan's touches globs or an explicitly confirmed file list; verification runs after every step; failing tests are never weakened to pass. Use to carry out approved changes. Requires the plan slug, or scope confirmation for direct instructions.
---

# Implement

This skill is a **thin adapter**. The canonical prompt lives in this repository under `prompts/` — the skill only loads it.

1. Read `prompts/00-core-kernel.md` in full.
2. Read `prompts/07-implementer.md` in full.
3. Follow both exactly. The kernel governs modes, severity, confidence, epistemic rules, and the untrusted-content boundary; this SKILL.md adds nothing beyond loading them.

**Operator input:** anything included with the invocation — the plan slug or path, or a direct instruction (scope will be stated back for confirmation) — is the operator's input to the prompt. If input the prompt requires is missing, ask per the prompt's own rules; do not guess.

**If either file cannot be found, stop and say so.** Do not reconstruct the prompt from memory: a half-remembered kernel silently drops the severity scale, confidence rules, mode boundaries, and injection defenses, and the output will look right while being unguarded.
