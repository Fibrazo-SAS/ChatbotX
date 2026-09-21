"use client"

import { isWorkspaceScheduledForDeletion } from "@chatbotx.io/business/workspace-lifecycle/predicates"
import { Switch } from "@chatbotx.io/ui/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@chatbotx.io/ui/components/ui/tooltip"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { updateWorkspaceStatusAction } from "../actions/update-workspace-status-action"
import { WorkspaceScheduleDialog } from "./workspace-schedule-dialog"

type Schedule = { startTime: string | null; endTime: string | null }

export function WorkspaceStatusSwitch({
  canManageStatus,
  workspace,
}: {
  canManageStatus: boolean
  workspace: {
    id: string
    isActive: boolean
    startTime: string | null
    endTime: string | null
    scheduledDeletionAt?: Date | string | null
  }
}) {
  const t = useTranslations()
  const router = useRouter()
  const scheduledForDeletion = isWorkspaceScheduledForDeletion(workspace)
  const [isActive, setIsActive] = useState(workspace.isActive)
  const [schedule, setSchedule] = useState<Schedule>({
    startTime: workspace.startTime,
    endTime: workspace.endTime,
  })
  const [showScheduleDialog, setShowScheduleDialog] = useState(false)

  useEffect(() => {
    setIsActive(workspace.isActive)
  }, [workspace.isActive])

  useEffect(() => {
    setSchedule({ startTime: workspace.startTime, endTime: workspace.endTime })
  }, [workspace.startTime, workspace.endTime])

  const handleCheckedChange = async (checked: boolean) => {
    if (checked) {
      setShowScheduleDialog(true)
      return
    }

    try {
      const result = await updateWorkspaceStatusAction(workspace.id, {
        isActive: false,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      })
      if (result?.serverError || result?.validationErrors) {
        toast.error(result.serverError ?? t("messages.unknownError"))
        return
      }
      setIsActive(false)
      toast.success(t("workspace.schedule.deactivated"))
      router.refresh()
    } catch {
      toast.error(t("messages.unknownError"))
    }
  }

  // Ticket 15139: members who cannot manage the workspace status (no
  // superAdmin permission) get no switch at all — hiding the control instead
  // of showing a disabled switch with a "blocked" tooltip.
  if (!canManageStatus) {
    return null
  }

  const switchElement = (
    <Switch
      checked={isActive}
      className="absolute start-3 top-3 z-10"
      disabled={scheduledForDeletion}
      onCheckedChange={scheduledForDeletion ? undefined : handleCheckedChange}
      onClick={(e) => e.stopPropagation()}
    />
  )

  return (
    <>
      {scheduledForDeletion ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="absolute z-10 inline-flex">{switchElement}</span>
            }
          />
          <TooltipContent>
            {t("workspace.deletion.navDisabledTooltip")}
          </TooltipContent>
        </Tooltip>
      ) : (
        switchElement
      )}

      <WorkspaceScheduleDialog
        onOpenChange={setShowScheduleDialog}
        onSuccess={(savedSchedule) => {
          setIsActive(true)
          setSchedule(savedSchedule)
          router.refresh()
        }}
        open={showScheduleDialog}
        workspace={workspace}
      />
    </>
  )
}
