# Relevamiento: ChatbotX vs. Documentos de Funcionalidades (Agentes / Avance)

> **Fecha:** 2026-10-01
> **Fuentes:**
> - `Documento de Avance: Relevamiento ChatbotX` (funcionalidades probadas, brechas, pendientes)
> - `Funcionalidades_Botmaker_Agentes_Lideres (1) - Agentes.md` (funcionalidades de asesores en Botmaker)
> **Método:** verificación ítem por ítem contra el código fuente del repositorio ChatbotX.

---

## 1. Checklist: Documento de Avance (Relevamiento ChatbotX)

### 1.1 Funcionalidades probadas y validadas

| Ítem del documento | Estado | Evidencia en código |
|---|---|---|
| Modularidad / transferencia entre flujos y bots | ✅ Existe | Nodos `startFlow`, `startAnotherNode`, `startExternalFlow` (`packages/flow-config/src/nodes/`) |
| Armado de flujos | ✅ Existe | Flow builder completo (`apps/builder/src/features/flows/`) |
| Recopilación de información en variables | ✅ Existe | Bot fields (`features/bot-fields/`), custom fields (`features/custom-fields/`), paso `set-custom-field` |
| Descargar / enviar datos a Google Sheets | ✅ Existe | Pasos `spreadsheet-*` (`packages/flow-config/src/steps/spreadsheet*.ts`), export de contactos (`features/contacts/export-contact-dialog.tsx`) |

### 1.2 Observaciones y brechas

| Ítem del documento | Estado | Comentario |
|---|---|---|
| **Reglas de horario** (condición global para derivar al usuario) | ⚠️ Parcial | **No es nativa como "regla de horario" dentro del flujo.** Aproximaciones: condiciones fecha/hora en triggers (`features/conditions/date-time-based-trigger.tsx`), nodo `wait` con ventana horaria (`steps/wait.ts`, `startTime`/`endTime`), condición sobre campo custom `date/datetime` (con timezone), o JS en el nodo. |
| Idioma 100% en inglés | ✅ Resuelto | UI multi-idioma: `apps/builder/messages/{en,es,pt-BR,pt-PT}.json` |
| Workaround: script JS por nodo | ✅ Existe | Paso `execute-javascript` |
| Workaround: sección "Secuencias" | ✅ Existe | Feature `sequences` + pasos `subscribe-sequence`/`unsubscribe-sequence` |

### 1.3 Pruebas con IA (en progreso)

| Ítem del documento | Estado | Comentario |
|---|---|---|
| Crear agentes de IA para casos de uso específicos | ✅ Existe | Feature `ai-agents` (CRUD: prompt, modelos, tools, web search, rich responses) |
| Delegar un flujo rígido (ej. Traslado) a un agente de IA | ✅ Factible | Paso de flow `ai-generate-text-agent` + `ai-extract-data` (`packages/flow-config/src/steps/`) |

### 1.4 Pendientes (entorno de asesores)

| Ítem del documento | Estado | Comentario |
|---|---|---|
| Espacio de trabajo y herramientas de chat del asesor | ✅ Existe | Inbox de 3 paneles (`features/chat/chat-layout.tsx`) |
| Transferencias de conversaciones entre agentes | ✅ Existe | `assign-conversation` (agente o equipo), `UpdateConversationAssignee` |
| Uso y envío de respuestas rápidas | ✅ Existe | `features/saved-replies/` con atajo `/` |
| Generación de resúmenes de conversación para el usuario/asesor | ⚠️ Parcial | El worker genera resúmenes (`apps/worker/src/ai-agent/handlers/summarize-conversation.ts`) pero **no hay resumen visible para el asesor en la UI** |

---

## 2. Checklist: Funcionalidades de Agentes (Botmaker)

### 2.1 Envío de contenido

| Función Botmaker | Estado | Comentario |
|---|---|---|
| Mensaje de texto | ✅ Existe | `features/messages/components/message-input.tsx` |
| Imágenes, videos y archivos/documentos | ✅ Existe | Adjuntos (`FileUploadPreview`) + media library (`MediaLibraryTrigger`) |
| Mensajes de voz (grabar audio) | ❌ No existe | El **bot** puede enviar audio (paso `send-audio`); el asesor no graba voz en el chat |
| Hacer llamadas desde WhatsApp | ❌ No existe | La integración WhatsApp no procesa eventos de llamada |

### 2.2 Gestión de la cola / chat

