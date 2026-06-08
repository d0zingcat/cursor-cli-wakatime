#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function shouldAutoInstall() {
  if (process.env.CURSOR_CLI_WAKATIME_SKIP_AUTO_INSTALL === '1') {
    return false;
  }
  if (process.env.CI === 'true' || process.env.CI === '1') {
    return false;
  }
  if (process.env.CURSOR_CLI_WAKATIME_AUTO_INSTALL === '1') {
    return true;
  }
  return process.env.npm_config_global === 'true';
}

function runCli(command) {
  const cliPath = path.join(__dirname, '..', 'dist', 'cli.js');
  if (!fs.existsSync(cliPath)) {
    console.warn(`cursor-cli-wakatime: ${cliPath} missing, skipping auto hook ${command}`);
    return 0;
  }

  const result = spawnSync(process.execPath, [cliPath, command], {
    stdio: 'inherit',
    env: process.env,
  });
  return result.status ?? 1;
}

function main() {
  if (!shouldAutoInstall()) {
    return;
  }

  const status = runCli('install');
  if (status !== 0) {
    console.warn('cursor-cli-wakatime: auto hook install failed (run `cursor-cli-wakatime install` manually)');
  }
}

main();
