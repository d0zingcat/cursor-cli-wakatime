const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildDirectHeartbeatArgs,
  buildDirectHeartbeatArgSets,
  extractEditedFiles,
  shouldSendDirectHeartbeat,
} = require('../dist/heartbeat.js');

test('builds a project heartbeat when no edited file is available', () => {
  const args = buildDirectHeartbeatArgs({
    input: {
      hook_event_name: 'stop',
      cursor_version: '2026.06.04',
      workspace_roots: ['/tmp/example-project'],
      conversation_id: 'conversation',
      generation_id: 'generation',
      transcript_path: null,
    },
    pluginVersion: '1.0.0',
  });

  assert.deepEqual(args, [
    '--entity',
    '/tmp/example-project',
    '--entity-type',
    'app',
    '--category',
    'ai coding',
    '--plugin',
    'cursor-cli/2026.06.04 cursor-cli-wakatime/1.0.0',
    '--project-folder',
    '/tmp/example-project',
    '--project',
    'example-project',
    '--heartbeat-rate-limit-seconds',
    '0',
    '--sync-ai-disabled',
  ]);
});

test('builds a write file heartbeat for write tool payloads', () => {
  const args = buildDirectHeartbeatArgs({
    input: {
      hook_event_name: 'postToolUse',
      cursor_version: '2026.06.04',
      workspace_roots: ['/tmp/example-project'],
      conversation_id: 'conversation',
      generation_id: 'generation',
      transcript_path: null,
      tool_name: 'Write',
      tool_input: {
        file_path: 'src/index.ts',
      },
    },
    pluginVersion: '1.0.0',
  });

  assert.deepEqual(args, [
    '--entity',
    '/tmp/example-project/src/index.ts',
    '--entity-type',
    'file',
    '--category',
    'ai coding',
    '--plugin',
    'cursor-cli/2026.06.04 cursor-cli-wakatime/1.0.0',
    '--project-folder',
    '/tmp/example-project',
    '--heartbeat-rate-limit-seconds',
    '0',
    '--sync-ai-disabled',
    '--write',
  ]);
});

test('collects write tool file paths without making postToolUse a send event', () => {
  const input = {
    hook_event_name: 'postToolUse',
    cursor_version: '2026.06.04',
    workspace_roots: ['/tmp/example-project'],
    conversation_id: 'conversation',
    generation_id: 'generation',
    transcript_path: null,
    tool_name: 'Write',
    tool_input: {
      file_path: 'src/index.ts',
    },
  };

  assert.deepEqual(extractEditedFiles(input), [{ path: '/tmp/example-project/src/index.ts', isWrite: true }]);
  assert.equal(shouldSendDirectHeartbeat(input), false);
});

test('sends queued file heartbeats on afterAgentResponse', () => {
  const argSets = buildDirectHeartbeatArgSets({
    input: {
      hook_event_name: 'afterAgentResponse',
      cursor_version: '2026.06.04',
      workspace_roots: ['/tmp/example-project'],
      conversation_id: 'conversation',
      generation_id: 'generation',
      transcript_path: null,
    },
    pluginVersion: '1.0.0',
    trackedFiles: [
      { path: '/tmp/example-project/src/index.ts', isWrite: true },
      { path: '/tmp/example-project/README.md', isWrite: false },
    ],
  });

  assert.deepEqual(argSets, [
    [
      '--entity',
      '/tmp/example-project/src/index.ts',
      '--entity-type',
      'file',
      '--category',
      'ai coding',
      '--plugin',
      'cursor-cli/2026.06.04 cursor-cli-wakatime/1.0.0',
      '--project-folder',
      '/tmp/example-project',
      '--heartbeat-rate-limit-seconds',
      '0',
      '--sync-ai-disabled',
      '--write',
    ],
    [
      '--entity',
      '/tmp/example-project/README.md',
      '--entity-type',
      'file',
      '--category',
      'ai coding',
      '--plugin',
      'cursor-cli/2026.06.04 cursor-cli-wakatime/1.0.0',
      '--project-folder',
      '/tmp/example-project',
      '--heartbeat-rate-limit-seconds',
      '0',
      '--sync-ai-disabled',
    ],
  ]);
  assert.equal(shouldSendDirectHeartbeat({ hook_event_name: 'afterAgentResponse' }), true);
});
