const strings = {
  en: {
    newMessage: "New message",
    sharedLocation: "Shared a location",
    sentLink: "Sent a link",
    sentAttachment: "Sent an attachment",
    sentAttachments: (count: number) => `Sent ${count} attachments`,
    assignedConversation: "You were assigned a conversation",
  },
  es: {
    newMessage: "Nuevo mensaje",
    sharedLocation: "Compartió una ubicación",
    sentLink: "Envió un enlace",
    sentAttachment: "Envió un archivo adjunto",
    sentAttachments: (count: number) => `Envió ${count} archivos adjuntos`,
    assignedConversation: "Se te asignó una conversación",
  },
  "pt-BR": {
    newMessage: "Nova mensagem",
    sharedLocation: "Compartilhou uma localização",
    sentLink: "Enviou um link",
    sentAttachment: "Enviou um anexo",
    sentAttachments: (count: number) => `Enviou ${count} anexos`,
    assignedConversation: "Uma conversa foi atribuída a você",
  },
  "pt-PT": {
    newMessage: "Nova mensagem",
    sharedLocation: "Partilhou uma localização",
    sentLink: "Enviou uma ligação",
    sentAttachment: "Enviou um anexo",
    sentAttachments: (count: number) => `Enviou ${count} anexos`,
    assignedConversation: "Foi-lhe atribuída uma conversa",
  },
} as const

type Locale = keyof typeof strings

const resolveLocale = (language: string | undefined): Locale =>
  language && language in strings ? (language as Locale) : "en"

export const t = (language: string | undefined) =>
  strings[resolveLocale(language)]
