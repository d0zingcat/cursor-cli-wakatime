"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/heartbeat.ts
var heartbeat_exports = {};
__export(heartbeat_exports, {
  buildDirectHeartbeatArgs: () => buildDirectHeartbeatArgs,
  buildSyncAIActivityArgs: () => buildSyncAIActivityArgs
});
module.exports = __toCommonJS(heartbeat_exports);
var path2 = __toESM(require("path"));

// src/utils.ts
var path = __toESM(require("path"));
function getProjectRoot(inp) {
  if (inp?.workspace_roots?.[0]) return path.resolve(inp.workspace_roots[0]);
  if (inp?.cwd) return path.resolve(inp.cwd);
  return process.cwd();
}
function getCursorVersion(inp) {
  return inp?.cursor_version?.trim() || "";
}

// src/heartbeat.ts
var WRITE_TOOL_NAMES = /* @__PURE__ */ new Set([
  "applypatch",
  "create",
  "delete",
  "edit",
  "editfile",
  "edit_file",
  "multiedit",
  "multi_edit",
  "notebookedit",
  "notebook_edit",
  "strreplace",
  "str_replace",
  "write",
  "writefile",
  "write_file"
]);
var PATH_KEYS = [
  "file",
  "file_path",
  "filePath",
  "new_file_path",
  "newFilePath",
  "old_file_path",
  "oldFilePath",
  "path",
  "target_file",
  "targetFile",
  "uri"
];
function buildSyncAIActivityArgs(params) {
  const projectFolder = params.input ? getProjectRoot(params.input) : void 0;
  const cursorVersion = getCursorVersion(params.input);
  const args = ["--sync-ai-activity", "--plugin", pluginName(cursorVersion, params.pluginVersion)];
  if (projectFolder) {
    args.push("--project-folder", projectFolder);
  }
  return args;
}
function buildDirectHeartbeatArgs(params) {
  if (!params.input) return [];
  const projectFolder = getProjectRoot(params.input);
  const filePath = extractEditedFilePath(params.input, projectFolder);
  const cursorVersion = getCursorVersion(params.input);
  const args = [
    "--entity",
    filePath ?? projectFolder,
    "--entity-type",
    filePath ? "file" : "app",
    "--category",
    "ai coding",
    "--plugin",
    pluginName(cursorVersion, params.pluginVersion),
    "--project-folder",
    projectFolder
  ];
  if (!filePath) {
    args.push("--project", path2.basename(projectFolder));
  }
  args.push("--heartbeat-rate-limit-seconds", "0", "--sync-ai-disabled");
  if (filePath && isWriteEvent(params.input)) {
    args.push("--write");
  }
  return args;
}
function pluginName(cursorVersion, pluginVersion) {
  return `cursor-cli/${cursorVersion} cursor-cli-wakatime/${pluginVersion}`;
}
function extractEditedFilePath(input, projectFolder) {
  if (!shouldExtractFilePath(input)) return;
  const values = [...extractPathValues(input), ...extractPathValues(input.tool_input)];
  const filePath = values.find((value) => value.trim());
  if (!filePath) return;
  return path2.isAbsolute(filePath) ? path2.normalize(filePath) : path2.normalize(path2.join(projectFolder, filePath));
}
function shouldExtractFilePath(input) {
  const eventName = input.hook_event_name.toLowerCase();
  return eventName === "afterfileedit" || eventName === "posttooluse" && isWriteEvent(input);
}
function isWriteEvent(input) {
  return WRITE_TOOL_NAMES.has(normalizeToolName(input.tool_name));
}
function normalizeToolName(toolName) {
  return (toolName ?? "").replace(/[^A-Za-z0-9_]/g, "").toLowerCase();
}
function extractPathValues(input) {
  if (!input) return [];
  const values = [];
  for (const key of PATH_KEYS) {
    const value = input[key];
    if (typeof value === "string") {
      values.push(value);
    }
  }
  for (const key of ["paths", "files"]) {
    const value = input[key];
    if (Array.isArray(value)) {
      values.push(...value.filter((item) => typeof item === "string"));
    }
  }
  return values;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  buildDirectHeartbeatArgs,
  buildSyncAIActivityArgs
});
