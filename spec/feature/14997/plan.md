# Plan: Pieza B — Crear usuario desde /admin (invitación por email)

> Reemplaza al plan de la Pieza A (implementada y verificada). Ticket 14997.

## Approach

Botón "Crear usuario" en la tabla `/admin/users` → diálogo con form (email + nombre
opcional) → server action gateada por `superAdminActionClient` → crea la fila `User`
(vía servicio en `packages/business`, `emailVerified=false`) → envía el magic link
con la API server-side de better-auth (`auth.api.signInMagicLink`), que reutiliza el
hook `sendMagicLink` existente en `packages/auth/src/server.ts` (plantilla
`sign-in-magic-link` + SMTP ya configurado). Cuando el usuario hace clic en el link,
better-auth lo verifica y marca `emailVerified=true` — sin lógica nueva de tokens.

Patrones espejo que se copian:
- UI de diálogo + form: `features/workspace-members/components/invite-workspace-member.tsx`
- Gate de action: `superAdminActionClient` (`apps/builder/src/lib/safe-action.ts:87`)
- Estructura del action: `features/workspace-members/actions/invite-workspace-member.action.ts`

## Files Affected

| Archivo | Cambio |
| --- | --- |
| `packages/business/src/user/service.ts` | **Editar** — nuevo método `createPlatformUser({ email, name })`: valida duplicado (por email+tenant raíz), inserta `User` con `emailVerified=false` y audit log. |
| `packages/business/src/user/index.ts` | **Editar** — exportar lo nuevo si corresponde. |
| `apps/builder/src/features/users/actions/create-platform-user.action.ts` | **Nuevo** — server action con `superAdminActionClient`, input zod `{ email, name? }`, llama al servicio y luego `auth.api.signInMagicLink({ body: { email } })`. Errores tipados: duplicado / fallo de envío. |
| `apps/builder/src/features/users/schema/platform-user.ts` | **Editar** — schema zod del input (`createPlatformUserRequest`) + response. |
| `apps/builder/src/features/users/components/create-platform-user-dialog.tsx` | **Nuevo** — diálogo con `useHookFormAction` (patrón invite-workspace-member, con `.bind(null, ...)` si aplica invariante #4). |
| `apps/builder/src/features/users/components/platform-users-table.tsx` | **Editar** — botón "Crear usuario" en el toolbar de la tabla. |
| `apps/builder/messages/*.json` | **Editar** — keys `platformAdmin.users.create.*` en en.json + resto de locales (20). |
| `apps/builder/__tests__/create-platform-user.action.test.ts` | **Nuevo** — tests del action (ver Abajo). |
| `docs/context/admin/admin-users.md` | **Nuevo/Editar** — documentar el flujo create-user + email. |

Nota verificación de export exacto del server auth (`@chatbotx.io/auth/server` → `auth.api`)
se confirma al implementar; si `auth.api` no es accesible desde el builder, se usa
`authClient` equivalente server-side o se extrae helper en `packages/auth`.

## Tests (apps/builder/__tests__/)

1. **Gate**: usuario no-superadmin → la action rechaza (403-style error), no crea fila, no envía email.
2. **Duplicado**: email existente → error tipado, no re-envía email.
3. **Feliz**: email nuevo → fila `User` creada (`emailVerified=false`), `sendMagicLink` invocado una vez.
4. **Validación**: email inválido → error de zod, sin efectos.

## Risk Assessment

- **Low-Medium**:
  - Creación de usuarios escribe en `User` (tabla core) — mitigado: servicio con validación de duplicado + audit.
  - Envío de email depende de SMTP configurado — mitigado: error tipado si falla el envío (no se deja el usuario "creado y silencioso" sin feedback en UI).
  - No toca enterprise/license ni workspaces existentes.
- Migraciones: **ninguna** (no cambia schema).

## Approval Gate

- [x] Spec aprobada ("bien arranca" — 2026-09-08)
- [ ] Este plan aprobado antes de implementar
- [ ] Post-implementación: `pnpm lint` + typecheck builder + tests
