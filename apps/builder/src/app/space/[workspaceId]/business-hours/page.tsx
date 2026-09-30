import {
  businessHoursHolidaysSchema,
  businessHoursIntervalsSchema,
} from "@chatbotx.io/database/partials"
import { getIdFromParams } from "@chatbotx.io/utils"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { AppBreadcrumb } from "@/components/app-breadcrumb"
import { BusinessHoursList } from "@/features/business-hours/components/business-hours-list"
import { summarizeIntervals } from "@/features/business-hours/lib/summarize-intervals"
import { listBusinessHours } from "@/features/business-hours/queries"

export default async function BusinessHoursPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const workspaceId = getIdFromParams(await params, "workspaceId")
  if (!workspaceId) {
    return notFound()
  }
  const [t, schedules] = await Promise.all([
    getTranslations(),
    listBusinessHours({ workspaceId }),
  ])
  return (
    <div className="flex flex-col gap-4">
      <AppBreadcrumb
        items={[
          { label: t("tools.title"), href: `/space/${workspaceId}/tools` },
          { label: t("businessHours.title"), href: "" },
        ]}
      />
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-lg">{t("businessHours.title")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("businessHours.description")}
        </p>
      </div>
      <BusinessHoursList
        schedules={schedules.map((schedule) => {
          const intervals = businessHoursIntervalsSchema.safeParse(
            schedule.intervals,
          )
          const holidays = businessHoursHolidaysSchema.safeParse(
            schedule.holidays,
          )
          const parsed = intervals.success ? intervals.data : []
          const summary =
            parsed.length === 0
              ? [t("businessHours.alwaysOpen")]
              : summarizeIntervals(parsed, t)
          if (holidays.success && holidays.data.length > 0) {
            summary.push(
              `${holidays.data.length} ${t("businessHours.holidays").toLowerCase()}`,
            )
          }
          return {
            id: schedule.id,
            name: schedule.name,
            active: schedule.active,
            summary,
          }
        })}
        workspaceId={workspaceId}
      />
    </div>
  )
}
