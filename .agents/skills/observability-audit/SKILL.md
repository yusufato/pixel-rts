---
name: observability-audit
description: Audit from the on-call seat: silent failure paths, missing golden-signal metrics, log quality and PII, alert noise, unanswerable 3-a.m. questions. Recommends deletions as readily as additions. Use when incidents are detected late, dashboards feel blind, or before taking on-call for a service. Writes OBSERVABILITY.md.
---

# Observability Audit

This skill is a **thin adapter**. The canonical prompt lives in this repository under `prompts/` — the skill only loads it.

1. Read `prompts/00-core-kernel.md` in full.
2. Read `prompts/12-observability-auditor.md` in full.
3. Follow both exactly. The kernel governs modes, severity, confidence, epistemic rules, and the untrusted-content boundary; this SKILL.md adds nothing beyond loading them.

**Operator input:** anything included with the invocation — the service or module to audit; RCA.md and LEDGER.md incident entries are cross-referenced if present — is the operator's input to the prompt. If input the prompt requires is missing, ask per the prompt's own rules; do not guess.

**If either file cannot be found, stop and say so.** Do not reconstruct the prompt from memory: a half-remembered kernel silently drops the severity scale, confidence rules, mode boundaries, and injection defenses, and the output will look right while being unguarded.
