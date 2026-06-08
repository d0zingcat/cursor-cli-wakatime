#!/usr/bin/env node

import { execFile } from 'child_process';
import { promisify } from 'util';
import { Options } from './options';
import { VERSION } from './version';
import { Dependencies } from './dependencies';
import { logger, LogLevel } from './logger';
import { CursorHookInput } from './types';
import { buildDirectHeartbeatArgs, buildSyncAIActivityArgs } from './heartbeat';
import {
  buildOptions,
  formatArguments,
  parseInput,
  shouldSendHeartbeat,
  updateState,
} from './utils';

const options = new Options();
const deps = new Dependencies(options, logger);
const execFileAsync = promisify(execFile);

async function runWakatime(args: string[], label: string): Promise<boolean> {
  const wakatime_cli = deps.getCliLocation();

  logger.debug(`${label}: ${formatArguments(wakatime_cli, args)}`);

  const execOptions = buildOptions();
  try {
    const { stdout, stderr } = await execFileAsync(wakatime_cli, args, execOptions);
    const output = stdout.toString().trim() + stderr.toString().trim();
    if (output) logger.error(output);
    return true;
  } catch (e) {
    if (e) logger.error(e.toString());
    return false;
  }
}

async function sendHeartbeat(inp: CursorHookInput | undefined): Promise<boolean> {
  const syncOk = await runWakatime(buildSyncAIActivityArgs({ input: inp, pluginVersion: VERSION }), 'Syncing AI activity');
  const directArgs = buildDirectHeartbeatArgs({ input: inp, pluginVersion: VERSION });
  const directOk = directArgs.length > 0 ? await runWakatime(directArgs, 'Sending direct heartbeat') : false;

  return syncOk || directOk;
}

async function main(): Promise<void> {
  const inp = parseInput();

  const debug = options.getSetting('settings', 'debug');
  logger.setLevel(debug === 'true' ? LogLevel.DEBUG : LogLevel.INFO);

  try {
    if (inp) logger.debug(JSON.stringify(inp, null, 2));

    deps.checkAndInstallCli();

    if (shouldSendHeartbeat(inp)) {
      if (await sendHeartbeat(inp)) {
        await updateState(inp);
      }
    }
  } catch (err) {
    logger.errorException(err);
  }

  process.stdout.write('{}\n');
}

main();
