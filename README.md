# cursor-cli-wakatime

Track AI coding activity from **Cursor CLI** terminal agent sessions on your [WakaTime](https://wakatime.com) dashboard.

This plugin hooks into cursor-cli lifecycle events and sends WakaTime heartbeats for Cursor CLI agent activity.

It uses a hybrid tracking strategy:

- Runs `wakatime-cli --sync-ai-activity` to collect rich AI metrics when WakaTime CLI can parse Cursor transcripts.
- Collects edited files from lightweight hook events and sends direct `ai coding` heartbeats at agent response boundaries.

The direct heartbeat is the reliable fallback path: even when WakaTime CLI cannot parse the current Cursor CLI transcript format yet, your WakaTime/Wakapi dashboard still updates for the active project or edited files.

It does **not** replace the official [WakaTime Cursor extension](https://wakatime.com/cursor) for IDE typing time. Use both if you work in the IDE and the terminal.

## Prerequisites

- [cursor-cli](https://cursor.com/docs/cli) (`agent` command)
- Node.js 18+ (used by hook scripts)
- WakaTime API key in `~/.wakatime.cfg`:

```ini
[settings]
api_key = waka_xxx
```

## Install (recommended)

Two steps are required for **`agent -p`** (terminal headless). Plugin install alone does **not** register hooks — unlike Claude Code, `agent -p` currently reads hooks from `~/.cursor/hooks.json`, not from installed plugin `hooks/hooks.json`.

### Step 1: Install the plugin

In **Cursor Agent** chat (IDE or terminal):

```text
/plugin marketplace add https://github.com/d0zingcat/cursor-cli-wakatime.git
```

After the marketplace is added, Cursor shows **Plugin details / cursor-cli-wakatime**. Choose **Install for you (user scope)**. That is equivalent to:

```text
/plugin install cursor-cli-wakatime@d0zingcat-wakatime
```

Use marketplace name **`d0zingcat-wakatime`**, not `wakatime` (the official Claude plugin marketplace uses that name and can cache the wrong plugin).

### Step 2: Register hooks (required)

```bash
~/.cursor/plugins/cache/d0zingcat-wakatime/cursor-cli-wakatime/*/bin/cursor-cli-wakatime.js install
```

This writes hook entries to `~/.cursor/hooks.json` pointing at the installed plugin's `scripts/run`.

### Step 3: API key

Add your [API key](https://wakatime.com/api-key) to `~/.wakatime.cfg` if you have not already:

```ini
[settings]
api_key = waka_xxx
```

Start a new `agent` session after installing.

### Verify

```bash
agent -p -f "Reply OK"
find ~/.cursor/projects -name "*.wakatime" -newermt "1 min ago"
```

You should see a `*.jsonl.wakatime` file next to the session transcript, plus recent `cursor-cli-wakatime` entries in `~/.wakatime/wakatime.log`.

For the direct fallback heartbeat, look for a line like:

```text
Sending direct heartbeat: ... --entity <workspace-or-file> --category "ai coding" ... --sync-ai-disabled
```

### Upgrade

```text
/plugin marketplace update
```

## Alternative: npm global install

For manual hook installation without the plugin marketplace:

```bash
npm install -g github:d0zingcat/cursor-cli-wakatime
```

With **pnpm**, allow git `prepare`/`postinstall` scripts first:

```bash
pnpm add -g --allow-build=cursor-cli-wakatime github:d0zingcat/cursor-cli-wakatime
```

`dist/` is committed in git, so install does not need a local build step.

Global install automatically registers hooks in `~/.cursor/hooks.json` via `postinstall`. To install hooks manually (or after a local/non-global install), run:

```bash
cursor-cli-wakatime install
```

Environment variables:

| Variable | Effect |
|----------|--------|
| `CURSOR_CLI_WAKATIME_AUTO_INSTALL=1` | Auto-install hooks on any `npm install` (not only `-g`) |
| `CURSOR_CLI_WAKATIME_SKIP_AUTO_INSTALL=1` | Skip auto install/uninstall |

| Command | Description |
|---------|-------------|
| `cursor-cli-wakatime install` | Register hooks in `~/.cursor/hooks.json` |
| `cursor-cli-wakatime uninstall` | Remove only this package's hook entries |
| `cursor-cli-wakatime status` | Show hook, CLI, and config paths |
| `cursor-cli-wakatime doctor` | Verify installation health |
| `cursor-cli-wakatime test` | Run one activity sync for the current directory |

## How it works

Plugin hooks (CLI-compatible events):

- `postToolUse`
- `afterFileEdit`
- `afterAgentResponse`
- `stop`
- `sessionStart`

On each event, the hook script:

1. Reads JSON from stdin (Cursor hook payload)
2. Stores edited file paths from `postToolUse` and `afterFileEdit`
3. Ensures `wakatime-cli` is installed under `~/.wakatime/`
4. On `afterAgentResponse`, sends direct file heartbeats for the files collected during the turn
5. Uses `sessionStart` and `stop` as lifecycle/fallback points for project-level activity
6. Runs `wakatime-cli --sync-ai-activity --project-folder <workspace>` at send points to preserve rich AI metrics when transcript parsing works

The direct heartbeat uses `--sync-ai-disabled` so it does not recursively trigger AI transcript parsing, and `--heartbeat-rate-limit-seconds 0` because this package already applies its own per-conversation rate limit.

When `transcript_path` is null (common in CLI), the plugin resolves transcripts under:

```
~/.cursor/projects/<sanitized-workspace>/agent-transcripts/
```

## Design Notes

This project intentionally combines two approaches:

| Area | `ryanhiizy/cursor-agent-wakatime` | `cursor-cli-wakatime` |
| --- | --- | --- |
| Primary send point | `afterAgentResponse` | `afterAgentResponse`, with `stop` fallback |
| File attribution | Collect edit/tool events, send file heartbeats after the response | Same model for direct fallback heartbeats |
| AI transcript metrics | Direct heartbeat focused | Hybrid: direct heartbeat plus `wakatime-cli --sync-ai-activity` |
| Project fallback | Sends project-level app activity when no file is available | Same, also sends at `sessionStart` for session visibility |
| Goal | Reliable Cursor Agent time tracking | Reliable tracking plus best-effort rich AI metrics when WakaTime CLI supports the transcript format |

The direct heartbeat design is inspired by [`ryanhiizy/cursor-agent-wakatime`](https://github.com/ryanhiizy/cursor-agent-wakatime): edit-related hooks are best used for collection, while `afterAgentResponse` is a better approximation of when one unit of agent work has completed. This plugin keeps that send timing, then layers on `sync-ai-activity` so future WakaTime CLI improvements can still provide AI session, token, and line-change metadata.

## Local development

```bash
npm run build
agent --plugin-dir "$(pwd)" -p --force "say hello"
```

Or symlink for IDE testing:

```bash
ln -sf "$(pwd)" ~/.cursor/plugins/local/cursor-cli-wakatime
```

## Troubleshooting

```bash
cursor-cli-wakatime doctor
cursor-cli-wakatime test
```

In Cursor Agent chat:

```text
/plugin list
```

Enable debug logging in `~/.wakatime.cfg`:

```ini
[settings]
debug = true
```

Hook debug log: `~/.wakatime/cursor-cli-wakatime.log`  
WakaTime CLI log: `~/.wakatime/wakatime.log`

```bash
grep error ~/.wakatime/wakatime.log | grep -v backoff
```

## Known limitations

- **`agent -p` does not auto-load plugin hooks** — you must run `cursor-cli-wakatime install` after `/plugin install` (Claude Code merges plugin hooks automatically; Cursor CLI headless does not yet)
- Cursor plugins have no post-install script ([plugin manifest](https://cursor.com/docs/reference/plugins) has no `postInstall` lifecycle)
- cursor-cli hook coverage is incomplete compared to the IDE
- Cloud agents do not load user-level plugin hooks the same way as local CLI
- Rich AI metrics depend on wakatime-cli parsing Cursor transcript format; direct project/file heartbeats are still sent when parsing does not produce activity

## Acknowledgements

Thanks to [ryanhiizy/cursor-agent-wakatime](https://github.com/ryanhiizy/cursor-agent-wakatime) for demonstrating a practical direct-heartbeat approach for Cursor Agent hooks. The fallback heartbeat path in this plugin was inspired by that community implementation.

## License

BSD-3-Clause
