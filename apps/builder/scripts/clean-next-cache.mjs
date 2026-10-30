#!/usr/bin/env node
// Removes only the persistent development cache.
// Preserve .next/cache: production builds reuse its Turbopack artifacts.
// Safe for both `dev` and `start`: build OUTPUT (.next/server, .next/static,
// routes, etc.) is intentionally NOT touched, so `next start` still serves a
// valid build. Cross-platform (Node fs, not `rm -rf`).
import { rm } from "node:fs/promises"
import { resolve } from "node:path"

const nextDir = resolve(import.meta.dirname, "..", ".next")
const targets = [["dev", "cache"]].map((parts) =>
  resolve(nextDir, ...parts),
)

let removed = 0
for (const dir of targets) {
  try {
    await rm(dir, { recursive: true, force: true })
    removed++
    console.log(`[clean-next-cache] removed ${dir.replace(process.cwd(), ".")}`)
  } catch (err) {
    console.warn(`[clean-next-cache] skip ${dir}: ${err.message}`)
  }
}
if (removed === 0) {
  console.log("[clean-next-cache] nothing to clean")
}