| Función Botmaker | Estado | Comentario |
|---|---|---|
| Transferir a fila de atención (cola/skill) | ✅ Existe | Equipos `InboxTeam` + `InboxTeamMember`; asignación a equipo (`assignedInboxTeamId`). ⚠️ Gestión UI en `apps/builder/src/enterprise/features/inbox-teams` (enterprise) |
| Asignar chat a otro agente | ✅ Existe | `assign-conversation.action.ts` |
| Liberar chat bloqueado | ✅ Existe | Desasignar (`AssignConversationDialog` con `showRemove`; paso `unassign-conversation`) |
| Cerrar / archivar conversación | ✅ Existe | `archive-conversation.action.ts` / `unarchive-conversation.action.ts` |
| Tipificación de la interacción (obligatoria) | ❌ No existe | `Conversation` no tiene campo de motivo/resultado de cierre |
| Posponer / congelar interacción | ❌ No existe | Sin snooze/postpone |
| Sistema de alertas visuales (colores por tiempo de espera) | ⚠️ Parcial | No-leído, estrella de seguimiento, badge de ads (CTWA), tiempo relativo; **sin indicadores SLA por espera** |

### 2.3 Bot dentro de la conversación

| Función Botmaker | Estado | Comentario |
|---|---|---|
| Apagar / encender el bot en un chat puntual | ✅ Existe | `disable-bot` / `enable-bot`. ⚠️ Auto-reactivación: **24 h** (`BOT_DISABLE_DURATION_MS` en `features/conversations/utils/bot-state.ts`); Botmaker: 30 min |
| Ejecutar un Flow del bot desde el chat | ✅ Existe | `features/messages/components/input-menu.tsx` → `SelectFlowDialog` |
| Buscar y enviar una regla del bot | ⚠️ Parcial | No hay "reglas entrenadas" estilo Botmaker; equivalente: respuestas automáticas por keywords + respuestas rápidas + enviar flow |

### 2.4 Plantillas y respuestas

| Función Botmaker | Estado | Comentario |
|---|---|---|
| Banco de respuestas rápidas / atajos con `/` | ✅ Existe | `features/saved-replies/` (`quick-replies-popover.tsx`) |
| Crear plantillas/atajos propios | ⚠️ Parcial | CRUD completo pero **por workspace**, no listas personales por agente |
| Plantillas de WhatsApp (Notifications Engine) | ✅ Existe | `features/templates/` + paso `send-wa-message-template` |
| Plantillas cargadas para uso de asesores | ✅ Existe | Misma feature `templates/` |

### 2.5 Productividad con IA (en el chat)

| Función Botmaker | Estado | Comentario |
|---|---|---|
| Sugerencias de respuesta con IA (hasta 3 opciones) | ❌ No existe | Sin sugerencias IA en la UI del chat |
| Crear un prompt dentro del chat (redactar/resumir/reformular) | ❌ No existe | Sin entrada de prompt IA en el chat |
| Explicaciones de IA generativa (resumen/contexto) | ⚠️ Parcial | Resumen generado en worker para contexto de IA; **no expuesto al asesor** |

### 2.6 Información del cliente

| Función Botmaker | Estado | Comentario |
|---|---|---|
| Panel de información adicional | ✅ Existe | `features/contacts/contact-inbox-panel.tsx` (panel derecho del chat) |
| Editar variables del cliente durante la conversación | ✅ Existe | `EditContactField`, `ContactCustomFieldManage`, `UpdateContactTagField` |
| Etiquetas (tags) | ✅ Existe | `features/tags/` |
| Tiempos de espera y de respuesta | ⚠️ Parcial | DB guarda `contactRepliedAt`/`adminRepliedAt`/`lastActivityAt`; la UI muestra tiempo relativo, **no "lleva X esperando" explícito** |
| Historial y sesiones previas | ⚠️ Parcial | El panel muestra datos del contacto (inboxes, citas, cupones, secuencias); **no historial de conversaciones anteriores** |

### 2.7 Personalización y navegación

| Función Botmaker | Estado | Comentario |
|---|---|---|
| Accesos directos configurables en el encabezado | ❌ No existe | — |
| Búsqueda de conversaciones (nombre o contenido) | ✅ Existe | `features/conversations/conversation-filter.tsx` con `keyword` |
| Cambiar estado del agente (disponible/ocupado/ausente) | ❌ No existe | Sin presence/availability |

### 2.8 Notas y comunicación interna

| Función Botmaker | Estado | Comentario |
|---|---|---|
| Notas internas o de transferencia | ✅ Existe | `features/contact-notes/` (solo lado agente) + paso `add-contact-notes` |
| Chat interno entre agentes | ❌ No existe | — |

### 2.9 Sugeridas para el aplicativo de interacciones

| Función Botmaker | Estado | Comentario |
|---|---|---|
| Encuesta de satisfacción post-atención (CSAT/NPS) | ⚠️ Parcial | `questionnaires/` + paso de flow `questionnaires`; **no vinculado al cierre del caso** |
| Vista 360° del cliente (todas las interacciones y canales) | ⚠️ Parcial | Panel de datos completo; **sin historial de conversaciones previas por canal** |
| Traducción automática de mensajes | ❌ No existe | La UI es multi-idioma, pero no se traducen mensajes de clientes |
| Adjuntar y consultar archivos previos del cliente | ⚠️ Parcial | Media library + adjuntos por conversación; **sin historial de archivos por contacto** |

