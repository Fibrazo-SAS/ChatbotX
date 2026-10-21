# PR Sysbrazo — extended botmaker payload + ONU service (ChatbotX panel, ticket 15467)

Title: `feat(api): extend botmaker client payload and extract ClientOnuStatusService`

## What

- `ClientController::getClientByDocumentId` response now includes: `email`,
  `alt_phone`, `alt_phone_prefix`, `contact_validations`
  (`ContactValidationService::getStatusForClient`), `balance`
  (`getInternetBalanceInfo`), `tv_boxes`, `installation_status`,
  `addon_subscriptions` (own balance/status), `document_type`,
  `document_type_id`. Existing fields unchanged.
- ONU snapshot removed from this payload. The panel consumes the existing
  `GET /api/krill/cpe-onu-status/{clientId}` endpoint instead (same one the
  portal UI uses), so the botmaker response stays small and Krill latency
  does not block it.
- `KrillController::getCpeOnuStatus` delegates to the new
  `App\Services\Client\ClientOnuStatusService` (1h cache, `force` bypass,
  null on 404/500). No behavior change for the portal UI.

## Tests

- `tests/Unit/KrillControllerPowerStatusTest.php` updated: 14 passed.

## Notes

- Bot flow mapping is unaffected: added keys are additive.
- `ClientOnuStatusService` keeps the same normalized shape as the previous
  inline controller code (state, registrationStates, powers with status,
  uptime, olt, board, port, connectedDevices, lastDownTime).
