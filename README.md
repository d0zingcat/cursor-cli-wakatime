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

In **Cursor Agent** chat (IDE or terminal), run:

```text
/plugin marketplace add https://github.com/d0zingcat/cursor-cli-wakatime.git
/plugin install cursor-cli-wakatime@wakatime
```

Then add your [API key](https://wakatime.com/api-key) to `~/.wakatime.cfg` if you have not already.

Restart or start a new cursor-cli session after installing.

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

- cursor-cli hook coverage is incomplete compared to the IDE
- Cloud agents do not load user-level plugin hooks the same way as local CLI
- AI metrics depend on wakatime-cli parsing Cursor transcript format

## License

BSD-3-Clause
