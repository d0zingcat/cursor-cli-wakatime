import * as path from 'path';
import { CursorHookInput } from './types';
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
  if (!params.input) return [];

  const projectFolder = getProjectRoot(params.input);
  const filePath = extractEditedFilePath(params.input, projectFolder);
  const cursorVersion = getCursorVersion(params.input);
  const args = [
    '--entity',
    filePath ?? projectFolder,
    '--entity-type',
    filePath ? 'file' : 'app',
    '--category',
    'ai coding',
    '--plugin',
    pluginName(cursorVersion, params.pluginVersion),
    '--project-folder',
    projectFolder,
  ];

  if (!filePath) {
    args.push('--project', path.basename(projectFolder));
  }

  args.push('--heartbeat-rate-limit-seconds', '0', '--sync-ai-disabled');

  if (filePath && isWriteEvent(params.input)) {
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
  return path.isAbsolute(filePath) ? path.normalize(filePath) : path.normalize(path.join(projectFolder, filePath));
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
