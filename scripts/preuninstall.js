#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function shouldAutoUninstall() {
  if (process.env.CURSOR_CLI_WAKATIME_SKIP_AUTO_INSTALL === '1') {
    return false;
  }
  if (process.env.CI === 'true' || process.env.CI === '1') {
    return false;
  }
  return process.env.npm_config_global === 'true';
}

function main() {
  if (!shouldAutoUninstall()) {
    return;
  }

  const cliPath = path.join(__dirname, '..', 'dist', 'cli.js');
  if (!fs.existsSync(cliPath)) {
    return;
  }

  spawnSync(process.execPath, [cliPath, 'uninstall'], {
    stdio: 'inherit',
    env: process.env,
  });
}

main();
