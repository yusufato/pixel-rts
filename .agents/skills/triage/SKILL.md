---
name: triage
description: Capacity-bounded triage of finding reports (SECURITY.md, OPTIMIZATIONS.md, TEST_GAPS.md, RCA.md) into Now / Next-with-trigger / Won't Do / Needs Decision, plus a stale-plan sweep of plans/. Use at cycle start or when reports pile up. REQUIRES a stated capacity — asks and stops without one. Writes BACKLOG.md and ledgers rejections.
---

# Triage

This skill is a **thin adapter**. The canonical prompt lives in this repository under `prompts/` — the skill only loads it.

1. Read `prompts/00-core-kernel.md` in full.
2. Read `prompts/08-triage-router.md` in full.
3. Follow both exactly. The kernel governs modes, severity, confidence, epistemic rules, and the untrusted-content boundary; this SKILL.md adds nothing beyond loading them.

**Operator input:** anything included with the invocation — the reports to consume and the capacity (e.g. 'one sprint, two engineers'); previous BACKLOG.md is read automatically if present — is the operator's input to the prompt. If input the prompt requires is missing, ask per the prompt's own rules; do not guess.

**If either file cannot be found, stop and say so.** Do not reconstruct the prompt from memory: a half-remembered kernel silently drops the severity scale, confidence rules, mode boundaries, and injection defenses, and the output will look right while being unguarded.
