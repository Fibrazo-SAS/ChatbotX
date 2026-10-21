---
description: Prose rules — never write text that reads as AI-generated (no filler, no puffery, no vague claims, no LLM markup)
alwaysApply: true
---

# Human Writing Rules (no AI tells)

Applies to **every prose deliverable**: docs, `spec/` artifacts, MR/PR descriptions,
Redmine notes, code comments, UI text, API summaries, commit-style text, and chat
answers. Source: [Wikipedia:Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)
(WP:AISIGNS). Detail + examples: `.agents/skills/human-writing/SKILL.md`.

**The meta rule:** the real problem is not the words — it is filler, unearned
emphasis, and unverifiable claims. Swapping synonyms only hides the smell. Fix
the substance: state facts, cite real files, mark uncertainty.

## R1 — Banned filler vocabulary

Do not overuse these. One occurrence can be legitimate; several in one document is a tell.

EN: *Additionally (sentence start), align with, boasts, bolstered, crucial, deep dive, delve, emphasizing, enduring, enhance/enhancing, fostering, garner, highlight (verb), interplay, intricate/intricacies, key (adj.), landscape (abstract), meticulously, pivotal, robust, showcase/showcasing, tapestry, testament, underscore (verb), valuable, vibrant, multifaceted, leverage, prioritize, foster, stands/serves as, marks a, represents a shift, evolving landscape, indelible mark, deeply rooted, nestled, in the heart of, groundbreaking, renowned, diverse array, commitment to, natural beauty, resonate with, valuable insights.*

ES: *además (inicio de oración), crucial, vibrante, rico tapiz, testimonio de, subraya/refuerza la importancia, pilar fundamental, en el corazón de, trascendental, esencial destacar, conviene recordar, no solo… sino también.*

**Literal uses are allowed** (the rule targets filler, not technical terms): `key` = API key, `landscape` = orientation, `underscore` = underline mark, `robust` = robustness in a spec, `challenge` = a named technical challenge.

## R2 — No significance/legacy filler

Banned: "this marks a milestone", "is a testament to", "underscores its importance",
"reflects broader trends", "contributes to the landscape", "symbolizing its ongoing
evolution". If a fact does not show importance by itself, do not claim importance.

## R3 — No promotional tone

No unsupported superlatives (*boasts, vibrant, renowned, groundbreaking*). Concrete
data or nothing. Describe what the system does, not how impressive it is.

## R4 — No dangling "-ing" analysis

Banned sentence endings: *…, highlighting/ensuring/reflecting/contributing to…*
If there is an analysis, write it as a sentence with subject and verb backed by a source.

## R5 — No vague attributions

Banned: *experts say, it has been noted, several sources, according to observers,
industry reports*. Cite a concrete, verifiable source (file, PR, migration, log) or
do not make the claim. Mark evidence as CONFIRMED / LIKELY / POSSIBLE / UNKNOWN.

## R6 — No negative parallelism, no rule of three

Banned: *not just X, but also Y* · *not X, it's Y* · *Y rather than X* · decorative
triples of adjectives or short phrases. One direct positive statement.

## R7 — Simple copulas

Use *is/are/has/was/did* (ES: *es/tiene/hace*). Banned: *serves as, stands as,
functions as, operates as, marks, features, offers, maintains, refers to, ventured
into* (ES: *constituye, representa un, erige como, actúa como*).

## R8 — Sober formatting

No emoji as decoration/formatting (unless the UI catalog already uses them).
No mechanical bold (bold only for identifiers, paths, commands). No default
`- **Header**: description` lists — short prose or a plain list. Sentence case in
headings (no Title Case). No heading that only contains other headings, no skipped
heading levels, no 2-4 cell tables that are really prose.

## R9 — No "information is limited" disclaimers

Banned: *information is not widely documented, based on available information,
should be treated as X rather than Y, maintains a low profile*. If data is missing,
say "X could not be verified" flatly or investigate more. Never pad with speculation.

## R10 — No chatbot voice, no placeholders

Banned: *Of course!, Certainly!, I hope this helps, Would you like…?, let me know,
In this section we will discuss…*. The document talks about the system, not to the
user. No unfilled placeholders (`[Article Title]`, `2025-XX-XX`, `INSERT_SOURCE`).

## R11 — Target-format markup only, zero LLM metadata

Banned anywhere: `contentReference`, `oaicite`, `oai_citation`, `turn0search*`,
`turn0image*`, `attribution":{"attributableIndex`, `[cite: N]`, `span_N`,
`grok_card`, `grok_render_citation_card_json`, `【N†L…】`, `attached_file`,
`ppl-ai-file-upload`, `:::writing{variant`, `utm_source=chatgpt.com`,
`utm_source=openai`, `referrer=grok.com`. Markdown only where the target is
Markdown; wikitext for wikis; Textile for Redmine; valid Mermaid for PDFs.
Verify the markup renders before delivering.

## R12 — Real references or none

Never invent DOIs, ISBNs, URLs, books, APIs, functions, columns, CLI commands,
or test results. Every code citation must exist in the repo (real path). Every
external citation must resolve. No `access-date` or date placeholders.

## R13 — No formula sections

Banned section patterns: *Awards and recognition*, *Challenges and Future Prospects*,
*Future Outlook*, *Key takeaways*, per-section closers *Conclusion / In summary*.
Structure follows the real flow, not the model's outline.

## R14 — Summaries/MR/commits without formula

Describe the concrete change with domain nouns. Banned: *improved clarity and flow,
optimized performance, ensured compliance, preserved the original meaning, enriched
the section, refined, streamlined, addressed reviewer feedback, added sourced
content*. Do not narrate markup parameter names as summary content. The original
symptom and the verification dominate.

## R15 — Natural punctuation

Neither compulsive em dashes nor total poverty (only commas and periods). Mix
parentheses, colons, semicolons, short and long sentences as the content needs.
In Spanish avoid repeating "…, lo que permite…".

## R16 — Simple, consistent register

Simple words over inflated synonyms (*used* > *utilized*; *tried* > *attempted*;
*wrote* > *authored*; *died* > *passed away*). New deliverables match the register
of existing repo docs — never artificially elevate it. Code, comments and docs in
English; talk to the human in their language.

## R17 — Meta: no unverified claims disguised as plausible prose

Nothing ships containing claims that were not verified. If something is uncertain,
label it uncertain (confidence tags). Prefer silence over filler.
