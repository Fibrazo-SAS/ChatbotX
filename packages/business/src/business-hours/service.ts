import {
  and,
  asc,
  type DatabaseClient,
  db,
  eq,
  ilike,
  isUniqueViolationError,
} from "@chatbotx.io/database/client"
import {
  type BusinessHoursHolidays,
  type BusinessHoursIntervals,
  businessHoursHolidaysSchema,
  businessHoursIntervalsSchema,
} from "@chatbotx.io/database/partials"
import { businessHoursModel } from "@chatbotx.io/database/schema"
import type { BusinessHoursModel } from "@chatbotx.io/database/types"
import { likeContains } from "@chatbotx.io/database/utils"
import { resolveFilterTimezone } from "@chatbotx.io/utils"
import { formatInTimeZone } from "date-fns-tz"
import { BaseService } from "../base.service"
import { ChatbotXException } from "../errors"
import { logger } from "../logger"
import { workspaceService } from "../workspace/service"

export type CreateBusinessHoursInput = {
  workspaceId: string
  name: string
  active?: boolean
  intervals?: BusinessHoursIntervals
  holidays?: BusinessHoursHolidays
  tx?: DatabaseClient
}

export type UpdateBusinessHoursInput = {
  workspaceId: string
  id: string
  name: string
  active: boolean
  intervals: BusinessHoursIntervals
  holidays: BusinessHoursHolidays
  tx?: DatabaseClient
}

/**
 * Pure minute-level check over day-toggled intervals. `weekday` follows
 * `getDay` convention (0 = Sunday). Bounds are half-open `[start, end)`;
 * `start > end` expresses an overnight window, so yesterday's overnight
 * spill is checked too. Only intervals with `days[weekday]` active match.
 */
export function isMinuteWithinIntervals(props: {
  weekday: number
  minute: number
  intervals: BusinessHoursIntervals
}): boolean {
  const { weekday, minute, intervals } = props
  const covers = (start: number, end: number) =>
    start <= end
      ? minute >= start && minute < end
      : minute >= start || minute < end

  if (
    intervals.some(
      (interval) =>
        interval.days[weekday] === true &&
        covers(interval.startMinute, interval.endMinute),
    )
  ) {
    return true
  }

  const yesterday = (weekday + 6) % 7
  return intervals.some(
    (interval) =>
      interval.days[yesterday] === true &&
      interval.startMinute > interval.endMinute &&
      minute < interval.endMinute,
  )
}

