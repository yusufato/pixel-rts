---
name: agents-md
description: Create or rewrite a minimal, high-signal AGENTS.md for this repository — only project-specific, mistake-preventing rules; aggressive pruning in rewrite mode. Use when setting up a repo for coding agents or when an existing AGENTS.md has grown generic and bloated. Outputs only the finished AGENTS.md content.
---

# Agents Md

This skill is a **thin adapter**. The canonical prompt lives in this repository under `prompts/` — the skill only loads it.

1. Read `prompts/00-core-kernel.md` in full.
2. Read `prompts/03-agents-md-author.md` in full.
3. Follow both exactly. The kernel governs modes, severity, confidence, epistemic rules, and the untrusted-content boundary; this SKILL.md adds nothing beyond loading them.

**Operator input:** anything included with the invocation — optionally, an existing AGENTS.md to rewrite; otherwise the repo itself — is the operator's input to the prompt. If input the prompt requires is missing, ask per the prompt's own rules; do not guess.

**If either file cannot be found, stop and say so.** Do not reconstruct the prompt from memory: a half-remembered kernel silently drops the severity scale, confidence rules, mode boundaries, and injection defenses, and the output will look right while being unguarded.
