import type { ComponentProps } from "react"
import type { FieldPath, FieldValues } from "react-hook-form"
import { Input } from "../ui/input"
import { FormFieldWrapper } from "./field-wrapper"
import { PasswordInput } from "./password-input"

type InputFieldProps<T extends FieldValues> = ComponentProps<"input"> & {
  name: FieldPath<T>
  label?: string
  description?: string
  descriptionType?: "inline" | "tooltip"
  formItemClassName?: string
  showPasswordLabel?: string
  hidePasswordLabel?: string
}

export function InputField<T extends FieldValues>({
  name,
  label,
  required,
  description,
  descriptionType = "inline",
  formItemClassName,
  showPasswordLabel,
  hidePasswordLabel,
  ...props
}: InputFieldProps<T>) {
  return (
    <FormFieldWrapper
      description={description}
      descriptionType={descriptionType}
      formItemClassName={formItemClassName}
      label={label}
      name={name}
      required={required}
    >
      {(field) =>
        props.type === "password" ? (
          <PasswordInput
            {...props}
            {...field}
            hidePasswordLabel={hidePasswordLabel}
            showPasswordLabel={showPasswordLabel}
            value={field.value ?? ""}
          />
        ) : (
          <Input {...props} {...field} value={field.value ?? ""} />
        )
      }
    </FormFieldWrapper>
  )
}
