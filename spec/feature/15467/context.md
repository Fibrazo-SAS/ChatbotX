# Context: Panel de contacto Sysbrazo — ticket 15467 (iteration close)

Iteration closed on 2026-10-20. Panel implementation complete; visual QA done
against local Sysbrazo (ngrok tunnel). Deployment of the Sysbrazo endpoint
changes to dev is the remaining external step.

## What was done

- Panel in the inbox conversation detail with two cards: `SysbrazoPanel`
  (identity, contact with validations, services with 9 variants, ONU/CPE) and
  the existing contact card, now with progressive "Ver más/Ver menos"
  (5 fields initial, +3 per click).
- On-demand lookup gated by the contact custom field `document_id`
  (`getSysbrazoClientByDocument` in
  `apps/builder/src/features/contacts/queries/get-sysbrazo-client.query.ts`).
- URL source: fixed workspace global variable `SYSBRAZO_CLIENT_API_URL`
  (template, nested variables like `{{LOCAL_URL}}` and `{{document_id}}`),
  with fallback to the `callApi` node URL of the published flow. Headers
  (Authorization) always come from the flow node.
- Automatic variable provisioning: `WorkspaceService.ensureSysbrazoClientApiUrlVariable`
  creates it on every new workspace (idempotent) and migration
  `20261020000000_seed_sysbrazo_client_api_url_variable` backfills existing
  workspaces.
- ONU/CPE fetched from the dedicated Krill endpoint
  (`GET /api/krill/cpe-onu-status/{clientId}`, `?force=1` on refresh), origin
  derived from the resolved client URL. Renders UP/DOWN/LOS, registration
  tags, power metrics, OLT/board/port, last-down diagnostic.
- Realtime: `customFieldChanged` business event broadcast as
  `contactCustomFieldChanged` to the workspace party; the inbox refetches the
  contact so the panel appears/updates when the flow writes `document_id`
  without a page refresh.
- Zod contract tolerant to numeric values in string fields (Sysbrazo sends
  phones as numbers for some clients) — `sysbrazoString` preprocess in
  `apps/builder/src/features/contacts/schema/sysbrazo-client.ts`.
- Validation pills per row: VALIDADO (emerald), PENDIENTE (amber, with the
  proposed `pending_value`), SIN VALIDAR (slate) when no record exists.
- i18n for es/en/pt-BR/pt-PT; responsive pass (1-column grids under 300px).
- Sysbrazo: extended botmaker payload (`email`, `alt_phone*`,
  `contact_validations`, `balance`, `tv_boxes`, `installation_status`,
  `addon_subscriptions`); `ClientOnuStatusService` extracted from
  `KrillController`; ONU removed from the client payload (dedicated endpoint
  instead).

## Files changed

ChatbotX (`chatbotx-source`):
- `apps/builder/src/features/contacts/sysbrazo-panel/*` (panel UI: identity,
  contact, services, onu, format)
- `apps/builder/src/features/contacts/schema/sysbrazo-client.ts`
- `apps/builder/src/features/contacts/queries/get-sysbrazo-client.query.ts`
- `apps/builder/src/features/contacts/api/private.ts`
- `apps/builder/src/features/contacts/sysbrazo-config.ts`
- `apps/builder/src/features/contacts/contact-inbox-panel.tsx`,
  `contact-detail.tsx`
- `apps/builder/src/features/chat/chat-realtime.tsx`,
  `apps/builder/src/features/chat/store/chat-store.ts`
- `apps/builder/src/app/globals.css`
- `apps/builder/messages/{es,en,pt-BR,pt-PT}.json`
- `packages/partysocket-config/src/schemas.ts`
- `packages/business/src/contact-custom-field/service.ts`
- `packages/business/src/workspace/service.ts`
- `packages/variables/*` (global variable by name)
- `packages/database/drizzle/20261020000000_seed_sysbrazo_client_api_url_variable/migration.sql`
- `docs/context/feature/contact-sysbrazo-panel.md`
- `.agents/rules/human-writing.md`, `.agents/skills/human-writing/SKILL.md`
- Tests under `apps/builder/src/features/contacts/**/__tests__/`

Sysbrazo (`sysbrazo`):
- `app/Http/Controllers/Api/ClientController.php`
- `app/Http/Controllers/Api/KrillController.php`
- `app/Services/Client/ClientOnuStatusService.php` (new)
- `tests/Unit/KrillControllerPowerStatusTest.php`

## Tests run

- ChatbotX builder: 97 passed (contacts + chat suites; includes query,
  config, schema and format tests).
- ChatbotX business: 1621 passed.
- Sysbrazo: Krill tests 14 passed; `php -l` on changed controllers.

## Deviations from plan

- ONU status does not travel inside the client payload. It moved to the
  dedicated Krill endpoint that Sysbrazo already exposes
  (`CpeTechnicalStatus`), fetched separately and asynchronously by the panel.
  Decided 2026-10-20 with the user.
- The panel URL no longer reads `URL_DEV` by name. It reads the fixed
  variable `SYSBRAZO_CLIENT_API_URL` (auto-created), whose value changes per
  environment and can reference other variables. Decided 2026-10-20.
- Validation rows show a third state (SIN VALIDAR) because many clients have
  no validation records at all.
- `SYSBRAZO_CLIENT_API_URL` is created automatically (workspace creation +
  migration backfill); the only manual step is setting its value.

## Out of scope (other tickets)

- Autodiagnóstico y Tickets → #15466; Notas → #15465; Multimedia → #15468.
- Manual document capture by the advisor → phase 2.

## Next steps

1. Deploy the Sysbrazo changes to dev (4 files) and restart php-fpm.
2. Set `SYSBRAZO_CLIENT_API_URL` (or the referenced variable, e.g.
   `LOCAL_URL`) per environment in the "Variables globales" UI.
3. Flow "Bienvenida": ask for the document only when the contact lacks
   `document_id` (flow builder change).
4. Commit both repos (pending user approval).

## How to test

- Contact with `document_id = 95896589` (Peres Lucas): email, alternate
  phone, VALIDADO primary, PENDIENTE alternate/email with proposed values.
- Contact with `document_id = 350349712` (R Test): all rows show SIN VALIDAR.
- ONU shows real Krill data only against an environment with Krill
  configured (dev): state UP, powers, uptime, OLT. Local shows
  "Sin información" by design.
- Switch contacts: panel clears immediately, no stale data.
- Live document: when the flow writes `document_id` mid-conversation, the
  panel appears without refresh.
