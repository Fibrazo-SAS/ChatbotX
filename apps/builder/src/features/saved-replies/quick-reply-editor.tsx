"use client"

import { Button } from "@chatbotx.io/ui/components/ui/button"
import { Input } from "@chatbotx.io/ui/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@chatbotx.io/ui/components/ui/popover"
import { Textarea } from "@chatbotx.io/ui/components/ui/textarea"
import { DirectUploadButton } from "@chatbotx.io/ui/components/uploader/direct-upload-button"
import { cn } from "@chatbotx.io/ui/lib/utils"
import { zodResolver } from "@hookform/resolvers/zod"
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks"
import Emoji, { gitHubEmojis } from "@tiptap/extension-emoji"
import Placeholder from "@tiptap/extension-placeholder"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import EmojiPicker, { type EmojiClickData } from "emoji-picker-react"
import {
  Bold,
  Code,
  Image,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2Icon,
  Quote,
  Redo2,
  Smile,
  SquareCode,
  Strikethrough,
  Undo2,
  X,
} from "lucide-react"
import ImageNext from "next/image"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { createSavedReplyAction } from "./actions/create-saved-reply.action"
import { editSavedReplyAction } from "./actions/edit-saved-reply.action"
import { savedReplyContentRequest } from "./schema/mutation"
import type { SavedReplyResource } from "./schema/resource"
import "@/components/tiptap/tiptap-editor.css"

const MAX_TEXT_LENGTH = 4096

const plainTextToParagraphHtml = (text: string): string =>
  text
    .split("\n")
    .map(
      (line) =>
        `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`,
    )
    .join("")

type QuickReplyEditorProps = {
  workspaceId: string
  editing?: SavedReplyResource
  onCancel: () => void
  onSaved: (item: SavedReplyResource) => void
}

type ToolbarButton = {
  key: string
  label: string
  icon: typeof Bold
  isActive?: () => boolean
  onClick: () => void
}