---

## 3. Brechas → Tickets recomendados

### 3.1 Resumen numérico

| Estado | Cantidad |
|---|---|
| ✅ Existe | 26 |
| ⚠️ Parcial | 11 |
| ❌ No existe | 9 |

### 3.2 Tickets sugeridos (priorizados para el caso de uso: operación de asesores + flujo de traslado con IA)

#### 🔴 Alta prioridad (bloquean la operación diaria del asesor)

| # | Brecha | Descripción corta | Notas |
|---|---|---|---|
| 1 | **Tipificación de interacciones** | Clasificar motivo/resultado al cerrar el chat (obligatoria) para trazabilidad y reportes | Requiere campo en `Conversation` + UI de cierre |
| 2 | **Posponer / congelar interacción** | Pausar un chat por un tiempo definido y que reaparezca automáticamente | Nuevo estado en `Conversation` + scheduler |
| 3 | **Resumen de conversación visible para el asesor** | Exponer en la UI el resumen que ya genera el worker | Trabajo de UI + API sobre infraestructura existente |
| 4 | **Sugerencias de respuesta con IA en el chat** | La IA propone respuestas según el último mensaje del usuario | Requiere paso de IA + UI en `message-input` |
| 5 | **Estado del agente (disponible/ocupado/ausente)** | Controlar si le siguen entrando chats nuevos al asesor | Sin presencia actualmente |
| 6 | **Chat interno entre agentes** | Consultar a un compañero/supervisor en paralelo sin salir del chat | Feature nueva |

#### 🟡 Media prioridad (mejoran la experiencia / completan el modelo Botmaker)

| # | Brecha | Descripción corta | Notas |
|---|---|---|---|
| 7 | **Alertas SLA visuales por tiempo de espera** | Colores/indicadores según el tiempo de espera en la lista de conversaciones | Datos ya existen (`lastActivityAt`, `contactRepliedAt`) |
| 8 | **Prompt IA dentro del chat** | Pedir a la IA redactar/resumir/reformular un texto para el cliente | Similar al #4 |
| 9 | **Respuestas rápidas por agente** | Listas personales de atajos, no solo de workspace | Hoy son compartidas por workspace |
| 10 | **Encuesta CSAT/NPS post-cierre** | Medir percepción del cliente al cerrar el caso | Vincular `questionnaires` al cierre de conversación |
| 11 | **Historial de conversaciones previas del contacto (360°)** | Ver interacciones anteriores del usuario en el panel de contacto | Completar la vista 360° |
| 12 | **Auto-reactivación del bot a los 30 min** | Hoy se reactiva a las 24 h; Botmaker reactiva a los 30 min | Cambio de constante/UX |
| 13 | **Archivos previos del cliente por contacto** | Recuperar comprobantes/documentos ya compartidos | Historial de adjuntos por contacto |

#### 🟢 Baja prioridad / requiere decisión de producto

| # | Brecha | Descripción corta | Notas |
|---|---|---|---|
| 14 | **Regla de horario nativa en flujos** | Condición global de horario para derivar al usuario (ya relevada a 42mate — **dar seguimiento al ticket existente**) | Hay aproximaciones; evaluar si el ticket anterior avanza |
| 15 | **Mensajes de voz (grabar en el chat)** | Grabar y enviar audio directo desde el chat | Evaluar necesidad real |
| 16 | **Llamadas desde WhatsApp** | Gestionar casos complejos por llamada | ⚠️ **Limitación de la API de Meta** — evaluar viabilidad |
| 17 | **Traducción automática de mensajes** | Atender clientes en otro idioma | Baja prioridad |
| 18 | **Accesos directos configurables en el encabezado** | Botones que disparan un bloque del bot | Baja prioridad |

---

## 4. Próximos pasos

1. **Crear/confirmar tickets** para las brechas de prioridad alta y media (sección 3.2) en el tracker del equipo 42mate.
2. **Seguimiento del ticket existente de "Reglas de Horario"** (brecha ya relevada): confirmar estado y evaluar las aproximaciones actuales como solución intermedia.
3. **Coordinar pruebas del entorno de asesores** (pendiente original del Documento de Avance) con Juan Esteban y su equipo, usando como guía el checklist de la sección 2.
4. **Decidir con producto** las brechas de prioridad baja (voz, llamadas, traducción, accesos directos) antes de ticketear.
5. Este documento se mantiene como referencia viva: actualizar estados a medida que se implementen los tickets.

