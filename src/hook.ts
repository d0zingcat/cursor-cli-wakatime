#!/usr/bin/env node

import { execFile } from 'child_process';
import { promisify } from 'util';
import { Options } from './options';
import { VERSION } from './version';
import { Dependencies } from './dependencies';
import { logger, LogLevel } from './logger';
import { CursorHookInput } from './types';
import {
  buildDirectHeartbeatArgSets,
  buildHeartbeatSignature,
  buildSyncAIActivityArgs,
  extractEditedFiles,
  shouldSendDirectHeartbeat,
} from './heartbeat';
import {
  buildOptions,
  clearPendingFiles,
  formatArguments,
  getPendingFiles,
  rememberPendingFiles,
  parseInput,
  shouldSendHeartbeatForSignature,
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
  if (!inp || !shouldSendDirectHeartbeat(inp)) return false;

  const trackedFiles = getPendingFiles(inp);
  const signature = buildHeartbeatSignature(inp, trackedFiles);
  if (!shouldSendHeartbeatForSignature(inp, signature)) return false;

  const syncOk = await runWakatime(buildSyncAIActivityArgs({ input: inp, pluginVersion: VERSION }), 'Syncing AI activity');
  const directArgSets = buildDirectHeartbeatArgSets({ input: inp, pluginVersion: VERSION, trackedFiles });
  const directResults = await Promise.all(directArgSets.map((args) => runWakatime(args, 'Sending direct heartbeat')));
  const directOk = directResults.some(Boolean);

  if (syncOk || directOk) {
    await updateState(inp, signature);
    await clearPendingFiles(inp);
    return true;
  }

  return false;
}

async function main(): Promise<void> {
  const inp = parseInput();

  const debug = options.getSetting('settings', 'debug');
  logger.setLevel(debug === 'true' ? LogLevel.DEBUG : LogLevel.INFO);

  try {
    if (inp) logger.debug(JSON.stringify(inp, null, 2));

    deps.checkAndInstallCli();

    if (inp) {
      await rememberPendingFiles(inp, extractEditedFiles(inp));
      await sendHeartbeat(inp);
    }
  } catch (err) {
    logger.errorException(err);
  }

  process.stdout.write('{}\n');
}

main();
