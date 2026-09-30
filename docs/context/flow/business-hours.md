# Business hours (horarios de atención)

Named weekly attention schedules with per-day toggles, timezone override
and holidays — ticket 15295.

## Where it lives

- **Config**: `BusinessHours` rows (many per workspace), edited at
  `/space/[workspaceId]/business-hours` (list) and
  `/space/[workspaceId]/business-hours/[id]/edit`
  (feature `apps/builder/src/features/business-hours/`). Sidebar entry
  `businessHours.sidebarTitle` below Sequences (`PERMISSION_NAV.flows`).
- **Flow usage**: step `checkBusinessHours` in the performAction node
  (`packages/flow-config/src/steps/check-business-hours.ts`). The step only
  carries `scheduleId` (picked in the editor from the workspace schedules);
  time config lives in settings.

## Model

`{ id, workspaceId, name (unique per workspace, case-insensitive), active,
intervals: [{ startMinute, endMinute, days[7] }], holidays: ["YYYY-MM-DD"] }`
(picked with a calendar popover — no free-text dates; stored ISO, shown
DD-MM-YYYY).
The schedule always evaluates in `workspace.timezone` (shown read-only in
the edit page); there is no per-schedule override by design.
Grid mirrors appointment availability (15-minute steps). An interval needs at
least one active day; `start > end` = overnight window.

## Evaluation semantics (`businessHoursService.isWithinBusinessHours`)

Effective "open" = **workspace active window AND schedule**:

1. `workspaceService.isActiveNow(...)` must pass (pre-existing gate).
2. No `scheduleId`, missing/deleted schedule, `active: false`, or empty
   intervals → open (**fail-open**).
3. Today (workspace timezone) in `holidays` → closed, whatever the toggles say.
4. Otherwise the current minute is tested against intervals whose
   `days[weekday]` is on; bounds half-open `[start, end)`; yesterday's
   overnight spill applies.

Unparseable stored intervals → closed + error log. Handler errors → `skip`,
mirroring `handleCondition`'s route-to-otherwise fallback. States:
`success` = inside, `skip` = outside. The worker also verifies
`schedule.workspaceId === conversation.workspaceId` (tenant isolation).

## Wiring map (adding another branch step)

`stepTypes` (`steps/step-action.ts`) → schema + defaultFn
(`steps/<name>.ts`, states from `packages/flow-config/src/states`) →
package barrel (`flow-config/src/index.ts`) → `actionSteps` (`shared.ts`,
covers publish + import/export via `performActionNodeSchema`) → worker
handler + `flowStepHandlers` (`apps/worker/.../step.ts`) → builder
`steps/<name>/{viewer,editor,index}` + `allSteps` (`steps/index.tsx`) +
menu entry (`nodes/perform-action/menu.tsx`) + `messages/*.json` keys.
Schedule picker in flows: oRPC for-flow endpoint + zustand store +
`*StoreProvider` in `flow-detail.tsx` (mirrors appointment calendars).

## List preview
`summarizeIntervals` (`features/business-hours/lib/`) collapses each
schedule into readable lines (`Lun–Vie 09:00–20:00`, capped at 3 + overflow),
computed server-side in the list page with `weekdaysShort` labels.

## Out of scope (future)

- Per-inbox/channel schedules; duplicate-schedule action.
- Inbox-level automatic out-of-hours message (see #14542).
- Card in the tools hub (`ToolsList` is permission-gated).
- `BusinessHours` migration ships unapplied until explicitly approved.
