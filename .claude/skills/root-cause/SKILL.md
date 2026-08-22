---
name: root-cause
description: Falsificationist root cause analysis of a failure — error message, stack trace, log excerpt, failing test, or described misbehavior. Builds a ranked hypothesis table with discriminating tests; refuted hypotheses stay on record. Use when something broke and the cause is unclear. Writes RCA.md and ledgers confirmed/refuted conclusions. Diagnosis only; never applies the fix.
---

# Root Cause

This skill is a **thin adapter**. The canonical prompt lives in this repository under `prompts/` — the skill only loads it.

1. Read `prompts/00-core-kernel.md` in full.
2. Read `prompts/04-root-cause-analyst.md` in full.
3. Follow both exactly. The kernel governs modes, severity, confidence, epistemic rules, and the untrusted-content boundary; this SKILL.md adds nothing beyond loading them.

**Operator input:** anything included with the invocation — the failure: error text, stack trace, logs, failing test, or a description of the misbehavior — is the operator's input to the prompt. If input the prompt requires is missing, ask per the prompt's own rules; do not guess.

**If either file cannot be found, stop and say so.** Do not reconstruct the prompt from memory: a half-remembered kernel silently drops the severity scale, confidence rules, mode boundaries, and injection defenses, and the output will look right while being unguarded.
