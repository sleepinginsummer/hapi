# AGENTS.md

Work style: telegraph; noun-phrases ok; drop grammar;

Short guide for AI agents in this repo. Prefer progressive loading: start with the root README, then package READMEs as needed.

## What is HAPI?

Local-first platform for running AI coding agents (Claude Code, Codex, Gemini) with remote control via web/phone. CLI wraps agents and connects to hub; hub serves web app and handles real-time sync.

## Repo layout

```
cli/     - CLI binary, agent wrappers, runner daemon
hub/     - HTTP API + Socket.IO + SSE + Telegram bot
web/     - React PWA for remote control
shared/  - Common types, schemas, utilities
docs/    - VitePress documentation site
website/ - Marketing site
```

Bun workspaces; `shared` consumed by cli, hub, web.

## Architecture overview

```
┌─────────┐  Socket.IO   ┌─────────┐   SSE/REST   ┌─────────┐
│   CLI   │ ──────────── │   Hub   │ ──────────── │   Web   │
│ (agent) │              │ (server)│              │  (PWA)  │
└─────────┘              └─────────┘              └─────────┘
     │                        │                        │
     ├─ Wraps Claude/Codex    ├─ SQLite persistence   ├─ TanStack Query
     ├─ Socket.IO client      ├─ Session cache        ├─ SSE for updates
     └─ RPC handlers          ├─ RPC gateway          └─ assistant-ui
                              └─ Telegram bot
```

**Data flow:**
1. CLI spawns agent (claude/codex/gemini), connects to hub via Socket.IO
2. Agent events → CLI → hub (socket `message` event) → DB + SSE broadcast
3. Web subscribes to SSE `/api/events`, receives live updates
4. User actions → Web → hub REST API → RPC to CLI → agent

## Reference docs

- `README.md` - User overview, quick start
- `cli/README.md` - CLI commands, config, runner
- `hub/README.md` - Hub config, HTTP API, Socket.IO events
- `web/README.md` - Routes, components, hooks
- `docs/guide/` - User guides (installation, how-it-works, FAQ)

## Shared rules

- No backward compatibility: breaking old formats freely
- Prioritize Pragmatism, and Avoid Overengineering.
- Write necessary tests ONLY.
- TypeScript strict; no untyped code
- Bun workspaces; run `bun` commands from repo root
- Path alias `@/*` maps to `./src/*` per package
- Prefer 4-space indentation
- Zod for runtime validation (schemas in `shared/src/schemas.ts`)

## Common commands (repo root)

```bash
bun typecheck           # All packages
bun run test            # cli + hub tests
bun run dev             # hub + web concurrently
bun run build:single-exe # All-in-one binary
```

## Key source dirs

### CLI (`cli/src/`)
- `api/` - Hub connection (Socket.IO client, auth)
- `claude/` - Claude Code integration (wrapper, hooks)
- `codex/` - Codex mode integration
- `agent/` - Multi-agent support (Gemini via ACP)
- `runner/` - Background daemon for remote spawn
- `commands/` - CLI subcommands (auth, runner, doctor)
- `modules/` - Tool implementations (ripgrep, difftastic, git)
- `ui/` - Terminal UI (Ink components)

### Hub (`hub/src/`)
- `web/routes/` - REST API endpoints
- `socket/` - Socket.IO setup
- `socket/handlers/cli/` - CLI event handlers (session, terminal, machine, RPC)
- `sync/` - Core logic (sessionCache, messageService, rpcGateway)
- `store/` - SQLite persistence (better-sqlite3)
- `sse/` - Server-Sent Events manager
- `telegram/` - Bot commands, callbacks
- `notifications/` - Push (VAPID) and Telegram notifications
- `config/` - Settings loading, token generation
- `visibility/` - Client visibility tracking

