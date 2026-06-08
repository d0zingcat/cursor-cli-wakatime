# cursor-cli-wakatime

Track AI coding activity from **Cursor CLI** terminal agent sessions on your [WakaTime](https://wakatime.com) dashboard.

This plugin hooks into cursor-cli lifecycle events and calls `wakatime-cli --sync-ai-activity` to sync AI-generated code metrics, prompt time, and related stats.

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

You should see a `*.jsonl.wakatime` file next to the session transcript.

### Upgrade

```text
/plugin marketplace update
```

## Alternative: npm global install

For manual hook installation without the plugin marketplace:

```bash
npm install -g github:d0zingcat/cursor-cli-wakatime
cursor-cli-wakatime install
```

| Command | Description |
|---------|-------------|
| `cursor-cli-wakatime install` | Register hooks in `~/.cursor/hooks.json` |
| `cursor-cli-wakatime uninstall` | Remove only this package's hook entries |
| `cursor-cli-wakatime status` | Show hook, CLI, and config paths |
| `cursor-cli-wakatime doctor` | Verify installation health |
| `cursor-cli-wakatime test` | Run one `sync-ai-activity` for the current directory |

## How it works

Plugin hooks (CLI-compatible events):

- `postToolUse`
- `afterFileEdit`
- `stop`
- `sessionStart`

On each event, the hook script:

1. Reads JSON from stdin (Cursor hook payload)
2. Rate-limits to one sync per conversation per 60 seconds
3. Ensures `wakatime-cli` is installed under `~/.wakatime/`
4. Runs `wakatime-cli --sync-ai-activity --project-folder <workspace>`

When `transcript_path` is null (common in CLI), the plugin resolves transcripts under:

```
~/.cursor/projects/<sanitized-workspace>/agent-transcripts/
```

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
- AI metrics depend on wakatime-cli parsing Cursor transcript format

## License

BSD-3-Clause
