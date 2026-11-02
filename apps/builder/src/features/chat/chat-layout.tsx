"use client"

import type { ConversationAttributes } from "@chatbotx.io/database/partials"
import { Button } from "@chatbotx.io/ui/components/ui/button"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@chatbotx.io/ui/components/ui/resizable"
import { cn } from "@chatbotx.io/ui/lib/utils"
import {
  BotIcon,
  Loader2Icon,
  MessagesSquareIcon,
  UserRoundIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ContactInboxPanel } from "../contacts/contact-inbox-panel"
import { disableBotAction } from "../conversations/actions/disable-bot.action"
import ConversationList from "../conversations/conversation-list"
import type { ConversationResource } from "../conversations/schema/resource"
import {
  BOT_DISABLE_DURATION_MS,
  isConversationActive,
} from "../conversations/utils/bot-state"
import { MessageInput } from "../messages/components/message-input"
import MessageHead from "../messages/message-head"
import { MessageList } from "../messages/message-list"
import { QuickRepliesPanel } from "../saved-replies/quick-replies-panel"
import { ChatRealtime } from "./chat-realtime"
import { useChatStore } from "./store/chat-store-provider"

type ChatLayoutProps = {
  canViewEmailAndPhone?: boolean
  workspaceId: string
  layout?: [number, number, number]
}

export const ChatLayout = (props: ChatLayoutProps) => {
  const t = useTranslations()
  const {
    canViewEmailAndPhone = true,
    workspaceId,
    layout = [25, 50, 25],
  } = props

  const {
    conversations,
    isFirstLoadConversation,
    isLoadingConversation,
    isBootstrappingUrlConversation,
    activeConversationId,
    updateConversation,
  } = useChatStore((state) => state)

  const [activeConversation, setActiveConversation] =
    useState<ConversationResource | null>(null)
  const [activeTab, setActiveTab] = useState<"chat" | "quickReplies">("chat")
  const isResolvingConversation =
    (isFirstLoadConversation && isLoadingConversation) ||
    isBootstrappingUrlConversation
  const shouldShowEmptyState = !(
    activeConversation ||
    isFirstLoadConversation ||
    isBootstrappingUrlConversation
  )

  const { execute: disableBot, isExecuting: isDisablingBot } = useAction(
    disableBotAction.bind(null, workspaceId),
    {
      onSuccess: () => {
        if (activeConversation) {
          updateConversation(activeConversation.id, {
            botEnabled: false,
            botResumeAt: new Date(Date.now() + BOT_DISABLE_DURATION_MS),
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

  useEffect(() => {
    const selectedConversation = conversations.find(
      (c) => c.id === activeConversationId,
    )
    if (selectedConversation) {
      setActiveConversation({
        ...selectedConversation,
        additionalAttributes:
          selectedConversation.additionalAttributes as ConversationAttributes,
      })
    } else {
      setActiveConversation(null)
    }
  }, [activeConversationId, conversations])

  return (
    <ResizablePanelGroup className="h-full items-stretch bg-background">
      {/* CONVERSATION LIST */}
      <ResizablePanel
        className="border-border border-e bg-card p-3"
        defaultSize={`${layout[0] ?? 25}%`}
        maxSize={"30%"}
        minSize={"20%"}
      >
        <ConversationList
          canViewEmailAndPhone={canViewEmailAndPhone}
          workspaceId={workspaceId}
        />
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* MESSAGE LIST */}
      <ResizablePanel
        className="bg-background"
        defaultSize={`${layout[1] ?? 50}%`}
      >
        <div className="flex h-full w-full flex-col overflow-hidden bg-card">
          <div className="flex items-center gap-1 border-b px-2">
            <Button
              className={cn(
                "rounded-none border-transparent border-b-2 data-[active=true]:border-foreground",
              )}
              data-active={activeTab === "chat"}
              onClick={() => setActiveTab("chat")}
              type="button"
              variant="ghost"
            >
              {t("quickReplies.chatTab")}
            </Button>
            <Button
              className={cn(
                "rounded-none border-transparent border-b-2 data-[active=true]:border-foreground",
              )}
              data-active={activeTab === "quickReplies"}
              onClick={() => setActiveTab("quickReplies")}
              type="button"
              variant="ghost"
            >
              {t("quickReplies.title")}
            </Button>
          </div>

          {activeTab === "quickReplies" ? (
            <div className="min-h-0 flex-1">
              <QuickRepliesPanel />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              {isResolvingConversation && (
                <Loader2Icon className="mx-auto my-4 animate-spin" />
              )}
              {activeConversation && (
                <div className="flex h-full w-full flex-col overflow-hidden">
                  <MessageHead />
                  {isConversationActive(activeConversation) && (
                    <Button
                      className="rounded-none border-primary/20 border-y bg-primary/10 text-primary hover:bg-primary/15"
                      disabled={isDisablingBot}
                      onClick={() => {
                        disableBot({ ids: [activeConversation.id] })
                      }}
                      variant="secondary"
                    >
                      <BotIcon />
                      {t("messages.botIsActive")}
                    </Button>
                  )}
                  <MessageList />
                  <MessageInput />
                </div>
              )}
              {shouldShowEmptyState && (
                <div
                  aria-live="polite"
                  className="flex h-full w-full flex-col items-center justify-center px-6 text-center"
                >
                  <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted">
                    <MessagesSquareIcon
                      aria-hidden="true"
                      className="size-7 text-muted-foreground"
                    />
                  </div>
                  <h3 className="font-semibold text-base">
                    {t("messages.selectConversationTitle")}
                  </h3>
                  <p className="mt-1 max-w-sm text-muted-foreground text-sm">
                    {t("messages.selectConversationDescription")}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        <ChatRealtime />
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* CONTACT DETAIL */}
      <ResizablePanel
        className="overflow-y-auto! h-screen border-border border-s bg-background px-4 py-3"
        defaultSize={`${layout[2] ?? 25}%`}
        maxSize={"30%"}
        minSize={"20%"}
      >
        {isResolvingConversation && (
          <Loader2Icon className="mx-auto my-4 animate-spin" />
        )}
        {activeConversation && (
          <ContactInboxPanel
            activeConversationId={activeConversation.id}
            workspaceId={workspaceId}
          />
        )}
        {shouldShowEmptyState && (
          <div
            aria-live="polite"
            className="flex h-full w-full flex-col items-center justify-center px-6 text-center"
          >
            <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted">
              <UserRoundIcon
                aria-hidden="true"
                className="size-7 text-muted-foreground"
              />
            </div>
            <h3 className="font-semibold text-base">
              {t("messages.selectConversationContactTitle")}
            </h3>
            <p className="mt-1 max-w-sm text-muted-foreground text-sm">
              {t("messages.selectConversationContactDescription")}
            </p>
          </div>
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
