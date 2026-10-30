import {
  conversationService,
  sysbrazoClientMultimediaService,
} from "@chatbotx.io/business"
import { ChatbotXException } from "@chatbotx.io/business/errors"
import { db } from "@chatbotx.io/database/client"
import z from "zod"
import { withWorkspaceIdSchema } from "@/features/workspaces/schema/resource"
import { getCurrentUserAndTargetWorkspace } from "@/lib/auth/utils"
import { workspaceAuthorizedMidddleware } from "@/middlewares/auth"
import { authorizedAPI } from "@/orpc"
import { setContactCustomFieldValue } from "../actions/add-contact-custom-field.action"
import { addContactTags } from "../actions/add-contact-tag.action"
import { createContact } from "../actions/create-contact.action"
import { deleteContactCustomFields } from "../actions/delete-contact-custom-field.action"
import { removeContactTags } from "../actions/remove-contact-tag.action"
import { requireContactPermissionScope } from "../permissions"
import { getContact } from "../queries/get-contact.query"
import { getExportFile } from "../queries/get-export-file.query"
import {
  getSysbrazoClientByDocumentId,
  getSysbrazoClientForConversation,
  getSysbrazoClientOnu,
  resolveContactSysbrazoDocumentId,
} from "../queries/get-sysbrazo-client.query"
import { listContactCustomFields } from "../queries/list-contact-fields.query"
import {
  countContactInboxes,
  listAudienceInboxesPreview,
} from "../queries/list-contact-inboxes.queries"
import { listContactTags } from "../queries/list-contact-tags.query"
import { countContacts, listContacts } from "../queries/list-contacts.queries"
import {
  createSysbrazoNote,
  createSysbrazoAutodiagnosticTicket,
  getSysbrazoAutodiagnosticDetail,
  getSysbrazoAutodiagnostics,
  getSysbrazoNotes,
  getSysbrazoTickets,
  startSysbrazoAutodiagnostic,
  updateSysbrazoNote,
} from "../queries/sysbrazo-support.query"
import {
  createContactRequest,
  createContactResponse,
  getExportFileRequest,
  getExportFileResponse,
} from "../schema/action"
import {
  deleteContactCustomFieldRequest,
  listContactCustomFieldsRequest,
  listPublicContactCustomFieldsResponse,
  setContactCustomFieldValueRequest,
} from "../schema/contact-custom-field"
import {
  addContactTagRequest,
  listContactTagsRequest,
  listContactTagsResponse,
  removeContactTagRequest,
} from "../schema/contact-tag"
import {
  getContactRequest,
  getContactResponse,
  listContactInboxesAudiencePreviewRequest,
  listContactInboxesAudiencePreviewResponse,
  listContactsRequest,
  listContactsResponse,
} from "../schema/query"
import {
  sysbrazoConversationLookupResponseSchema,
  sysbrazoOnuStatusSchema,
} from "../schema/sysbrazo-client"
import {
  sysbrazoClientMultimediaListSchema,
  sysbrazoClientMultimediaUrlSchema,
} from "../schema/sysbrazo-multimedia"
import { sysbrazoNotesResponseSchema } from "../schema/sysbrazo-notes"
import {
  sysbrazoAutodiagnosticsLookupSchema,
  sysbrazoAutodiagnosticTicketOutcomeSchema,
  sysbrazoDiagnosticDetailSchema,
  sysbrazoStartDiagnosticResponseSchema,
  sysbrazoTicketsLookupSchema,
} from "../schema/sysbrazo-support"
import {
  canRunSysbrazoAutodiagnostic,
  canUseSysbrazoMultimedia,
  canViewSysbrazoNotes,
} from "../sysbrazo-panel/permissions"

const requireSysbrazoConversation = async (input: {
  contactId: string
  conversationId: string
  workspaceId: string
}) => {
  // `getContact` applies contacts membership and assigned-contact scope before
  // accepting the conversation identifier supplied by the browser.
  await getContact({
    workspaceId: input.workspaceId,
    contactId: input.contactId,
  })
  const conversation = await conversationService.findBy({
    where: {
      id: input.conversationId,
      workspaceId: input.workspaceId,
      contactId: input.contactId,
    },
  })
  if (!conversation) {
    throw new ChatbotXException("Conversation not found")
  }
  return conversation
}

const requireActiveSysbrazoConversation = async (input: {
  contactId: string
  conversationId: string
  workspaceId: string
}) => {
  const conversation = await requireSysbrazoConversation(input)
  const context = await sysbrazoClientMultimediaService.findActiveContext({
    workspaceId: input.workspaceId,
    conversationId: conversation.id,
  })
  if (!context) {
    throw new ChatbotXException(
      "Sysbrazo client context is not active",
      "NOT_FOUND",
      404,
    )
  }
  return { context, conversation }
}

