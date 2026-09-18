export type FlowDiffNode = {
  id: string
  data?: { name?: string; details?: { steps?: Array<{ text?: string }> } }
}

const nodeText = (node: FlowDiffNode): string =>
  (node.data?.details?.steps ?? [])
    .map((step) => step.text ?? "")
    .join(" ")
    .trim()

/**
 * Compares a previous node list against a new one and produces a
 * human-friendly change summary: nodes added, removed, and modified (name or
 * message-text change). Kept in its own module because a "use server" file
 * cannot export non-async functions.
 */
export const diffFlowNodes = (
  previous: FlowDiffNode[],
  current: FlowDiffNode[],
): {
  added?: string[]
  removed?: string[]
  changed?: { name: string; before?: string; after?: string }[]
} => {
  const previousById = new Map(previous.map((node) => [node.id, node]))
  const currentById = new Map(current.map((node) => [node.id, node]))

  const added: string[] = []
  const removed: string[] = []
  const changed: { name: string; before?: string; after?: string }[] = []

  for (const node of current) {
    if (!previousById.has(node.id)) {
      added.push(node.data?.name ?? node.id)
    }
  }
  for (const node of previous) {
    if (!currentById.has(node.id)) {
      removed.push(node.data?.name ?? node.id)
      continue
    }
    const currentName = currentById.get(node.id)?.data?.name
    const nameChanged =
      (node.data?.name ?? node.id) !== (currentName ?? node.id)
    const beforeText = nodeText(node)
    const afterText = nodeText(currentById.get(node.id) ?? node)
    if (nameChanged || beforeText !== afterText) {
      changed.push({
        name: currentName ?? node.id,
        before: nameChanged
          ? (node.data?.name ?? undefined)
          : beforeText || undefined,
        after: afterText || undefined,
      })
    }
  }

  return {
    added: added.length > 0 ? added : undefined,
    removed: removed.length > 0 ? removed : undefined,
    changed: changed.length > 0 ? changed : undefined,
  }
}
