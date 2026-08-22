---
name: prompt-audit
description: Audit the prompt archive itself (prompts/ + skill adapters) — jointly unsatisfiable rule pairs, broken cross-references, kernel duplication, rule-budget growth, adapter drift. Use after editing any prompt or kernel file, before deploying archive changes, or periodically. Writes PROMPT_AUDIT.md. Best run from a session that did not author the changes under review. Audits text only; for runtime adherence use the eval set.
---

# Prompt Audit

This skill is a **thin adapter**. The canonical prompt lives in this repository under `prompts/` — the skill only loads it.

1. Read `prompts/00-core-kernel.md` in full.
2. Read `prompts/14-prompt-auditor.md` in full.
3. Follow both exactly. The kernel governs modes, severity, confidence, epistemic rules, and the untrusted-content boundary; this SKILL.md adds nothing beyond loading them.

**Operator input:** anything included with the invocation — optionally a subset of files to audit, or "since last audit" — is the operator's input to the prompt. If input the prompt requires is missing, ask per the prompt's own rules; do not guess.

**If either file cannot be found, stop and say so.** Do not reconstruct the prompt from memory: a half-remembered kernel silently drops the severity scale, confidence rules, mode boundaries, and injection defenses, and the output will look right while being unguarded.
