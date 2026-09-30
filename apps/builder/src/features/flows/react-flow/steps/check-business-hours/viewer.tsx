"use client"

import type { CheckBusinessHoursStepSchema } from "@chatbotx.io/flow-config"
import { Card, CardContent } from "@chatbotx.io/ui/components/ui/card"
import { ClockIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useBusinessHoursStore } from "@/features/business-hours/provider/business-hours-store-context"
import { BaseStateViewer } from "../../states/viewer"
import { BaseStepViewer } from "../base/viewer"

const CheckBusinessHoursStepViewer = ({
  data,
}: {
  data: CheckBusinessHoursStepSchema
}) => {
  const t = useTranslations()
  const schedule = useBusinessHoursStore((state) =>
    state.businessHours.find((item) => item.id === data.scheduleId),
  )
  let subtitle = t("businessHours.noScheduleSelected")
  if (schedule) {
    subtitle = schedule.name
  } else if (data.scheduleId) {
    subtitle = t("businessHours.scheduleNotFound")
  }

  return (
    <Card className="overflow-hidden p-0">
      <CardContent className="p-0">
        <div className="px-4 py-2">
          <BaseStepViewer
            icon={ClockIcon}
            title={t("flows.actions.checkBusinessHours")}
          />
          <div className="mt-1 text-muted-foreground text-xs">{subtitle}</div>
        </div>
        <div className="my-2 mr-3 flex flex-col gap-1">
          {data.states.map((state) => (
            <BaseStateViewer data={state} key={state.id} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default CheckBusinessHoursStepViewer
