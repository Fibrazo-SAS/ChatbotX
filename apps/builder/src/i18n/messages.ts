import en from "../../messages/en.json"
import es from "../../messages/es.json"
import ptBR from "../../messages/pt-BR.json"
import ptPT from "../../messages/pt-PT.json"
import type { Locale } from "./config"

export const messagesByLocale: Record<Locale, Record<string, unknown>> = {
  en,
  es,
  "pt-BR": ptBR,
  "pt-PT": ptPT,
}
