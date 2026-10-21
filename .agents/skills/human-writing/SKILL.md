---
name: human-writing
description: >-
  Pre-delivery self-review so prose deliverables (docs, PR text, code comments,
  Redmine notes, spec artifacts) contain no AI tells — no filler vocabulary, no
  puffery, no vague attributions, no chatbot voice, no LLM markup leaks. Use before
  finalizing any document, report, PR description or long chat answer, or when the
  user asks for "writing that does not read like AI". / revisión anti-AI-tells.
---

# Human writing — pre-delivery self-review

Companion to `.agents/rules/human-writing.md` (R1-R17 are always on; this skill is
the checklist and decision procedure). Source of truth:
[Wikipedia:Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing).

## When to use

- Before delivering any Markdown doc, PR description, Redmine note,
  code-comment set, API summary, or `spec/**/{spec,plan,task,context}.md`.
- When rewriting existing prose that "sounds like AI".
- When the user asks for text that must not read as machine-generated.

## Decision tree (run this first)

For each questionable sentence ask, in order:

1. **Is it filler?** Does the sentence add a fact, a decision, a number, a path, or
   a constraint? If deleting it loses nothing → delete it. (R2, R4, R13)
2. **Is it a claim without a source?** Who says this? Where is it in the code/diff?
   No source → cut it or label the confidence (CONFIRMED/LIKELY/POSSIBLE/UNKNOWN). (R5, R17)
3. **Is it emphasis without merit?** Would the fact stand alone without "crucial",
   "powerful", "robust"? → drop the adjective, keep the fact. (R1, R3)
4. **Is it the model's outline instead of the real flow?** (formula sections,
   rule of three, negative parallelism) → restructure. (R6, R13)
5. **Is it the wrong register or format?** (chatbot voice, markdown in a non-markdown
   target, emoji, mechanical bold) → fix the format. (R8, R10, R11)

## Pre-delivery checklist (20 points)

Content:
- [ ] 1. Every sentence carries a fact, decision, number, path, or constraint (no filler)
- [ ] 2. No significance/legacy filler (R2: "testament", "underscores", "milestone")
- [ ] 3. No promotional adjectives without data (R3: "vibrant", "groundbreaking", "boasts")
- [ ] 4. No dangling "-ing" analysis clauses (R4)
- [ ] 5. Every attribution is concrete (file/PR/log/URL) — no "experts say" (R5)
- [ ] 6. Evidence labeled CONFIRMED / LIKELY / POSSIBLE / UNKNOWN where relevant
- [ ] 7. No formula sections (R13: "Challenges and Future", "Key takeaways", per-section "In summary")
- [ ] 8. No invented data: numbers, metrics, APIs, commands, URLs, results (R12)

Language:
- [ ] 9. Blacklist scanned (R1) — at most 1-2 flagged words in the whole document
- [ ] 10. Simple copulas used (R7: is/are/has, es/tiene/hace)
- [ ] 11. No negative parallelism (R6: "not just X but Y", "not X, it's Y", "rather than")
- [ ] 12. No decorative triples (rule of three)
- [ ] 13. Simple words over inflated synonyms (R16: used/utilized, tried/attempted)
- [ ] 14. Natural punctuation variety (R15) — not em-dash-only, not comma-only
- [ ] 15. Register matches the repo's existing docs (not elevated)

Format & voice:
- [ ] 16. Sentence case headings; no skipped levels; no heading-only headings (R8)
- [ ] 17. Bold only for identifiers/paths/commands; no emoji as formatting (R8)
- [ ] 18. No chatbot voice or unfilled placeholders (R10)
- [ ] 19. Zero LLM markup leaks; markup matches the target format and renders (R11)
- [ ] 20. Summary/PR text states the concrete change, no canned assurances (R14)

## Scope note (what these rules do NOT cover)

- **Code identifiers, Setting keys, column names** are never "reworded" — they are
  quoted verbatim (`workspaceId`, `SYSBRAZO_CLIENT_API_URL`).
- **Technical terms in their literal sense** stay: `key`, `challenge`, `robust`,
  `landscape`, `underscore` (see R1 exceptions).
- **UI catalogs and existing product copy** keep their established vocabulary; this
  skill governs new prose, not retro-rewriting of user-facing strings without a task.
- Do **not** use these patterns to accuse third parties of AI use. They are writing
  rules for our own output, not a detector (the guide itself warns against that).

## Output

Silent application — the deliverable just passes the checklist. If the user asks
"does this read like AI?", answer with the concrete offending phrases and a rewrite.
