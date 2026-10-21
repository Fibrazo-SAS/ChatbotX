# PR ChatbotX — Sysbrazo client panel (ticket 15467)

Title: `feat(contacts): Sysbrazo client panel — identity, validations, services, ONU`

## What

The inbox conversation panel fetches Sysbrazo client data on demand when the
contact has the custom field `document_id`, and renders two cards:

- Sysbrazo client card: identity (avatar initials, document chip with
  thousands separators, city, last session from ChatbotX), contact (primary /
  alternate phone, email, copy buttons, validation pills VALIDADO /
  PENDIENTE / SIN VALIDAR with the proposed `pending_value`), services (9
  state variants: active, expiring, suspended, TV, TV boxes, addons, lead,
  uninstall, crew pending) and ONU/CPE with a refresh button.
- Chat contact card: existing fields with progressive reveal (5 shown, +3 per
  click, collapse back).

## How

- Lookup: `GET /api/botmaker/client/by-document` with the URL and headers
  taken from the published flow `callApi` step. The base URL comes from the
  fixed workspace global variable `SYSBRAZO_CLIENT_API_URL` (template with
  nested variables, e.g. `{{LOCAL_URL}}` and `{{document_id}}`). The variable
  is created automatically: workspace creation hook
  (`WorkspaceService.ensureSysbrazoClientApiUrlVariable`) plus migration
  `20261020000000_seed_sysbrazo_client_api_url_variable` for existing
  workspaces. Only the value is set by hand per environment.
- ONU: `GET /api/krill/cpe-onu-status/{clientId}` (the endpoint Sysbrazo's own
  `CpeTechnicalStatus` uses), origin derived from the resolved client URL;
  `?force=1` on refresh; 404/500 render as "no info".
- Realtime: `customFieldChanged` broadcasts `contactCustomFieldChanged` to the
  workspace party; the panel refetches the contact, so the panel appears or
  updates when the flow writes `document_id` without a page refresh.
- Zod contract tolerates numeric values in string fields (Sysbrazo returns
  numbers for some phone columns).

## Tests

- builder: 97 passed (contacts + chat suites).
- business: 1621 passed.

## Notes

- Needs the companion Sysbrazo PR (extended payload fields) deployed to dev;
  until then the panel shows only the fields the old endpoint returns.
- Out of scope here: autodiagnóstico/tickets (#15466), notas (#15465),
  multimedia (#15468), manual document capture (phase 2).