### Web (`web/src/`)
- `routes/` - TanStack Router pages
- `routes/sessions/` - Session views (chat, files, terminal)
- `components/` - Reusable UI (SessionList, SessionChat, NewSession/)
- `hooks/queries/` - TanStack Query hooks
- `hooks/mutations/` - Mutation hooks
- `hooks/useSSE.ts` - SSE subscription
- `api/client.ts` - API client wrapper

### Shared (`shared/src/`)
- `types.ts` - Core types (Session, Message, Machine)
- `schemas.ts` - Zod schemas for validation
- `socket.ts` - Socket.IO event types
- `messages.ts` - Message parsing utilities
- `modes.ts` - Permission/model mode definitions

## Pre-push self-review (agents)

Before commit/push/PR: use the **`pre-push-review`** skill (`~/.cursor/skills/pre-push-review/`).

1. **Mechanical:** `bun typecheck && bun run test` (matches `.github/workflows/test.yml`)
2. **Logic:** skim `git diff origin/main...HEAD`; apply `.github/prompts/codex-pr-review.md` as a local Major checklist (no Codex required)
3. **Style:** optional

## Fork 发版与部署

当前 fork 的代码仓库、GitHub 账号和 npm 包不是同一个标识，发版时必须分别确认：

- 源码仓库：`sleepinginsummer/hapi`
- fork 远程：`sleepinginsummer`
- 上游远程：`origin`，指向 `tiann/hapi`，不能把它当成 fork 发布源
- 当前代码里的 npm 包名：`@twsxtd/hapi` 及 `@twsxtd/hapi-*` 平台包；它不是 `sleepinginsummer` npm 包

### 标准流程

1. 在干净工作树上完成检查：

   ```bash
   bun typecheck
   bun run test
   ```

2. 将目标提交推送到 fork 的 `main`：

   ```bash
   git push sleepinginsummer HEAD:main
   ```

   `main` push 只触发测试和按条件触发 Web 部署，不会自动发布 CLI 二进制或 npm 包。

3. 创建 fork release tag，触发 `.github/workflows/fork-release.yml`：

   ```bash
   git tag fork-v<版本号>
   git push sleepinginsummer fork-v<版本号>
   ```

   例如当前版本线使用 `fork-v0.23.1.1`。tag 必须匹配 `fork-v*`。

4. 等待对应的 GitHub Action 完成。该 workflow 会构建 Linux x64、macOS ARM64、Windows x64 等平台产物，并创建 GitHub Release，上传平台 npm tarball 和 `checksums.txt`。

5. 线上更新必须使用 `sleepinginsummer/hapi` 这次 Release 的产物并校验 checksum，不能仅凭版本号执行 `npm install @twsxtd/hapi@<版本>`。npm registry 中同名版本可能来自上游发布，包的 `repository` 元数据也可能仍指向 `tiann/hapi`。

   服务器当前由 `hapi-hub.service` 管理，入口为 `/usr/local/bin/hapi hub --no-relay`。更新顺序：先替换并检查二进制，再重启服务，最后确认 `systemctl is-active hapi-hub.service` 和公网 HTTP 返回正常。

   本机 runner 更新后执行：

   ```bash
   export HAPI_API_URL="https://hapi.znzme.com"
   export CLI_API_TOKEN="<本机实际 token>"
   hapi doctor clean
   hapi runner stop
   hapi runner start --workspace-root /Volumes/syy2t/project --workspace-root /Users/syy/Desktop/mac-project
   ```

6. 目前 `fork-release.yml` 只创建 GitHub Release，不执行 `npm publish`。如果要发布 npm 包，必须另行确认 npm scope、版本号和发布凭据，并同步修改包名、平台依赖和发布 workflow；不能把 GitHub 仓库名自动当作 npm 包名。

### 发布后核验

- `git show <tag>^{commit}` 指向预期提交
- GitHub Release 的平台文件和 `checksums.txt` 存在
- 服务器 `hapi --version`、Hub 服务状态和公网 HTTP 均正常
- 本机 runner 使用两个 workspace 启动并能连接 Hub
- 未使用 `origin` 的上游 Release 或未经核验的同名 npm 包