class BusinessHoursService extends BaseService {
  list(props: { workspaceId: string; tx?: DatabaseClient }) {
    const { workspaceId, tx = db } = props
    return tx.query.businessHoursModel.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
    })
  }

  async listForFlow(props: { workspaceId: string; keyword?: string }) {
    const { workspaceId, keyword } = props
    const where = keyword?.trim()
      ? and(
          eq(businessHoursModel.workspaceId, workspaceId),
          ilike(businessHoursModel.name, likeContains(keyword.trim())),
        )
      : eq(businessHoursModel.workspaceId, workspaceId)
    const rows = await db
      .select({
        id: businessHoursModel.id,
        name: businessHoursModel.name,
        active: businessHoursModel.active,
      })
      .from(businessHoursModel)
      .where(where)
      .orderBy(asc(businessHoursModel.name))
    return rows
  }

  get(props: {
    workspaceId: string
    id: string
    tx?: DatabaseClient
  }): Promise<BusinessHoursModel | undefined> {
    const { workspaceId, id, tx = db } = props
    return tx.query.businessHoursModel.findFirst({
      where: { workspaceId, id },
    })
  }

  async create(props: CreateBusinessHoursInput): Promise<BusinessHoursModel> {
    const {
      workspaceId,
      name,
      active = true,
      intervals = [],
      holidays = [],
      tx = db,
    } = props
    const trimmedName = name.trim()
    if (!trimmedName) {
      throw new ChatbotXException("Name is required", "nameRequired", 400)
    }
    await this.assertNameAvailable({ workspaceId, name: trimmedName, tx })
    try {
      const [row] = await tx
        .insert(businessHoursModel)
        .values({
          workspaceId,
          name: trimmedName,
          active,
          intervals: businessHoursIntervalsSchema.parse(intervals),
          holidays: businessHoursHolidaysSchema.parse(holidays),
        })
        .returning()
      await this.invalidateCacheTags([`business-hours:${workspaceId}`])
      return row
    } catch (error) {
      this.throwMappedUniqueError(error)
      throw error
    }
  }

  async update(props: UpdateBusinessHoursInput): Promise<BusinessHoursModel> {
    const {
      workspaceId,
      id,
      name,
      active,
      intervals,
      holidays,
      tx = db,
    } = props
    const trimmedName = name.trim()
    if (!trimmedName) {
      throw new ChatbotXException("Name is required", "nameRequired", 400)
    }
    await this.assertNameAvailable({
      workspaceId,
      name: trimmedName,
      tx,
      ignoreId: id,
    })
    try {
      const [row] = await tx
        .update(businessHoursModel)
        .set({
          name: trimmedName,
          active,
          intervals: businessHoursIntervalsSchema.parse(intervals),
          holidays: businessHoursHolidaysSchema.parse(holidays),
        })
        .where(
          and(
            eq(businessHoursModel.workspaceId, workspaceId),
            eq(businessHoursModel.id, id),
          ),
        )
        .returning()
      if (!row) {
        throw new ChatbotXException("Schedule not found", "notFound", 404)
      }
      await this.invalidateCacheTags([`business-hours:${workspaceId}`])
      return row
    } catch (error) {
      this.throwMappedUniqueError(error)
      throw error
    }
  }

  async delete(props: {
    workspaceId: string
    id: string
    tx?: DatabaseClient
  }): Promise<void> {
    const { workspaceId, id, tx = db } = props
    await tx
      .delete(businessHoursModel)
      .where(
        and(
          eq(businessHoursModel.workspaceId, workspaceId),
          eq(businessHoursModel.id, id),
        ),
      )
    await this.invalidateCacheTags([`business-hours:${workspaceId}`])
  }

  /**
   * Effective "are we open" check for one schedule: the workspace-level
   * active window (`workspaceService.isActiveNow`) ANDed with the schedule
   * (`active`, holidays, weekly intervals in the schedule timezone).
   * No `scheduleId`, missing/disabled schedule, or empty intervals means
   * "always open" as long as the workspace itself is active — fail-open.
   */
  async isWithinBusinessHours(props: {
    workspaceId: string
    scheduleId?: string | null
    at?: Date
    tx?: DatabaseClient
  }): Promise<boolean> {
    const { workspaceId, scheduleId, at, tx = db } = props
    const workspace = await tx.query.workspaceModel.findFirst({
      where: { id: workspaceId },
      columns: {
        isActive: true,
        startTime: true,
        endTime: true,
        timezone: true,
      },
    })
    if (!workspace) {
      return false
    }
    if (
      !workspaceService.isActiveNow({
        isActive: workspace.isActive,
        startTime: workspace.startTime,
        endTime: workspace.endTime,
        timezone: workspace.timezone,
      })
    ) {
      return false
    }
    if (!scheduleId) {
      return true
    }

    const schedule = await this.get({ workspaceId, id: scheduleId, tx })
    if (!schedule) {
      logger.warn(
        { workspaceId, scheduleId },
        "[BusinessHoursService] schedule not found; treating as open",
      )
      return true
    }
    if (!schedule.active) {
      return true
    }

    const timezone = resolveFilterTimezone(workspace.timezone)
    const now = at ?? new Date()
    if (this.isHolidayDay(schedule.holidays, now, timezone)) {
      return false
    }

    const parsed = businessHoursIntervalsSchema.safeParse(schedule.intervals)
    if (!parsed.success) {
      logger.error(
        { workspaceId, scheduleId },
        "[BusinessHoursService] stored intervals failed validation; treating as closed",
      )
      return false
    }
    if (parsed.data.length === 0) {
      return true
    }

    const isoWeekday = Number(formatInTimeZone(now, timezone, "i"))
    const weekday = isoWeekday % 7
    const minute =
      Number(formatInTimeZone(now, timezone, "H")) * 60 +
      Number(formatInTimeZone(now, timezone, "m"))
    return isMinuteWithinIntervals({ weekday, minute, intervals: parsed.data })
  }

  private isHolidayDay(stored: unknown, now: Date, timezone: string): boolean {
    const parsed = businessHoursHolidaysSchema.safeParse(stored)
    if (!parsed.success || parsed.data.length === 0) {
      return false
    }
    const today = formatInTimeZone(now, timezone, "yyyy-MM-dd")
    return parsed.data.includes(today)
  }

  private async assertNameAvailable(props: {
    workspaceId: string
    name: string
    ignoreId?: string
    tx?: DatabaseClient
  }): Promise<void> {
    const { workspaceId, name, ignoreId, tx = db } = props
    const wanted = name.toLowerCase()
    const rows = await tx.query.businessHoursModel.findMany({
      where: { workspaceId },
      columns: { id: true, name: true },
    })
    const clash = rows.some(
      (row) => row.id !== ignoreId && row.name.trim().toLowerCase() === wanted,
    )
    if (clash) {
      throw new ChatbotXException(
        "Business hours name already exists",
        "nameAlreadyExists",
        409,
      )
    }
  }

  private throwMappedUniqueError(error: unknown): never | undefined {
    if (isUniqueViolationError(error)) {
      throw new ChatbotXException(
        "Business hours name already exists",
        "nameAlreadyExists",
        409,
      )
    }
  }
}

export const businessHoursService = new BusinessHoursService()
