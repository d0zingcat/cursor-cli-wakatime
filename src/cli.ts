#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { Options } from './options';
import { Dependencies } from './dependencies';
import { logger } from './logger';
import { VERSION } from './version';
import { buildOptions, getCursorHomeDirectory } from './utils';

export const HOOK_MARKER = 'cursor-cli-wakatime';
export const HOOK_EVENTS = ['postToolUse', 'afterFileEdit', 'stop', 'sessionStart'] as const;

type HookEntry = {
  command: string;
  timeout?: number;
};

type HooksConfig = {
  version?: number;
  hooks: Record<string, HookEntry[]>;
};

function getPackageRoot(): string {
  return path.resolve(__dirname, '..');
}

function getHookScriptPath(): string {
  return path.join(getPackageRoot(), 'scripts', 'run');
}

function getHookCommand(): string {
  return quoteShellArg(getHookScriptPath());
}

function quoteShellArg(value: string): string {
  if (process.platform === 'win32') {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function isOurHookEntry(entry: HookEntry): boolean {
  if (typeof entry.command !== 'string') return false;
  return entry.command.includes(HOOK_MARKER) || entry.command.includes(path.join('cursor-cli-wakatime', 'scripts', 'run'));
}

function createHookEntry(): HookEntry {
  return {
    command: getHookCommand(),
    timeout: 30,
  };
}

function readHooksConfig(filePath: string): HooksConfig {
  if (!fs.existsSync(filePath)) {
    return { version: 1, hooks: {} };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as HooksConfig;
    if (!parsed.hooks || typeof parsed.hooks !== 'object') {
      return { version: 1, hooks: {} };
    }
    return { version: parsed.version ?? 1, hooks: parsed.hooks };
  } catch {
    throw new Error(`Failed to parse hooks config: ${filePath}`);
  }
}

function writeHooksConfig(filePath: string, config: HooksConfig): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const backup = `${filePath}.bak`;
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, backup);
  }
  fs.writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`);
}

function removeOurHooks(config: HooksConfig): HooksConfig {
  const hooks: Record<string, HookEntry[]> = {};
  for (const [eventName, entries] of Object.entries(config.hooks)) {
    const filtered = (entries ?? []).filter((entry) => !isOurHookEntry(entry));
    if (filtered.length > 0) {
      hooks[eventName] = filtered;
    }
  }
  return { version: config.version ?? 1, hooks };
}

function addOurHooks(config: HooksConfig): HooksConfig {
  const next = removeOurHooks(config);
  const entry = createHookEntry();

  for (const eventName of HOOK_EVENTS) {
    if (!next.hooks[eventName]) {
      next.hooks[eventName] = [];
    }
    next.hooks[eventName]!.push(entry);
  }

  return next;
}

function getHooksPath(): string {
  return path.join(getCursorHomeDirectory(), 'hooks.json');
}

function installHooks(): void {
  const hooksPath = getHooksPath();
  const config = addOurHooks(readHooksConfig(hooksPath));
  writeHooksConfig(hooksPath, config);
  console.log(`Installed ${HOOK_MARKER} hooks into ${hooksPath}`);
  console.log(`Hook command: ${getHookCommand()}`);
}

function uninstallHooks(): void {
  const hooksPath = getHooksPath();
  if (!fs.existsSync(hooksPath)) {
    console.log('No hooks.json found. Nothing to uninstall.');
    return;
  }

  const config = removeOurHooks(readHooksConfig(hooksPath));
  writeHooksConfig(hooksPath, config);
  console.log(`Removed ${HOOK_MARKER} hooks from ${hooksPath}`);
}

function printStatus(): void {
  const hooksPath = getHooksPath();
  const options = new Options();
  const deps = new Dependencies(options, logger);
  const hookScript = getHookScriptPath();

  console.log(`${HOOK_MARKER} v${VERSION}`);
  console.log(`hooks.json: ${hooksPath} (${fs.existsSync(hooksPath) ? 'exists' : 'missing'})`);
  console.log(`hook script: ${hookScript} (${fs.existsSync(hookScript) ? 'exists' : 'missing'})`);
  console.log(`wakatime-cli: ${deps.getCliLocation()} (${deps.isCliInstalled() ? 'exists' : 'missing'})`);
  console.log(`wakatime.cfg: ${options.getConfigFile(false)} (${fs.existsSync(options.getConfigFile(false)) ? 'exists' : 'missing'})`);

  if (fs.existsSync(hooksPath)) {
    const config = readHooksConfig(hooksPath);
    for (const eventName of HOOK_EVENTS) {
      const entries = config.hooks[eventName] ?? [];
      const installed = entries.some((entry) => isOurHookEntry(entry));
      console.log(`  ${eventName}: ${installed ? 'installed' : 'not installed'}`);
    }
  }
}

function runDoctor(): number {
  const failures: string[] = [];
  const hookScript = getHookScriptPath();
  const options = new Options();
  const deps = new Dependencies(options, logger);
  const hooksPath = getHooksPath();

  if (!fs.existsSync(hookScript)) {
    failures.push(`hook script missing: ${hookScript} (run npm run build)`);
  }

  if (!deps.isCliInstalled()) {
    failures.push(`wakatime-cli missing: ${deps.getCliLocation()}`);
  }

  if (!fs.existsSync(options.getConfigFile(false))) {
    failures.push(`wakatime config missing: ${options.getConfigFile(false)}`);
  }

  if (!fs.existsSync(hooksPath)) {
    failures.push(`hooks not installed: ${hooksPath}`);
  } else {
    const config = readHooksConfig(hooksPath);
    for (const eventName of HOOK_EVENTS) {
      const installed = (config.hooks[eventName] ?? []).some((entry) => isOurHookEntry(entry));
      if (!installed) {
        failures.push(`hook not registered: ${eventName}`);
      }
    }
  }

  const nodeResult = spawnSync(process.execPath, ['-v'], { encoding: 'utf8' });
  if (nodeResult.status !== 0) {
    failures.push('node is not available');
  }

  if (failures.length > 0) {
    console.error('Doctor found issues:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    return 1;
  }

  console.log('All checks passed.');
  return 0;
}

function runTest(): number {
  const options = new Options();
  const deps = new Dependencies(options, logger);
  const wakatimeCli = deps.getCliLocation();
  const projectFolder = process.cwd();

  if (!deps.isCliInstalled()) {
    console.error(`wakatime-cli not found at ${wakatimeCli}`);
    return 1;
  }

  const args = [
    '--sync-ai-activity',
    '--plugin',
    `cursor-cli/test cursor-cli-wakatime/${VERSION}`,
    '--project-folder',
    projectFolder,
  ];

  const result = spawnSync(wakatimeCli, args, {
    ...buildOptions(),
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    console.error('Test heartbeat failed.');
    if (result.stderr) console.error(result.stderr.trim());
    if (result.stdout) console.error(result.stdout.trim());
    return 1;
  }

  console.log('Test sync-ai-activity succeeded.');
  return 0;
}

function printHelp(): void {
  console.log(`cursor-cli-wakatime v${VERSION}

Usage:
  cursor-cli-wakatime install     Install hooks into ~/.cursor/hooks.json
  cursor-cli-wakatime uninstall   Remove hooks from ~/.cursor/hooks.json
  cursor-cli-wakatime status        Show installation status
  cursor-cli-wakatime doctor        Verify installation health
  cursor-cli-wakatime test          Run one sync-ai-activity for current directory
`);
}

function main(): void {
  const command = process.argv[2] ?? 'help';

  switch (command) {
    case 'install':
      installHooks();
      break;
    case 'uninstall':
      uninstallHooks();
      break;
    case 'status':
      printStatus();
      break;
    case 'doctor':
      process.exit(runDoctor());
      break;
    case 'test':
      process.exit(runTest());
      break;
    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main();
