"use client"

import type { CheckBusinessHoursStepSchema } from "@chatbotx.io/flow-config"
import { checkBusinessHoursStepSchema } from "@chatbotx.io/flow-config"
import { ComboboxField } from "@chatbotx.io/ui/components/form/combobox-field"
import { Button } from "@chatbotx.io/ui/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@chatbotx.io/ui/components/ui/dialog"
import { Form } from "@chatbotx.io/ui/components/ui/form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ClockIcon } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { useForm, useFormContext } from "react-hook-form"
import { useBusinessHoursSelectOptions } from "@/features/business-hours/provider/business-hours-hook"
import { useWorkspaceId } from "@/hooks/routing"
import { BaseStepEditor } from "../base/editor"

const CheckBusinessHoursStepEditor = ({
  parentName,
}: {
  parentName: string
}) => {
  const t = useTranslations()

  return (
    <BaseStepEditor
      icon={ClockIcon}
      title={t("flows.actions.checkBusinessHours")}
    >
      <CheckBusinessHoursDialog parentName={parentName} />
    </BaseStepEditor>
  )
}

const CheckBusinessHoursDialog = ({ parentName }: { parentName: string }) => {
  const t = useTranslations()
  const workspaceId = useWorkspaceId()
  const scheduleOptions = useBusinessHoursSelectOptions()
  const [open, setOpen] = useState(false)
  const { setValue, getValues } = useFormContext()

  const form = useForm<CheckBusinessHoursStepSchema>({
    resolver: zodResolver(checkBusinessHoursStepSchema),
    defaultValues: {
      ...getValues(parentName),
    },
    mode: "onChange",
  })

  useEffect(() => {
    if (open) {
      form.reset(getValues(parentName))
    }
  }, [open, form, getValues, parentName])

  const onSubmit = (data: CheckBusinessHoursStepSchema) => {
    setValue(parentName, data)
    setOpen(false)
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={
          <div className="flex justify-center">
            <Button size="sm" type="button" variant="outline">
              {t("actions.edit")}
            </Button>
          </div>
        }
      />
      <DialogContent className="max-h-screen overflow-y-scroll lg:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("flows.actions.checkBusinessHours")}</DialogTitle>
          <DialogDescription>
            {t("flows.actions.checkBusinessHoursDescription")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="flex w-full flex-col gap-4"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <ComboboxField
              emptyText={t("actions.noRecordFound")}
              label={t("businessHours.singular")}
              name="scheduleId"
              options={scheduleOptions}
              placeholder={t("actions.pleaseSelect")}
              required
            />

            {workspaceId ? (
              <Link
                className="text-xs underline"
                href={`/space/${workspaceId}/business-hours`}
              >
                {t("flows.actions.checkBusinessHoursSettings")}
              </Link>
            ) : null}

            <DialogFooter>
              <DialogClose
                render={
                  <Button size="sm" variant="ghost">
                    {t("actions.cancel")}
                  </Button>
                }
              />

              <Button
                disabled={
                  !form.formState.isValid || form.formState.isSubmitting
                }
                size="sm"
                type="submit"
              >
                {t("actions.save")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default CheckBusinessHoursStepEditor