## Testing

- Test framework: Vitest (via `bun run test`)
- Test files: `*.test.ts` next to source
- Run: `bun run test` (from root) or `bun run test` (from package)
- Hub tests: `hub/src/**/*.test.ts`
- CLI tests: `cli/src/**/*.test.ts`
- No web tests currently

## Common tasks

| Task | Key files |
|------|-----------|
| Add CLI command | `cli/src/commands/`, `cli/src/index.ts` |
| Add API endpoint | `hub/src/web/routes/`, register in `hub/src/web/index.ts` |
| Add Socket.IO event | `hub/src/socket/handlers/cli/`, `shared/src/socket.ts` |
| Add web route | `web/src/routes/`, `web/src/router.tsx` |
| Add web component | `web/src/components/` |
| Modify session logic | `hub/src/sync/sessionCache.ts`, `hub/src/sync/syncEngine.ts` |
| Modify message handling | `hub/src/sync/messageService.ts` |
| Add notification type | `hub/src/notifications/` |
| Add shared type | `shared/src/types.ts`, `shared/src/schemas.ts` |

## Important patterns

- **RPC**: CLI registers handlers (`rpc-register`), hub routes requests via `rpcGateway.ts`
- **Versioned updates**: CLI sends `update-metadata`/`update-state` with version; hub rejects stale
- **Session modes**: `local` (terminal) vs `remote` (web-controlled); switchable mid-session
- **Permission modes**: `default`, `acceptEdits`, `auto`, `bypassPermissions`, `plan`
- **Namespaces**: Multi-user isolation via `CLI_API_TOKEN:<namespace>` suffix

## Adding new web features — consider an FUE

When you ship a non-essential feature (the 20% of sessions, not the 80%), consider wrapping its affordance in the generic First-User-Experience primitive so existing users discover it without a giant always-visible UI block.

- **Hook**: `web/src/lib/use-fue.ts` — `useFue(featureId)` returns `{ status, engage, dismiss }`. Storage namespace `hapi.fue.v1.<featureId>` (one localStorage key per feature, isolated from any upstream onboarding flow).
- **Components**: `web/src/components/Fue.tsx` — `<FueDot>` (small pulsing badge for the affordance) and `<FueCallout>` (portal-rendered popover with title/body + "Got it" affirmative-action dismiss).

Pattern (~10 lines around the affordance):

```tsx
const fue = useFue('my-feature')
const buttonRef = useRef<HTMLButtonElement>(null)
return (
    <>
        <button ref={buttonRef} onClick={() => { fue.engage(); doThing() }}>
            <Icon />
            {fue.status !== 'acknowledged' ? <FueDot pulsing={fue.status === 'unseen'} /> : null}
        </button>
        {fue.status === 'engaging' ? (
            <FueCallout
                title={t('myFeature.fueTitle')}
                body={t('myFeature.fueBody')}
                onDismiss={fue.dismiss}
                anchorRef={buttonRef}
            />
        ) : null}
    </>
)
```

Rules:
- Affirmative action only: there is no auto-timeout — user dismisses by clicking "Got it" (reading speed varies).
- The FUE dot and any feature-specific badge (e.g. an entry counter) should be **mutually exclusive**: onboarding signal beats inventory signal until acknowledged.
- Storage is opt-in per-feature; if upstream ships its own onboarding for a feature, just don't wrap that affordance.

Canonical example: scratchlist toggle in `web/src/components/AssistantChat/ComposerButtons.tsx` (`ScratchlistToggleButton`).

## Critical Thinking

1. Fix root cause (not band-aid).
2. Unsure: read more code; if still stuck, ask w/ short options.
3. Conflicts: call out; pick safer path.
4. Unrecognized changes: assume other agent; keep going; focus your changes. If it causes issues, stop + ask user.
