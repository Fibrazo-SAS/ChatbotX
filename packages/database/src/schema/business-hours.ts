import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { bigintAsString, sharedColumns } from "../partials/shared"
import { workspaceModel } from "./workspace"

/**
 * Named attention schedule (business hours). Many rows per workspace
 * (e.g. "Horario general", "Horario Soporte"); flows pick one via the
 * check-business-hours step. `timezone` null = workspace timezone.
 * `intervals`/`holidays` shapes live in `partials/business-hours.ts`
 * and are validated with zod at the service/action layers.
 */
export const businessHoursModel = pgTable(
  "BusinessHours",
  {
    ...sharedColumns,
    workspaceId: bigintAsString()
      .notNull()
      .references(() => workspaceModel.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: text().notNull(),
    active: boolean().default(true).notNull(),
    intervals: jsonb().default([]).notNull(),
    holidays: jsonb().default([]).notNull(),
  },
  (table) => [
    index("BusinessHours_workspaceId_idx").using(
      "btree",
      table.workspaceId.asc().nullsLast(),
    ),
    uniqueIndex("BusinessHours_workspaceId_name_key").on(
      table.workspaceId,
      table.name,
    ),
  ],
)
