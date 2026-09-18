# Task: Pieza A — Sección Usuarios en /admin

## Checklist

- [x] Schema `features/users/schema/platform-user.ts` (request/response + nuqs search-params cache) — **Owner: feature-integration**
- [x] Query `features/users/queries/list-platform-users.ts` (users + workspaceMembers + workspace, paginada, keyword, badge isPlatformSuperAdmin) — **Owner: feature-integration**
- [x] Tabla `features/users/components/platform-users-table.tsx` (nombre, email, badge superadmin plataforma, workspaces+rol, fecha alta) — **Owner: feature-integration**
- [x] Página `app/admin/users/page.tsx` (RSC + buscador server-side) — **Owner: feature-integration**
- [x] Sidebar admin: item "Users" (`/admin/users`, icono UsersIcon) — **Owner: feature-integration**
- [x] i18n: `platformAdmin.users.*` en los 20 locales — **Owner: feature-integration**
- [x] Typecheck builder (sin errores en archivos de la Pieza A) — **Owner: debug-specialist**
- [x] Lint ultracite (5 archivos, limpio) — **Owner: debug-specialist**
- [x] i18n:check (sin keys faltantes) — **Owner: debug-specialist**
- [ ] Rebuild del builder y verificación visual en `/admin/users` (pendiente — requiere rebuild `start.sh --build` o `--dev`) — **Owner: parent**
- [ ] Confirmar que el superadmin (`PLATFORM_ADMIN_EMAIL`) ve la sección en el sidebar — **Owner: parent**

## Pieza B — Crear usuario desde /admin (invitación por email) — ticket 14997

- [x] Servicio `userService.createPlatformUser` + `deleteUnverifiedPlatformUser` (business) — **Owner: feature-integration**
- [x] Schema `createPlatformUserRequest/Response` (users/schema/platform-user.ts) — **Owner: feature-integration**
- [x] Action `create-platform-user.action.ts` (superAdminActionClient + auth.api.signInMagicLink + rollback) — **Owner: feature-integration**
- [x] Diálogo `create-platform-user-dialog.tsx` + botón en `/admin/users` — **Owner: feature-integration**
- [x] i18n: `platformAdmin.users.create.*` en los 20 locales — **Owner: feature-integration**
- [x] Tests action (gate/duplicado/camino feliz/rollback) — 4/4 verdes — **Owner: debug-specialist**
- [x] Typecheck business + builder, ultracite, i18n:check — **Owner: debug-specialist**
- [x] Doc `docs/context/admin/admin-users.md` — **Owner: parent**
- [ ] Rebuild del builder y prueba visual (crear un usuario y ver el email en MailHog) — **Owner: parent**

## Pendiente (futuras iteraciones)

- [ ] Pieza C — Roles y permisos claros (desbloquear permisos en community + form por niveles + solo owner crea superadmins)