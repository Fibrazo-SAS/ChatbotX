# Tasks: Panel de contacto — Identidad, contacto y servicios (ticket 15467)

Referencias: `spec.md` (punto de inflexión + mapeo de datos), `plan.md`
(secciones A–D + tabla de archivos).

> Estado: **lunes 19/10** — implementación terminada y verificada (47 tests
> builder, 1621 business, 14 Sysbrazo; lint, tipos e i18n limpios). Pendiente:
> validación visual con datos reales, cierre y commit.

## Alcance (recordado con el usuario el 16/10)
- **EN este ticket (#15467):** identidad + contacto + servicios (9 variantes)
  + estado ONU con refresco.
- **FUERA de este ticket:** Autodiagnóstico y Tickets → #15466; Notas →
  #15465; Multimedia → #15468. Captura manual del documento por el asesor →
  fase 2 (pregunta publicada en Redmine).

## Dependencia externa (repo `sysbrazo`, no este)
- [x] Sysbrazo: ampliar `getClientByDocumentId` para devolver el payload completo (`getPortalClientData` + `getInternetBalanceInfo` + `tvBoxes`) — Owner: parent (coordinación con equipo Sysbrazo)
- [x] Sysbrazo: `onu_status` vía `ClientOnuStatusService` (snapshot Krill extraído de `KrillController`, cache 1h, `force_onu=1`) — Owner: parent
- [x] Sysbrazo: `installation_status` + `addon_subscriptions` (estado y saldo propios) para las variantes de servicios — Owner: parent
- [x] Sysbrazo: tests Krill actualizados (14/14) — Owner: parent

## ChatbotX
- [x] Schema zod del contrato real (`schema/sysbrazo-client.ts`): camelCase (`primary_phone`, `onu_status`, `tv_boxes`, `balance`…), short-codes de documento (CC/CE/TI/PA…), teléfono 3-3-4, parser `d-m-y H:i:s` — Owner: feature-integration
- [x] Lookup on-demand vía oRPC `getSysbrazoClientAuthenticatedAPI` (`api/private.ts`, input con `refreshOnu`) — solo cuando el contacto tiene `document_id` (punto de inflexión) — Owner: feature-integration
- [x] Node-as-source: `get-sysbrazo-client.query.ts` escanea `flowVersionService.listLatestPublishedByWorkspace` y encuentra el paso `callApi` de `/api/botmaker/client/by-document` (scan recursivo: `node.data.details.steps`); interpola `{{URL_DEV}}` + `{{document_id}}`, añade `&force_onu=1` al refrescar; auth solo del nodo — Owner: feature-integration
- [x] URL por nombre de variable global (`{{URL_DEV}}`) + rename UI "Variables globales" (4 locales) + `packages/variables` (177 tests) — Owner: feature-integration
- [x] `SysbrazoPanel` contenedor (estado sin/con `document_id`, fetch on-demand) — Owner: feature-integration
- [x] Bloque Identidad (avatar, nombre, chip documento copiable, ciudad, última sesión = `last_interaction` de ChatbotX) — Owner: feature-integration
- [x] Bloque Contacto (Principal/Alterno/Correo + píldoras VALIDADO/PENDIENTE + copiar) — Owner: feature-integration
- [x] Bloque Servicios con las 9 variantes del mockup: estados por saldo, SALIDA/A DESINSTALAR, A DESIGNAR CUADRILLA, addons con saldo propio, TV Box (PERDIDO/EN RETIRO), LEAD, "Ir Sysbrazo" — Owner: feature-integration
- [x] Bloque ONU/CPE (`onu-block.tsx`): estado, potencias, uptime, OLT, dispositivos + refresco en línea (`refreshOnu` → `force_onu=1`) — Owner: feature-integration
- [x] Montar `SysbrazoPanel` en `ContactInboxPanel` (aditivo, sin tocar lo existente) — Owner: feature-integration
- [x] i18n keys en todos los locales (es/en/pt-BR/pt-PT) — Owner: feature-integration
- [x] Fix imagen rota: `NEXT_PUBLIC_STORAGE_URL=http://localhost:9000/chatbotx/` en `.env` raíz — Owner: feature-integration
- [x] Tests: query/node-as-source, config, format (47/47) — Owner: debug-specialist
- [ ] Tests de componente de los bloques (identity/contact/services/onu) — Owner: debug-specialist
- [ ] Validación visual con datos reales (contacto con `document_id`; cliente con TV Box/addon/instalación/ONU en Krill) y ajuste del contrato si difiere — Owner: parent
- [x] `pnpm lint` + typechecks + suites afectadas — Owner: parent
- [ ] Docs: `docs/context/feature/contact-sysbrazo-panel.md` + `context.md` — Owner: parent
- [ ] Nota de cierre en Redmine #15467 (resumen + fase 2: captura manual del documento) — Owner: parent

## Completion Criteria
- [x] Implementación completa (paneles + lookup + endpoint)
- [x] pnpm lint passed
- [x] Type check passed
- [x] Tests passed (47 builder + 1621 business + 14 Sysbrazo)
- [ ] Validación visual con datos reales
- [ ] Documentation updated (`context.md` + docs)
- [ ] Commit (con aprobación explícita del usuario)
