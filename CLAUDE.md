# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Chrome Manifest V3 extension ("AI Chat Friendly") that lets a user define
**Tools** (a single prompt template, meant to extract/save info from an AI
chat thread into a file) and group several into a **Kit** (sent as one
combined message). Clicking the toolbar icon opens a native browser popup
listing Kits/Tools; clicking one injects a content script into the active
tab and sends the prompt into the page's chat textarea. Supported chat
platforms: ChatGPT, Claude, Gemini, Grok, DeepSeek, Qwen, Z.ai, Kimi, Manus,
Meta AI.

The primary developer documentation is **README.md** (in Vietnamese) — it
is a running changelog of every version and contains the authoritative
rationale for most non-obvious design decisions. Read it before making
architectural changes; don't duplicate its content here, but do update it
(append a new version section) after any user-visible or behavioral change,
matching its existing style (Vietnamese, `## Bản X.Y.Z — ...` headings,
honest "Giới hạn trung thực" limitations notes where relevant).

## Commands

There is no build step, bundler, package.json, or test suite — this is
plain unbundled JS loaded directly by the browser.

- **Load/reload the extension**: `chrome://extensions` → enable *Developer
  mode* → *Load unpacked* → select this directory. After any edit, click
  the reload icon on the extension's card (content/background script
  changes require this; also reload any already-open AI chat tab if
  `content.js`/`shared.js` changed).
- **Debug**: background service worker logs via `chrome://extensions` →
  this extension → *service worker* link. Content script logs appear in
  the normal page DevTools console, filtered by the `[aicf]` prefix.
  Runtime errors surfaced by Chrome show under `chrome://extensions` →
  the extension's *Errors* button — check this after any change that
  touches script injection, since duplicate-injection bugs surface there
  as `SyntaxError`s, not console errors.
- **"Test suite"**: none automated in this repo; changes have historically
  been validated either against real MHTML captures of each platform's chat
  UI or by manual click-through. If asked to add tests, ask the user how
  they'd like to run them (no existing harness to match).

## Architecture

### Execution flow (core feature)

1. `popup.html`/`popup.js` — the toolbar's native popup (Manifest V3
   `action.default_popup`). Runs in its own isolated context with **no**
   access to the AI chat page's DOM. It just lists enabled Tools/Kits
   (loaded via `shared.js`) and, on click, sends
   `{type:"aicf:run", tabId, itemType, itemId}` to the background, then
   immediately closes itself (`window.close()`) — no progress UI here.
2. `background.js` — the MV3 service worker. Because `default_popup` is
   set, `chrome.action.onClicked` never fires (a Chrome rule, not a
   choice) — everything starts from the `aicf:run` message. It checks the
   tab's hostname against `SUPPORTED_HOSTS`, then
   `chrome.scripting.executeScript`-injects `shared.js` + `content.js` into
   the tab, then sends `{type:"aicf:start", itemType, itemId}` to the
   freshly-injected content script.
3. `content.js` — finds the platform's chat input/send button (see
   `PLATFORM_INPUT_SELECTORS`/`PLATFORM_SEND_SELECTORS`), builds the
   prompt (single Tool, or a Kit's prompts numbered and concatenated into
   one message), inserts it via `document.execCommand("insertText", ...)`,
   and clicks send (or dispatches an Enter keydown as a fallback). **It
   does not wait for a reply, does not look for attachments, and does not
   download anything** — as of v8.0.0 the extension's job ends the moment
   the message is sent; the AI executing the prompt and producing files is
   entirely the user's/AI's business from that point on. Don't reintroduce
   response-watching/attachment-download logic without checking with the
   user first — it was deliberately ripped out (~500→~190 lines) as part
   of a scope reduction.

### The repeated-injection guard (easy to break)

`shared.js` and `content.js` are re-injected into the **same tab** every
time the user runs another Tool/Kit on it. A content script's isolated
world is **not** torn down between injections (only on page reload), so
top-level `const`/`function` declarations would throw
`Identifier '...' has already been declared` on the second run. Both files
guard against this by wrapping their **entire body** in
`if (!window.__aicfXxxLoaded) { window.__aicfXxxLoaded = true; ... }`.
When editing either file:
- Keep all top-level declarations inside that guard block — a declaration
  left outside it will break on the second injection.
