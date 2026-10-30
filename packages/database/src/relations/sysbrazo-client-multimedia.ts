import { defineRelationsPart } from "drizzle-orm"
// biome-ignore lint/performance/noNamespaceImport: drizzle schema
import * as schema from "../schema"

export const sysbrazoClientMultimediaRelations = defineRelationsPart(
  schema,
  (r) => ({
    conversationSysbrazoClientContextModel: {
      conversation: r.one.conversationModel({
        from: r.conversationSysbrazoClientContextModel.conversationId,
        to: r.conversationModel.id,
        optional: false,
      }),
      workspace: r.one.workspaceModel({
        from: r.conversationSysbrazoClientContextModel.workspaceId,
        to: r.workspaceModel.id,
        optional: false,
      }),
    },
    sysbrazoClientMultimediaModel: {
      conversation: r.one.conversationModel({
        from: r.sysbrazoClientMultimediaModel.conversationId,
        to: r.conversationModel.id,
        optional: false,
      }),
      sourceContact: r.one.contactModel({
        from: r.sysbrazoClientMultimediaModel.sourceContactId,
        to: r.contactModel.id,
        optional: false,
      }),
      deletedByUser: r.one.userModel({
        from: r.sysbrazoClientMultimediaModel.deletedBy,
        to: r.userModel.id,
      }),
      reads: r.many.sysbrazoClientMultimediaReadModel({
        from: r.sysbrazoClientMultimediaModel.id,
        to: r.sysbrazoClientMultimediaReadModel.multimediaId,
      }),
      workspace: r.one.workspaceModel({
        from: r.sysbrazoClientMultimediaModel.workspaceId,
        to: r.workspaceModel.id,
        optional: false,
      }),
    },
    sysbrazoClientMultimediaReadModel: {
      multimedia: r.one.sysbrazoClientMultimediaModel({
        from: r.sysbrazoClientMultimediaReadModel.multimediaId,
        to: r.sysbrazoClientMultimediaModel.id,
        optional: false,
      }),
      user: r.one.userModel({
        from: r.sysbrazoClientMultimediaReadModel.userId,
        to: r.userModel.id,
        optional: false,
      }),
      workspace: r.one.workspaceModel({
        from: r.sysbrazoClientMultimediaReadModel.workspaceId,
        to: r.workspaceModel.id,
        optional: false,
      }),
    },
  }),
)
