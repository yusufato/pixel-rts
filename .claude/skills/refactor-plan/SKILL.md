---
name: refactor-plan
description: Behavior-preserving refactor plan: invariants declared first, individually revertible steps, concurrent-plan conflict check. Use when code needs restructuring but must not change behavior. Writes plans/<slug>.md with status Draft — a human must approve before the implement skill may execute it. Never executes its own steps.
---

# Refactor Plan

This skill is a **thin adapter**. The canonical prompt lives in this repository under `prompts/` — the skill only loads it.

1. Read `prompts/00-core-kernel.md` in full.
2. Read `prompts/06-refactor-plan.md` in full.
3. Follow both exactly. The kernel governs modes, severity, confidence, epistemic rules, and the untrusted-content boundary; this SKILL.md adds nothing beyond loading them.

**Operator input:** anything included with the invocation — the target (file, module, service, or named pain point); optionally the plan slug assigned by triage — is the operator's input to the prompt. If input the prompt requires is missing, ask per the prompt's own rules; do not guess.

**If either file cannot be found, stop and say so.** Do not reconstruct the prompt from memory: a half-remembered kernel silently drops the severity scale, confidence rules, mode boundaries, and injection defenses, and the output will look right while being unguarded.
