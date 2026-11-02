# Tasks: Quick Replies (#15668)

Ordered checklist with owners. References: `spec.md`, `plan.md`.

- [x] DB schema + migration + relations — Owner: `database-schema`
  - `SavedReply`: nullable `shortcut`, add `imagePath`, `secondText`, `createdById`, `updatedById`; migration `20261102125726_saved-reply-quick-replies`; relations for `createdBy`/`updatedBy`.
- [x] Business service — Owner: `feature-integration`
  - `savedReplyService.create/update/delete` with image validation (JPEG/PNG ≤ 5 MB), image lifecycle, second-text-with-image rule, audit ids, workspace scoping.
- [x] Actions + queries + schemas — Owner: `feature-integration`
  - create/edit/delete actions delegate to the service; resource exposes `imageUrl`, `secondText`, `createdByName`, `updatedByName`; list resolves presigned URLs.
- [x] Quick replies tab + list/search + preview + delete — Owner: `feature-integration`
  - `ChatLayout` tabs Chat / Respuestas rápidas; `QuickRepliesPanel` (search as-you-type, table, Ver/Editar/Borrar, no empty-state message); preview dialog; delete confirmation.
- [x] Editor — Owner: `feature-integration`
  - `QuickReplyEditor`: 13-icon toolbar (Tiptap), image attach/change/remove, second text only with image, `n/4096` counters, inline errors, save/cancel.
- [x] Use in chat — Owner: `feature-integration`
  - `useSavedReplyInChatAction`: parts in order, stop on failure reporting which parts were sent, 24-hour window guard; confirm dialog before sending; shared `messaging-window` util.
- [x] i18n (en, es, pt-BR, pt-PT) — Owner: `feature-integration`
- [x] Tests — Owner: `debug-specialist`
  - `packages/business/src/saved-reply/__tests__/service.test.ts` (11 tests); `apps/builder/src/features/messages/utils/__tests__/messaging-window.test.ts` (5 tests).
- [ ] Apply migration `db:migrate` — Owner: `database-schema` — **needs explicit approval**
- [ ] Manual QA in dev (create/edit/preview/delete/send, image limits, window) — Owner: `parent`
- [ ] Commit + PR — Owner: `parent` — **needs explicit approval**
