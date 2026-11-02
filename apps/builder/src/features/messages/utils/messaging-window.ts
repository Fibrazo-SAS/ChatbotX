import type { ChannelType } from "@chatbotx.io/database/partials"

/**
 * Per-channel messaging window (seconds) after the last incoming message.
 * `0` means the channel has no window restriction.
 */
export const CHANNEL_WINDOW_SECONDS: Record<ChannelType, number> = {
  api: 0,
  omnichannel: 0,
  webchat: 0,
  messenger: 24 * 60 * 60,
  whatsapp: 24 * 60 * 60,
  zalo: 0,
  smtp: 0,
  telegram: 0,
  instagram: 24 * 60 * 60,
  tiktok: 24 * 60 * 60,
}

export const isMessagingWindowExpired = (input: {
  channel: string
  lastIncomingMessageAt: Date | string | null
  now?: Date
}): boolean => {
  const windowSeconds = CHANNEL_WINDOW_SECONDS[input.channel as ChannelType]
  if (!windowSeconds) {
    return false
  }
  if (!input.lastIncomingMessageAt) {
    return false
  }
  const lastIncomingTs = new Date(input.lastIncomingMessageAt).getTime()
  if (!Number.isFinite(lastIncomingTs)) {
    return false
  }
  const nowTs = (input.now ?? new Date()).getTime()
  return nowTs - lastIncomingTs > windowSeconds * 1000
}
