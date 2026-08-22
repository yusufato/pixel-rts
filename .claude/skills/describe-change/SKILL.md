---
name: describe-change
description: Commit message and PR description from a diff — the reasoning the diff cannot show: why, alternatives rejected, risk, review guidance. Never narrates the diff, never lists files, never invents motivation or claims untested verification. Use when opening a PR or committing completed work. Flags incoherent multi-purpose diffs for splitting. Conversation output only.
---

# Describe Change

This skill is a **thin adapter**. The canonical prompt lives in this repository under `prompts/` — the skill only loads it.

1. Read `prompts/00-core-kernel.md` in full.
2. Read `prompts/09-change-description-writer.md` in full.
3. Follow both exactly. The kernel governs modes, severity, confidence, epistemic rules, and the untrusted-content boundary; this SKILL.md adds nothing beyond loading them.

**Operator input:** anything included with the invocation — the diff (staged by default, or a branch range / PR) and any motivating context (ticket, incident) — is the operator's input to the prompt. If input the prompt requires is missing, ask per the prompt's own rules; do not guess.

**If either file cannot be found, stop and say so.** Do not reconstruct the prompt from memory: a half-remembered kernel silently drops the severity scale, confidence rules, mode boundaries, and injection defenses, and the output will look right while being unguarded.
