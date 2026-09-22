"use client"

import { InputField } from "@chatbotx.io/ui/components/form/input-field"
import { Button, buttonVariants } from "@chatbotx.io/ui/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
} from "@chatbotx.io/ui/components/ui/card"
import { Form } from "@chatbotx.io/ui/components/ui/form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { authClient } from "@/lib/auth/auth-client"
import { setPasswordAction } from "./actions/set-password.action"
import { AuthHeader } from "./components/shared"
import { type SetPasswordRequest, setPasswordRequest } from "./schema/action"

export const SetPassword = () => {
  const t = useTranslations()
  const searchParams = useSearchParams()

  const form = useForm<SetPasswordRequest>({
    resolver: zodResolver(setPasswordRequest),
    defaultValues: {
      token: searchParams.get("token") ?? "",
      newPassword: "",
      passwordConfirmation: "",
    },
    mode: "onChange",
  })

  const { execute, isPending } = useAction(setPasswordAction, {
    onSuccess: async ({ data, input }) => {
      // The setup succeeded; sign the user in through the standard credential
      // route so the session cookies reach the browser (the server-action
      // cookie-relay path does not forward better-auth's Set-Cookie). Full
      // reload afterwards so the fresh session re-renders the app shell.
      const result = await authClient.signIn.email({
        email: data.email,
        password: input.newPassword,
        rememberMe: true,
      })

      if (result.data) {
        toast.success(t("auth.setPasswordSuccess"))
        window.location.assign("/")
      } else {
        toast.error(result.error.message)
      }
    },
    onError: ({ error }) => {
      if (error.serverError) {
        toast.error(error.serverError)
      }
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="text-center">
          <AuthHeader title={t("auth.setPasswordTitle")} />
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form
              className="flex w-full flex-col gap-4"
              onSubmit={form.handleSubmit(execute)}
            >
              <p className="text-muted-foreground text-sm">
                {t("auth.setPasswordDescription")}
              </p>

              <InputField
                label={t("fields.newPassword.label")}
                name="newPassword"
                placeholder={t("fields.newPassword.label")}
                required
                type="password"
              />

              <InputField
                label={t("fields.passwordConfirmation.label")}
                name="passwordConfirmation"
                placeholder={t("fields.passwordConfirmation.label")}
                required
                type="password"
              />

              <Button
                className="w-full"
                disabled={!form.formState.isValid || isPending}
                type="submit"
              >
                {isPending && <Loader2Icon className="animate-spin" />}
                {t("actions.continue")}
              </Button>
            </form>
          </Form>

          <div className="mt-3 space-y-3">
            <Link
              className={buttonVariants({
                variant: "outline",
                className: "w-full",
              })}
              href="/auth/sign-in"
            >
              {t("actions.backToSignIn")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