- `shared.js` needs its functions usable from other scripts/contexts
  (`content.js`, `options.js`, `popup.js`), so anything used externally
  must be explicitly assigned to `window.*` at the end of the guarded
  block (block-scoped `const`/`function` don't leak out on their own).
  `content.js` doesn't export anything since nothing else calls into it.

### Data model and storage (`shared.js`)

- `Tool = { id, icon, name, promptTemplate (may contain "{filename}"), targetFilename?, enabled? }`
- `Kit = { id, icon, name, toolIds: [...], enabled? }` — prompts of member
  Tools get numbered and joined into one combined message when the Kit runs.
- Storage is split across two `chrome.storage` areas, driven by quota
  constraints:
  - `chrome.storage.sync` — each Tool/Kit is stored as **its own item**
    (`aicf_tool_<id>` / `aicf_kit_<id>`), plus one small order-list item
    (`aicf_tool_order` / `aicf_kit_order`), so this data syncs across
    machines signed into the same Chrome/Google account. This exists
    because `sync` cap's per-item quota (8KB) makes storing one big
    array (the old `storage.local` design) fragile — splitting per-entity
    keeps individual items small.
  - `chrome.storage.local` — used for anything that can't fit `sync`'s
    per-item 8KB limit: uploaded-image icons (`data:image/...`, keyed
    `aicf_icon_<id>`), and as an automatic fallback if an individual
    Tool/Kit item still exceeds 8KB (e.g. a very long prompt) so no data
    is ever silently lost. Also holds the Supabase auth token
    (`aicf_auth`) — deliberately kept out of `sync` since it's sensitive.
  - `aicfLoadTools`/`aicfLoadKits`/`aicfSaveTools`/`aicfSaveKits` in
    `shared.js` hide this split from callers — always go through these
    rather than touching `chrome.storage` directly for Tool/Kit data.
- Enabled/disabled (`enabled !== false`, so legacy data without the field
  defaults to shown) controls popup visibility only — a disabled Tool
  still works if referenced inside a Kit; only Options can toggle it.

### Options page (`options.html`/`options.js`)

The only place Tools/Kits can be added/edited/deleted/reordered (popup is
run-only). Reordering uses ↑/↓ buttons, not drag-and-drop (intentional —
see README). Also hosts the optional Cloud Sync card.

### Optional cloud sync (`supabase-config.js`, `supabase-sync.js`, `supabase-schema.sql`)

Independent, opt-in second sync layer on top of `chrome.storage.sync`,
backed by Supabase + Google OAuth via `chrome.identity.launchWebAuthFlow`.
If `supabase-config.js` has no URL/key filled in, the Cloud Sync UI in
Options self-hides and everything else behaves as if this layer doesn't
exist. Key points if touching this code:
- Auth token round-trips through `chrome.identity.launchWebAuthFlow`
  (browser navigation, not `fetch()`) — that's why `apikey` must be a
  **query param** on `/auth/v1/authorize` specifically, while every other
  Supabase call here sends it as an `apikey` header (never inside
  `Authorization`, which is reserved for the bearer token).
  Data is stored in a single `aicf_configs` row per user
  (`user_id`, `tools` jsonb, `kits` jsonb), gated by Postgres row-level
  security policies in `supabase-schema.sql` (each user can only
  select/insert/update their own row) — if you touch the schema, update
  the RLS policies alongside it, don't leave data readable across users.
- Pull failures must never be treated as "cloud is empty" — a past bug
  (fixed in v6.1.0) silently overwrote real cloud data on a transient
  pull error. Preserve the distinction between "pull failed" (stop, do
  nothing, surface an error) and "pull succeeded but cloud is genuinely
  empty" (safe to push local defaults) if you touch
  `aicfPullConfigFromCloud`/`onSignInClick`/`showSyncConflictModal`.
- Conflict resolution is last-write-wins with no merge — the
  sync-conflict modal (`showSyncConflictModal`) exists so login on a new
  machine gives the user an explicit choice (load cloud / keep mine and
  overwrite cloud / do nothing) instead of a silent decision either way.
