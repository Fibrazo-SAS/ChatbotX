# Tasks: Horarios de atención v2 (ticket 15295)

Reemplaza la v1 por el modelo de la guía. Referencias: `spec.md` (modelo),
`plan.md` (decisiones 1–5, tabla de archivos).

- [x] database: remodelar `BusinessHours` (name/timezone/holidays/unique workspace+name) + partials + borrar y regenerar migración (**no aplicar sin OK**) — Owner: database-schema
- [x] business: CRUD + evaluación v2 (toggles, feriados, tz override, scope check) — Owner: feature-integration
- [x] flow-config: `scheduleId` en el step — Owner: feature-integration
- [x] worker: handler por `scheduleId` (fail-open + warn, scope check) — Owner: feature-integration
- [x] builder flow UI: editor con picker + viewer + keys — Owner: feature-integration
- [x] builder settings: lista + edición (intervalos con toggles + feriados + delete) — Owner: feature-integration
- [x] Tests: service + handler + actions al nuevo modelo — Owner: debug-specialist
- [x] `pnpm lint` + typechecks + suites afectadas — Owner: parent
- [x] Docs: reescribir `docs/context/flow/business-hours.md` + `context.md` — Owner: parent

## Completion Criteria
- [x] All checklist items marked done
- [x] pnpm lint passed
- [x] Type check passed (pnpm typecheck if applicable)
- [x] Tests passed (pnpm test or vitest)
- [x] Documentation updated (if applicable)
