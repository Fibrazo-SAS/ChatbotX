# Context — Feature 14997 (Cierre de iteración)

## Summary

Se entregó la **consola de administración de plataforma** (`/admin`) para el super admin
(`PLATFORM_ADMIN_EMAIL` + `User.isPlatformSuperAdmin`), cubriendo **Pieza A (lectura) y
Pieza B (creación)** de usuarios, más la gestión de workspaces, roles y permisos.

Lo entregado:
- **Usuarios**: tabla con buscador server-side, badge de superadmin de plataforma,
  workspaces + rol por usuario, crear usuario (invitación por magic-link), editar
  workspaces/miembros, activar/desactivar, promover/demover superadmin.
- **Workspaces**: listado admin con creación de workspace desde el panel.
- **Permisos/roles**: defaults correctos de member permissions y acceso admin para
  super admins por flag (`User.isPlatformSuperAdmin`).
- **Migrations** (2): `add_user_deactivated_at` y `add_user_is_platform_super_admin`.
- **Fix de test**: `platform-credentials-scope.test.ts` mockeaba `isSuperAdmin`, pero
  `scope.ts` usa `isPlatformSuperAdmin` → mock alineado con el símbolo real (3/3 verdes).

## Files Changed

Principales por área (commits `8fbfef5ad`, `5f985d118`, `735ca7dd9`, `64eda49f9`):

**Consola admin / admin:**
- `apps/builder/src/app/admin/layout.tsx` — gate a super admin + sidebar con `hasEnterpriseFeatures`
- `apps/builder/src/app/admin/users/page.tsx`, `apps/builder/src/app/admin/workspaces/page.tsx`
- `apps/builder/src/features/admin/{actions,components,queries,schema}/…` — sidebar, tablas, dialogs, queries

**Usuarios (Pieza A + B):**
- `apps/builder/src/features/users/{actions,components,queries,schema}/…` — actions create/deactivate/reactivate/promote + dialogs + tabla + queries
- `apps/builder/__tests__/create-platform-user.action.test.ts` — tests action (gate/duplicado/feliz/rollback)

**Business / Auth / DB:**
- `packages/business/src/user/service.ts`, `packages/business/src/user/utils.ts` (`isPlatformSuperAdmin`)
- `packages/business/src/workspace/service.ts`, `packages/business/src/workspace-member/service.ts`
- `packages/auth/src/server.ts`
- `packages/database/drizzle/{20260909141355_add_user_deactivated_at, 20260909162356_add_user_is_platform_super_admin}/` — migrations
- `packages/database/src/schema/auth-user.ts`, `packages/database/src/relations/workspace.ts`

**Scope / utilidades:**
- `apps/builder/src/features/platform-credentials/scope.ts` — usa `isPlatformSuperAdmin`
- `apps/builder/src/features/help-items/scope.ts`, `apps/builder/src/lib/safe-action.ts`, `apps/builder/src/lib/auth/utils.ts`, `apps/builder/src/middlewares/auth.ts`

**i18n (20 locales) + docs + scripts:**
- `apps/builder/messages/*.json` — keys `platformAdmin.*` en los 20 idiomas
- `docs/context/admin/admin-users.md`, `docs/levantar-chatbotx.md`, `scripts/start.sh`

**Cierre (este commit):**
- `spec/feature/14997/context.md` — nuevo (este archivo)
- `apps/builder/__tests__/platform-credentials-scope.test.ts` — fix mock `isSuperAdmin` → `isPlatformSuperAdmin`

## Tests Run

- `pnpm turbo run test --concurrency=2` → **57 tasks: 56 successful, 1 failed** (`builder#test`)
  - builder: **2350 tests, 2 failed** → ambos en `platform-credentials-scope.test.ts` (mock desalineado)
  - Luego del fix: `platform-credentials-scope.test.ts` → **3/3 PASS** (verificado en local)
  - Paquetes restantes: PASS
- `pnpm lint` (ultracite) — PASS (commit `5f985d118` style)
- Typecheck builder + business — PASS

## Deviations from Plan

1. **Alcance mayor al plan.md**: el plan era solo "Pieza B — crear usuario". Se entregó una
   **consola admin completa** (usuarios + workspaces + roles/permisos + deactivate/reactivate).
   Crecimiento orgánico del ticket 14997.
2. **Migrations sí hubo** (el plan decía "ninguna"): se agregaron `deactivatedAt` y
   `isPlatformSuperAdmin` a `User`. Migraciones revisadas y aprobadas antes de aplicar.
3. **Gate de admin**: se usa `isPlatformSuperAdmin` (flag) + backdoor `PLATFORM_ADMIN_EMAIL`,
   no solo `PLATFORM_ADMIN_EMAIL` como sugería el spec original.

## Subagents Executed

- **feature-integration**: schema/queries/tablas/dialogs/actions, migrations de `User`, i18n en 20 locales.
- **debug-specialist**: fix de test `platform-credentials-scope.test.ts` (mock alineado a `isPlatformSuperAdmin`), typecheck + lint + tests.
- **parent**: validación SDD, doc `docs/context/admin/admin-users.md`.

## Next Steps / Blockers

- [ ] **Pieza C** — Roles y permisos claros: desbloquear permisos en community + form por niveles + solo owner crea superadmins (registrado en `task.md`).
- [ ] Rebuild del builder y verificación visual (`start.sh --build` o `--dev`): crear usuario real y ver el magic-link en **MailHog**.
- [ ] Confirmar que el superadmin (`PLATFORM_ADMIN_EMAIL`) ve la sección `/admin` en el sidebar.

## How to Test

**Automated:**
```bash
pnpm --filter builder test __tests__/platform-credentials-scope.test.ts
pnpm --filter builder test __tests__/create-platform-user.action.test.ts
```

**Manual:**
1. `bash scripts/start.sh --build` (o `--dev`) y abrir `http://localhost:3123`.
2. Login con la cuenta `PLATFORM_ADMIN_EMAIL` → ver sección **Users/Workspaces** en `/admin`.
3. `Create user` con un email nuevo → revisar **MailHog** (`http://localhost:8025`) → abrir el magic link → confirmar que `emailVerified=true` y login directo.
4. Con un email duplicado → error tipado sin duplicar fila.
5. Con una cuenta NO admin → acceso a `/admin` devuelve `notFound()`.
