"use client"

import { cn } from "@chatbotx.io/ui/lib/utils"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import type { ComponentProps } from "react"
import { useState } from "react"
import { Input } from "../ui/input"

type PasswordInputProps = ComponentProps<"input"> & {
  showPasswordLabel?: string
  hidePasswordLabel?: string
}

export function PasswordInput({
  className,
  showPasswordLabel = "Show password",
  hidePasswordLabel = "Hide password",
  type: _type,
  ...props
}: PasswordInputProps) {
  const [show, setShow] = useState(false)

  return (
    <div className="relative">
      <Input
        {...props}
        className={cn("pe-9", className)}
        type={show ? "text" : "password"}
      />
      <button
        aria-label={show ? hidePasswordLabel : showPasswordLabel}
        className="absolute inset-y-0 end-0 flex w-9 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => setShow((value) => !value)}
        tabIndex={-1}
        type="button"
      >
        {show ? (
          <EyeOffIcon className="size-4" />
        ) : (
          <EyeIcon className="size-4" />
        )}
      </button>
    </div>
  )
}
