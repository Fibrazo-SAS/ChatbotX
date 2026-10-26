# Tasks: contact panel notes

## Execution status

Planning documents only. All implementation tasks are pending approval of `plan.md` and resolution of its blocking decisions. Owners below are responsibilities, not evidence that a subagent has run.

## Contract and prerequisites

- [ ] **C1 — Owner: parent.** Confirm actual contacts API registration, permission facilities, integration configuration, and adjacent service patterns. Record exact implementation paths. References: plan §1–2; spec integration contract and dependencies.
- [ ] **C2 — Owner: parent.** Coordinate with Sysbrazo S2: approve route/payload/errors, actor namespace and trust, permissions, pagination/counts, retry strategy, timezone, and create-filter behavior. Update both plans. Blocks C3–C7.
- [ ] **C3 — Owner: parent.** Obtain explicit approval for implementation scope and commands. Confirm Sysbrazo contract fixtures/API readiness. Reference: plan approval gates.

## Implementation

- [ ] **C4 — Owner: feature-integration.** Add Sysbrazo client-note schemas and server-only integration operations using existing credentials and external-request conventions. Do not read, write, migrate, or delete ChatbotX `ContactNote` records. References: plan §2; spec integration contract.
- [ ] **C5 — Owner: feature-integration.** Add and register authenticated list/create/update procedures, deriving actor identity and resolving the workspace/contact association server-side. References: plan §2; spec access/edit requirements.
- [ ] **C6 — Owner: feature-integration.** Implement and mount the Sysbrazo client-notes section: filters/counts, five-item loading, collapse/expand, ancient/edited states, and inline create/edit. Do not modify the existing ChatbotX contact-notes feature. References: plan §3; spec display requirements.
- [ ] **C7 — Owner: feature-integration.** Complete translations, accessibility, pending/error/retry behavior, unresolved-client handling, expiry display, and stale-response protection. References: plan §3; spec UI conventions.

## Verification and closure

- [ ] **C8 — Owner: debug-specialist.** Add tests for procedure authorization, spoofed identity, cross-workspace/client access, contract errors, and duplicate-write handling. References: plan §4; spec acceptance criteria.
- [ ] **C9 — Owner: debug-specialist.** Add UI tests for 5/10/12 pagination, filters/counts, creation, multi-expansion, exact time boundaries, expired edits, state resets, and error preservation. References: plan §4; spec acceptance criteria.
- [ ] **C10 — Owner: parent.** Request approval for exact verification commands and run targeted checks, lint, types, tests, and required coverage. Record failures and blockers; do not claim unrun checks passed.
- [ ] **C11 — Owner: parent.** Coordinate manual QA with Sysbrazo S10, including both origins and existing Simazo notes. No production mutations without separate authorization.
- [ ] **C12 — Owner: parent.** With the applicable documentation approval, write the domain documentation and `context.md`; record changed files, tests, deviations, subagents actually used, and rollout prerequisites. References: plan §4; spec documentation.
- [ ] **C13 — Owner: parent.** Present results and obtain separate approvals for any commit, push, or deployment. Do not apply Sysbrazo migrations from this repository's approval.