const requireSysbrazoMultimediaPermission = async (
  workspaceId: string,
  permission:
    | "manageClientMultimedia"
    | "permanentlyDeleteClientMultimedia"
    | "viewClientMultimedia"
    | "viewDeletedClientMultimedia",
) => {
  if (!(await canUseSysbrazoMultimedia(workspaceId, permission))) {
    throw new ChatbotXException(
      "You are not authorized to access client multimedia",
    )
  }
}

const sysbrazoMultimediaItemInput = z.object({
  workspaceId: z.string().min(1),
  contactId: z.string().min(1),
  conversationId: z.string().min(1),
  multimediaId: z.string().min(1),
})

export const contactsAuthenticatedAPI = {
  // Sysbrazo client-card procedures consumed by the ChatbotX contact panel.
  getContactAuthenticatedAPI: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/contacts/{contactId}",
      summary: "Get contact",
      tags: ["Contacts"],
    })
    .input(getContactRequest)
    .output(getContactResponse)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .handler(async ({ input }) => {
      const { workspaceId, contactId } = input
      return await getContact({ workspaceId, contactId })
    }),

  listContactsAuthenticatedAPI: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/contacts",
      summary: "List contacts",
      tags: ["Contacts"],
    })
    .input(listContactsRequest.and(withWorkspaceIdSchema))
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(listContactsResponse)
    .handler(async ({ input }) => {
      const { workspaceId, ...rest } = input
      return await listContacts({ ...rest, workspaceId })
    }),

  listContactsByPOSTAuthenticatedAPI: authorizedAPI
    .route({
      method: "POST",
      path: "/workspaces/{workspaceId}/contacts/list",
      summary: "List contacts using POST request",
      tags: ["Contacts"],
    })
    .input(listContactsRequest.and(withWorkspaceIdSchema))
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(listContactsResponse)
    .handler(async ({ input }) => {
      const { workspaceId, ...rest } = input
      return await listContacts({ ...rest, workspaceId })
    }),

  countContactsAuthenticatedAPI: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/contacts/count",
      summary: "Count contacts",
      tags: ["Contacts"],
    })
    .input(listContactsRequest)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(z.object({ total: z.number() }))
    .handler(async ({ input }) => await countContacts(input)),

  countContactInboxesAuthenticatedAPI: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/contacts/inboxes/count",
      summary: "Count contact inboxes",
      tags: ["Contacts"],
    })
    .input(listContactsRequest)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(z.object({ total: z.number() }))
    .handler(async ({ input }) => {
      const accessScope = await requireContactPermissionScope(input.workspaceId)
      return await countContactInboxes(input, accessScope)
    }),

  listContactInboxesAudiencePreviewAuthenticatedAPI: authorizedAPI
    .route({
      method: "POST",
      path: "/workspaces/{workspaceId}/contacts/inboxes/audience-preview",
      summary: "List audience contact inboxes preview",
      tags: ["Contacts"],
    })
    .input(listContactInboxesAudiencePreviewRequest)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(listContactInboxesAudiencePreviewResponse)
    .handler(async ({ input }) => {
      const accessScope = await requireContactPermissionScope(input.workspaceId)
      return await listAudienceInboxesPreview(input, accessScope)
    }),

  createContactAuthenticatedAPI: authorizedAPI
    .route({
      method: "POST",
      path: "/workspaces/{workspaceId}/contacts",
      summary: "Create a contact",
      tags: ["Contacts"],
    })
    .input(createContactRequest.and(withWorkspaceIdSchema))
    .output(createContactResponse)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .handler(async ({ input }) => {
      const { workspaceId, ...parsedInput } = input
      await requireContactPermissionScope(workspaceId)
      return await createContact({ workspaceId, parsedInput })
    }),

  getExportFileAuthenticatedAPI: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/contacts/export-files/{fileId}",
      summary: "Get contact export file status",
      tags: ["Contacts"],
    })
    .input(getExportFileRequest)
    .output(getExportFileResponse)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .handler(async ({ input }) => {
      await requireContactPermissionScope(input.workspaceId)
      return await getExportFile(input)
    }),

  listContactTagsAuthenticatedAPI: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/contacts/{contactId}/tags",
      summary: "List contact tags",
      tags: ["Contacts"],
    })
    .input(listContactTagsRequest)
    .output(listContactTagsResponse)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .handler(async ({ input }) => {
      const { workspaceId, contactId } = input
      const accessScope = await requireContactPermissionScope(workspaceId)
      return await listContactTags({
        workspaceId,
        contactId,
        accessScope,
      })
    }),

  addContactTagAuthenticatedAPI: authorizedAPI
    .route({
      method: "POST",
      path: "/workspaces/{workspaceId}/contacts/tags",
      summary: "Add tags to contact",
      tags: ["Contacts"],
    })
    .input(addContactTagRequest.and(withWorkspaceIdSchema))
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .handler(async ({ input }) => {
      const { workspaceId, tags, ids } = input
      const accessScope = await requireContactPermissionScope(workspaceId)
      await addContactTags({
        workspaceId,
        parsedInput: {
          ids,
          tags,
        },
        accessScope,
      })
    }),

  removeContactTagAuthenticatedAPI: authorizedAPI
    .route({
      method: "DELETE",
      path: "/workspaces/{workspaceId}/contacts/{contactId}/tags/{tagId}",
      summary: "Remove tag from contact",
      tags: ["Contacts"],
    })
    .input(removeContactTagRequest.and(withWorkspaceIdSchema))
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .handler(async ({ input }) => {
      const { workspaceId, contactId, tagId } = input
      const accessScope = await requireContactPermissionScope(workspaceId)
      // removeContactTags resolves tags by name; this endpoint takes a tag id.
      const tag = await db.query.tagModel.findFirst({
        where: { workspaceId, id: tagId, deletedAt: { isNull: true as const } },
        columns: { name: true },
      })
      if (!tag) {
        return
      }
      await removeContactTags({
        workspaceId,
        parsedInput: {
          ids: [contactId],
          tags: [tag.name],
        },
        accessScope,
      })
    }),

  listContactFieldsAuthenticatedAPI: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/contacts/{contactId}/fields",
      summary: "List contact custom fields",
      tags: ["Contacts"],
    })
    .input(listContactCustomFieldsRequest)
    .output(listPublicContactCustomFieldsResponse)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .handler(async ({ input }) => {
      const { workspaceId, contactId } = input
      const accessScope = await requireContactPermissionScope(workspaceId)

      return await listContactCustomFields({
        workspaceId,
        contactId,
        accessScope,
      })
    }),

  addContactFieldAuthenticatedAPI: authorizedAPI
    .route({
      method: "POST",
      path: "/workspaces/{workspaceId}/contacts/{contactId}/fields",
      summary: "Set contact custom field value",
      tags: ["Contacts"],
    })
    .input(setContactCustomFieldValueRequest.and(withWorkspaceIdSchema))
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .handler(async ({ input }) => {
      const { workspaceId, contactId } = input
      const accessScope = await requireContactPermissionScope(workspaceId)
      return await setContactCustomFieldValue({
        workspaceId,
        contactId,
        customFieldId: input.customFieldId,
        value: input.value,
        accessScope,
      })
    }),

  deleteContactFieldAuthenticatedAPI: authorizedAPI
    .route({
      method: "DELETE",
      path: "/workspaces/{workspaceId}/contacts/{contactId}/fields/{customFieldId}",
      summary: "Delete contact custom field",
      tags: ["Contacts"],
    })
    .input(deleteContactCustomFieldRequest.and(withWorkspaceIdSchema))
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .handler(async ({ input }) => {
      const { workspaceId, contactId, customFieldId } = input
      const accessScope = await requireContactPermissionScope(workspaceId)
      return await deleteContactCustomFields({
        workspaceId,
        contactIds: [contactId],
        customFieldId,
        accessScope,
      })
    }),

  getSysbrazoClientAuthenticatedAPI: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/contacts/{contactId}/sysbrazo-client",
      summary: "Get client identity/contact/services from Sysbrazo",
      tags: ["Contacts"],
    })
    .input(
      z.object({
        workspaceId: z.string().min(1),
        contactId: z.string().min(1),
        conversationId: z.string().min(1),
        cursor: z
          .object({ createdAt: z.coerce.date(), id: z.string().min(1) })
          .optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
    )
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(sysbrazoConversationLookupResponseSchema)
    .handler(async ({ input }) => {
      const conversation = await requireSysbrazoConversation(input)
      return await getSysbrazoClientForConversation({
        workspaceId: input.workspaceId,
        conversationId: conversation.id,
      })
    }),

  // Snapshot ONU/CPE dedicado (endpoint Krill de Sysbrazo), consultado aparte
  // del lookup principal para no bloquear la card con el estado del equipo.
  getSysbrazoOnuAuthenticatedAPI: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/sysbrazo-onu",
      summary: "Get client ONU/CPE technical status from Sysbrazo (Krill)",
      tags: ["Contacts"],
    })
    .input(
      z.object({
        workspaceId: z.string().min(1),
        contactId: z.string().min(1),
        conversationId: z.string().min(1),
        // Salta la cache ONU de 1 h en Sysbrazo (botón "Refrescar" del panel).
        forceOnu: z.boolean().optional(),
      }),
    )
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(sysbrazoOnuStatusSchema.nullable())
    .handler(async ({ input }) => {
      const { workspaceId, forceOnu } = input
      const { context } = await requireActiveSysbrazoConversation(input)
      return await getSysbrazoClientOnu({
        workspaceId,
        clientId: context.sysbrazoClientId,
        force: forceOnu,
      })
    }),

  // ── Panel Sysbrazo: autodiagnósticos y tickets (#15466) ──
  // El clientId de Sysbrazo se resuelve SIEMPRE en servidor desde el contacto;
  // el navegador nunca lo aporta. El permiso de ejecución es explícito por
  // miembro (`runAutodiagnostic`), sin bypass por superAdmin/rol/edición.

  getSysbrazoAutodiagnosticsAuthenticatedAPI: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/contacts/{contactId}/sysbrazo-autodiagnostics",
      summary: "List Sysbrazo auto-diagnostic runs for a contact",
      tags: ["Contacts"],
    })
    .input(
      z.object({
        workspaceId: z.string().min(1),
        contactId: z.string().min(1),
        page: z.number().int().positive().optional(),
        perPage: z.number().int().positive().max(100).optional(),
      }),
    )
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(sysbrazoAutodiagnosticsLookupSchema)
    .handler(async ({ input }) => {
      const { workspaceId, contactId, page, perPage } = input
      await requireContactPermissionScope(workspaceId)
      return await getSysbrazoAutodiagnostics({
        workspaceId,
        contactId,
        page,
        perPage,
      })
    }),

  getSysbrazoAutodiagnosticDetailAuthenticatedAPI: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/contacts/{contactId}/sysbrazo-autodiagnostics/{runId}",
      summary: "Get one Sysbrazo auto-diagnostic run with its steps",
      tags: ["Contacts"],
    })
    .input(
      z.object({
        workspaceId: z.string().min(1),
        contactId: z.string().min(1),
        runId: z.number().int().positive(),
      }),
    )
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(sysbrazoDiagnosticDetailSchema)
    .handler(async ({ input }) => {
      const { workspaceId, contactId, runId } = input
      await requireContactPermissionScope(workspaceId)
      return await getSysbrazoAutodiagnosticDetail({
        workspaceId,
        contactId,
        runId,
      })
    }),

  createSysbrazoAutodiagnosticTicketAuthenticatedAPI: authorizedAPI
    .route({
      method: "POST",
      path: "/workspaces/{workspaceId}/contacts/{contactId}/sysbrazo-autodiagnostics/{runId}/ticket",
      summary: "Create or queue a Sysbrazo ticket for a failed auto-diagnostic step",
      tags: ["Contacts"],
    })
    .input(
      z.object({
        workspaceId: z.string().min(1),
        contactId: z.string().min(1),
        runId: z.number().int().positive(),
        step: z.object({
          step_name: z.string().min(1),
          step_number: z.number().int().positive(),
          status: z.enum(["failed", "error"]),
          details: z.record(z.string(), z.unknown()).nullable(),
        }),
      }),
    )
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(sysbrazoAutodiagnosticTicketOutcomeSchema)
    .handler(async ({ input }) => {
      const { workspaceId, contactId, runId, step } = input
      await requireContactPermissionScope(workspaceId)
      if (!(await canRunSysbrazoAutodiagnostic(workspaceId))) {
        throw new ChatbotXException(
          "You do not have permission to run auto-diagnostics",
          "runAutodiagnosticDenied",
          403,
        )
      }
      return await createSysbrazoAutodiagnosticTicket({
        workspaceId,
        contactId,
        runId,
        step,
      })
    }),

  startSysbrazoAutodiagnosticAuthenticatedAPI: authorizedAPI
    .route({
      method: "POST",
      path: "/workspaces/{workspaceId}/contacts/{contactId}/sysbrazo-autodiagnostics",
      summary: "Start a Sysbrazo auto-diagnostic from ChatbotX",
      tags: ["Contacts"],
    })
    .input(
      z.object({
        workspaceId: z.string().min(1),
        contactId: z.string().min(1),
      }),
    )
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(sysbrazoStartDiagnosticResponseSchema)
    .handler(async ({ input }) => {
      const { workspaceId, contactId } = input
      await requireContactPermissionScope(workspaceId)
      // Permiso explícito por miembro; un POST forjado no llega a Sysbrazo.
      if (!(await canRunSysbrazoAutodiagnostic(workspaceId))) {
        throw new ChatbotXException(
          "You do not have permission to run auto-diagnostics",
          "runAutodiagnosticDenied",
          403,
        )
      }
      return await startSysbrazoAutodiagnostic({ workspaceId, contactId })
    }),

  getSysbrazoTicketsAuthenticatedAPI: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/contacts/{contactId}/sysbrazo-tickets",
      summary: "List support tickets for a contact (Odoo + Redmine)",
      tags: ["Contacts"],
    })
    .input(
      z.object({
        workspaceId: z.string().min(1),
        contactId: z.string().min(1),
        page: z.number().int().positive().optional(),
        perPage: z.number().int().positive().max(100).optional(),
      }),
    )
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(sysbrazoTicketsLookupSchema)
    .handler(async ({ input }) => {
      const { workspaceId, contactId, page, perPage } = input
      await requireContactPermissionScope(workspaceId)
      return await getSysbrazoTickets({
        workspaceId,
        contactId,
        page,
        perPage,
      })
    }),

  getSysbrazoNotesAuthenticatedAPI: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/contacts/{contactId}/sysbrazo-notes",
      summary: "List Sysbrazo client notes for a contact",
      tags: ["Contacts"],
    })
    .input(
      z.object({
        workspaceId: z.string().min(1),
        contactId: z.string().min(1),
        origin: z.enum(["chat", "sysbrazo"]).optional(),
        page: z.number().int().positive().optional(),
      }),
    )
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(sysbrazoNotesResponseSchema.nullable())
    .handler(async ({ input }) => {
      await requireContactPermissionScope(input.workspaceId)
      if (!(await canViewSysbrazoNotes(input.workspaceId))) {
        throw new ChatbotXException(
          "You do not have permission to view notes",
          "sysbrazoNotesDenied",
          403,
        )
      }
      return await getSysbrazoNotes(input)
    }),

  getSysbrazoMultimediaAuthenticatedAPI: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/contacts/{contactId}/conversations/{conversationId}/sysbrazo-multimedia",
      summary: "List ChatbotX multimedia linked to the active Sysbrazo client",
      tags: ["Contacts"],
    })
    .input(
      z.object({
        workspaceId: z.string().min(1),
        contactId: z.string().min(1),
        conversationId: z.string().min(1),
        cursor: z
          .object({ createdAt: z.coerce.date(), id: z.string().min(1) })
          .optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
    )
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(sysbrazoClientMultimediaListSchema)
    .handler(async ({ input }) => {
      await requireSysbrazoConversation(input)
      await requireSysbrazoMultimediaPermission(
        input.workspaceId,
        "viewClientMultimedia",
      )
      const contextStatus =
        await sysbrazoClientMultimediaService.getContextState({
          workspaceId: input.workspaceId,
          conversationId: input.conversationId,
        })
      if (contextStatus !== "active") {
        return {
          contextStatus,
          counts: { active: 0, deleted: 0 },
          data: [],
          nextCursor: null,
        }
      }
      const context = await sysbrazoClientMultimediaService.findActiveContext({
        workspaceId: input.workspaceId,
        conversationId: input.conversationId,
      })
      if (!context) {
        return {
          contextStatus: "missing" as const,
          counts: { active: 0, deleted: 0 },
          data: [],
          nextCursor: null,
        }
      }
      const limit = input.limit ?? 10
      const [data, counts, userAndWorkspace] = await Promise.all([
        sysbrazoClientMultimediaService.listActiveWithMetadata({
          workspaceId: input.workspaceId,
          sysbrazoClientId: context.sysbrazoClientId,
          cursor: input.cursor,
          limit: limit + 1,
        }),
        sysbrazoClientMultimediaService.getCounts({
          workspaceId: input.workspaceId,
          sysbrazoClientId: context.sysbrazoClientId,
        }),
        getCurrentUserAndTargetWorkspace(input.workspaceId),
      ])
      if (!userAndWorkspace) {
        throw new ChatbotXException(
          "User is not associated with this workspace",
        )
      }
      const readAtByMultimediaId =
        await sysbrazoClientMultimediaService.getReadAtByMultimediaId({
          multimediaIds: data.map((item) => item.id),
          userId: userAndWorkspace.user.id,
          workspaceId: input.workspaceId,
        })
      const page = data.slice(0, limit)
      const last = page.at(-1)
      return {
        contextStatus,
        counts,
        data: page.map((item) => ({
          id: item.id,
          createdAt: item.createdAt,
          deletedAt: item.deletedAt,
          readAt: readAtByMultimediaId.get(item.id) ?? null,
          attachmentId: item.attachmentId,
          attachmentCreatedAt: item.attachmentCreatedAt,
          messageId: item.messageId,
          messageCreatedAt: item.messageCreatedAt,
          conversationId: item.conversationId,
          sourceContactId: item.sourceContactId,
          sysbrazoClientId: item.sysbrazoClientId,
          attachment: {
            fileType: item.attachment.fileType,
            height: item.attachment.height,
            mimeType: item.attachment.mimeType,
            name: item.attachment.name,
            size: item.attachment.size,
            width: item.attachment.width,
          },
          message: item.message,
        })),
        nextCursor:
          data.length > limit && last
            ? { createdAt: last.createdAt, id: last.id }
            : null,
      }
    }),

  getSysbrazoMultimediaDownloadAuthenticatedAPI: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/contacts/{contactId}/conversations/{conversationId}/sysbrazo-multimedia/{multimediaId}/download",
      summary: "Get an authorized download URL for Sysbrazo client multimedia",
      tags: ["Contacts"],
    })
    .input(sysbrazoMultimediaItemInput)
    .output(sysbrazoClientMultimediaUrlSchema)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .handler(async ({ input }) => {
      await requireSysbrazoMultimediaPermission(
        input.workspaceId,
        "viewClientMultimedia",
      )
      const { context } = await requireActiveSysbrazoConversation(input)
      const resource =
        await sysbrazoClientMultimediaService.getActiveAttachment({
          multimediaId: input.multimediaId,
          sysbrazoClientId: context.sysbrazoClientId,
          workspaceId: input.workspaceId,
        })
      if (!resource) {
        throw new ChatbotXException(
          "Multimedia file not found",
          "NOT_FOUND",
          404,
        )
      }
      const { uploader } = await import("@chatbotx.io/filesystem")
      return {
        downloadUrl: await uploader.getPresignedDownload(
          resource.attachment.originPath,
        ),
      }
    }),

  getDeletedSysbrazoMultimediaAuthenticatedAPI: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/contacts/{contactId}/conversations/{conversationId}/sysbrazo-multimedia/trash",
      summary: "List deleted Sysbrazo client multimedia",
      tags: ["Contacts"],
    })
    .input(
      z.object({
        workspaceId: z.string().min(1),
        contactId: z.string().min(1),
        conversationId: z.string().min(1),
      }),
    )
    .output(sysbrazoClientMultimediaListSchema)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .handler(async ({ input }) => {
      await requireSysbrazoMultimediaPermission(
        input.workspaceId,
        "viewDeletedClientMultimedia",
      )
      const { context } = await requireActiveSysbrazoConversation(input)
      const [data, counts, userAndWorkspace] = await Promise.all([
        sysbrazoClientMultimediaService.listDeletedWithMetadata({
          limit: 50,
          sysbrazoClientId: context.sysbrazoClientId,
          workspaceId: input.workspaceId,
        }),
        sysbrazoClientMultimediaService.getCounts({
          sysbrazoClientId: context.sysbrazoClientId,
          workspaceId: input.workspaceId,
        }),
        getCurrentUserAndTargetWorkspace(input.workspaceId),
      ])
      if (!userAndWorkspace) {
        throw new ChatbotXException(
          "User is not associated with this workspace",
        )
      }
      const readAtByMultimediaId =
        await sysbrazoClientMultimediaService.getReadAtByMultimediaId({
          multimediaIds: data.map((item) => item.id),
          userId: userAndWorkspace.user.id,
          workspaceId: input.workspaceId,
        })
      return {
        contextStatus: "active" as const,
        counts,
        data: data.map((item) => ({
          id: item.id,
          createdAt: item.createdAt,
          deletedAt: item.deletedAt,
          readAt: readAtByMultimediaId.get(item.id) ?? null,
          attachmentId: item.attachmentId,
          attachmentCreatedAt: item.attachmentCreatedAt,
          messageId: item.messageId,
          messageCreatedAt: item.messageCreatedAt,
          conversationId: item.conversationId,
          sourceContactId: item.sourceContactId,
          sysbrazoClientId: item.sysbrazoClientId,
          attachment: {
            fileType: item.attachment.fileType,
            height: item.attachment.height,
            mimeType: item.attachment.mimeType,
            name: item.attachment.name,
            size: item.attachment.size,
            width: item.attachment.width,
          },
          message: item.message,
        })),
        nextCursor: null,
      }
    }),

  confirmSysbrazoMultimediaContextAuthenticatedAPI: authorizedAPI
    .route({
      method: "POST",
      path: "/workspaces/{workspaceId}/contacts/{contactId}/conversations/{conversationId}/sysbrazo-multimedia/confirm",
      summary: "Confirm the Sysbrazo client for conversation multimedia",
      tags: ["Contacts"],
    })
    .input(
      z.object({
        workspaceId: z.string().min(1),
        contactId: z.string().min(1),
        conversationId: z.string().min(1),
        attachmentIds: z.array(z.string().min(1)).max(50),
      }),
    )
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(
      z.discriminatedUnion("found", [
        z.object({
          found: z.literal(true),
          expiresAt: z.date(),
          associatedCount: z.number().int().nonnegative(),
        }),
        z.object({ found: z.literal(false) }),
      ]),
    )
    .handler(async ({ input }) => {
      const conversation = await requireSysbrazoConversation(input)
      await requireSysbrazoMultimediaPermission(
        input.workspaceId,
        "viewClientMultimedia",
      )

      const documentId = await resolveContactSysbrazoDocumentId({
        workspaceId: input.workspaceId,
        contactId: conversation.contactId,
      })
      if (!documentId) {
        await sysbrazoClientMultimediaService.invalidateContext({
          workspaceId: input.workspaceId,
          conversationId: conversation.id,
        })
        return { found: false as const }
      }

      const lookup = await getSysbrazoClientByDocumentId({
        workspaceId: input.workspaceId,
        documentId,
      })
      if (!lookup.found) {
        await sysbrazoClientMultimediaService.invalidateContext({
          workspaceId: input.workspaceId,
          conversationId: conversation.id,
        })
        return { found: false as const }
      }

      const context = await sysbrazoClientMultimediaService.activateContext({
        workspaceId: input.workspaceId,
        conversationId: conversation.id,
        documentId,
        sysbrazoClientId: String(lookup.client.id),
      })
      const associatedCount =
        await sysbrazoClientMultimediaService.associateRecentAttachmentsForConfirmedContext(
          {
            workspaceId: input.workspaceId,
            conversationId: conversation.id,
            contextId: context.id,
            attachmentIds: input.attachmentIds,
          },
        )

      return {
        found: true as const,
        expiresAt: context.expiresAt,
        associatedCount,
      }
    }),

  markSysbrazoMultimediaReadAuthenticatedAPI: authorizedAPI
    .route({
      method: "POST",
      path: "/workspaces/{workspaceId}/contacts/{contactId}/conversations/{conversationId}/sysbrazo-multimedia/{multimediaId}/read",
      summary: "Mark Sysbrazo client multimedia as read",
      tags: ["Contacts"],
    })
    .input(sysbrazoMultimediaItemInput)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .handler(async ({ input }) => {
      await requireSysbrazoMultimediaPermission(
        input.workspaceId,
        "viewClientMultimedia",
      )
      const [{ context }, userAndWorkspace] = await Promise.all([
        requireActiveSysbrazoConversation(input),
        getCurrentUserAndTargetWorkspace(input.workspaceId),
      ])
      if (!userAndWorkspace) {
        throw new ChatbotXException(
          "User is not associated with this workspace",
        )
      }
      await sysbrazoClientMultimediaService.markRead({
        multimediaId: input.multimediaId,
        sysbrazoClientId: context.sysbrazoClientId,
        userId: userAndWorkspace.user.id,
        workspaceId: input.workspaceId,
      })
    }),

  deleteSysbrazoMultimediaAuthenticatedAPI: authorizedAPI
    .route({
      method: "DELETE",
      path: "/workspaces/{workspaceId}/contacts/{contactId}/conversations/{conversationId}/sysbrazo-multimedia/{multimediaId}",
      summary: "Move Sysbrazo client multimedia to trash",
      tags: ["Contacts"],
    })
    .input(sysbrazoMultimediaItemInput)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .handler(async ({ input }) => {
      await requireSysbrazoMultimediaPermission(
        input.workspaceId,
        "manageClientMultimedia",
      )
      const [{ context }, userAndWorkspace] = await Promise.all([
        requireActiveSysbrazoConversation(input),
        getCurrentUserAndTargetWorkspace(input.workspaceId),
      ])
      if (!userAndWorkspace) {
        throw new ChatbotXException(
          "User is not associated with this workspace",
        )
      }
      return await sysbrazoClientMultimediaService.withAssociationLock(
        input.multimediaId,
        async () =>
          await sysbrazoClientMultimediaService.softDelete({
            deletedBy: userAndWorkspace.user.id,
            multimediaId: input.multimediaId,
            sysbrazoClientId: context.sysbrazoClientId,
            workspaceId: input.workspaceId,
          }),
      )
    }),

  restoreSysbrazoMultimediaAuthenticatedAPI: authorizedAPI
    .route({
      method: "POST",
      path: "/workspaces/{workspaceId}/contacts/{contactId}/conversations/{conversationId}/sysbrazo-multimedia/{multimediaId}/restore",
      summary: "Restore Sysbrazo client multimedia from trash",
      tags: ["Contacts"],
    })
    .input(sysbrazoMultimediaItemInput)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .handler(async ({ input }) => {
      await requireSysbrazoMultimediaPermission(
        input.workspaceId,
        "manageClientMultimedia",
      )
      const { context } = await requireActiveSysbrazoConversation(input)
      return await sysbrazoClientMultimediaService.withAssociationLock(
        input.multimediaId,
        async () =>
          await sysbrazoClientMultimediaService.restore({
            multimediaId: input.multimediaId,
            sysbrazoClientId: context.sysbrazoClientId,
            workspaceId: input.workspaceId,
          }),
      )
    }),

  permanentlyDeleteSysbrazoMultimediaAuthenticatedAPI: authorizedAPI
    .route({
      method: "DELETE",
      path: "/workspaces/{workspaceId}/contacts/{contactId}/conversations/{conversationId}/sysbrazo-multimedia/{multimediaId}/permanent",
      summary: "Permanently delete Sysbrazo client multimedia",
      tags: ["Contacts"],
    })
    .input(sysbrazoMultimediaItemInput)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .handler(async ({ input }) => {
      await requireSysbrazoMultimediaPermission(
        input.workspaceId,
        "permanentlyDeleteClientMultimedia",
      )
      const { context } = await requireActiveSysbrazoConversation(input)
      return await sysbrazoClientMultimediaService.permanentlyDelete({
        multimediaId: input.multimediaId,
        sysbrazoClientId: context.sysbrazoClientId,
        workspaceId: input.workspaceId,
      })
    }),

  createSysbrazoNoteAuthenticatedAPI: authorizedAPI
    .route({
      method: "POST",
      path: "/workspaces/{workspaceId}/contacts/{contactId}/sysbrazo-notes",
      summary: "Create a Sysbrazo client note",
      tags: ["Contacts"],
    })
    .input(
      z.object({
        workspaceId: z.string().min(1),
        contactId: z.string().min(1),
        notes: z.string().trim().min(1).max(2000),
      }),
    )
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .handler(async ({ input }) => {
      await requireContactPermissionScope(input.workspaceId)
      if (!(await canViewSysbrazoNotes(input.workspaceId))) {
        throw new ChatbotXException(
          "You do not have permission to create notes",
          "sysbrazoNotesDenied",
          403,
        )
      }
      return await createSysbrazoNote(input)
    }),

  updateSysbrazoNoteAuthenticatedAPI: authorizedAPI
    .route({
      method: "PATCH",
      path: "/workspaces/{workspaceId}/contacts/{contactId}/sysbrazo-notes/{noteId}",
      summary: "Update a Sysbrazo client note",
      tags: ["Contacts"],
    })
    .input(
      z.object({
        workspaceId: z.string().min(1),
        contactId: z.string().min(1),
        noteId: z.string().min(1),
        notes: z.string().trim().min(1).max(2000),
      }),
    )
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .handler(async ({ input }) => {
      await requireContactPermissionScope(input.workspaceId)
      if (!(await canViewSysbrazoNotes(input.workspaceId))) {
        throw new ChatbotXException(
          "You do not have permission to edit notes",
          "sysbrazoNotesDenied",
          403,
        )
      }
      return await updateSysbrazoNote(input)
    }),

  getSysbrazoAutodiagnosticCapabilityAuthenticatedAPI: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/sysbrazo-autodiagnostic-capability",
      summary: "Whether the current member can run Sysbrazo auto-diagnostics",
      tags: ["Contacts"],
    })
    .input(
      z.object({
        workspaceId: z.string().min(1),
      }),
    )
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(z.object({ canRun: z.boolean() }))
    .handler(async ({ input }) => {
      const { workspaceId } = input
      await requireContactPermissionScope(workspaceId)
      return { canRun: await canRunSysbrazoAutodiagnostic(workspaceId) }
    }),
}
