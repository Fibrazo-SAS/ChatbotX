"use client"

import type { ChannelType } from "@chatbotx.io/database/partials"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@chatbotx.io/ui/components/ui/avatar"
import { Button } from "@chatbotx.io/ui/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@chatbotx.io/ui/components/ui/tooltip"
import { BotIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { toast } from "sonner"
import { useWorkspaceId } from "@/hooks/routing"
import { useChatStore } from "../chat/store/chat-store-provider"
import { useAvatarUrl } from "../contacts/utils"
import { InboxIcon } from "../inboxes/components/inbox-icon"
import { enableBotAction } from "../conversations/actions/enable-bot.action"
import { UpdateConversationAssignee } from "../conversations/components/update-conversation-assignee"
import { ConversationAction } from "../conversations/conversation-action"
import { isConversationActive } from "../conversations/utils/bot-state"

export default function MessageHead() {
  const t = useTranslations()
  const workspaceId = useWorkspaceId()

  const {
    conversations,
    activeConversationId,
    setAssignee,
    updateConversation,
  } = useChatStore((state) => state)

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId,
  )
  const contact = activeConversation?.contact
  const avatarUrl = useAvatarUrl(contact)
  const channel = activeConversation?.contactInboxes?.[0]?.channel as
    | ChannelType
    | undefined
  const contactName = contact?.fullName ?? "?"

  const { execute: enableBot, isExecuting: isEnablingBot } = useAction(
    enableBotAction.bind(null, workspaceId),
    {
      onSuccess: () => {
        if (activeConversation) {
          updateConversation(activeConversation.id, {
            botEnabled: true,
            botResumeAt: null,
          })
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
    activeConversation && (
      <div className="flex items-center gap-3 border-border border-b bg-card px-4 py-3 shadow-black/3 shadow-sm">
        <div className="relative shrink-0">
          <Avatar className="size-10 border-2 border-background shadow-sm">
            <AvatarImage
              alt={contactName}
              className="object-cover"
              src={avatarUrl}
            />
            <AvatarFallback className="bg-primary/12 font-semibold text-primary text-sm">
              {contactName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {channel && (
            <span className="absolute -end-1 -bottom-1 flex size-4 items-center justify-center rounded-full border-2 border-card bg-card">
              <InboxIcon
                channel={channel}
                iconClassName="size-3"
                showLabel={false}
                size="small"
              />
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="truncate font-semibold text-base text-foreground">
            {contactName}
          </div>
          <UpdateConversationAssignee
            conversation={activeConversation}
            onChange={setAssignee}
          />
        </div>
        {!isConversationActive(activeConversation) && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  disabled={isEnablingBot}
                  onClick={() => {
                    enableBot({ ids: [activeConversation.id] })
                  }}
                  variant="ghost"
                >
                  <BotIcon />
                </Button>
              }
            />
            <TooltipContent>
              <p>{t("actions.transferConversationToBot")}</p>
            </TooltipContent>
          </Tooltip>
        )}
        <ConversationAction conversation={activeConversation} />
      </div>
    )
  )
}
