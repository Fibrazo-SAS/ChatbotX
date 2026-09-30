import {
  businessHoursHolidaysSchema,
  businessHoursIntervalsSchema,
} from "@chatbotx.io/database/partials"
import { getIdFromParams } from "@chatbotx.io/utils"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { AppBreadcrumb } from "@/components/app-breadcrumb"
import { EditBusinessHoursForm } from "@/features/business-hours/components/edit-business-hours-form"
import { getBusinessHours } from "@/features/business-hours/queries"
import { getCurrentUserAndTargetWorkspace } from "@/lib/auth/utils"

export default async function EditBusinessHoursPage({
  params,
}: {
  params: Promise<{ workspaceId: string; id: string }>
}) {
  const resolvedParams = await params
  const workspaceId = getIdFromParams(resolvedParams, "workspaceId")
  const id = getIdFromParams(resolvedParams, "id")
  if (!(workspaceId && id)) {
    return notFound()
  }
  const [t, schedule, userAndWorkspace] = await Promise.all([
    getTranslations(),
    getBusinessHours({ workspaceId, id }),
    getCurrentUserAndTargetWorkspace(workspaceId),
  ])
  if (!(schedule && userAndWorkspace)) {
    return notFound()
  }
  const intervals = businessHoursIntervalsSchema.safeParse(schedule.intervals)
  const holidays = businessHoursHolidaysSchema.safeParse(schedule.holidays)
  return (
    <div className="flex flex-col gap-4">
      <AppBreadcrumb
        items={[
          { label: t("tools.title"), href: `/space/${workspaceId}/tools` },
          {
            label: t("businessHours.title"),
            href: `/space/${workspaceId}/business-hours`,
          },
          { label: schedule.name, href: "" },
        ]}
      />
      <EditBusinessHoursForm
        schedule={{
          id: schedule.id,
          name: schedule.name,
          active: schedule.active,
          intervals: intervals.success ? intervals.data : [],
          holidays: holidays.success ? holidays.data : [],
        }}
        workspaceId={workspaceId}
        workspaceTimezone={userAndWorkspace.targetWorkspace.timezone}
      />
    </div>
  )
}
