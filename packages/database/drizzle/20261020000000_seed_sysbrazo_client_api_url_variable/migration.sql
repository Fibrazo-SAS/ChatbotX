-- Fibrazo fork (ticket #15467): backfill idempotente de la variable global
-- fija del panel de Sysbrazo para TODOS los workspaces existentes al
-- desplegar. Si el workspace ya la tiene (cualquier valor), no se toca —
-- solo se garantiza su existencia; el VALOR se configura por entorno en la
-- UI de "Variables globales".
INSERT INTO "BotField" ("id", "name", "type", "description", "workspaceId")
SELECT
  9000000000000000000 + row_number() OVER (ORDER BY w."id"),
  'SYSBRAZO_CLIENT_API_URL',
  'longText',
  'URL (o plantilla) de Sysbrazo de donde el panel de contacto y el flujo consultan los datos del cliente. Cambia según el entorno (dev/prod/ngrok local). Admite {{...}} de otras variables globales (p.ej. {{LOCAL_URL}}) y {{document_id}} del contacto.',
  w."id"
FROM "Workspace" w
ON CONFLICT ("workspaceId", type, name) DO NOTHING;
