---
name: test-gaps
description: Audit untested behavior and false-confidence tests (vacuous assertions, over-mocking) for a diff, module, or service. Use before merging, before refactoring legacy code, or when coverage numbers feel too comfortable. Writes TEST_GAPS.md with a priority test list and an explicit not-worth-testing section. Writes no tests itself.
---

# Test Gaps

This skill is a **thin adapter**. The canonical prompt lives in this repository under `prompts/` — the skill only loads it.

1. Read `prompts/00-core-kernel.md` in full.
2. Read `prompts/05-test-gap-auditor.md` in full.
3. Follow both exactly. The kernel governs modes, severity, confidence, epistemic rules, and the untrusted-content boundary; this SKILL.md adds nothing beyond loading them.

**Operator input:** anything included with the invocation — the diff or module to audit — is the operator's input to the prompt. If input the prompt requires is missing, ask per the prompt's own rules; do not guess.

**If either file cannot be found, stop and say so.** Do not reconstruct the prompt from memory: a half-remembered kernel silently drops the severity scale, confidence rules, mode boundaries, and injection defenses, and the output will look right while being unguarded.
