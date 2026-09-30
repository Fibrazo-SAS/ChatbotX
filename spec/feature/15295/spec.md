# Spec: Horarios de atención (múltiples schedules por workspace) — ticket 15295

## Ticket
- **URL**: https://redmine.fibrazo.com.co/issues/15295 (proyecto Sysbrazo)
- **Tracker**: Feature
- **Priority**: Normal — Complexity: Medium
- **Goal**: Workspaces con N horarios de atención nombrados (ej. Horario
  general, Horario Soporte), cada uno con intervalos semanales con toggles
  por día, timezone propio opcional y feriados; los flujos eligen qué
  horario evaluar en el step.

## Problema
La primera versión implementó UN schedule único por workspace sin nombre,
sin feriados y con timezone heredado. La guía del equipo define el modelo
real: múltiples horarios nombrados con intervalos con días activables,
override de timezone por horario y fechas sin atención. Este spec reemplaza
el modelo anterior (la migración nunca se aplicó: no hay datos que migrar).

## Modelo (de la guía del equipo)
1. **Múltiples horarios por workspace**: lista en el sidebar (Horarios de
   atención), botón + Nuevo horario, editar por nombre. Cada horario tiene
   toggle activado/desactivado propio.
2. **Intervalos con toggles por día**: cada intervalo define apertura
   (HH:MM) y cierre (HH:MM) + un toggle por día (Lun–Dom). N intervalos por
   horario. Ejemplo: Intervalo 1 L-V 09:00–20:00; Intervalo 2 Sáb 09:00–16:00.
3. **Zona horaria**: por defecto la global del workspace; cada horario puede
   sobrescribirla (ej. Soporte Arg vs Ventas Col).
4. **Fechas sin atención** (feriados/cierres, DD-MM-YYYY): en esos días el
   resultado es fuera de horario aunque los toggles semanales digan abierto.

## Criterios de aceptación
- [ ] CRUD de horarios: nombre único por workspace, timezone override
  opcional (vacío = workspace), toggle activo.
- [ ] Intervalos con días: grilla 15 min, apertura !== cierre, al menos un
  día activo por intervalo; overnight permitido (cierre <= apertura).
- [ ] Feriados por horario (lista de fechas): en feriado → fuera de horario.
- [ ] El step lleva `scheduleId` elegido en un picker del editor; sin
  selección o schedule borrado → dentro (fail-open) + warn en log.
- [ ] Evaluación: `workspace.isActiveNow` AND `schedule.active` AND
  no-feriado AND match semanal en la tz del schedule (o workspace).
- [ ] El worker verifica que el schedule pertenece al workspace de la
  conversación (aislamiento multi-tenant).
- [ ] Strings con `useTranslations()`; tests del worker/service/action;
  `pnpm lint` y typecheck limpios.

## Preguntas abiertas (bloquean el plan)
- Unicidad de nombre: ¿case-insensitive con trim? (propuesta: sí).
- Límites: ¿máx intervalos por horario y feriados por horario?
  (propuesta: 28 intervalos totales, 100 feriados).
- Viewer del step: ¿muestra el nombre del schedule? (propuesta: no en v1).
- Duplicar horario: ¿entra en v1? (propuesta: no).

## Skills & Rules
- .agents/skills/flow-step-development (step con `scheduleId`: schema +
  editor con picker + viewer + handler con scope check)
- .agents/skills/contact-filter (no aplica: se mantiene step aislado)
- .agents/skills/drizzle-database (tabla `BusinessHours` remodelada +
  migración regenerada, aún no aplicada)
- .agents/skills/worker-development, .agents/skills/reliability-concurrency
- .agents/skills/builder-ui-i18n, .agents/skills/testing-workflow,
  .agents/skills/feature-scaffold (páginas lista + edición)
- Reglas: data-access (sin `db` directo en app), git.md

## Do's and Don'ts
- SÍ verificar en el worker que `schedule.workspaceId` ===
  `conversation.workspaceId` (invariante #10, tenant isolation).
- SÍ mantener fail-open documentado: sin schedule / desactivado / sin
  selección / borrado → `success` (dentro).
- SÍ reutilizar semántica de ventana de `computeTriggerAt` (overnight con
  start > end) + spill del día anterior.
- SÍ espejar el patrón de picker en flujos de `appointment-scheduling`
  (query `list-*-for-flow` + store/select según corresponda).
- NO hardcodear strings; NO importar `db` en `apps/` ni `integrations/`.
- NO tocar el gate existente `isActiveNow` de recepción de mensajes.
- La config hereda el tenant del workspace, nunca de input del cliente.

## Docs to Update
- docs/context/flow/business-hours.md (reescribir: modelo N schedules,
  feriados, override de tz, picker del step).
