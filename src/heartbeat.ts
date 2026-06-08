import * as path from 'path';
import { CursorHookInput, TrackedFile } from './types';
import { getCursorVersion, getProjectRoot } from './utils';

const WRITE_TOOL_NAMES = new Set([
  'applypatch',
  'create',
  'delete',
  'edit',
  'editfile',
  'edit_file',
  'multiedit',
  'multi_edit',
  'notebookedit',
  'notebook_edit',
  'strreplace',
  'str_replace',
  'write',
  'writefile',
  'write_file',
]);

const PATH_KEYS = [
  'file',
  'file_path',
  'filePath',
  'new_file_path',
  'newFilePath',
  'old_file_path',
  'oldFilePath',
  'path',
  'target_file',
  'targetFile',
  'uri',
];

export function buildSyncAIActivityArgs(params: { input?: CursorHookInput; pluginVersion: string }): string[] {
  const projectFolder = params.input ? getProjectRoot(params.input) : undefined;
  const cursorVersion = getCursorVersion(params.input);
  const args = ['--sync-ai-activity', '--plugin', pluginName(cursorVersion, params.pluginVersion)];

  if (projectFolder) {
    args.push('--project-folder', projectFolder);
  }

  return args;
}

export function buildDirectHeartbeatArgs(params: { input?: CursorHookInput; pluginVersion: string }): string[] {
  return buildDirectHeartbeatArgSets(params)[0] ?? [];
}

export function buildDirectHeartbeatArgSets(params: {
  input?: CursorHookInput;
  pluginVersion: string;
  trackedFiles?: TrackedFile[];
}): string[][] {
  if (!params.input) return [];

  const projectFolder = getProjectRoot(params.input);
  const trackedFiles = mergeTrackedFiles([], params.trackedFiles?.length ? params.trackedFiles : extractEditedFiles(params.input));
  const cursorVersion = getCursorVersion(params.input);
  const base = {
    cursorVersion,
    pluginVersion: params.pluginVersion,
    projectFolder,
  };

  if (trackedFiles.length > 0) {
    return trackedFiles.map((file) => buildDirectHeartbeatArgsForTarget({ ...base, file }));
  }

  return [buildDirectHeartbeatArgsForTarget(base)];
}

export function extractEditedFiles(input: CursorHookInput): TrackedFile[] {
  const projectFolder = getProjectRoot(input);

  if (!shouldExtractFilePath(input)) return [];

  return mergeTrackedFiles(
    [],
    [...extractPathValues(input), ...extractPathValues(input.tool_input)]
      .filter((value) => value.trim())
      .map((filePath) => ({
        path: normalizeFilePath(filePath, projectFolder),
        isWrite: isWriteEvent(input),
      })),
  );
}

export function mergeTrackedFiles(existing: TrackedFile[], incoming: TrackedFile[]): TrackedFile[] {
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

export function shouldSendDirectHeartbeat(input?: CursorHookInput): boolean {
  if (!input) return false;

  const eventName = input.hook_event_name.toLowerCase();
  return eventName === 'afteragentresponse' || eventName === 'stop' || eventName === 'sessionstart';
}

export function buildHeartbeatSignature(input: CursorHookInput, trackedFiles: TrackedFile[]): string {
  if (trackedFiles.length === 0) {
    return `app:${getProjectRoot(input)}`;
  }

  return mergeTrackedFiles([], trackedFiles)
    .map((file) => `${file.isWrite ? 'w' : 'r'}:${file.path}`)
    .sort()
    .join('|');
}

function buildDirectHeartbeatArgsForTarget(params: {
  cursorVersion: string;
  pluginVersion: string;
  projectFolder: string;
  file?: TrackedFile;
}): string[] {
  const filePath = params.file?.path;
  const args = [
    '--entity',
    filePath ?? params.projectFolder,
    '--entity-type',
    filePath ? 'file' : 'app',
    '--category',
    'ai coding',
    '--plugin',
    pluginName(params.cursorVersion, params.pluginVersion),
    '--project-folder',
    params.projectFolder,
  ];

  if (!filePath) {
    args.push('--project', path.basename(params.projectFolder));
  }

  args.push('--heartbeat-rate-limit-seconds', '0', '--sync-ai-disabled');

  if (params.file?.isWrite) {
    args.push('--write');
  }

  return args;
}

function pluginName(cursorVersion: string, pluginVersion: string): string {
  return `cursor-cli/${cursorVersion} cursor-cli-wakatime/${pluginVersion}`;
}

function extractEditedFilePath(input: CursorHookInput, projectFolder: string): string | undefined {
  if (!shouldExtractFilePath(input)) return;

  const values = [...extractPathValues(input), ...extractPathValues(input.tool_input)];
  const filePath = values.find((value) => value.trim());

  if (!filePath) return;
  return normalizeFilePath(filePath, projectFolder);
}

function shouldExtractFilePath(input: CursorHookInput): boolean {
  const eventName = input.hook_event_name.toLowerCase();
  return eventName === 'afterfileedit' || (eventName === 'posttooluse' && isWriteEvent(input));
}

function isWriteEvent(input: CursorHookInput): boolean {
  return WRITE_TOOL_NAMES.has(normalizeToolName(input.tool_name));
}

function normalizeToolName(toolName: string | undefined): string {
  return (toolName ?? '').replace(/[^A-Za-z0-9_]/g, '').toLowerCase();
}

function extractPathValues(input: Record<string, unknown> | undefined): string[] {
  if (!input) return [];

  const values: string[] = [];

  for (const key of PATH_KEYS) {
    const value = input[key];
    if (typeof value === 'string') {
      values.push(value);
    }
  }

  for (const key of ['paths', 'files']) {
    const value = input[key];
    if (Array.isArray(value)) {
      values.push(...value.filter((item): item is string => typeof item === 'string'));
    }
  }

  return values;
}

function normalizeFilePath(filePath: string, projectFolder: string): string {
  return path.isAbsolute(filePath) ? path.normalize(filePath) : path.normalize(path.join(projectFolder, filePath));
}
