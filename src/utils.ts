import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as child_process from 'child_process';
import { StdioOptions } from 'child_process';
import { CursorHookInput, State, TrackedFile } from './types';
import { logger } from './logger';

export function parseInput(): CursorHookInput | undefined {
  try {
    const stdinData = fs.readFileSync(0, 'utf-8');
    if (stdinData.trim()) {
      return JSON.parse(stdinData) as CursorHookInput;
    }
  } catch (err) {
    console.error(err);
  }
  return undefined;
}

export function getProjectRoot(inp?: CursorHookInput): string {
  if (inp?.workspace_roots?.[0]) return path.resolve(inp.workspace_roots[0]);
  if (inp?.cwd) return path.resolve(inp.cwd);
  return process.cwd();
}

export function sanitizeProjectPath(workspaceRoot: string): string {
  return workspaceRoot.replace(/[^A-Za-z0-9]/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
}

export function resolveTranscriptPath(inp: CursorHookInput): string | undefined {
  const explicit = inp.transcript_path?.trim();
  if (explicit && fileExists(explicit)) return explicit;

  const conversationId = inp.conversation_id;
  const workspaceRoot = getProjectRoot(inp);
  if (!conversationId) return explicit || undefined;

  const sanitized = sanitizeProjectPath(workspaceRoot);
  const transcriptsDir = path.join(getHomeDirectory(), '.cursor', 'projects', sanitized, 'agent-transcripts');

  const flat = path.join(transcriptsDir, `${conversationId}.jsonl`);
  if (fileExists(flat)) return flat;

  const nested = path.join(transcriptsDir, conversationId, `${conversationId}.jsonl`);
  if (fileExists(nested)) return nested;

  if (explicit) return explicit;
  return flat;
}

function getStateFile(inp: CursorHookInput): string {
  const transcriptPath = resolveTranscriptPath(inp);
  if (transcriptPath) return `${transcriptPath}.wakatime`;

  const conversationId = inp.conversation_id || 'unknown';
  return path.join(getHomeDirectory(), '.wakatime', 'cursor-cli', `${sanitizeFileName(conversationId)}.wakatime`);
}

export function shouldSendHeartbeat(inp?: CursorHookInput): boolean {
  return shouldSendHeartbeatForSignature(inp);
}

export function shouldSendHeartbeatForSignature(inp?: CursorHookInput, signature?: string): boolean {
  if (!inp) return false;

  try {
    const state = readState(inp);
    const last = state.lastHeartbeatAt ?? 0;
    return timestamp() - last >= 60 || (!!signature && signature !== state.lastSignature);
  } catch {
    return true;
  }
}

export async function updateState(inp?: CursorHookInput, signature?: string): Promise<void> {
  if (!inp) return;
  const state = readState(inp);
  await writeState(inp, {
    ...state,
    lastHeartbeatAt: timestamp(),
    lastSignature: signature ?? state.lastSignature,
  });
}

export function getPendingFiles(inp?: CursorHookInput): TrackedFile[] {
  if (!inp) return [];
  return readState(inp).pendingFiles ?? [];
}

export async function rememberPendingFiles(inp: CursorHookInput | undefined, files: TrackedFile[]): Promise<void> {
  if (!inp || files.length === 0) return;
  const state = readState(inp);
  await writeState(inp, {
    ...state,
    pendingFiles: mergePendingFiles(state.pendingFiles ?? [], files),
  });
}

export async function clearPendingFiles(inp?: CursorHookInput): Promise<void> {
  if (!inp) return;
  const state = readState(inp);
  if (!state.pendingFiles?.length) return;

  const { pendingFiles: _pendingFiles, ...next } = state;
  await writeState(inp, next);
}

export function getCursorVersion(inp: CursorHookInput | undefined): string {
  return inp?.cursor_version?.trim() || '';
}

export function formatArguments(binary: string, args: string[]): string {
  const clone = args.slice(0);
  clone.unshift(wrapArg(binary));
  const newCmds: string[] = [];
  let lastCmd = '';
  for (let i = 0; i < clone.length; i++) {
    if (lastCmd == '--key') newCmds.push(wrapArg(obfuscateKey(clone[i])));
    else newCmds.push(wrapArg(clone[i]));
    lastCmd = clone[i];
  }
  return newCmds.join(' ');
}

export function isWindows(): boolean {
  return os.platform() === 'win32';
}

export function getHomeDirectory(): string {
  const home = process.env.WAKATIME_HOME;
  if (home && home.trim() && fs.existsSync(home.trim())) return home.trim();
  return process.env[isWindows() ? 'USERPROFILE' : 'HOME'] || process.cwd();
}

export function getCursorHomeDirectory(): string {
  return path.join(os.homedir(), '.cursor');
}

export function buildOptions(stdin?: boolean): child_process.ExecFileOptions {
  const options: child_process.ExecFileOptions = {
    windowsHide: true,
  };
  if (stdin) {
    (options as child_process.ExecFileOptions & { stdio: StdioOptions }).stdio = ['pipe', 'pipe', 'pipe'];
  }
  if (!isWindows() && !process.env.WAKATIME_HOME && !process.env.HOME) {
    options.env = { ...process.env, WAKATIME_HOME: getHomeDirectory() };
  }
  return options;
}

function timestamp(): number {
  return Date.now() / 1000;
}

function readState(inp: CursorHookInput): State {
  try {
    return JSON.parse(fs.readFileSync(getStateFile(inp), 'utf-8')) as State;
  } catch {
    return {};
  }
}

async function writeState(inp: CursorHookInput, state: State): Promise<void> {
  const file = getStateFile(inp);
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  await fs.promises.writeFile(file, JSON.stringify(state, null, 2));
}

function mergePendingFiles(existing: TrackedFile[], incoming: TrackedFile[]): TrackedFile[] {
  const files = new Map<string, TrackedFile>();

  for (const file of [...existing, ...incoming]) {
    const previous = files.get(file.path);
    files.set(file.path, {
      path: file.path,
      isWrite: Boolean(previous?.isWrite || file.isWrite),
    });
  }

  return Array.from(files.values());
}

function fileExists(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, '_').substring(0, 255);
}

function wrapArg(arg: string): string {
  if (arg.indexOf(' ') > -1) return '"' + arg.replace(/"/g, '\\"') + '"';
  return arg;
}

function obfuscateKey(key: string): string {
  let newKey = '';
  if (key) {
    newKey = key;
    if (key.length > 4) newKey = 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXX' + key.substring(key.length - 4);
  }
  return newKey;
}
