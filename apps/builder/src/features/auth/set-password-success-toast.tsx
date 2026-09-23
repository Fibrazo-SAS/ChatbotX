"use client"

import { useTranslations } from "next-intl"
import { useEffect } from "react"
import { toast } from "sonner"

/**
 * Shows the "password set successfully" toast once, on the first page load
 * after onboarding. The set-password flow ends in a full page reload
 * (`window.location.assign("/")`) so the session can re-render the app shell;
 * in-memory toasts don't survive that reload, so the success flag travels via
 * `sessionStorage` and this component fires the toast on the fresh page.
 */
export const SetPasswordSuccessToast = () => {
  const t = useTranslations()

  useEffect(() => {
    if (sessionStorage.getItem("setPasswordSuccess")) {
      sessionStorage.removeItem("setPasswordSuccess")
      toast.success(t("auth.setPasswordSuccess"))
    }
  }, [t])

  return null
}
