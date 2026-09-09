# Admin — Users (/admin/users)

## Pieza A — User directory (read-only)

- Route: `/admin/users`, gated by `admin/layout.tsx` (`isSuperAdmin` →
  `PLATFORM_ADMIN_EMAIL` match).
- Query: `apps/builder/src/features/users/queries/list-platform-users.ts`
  (paginated, keyword search, `isPlatformSuperAdmin` badge).
- Table: `apps/builder/src/features/users/components/platform-users-table.tsx`.

## Pieza B — Create user (invite by email) — ticket 14997

Flow: super admin clicks "Create user" on `/admin/users` → dialog
(`email` + optional `name`) → `createPlatformUserAction`
(`apps/builder/src/features/users/actions/create-platform-user.action.ts`):

1. `superAdminActionClient` gate (`apps/builder/src/lib/safe-action.ts`).
2. `userService.createPlatformUser` (`packages/business/src/user/service.ts`):
   duplicate check by email (root-tenant), inserts `User` with
   `emailVerified=false`.
3. `auth.api.signInMagicLink({ body: { email }, headers })` — better-auth's
   magic-link plugin reuses the existing `sendMagicLink` hook
   (`packages/auth/src/server.ts`) which renders the `sign-in-magic-link`
   MJML template over the configured SMTP transport (MailHog in local dev).
4. On send failure the unverified row is rolled back
   (`userService.deleteUnverifiedPlatformUser`, guarded by
   `emailVerified=false`) and a typed error is surfaced; retry works.

Notes:
- The row MUST be created before requesting the link: the magic-link sender
  only delivers to already-registered emails.
- No audit record: audit rows are workspace-scoped (`AuditService` drops
  records without `workspaceId`); platform user creation has no workspace.
- Verification happens when the user clicks the link (better-auth
  `emailVerified` flip) — never at creation.
- i18n keys: `platformAdmin.users.create.*` (all 20 locales).

## Pieza C — Roles de plataforma + workspaces admin + permisos

Modelo de roles:
- **Platform Super Admin**: ve /admin completo, todos los usuarios y
  workspaces de todos los tenants. El anchor es `PLATFORM_ADMIN_EMAIL`
  (env, siempre super admin, NO desactivable — guard en
  `userService.deactivatePlatformUser` — ni revocable). Se pueden promover
  otros usuarios vía `User.isPlatformSuperAdmin`
  (migración `20260909162356_add_user_is_platform_super_admin`):
  - Gate canónico: `isPlatformSuperAdmin` (business/user/utils) = flag ||
    env email. Gates: `admin/layout.tsx`, `superAdminActionClient`,
    badge de la tabla, guard de creación de workspaces
    (`workspaceService.create`). El flag viaja en la sesión better-auth
    (`user.additionalFields` → returned: true).
  - **Solo el admin del .env otorga/revoca** el flag
    (`setPlatformSuperAdminAction` + guard en servicio): los promovidos
    administran pero no reproducen super admins.
  - Un owner de reseller (tenant activo) **no puede ser promovido**
    (vería datos de otros resellers → rompe aislamiento).
- **Workspace owner/admin**: dueño de UN workspace (rol `owner`).
- **Agent**: operador del workspace (inbox/contactos según permisos).

/admin/workspaces (nueva):
- Directorio de TODOS los workspaces (todos los tenants): nombre, owner(s),
  cantidad de miembros, tenant, fecha. Gated por admin/layout.
- "Create workspace" (`createAdminWorkspaceAction` →
  `workspaceService.create`, que ya exigía platform admin — ahora acepta
  también el flag). Owner opcional (default: el admin que crea). Community:
  respeta el límite de 1 workspace por owner del servicio.

Permisos por workspace (edit dialog):
- Cada membresía en `EditUserWorkspacesDialog` tiene un desplegable con los
  8 switches (`fields.permissions.*`), auto-save vía
  `updateUserMembershipAction` (input opcional `permissions`,
  `updateMembershipForPlatformAdmin` persiste rol y/o permisos).
- Acople contacts ↔ onlyAssigned reutilizado
  (`normalizeContactsPermissions`). Super Admin manda sobre los demás.
- Community: switches ocultos y permisos forzados a superAdmin
  (misma regla que el flujo workspace-scoped).
- Rol `owner` ahora elegible en los 3 selects (add/edit/create);
  guard server-side: nunca degradar/sacar al ÚLTIMO owner.
- Los badges de workspace en la tabla de usuarios son clickeables → abren
  el edit dialog de ese usuario.
- Relación nueva `workspaceModel.workspaceMembers`
  (`packages/database/src/relations/workspace.ts`) para el directorio.

## Pieza C — Workspace membership + deactivation (admin actions)

Add-to-workspace (sin flujo de invitación, acceso inmediato):
- **Al crear** (`createPlatformUserAction`): input opcional `workspaceId` +
  `role` (default `agent`). La membresía se crea ANTES del magic link — si el
  email falla, el rollback del usuario hace cascade del miembro
  (`workspaceMemberModel.userId` → onDelete cascade).
- **Usuario existente** (`addUserToWorkspaceAction`): acción por fila en la
  tabla. Ambos usan `workspaceMemberService.addMemberForPlatformAdmin`
  (chequea duplicado, decrementa/incrementa `teamMembers`, invalida caches
  `workspace-members:*` y `users:<id>:workspace-members`).
- Selector de workspaces: `listWorkspacesForAdmin` (id+name, cap 100, keyword).

Edit memberships (rol / sacar de UN workspace):
- `EditUserWorkspacesDialog`: lista las membresías del usuario (del row data,
  estado local optimista + revert al fallar). Cambio de rol auto-save
  (`updateUserMembershipAction`) y basurita por fila
  (`removeUserMembershipAction`). El rol `owner` solo se muestra si el
  miembro YA es owner (para poder degradar, nunca promover — el owner es la
  ancla del tenant/quota). Guards server-side en
  `workspaceMemberService.updateRoleForPlatformAdmin` /
  `removeMemberForPlatformAdmin`: nunca degradar/sacar al ÚLTIMO owner del
  workspace (misma regla que `updateWorkspaceMemberAction`).

Deactivate / reactivate ("ya no trabaja acá"):
- `User.deactivatedAt` (timestamp nullable, migración
  `20260909141355_add_user_deactivated_at`).
- **Deactivate** (`deactivatePlatformUserAction`): setea `deactivatedAt` +
  borra todas las `Session` (logout inmediato en builder y realtime). El hook
  `session.create.before` de better-auth
  (`guardDeactivatedUserSession` en `packages/auth/src/server.ts`) rechaza
  cualquier NUEVA sesión (password, magic link, SSO, bearer) con 403 mientras
  el flag esté seteado. Checkbox opcional "remove from all workspaces"
  (`workspaceMemberService.removeAllByUserId` — reusa `delete` por fila para
  decrementar usage + auditar).
- **Reactivate** (`reactivatePlatformUserAction`): limpia el flag. Las
  membresías no se restauran solas si se eligió removerlas.
- No se borra ningún dato; el usuario aparece con badge "Deactivated" en la
  tabla.
- Registro alternativo deshabilitado: el link "Sign up" del sign-in está
  comentado en `features/auth/sign-in.tsx` (acceso solo por invitación/admin).
  Pendiente: bloquear `/auth/sign-up` y `signUp.email` server-side.

## Pendiente (Pieza C, futura)

- Roles/permisos claros: desbloquear permisos en community, form por niveles,
  solo owner crea superadmins.
