# Especificación: Pieza B — Crear usuario desde /admin (invitación por email)

## Ticket
- **Ticket ID**: 14997
- **URL**: https://redmine.example.com/issues/14997  _(reemplazar por la URL real de Redmine)_
- **Tracker**: Feature
- **Prioridad**: Media
- **Pieza**: B (continúa la Pieza A ya implementada — sección Usuarios en /admin)
- **Objetivo**: El super admin de la plataforma puede crear un usuario desde `/admin/users`; el nuevo usuario recibe un email con una URL (magic link) para ingresar.

## Problema
La Pieza A dejó `/admin/users` como página de solo lectura. Hoy los usuarios solo se
crean por auto-registro público (`/auth/sign-up`) o por invitación a un workspace.
No existe forma de que el super admin registre un usuario de forma proactiva y le
entregue un link de ingreso directo.

## Criterios de aceptación
- [ ] El super admin ve un botón "Crear usuario" en `/admin/users`.
- [ ] La acción exige match de `PLATFORM_ADMIN_EMAIL` (mismo gate que el layout admin); no-admins reciben error.
- [ ] Input: `email` (obligatorio, válido), `name` (opcional).
- [ ] Si el usuario ya existe → error (sin duplicados); si no → crear fila `User` con `emailVerified=false`.
- [ ] Enviar el email magic-link usando el `sendMagicLink` existente (`packages/mail`) con la URL de better-auth; variables de marca desde la config white-label.
- [ ] El email se entrega por el transport configurado (MailHog en dev local).
- [ ] i18n: todos los textos de UI vía `useTranslations()`; revisar `apps/builder/messages/en.json` antes de agregar keys.
- [ ] Sin `db` directo en la capa de app para la ESCRITURA — creación vía servicio en `packages/business` según `.agents/rules/data-access.md`. (La lectura usa el patrón legacy de la Pieza A.)
- [ ] Tests: test del action en `apps/builder/__tests__/` cubriendo gate (no-admin rechazado), email duplicado, y camino feliz (fila creada + envío de email invocado).

## Skills & Rules a cargar
- .agents/skills/feature-scaffold
- .agents/skills/builder-ui-i18n (diálogo + form en la tabla de usuarios)
- .agents/skills/business-data-access (servicio de creación de usuario)
Reglas: no-dynamic-import, data-access, i18n (invariante #7).

## Do's and Don'ts
- SÍ reutilizar `sendMagicLink` y el flujo de verificación magic-link de better-auth — NO inventar un esquema de tokens nuevo.
- NO marcar el usuario `emailVerified=true` al crearlo; la verificación ocurre al usar el magic link.
- NO hardcodear el copy del email; reutilizar la plantilla MJML `sign-in-magic-link` existente.
- NO importar `db` en `apps/builder` para la escritura (invariante #9).
- La edición enterprise debe seguir funcionando (feature a nivel plataforma, no depende de licencia).

## Settings & flags
- Ninguno nuevo. Usa `PLATFORM_ADMIN_EMAIL`, el transport SMTP y `BETTER_AUTH_URL` existentes.

## Docs a actualizar
- docs/context/admin/admin-users.md (ampliar con el flujo create-user + email de la Pieza B)
