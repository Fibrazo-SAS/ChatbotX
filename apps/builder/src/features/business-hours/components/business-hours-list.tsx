"use client"

import { InputField } from "@chatbotx.io/ui/components/form/input-field"
import { Button } from "@chatbotx.io/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@chatbotx.io/ui/components/ui/dialog"
import { Form } from "@chatbotx.io/ui/components/ui/form"
import { PencilIcon, PlusIcon, TrashIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { createBusinessHoursAction } from "../actions/create-business-hours.action"
import { DeleteBusinessHoursDialog } from "./delete-business-hours-dialog"

export type BusinessHoursListItem = {
  id: string
  name: string
  active: boolean
  summary: string[]
}

export function BusinessHoursList({
  workspaceId,
  schedules,
}: {
  workspaceId: string
  schedules: BusinessHoursListItem[]
}) {
  const t = useTranslations()
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] =
    useState<BusinessHoursListItem | null>(null)

  const form = useForm<{ name: string }>({
    defaultValues: { name: "" },
  })

  const { execute: executeCreate, isPending: isCreating } = useAction(
    createBusinessHoursAction.bind(null, workspaceId),
    {
      onSuccess: ({ data }) => {
        toast.success(
          t("messages.createdSuccess", {
            feature: t("businessHours.singular"),
          }),
        )
        setCreateOpen(false)
        form.reset()
        if (data) {
          router.push(`/space/${workspaceId}/business-hours/${data.id}/edit`)
        } else {
          router.refresh()
        }
      },
      onError: ({ error }) => {
        if (error.serverError) {
          toast.error(error.serverError)
        }
      },
    },
  )

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <Dialog onOpenChange={setCreateOpen} open={createOpen}>
          <DialogTrigger
            render={
              <Button size="sm" type="button">
                <PlusIcon className="me-1 size-4" />
                {t("businessHours.newSchedule")}
              </Button>
            }
          />
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("businessHours.newSchedule")}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                className="flex flex-col gap-4"
                onSubmit={form.handleSubmit((values) =>
                  executeCreate({ name: values.name.trim() }),
                )}
              >
                <InputField
                  label={t("businessHours.name")}
                  maxLength={255}
                  name="name"
                  required
                />
                <DialogFooter>
                  <Button
                    disabled={isCreating || !form.watch("name")?.trim()}
                    size="sm"
                    type="submit"
                  >
                    {t("actions.create")}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {schedules.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {t("businessHours.emptyList")}
        </p>
      ) : (
        <div className="flex flex-col divide-y rounded-md border">
          {schedules.map((schedule) => (
            <div
              className="flex items-center gap-3 px-4 py-3"
              key={schedule.id}
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <Link
                  className="truncate font-medium text-sm hover:underline"
                  href={`/space/${workspaceId}/business-hours/${schedule.id}/edit`}
                >
                  {schedule.name}
                </Link>
                <span className="text-muted-foreground text-xs">
                  {schedule.active
                    ? t("businessHours.active")
                    : t("businessHours.inactive")}
                </span>
                {schedule.summary.map((line) => (
                  <span className="text-muted-foreground text-xs" key={line}>
                    {line}
                  </span>
                ))}
              </div>
              <Button
                onClick={() =>
                  router.push(
                    `/space/${workspaceId}/business-hours/${schedule.id}/edit`,
                  )
                }
                size="icon"
                type="button"
                variant="ghost"
              >
                <PencilIcon className="size-4" />
              </Button>
              <Button
                onClick={() => setDeleteTarget(schedule)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <TrashIcon className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <DeleteBusinessHoursDialog
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        open={deleteTarget != null}
        schedule={deleteTarget}
        workspaceId={workspaceId}
      />
    </div>
  )
}
