import { ChatbotXException } from "@chatbotx.io/business/errors"
import { db } from "@chatbotx.io/database/client"
import z from "zod"
import { withWorkspaceIdSchema } from "@/features/workspaces/schema/resource"
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
  getSysbrazoClientByDocument,
  getSysbrazoClientOnu,
} from "../queries/get-sysbrazo-client.query"
import { listContactCustomFields } from "../queries/list-contact-fields.query"
import {
  countContactInboxes,
  listAudienceInboxesPreview,
} from "../queries/list-contact-inboxes.queries"
import { listContactTags } from "../queries/list-contact-tags.query"
import { countContacts, listContacts } from "../queries/list-contacts.queries"
import {
  getSysbrazoAutodiagnosticDetail,
  getSysbrazoAutodiagnostics,
  getSysbrazoTickets,
  getSysbrazoNotes,
  createSysbrazoNote,
  updateSysbrazoNote,
  startSysbrazoAutodiagnostic,
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
  sysbrazoLookupResponseSchema,
  sysbrazoOnuStatusSchema,
} from "../schema/sysbrazo-client"
import {
  sysbrazoNotesResponseSchema,
} from "../schema/sysbrazo-notes"
import {
  sysbrazoAutodiagnosticsLookupSchema,
  sysbrazoDiagnosticDetailSchema,
  sysbrazoStartDiagnosticResponseSchema,
  sysbrazoTicketsLookupSchema,
} from "../schema/sysbrazo-support"
import {
  canRunSysbrazoAutodiagnostic,
  canViewSysbrazoNotes,
} from "../sysbrazo-panel/permissions"

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
    .input(getContactRequest)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(sysbrazoLookupResponseSchema)
    .handler(async ({ input }) => {
      const { workspaceId, contactId } = input
      await requireContactPermissionScope(workspaceId)
      return await getSysbrazoClientByDocument({
        workspaceId,
        contactId,
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
        // Id del cliente en Sysbrazo (viene del lookup principal).
        clientId: z.string().min(1),
        // Salta la cache ONU de 1 h en Sysbrazo (botón "Refrescar" del panel).
        forceOnu: z.boolean().optional(),
      }),
    )
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(sysbrazoOnuStatusSchema.nullable())
    .handler(async ({ input }) => {
      const { workspaceId, clientId, forceOnu } = input
      await requireContactPermissionScope(workspaceId)
      return await getSysbrazoClientOnu({
        workspaceId,
        clientId,
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
        throw new ChatbotXException("You do not have permission to view notes", "sysbrazoNotesDenied", 403)
      }
      return await getSysbrazoNotes(input)
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
        throw new ChatbotXException("You do not have permission to create notes", "sysbrazoNotesDenied", 403)
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
        throw new ChatbotXException("You do not have permission to edit notes", "sysbrazoNotesDenied", 403)
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
