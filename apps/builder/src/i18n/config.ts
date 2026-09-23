export const locales = ["en", "es", "pt-BR", "pt-PT"] as const

export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = "en"

export const localeMeta: Record<
  Locale,
  { nativeLabel: string; dir: "ltr" | "rtl" }
> = {
  en: { nativeLabel: "English", dir: "ltr" },
  es: { nativeLabel: "Español", dir: "ltr" },
  "pt-BR": { nativeLabel: "Português (Brasil)", dir: "ltr" },
  "pt-PT": { nativeLabel: "Português (Portugal)", dir: "ltr" },
}

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value)
}

export function resolveLocale(value: string | undefined): Locale {
  if (!value) {
    return defaultLocale
  }

  const normalizedValue = value.trim()
  if (isLocale(normalizedValue)) {
    return normalizedValue
  }

  const normalizedLower = normalizedValue.toLowerCase()
  const language = normalizedLower.split("-")[0]
  if (!language) {
    return defaultLocale
  }
  if (language === "pt") {
    return "pt-BR"
  }

  return (
    locales.find((locale) => locale.toLowerCase().split("-")[0] === language) ??
    defaultLocale
  )
}
