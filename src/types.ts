export type State = {
  lastHeartbeatAt?: number;
  lastSignature?: string;
  pendingFiles?: TrackedFile[];
};

export type TrackedFile = {
  path: string;
  isWrite: boolean;
};

export type HookEvent =
  | 'postToolUse'
  | 'afterFileEdit'
  | 'afterAgentResponse'
  | 'stop'
  | 'sessionStart'
  | 'sessionEnd'
  | 'preToolUse'
  | 'beforeSubmitPrompt'
  | 'subagentStop';

export type CursorHookInput = {
  conversation_id: string;
  generation_id: string;
  hook_event_name: HookEvent | string;
  cursor_version: string;
  workspace_roots: string[];
  transcript_path: string | null;
  cwd?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
};
