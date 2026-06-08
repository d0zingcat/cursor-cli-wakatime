const assert = require('node:assert/strict');
const test = require('node:test');

const { buildDirectHeartbeatArgs } = require('../dist/heartbeat.js');

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