const QuickReplyEditor = ({
  workspaceId,
  editing,
  onCancel,
  onSaved,
}: QuickReplyEditorProps) => {
  const t = useTranslations()

  const [imageUrl, setImageUrl] = useState<string | null>(
    editing?.imageUrl ?? null,
  )
  const [imageError, setImageError] = useState<string | null>(null)
  const [isOpenEmoji, setIsOpenEmoji] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const imageUploadRef = useRef<HTMLButtonElement | null>(null)

  const createBoundAction = createSavedReplyAction.bind(null, workspaceId)
  const boundAction = (editing
    ? editSavedReplyAction.bind(null, workspaceId, editing.id)
    : createBoundAction) as unknown as typeof createBoundAction

  const isEdit = Boolean(editing)

  const {
    form,
    handleSubmitWithAction,
    resetFormAndAction: resetForm,
  } = useHookFormAction(boundAction, zodResolver(savedReplyContentRequest), {
    actionProps: {
      onSuccess: ({ data }) => {
        if (data) {
          onSaved({
            ...(editing ?? ({} as SavedReplyResource)),
            ...data,
            imageUrl: data.imageUrl ?? imageUrl,
          } as SavedReplyResource)
        }
        toast.success(
          isEdit
            ? t("messages.savedSuccessfully")
            : t("messages.createdSuccess", {
                feature: t("fields.savedReplies.label"),
              }),
        )
        resetForm()
        onCancel()
      },
      onError: ({ error }) => {
        if (error.serverError) {
          toast.error(error.serverError)
        }
      },
    },
    formProps: {
      mode: "onChange",
      defaultValues: {
        shortcut: editing?.shortcut ?? "",
        text: editing?.text ?? "",
        imageFileId: undefined,
        removeImage: false,
        secondText: editing?.secondText ?? "",
      },
    },
    errorMapProps: {},
  })

  const text = form.watch("text") ?? ""
  const secondText = form.watch("secondText") ?? ""

  const hasImage = Boolean(imageUrl)

  const onEmojiClick = (emojiObject: EmojiClickData) => {
    tiptapEditor?.commands.insertContent(emojiObject.emoji)
    setIsOpenEmoji(false)
  }

  const tiptapEditor = useEditor({
    extensions: [
      StarterKit,
      Emoji.configure({
        emojis: gitHubEmojis,
        enableEmoticons: true,
      }),
      Placeholder.configure({
        placeholder: t("quickReplies.firstTextPlaceholder"),
      }),
    ],
    content: editing ? plainTextToParagraphHtml(editing.text) : "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      form.setValue("text", editor.getText({ blockSeparator: "\n" }), {
        shouldValidate: true,
      })
    },
  })

  // Keep the editor in sync when the target reply changes (reopening the row).
  useEffect(() => {
    if (
      tiptapEditor &&
      editing &&
      tiptapEditor.getText({ blockSeparator: "\n" }) !== editing.text
    ) {
      tiptapEditor.commands.setContent(plainTextToParagraphHtml(editing.text))
    }
  }, [tiptapEditor, editing?.id, editing?.text, editing])

  const applyLink = () => {
    if (!tiptapEditor) {
      return
    }
    const url = linkUrl.trim()
    if (url === "") {
      tiptapEditor.chain().focus().extendMarkRange("link").unsetLink().run()
    } else {
      tiptapEditor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run()
    }
    setLinkOpen(false)
  }

  const toolbarButtons: ToolbarButton[] = [
    {
      key: "undo",
      label: "Deshacer",
      icon: Undo2,
      onClick: () => tiptapEditor?.chain().focus().undo().run(),
    },
    {
      key: "redo",
      label: "Rehacer",
      icon: Redo2,
      onClick: () => tiptapEditor?.chain().focus().redo().run(),
    },
    {
      key: "bold",
      label: "Negrita",
      icon: Bold,
      isActive: () => tiptapEditor?.isActive("bold") ?? false,
      onClick: () => tiptapEditor?.chain().focus().toggleBold().run(),
    },
    {
      key: "italic",
      label: "Cursiva",
      icon: Italic,
      isActive: () => tiptapEditor?.isActive("italic") ?? false,
      onClick: () => tiptapEditor?.chain().focus().toggleItalic().run(),
    },
    {
      key: "strike",
      label: "Tachado",
      icon: Strikethrough,
      isActive: () => tiptapEditor?.isActive("strike") ?? false,
      onClick: () => tiptapEditor?.chain().focus().toggleStrike().run(),
    },
    {
      key: "code",
      label: "Monoespaciado",
      icon: Code,
      isActive: () => tiptapEditor?.isActive("code") ?? false,
      onClick: () => tiptapEditor?.chain().focus().toggleCode().run(),
    },
    {
      key: "bulletList",
      label: "Viñetas",
      icon: List,
      isActive: () => tiptapEditor?.isActive("bulletList") ?? false,
      onClick: () => tiptapEditor?.chain().focus().toggleBulletList().run(),
    },
    {
      key: "orderedList",
      label: "Lista numerada",
      icon: ListOrdered,
      isActive: () => tiptapEditor?.isActive("orderedList") ?? false,
      onClick: () => tiptapEditor?.chain().focus().toggleOrderedList().run(),
    },
    {
      key: "blockquote",
      label: "Cita",
      icon: Quote,
      isActive: () => tiptapEditor?.isActive("blockquote") ?? false,
      onClick: () => tiptapEditor?.chain().focus().toggleBlockquote().run(),
    },
    {
      key: "codeBlock",
      label: "Bloque de código",
      icon: SquareCode,
      isActive: () => tiptapEditor?.isActive("codeBlock") ?? false,
      onClick: () => tiptapEditor?.chain().focus().toggleCodeBlock().run(),
    },
  ]

  const textTooLong = text.length > MAX_TEXT_LENGTH
  const secondTextTooLong = secondText.length > MAX_TEXT_LENGTH

  const saveErrorVisible =
    textTooLong || secondTextTooLong || Boolean(imageError)
  const canSave =
    !saveErrorVisible && text.trim().length > 0 && !form.formState.isSubmitting

  return (
    <form
      className="space-y-3 border-b bg-card p-4"
      onSubmit={handleSubmitWithAction}
    >
      <Input
        className="w-full"
        onChange={(event) =>
          form.setValue("shortcut", event.target.value, {
            shouldValidate: true,
          })
        }
        placeholder="/atajo"
        value={form.watch("shortcut") ?? ""}
      />

      {/* Toolbar: 13 icons in the ticket's order (link, image and emoji as
          popover-driven buttons at the end) */}
      <div className="flex flex-wrap items-center gap-0.5">
        {toolbarButtons.map((button) => (
          <Button
            aria-label={button.label}
            className={cn(
              "size-8 p-0",
              button.isActive?.() && "bg-accent text-accent-foreground",
            )}
            key={button.key}
            onClick={(event) => {
              event.preventDefault()
              button.onClick()
            }}
            size="icon"
            title={button.label}
            type="button"
            variant="ghost"
          >
            <button.icon className="size-4" />
          </Button>
        ))}

        {/* Enlace */}
        <Popover
          onOpenChange={(open) => {
            if (open) {
              const currentHref = tiptapEditor?.getAttributes("link").href as
                | string
                | undefined
              setLinkUrl(currentHref ?? "")
            }
            setLinkOpen(open)
          }}
          open={linkOpen}
        >
          <PopoverTrigger
            render={
              <Button
                aria-label="Enlace"
                className={cn(
                  "size-8 p-0",
                  tiptapEditor?.isActive("link") &&
                    "bg-accent text-accent-foreground",
                )}
                size="icon"
                title="Enlace"
                type="button"
                variant="ghost"
              >
                <Link2 className="size-4" />
              </Button>
            }
          />
          <PopoverContent align="start" className="w-72 space-y-2 p-2">
            <Input
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="https://"
              value={linkUrl}
            />
            <div className="flex justify-end gap-1">
              <Button
                onClick={() => setLinkOpen(false)}
                size="sm"
                type="button"
                variant="outline"
              >
                {t("actions.cancel")}
              </Button>
              <Button onClick={applyLink} size="sm" type="button">
                {t("actions.save")}
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Imagen */}
        <Button
          aria-label="Imagen"
          className="size-8 p-0"
          onClick={(event) => {
            event.preventDefault()
            imageUploadRef.current?.click()
          }}
          size="icon"
          title="Imagen"
          type="button"
          variant="ghost"
        >
          <Image className="size-4" />
        </Button>

        {/* Emoji */}
        <Popover onOpenChange={setIsOpenEmoji} open={isOpenEmoji}>
          <PopoverTrigger
            render={
              <Button
                aria-label="Emoji"
                className="size-8 p-0"
                size="icon"
                title="Emoji"
                type="button"
                variant="ghost"
              >
                <Smile className="size-4" />
              </Button>
            }
          />
          <PopoverContent align="start" className="w-auto p-0">
            <EmojiPicker onEmojiClick={onEmojiClick} />
          </PopoverContent>
        </Popover>
      </div>

      {/* Message bubble: first text */}
      <div className="rounded-2xl bg-muted p-3">
        <EditorContent
          className="prose-sm max-w-none [&_.tiptap]:outline-none"
          editor={tiptapEditor}
        />
        <div className="mt-1 flex justify-end text-muted-foreground text-xs">
          {text.length}/{MAX_TEXT_LENGTH}
        </div>
      </div>

      {/* Image, under the first text */}
      <div className="space-y-2">
        <DirectUploadButton
          accept="image/jpeg,image/png"
          className="hidden"
          label={t("actions.uploadFile")}
          maxSize={5 * 1024 * 1024}
          multiple={false}
          onUploadError={(_error, _file) => {
            setImageError(t("quickReplies.imageInvalid"))
          }}
          onUploadSuccess={(_filePath, _file, publicUrl, meta) => {
            form.setValue("imageFileId", meta.fileId, {
              shouldValidate: true,
            })
            form.setValue("removeImage", false)
            setImageUrl(publicUrl)
            setImageError(null)
          }}
          triggerRef={imageUploadRef}
          uploadPath={`public/space/${workspaceId}/saved-replies`}
          workspaceId={workspaceId}
        />

        {hasImage && imageUrl ? (
          <div className="relative overflow-hidden rounded-lg">
            <ImageNext
              alt={t("quickReplies.attachedImage")}
              className="max-h-60 w-full object-contain"
              height={240}
              src={imageUrl}
              unoptimized
              width={480}
            />
            <div className="flex items-center gap-2 pt-2">
              <Button
                onClick={(event) => {
                  event.preventDefault()
                  imageUploadRef.current?.click()
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                {t("quickReplies.changeImage")}
              </Button>
              <Button
                onClick={(event) => {
                  event.preventDefault()
                  form.setValue("removeImage", true)
                  form.setValue("imageFileId", null)
                  setImageUrl(null)
                  form.setValue("secondText", "")
                  setImageError(null)
                }}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X />
              </Button>
            </div>
          </div>
        ) : (
          <Button
            onClick={(event) => {
              event.preventDefault()
              imageUploadRef.current?.click()
            }}
            type="button"
            variant="outline"
          >
            <Image />
            {t("quickReplies.addImage")}
          </Button>
        )}
        {imageError ? (
          <p className="text-destructive text-xs dark:text-destructive">
            {imageError}
          </p>
        ) : null}
      </div>

      {/* Second text, only when there is an image */}
      {hasImage ? (
        <div className="space-y-1">
          <Textarea
            className="w-full"
            onChange={(event) =>
              form.setValue("secondText", event.target.value, {
                shouldValidate: true,
              })
            }
            placeholder={t("quickReplies.secondTextPlaceholder")}
            value={secondText}
          />
          <div className="flex justify-end text-muted-foreground text-xs">
            {secondText.length}/{MAX_TEXT_LENGTH}
          </div>
        </div>
      ) : null}

      {saveErrorVisible ? (
        <p className="text-destructive text-xs dark:text-destructive">
          {t("quickReplies.saveError")}
        </p>
      ) : null}

      <div className="flex items-center justify-between pt-2">
        <Button onClick={onCancel} type="button" variant="outline">
          {t("actions.cancel")}
        </Button>
        <Button disabled={!canSave} type="submit">
          {form.formState.isSubmitting ? (
            <Loader2Icon className="animate-spin" />
          ) : null}
          {t("actions.save")}
        </Button>
      </div>
    </form>
  )
}

export { QuickReplyEditor }
