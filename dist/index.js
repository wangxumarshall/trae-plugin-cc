#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// src/utils.ts
var import_child_process4 = require("child_process");
var import_util = require("util");
var fs4 = __toESM(require("fs"));
var path4 = __toESM(require("path"));

// src/utils/session-reader.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var os = __toESM(require("os"));
var SessionReader = class {
  sessionsDir;
  historyFile;
  jsonOutputCache = /* @__PURE__ */ new Map();
  constructor() {
    const homeDir = os.homedir();
    const candidates = [
      path.join(homeDir, "Library", "Caches", "trae-cli"),
      path.join(homeDir, "Library", "Caches", "trae_cli"),
      path.join(homeDir, ".cache", "trae-cli"),
      path.join(homeDir, ".cache", "trae_cli")
    ];
    const cacheDir = candidates.find((dir) => fs.existsSync(dir)) || candidates[0];
    this.sessionsDir = path.join(cacheDir, "sessions");
    this.historyFile = path.join(cacheDir, "history.jsonl");
  }
  listSessions(options) {
    if (!fs.existsSync(this.sessionsDir)) return [];
    const sessions2 = fs.readdirSync(this.sessionsDir).filter((dir) => {
      const sessionFile = path.join(this.sessionsDir, dir, "session.json");
      return fs.existsSync(sessionFile);
    }).map((dir) => {
      try {
        const content = fs.readFileSync(
          path.join(this.sessionsDir, dir, "session.json"),
          "utf-8"
        );
        return JSON.parse(content);
      } catch {
        return null;
      }
    }).filter((s) => s !== null).sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    let filtered = sessions2;
    if (options?.cwd) {
      filtered = filtered.filter((s) => s.metadata.cwd === options.cwd);
    }
    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }
    return filtered;
  }
  getSession(sessionId) {
    const filePath = path.join(this.sessionsDir, sessionId, "session.json");
    if (!fs.existsSync(filePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      return null;
    }
  }
  getEvents(sessionId) {
    const filePath = path.join(this.sessionsDir, sessionId, "events.jsonl");
    if (!fs.existsSync(filePath)) return [];
    const lines = fs.readFileSync(filePath, "utf-8").split("\n");
    return lines.filter((line) => line.trim()).map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter((e) => e !== null);
  }
  getConversation(sessionId, options) {
    const events = this.getEvents(sessionId);
    let messages = events.filter((e) => e.message).map((e) => {
      const msg = e.message.message;
      let content = "";
      if (typeof msg.content === "string") {
        content = msg.content;
      } else if (Array.isArray(msg.content)) {
        content = msg.content.map((c) => c.text || "").join("\n");
      }
      return {
        role: msg.role,
        content,
        toolCalls: msg.tool_calls?.map((tc) => tc.function.name),
        timestamp: e.created_at
      };
    });
    if (options?.limit) {
      messages = messages.slice(-options.limit);
    }
    return messages;
  }
  getToolCalls(sessionId) {
    const events = this.getEvents(sessionId);
    const callMap = /* @__PURE__ */ new Map();
    for (const e of events) {
      if (e.tool_call) {
        callMap.set(e.tool_call.tool_call_id, {
          id: e.tool_call.tool_call_id,
          name: e.tool_call.tool_info.name,
          input: e.tool_call.input,
          timestamp: e.created_at
        });
      }
    }
    for (const e of events) {
      if (e.tool_call_output) {
        const call = callMap.get(e.tool_call_output.tool_call_id);
        if (call) {
          call.output = e.tool_call_output.output;
          call.isError = e.tool_call_output.is_error;
        }
      }
    }
    return Array.from(callMap.values());
  }
  getFileTrackStatus(sessionId) {
    const events = this.getEvents(sessionId);
    for (const e of events) {
      if (e.state_update?.updates?.file_track_status) {
        return e.state_update.updates.file_track_status;
      }
    }
    return {};
  }
  getRecentSession(cwd) {
    const sessions2 = this.listSessions({ cwd });
    return sessions2[0] || null;
  }
  findSessionByTopic(topic) {
    const sessions2 = this.listSessions();
    const match = sessions2.find(
      (s) => s.metadata.title.toLowerCase().includes(topic.toLowerCase())
    );
    return match || null;
  }
  getContextSummary(sessionId) {
    const meta = this.getSession(sessionId);
    if (!meta) return "\u4F1A\u8BDD\u4E0D\u5B58\u5728";
    const conversation = this.getConversation(sessionId, { limit: 20 });
    const toolCalls = this.getToolCalls(sessionId);
    let summary = `## \u4F1A\u8BDD: ${meta.metadata.title}
`;
    summary += `- ID: ${meta.id}
`;
    summary += `- \u5DE5\u4F5C\u76EE\u5F55: ${meta.metadata.cwd}
`;
    summary += `- \u6A21\u578B: ${meta.metadata.model_name}
`;
    summary += `- \u6743\u9650\u6A21\u5F0F: ${meta.metadata.permission_mode}
`;
    summary += `- \u521B\u5EFA\u65F6\u95F4: ${meta.created_at}
`;
    summary += `- \u66F4\u65B0\u65F6\u95F4: ${meta.updated_at}

`;
    summary += `### \u6700\u8FD1\u5BF9\u8BDD (${conversation.length} \u6761\u6D88\u606F)
`;
    for (const msg of conversation) {
      const content = msg.content.length > 200 ? msg.content.substring(0, 200) + "..." : msg.content;
      summary += `**${msg.role}**: ${content}`;
      if (msg.toolCalls?.length) {
        summary += ` [\u8C03\u7528\u5DE5\u5177: ${msg.toolCalls.join(", ")}]`;
      }
      summary += "\n\n";
    }
    summary += `### \u5DE5\u5177\u8C03\u7528\u7EDF\u8BA1 (${toolCalls.length} \u6B21)
`;
    const toolStats = {};
    for (const tc of toolCalls) {
      toolStats[tc.name] = (toolStats[tc.name] || 0) + 1;
    }
    for (const [name, count] of Object.entries(toolStats)) {
      summary += `- ${name}: ${count} \u6B21
`;
    }
    return summary;
  }
  getHistory() {
    if (!fs.existsSync(this.historyFile)) return [];
    const lines = fs.readFileSync(this.historyFile, "utf-8").split("\n");
    return lines.filter((line) => line.trim()).map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter((h) => h !== null);
  }
  deleteSession(sessionId) {
    const sessionDir = path.join(this.sessionsDir, sessionId);
    if (!fs.existsSync(sessionDir)) return false;
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }
  cacheJsonOutput(sessionId, output) {
    this.jsonOutputCache.set(sessionId, output);
  }
  getJsonOutputSession(sessionId) {
    return this.jsonOutputCache.get(sessionId) || null;
  }
  getSessionsDir() {
    return this.sessionsDir;
  }
};

// src/utils/auth-bridge.ts
var import_child_process = require("child_process");
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));
var os2 = __toESM(require("os"));

// node_modules/js-yaml/dist/js-yaml.mjs
function isNothing(subject) {
  return typeof subject === "undefined" || subject === null;
}
function isObject(subject) {
  return typeof subject === "object" && subject !== null;
}
function toArray(sequence) {
  if (Array.isArray(sequence)) return sequence;
  else if (isNothing(sequence)) return [];
  return [sequence];
}
function extend(target, source) {
  var index, length, key, sourceKeys;
  if (source) {
    sourceKeys = Object.keys(source);
    for (index = 0, length = sourceKeys.length; index < length; index += 1) {
      key = sourceKeys[index];
      target[key] = source[key];
    }
  }
  return target;
}
function repeat(string, count) {
  var result2 = "", cycle;
  for (cycle = 0; cycle < count; cycle += 1) {
    result2 += string;
  }
  return result2;
}
function isNegativeZero(number) {
  return number === 0 && Number.NEGATIVE_INFINITY === 1 / number;
}
var isNothing_1 = isNothing;
var isObject_1 = isObject;
var toArray_1 = toArray;
var repeat_1 = repeat;
var isNegativeZero_1 = isNegativeZero;
var extend_1 = extend;
var common = {
  isNothing: isNothing_1,
  isObject: isObject_1,
  toArray: toArray_1,
  repeat: repeat_1,
  isNegativeZero: isNegativeZero_1,
  extend: extend_1
};
function formatError(exception2, compact) {
  var where = "", message = exception2.reason || "(unknown reason)";
  if (!exception2.mark) return message;
  if (exception2.mark.name) {
    where += 'in "' + exception2.mark.name + '" ';
  }
  where += "(" + (exception2.mark.line + 1) + ":" + (exception2.mark.column + 1) + ")";
  if (!compact && exception2.mark.snippet) {
    where += "\n\n" + exception2.mark.snippet;
  }
  return message + " " + where;
}
function YAMLException$1(reason, mark) {
  Error.call(this);
  this.name = "YAMLException";
  this.reason = reason;
  this.mark = mark;
  this.message = formatError(this, false);
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, this.constructor);
  } else {
    this.stack = new Error().stack || "";
  }
}
YAMLException$1.prototype = Object.create(Error.prototype);
YAMLException$1.prototype.constructor = YAMLException$1;
YAMLException$1.prototype.toString = function toString(compact) {
  return this.name + ": " + formatError(this, compact);
};
var exception = YAMLException$1;
function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
  var head = "";
  var tail = "";
  var maxHalfLength = Math.floor(maxLineLength / 2) - 1;
  if (position - lineStart > maxHalfLength) {
    head = " ... ";
    lineStart = position - maxHalfLength + head.length;
  }
  if (lineEnd - position > maxHalfLength) {
    tail = " ...";
    lineEnd = position + maxHalfLength - tail.length;
  }
  return {
    str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, "\u2192") + tail,
    pos: position - lineStart + head.length
    // relative position
  };
}
function padStart(string, max) {
  return common.repeat(" ", max - string.length) + string;
}
function makeSnippet(mark, options) {
  options = Object.create(options || null);
  if (!mark.buffer) return null;
  if (!options.maxLength) options.maxLength = 79;
  if (typeof options.indent !== "number") options.indent = 1;
  if (typeof options.linesBefore !== "number") options.linesBefore = 3;
  if (typeof options.linesAfter !== "number") options.linesAfter = 2;
  var re = /\r?\n|\r|\0/g;
  var lineStarts = [0];
  var lineEnds = [];
  var match;
  var foundLineNo = -1;
  while (match = re.exec(mark.buffer)) {
    lineEnds.push(match.index);
    lineStarts.push(match.index + match[0].length);
    if (mark.position <= match.index && foundLineNo < 0) {
      foundLineNo = lineStarts.length - 2;
    }
  }
  if (foundLineNo < 0) foundLineNo = lineStarts.length - 1;
  var result2 = "", i, line;
  var lineNoLength = Math.min(mark.line + options.linesAfter, lineEnds.length).toString().length;
  var maxLineLength = options.maxLength - (options.indent + lineNoLength + 3);
  for (i = 1; i <= options.linesBefore; i++) {
    if (foundLineNo - i < 0) break;
    line = getLine(
      mark.buffer,
      lineStarts[foundLineNo - i],
      lineEnds[foundLineNo - i],
      mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]),
      maxLineLength
    );
    result2 = common.repeat(" ", options.indent) + padStart((mark.line - i + 1).toString(), lineNoLength) + " | " + line.str + "\n" + result2;
  }
  line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
  result2 += common.repeat(" ", options.indent) + padStart((mark.line + 1).toString(), lineNoLength) + " | " + line.str + "\n";
  result2 += common.repeat("-", options.indent + lineNoLength + 3 + line.pos) + "^\n";
  for (i = 1; i <= options.linesAfter; i++) {
    if (foundLineNo + i >= lineEnds.length) break;
    line = getLine(
      mark.buffer,
      lineStarts[foundLineNo + i],
      lineEnds[foundLineNo + i],
      mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]),
      maxLineLength
    );
    result2 += common.repeat(" ", options.indent) + padStart((mark.line + i + 1).toString(), lineNoLength) + " | " + line.str + "\n";
  }
  return result2.replace(/\n$/, "");
}
var snippet = makeSnippet;
var TYPE_CONSTRUCTOR_OPTIONS = [
  "kind",
  "multi",
  "resolve",
  "construct",
  "instanceOf",
  "predicate",
  "represent",
  "representName",
  "defaultStyle",
  "styleAliases"
];
var YAML_NODE_KINDS = [
  "scalar",
  "sequence",
  "mapping"
];
function compileStyleAliases(map2) {
  var result2 = {};
  if (map2 !== null) {
    Object.keys(map2).forEach(function(style) {
      map2[style].forEach(function(alias) {
        result2[String(alias)] = style;
      });
    });
  }
  return result2;
}
function Type$1(tag, options) {
  options = options || {};
  Object.keys(options).forEach(function(name) {
    if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) {
      throw new exception('Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.');
    }
  });
  this.options = options;
  this.tag = tag;
  this.kind = options["kind"] || null;
  this.resolve = options["resolve"] || function() {
    return true;
  };
  this.construct = options["construct"] || function(data) {
    return data;
  };
  this.instanceOf = options["instanceOf"] || null;
  this.predicate = options["predicate"] || null;
  this.represent = options["represent"] || null;
  this.representName = options["representName"] || null;
  this.defaultStyle = options["defaultStyle"] || null;
  this.multi = options["multi"] || false;
  this.styleAliases = compileStyleAliases(options["styleAliases"] || null);
  if (YAML_NODE_KINDS.indexOf(this.kind) === -1) {
    throw new exception('Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.');
  }
}
var type = Type$1;
function compileList(schema2, name) {
  var result2 = [];
  schema2[name].forEach(function(currentType) {
    var newIndex = result2.length;
    result2.forEach(function(previousType, previousIndex) {
      if (previousType.tag === currentType.tag && previousType.kind === currentType.kind && previousType.multi === currentType.multi) {
        newIndex = previousIndex;
      }
    });
    result2[newIndex] = currentType;
  });
  return result2;
}
function compileMap() {
  var result2 = {
    scalar: {},
    sequence: {},
    mapping: {},
    fallback: {},
    multi: {
      scalar: [],
      sequence: [],
      mapping: [],
      fallback: []
    }
  }, index, length;
  function collectType(type2) {
    if (type2.multi) {
      result2.multi[type2.kind].push(type2);
      result2.multi["fallback"].push(type2);
    } else {
      result2[type2.kind][type2.tag] = result2["fallback"][type2.tag] = type2;
    }
  }
  for (index = 0, length = arguments.length; index < length; index += 1) {
    arguments[index].forEach(collectType);
  }
  return result2;
}
function Schema$1(definition) {
  return this.extend(definition);
}
Schema$1.prototype.extend = function extend2(definition) {
  var implicit = [];
  var explicit = [];
  if (definition instanceof type) {
    explicit.push(definition);
  } else if (Array.isArray(definition)) {
    explicit = explicit.concat(definition);
  } else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
    if (definition.implicit) implicit = implicit.concat(definition.implicit);
    if (definition.explicit) explicit = explicit.concat(definition.explicit);
  } else {
    throw new exception("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
  }
  implicit.forEach(function(type$1) {
    if (!(type$1 instanceof type)) {
      throw new exception("Specified list of YAML types (or a single Type object) contains a non-Type object.");
    }
    if (type$1.loadKind && type$1.loadKind !== "scalar") {
      throw new exception("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
    }
    if (type$1.multi) {
      throw new exception("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
    }
  });
  explicit.forEach(function(type$1) {
    if (!(type$1 instanceof type)) {
      throw new exception("Specified list of YAML types (or a single Type object) contains a non-Type object.");
    }
  });
  var result2 = Object.create(Schema$1.prototype);
  result2.implicit = (this.implicit || []).concat(implicit);
  result2.explicit = (this.explicit || []).concat(explicit);
  result2.compiledImplicit = compileList(result2, "implicit");
  result2.compiledExplicit = compileList(result2, "explicit");
  result2.compiledTypeMap = compileMap(result2.compiledImplicit, result2.compiledExplicit);
  return result2;
};
var schema = Schema$1;
var str = new type("tag:yaml.org,2002:str", {
  kind: "scalar",
  construct: function(data) {
    return data !== null ? data : "";
  }
});
var seq = new type("tag:yaml.org,2002:seq", {
  kind: "sequence",
  construct: function(data) {
    return data !== null ? data : [];
  }
});
var map = new type("tag:yaml.org,2002:map", {
  kind: "mapping",
  construct: function(data) {
    return data !== null ? data : {};
  }
});
var failsafe = new schema({
  explicit: [
    str,
    seq,
    map
  ]
});
function resolveYamlNull(data) {
  if (data === null) return true;
  var max = data.length;
  return max === 1 && data === "~" || max === 4 && (data === "null" || data === "Null" || data === "NULL");
}
function constructYamlNull() {
  return null;
}
function isNull(object) {
  return object === null;
}
var _null = new type("tag:yaml.org,2002:null", {
  kind: "scalar",
  resolve: resolveYamlNull,
  construct: constructYamlNull,
  predicate: isNull,
  represent: {
    canonical: function() {
      return "~";
    },
    lowercase: function() {
      return "null";
    },
    uppercase: function() {
      return "NULL";
    },
    camelcase: function() {
      return "Null";
    },
    empty: function() {
      return "";
    }
  },
  defaultStyle: "lowercase"
});
function resolveYamlBoolean(data) {
  if (data === null) return false;
  var max = data.length;
  return max === 4 && (data === "true" || data === "True" || data === "TRUE") || max === 5 && (data === "false" || data === "False" || data === "FALSE");
}
function constructYamlBoolean(data) {
  return data === "true" || data === "True" || data === "TRUE";
}
function isBoolean(object) {
  return Object.prototype.toString.call(object) === "[object Boolean]";
}
var bool = new type("tag:yaml.org,2002:bool", {
  kind: "scalar",
  resolve: resolveYamlBoolean,
  construct: constructYamlBoolean,
  predicate: isBoolean,
  represent: {
    lowercase: function(object) {
      return object ? "true" : "false";
    },
    uppercase: function(object) {
      return object ? "TRUE" : "FALSE";
    },
    camelcase: function(object) {
      return object ? "True" : "False";
    }
  },
  defaultStyle: "lowercase"
});
function isHexCode(c) {
  return 48 <= c && c <= 57 || 65 <= c && c <= 70 || 97 <= c && c <= 102;
}
function isOctCode(c) {
  return 48 <= c && c <= 55;
}
function isDecCode(c) {
  return 48 <= c && c <= 57;
}
function resolveYamlInteger(data) {
  if (data === null) return false;
  var max = data.length, index = 0, hasDigits = false, ch;
  if (!max) return false;
  ch = data[index];
  if (ch === "-" || ch === "+") {
    ch = data[++index];
  }
  if (ch === "0") {
    if (index + 1 === max) return true;
    ch = data[++index];
    if (ch === "b") {
      index++;
      for (; index < max; index++) {
        ch = data[index];
        if (ch === "_") continue;
        if (ch !== "0" && ch !== "1") return false;
        hasDigits = true;
      }
      return hasDigits && ch !== "_";
    }
    if (ch === "x") {
      index++;
      for (; index < max; index++) {
        ch = data[index];
        if (ch === "_") continue;
        if (!isHexCode(data.charCodeAt(index))) return false;
        hasDigits = true;
      }
      return hasDigits && ch !== "_";
    }
    if (ch === "o") {
      index++;
      for (; index < max; index++) {
        ch = data[index];
        if (ch === "_") continue;
        if (!isOctCode(data.charCodeAt(index))) return false;
        hasDigits = true;
      }
      return hasDigits && ch !== "_";
    }
  }
  if (ch === "_") return false;
  for (; index < max; index++) {
    ch = data[index];
    if (ch === "_") continue;
    if (!isDecCode(data.charCodeAt(index))) {
      return false;
    }
    hasDigits = true;
  }
  if (!hasDigits || ch === "_") return false;
  return true;
}
function constructYamlInteger(data) {
  var value = data, sign = 1, ch;
  if (value.indexOf("_") !== -1) {
    value = value.replace(/_/g, "");
  }
  ch = value[0];
  if (ch === "-" || ch === "+") {
    if (ch === "-") sign = -1;
    value = value.slice(1);
    ch = value[0];
  }
  if (value === "0") return 0;
  if (ch === "0") {
    if (value[1] === "b") return sign * parseInt(value.slice(2), 2);
    if (value[1] === "x") return sign * parseInt(value.slice(2), 16);
    if (value[1] === "o") return sign * parseInt(value.slice(2), 8);
  }
  return sign * parseInt(value, 10);
}
function isInteger(object) {
  return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 === 0 && !common.isNegativeZero(object));
}
var int = new type("tag:yaml.org,2002:int", {
  kind: "scalar",
  resolve: resolveYamlInteger,
  construct: constructYamlInteger,
  predicate: isInteger,
  represent: {
    binary: function(obj) {
      return obj >= 0 ? "0b" + obj.toString(2) : "-0b" + obj.toString(2).slice(1);
    },
    octal: function(obj) {
      return obj >= 0 ? "0o" + obj.toString(8) : "-0o" + obj.toString(8).slice(1);
    },
    decimal: function(obj) {
      return obj.toString(10);
    },
    /* eslint-disable max-len */
    hexadecimal: function(obj) {
      return obj >= 0 ? "0x" + obj.toString(16).toUpperCase() : "-0x" + obj.toString(16).toUpperCase().slice(1);
    }
  },
  defaultStyle: "decimal",
  styleAliases: {
    binary: [2, "bin"],
    octal: [8, "oct"],
    decimal: [10, "dec"],
    hexadecimal: [16, "hex"]
  }
});
var YAML_FLOAT_PATTERN = new RegExp(
  // 2.5e4, 2.5 and integers
  "^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
);
function resolveYamlFloat(data) {
  if (data === null) return false;
  if (!YAML_FLOAT_PATTERN.test(data) || // Quick hack to not allow integers end with `_`
  // Probably should update regexp & check speed
  data[data.length - 1] === "_") {
    return false;
  }
  return true;
}
function constructYamlFloat(data) {
  var value, sign;
  value = data.replace(/_/g, "").toLowerCase();
  sign = value[0] === "-" ? -1 : 1;
  if ("+-".indexOf(value[0]) >= 0) {
    value = value.slice(1);
  }
  if (value === ".inf") {
    return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  } else if (value === ".nan") {
    return NaN;
  }
  return sign * parseFloat(value, 10);
}
var SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
function representYamlFloat(object, style) {
  var res;
  if (isNaN(object)) {
    switch (style) {
      case "lowercase":
        return ".nan";
      case "uppercase":
        return ".NAN";
      case "camelcase":
        return ".NaN";
    }
  } else if (Number.POSITIVE_INFINITY === object) {
    switch (style) {
      case "lowercase":
        return ".inf";
      case "uppercase":
        return ".INF";
      case "camelcase":
        return ".Inf";
    }
  } else if (Number.NEGATIVE_INFINITY === object) {
    switch (style) {
      case "lowercase":
        return "-.inf";
      case "uppercase":
        return "-.INF";
      case "camelcase":
        return "-.Inf";
    }
  } else if (common.isNegativeZero(object)) {
    return "-0.0";
  }
  res = object.toString(10);
  return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace("e", ".e") : res;
}
function isFloat(object) {
  return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 !== 0 || common.isNegativeZero(object));
}
var float = new type("tag:yaml.org,2002:float", {
  kind: "scalar",
  resolve: resolveYamlFloat,
  construct: constructYamlFloat,
  predicate: isFloat,
  represent: representYamlFloat,
  defaultStyle: "lowercase"
});
var json = failsafe.extend({
  implicit: [
    _null,
    bool,
    int,
    float
  ]
});
var core = json;
var YAML_DATE_REGEXP = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"
);
var YAML_TIMESTAMP_REGEXP = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$"
);
function resolveYamlTimestamp(data) {
  if (data === null) return false;
  if (YAML_DATE_REGEXP.exec(data) !== null) return true;
  if (YAML_TIMESTAMP_REGEXP.exec(data) !== null) return true;
  return false;
}
function constructYamlTimestamp(data) {
  var match, year, month, day, hour, minute, second, fraction = 0, delta = null, tz_hour, tz_minute, date;
  match = YAML_DATE_REGEXP.exec(data);
  if (match === null) match = YAML_TIMESTAMP_REGEXP.exec(data);
  if (match === null) throw new Error("Date resolve error");
  year = +match[1];
  month = +match[2] - 1;
  day = +match[3];
  if (!match[4]) {
    return new Date(Date.UTC(year, month, day));
  }
  hour = +match[4];
  minute = +match[5];
  second = +match[6];
  if (match[7]) {
    fraction = match[7].slice(0, 3);
    while (fraction.length < 3) {
      fraction += "0";
    }
    fraction = +fraction;
  }
  if (match[9]) {
    tz_hour = +match[10];
    tz_minute = +(match[11] || 0);
    delta = (tz_hour * 60 + tz_minute) * 6e4;
    if (match[9] === "-") delta = -delta;
  }
  date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
  if (delta) date.setTime(date.getTime() - delta);
  return date;
}
function representYamlTimestamp(object) {
  return object.toISOString();
}
var timestamp = new type("tag:yaml.org,2002:timestamp", {
  kind: "scalar",
  resolve: resolveYamlTimestamp,
  construct: constructYamlTimestamp,
  instanceOf: Date,
  represent: representYamlTimestamp
});
function resolveYamlMerge(data) {
  return data === "<<" || data === null;
}
var merge = new type("tag:yaml.org,2002:merge", {
  kind: "scalar",
  resolve: resolveYamlMerge
});
var BASE64_MAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r";
function resolveYamlBinary(data) {
  if (data === null) return false;
  var code, idx, bitlen = 0, max = data.length, map2 = BASE64_MAP;
  for (idx = 0; idx < max; idx++) {
    code = map2.indexOf(data.charAt(idx));
    if (code > 64) continue;
    if (code < 0) return false;
    bitlen += 6;
  }
  return bitlen % 8 === 0;
}
function constructYamlBinary(data) {
  var idx, tailbits, input = data.replace(/[\r\n=]/g, ""), max = input.length, map2 = BASE64_MAP, bits = 0, result2 = [];
  for (idx = 0; idx < max; idx++) {
    if (idx % 4 === 0 && idx) {
      result2.push(bits >> 16 & 255);
      result2.push(bits >> 8 & 255);
      result2.push(bits & 255);
    }
    bits = bits << 6 | map2.indexOf(input.charAt(idx));
  }
  tailbits = max % 4 * 6;
  if (tailbits === 0) {
    result2.push(bits >> 16 & 255);
    result2.push(bits >> 8 & 255);
    result2.push(bits & 255);
  } else if (tailbits === 18) {
    result2.push(bits >> 10 & 255);
    result2.push(bits >> 2 & 255);
  } else if (tailbits === 12) {
    result2.push(bits >> 4 & 255);
  }
  return new Uint8Array(result2);
}
function representYamlBinary(object) {
  var result2 = "", bits = 0, idx, tail, max = object.length, map2 = BASE64_MAP;
  for (idx = 0; idx < max; idx++) {
    if (idx % 3 === 0 && idx) {
      result2 += map2[bits >> 18 & 63];
      result2 += map2[bits >> 12 & 63];
      result2 += map2[bits >> 6 & 63];
      result2 += map2[bits & 63];
    }
    bits = (bits << 8) + object[idx];
  }
  tail = max % 3;
  if (tail === 0) {
    result2 += map2[bits >> 18 & 63];
    result2 += map2[bits >> 12 & 63];
    result2 += map2[bits >> 6 & 63];
    result2 += map2[bits & 63];
  } else if (tail === 2) {
    result2 += map2[bits >> 10 & 63];
    result2 += map2[bits >> 4 & 63];
    result2 += map2[bits << 2 & 63];
    result2 += map2[64];
  } else if (tail === 1) {
    result2 += map2[bits >> 2 & 63];
    result2 += map2[bits << 4 & 63];
    result2 += map2[64];
    result2 += map2[64];
  }
  return result2;
}
function isBinary(obj) {
  return Object.prototype.toString.call(obj) === "[object Uint8Array]";
}
var binary = new type("tag:yaml.org,2002:binary", {
  kind: "scalar",
  resolve: resolveYamlBinary,
  construct: constructYamlBinary,
  predicate: isBinary,
  represent: representYamlBinary
});
var _hasOwnProperty$3 = Object.prototype.hasOwnProperty;
var _toString$2 = Object.prototype.toString;
function resolveYamlOmap(data) {
  if (data === null) return true;
  var objectKeys = [], index, length, pair, pairKey, pairHasKey, object = data;
  for (index = 0, length = object.length; index < length; index += 1) {
    pair = object[index];
    pairHasKey = false;
    if (_toString$2.call(pair) !== "[object Object]") return false;
    for (pairKey in pair) {
      if (_hasOwnProperty$3.call(pair, pairKey)) {
        if (!pairHasKey) pairHasKey = true;
        else return false;
      }
    }
    if (!pairHasKey) return false;
    if (objectKeys.indexOf(pairKey) === -1) objectKeys.push(pairKey);
    else return false;
  }
  return true;
}
function constructYamlOmap(data) {
  return data !== null ? data : [];
}
var omap = new type("tag:yaml.org,2002:omap", {
  kind: "sequence",
  resolve: resolveYamlOmap,
  construct: constructYamlOmap
});
var _toString$1 = Object.prototype.toString;
function resolveYamlPairs(data) {
  if (data === null) return true;
  var index, length, pair, keys, result2, object = data;
  result2 = new Array(object.length);
  for (index = 0, length = object.length; index < length; index += 1) {
    pair = object[index];
    if (_toString$1.call(pair) !== "[object Object]") return false;
    keys = Object.keys(pair);
    if (keys.length !== 1) return false;
    result2[index] = [keys[0], pair[keys[0]]];
  }
  return true;
}
function constructYamlPairs(data) {
  if (data === null) return [];
  var index, length, pair, keys, result2, object = data;
  result2 = new Array(object.length);
  for (index = 0, length = object.length; index < length; index += 1) {
    pair = object[index];
    keys = Object.keys(pair);
    result2[index] = [keys[0], pair[keys[0]]];
  }
  return result2;
}
var pairs = new type("tag:yaml.org,2002:pairs", {
  kind: "sequence",
  resolve: resolveYamlPairs,
  construct: constructYamlPairs
});
var _hasOwnProperty$2 = Object.prototype.hasOwnProperty;
function resolveYamlSet(data) {
  if (data === null) return true;
  var key, object = data;
  for (key in object) {
    if (_hasOwnProperty$2.call(object, key)) {
      if (object[key] !== null) return false;
    }
  }
  return true;
}
function constructYamlSet(data) {
  return data !== null ? data : {};
}
var set = new type("tag:yaml.org,2002:set", {
  kind: "mapping",
  resolve: resolveYamlSet,
  construct: constructYamlSet
});
var _default = core.extend({
  implicit: [
    timestamp,
    merge
  ],
  explicit: [
    binary,
    omap,
    pairs,
    set
  ]
});
var _hasOwnProperty$1 = Object.prototype.hasOwnProperty;
var CONTEXT_FLOW_IN = 1;
var CONTEXT_FLOW_OUT = 2;
var CONTEXT_BLOCK_IN = 3;
var CONTEXT_BLOCK_OUT = 4;
var CHOMPING_CLIP = 1;
var CHOMPING_STRIP = 2;
var CHOMPING_KEEP = 3;
var PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
var PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
var PATTERN_FLOW_INDICATORS = /[,\[\]\{\}]/;
var PATTERN_TAG_HANDLE = /^(?:!|!!|![a-z\-]+!)$/i;
var PATTERN_TAG_URI = /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;
function _class(obj) {
  return Object.prototype.toString.call(obj);
}
function is_EOL(c) {
  return c === 10 || c === 13;
}
function is_WHITE_SPACE(c) {
  return c === 9 || c === 32;
}
function is_WS_OR_EOL(c) {
  return c === 9 || c === 32 || c === 10 || c === 13;
}
function is_FLOW_INDICATOR(c) {
  return c === 44 || c === 91 || c === 93 || c === 123 || c === 125;
}
function fromHexCode(c) {
  var lc;
  if (48 <= c && c <= 57) {
    return c - 48;
  }
  lc = c | 32;
  if (97 <= lc && lc <= 102) {
    return lc - 97 + 10;
  }
  return -1;
}
function escapedHexLen(c) {
  if (c === 120) {
    return 2;
  }
  if (c === 117) {
    return 4;
  }
  if (c === 85) {
    return 8;
  }
  return 0;
}
function fromDecimalCode(c) {
  if (48 <= c && c <= 57) {
    return c - 48;
  }
  return -1;
}
function simpleEscapeSequence(c) {
  return c === 48 ? "\0" : c === 97 ? "\x07" : c === 98 ? "\b" : c === 116 ? "	" : c === 9 ? "	" : c === 110 ? "\n" : c === 118 ? "\v" : c === 102 ? "\f" : c === 114 ? "\r" : c === 101 ? "\x1B" : c === 32 ? " " : c === 34 ? '"' : c === 47 ? "/" : c === 92 ? "\\" : c === 78 ? "\x85" : c === 95 ? "\xA0" : c === 76 ? "\u2028" : c === 80 ? "\u2029" : "";
}
function charFromCodepoint(c) {
  if (c <= 65535) {
    return String.fromCharCode(c);
  }
  return String.fromCharCode(
    (c - 65536 >> 10) + 55296,
    (c - 65536 & 1023) + 56320
  );
}
function setProperty(object, key, value) {
  if (key === "__proto__") {
    Object.defineProperty(object, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value
    });
  } else {
    object[key] = value;
  }
}
var simpleEscapeCheck = new Array(256);
var simpleEscapeMap = new Array(256);
for (i = 0; i < 256; i++) {
  simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
  simpleEscapeMap[i] = simpleEscapeSequence(i);
}
var i;
function State$1(input, options) {
  this.input = input;
  this.filename = options["filename"] || null;
  this.schema = options["schema"] || _default;
  this.onWarning = options["onWarning"] || null;
  this.legacy = options["legacy"] || false;
  this.json = options["json"] || false;
  this.listener = options["listener"] || null;
  this.implicitTypes = this.schema.compiledImplicit;
  this.typeMap = this.schema.compiledTypeMap;
  this.length = input.length;
  this.position = 0;
  this.line = 0;
  this.lineStart = 0;
  this.lineIndent = 0;
  this.firstTabInLine = -1;
  this.documents = [];
}
function generateError(state, message) {
  var mark = {
    name: state.filename,
    buffer: state.input.slice(0, -1),
    // omit trailing \0
    position: state.position,
    line: state.line,
    column: state.position - state.lineStart
  };
  mark.snippet = snippet(mark);
  return new exception(message, mark);
}
function throwError(state, message) {
  throw generateError(state, message);
}
function throwWarning(state, message) {
  if (state.onWarning) {
    state.onWarning.call(null, generateError(state, message));
  }
}
var directiveHandlers = {
  YAML: function handleYamlDirective(state, name, args) {
    var match, major, minor;
    if (state.version !== null) {
      throwError(state, "duplication of %YAML directive");
    }
    if (args.length !== 1) {
      throwError(state, "YAML directive accepts exactly one argument");
    }
    match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
    if (match === null) {
      throwError(state, "ill-formed argument of the YAML directive");
    }
    major = parseInt(match[1], 10);
    minor = parseInt(match[2], 10);
    if (major !== 1) {
      throwError(state, "unacceptable YAML version of the document");
    }
    state.version = args[0];
    state.checkLineBreaks = minor < 2;
    if (minor !== 1 && minor !== 2) {
      throwWarning(state, "unsupported YAML version of the document");
    }
  },
  TAG: function handleTagDirective(state, name, args) {
    var handle, prefix;
    if (args.length !== 2) {
      throwError(state, "TAG directive accepts exactly two arguments");
    }
    handle = args[0];
    prefix = args[1];
    if (!PATTERN_TAG_HANDLE.test(handle)) {
      throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
    }
    if (_hasOwnProperty$1.call(state.tagMap, handle)) {
      throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
    }
    if (!PATTERN_TAG_URI.test(prefix)) {
      throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
    }
    try {
      prefix = decodeURIComponent(prefix);
    } catch (err) {
      throwError(state, "tag prefix is malformed: " + prefix);
    }
    state.tagMap[handle] = prefix;
  }
};
function captureSegment(state, start, end, checkJson) {
  var _position, _length, _character, _result;
  if (start < end) {
    _result = state.input.slice(start, end);
    if (checkJson) {
      for (_position = 0, _length = _result.length; _position < _length; _position += 1) {
        _character = _result.charCodeAt(_position);
        if (!(_character === 9 || 32 <= _character && _character <= 1114111)) {
          throwError(state, "expected valid JSON character");
        }
      }
    } else if (PATTERN_NON_PRINTABLE.test(_result)) {
      throwError(state, "the stream contains non-printable characters");
    }
    state.result += _result;
  }
}
function mergeMappings(state, destination, source, overridableKeys) {
  var sourceKeys, key, index, quantity;
  if (!common.isObject(source)) {
    throwError(state, "cannot merge mappings; the provided source object is unacceptable");
  }
  sourceKeys = Object.keys(source);
  for (index = 0, quantity = sourceKeys.length; index < quantity; index += 1) {
    key = sourceKeys[index];
    if (!_hasOwnProperty$1.call(destination, key)) {
      setProperty(destination, key, source[key]);
      overridableKeys[key] = true;
    }
  }
}
function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, startLine, startLineStart, startPos) {
  var index, quantity;
  if (Array.isArray(keyNode)) {
    keyNode = Array.prototype.slice.call(keyNode);
    for (index = 0, quantity = keyNode.length; index < quantity; index += 1) {
      if (Array.isArray(keyNode[index])) {
        throwError(state, "nested arrays are not supported inside keys");
      }
      if (typeof keyNode === "object" && _class(keyNode[index]) === "[object Object]") {
        keyNode[index] = "[object Object]";
      }
    }
  }
  if (typeof keyNode === "object" && _class(keyNode) === "[object Object]") {
    keyNode = "[object Object]";
  }
  keyNode = String(keyNode);
  if (_result === null) {
    _result = {};
  }
  if (keyTag === "tag:yaml.org,2002:merge") {
    if (Array.isArray(valueNode)) {
      for (index = 0, quantity = valueNode.length; index < quantity; index += 1) {
        mergeMappings(state, _result, valueNode[index], overridableKeys);
      }
    } else {
      mergeMappings(state, _result, valueNode, overridableKeys);
    }
  } else {
    if (!state.json && !_hasOwnProperty$1.call(overridableKeys, keyNode) && _hasOwnProperty$1.call(_result, keyNode)) {
      state.line = startLine || state.line;
      state.lineStart = startLineStart || state.lineStart;
      state.position = startPos || state.position;
      throwError(state, "duplicated mapping key");
    }
    setProperty(_result, keyNode, valueNode);
    delete overridableKeys[keyNode];
  }
  return _result;
}
function readLineBreak(state) {
  var ch;
  ch = state.input.charCodeAt(state.position);
  if (ch === 10) {
    state.position++;
  } else if (ch === 13) {
    state.position++;
    if (state.input.charCodeAt(state.position) === 10) {
      state.position++;
    }
  } else {
    throwError(state, "a line break is expected");
  }
  state.line += 1;
  state.lineStart = state.position;
  state.firstTabInLine = -1;
}
function skipSeparationSpace(state, allowComments, checkIndent) {
  var lineBreaks = 0, ch = state.input.charCodeAt(state.position);
  while (ch !== 0) {
    while (is_WHITE_SPACE(ch)) {
      if (ch === 9 && state.firstTabInLine === -1) {
        state.firstTabInLine = state.position;
      }
      ch = state.input.charCodeAt(++state.position);
    }
    if (allowComments && ch === 35) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (ch !== 10 && ch !== 13 && ch !== 0);
    }
    if (is_EOL(ch)) {
      readLineBreak(state);
      ch = state.input.charCodeAt(state.position);
      lineBreaks++;
      state.lineIndent = 0;
      while (ch === 32) {
        state.lineIndent++;
        ch = state.input.charCodeAt(++state.position);
      }
    } else {
      break;
    }
  }
  if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
    throwWarning(state, "deficient indentation");
  }
  return lineBreaks;
}
function testDocumentSeparator(state) {
  var _position = state.position, ch;
  ch = state.input.charCodeAt(_position);
  if ((ch === 45 || ch === 46) && ch === state.input.charCodeAt(_position + 1) && ch === state.input.charCodeAt(_position + 2)) {
    _position += 3;
    ch = state.input.charCodeAt(_position);
    if (ch === 0 || is_WS_OR_EOL(ch)) {
      return true;
    }
  }
  return false;
}
function writeFoldedLines(state, count) {
  if (count === 1) {
    state.result += " ";
  } else if (count > 1) {
    state.result += common.repeat("\n", count - 1);
  }
}
function readPlainScalar(state, nodeIndent, withinFlowCollection) {
  var preceding, following, captureStart, captureEnd, hasPendingContent, _line, _lineStart, _lineIndent, _kind = state.kind, _result = state.result, ch;
  ch = state.input.charCodeAt(state.position);
  if (is_WS_OR_EOL(ch) || is_FLOW_INDICATOR(ch) || ch === 35 || ch === 38 || ch === 42 || ch === 33 || ch === 124 || ch === 62 || ch === 39 || ch === 34 || ch === 37 || ch === 64 || ch === 96) {
    return false;
  }
  if (ch === 63 || ch === 45) {
    following = state.input.charCodeAt(state.position + 1);
    if (is_WS_OR_EOL(following) || withinFlowCollection && is_FLOW_INDICATOR(following)) {
      return false;
    }
  }
  state.kind = "scalar";
  state.result = "";
  captureStart = captureEnd = state.position;
  hasPendingContent = false;
  while (ch !== 0) {
    if (ch === 58) {
      following = state.input.charCodeAt(state.position + 1);
      if (is_WS_OR_EOL(following) || withinFlowCollection && is_FLOW_INDICATOR(following)) {
        break;
      }
    } else if (ch === 35) {
      preceding = state.input.charCodeAt(state.position - 1);
      if (is_WS_OR_EOL(preceding)) {
        break;
      }
    } else if (state.position === state.lineStart && testDocumentSeparator(state) || withinFlowCollection && is_FLOW_INDICATOR(ch)) {
      break;
    } else if (is_EOL(ch)) {
      _line = state.line;
      _lineStart = state.lineStart;
      _lineIndent = state.lineIndent;
      skipSeparationSpace(state, false, -1);
      if (state.lineIndent >= nodeIndent) {
        hasPendingContent = true;
        ch = state.input.charCodeAt(state.position);
        continue;
      } else {
        state.position = captureEnd;
        state.line = _line;
        state.lineStart = _lineStart;
        state.lineIndent = _lineIndent;
        break;
      }
    }
    if (hasPendingContent) {
      captureSegment(state, captureStart, captureEnd, false);
      writeFoldedLines(state, state.line - _line);
      captureStart = captureEnd = state.position;
      hasPendingContent = false;
    }
    if (!is_WHITE_SPACE(ch)) {
      captureEnd = state.position + 1;
    }
    ch = state.input.charCodeAt(++state.position);
  }
  captureSegment(state, captureStart, captureEnd, false);
  if (state.result) {
    return true;
  }
  state.kind = _kind;
  state.result = _result;
  return false;
}
function readSingleQuotedScalar(state, nodeIndent) {
  var ch, captureStart, captureEnd;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 39) {
    return false;
  }
  state.kind = "scalar";
  state.result = "";
  state.position++;
  captureStart = captureEnd = state.position;
  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    if (ch === 39) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);
      if (ch === 39) {
        captureStart = state.position;
        state.position++;
        captureEnd = state.position;
      } else {
        return true;
      }
    } else if (is_EOL(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;
    } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
      throwError(state, "unexpected end of the document within a single quoted scalar");
    } else {
      state.position++;
      captureEnd = state.position;
    }
  }
  throwError(state, "unexpected end of the stream within a single quoted scalar");
}
function readDoubleQuotedScalar(state, nodeIndent) {
  var captureStart, captureEnd, hexLength, hexResult, tmp, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 34) {
    return false;
  }
  state.kind = "scalar";
  state.result = "";
  state.position++;
  captureStart = captureEnd = state.position;
  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    if (ch === 34) {
      captureSegment(state, captureStart, state.position, true);
      state.position++;
      return true;
    } else if (ch === 92) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);
      if (is_EOL(ch)) {
        skipSeparationSpace(state, false, nodeIndent);
      } else if (ch < 256 && simpleEscapeCheck[ch]) {
        state.result += simpleEscapeMap[ch];
        state.position++;
      } else if ((tmp = escapedHexLen(ch)) > 0) {
        hexLength = tmp;
        hexResult = 0;
        for (; hexLength > 0; hexLength--) {
          ch = state.input.charCodeAt(++state.position);
          if ((tmp = fromHexCode(ch)) >= 0) {
            hexResult = (hexResult << 4) + tmp;
          } else {
            throwError(state, "expected hexadecimal character");
          }
        }
        state.result += charFromCodepoint(hexResult);
        state.position++;
      } else {
        throwError(state, "unknown escape sequence");
      }
      captureStart = captureEnd = state.position;
    } else if (is_EOL(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;
    } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
      throwError(state, "unexpected end of the document within a double quoted scalar");
    } else {
      state.position++;
      captureEnd = state.position;
    }
  }
  throwError(state, "unexpected end of the stream within a double quoted scalar");
}
function readFlowCollection(state, nodeIndent) {
  var readNext = true, _line, _lineStart, _pos, _tag = state.tag, _result, _anchor = state.anchor, following, terminator, isPair, isExplicitPair, isMapping, overridableKeys = /* @__PURE__ */ Object.create(null), keyNode, keyTag, valueNode, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch === 91) {
    terminator = 93;
    isMapping = false;
    _result = [];
  } else if (ch === 123) {
    terminator = 125;
    isMapping = true;
    _result = {};
  } else {
    return false;
  }
  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }
  ch = state.input.charCodeAt(++state.position);
  while (ch !== 0) {
    skipSeparationSpace(state, true, nodeIndent);
    ch = state.input.charCodeAt(state.position);
    if (ch === terminator) {
      state.position++;
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = isMapping ? "mapping" : "sequence";
      state.result = _result;
      return true;
    } else if (!readNext) {
      throwError(state, "missed comma between flow collection entries");
    } else if (ch === 44) {
      throwError(state, "expected the node content, but found ','");
    }
    keyTag = keyNode = valueNode = null;
    isPair = isExplicitPair = false;
    if (ch === 63) {
      following = state.input.charCodeAt(state.position + 1);
      if (is_WS_OR_EOL(following)) {
        isPair = isExplicitPair = true;
        state.position++;
        skipSeparationSpace(state, true, nodeIndent);
      }
    }
    _line = state.line;
    _lineStart = state.lineStart;
    _pos = state.position;
    composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
    keyTag = state.tag;
    keyNode = state.result;
    skipSeparationSpace(state, true, nodeIndent);
    ch = state.input.charCodeAt(state.position);
    if ((isExplicitPair || state.line === _line) && ch === 58) {
      isPair = true;
      ch = state.input.charCodeAt(++state.position);
      skipSeparationSpace(state, true, nodeIndent);
      composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
      valueNode = state.result;
    }
    if (isMapping) {
      storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
    } else if (isPair) {
      _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
    } else {
      _result.push(keyNode);
    }
    skipSeparationSpace(state, true, nodeIndent);
    ch = state.input.charCodeAt(state.position);
    if (ch === 44) {
      readNext = true;
      ch = state.input.charCodeAt(++state.position);
    } else {
      readNext = false;
    }
  }
  throwError(state, "unexpected end of the stream within a flow collection");
}
function readBlockScalar(state, nodeIndent) {
  var captureStart, folding, chomping = CHOMPING_CLIP, didReadContent = false, detectedIndent = false, textIndent = nodeIndent, emptyLines = 0, atMoreIndented = false, tmp, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch === 124) {
    folding = false;
  } else if (ch === 62) {
    folding = true;
  } else {
    return false;
  }
  state.kind = "scalar";
  state.result = "";
  while (ch !== 0) {
    ch = state.input.charCodeAt(++state.position);
    if (ch === 43 || ch === 45) {
      if (CHOMPING_CLIP === chomping) {
        chomping = ch === 43 ? CHOMPING_KEEP : CHOMPING_STRIP;
      } else {
        throwError(state, "repeat of a chomping mode identifier");
      }
    } else if ((tmp = fromDecimalCode(ch)) >= 0) {
      if (tmp === 0) {
        throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
      } else if (!detectedIndent) {
        textIndent = nodeIndent + tmp - 1;
        detectedIndent = true;
      } else {
        throwError(state, "repeat of an indentation width identifier");
      }
    } else {
      break;
    }
  }
  if (is_WHITE_SPACE(ch)) {
    do {
      ch = state.input.charCodeAt(++state.position);
    } while (is_WHITE_SPACE(ch));
    if (ch === 35) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (!is_EOL(ch) && ch !== 0);
    }
  }
  while (ch !== 0) {
    readLineBreak(state);
    state.lineIndent = 0;
    ch = state.input.charCodeAt(state.position);
    while ((!detectedIndent || state.lineIndent < textIndent) && ch === 32) {
      state.lineIndent++;
      ch = state.input.charCodeAt(++state.position);
    }
    if (!detectedIndent && state.lineIndent > textIndent) {
      textIndent = state.lineIndent;
    }
    if (is_EOL(ch)) {
      emptyLines++;
      continue;
    }
    if (state.lineIndent < textIndent) {
      if (chomping === CHOMPING_KEEP) {
        state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
      } else if (chomping === CHOMPING_CLIP) {
        if (didReadContent) {
          state.result += "\n";
        }
      }
      break;
    }
    if (folding) {
      if (is_WHITE_SPACE(ch)) {
        atMoreIndented = true;
        state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
      } else if (atMoreIndented) {
        atMoreIndented = false;
        state.result += common.repeat("\n", emptyLines + 1);
      } else if (emptyLines === 0) {
        if (didReadContent) {
          state.result += " ";
        }
      } else {
        state.result += common.repeat("\n", emptyLines);
      }
    } else {
      state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
    }
    didReadContent = true;
    detectedIndent = true;
    emptyLines = 0;
    captureStart = state.position;
    while (!is_EOL(ch) && ch !== 0) {
      ch = state.input.charCodeAt(++state.position);
    }
    captureSegment(state, captureStart, state.position, false);
  }
  return true;
}
function readBlockSequence(state, nodeIndent) {
  var _line, _tag = state.tag, _anchor = state.anchor, _result = [], following, detected = false, ch;
  if (state.firstTabInLine !== -1) return false;
  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }
  ch = state.input.charCodeAt(state.position);
  while (ch !== 0) {
    if (state.firstTabInLine !== -1) {
      state.position = state.firstTabInLine;
      throwError(state, "tab characters must not be used in indentation");
    }
    if (ch !== 45) {
      break;
    }
    following = state.input.charCodeAt(state.position + 1);
    if (!is_WS_OR_EOL(following)) {
      break;
    }
    detected = true;
    state.position++;
    if (skipSeparationSpace(state, true, -1)) {
      if (state.lineIndent <= nodeIndent) {
        _result.push(null);
        ch = state.input.charCodeAt(state.position);
        continue;
      }
    }
    _line = state.line;
    composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
    _result.push(state.result);
    skipSeparationSpace(state, true, -1);
    ch = state.input.charCodeAt(state.position);
    if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
      throwError(state, "bad indentation of a sequence entry");
    } else if (state.lineIndent < nodeIndent) {
      break;
    }
  }
  if (detected) {
    state.tag = _tag;
    state.anchor = _anchor;
    state.kind = "sequence";
    state.result = _result;
    return true;
  }
  return false;
}
function readBlockMapping(state, nodeIndent, flowIndent) {
  var following, allowCompact, _line, _keyLine, _keyLineStart, _keyPos, _tag = state.tag, _anchor = state.anchor, _result = {}, overridableKeys = /* @__PURE__ */ Object.create(null), keyTag = null, keyNode = null, valueNode = null, atExplicitKey = false, detected = false, ch;
  if (state.firstTabInLine !== -1) return false;
  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }
  ch = state.input.charCodeAt(state.position);
  while (ch !== 0) {
    if (!atExplicitKey && state.firstTabInLine !== -1) {
      state.position = state.firstTabInLine;
      throwError(state, "tab characters must not be used in indentation");
    }
    following = state.input.charCodeAt(state.position + 1);
    _line = state.line;
    if ((ch === 63 || ch === 58) && is_WS_OR_EOL(following)) {
      if (ch === 63) {
        if (atExplicitKey) {
          storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
          keyTag = keyNode = valueNode = null;
        }
        detected = true;
        atExplicitKey = true;
        allowCompact = true;
      } else if (atExplicitKey) {
        atExplicitKey = false;
        allowCompact = true;
      } else {
        throwError(state, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line");
      }
      state.position += 1;
      ch = following;
    } else {
      _keyLine = state.line;
      _keyLineStart = state.lineStart;
      _keyPos = state.position;
      if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
        break;
      }
      if (state.line === _line) {
        ch = state.input.charCodeAt(state.position);
        while (is_WHITE_SPACE(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        if (ch === 58) {
          ch = state.input.charCodeAt(++state.position);
          if (!is_WS_OR_EOL(ch)) {
            throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
          }
          if (atExplicitKey) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
            keyTag = keyNode = valueNode = null;
          }
          detected = true;
          atExplicitKey = false;
          allowCompact = false;
          keyTag = state.tag;
          keyNode = state.result;
        } else if (detected) {
          throwError(state, "can not read an implicit mapping pair; a colon is missed");
        } else {
          state.tag = _tag;
          state.anchor = _anchor;
          return true;
        }
      } else if (detected) {
        throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
      } else {
        state.tag = _tag;
        state.anchor = _anchor;
        return true;
      }
    }
    if (state.line === _line || state.lineIndent > nodeIndent) {
      if (atExplicitKey) {
        _keyLine = state.line;
        _keyLineStart = state.lineStart;
        _keyPos = state.position;
      }
      if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
        if (atExplicitKey) {
          keyNode = state.result;
        } else {
          valueNode = state.result;
        }
      }
      if (!atExplicitKey) {
        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
        keyTag = keyNode = valueNode = null;
      }
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
    }
    if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
      throwError(state, "bad indentation of a mapping entry");
    } else if (state.lineIndent < nodeIndent) {
      break;
    }
  }
  if (atExplicitKey) {
    storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
  }
  if (detected) {
    state.tag = _tag;
    state.anchor = _anchor;
    state.kind = "mapping";
    state.result = _result;
  }
  return detected;
}
function readTagProperty(state) {
  var _position, isVerbatim = false, isNamed = false, tagHandle, tagName, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 33) return false;
  if (state.tag !== null) {
    throwError(state, "duplication of a tag property");
  }
  ch = state.input.charCodeAt(++state.position);
  if (ch === 60) {
    isVerbatim = true;
    ch = state.input.charCodeAt(++state.position);
  } else if (ch === 33) {
    isNamed = true;
    tagHandle = "!!";
    ch = state.input.charCodeAt(++state.position);
  } else {
    tagHandle = "!";
  }
  _position = state.position;
  if (isVerbatim) {
    do {
      ch = state.input.charCodeAt(++state.position);
    } while (ch !== 0 && ch !== 62);
    if (state.position < state.length) {
      tagName = state.input.slice(_position, state.position);
      ch = state.input.charCodeAt(++state.position);
    } else {
      throwError(state, "unexpected end of the stream within a verbatim tag");
    }
  } else {
    while (ch !== 0 && !is_WS_OR_EOL(ch)) {
      if (ch === 33) {
        if (!isNamed) {
          tagHandle = state.input.slice(_position - 1, state.position + 1);
          if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
            throwError(state, "named tag handle cannot contain such characters");
          }
          isNamed = true;
          _position = state.position + 1;
        } else {
          throwError(state, "tag suffix cannot contain exclamation marks");
        }
      }
      ch = state.input.charCodeAt(++state.position);
    }
    tagName = state.input.slice(_position, state.position);
    if (PATTERN_FLOW_INDICATORS.test(tagName)) {
      throwError(state, "tag suffix cannot contain flow indicator characters");
    }
  }
  if (tagName && !PATTERN_TAG_URI.test(tagName)) {
    throwError(state, "tag name cannot contain such characters: " + tagName);
  }
  try {
    tagName = decodeURIComponent(tagName);
  } catch (err) {
    throwError(state, "tag name is malformed: " + tagName);
  }
  if (isVerbatim) {
    state.tag = tagName;
  } else if (_hasOwnProperty$1.call(state.tagMap, tagHandle)) {
    state.tag = state.tagMap[tagHandle] + tagName;
  } else if (tagHandle === "!") {
    state.tag = "!" + tagName;
  } else if (tagHandle === "!!") {
    state.tag = "tag:yaml.org,2002:" + tagName;
  } else {
    throwError(state, 'undeclared tag handle "' + tagHandle + '"');
  }
  return true;
}
function readAnchorProperty(state) {
  var _position, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 38) return false;
  if (state.anchor !== null) {
    throwError(state, "duplication of an anchor property");
  }
  ch = state.input.charCodeAt(++state.position);
  _position = state.position;
  while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
    ch = state.input.charCodeAt(++state.position);
  }
  if (state.position === _position) {
    throwError(state, "name of an anchor node must contain at least one character");
  }
  state.anchor = state.input.slice(_position, state.position);
  return true;
}
function readAlias(state) {
  var _position, alias, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 42) return false;
  ch = state.input.charCodeAt(++state.position);
  _position = state.position;
  while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
    ch = state.input.charCodeAt(++state.position);
  }
  if (state.position === _position) {
    throwError(state, "name of an alias node must contain at least one character");
  }
  alias = state.input.slice(_position, state.position);
  if (!_hasOwnProperty$1.call(state.anchorMap, alias)) {
    throwError(state, 'unidentified alias "' + alias + '"');
  }
  state.result = state.anchorMap[alias];
  skipSeparationSpace(state, true, -1);
  return true;
}
function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
  var allowBlockStyles, allowBlockScalars, allowBlockCollections, indentStatus = 1, atNewLine = false, hasContent = false, typeIndex, typeQuantity, typeList, type2, flowIndent, blockIndent;
  if (state.listener !== null) {
    state.listener("open", state);
  }
  state.tag = null;
  state.anchor = null;
  state.kind = null;
  state.result = null;
  allowBlockStyles = allowBlockScalars = allowBlockCollections = CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext;
  if (allowToSeek) {
    if (skipSeparationSpace(state, true, -1)) {
      atNewLine = true;
      if (state.lineIndent > parentIndent) {
        indentStatus = 1;
      } else if (state.lineIndent === parentIndent) {
        indentStatus = 0;
      } else if (state.lineIndent < parentIndent) {
        indentStatus = -1;
      }
    }
  }
  if (indentStatus === 1) {
    while (readTagProperty(state) || readAnchorProperty(state)) {
      if (skipSeparationSpace(state, true, -1)) {
        atNewLine = true;
        allowBlockCollections = allowBlockStyles;
        if (state.lineIndent > parentIndent) {
          indentStatus = 1;
        } else if (state.lineIndent === parentIndent) {
          indentStatus = 0;
        } else if (state.lineIndent < parentIndent) {
          indentStatus = -1;
        }
      } else {
        allowBlockCollections = false;
      }
    }
  }
  if (allowBlockCollections) {
    allowBlockCollections = atNewLine || allowCompact;
  }
  if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
    if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) {
      flowIndent = parentIndent;
    } else {
      flowIndent = parentIndent + 1;
    }
    blockIndent = state.position - state.lineStart;
    if (indentStatus === 1) {
      if (allowBlockCollections && (readBlockSequence(state, blockIndent) || readBlockMapping(state, blockIndent, flowIndent)) || readFlowCollection(state, flowIndent)) {
        hasContent = true;
      } else {
        if (allowBlockScalars && readBlockScalar(state, flowIndent) || readSingleQuotedScalar(state, flowIndent) || readDoubleQuotedScalar(state, flowIndent)) {
          hasContent = true;
        } else if (readAlias(state)) {
          hasContent = true;
          if (state.tag !== null || state.anchor !== null) {
            throwError(state, "alias node should not have any properties");
          }
        } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
          hasContent = true;
          if (state.tag === null) {
            state.tag = "?";
          }
        }
        if (state.anchor !== null) {
          state.anchorMap[state.anchor] = state.result;
        }
      }
    } else if (indentStatus === 0) {
      hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
    }
  }
  if (state.tag === null) {
    if (state.anchor !== null) {
      state.anchorMap[state.anchor] = state.result;
    }
  } else if (state.tag === "?") {
    if (state.result !== null && state.kind !== "scalar") {
      throwError(state, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"');
    }
    for (typeIndex = 0, typeQuantity = state.implicitTypes.length; typeIndex < typeQuantity; typeIndex += 1) {
      type2 = state.implicitTypes[typeIndex];
      if (type2.resolve(state.result)) {
        state.result = type2.construct(state.result);
        state.tag = type2.tag;
        if (state.anchor !== null) {
          state.anchorMap[state.anchor] = state.result;
        }
        break;
      }
    }
  } else if (state.tag !== "!") {
    if (_hasOwnProperty$1.call(state.typeMap[state.kind || "fallback"], state.tag)) {
      type2 = state.typeMap[state.kind || "fallback"][state.tag];
    } else {
      type2 = null;
      typeList = state.typeMap.multi[state.kind || "fallback"];
      for (typeIndex = 0, typeQuantity = typeList.length; typeIndex < typeQuantity; typeIndex += 1) {
        if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
          type2 = typeList[typeIndex];
          break;
        }
      }
    }
    if (!type2) {
      throwError(state, "unknown tag !<" + state.tag + ">");
    }
    if (state.result !== null && type2.kind !== state.kind) {
      throwError(state, "unacceptable node kind for !<" + state.tag + '> tag; it should be "' + type2.kind + '", not "' + state.kind + '"');
    }
    if (!type2.resolve(state.result, state.tag)) {
      throwError(state, "cannot resolve a node with !<" + state.tag + "> explicit tag");
    } else {
      state.result = type2.construct(state.result, state.tag);
      if (state.anchor !== null) {
        state.anchorMap[state.anchor] = state.result;
      }
    }
  }
  if (state.listener !== null) {
    state.listener("close", state);
  }
  return state.tag !== null || state.anchor !== null || hasContent;
}
function readDocument(state) {
  var documentStart = state.position, _position, directiveName, directiveArgs, hasDirectives = false, ch;
  state.version = null;
  state.checkLineBreaks = state.legacy;
  state.tagMap = /* @__PURE__ */ Object.create(null);
  state.anchorMap = /* @__PURE__ */ Object.create(null);
  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    skipSeparationSpace(state, true, -1);
    ch = state.input.charCodeAt(state.position);
    if (state.lineIndent > 0 || ch !== 37) {
      break;
    }
    hasDirectives = true;
    ch = state.input.charCodeAt(++state.position);
    _position = state.position;
    while (ch !== 0 && !is_WS_OR_EOL(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }
    directiveName = state.input.slice(_position, state.position);
    directiveArgs = [];
    if (directiveName.length < 1) {
      throwError(state, "directive name must not be less than one character in length");
    }
    while (ch !== 0) {
      while (is_WHITE_SPACE(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      if (ch === 35) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (ch !== 0 && !is_EOL(ch));
        break;
      }
      if (is_EOL(ch)) break;
      _position = state.position;
      while (ch !== 0 && !is_WS_OR_EOL(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      directiveArgs.push(state.input.slice(_position, state.position));
    }
    if (ch !== 0) readLineBreak(state);
    if (_hasOwnProperty$1.call(directiveHandlers, directiveName)) {
      directiveHandlers[directiveName](state, directiveName, directiveArgs);
    } else {
      throwWarning(state, 'unknown document directive "' + directiveName + '"');
    }
  }
  skipSeparationSpace(state, true, -1);
  if (state.lineIndent === 0 && state.input.charCodeAt(state.position) === 45 && state.input.charCodeAt(state.position + 1) === 45 && state.input.charCodeAt(state.position + 2) === 45) {
    state.position += 3;
    skipSeparationSpace(state, true, -1);
  } else if (hasDirectives) {
    throwError(state, "directives end mark is expected");
  }
  composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
  skipSeparationSpace(state, true, -1);
  if (state.checkLineBreaks && PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) {
    throwWarning(state, "non-ASCII line breaks are interpreted as content");
  }
  state.documents.push(state.result);
  if (state.position === state.lineStart && testDocumentSeparator(state)) {
    if (state.input.charCodeAt(state.position) === 46) {
      state.position += 3;
      skipSeparationSpace(state, true, -1);
    }
    return;
  }
  if (state.position < state.length - 1) {
    throwError(state, "end of the stream or a document separator is expected");
  } else {
    return;
  }
}
function loadDocuments(input, options) {
  input = String(input);
  options = options || {};
  if (input.length !== 0) {
    if (input.charCodeAt(input.length - 1) !== 10 && input.charCodeAt(input.length - 1) !== 13) {
      input += "\n";
    }
    if (input.charCodeAt(0) === 65279) {
      input = input.slice(1);
    }
  }
  var state = new State$1(input, options);
  var nullpos = input.indexOf("\0");
  if (nullpos !== -1) {
    state.position = nullpos;
    throwError(state, "null byte is not allowed in input");
  }
  state.input += "\0";
  while (state.input.charCodeAt(state.position) === 32) {
    state.lineIndent += 1;
    state.position += 1;
  }
  while (state.position < state.length - 1) {
    readDocument(state);
  }
  return state.documents;
}
function loadAll$1(input, iterator, options) {
  if (iterator !== null && typeof iterator === "object" && typeof options === "undefined") {
    options = iterator;
    iterator = null;
  }
  var documents = loadDocuments(input, options);
  if (typeof iterator !== "function") {
    return documents;
  }
  for (var index = 0, length = documents.length; index < length; index += 1) {
    iterator(documents[index]);
  }
}
function load$1(input, options) {
  var documents = loadDocuments(input, options);
  if (documents.length === 0) {
    return void 0;
  } else if (documents.length === 1) {
    return documents[0];
  }
  throw new exception("expected a single document in the stream, but found more");
}
var loadAll_1 = loadAll$1;
var load_1 = load$1;
var loader = {
  loadAll: loadAll_1,
  load: load_1
};
var _toString = Object.prototype.toString;
var _hasOwnProperty = Object.prototype.hasOwnProperty;
var CHAR_BOM = 65279;
var CHAR_TAB = 9;
var CHAR_LINE_FEED = 10;
var CHAR_CARRIAGE_RETURN = 13;
var CHAR_SPACE = 32;
var CHAR_EXCLAMATION = 33;
var CHAR_DOUBLE_QUOTE = 34;
var CHAR_SHARP = 35;
var CHAR_PERCENT = 37;
var CHAR_AMPERSAND = 38;
var CHAR_SINGLE_QUOTE = 39;
var CHAR_ASTERISK = 42;
var CHAR_COMMA = 44;
var CHAR_MINUS = 45;
var CHAR_COLON = 58;
var CHAR_EQUALS = 61;
var CHAR_GREATER_THAN = 62;
var CHAR_QUESTION = 63;
var CHAR_COMMERCIAL_AT = 64;
var CHAR_LEFT_SQUARE_BRACKET = 91;
var CHAR_RIGHT_SQUARE_BRACKET = 93;
var CHAR_GRAVE_ACCENT = 96;
var CHAR_LEFT_CURLY_BRACKET = 123;
var CHAR_VERTICAL_LINE = 124;
var CHAR_RIGHT_CURLY_BRACKET = 125;
var ESCAPE_SEQUENCES = {};
ESCAPE_SEQUENCES[0] = "\\0";
ESCAPE_SEQUENCES[7] = "\\a";
ESCAPE_SEQUENCES[8] = "\\b";
ESCAPE_SEQUENCES[9] = "\\t";
ESCAPE_SEQUENCES[10] = "\\n";
ESCAPE_SEQUENCES[11] = "\\v";
ESCAPE_SEQUENCES[12] = "\\f";
ESCAPE_SEQUENCES[13] = "\\r";
ESCAPE_SEQUENCES[27] = "\\e";
ESCAPE_SEQUENCES[34] = '\\"';
ESCAPE_SEQUENCES[92] = "\\\\";
ESCAPE_SEQUENCES[133] = "\\N";
ESCAPE_SEQUENCES[160] = "\\_";
ESCAPE_SEQUENCES[8232] = "\\L";
ESCAPE_SEQUENCES[8233] = "\\P";
var DEPRECATED_BOOLEANS_SYNTAX = [
  "y",
  "Y",
  "yes",
  "Yes",
  "YES",
  "on",
  "On",
  "ON",
  "n",
  "N",
  "no",
  "No",
  "NO",
  "off",
  "Off",
  "OFF"
];
var DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
function compileStyleMap(schema2, map2) {
  var result2, keys, index, length, tag, style, type2;
  if (map2 === null) return {};
  result2 = {};
  keys = Object.keys(map2);
  for (index = 0, length = keys.length; index < length; index += 1) {
    tag = keys[index];
    style = String(map2[tag]);
    if (tag.slice(0, 2) === "!!") {
      tag = "tag:yaml.org,2002:" + tag.slice(2);
    }
    type2 = schema2.compiledTypeMap["fallback"][tag];
    if (type2 && _hasOwnProperty.call(type2.styleAliases, style)) {
      style = type2.styleAliases[style];
    }
    result2[tag] = style;
  }
  return result2;
}
function encodeHex(character) {
  var string, handle, length;
  string = character.toString(16).toUpperCase();
  if (character <= 255) {
    handle = "x";
    length = 2;
  } else if (character <= 65535) {
    handle = "u";
    length = 4;
  } else if (character <= 4294967295) {
    handle = "U";
    length = 8;
  } else {
    throw new exception("code point within a string may not be greater than 0xFFFFFFFF");
  }
  return "\\" + handle + common.repeat("0", length - string.length) + string;
}
var QUOTING_TYPE_SINGLE = 1;
var QUOTING_TYPE_DOUBLE = 2;
function State(options) {
  this.schema = options["schema"] || _default;
  this.indent = Math.max(1, options["indent"] || 2);
  this.noArrayIndent = options["noArrayIndent"] || false;
  this.skipInvalid = options["skipInvalid"] || false;
  this.flowLevel = common.isNothing(options["flowLevel"]) ? -1 : options["flowLevel"];
  this.styleMap = compileStyleMap(this.schema, options["styles"] || null);
  this.sortKeys = options["sortKeys"] || false;
  this.lineWidth = options["lineWidth"] || 80;
  this.noRefs = options["noRefs"] || false;
  this.noCompatMode = options["noCompatMode"] || false;
  this.condenseFlow = options["condenseFlow"] || false;
  this.quotingType = options["quotingType"] === '"' ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
  this.forceQuotes = options["forceQuotes"] || false;
  this.replacer = typeof options["replacer"] === "function" ? options["replacer"] : null;
  this.implicitTypes = this.schema.compiledImplicit;
  this.explicitTypes = this.schema.compiledExplicit;
  this.tag = null;
  this.result = "";
  this.duplicates = [];
  this.usedDuplicates = null;
}
function indentString(string, spaces) {
  var ind = common.repeat(" ", spaces), position = 0, next = -1, result2 = "", line, length = string.length;
  while (position < length) {
    next = string.indexOf("\n", position);
    if (next === -1) {
      line = string.slice(position);
      position = length;
    } else {
      line = string.slice(position, next + 1);
      position = next + 1;
    }
    if (line.length && line !== "\n") result2 += ind;
    result2 += line;
  }
  return result2;
}
function generateNextLine(state, level) {
  return "\n" + common.repeat(" ", state.indent * level);
}
function testImplicitResolving(state, str2) {
  var index, length, type2;
  for (index = 0, length = state.implicitTypes.length; index < length; index += 1) {
    type2 = state.implicitTypes[index];
    if (type2.resolve(str2)) {
      return true;
    }
  }
  return false;
}
function isWhitespace(c) {
  return c === CHAR_SPACE || c === CHAR_TAB;
}
function isPrintable(c) {
  return 32 <= c && c <= 126 || 161 <= c && c <= 55295 && c !== 8232 && c !== 8233 || 57344 <= c && c <= 65533 && c !== CHAR_BOM || 65536 <= c && c <= 1114111;
}
function isNsCharOrWhitespace(c) {
  return isPrintable(c) && c !== CHAR_BOM && c !== CHAR_CARRIAGE_RETURN && c !== CHAR_LINE_FEED;
}
function isPlainSafe(c, prev, inblock) {
  var cIsNsCharOrWhitespace = isNsCharOrWhitespace(c);
  var cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c);
  return (
    // ns-plain-safe
    (inblock ? (
      // c = flow-in
      cIsNsCharOrWhitespace
    ) : cIsNsCharOrWhitespace && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET) && c !== CHAR_SHARP && !(prev === CHAR_COLON && !cIsNsChar) || isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c === CHAR_SHARP || prev === CHAR_COLON && cIsNsChar
  );
}
function isPlainSafeFirst(c) {
  return isPrintable(c) && c !== CHAR_BOM && !isWhitespace(c) && c !== CHAR_MINUS && c !== CHAR_QUESTION && c !== CHAR_COLON && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET && c !== CHAR_SHARP && c !== CHAR_AMPERSAND && c !== CHAR_ASTERISK && c !== CHAR_EXCLAMATION && c !== CHAR_VERTICAL_LINE && c !== CHAR_EQUALS && c !== CHAR_GREATER_THAN && c !== CHAR_SINGLE_QUOTE && c !== CHAR_DOUBLE_QUOTE && c !== CHAR_PERCENT && c !== CHAR_COMMERCIAL_AT && c !== CHAR_GRAVE_ACCENT;
}
function isPlainSafeLast(c) {
  return !isWhitespace(c) && c !== CHAR_COLON;
}
function codePointAt(string, pos) {
  var first = string.charCodeAt(pos), second;
  if (first >= 55296 && first <= 56319 && pos + 1 < string.length) {
    second = string.charCodeAt(pos + 1);
    if (second >= 56320 && second <= 57343) {
      return (first - 55296) * 1024 + second - 56320 + 65536;
    }
  }
  return first;
}
function needIndentIndicator(string) {
  var leadingSpaceRe = /^\n* /;
  return leadingSpaceRe.test(string);
}
var STYLE_PLAIN = 1;
var STYLE_SINGLE = 2;
var STYLE_LITERAL = 3;
var STYLE_FOLDED = 4;
var STYLE_DOUBLE = 5;
function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth, testAmbiguousType, quotingType, forceQuotes, inblock) {
  var i;
  var char = 0;
  var prevChar = null;
  var hasLineBreak = false;
  var hasFoldableLine = false;
  var shouldTrackWidth = lineWidth !== -1;
  var previousLineBreak = -1;
  var plain = isPlainSafeFirst(codePointAt(string, 0)) && isPlainSafeLast(codePointAt(string, string.length - 1));
  if (singleLineOnly || forceQuotes) {
    for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
      char = codePointAt(string, i);
      if (!isPrintable(char)) {
        return STYLE_DOUBLE;
      }
      plain = plain && isPlainSafe(char, prevChar, inblock);
      prevChar = char;
    }
  } else {
    for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
      char = codePointAt(string, i);
      if (char === CHAR_LINE_FEED) {
        hasLineBreak = true;
        if (shouldTrackWidth) {
          hasFoldableLine = hasFoldableLine || // Foldable line = too long, and not more-indented.
          i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
          previousLineBreak = i;
        }
      } else if (!isPrintable(char)) {
        return STYLE_DOUBLE;
      }
      plain = plain && isPlainSafe(char, prevChar, inblock);
      prevChar = char;
    }
    hasFoldableLine = hasFoldableLine || shouldTrackWidth && (i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ");
  }
  if (!hasLineBreak && !hasFoldableLine) {
    if (plain && !forceQuotes && !testAmbiguousType(string)) {
      return STYLE_PLAIN;
    }
    return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
  }
  if (indentPerLevel > 9 && needIndentIndicator(string)) {
    return STYLE_DOUBLE;
  }
  if (!forceQuotes) {
    return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
  }
  return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
}
function writeScalar(state, string, level, iskey, inblock) {
  state.dump = (function() {
    if (string.length === 0) {
      return state.quotingType === QUOTING_TYPE_DOUBLE ? '""' : "''";
    }
    if (!state.noCompatMode) {
      if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) {
        return state.quotingType === QUOTING_TYPE_DOUBLE ? '"' + string + '"' : "'" + string + "'";
      }
    }
    var indent = state.indent * Math.max(1, level);
    var lineWidth = state.lineWidth === -1 ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
    var singleLineOnly = iskey || state.flowLevel > -1 && level >= state.flowLevel;
    function testAmbiguity(string2) {
      return testImplicitResolving(state, string2);
    }
    switch (chooseScalarStyle(
      string,
      singleLineOnly,
      state.indent,
      lineWidth,
      testAmbiguity,
      state.quotingType,
      state.forceQuotes && !iskey,
      inblock
    )) {
      case STYLE_PLAIN:
        return string;
      case STYLE_SINGLE:
        return "'" + string.replace(/'/g, "''") + "'";
      case STYLE_LITERAL:
        return "|" + blockHeader(string, state.indent) + dropEndingNewline(indentString(string, indent));
      case STYLE_FOLDED:
        return ">" + blockHeader(string, state.indent) + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
      case STYLE_DOUBLE:
        return '"' + escapeString(string) + '"';
      default:
        throw new exception("impossible error: invalid scalar style");
    }
  })();
}
function blockHeader(string, indentPerLevel) {
  var indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : "";
  var clip = string[string.length - 1] === "\n";
  var keep = clip && (string[string.length - 2] === "\n" || string === "\n");
  var chomp = keep ? "+" : clip ? "" : "-";
  return indentIndicator + chomp + "\n";
}
function dropEndingNewline(string) {
  return string[string.length - 1] === "\n" ? string.slice(0, -1) : string;
}
function foldString(string, width) {
  var lineRe = /(\n+)([^\n]*)/g;
  var result2 = (function() {
    var nextLF = string.indexOf("\n");
    nextLF = nextLF !== -1 ? nextLF : string.length;
    lineRe.lastIndex = nextLF;
    return foldLine(string.slice(0, nextLF), width);
  })();
  var prevMoreIndented = string[0] === "\n" || string[0] === " ";
  var moreIndented;
  var match;
  while (match = lineRe.exec(string)) {
    var prefix = match[1], line = match[2];
    moreIndented = line[0] === " ";
    result2 += prefix + (!prevMoreIndented && !moreIndented && line !== "" ? "\n" : "") + foldLine(line, width);
    prevMoreIndented = moreIndented;
  }
  return result2;
}
function foldLine(line, width) {
  if (line === "" || line[0] === " ") return line;
  var breakRe = / [^ ]/g;
  var match;
  var start = 0, end, curr = 0, next = 0;
  var result2 = "";
  while (match = breakRe.exec(line)) {
    next = match.index;
    if (next - start > width) {
      end = curr > start ? curr : next;
      result2 += "\n" + line.slice(start, end);
      start = end + 1;
    }
    curr = next;
  }
  result2 += "\n";
  if (line.length - start > width && curr > start) {
    result2 += line.slice(start, curr) + "\n" + line.slice(curr + 1);
  } else {
    result2 += line.slice(start);
  }
  return result2.slice(1);
}
function escapeString(string) {
  var result2 = "";
  var char = 0;
  var escapeSeq;
  for (var i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
    char = codePointAt(string, i);
    escapeSeq = ESCAPE_SEQUENCES[char];
    if (!escapeSeq && isPrintable(char)) {
      result2 += string[i];
      if (char >= 65536) result2 += string[i + 1];
    } else {
      result2 += escapeSeq || encodeHex(char);
    }
  }
  return result2;
}
function writeFlowSequence(state, level, object) {
  var _result = "", _tag = state.tag, index, length, value;
  for (index = 0, length = object.length; index < length; index += 1) {
    value = object[index];
    if (state.replacer) {
      value = state.replacer.call(object, String(index), value);
    }
    if (writeNode(state, level, value, false, false) || typeof value === "undefined" && writeNode(state, level, null, false, false)) {
      if (_result !== "") _result += "," + (!state.condenseFlow ? " " : "");
      _result += state.dump;
    }
  }
  state.tag = _tag;
  state.dump = "[" + _result + "]";
}
function writeBlockSequence(state, level, object, compact) {
  var _result = "", _tag = state.tag, index, length, value;
  for (index = 0, length = object.length; index < length; index += 1) {
    value = object[index];
    if (state.replacer) {
      value = state.replacer.call(object, String(index), value);
    }
    if (writeNode(state, level + 1, value, true, true, false, true) || typeof value === "undefined" && writeNode(state, level + 1, null, true, true, false, true)) {
      if (!compact || _result !== "") {
        _result += generateNextLine(state, level);
      }
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        _result += "-";
      } else {
        _result += "- ";
      }
      _result += state.dump;
    }
  }
  state.tag = _tag;
  state.dump = _result || "[]";
}
function writeFlowMapping(state, level, object) {
  var _result = "", _tag = state.tag, objectKeyList = Object.keys(object), index, length, objectKey, objectValue, pairBuffer;
  for (index = 0, length = objectKeyList.length; index < length; index += 1) {
    pairBuffer = "";
    if (_result !== "") pairBuffer += ", ";
    if (state.condenseFlow) pairBuffer += '"';
    objectKey = objectKeyList[index];
    objectValue = object[objectKey];
    if (state.replacer) {
      objectValue = state.replacer.call(object, objectKey, objectValue);
    }
    if (!writeNode(state, level, objectKey, false, false)) {
      continue;
    }
    if (state.dump.length > 1024) pairBuffer += "? ";
    pairBuffer += state.dump + (state.condenseFlow ? '"' : "") + ":" + (state.condenseFlow ? "" : " ");
    if (!writeNode(state, level, objectValue, false, false)) {
      continue;
    }
    pairBuffer += state.dump;
    _result += pairBuffer;
  }
  state.tag = _tag;
  state.dump = "{" + _result + "}";
}
function writeBlockMapping(state, level, object, compact) {
  var _result = "", _tag = state.tag, objectKeyList = Object.keys(object), index, length, objectKey, objectValue, explicitPair, pairBuffer;
  if (state.sortKeys === true) {
    objectKeyList.sort();
  } else if (typeof state.sortKeys === "function") {
    objectKeyList.sort(state.sortKeys);
  } else if (state.sortKeys) {
    throw new exception("sortKeys must be a boolean or a function");
  }
  for (index = 0, length = objectKeyList.length; index < length; index += 1) {
    pairBuffer = "";
    if (!compact || _result !== "") {
      pairBuffer += generateNextLine(state, level);
    }
    objectKey = objectKeyList[index];
    objectValue = object[objectKey];
    if (state.replacer) {
      objectValue = state.replacer.call(object, objectKey, objectValue);
    }
    if (!writeNode(state, level + 1, objectKey, true, true, true)) {
      continue;
    }
    explicitPair = state.tag !== null && state.tag !== "?" || state.dump && state.dump.length > 1024;
    if (explicitPair) {
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        pairBuffer += "?";
      } else {
        pairBuffer += "? ";
      }
    }
    pairBuffer += state.dump;
    if (explicitPair) {
      pairBuffer += generateNextLine(state, level);
    }
    if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
      continue;
    }
    if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
      pairBuffer += ":";
    } else {
      pairBuffer += ": ";
    }
    pairBuffer += state.dump;
    _result += pairBuffer;
  }
  state.tag = _tag;
  state.dump = _result || "{}";
}
function detectType(state, object, explicit) {
  var _result, typeList, index, length, type2, style;
  typeList = explicit ? state.explicitTypes : state.implicitTypes;
  for (index = 0, length = typeList.length; index < length; index += 1) {
    type2 = typeList[index];
    if ((type2.instanceOf || type2.predicate) && (!type2.instanceOf || typeof object === "object" && object instanceof type2.instanceOf) && (!type2.predicate || type2.predicate(object))) {
      if (explicit) {
        if (type2.multi && type2.representName) {
          state.tag = type2.representName(object);
        } else {
          state.tag = type2.tag;
        }
      } else {
        state.tag = "?";
      }
      if (type2.represent) {
        style = state.styleMap[type2.tag] || type2.defaultStyle;
        if (_toString.call(type2.represent) === "[object Function]") {
          _result = type2.represent(object, style);
        } else if (_hasOwnProperty.call(type2.represent, style)) {
          _result = type2.represent[style](object, style);
        } else {
          throw new exception("!<" + type2.tag + '> tag resolver accepts not "' + style + '" style');
        }
        state.dump = _result;
      }
      return true;
    }
  }
  return false;
}
function writeNode(state, level, object, block, compact, iskey, isblockseq) {
  state.tag = null;
  state.dump = object;
  if (!detectType(state, object, false)) {
    detectType(state, object, true);
  }
  var type2 = _toString.call(state.dump);
  var inblock = block;
  var tagStr;
  if (block) {
    block = state.flowLevel < 0 || state.flowLevel > level;
  }
  var objectOrArray = type2 === "[object Object]" || type2 === "[object Array]", duplicateIndex, duplicate;
  if (objectOrArray) {
    duplicateIndex = state.duplicates.indexOf(object);
    duplicate = duplicateIndex !== -1;
  }
  if (state.tag !== null && state.tag !== "?" || duplicate || state.indent !== 2 && level > 0) {
    compact = false;
  }
  if (duplicate && state.usedDuplicates[duplicateIndex]) {
    state.dump = "*ref_" + duplicateIndex;
  } else {
    if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
      state.usedDuplicates[duplicateIndex] = true;
    }
    if (type2 === "[object Object]") {
      if (block && Object.keys(state.dump).length !== 0) {
        writeBlockMapping(state, level, state.dump, compact);
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + state.dump;
        }
      } else {
        writeFlowMapping(state, level, state.dump);
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + " " + state.dump;
        }
      }
    } else if (type2 === "[object Array]") {
      if (block && state.dump.length !== 0) {
        if (state.noArrayIndent && !isblockseq && level > 0) {
          writeBlockSequence(state, level - 1, state.dump, compact);
        } else {
          writeBlockSequence(state, level, state.dump, compact);
        }
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + state.dump;
        }
      } else {
        writeFlowSequence(state, level, state.dump);
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + " " + state.dump;
        }
      }
    } else if (type2 === "[object String]") {
      if (state.tag !== "?") {
        writeScalar(state, state.dump, level, iskey, inblock);
      }
    } else if (type2 === "[object Undefined]") {
      return false;
    } else {
      if (state.skipInvalid) return false;
      throw new exception("unacceptable kind of an object to dump " + type2);
    }
    if (state.tag !== null && state.tag !== "?") {
      tagStr = encodeURI(
        state.tag[0] === "!" ? state.tag.slice(1) : state.tag
      ).replace(/!/g, "%21");
      if (state.tag[0] === "!") {
        tagStr = "!" + tagStr;
      } else if (tagStr.slice(0, 18) === "tag:yaml.org,2002:") {
        tagStr = "!!" + tagStr.slice(18);
      } else {
        tagStr = "!<" + tagStr + ">";
      }
      state.dump = tagStr + " " + state.dump;
    }
  }
  return true;
}
function getDuplicateReferences(object, state) {
  var objects = [], duplicatesIndexes = [], index, length;
  inspectNode(object, objects, duplicatesIndexes);
  for (index = 0, length = duplicatesIndexes.length; index < length; index += 1) {
    state.duplicates.push(objects[duplicatesIndexes[index]]);
  }
  state.usedDuplicates = new Array(length);
}
function inspectNode(object, objects, duplicatesIndexes) {
  var objectKeyList, index, length;
  if (object !== null && typeof object === "object") {
    index = objects.indexOf(object);
    if (index !== -1) {
      if (duplicatesIndexes.indexOf(index) === -1) {
        duplicatesIndexes.push(index);
      }
    } else {
      objects.push(object);
      if (Array.isArray(object)) {
        for (index = 0, length = object.length; index < length; index += 1) {
          inspectNode(object[index], objects, duplicatesIndexes);
        }
      } else {
        objectKeyList = Object.keys(object);
        for (index = 0, length = objectKeyList.length; index < length; index += 1) {
          inspectNode(object[objectKeyList[index]], objects, duplicatesIndexes);
        }
      }
    }
  }
}
function dump$1(input, options) {
  options = options || {};
  var state = new State(options);
  if (!state.noRefs) getDuplicateReferences(input, state);
  var value = input;
  if (state.replacer) {
    value = state.replacer.call({ "": value }, "", value);
  }
  if (writeNode(state, 0, value, true, true)) return state.dump + "\n";
  return "";
}
var dump_1 = dump$1;
var dumper = {
  dump: dump_1
};
function renamed(from, to) {
  return function() {
    throw new Error("Function yaml." + from + " is removed in js-yaml 4. Use yaml." + to + " instead, which is now safe by default.");
  };
}
var load = loader.load;
var loadAll = loader.loadAll;
var dump = dumper.dump;
var safeLoad = renamed("safeLoad", "load");
var safeLoadAll = renamed("safeLoadAll", "loadAll");
var safeDump = renamed("safeDump", "dump");

// src/utils/auth-bridge.ts
var AuthBridge = class {
  configPath;
  config = null;
  constructor() {
    this.configPath = path2.join(
      os2.homedir(),
      ".trae",
      "trae_cli.yaml"
    );
  }
  loadConfig() {
    if (this.config) return this.config;
    if (fs2.existsSync(this.configPath)) {
      try {
        const content = fs2.readFileSync(this.configPath, "utf-8");
        this.config = load(content);
        return this.config;
      } catch {
        return null;
      }
    }
    return null;
  }
  async checkAuthStatus() {
    const config = this.loadConfig();
    let authenticated = false;
    try {
      (0, import_child_process.execSync)("trae-cli config edit --help", { stdio: "ignore" });
      authenticated = true;
    } catch {
      authenticated = config !== null;
    }
    return {
      authenticated,
      model: config?.model?.name || "unknown",
      loginUrl: config?.trae_login_base_url || "https://console.enterprise.trae.cn",
      configPath: this.configPath,
      configExists: fs2.existsSync(this.configPath)
    };
  }
  getLoginBaseUrl() {
    if (!this.config) this.loadConfig();
    return this.config?.trae_login_base_url || "https://console.enterprise.trae.cn";
  }
  getModelName() {
    if (!this.config) this.loadConfig();
    return this.config?.model?.name || "unknown";
  }
  getAllowedTools() {
    if (!this.config) this.loadConfig();
    return this.config?.allowed_tools || [];
  }
  getPlugins() {
    if (!this.config) this.loadConfig();
    return this.config?.plugins || [];
  }
  buildSpawnEnv() {
    return { ...process.env };
  }
};

// src/utils/context-bridge.ts
var ContextBridge = class {
  sessionReader;
  constructor() {
    this.sessionReader = new SessionReader();
  }
  buildResumedPrompt(sessionId, newTask) {
    const context = this.sessionReader.getContextSummary(sessionId);
    const lastMessages = this.sessionReader.getConversation(sessionId, { limit: 5 });
    let contextPreview = `## \u6062\u590D\u4F1A\u8BDD ${sessionId}

`;
    contextPreview += `### \u6700\u8FD1\u5BF9\u8BDD:
`;
    for (const msg of lastMessages) {
      const preview = msg.content.length > 100 ? msg.content.substring(0, 100) + "..." : msg.content;
      contextPreview += `- **${msg.role}**: ${preview}
`;
    }
    return {
      args: ["--resume", sessionId, "--print", newTask],
      contextPreview
    };
  }
  findSessionByCwd(cwd) {
    const recent = this.sessionReader.getRecentSession(cwd);
    return recent?.id || null;
  }
  findSessionByTopic(topic) {
    const match = this.sessionReader.findSessionByTopic(topic);
    return match?.id || null;
  }
  buildContextFromSession(sessionId) {
    const meta = this.sessionReader.getSession(sessionId);
    if (!meta) return "";
    const conversation = this.sessionReader.getConversation(sessionId, { limit: 10 });
    const toolCalls = this.sessionReader.getToolCalls(sessionId);
    const fileStatus = this.sessionReader.getFileTrackStatus(sessionId);
    let context = `## Trae CLI \u4F1A\u8BDD\u4E0A\u4E0B\u6587

`;
    context += `**\u4F1A\u8BDD\u6807\u9898**: ${meta.metadata.title}
`;
    context += `**\u5DE5\u4F5C\u76EE\u5F55**: ${meta.metadata.cwd}
`;
    context += `**\u6A21\u578B**: ${meta.metadata.model_name}

`;
    if (conversation.length > 0) {
      context += `### \u5BF9\u8BDD\u6458\u8981
`;
      for (const msg of conversation) {
        const preview = msg.content.length > 150 ? msg.content.substring(0, 150) + "..." : msg.content;
        context += `- **${msg.role}**: ${preview}
`;
      }
      context += "\n";
    }
    if (toolCalls.length > 0) {
      context += `### \u5DE5\u5177\u8C03\u7528\u8BB0\u5F55 (${toolCalls.length} \u6B21)
`;
      const toolNames = [...new Set(toolCalls.map((tc) => tc.name))];
      for (const name of toolNames) {
        const count = toolCalls.filter((tc) => tc.name === name).length;
        context += `- ${name}: ${count} \u6B21
`;
      }
      context += "\n";
    }
    const trackedFiles = Object.keys(fileStatus);
    if (trackedFiles.length > 0) {
      context += `### \u5DF2\u8BBF\u95EE\u6587\u4EF6 (${trackedFiles.length} \u4E2A)
`;
      for (const f of trackedFiles.slice(0, 20)) {
        context += `- ${f}
`;
      }
      context += "\n";
    }
    return context;
  }
  injectContextToPrompt(sessionId, newPrompt) {
    const context = this.buildContextFromSession(sessionId);
    if (!context) return newPrompt;
    return `${context}
---

\u57FA\u4E8E\u4EE5\u4E0A\u4E0A\u4E0B\u6587\uFF0C\u8BF7\u7EE7\u7EED\u6267\u884C\u4EE5\u4E0B\u4EFB\u52A1:

${newPrompt}`;
  }
};

// src/utils/trae-executor.ts
var import_child_process2 = require("child_process");
var fs3 = __toESM(require("fs"));
var path3 = __toESM(require("path"));
var PLUGIN_DIR = path3.join(process.cwd(), ".claude-trae-plugin");
function ensurePluginDir() {
  if (!fs3.existsSync(PLUGIN_DIR)) {
    fs3.mkdirSync(PLUGIN_DIR, { recursive: true });
  }
}
var TraeExecutor = class {
  authBridge;
  constructor() {
    this.authBridge = new AuthBridge();
  }
  async execute(config) {
    ensurePluginDir();
    const taskId = Date.now().toString();
    const logFile = path3.join(PLUGIN_DIR, `${taskId}.log`);
    const pidFile = path3.join(PLUGIN_DIR, `${taskId}.pid`);
    const args = this.buildArgs(config);
    const env = this.authBridge.buildSpawnEnv();
    const startTime = Date.now();
    if (config.background) {
      return this.executeBackground(args, env, taskId, logFile, pidFile, startTime);
    }
    return this.executeForeground(args, env, taskId, logFile, pidFile, startTime, config.jsonOutput);
  }
  buildArgs(config) {
    const args = [];
    if (config.allowedTools) {
      for (const tool of config.allowedTools) {
        args.push("--allowed-tool", tool);
      }
    }
    if (config.disallowedTools) {
      for (const tool of config.disallowedTools) {
        args.push("--disallowed-tool", tool);
      }
    }
    if (config.yolo) args.push("--yolo");
    if (config.queryTimeout) args.push("--query-timeout", config.queryTimeout);
    if (config.bashToolTimeout) args.push("--bash-tool-timeout", config.bashToolTimeout);
    if (config.sessionId) args.push("--session-id", config.sessionId);
    if (config.resume) {
      if (config.resume === "AUTO") {
        args.push("--resume");
      } else {
        args.push("--resume", config.resume);
      }
    }
    if (config.worktree) {
      if (config.worktree === "__auto__") {
        args.push("--worktree");
      } else {
        args.push("--worktree", config.worktree);
      }
    }
    if (config.configOverrides) {
      for (const [k, v] of Object.entries(config.configOverrides)) {
        args.push("-c", `${k}=${v}`);
      }
    }
    args.push("--print");
    if (config.jsonOutput) {
      args.push("--json");
    }
    args.push(config.prompt);
    return args;
  }
  executeBackground(args, env, taskId, logFile, pidFile, startTime) {
    const out = fs3.openSync(logFile, "a");
    const err = fs3.openSync(logFile, "a");
    const child = (0, import_child_process2.spawn)("trae-cli", args, {
      detached: true,
      stdio: ["ignore", out, err],
      env
    });
    child.unref();
    if (child.pid) {
      fs3.writeFileSync(pidFile, child.pid.toString());
    }
    return {
      taskId,
      output: `\u4EFB\u52A1\u5DF2\u5728\u540E\u53F0\u542F\u52A8 (ID: ${taskId})
\u65E5\u5FD7\u6587\u4EF6: ${logFile}`,
      exitCode: null,
      duration: Date.now() - startTime
    };
  }
  executeForeground(args, env, taskId, logFile, pidFile, startTime, parseJson = false) {
    return new Promise((resolve, reject) => {
      const child = (0, import_child_process2.spawn)("trae-cli", args, {
        stdio: ["ignore", "pipe", "pipe"],
        env
      });
      if (child.pid) {
        fs3.writeFileSync(pidFile, child.pid.toString());
      }
      let combinedOutput = "";
      const append = (chunk) => {
        const text = chunk.toString();
        combinedOutput += text;
        fs3.appendFileSync(logFile, text);
      };
      child.stdout?.on("data", append);
      child.stderr?.on("data", append);
      child.on("error", (error) => {
        if (fs3.existsSync(pidFile)) fs3.unlinkSync(pidFile);
        reject(new Error(`\u6267\u884C\u5931\u8D25: ${error.message}`));
      });
      child.on("close", (code) => {
        if (fs3.existsSync(pidFile)) fs3.unlinkSync(pidFile);
        let jsonOutput = void 0;
        let sessionId;
        if (parseJson && combinedOutput.trim()) {
          try {
            jsonOutput = JSON.parse(combinedOutput);
            sessionId = jsonOutput?.session_id;
          } catch {
          }
        }
        resolve({
          taskId,
          output: combinedOutput,
          exitCode: code,
          sessionId,
          duration: Date.now() - startTime,
          jsonOutput
        });
      });
    });
  }
};

// src/utils/acp-client.ts
var http = __toESM(require("http"));
var AcpClient = class {
  baseUrl;
  constructor(baseUrl = "http://localhost:8000") {
    this.baseUrl = baseUrl;
  }
  async discoverAgents() {
    try {
      const result2 = await this.request("GET", "/agents");
      return result2.agents || [];
    } catch {
      return [];
    }
  }
  async runAgent(req) {
    return this.request("POST", "/runs", req);
  }
  async getRun(runId) {
    return this.request("GET", `/runs/${runId}`);
  }
  async runStream(req, onEvent) {
    const url = new URL("/runs/stream", this.baseUrl);
    const payload = JSON.stringify(req);
    return new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
          "Content-Length": Buffer.byteLength(payload)
        }
      };
      const httpReq = http.request(options, (res) => {
        let buffer = "";
        res.on("data", (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                onEvent(JSON.parse(line.substring(6)));
              } catch {
              }
            }
          }
        });
        res.on("end", resolve);
        res.on("error", reject);
      });
      httpReq.on("error", reject);
      httpReq.write(payload);
      httpReq.end();
    });
  }
  async healthCheck() {
    try {
      await this.request("GET", "/agents");
      return true;
    } catch {
      return false;
    }
  }
  request(method, urlPath, body) {
    const url = new URL(urlPath, this.baseUrl);
    return new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method,
        headers: {}
      };
      if (body) {
        const payload = JSON.stringify(body);
        options.headers = {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload)
        };
      }
      const req = http.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        });
      });
      req.on("error", reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
};

// src/utils/acp-server-manager.ts
var import_child_process3 = require("child_process");
var AcpServerManager = class {
  process = null;
  port = 0;
  client = null;
  async start(options) {
    if (this.isRunning()) {
      return {
        port: this.port,
        baseUrl: `http://localhost:${this.port}`
      };
    }
    return new Promise((resolve, reject) => {
      const args = ["acp", "serve"];
      if (options?.yolo) args.push("--yolo");
      if (options?.allowedTools) {
        for (const tool of options.allowedTools) {
          args.push("--allowed-tool", tool);
        }
      }
      if (options?.disabledTools) {
        for (const tool of options.disabledTools) {
          args.push("--disabled-tool", tool);
        }
      }
      const startupEvents = [];
      const outputSnippets = [];
      let started = false;
      let settled = false;
      let firstStdoutSeen = false;
      let firstStderrSeen = false;
      const recordEvent = (event, detail) => {
        startupEvents.push({
          at: (/* @__PURE__ */ new Date()).toISOString(),
          event,
          detail
        });
      };
      const rememberOutput = (source, text) => {
        const normalized = text.replace(/\s+/g, " ").trim();
        if (!normalized) return;
        outputSnippets.push(`[${source}] ${normalized}`);
        if (outputSnippets.length > 8) outputSnippets.shift();
      };
      const buildDiagnostic = () => {
        const trace = startupEvents.map((item, idx) => `${idx + 1}. ${item.at} ${item.event}${item.detail ? ` | ${item.detail}` : ""}`).join("\n");
        const recentOutput = outputSnippets.length > 0 ? outputSnippets.map((line, idx) => `${idx + 1}. ${line}`).join("\n") : "none";
        return `
[ACP] startup diagnostics
trace:
${trace || "none"}
recent_output:
${recentOutput}`;
      };
      const fail = (message) => {
        if (settled) return;
        settled = true;
        reject(new Error(`${message}${buildDiagnostic()}`));
      };
      const succeed = (port) => {
        if (settled) return;
        settled = true;
        resolve({
          port,
          baseUrl: `http://localhost:${port}`
        });
      };
      const env = { ...process.env };
      if (process.env.TRAECLI_PERSONAL_ACCESS_TOKEN) {
        env.TRAECLI_PERSONAL_ACCESS_TOKEN = process.env.TRAECLI_PERSONAL_ACCESS_TOKEN;
      }
      recordEvent("spawn:start", `cmd=trae-cli ${args.join(" ")}`);
      const child = (0, import_child_process3.spawn)("trae-cli", args, {
        stdio: ["ignore", "pipe", "pipe"],
        env
      });
      recordEvent("spawn:created", `pid=${child.pid || "unknown"}`);
      const detectPort = (text, source) => {
        rememberOutput(source, text);
        const portMatch = text.match(/listening.*?:(\d+)/i) || text.match(/port.*?(\d+)/i) || text.match(/http:\/\/localhost:(\d+)/i) || text.match(/:(\d{4,5})/);
        if (portMatch && !started) {
          started = true;
          this.port = parseInt(portMatch[1], 10);
          this.process = child;
          this.client = new AcpClient(`http://localhost:${this.port}`);
          recordEvent("port:detected", `source=${source}, port=${this.port}`);
          succeed(this.port);
        }
      };
      child.stdout?.on("data", (chunk) => {
        if (!firstStdoutSeen) {
          firstStdoutSeen = true;
          recordEvent("stdout:first-chunk");
        }
        detectPort(chunk.toString(), "stdout");
      });
      child.stderr?.on("data", (chunk) => {
        if (!firstStderrSeen) {
          firstStderrSeen = true;
          recordEvent("stderr:first-chunk");
        }
        detectPort(chunk.toString(), "stderr");
      });
      child.on("error", (err) => {
        recordEvent("process:error", err.message);
        fail(`ACP server spawn failed: ${err.message}`);
      });
      child.on("close", (code, signal) => {
        recordEvent("process:close", `code=${code ?? "null"}, signal=${signal ?? "null"}`);
        this.process = null;
        if (!started) {
          fail(`ACP server exited before port detected (code=${code ?? "null"}, signal=${signal ?? "null"})`);
        }
      });
      setTimeout(() => {
        if (!started && !settled) {
          const alive = child.exitCode === null;
          recordEvent("startup:timeout", `alive=${alive}, exitCode=${child.exitCode ?? "null"}, signalCode=${child.signalCode ?? "null"}`);
          if (alive) {
            child.kill("SIGTERM");
            fail("ACP server process is alive but no port was detected within 15s");
            return;
          }
          fail("ACP server startup timeout (15s)");
        }
      }, 15e3);
    });
  }
  async stop() {
    if (this.process) {
      this.process.kill("SIGTERM");
      await new Promise((resolve) => {
        setTimeout(() => {
          if (this.process) {
            this.process.kill("SIGKILL");
          }
          resolve();
        }, 3e3);
      });
      this.process = null;
      this.port = 0;
      this.client = null;
    }
  }
  isRunning() {
    return this.process !== null && this.process.exitCode === null;
  }
  getPort() {
    return this.port;
  }
  getClient() {
    return this.client;
  }
  getStatus() {
    return {
      running: this.isRunning(),
      port: this.port,
      baseUrl: this.port ? `http://localhost:${this.port}` : ""
    };
  }
};

// src/utils.ts
var execAsync = (0, import_util.promisify)(import_child_process4.exec);
var PLUGIN_DIR2 = path4.join(process.cwd(), ".claude-trae-plugin");
function isSafeGitRef(ref) {
  return /^[A-Za-z0-9._\/-]+$/.test(ref);
}
async function isTraeCliInstalled() {
  try {
    await execAsync("which trae-cli");
    return true;
  } catch {
    return false;
  }
}
async function getGitDiff(baseBranch = "main") {
  const safeBase = isSafeGitRef(baseBranch) ? baseBranch : "main";
  try {
    const { stdout } = await execAsync(`git diff ${safeBase}...HEAD`);
    return stdout;
  } catch (error) {
    try {
      const { stdout } = await execAsync("git diff");
      return stdout;
    } catch {
      return "\u65E0\u6CD5\u83B7\u53D6 git diff\uFF0C\u53EF\u80FD\u4E0D\u5728 git \u4ED3\u5E93\u4E2D\u3002";
    }
  }
}
function ensurePluginDir2() {
  if (!fs4.existsSync(PLUGIN_DIR2)) {
    fs4.mkdirSync(PLUGIN_DIR2, { recursive: true });
  }
}
async function runTraeCli(prompt, background = false) {
  ensurePluginDir2();
  const timestamp2 = Date.now();
  const logFile = path4.join(PLUGIN_DIR2, `${timestamp2}.log`);
  const pidFile = path4.join(PLUGIN_DIR2, `${timestamp2}.pid`);
  if (background) {
    const out = fs4.openSync(logFile, "a");
    const err = fs4.openSync(logFile, "a");
    const child = (0, import_child_process4.spawn)("trae-cli", ["--print", prompt], {
      detached: true,
      stdio: ["ignore", out, err]
    });
    child.unref();
    if (child.pid) {
      fs4.writeFileSync(pidFile, child.pid.toString());
    }
    return `\u4EFB\u52A1\u5DF2\u5728\u540E\u53F0\u542F\u52A8 (ID: ${timestamp2})\u3002
\u4F7F\u7528 /trae:status \u67E5\u770B\u72B6\u6001\uFF0C\u6216\u67E5\u770B\u65E5\u5FD7\u6587\u4EF6\uFF1A${logFile}`;
  }
  return new Promise((resolve, reject) => {
    const child = (0, import_child_process4.spawn)("trae-cli", ["--print", prompt], {
      stdio: ["ignore", "pipe", "pipe"]
    });
    if (child.pid) {
      fs4.writeFileSync(pidFile, child.pid.toString());
    }
    let combinedOutput = "";
    const append = (chunk, isErr = false) => {
      const text = chunk.toString();
      combinedOutput += text;
      fs4.appendFileSync(logFile, text);
      if (isErr) {
        process.stderr.write(chunk);
      } else {
        process.stdout.write(chunk);
      }
    };
    child.stdout?.on("data", (chunk) => append(chunk, false));
    child.stderr?.on("data", (chunk) => append(chunk, true));
    child.on("error", (error) => {
      if (fs4.existsSync(pidFile)) fs4.unlinkSync(pidFile);
      reject(new Error(`\u6267\u884C\u5931\u8D25: ${error.message}`));
    });
    child.on("close", (code) => {
      if (fs4.existsSync(pidFile)) fs4.unlinkSync(pidFile);
      if (code === 0) {
        resolve(combinedOutput);
      } else {
        reject(new Error(`\u6267\u884C\u5931\u8D25: trae-cli \u9000\u51FA\u7801 ${code}\u3002\u65E5\u5FD7: ${logFile}`));
      }
    });
  });
}

// src/commands/setup.ts
async function setup(args) {
  console.log("\u68C0\u67E5 trae-cli \u72B6\u6001...\n");
  const installed = await isTraeCliInstalled();
  if (!installed) {
    console.log("\u274C trae-cli \u672A\u5B89\u88C5\u6216\u672A\u5728 PATH \u4E2D\u627E\u5230\u3002");
    console.log("\n\u8BF7\u6309\u7167\u4EE5\u4E0B\u6B65\u9AA4\u5B89\u88C5\uFF1A");
    console.log("1. \u8BBF\u95EE https://docs.trae.cn/cli \u83B7\u53D6\u5B89\u88C5\u6307\u5357");
    console.log("2. \u5B89\u88C5\u5B8C\u6210\u540E\u8FD0\u884C trae-cli \u5B8C\u6210\u767B\u5F55\u8BA4\u8BC1");
    console.log("3. \u518D\u6B21\u8FD0\u884C /trae:setup \u9A8C\u8BC1");
    return;
  }
  console.log("\u2705 trae-cli \u5DF2\u5B89\u88C5\u5E76\u53EF\u7528\uFF01\n");
  const authBridge = new AuthBridge();
  const authStatus = await authBridge.checkAuthStatus();
  console.log("## \u8BA4\u8BC1\u72B6\u6001\n");
  console.log(`  \u5DF2\u8BA4\u8BC1: ${authStatus.authenticated ? "\u2705" : "\u274C"}`);
  console.log(`  \u914D\u7F6E\u6587\u4EF6: ${authStatus.configPath} (${authStatus.configExists ? "\u5B58\u5728" : "\u4E0D\u5B58\u5728"})`);
  console.log(`  \u6A21\u578B: ${authStatus.model}`);
  console.log(`  \u767B\u5F55\u5730\u5740: ${authStatus.loginUrl}`);
  if (!authStatus.authenticated) {
    console.log("\n\u26A0\uFE0F trae-cli \u5C1A\u672A\u5B8C\u6210\u8BA4\u8BC1\u3002\u8BF7\u8FD0\u884C trae-cli \u5B8C\u6210\u767B\u5F55\u3002");
  }
  const allowedTools = authBridge.getAllowedTools();
  if (allowedTools.length > 0) {
    console.log(`
  \u5DF2\u5141\u8BB8\u7684\u5DE5\u5177: ${allowedTools.join(", ")}`);
  }
  const plugins = authBridge.getPlugins();
  if (plugins.length > 0) {
    console.log(`
  \u5DF2\u5B89\u88C5\u7684\u63D2\u4EF6:`);
    for (const p of plugins) {
      console.log(`    - ${p.name} (${p.type}: ${p.source}) ${p.enabled ? "\u2705" : "\u274C"}`);
    }
  }
  console.log("\n## ACP/MCP \u670D\u52A1\n");
  console.log("  ACP Server: trae-cli acp serve");
  console.log("  MCP Server: trae-cli mcp serve");
  console.log("\n\u4F7F\u7528 /trae:acp start \u542F\u52A8 ACP Server");
  console.log("\u4F7F\u7528 /trae:sessions list \u67E5\u770B\u5386\u53F2\u4F1A\u8BDD");
}

// src/utils/branch-detection.ts
var import_child_process5 = require("child_process");
async function detectBaseBranch() {
  const commonBranches = ["main", "master", "develop", "dev", "mainline"];
  try {
    const upstream = (0, import_child_process5.execSync)("git rev-parse --abbrev-ref --symbolic-full-name @{u}", {
      encoding: "utf-8"
    }).trim();
    if (upstream) {
      const base = upstream.split("/").pop();
      if (base && commonBranches.includes(base.toLowerCase())) {
        return base;
      }
    }
  } catch {
  }
  try {
    const currentBranch = (0, import_child_process5.execSync)("git branch --show-current", { encoding: "utf-8" }).trim();
    if (commonBranches.includes(currentBranch.toLowerCase())) {
      return "main";
    }
  } catch {
  }
  try {
    const remoteDefault = (0, import_child_process5.execSync)('git remote show origin | grep "HEAD branch" | sed "s/.*: //"', {
      encoding: "utf-8"
    }).trim();
    if (remoteDefault) {
      return remoteDefault;
    }
  } catch {
  }
  for (const branch of commonBranches) {
    try {
      (0, import_child_process5.execSync)(`git rev-parse --verify ${branch}`, { stdio: "ignore" });
      return branch;
    } catch {
      continue;
    }
  }
  return "main";
}
async function getUntrackedFiles() {
  try {
    const output = (0, import_child_process5.execSync)("git status --porcelain", { encoding: "utf-8" }).trim();
    if (!output) return [];
    return output.split("\n").filter((line) => line.startsWith("??")).map((line) => line.substring(3).trim());
  } catch {
    return [];
  }
}
async function estimateReviewSize(baseBranch) {
  let linesAdded = 0;
  let linesDeleted = 0;
  let filesChanged = 0;
  try {
    const diffStats = (0, import_child_process5.execSync)(`git diff --shortstat ${baseBranch}...HEAD`, {
      encoding: "utf-8"
    }).trim();
    if (diffStats) {
      const match = diffStats.match(/(\d+)\s+files? changed.*?(\d+)\s+insertions.*?(\d+)\s+deletions/);
      if (match) {
        filesChanged = parseInt(match[1]) || 0;
        linesAdded = parseInt(match[2]) || 0;
        linesDeleted = parseInt(match[3]) || 0;
      }
    }
  } catch {
    try {
      const diffStats = (0, import_child_process5.execSync)("git diff --shortstat", { encoding: "utf-8" }).trim();
      if (diffStats) {
        const match = diffStats.match(/(\d+)\s+files? changed/);
        if (match) {
          filesChanged = parseInt(match[1]) || 0;
        }
      }
    } catch {
    }
  }
  const untrackedFiles = await getUntrackedFiles();
  const totalChanges = linesAdded + linesDeleted;
  let estimatedTime;
  if (totalChanges < 100) {
    estimatedTime = "quick";
  } else if (totalChanges < 500) {
    estimatedTime = "moderate";
  } else if (totalChanges < 2e3) {
    estimatedTime = "lengthy";
  } else {
    estimatedTime = "very_large";
  }
  let useBackground = false;
  let reason = "";
  if (totalChanges < 100) {
    useBackground = false;
    reason = "\u53D8\u66F4\u8F83\u5C0F\uFF0C\u53EF\u4EE5\u540C\u6B65\u7B49\u5F85";
  } else if (totalChanges < 500) {
    useBackground = true;
    reason = "\u53D8\u66F4\u9002\u4E2D\uFF0C\u5EFA\u8BAE\u540E\u53F0\u8FD0\u884C";
  } else if (totalChanges < 2e3) {
    useBackground = true;
    reason = "\u53D8\u66F4\u8F83\u5927\uFF0C\u5EFA\u8BAE\u540E\u53F0\u8FD0\u884C";
  } else {
    useBackground = true;
    reason = "\u53D8\u66F4\u975E\u5E38\u5927\uFF0C\u5EFA\u8BAE\u540E\u53F0\u8FD0\u884C\u6216\u62C6\u5206\u5BA1\u67E5";
  }
  return {
    baseBranch,
    linesAdded,
    linesDeleted,
    filesChanged,
    untrackedFiles,
    estimatedTime,
    recommendation: { useBackground, reason }
  };
}
function formatEstimate(estimate) {
  const lines = [
    "\u{1F4CA} \u5BA1\u67E5\u4F30\u7B97:",
    `   \u57FA\u51C6\u5206\u652F: ${estimate.baseBranch}`,
    `   \u53D8\u66F4: +${estimate.linesAdded} -${estimate.linesDeleted} \u884C`,
    `   \u6587\u4EF6: ${estimate.filesChanged} \u4E2A`
  ];
  if (estimate.untrackedFiles.length > 0) {
    lines.push(`   \u672A\u8DDF\u8E2A: ${estimate.untrackedFiles.length} \u4E2A\u6587\u4EF6`);
  }
  const timeMap = {
    quick: "\u5FEB\u901F (1-2\u5206\u949F)",
    moderate: "\u4E2D\u7B49 (5-10\u5206\u949F)",
    lengthy: "\u8F83\u957F (10-30\u5206\u949F)",
    very_large: "\u975E\u5E38\u957F (30\u5206\u949F+)"
  };
  lines.push(`   \u9884\u8BA1\u65F6\u95F4: ${timeMap[estimate.estimatedTime]}`);
  lines.push("");
  lines.push(`\u{1F4A1} \u5EFA\u8BAE: ${estimate.recommendation.reason}`);
  return lines.join("\n");
}

// src/commands/review.ts
var executor = new TraeExecutor();
async function review(args, isAdversarial = false) {
  let baseBranch = "main";
  const config = { prompt: "" };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--base" && args[i + 1]) {
      baseBranch = args[i + 1];
      i++;
    }
    if (args[i] === "--background") {
      config.background = true;
    }
    if (args[i] === "--yolo" || args[i] === "-y") {
      config.yolo = true;
    }
    if (args[i] === "--json") {
      config.jsonOutput = true;
    }
    if (args[i] === "--session-id" && args[i + 1]) {
      config.sessionId = args[i + 1];
      i++;
    }
  }
  if (!args.includes("--base")) {
    console.log("\u{1F50D} \u81EA\u52A8\u68C0\u6D4B\u57FA\u51C6\u5206\u652F...");
    baseBranch = await detectBaseBranch();
  }
  console.log(`\u{1F4CA} \u5206\u6790\u53D8\u66F4\u5927\u5C0F...`);
  const estimate = await estimateReviewSize(baseBranch);
  console.log(formatEstimate(estimate));
  if (!config.background && estimate.recommendation.useBackground) {
    console.log("\u{1F4A1} \u81EA\u52A8\u542F\u7528\u540E\u53F0\u6A21\u5F0F (\u4F7F\u7528 --background \u8986\u76D6)");
    config.background = true;
  }
  console.log(`
\u83B7\u53D6\u4E0E ${baseBranch} \u7684\u5DEE\u5F02...`);
  const diff = await getGitDiff(baseBranch);
  if (!diff.trim()) {
    console.log("\u6CA1\u6709\u68C0\u6D4B\u5230\u4EFB\u4F55\u4EE3\u7801\u53D8\u66F4\u3002");
    return;
  }
  let reviewPrompt = isAdversarial ? `\u4F5C\u4E3A\u4E00\u4F4D\u6781\u5EA6\u4E25\u82DB\u7684\u5BF9\u6297\u6027\u4EE3\u7801\u5BA1\u67E5\u5458\uFF0C\u8BF7\u4ED4\u7EC6\u68C0\u67E5\u4EE5\u4E0B\u53D8\u66F4\u3002\u4F60\u9700\u8981\u4E13\u95E8\u6311\u523A\u3001\u8D28\u7591\u5047\u8BBE\u3001\u627E\u51FA\u6240\u6709\u6F5C\u5728\u7684\u5B89\u5168\u6F0F\u6D1E\u3001\u6027\u80FD\u74F6\u9888\u3001\u903B\u8F91\u9519\u8BEF\u6216\u4E0D\u7B26\u5408\u6700\u4F73\u5B9E\u8DF5\u7684\u5730\u65B9\u3002\u52A1\u5FC5\u5439\u6BDB\u6C42\u75B5\uFF0C\u7ED9\u51FA\u81F4\u547D\u7684\u53CD\u9988\u610F\u89C1\u3002` : `\u8BF7\u5BF9\u4EE5\u4E0B\u4EE3\u7801\u53D8\u66F4\u8FDB\u884C\u6807\u51C6\u7684\u4E13\u4E1A\u4EE3\u7801\u5BA1\u67E5\u3002\u627E\u51FA\u6F5C\u5728\u7684\u9519\u8BEF\u3001\u6027\u80FD\u95EE\u9898\u3001\u63D0\u51FA\u6539\u8FDB\u5EFA\u8BAE\uFF0C\u5E76\u603B\u7ED3\u4E3B\u8981\u53D8\u52A8\uFF1A`;
  config.prompt = `${reviewPrompt}

\u4EE3\u7801\u53D8\u66F4\u5982\u4E0B:
\`\`\`diff
${diff}
\`\`\``;
  console.log("\u63D0\u4EA4\u4EE3\u7801\u5BA1\u67E5\u8BF7\u6C42\u5230 Trae Agent...");
  try {
    const result2 = await executor.execute(config);
    if (config.jsonOutput && result2.jsonOutput) {
      console.log("\n## \u7ED3\u6784\u5316\u5BA1\u67E5\u7ED3\u679C\n");
      console.log(JSON.stringify(result2.jsonOutput, null, 2));
    } else if (config.background) {
      console.log("\n\u5BA1\u67E5\u7ED3\u679C:\n");
      console.log(result2.output);
    } else {
      if (result2.output) {
        console.log("\n## \u5BA1\u67E5\u7ED3\u679C\n");
        console.log(result2.output);
      }
    }
    if (result2.sessionId) {
      console.log(`
\u4F1A\u8BDD ID: ${result2.sessionId}`);
      console.log(`\u4F7F\u7528 /trae:run "\u7EE7\u7EED\u5BA1\u67E5" --resume ${result2.sessionId} \u6062\u590D\u8BE5\u4F1A\u8BDD`);
    }
  } catch (error) {
    console.error("\u5BA1\u67E5\u6267\u884C\u51FA\u9519:", error.message);
  }
}

// src/commands/run.ts
var executor2 = new TraeExecutor();
var bridge = new ContextBridge();
async function runTask(args) {
  const config = { prompt: "" };
  const promptParts = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--background") {
      config.background = true;
    } else if (arg === "--json") {
      config.jsonOutput = true;
    } else if (arg === "--yolo" || arg === "-y") {
      config.yolo = true;
    } else if (arg === "--resume" && args[i + 1] && !args[i + 1].startsWith("-")) {
      config.resume = args[i + 1];
      i++;
    } else if (arg === "--resume" || arg === "--resume=AUTO") {
      config.resume = "AUTO";
    } else if (arg.startsWith("--resume=")) {
      config.resume = arg.substring("--resume=".length);
    } else if (arg === "--session-id" && args[i + 1]) {
      config.sessionId = args[i + 1];
      i++;
    } else if ((arg === "--worktree" || arg === "-w") && args[i + 1] && !args[i + 1].startsWith("-")) {
      config.worktree = args[i + 1];
      i++;
    } else if (arg === "--worktree" || arg === "-w") {
      config.worktree = "__auto__";
    } else if (arg.startsWith("--worktree=")) {
      config.worktree = arg.substring("--worktree=".length);
    } else if (arg === "--allowed-tool" && args[i + 1]) {
      config.allowedTools = config.allowedTools || [];
      config.allowedTools.push(args[i + 1]);
      i++;
    } else if (arg === "--disallowed-tool" && args[i + 1]) {
      config.disallowedTools = config.disallowedTools || [];
      config.disallowedTools.push(args[i + 1]);
      i++;
    } else if (arg === "--query-timeout" && args[i + 1]) {
      config.queryTimeout = args[i + 1];
      i++;
    } else if (arg === "--bash-tool-timeout" && args[i + 1]) {
      config.bashToolTimeout = args[i + 1];
      i++;
    } else if (arg === "-c" && args[i + 1]) {
      const override = args[i + 1];
      config.configOverrides = config.configOverrides || {};
      const eqIdx = override.indexOf("=");
      if (eqIdx > 0) {
        config.configOverrides[override.substring(0, eqIdx)] = override.substring(eqIdx + 1);
      }
      i++;
    } else if (arg === "--inject-context" && args[i + 1]) {
      const sessionId = args[i + 1];
      const context = bridge.buildContextFromSession(sessionId);
      if (context) {
        promptParts.push(context);
      }
      i++;
    } else if (!arg.startsWith("-")) {
      promptParts.push(arg);
    }
  }
  config.prompt = promptParts.join(" ");
  if (!config.prompt) {
    console.log("\u8BF7\u63D0\u4F9B\u8981\u6267\u884C\u7684\u4EFB\u52A1\u63CF\u8FF0\uFF0C\u4F8B\u5982:");
    console.log('  /trae:run "\u91CD\u6784\u7528\u6237\u6A21\u5757"');
    console.log('  /trae:run "\u4FEE\u590Dbug" --yolo');
    console.log('  /trae:run "\u7EE7\u7EED\u4EFB\u52A1" --resume');
    console.log('  /trae:run "\u65B0\u4EFB\u52A1" --session-id my-session');
    console.log('  /trae:run "\u9694\u79BB\u5F00\u53D1" --worktree');
    console.log('  /trae:run "\u4EFB\u52A1" --json');
    console.log('  /trae:run "\u4EFB\u52A1" --inject-context <session-id>');
    return;
  }
  if (config.resume) {
    console.log(`\u6062\u590D\u4F1A\u8BDD: ${config.resume === "AUTO" ? "\u81EA\u52A8\u68C0\u6D4B\u6700\u8FD1\u4F1A\u8BDD" : config.resume}`);
  }
  if (config.worktree) {
    console.log(`\u4F7F\u7528\u9694\u79BB worktree: ${config.worktree === "__auto__" ? "\u81EA\u52A8\u751F\u6210" : config.worktree}`);
  }
  console.log("\u6B63\u5C06\u4EFB\u52A1\u59D4\u6258\u7ED9 Trae Agent...");
  try {
    const result2 = await executor2.execute(config);
    if (config.jsonOutput && result2.jsonOutput) {
      console.log("\n## \u7ED3\u6784\u5316\u8F93\u51FA\n");
      console.log(JSON.stringify(result2.jsonOutput, null, 2));
      if (result2.sessionId) {
        console.log(`
\u4F1A\u8BDD ID: ${result2.sessionId}`);
      }
    } else if (config.background) {
      console.log("\n" + result2.output);
    } else {
      if (result2.sessionId) {
        console.log(`
\u4F1A\u8BDD ID: ${result2.sessionId}`);
        console.log(`\u4F7F\u7528 /trae:run "\u7EE7\u7EED" --resume ${result2.sessionId} \u6062\u590D\u8BE5\u4F1A\u8BDD`);
      }
    }
  } catch (error) {
    console.error("\u4EFB\u52A1\u6267\u884C\u51FA\u9519:", error.message);
  }
}

// src/commands/jobs.ts
var fs5 = __toESM(require("fs"));
var path5 = __toESM(require("path"));
var PLUGIN_DIR3 = path5.join(process.cwd(), ".claude-trae-plugin");
function getJobs() {
  if (!fs5.existsSync(PLUGIN_DIR3)) {
    return [];
  }
  const files = fs5.readdirSync(PLUGIN_DIR3);
  const pids = files.filter((f) => f.endsWith(".pid")).map((f) => f.replace(".pid", ""));
  return pids.map((pid) => {
    const timestamp2 = parseInt(pid, 10);
    const logFile = path5.join(PLUGIN_DIR3, `${pid}.log`);
    const pidFile = path5.join(PLUGIN_DIR3, `${pid}.pid`);
    let status2 = "\u672A\u77E5";
    if (fs5.existsSync(pidFile)) {
      try {
        const processId = fs5.readFileSync(pidFile, "utf-8").trim();
        process.kill(parseInt(processId, 10), 0);
        status2 = "\u8FD0\u884C\u4E2D";
      } catch (e) {
        if (e.code === "ESRCH") {
          status2 = "\u5DF2\u5B8C\u6210\u6216\u5DF2\u4E2D\u6B62";
        } else {
          status2 = "\u65E0\u6CD5\u9A8C\u8BC1\u72B6\u6001";
        }
      }
    } else {
      status2 = "\u5DF2\u5B8C\u6210\u6216\u5DF2\u4E2D\u6B62";
    }
    return { id: pid, timestamp: timestamp2, status: status2, logFile, pidFile };
  });
}
function status(args) {
  const jobs = getJobs();
  if (jobs.length === 0) {
    console.log("\u5F53\u524D\u6CA1\u6709\u8FD0\u884C\u6216\u8BB0\u5F55\u7684\u540E\u53F0\u4EFB\u52A1\u3002");
    return;
  }
  console.log("\u540E\u53F0\u4EFB\u52A1\u72B6\u6001:\n");
  jobs.forEach((job) => {
    const date = new Date(job.timestamp).toLocaleString();
    console.log(`[ID: ${job.id}] (${date}) \u72B6\u6001: ${job.status}`);
  });
}
function result(args) {
  const id = args[0];
  if (!id) {
    console.log("\u8BF7\u63D0\u4F9B\u4EFB\u52A1 ID\u3002\u4F8B\u5982: /trae:result 1633022... \n\u4F60\u53EF\u4EE5\u7528 /trae:status \u83B7\u53D6\u4EFB\u52A1 ID\u3002");
    return;
  }
  const logFile = path5.join(PLUGIN_DIR3, `${id}.log`);
  if (!fs5.existsSync(logFile)) {
    console.log(`\u627E\u4E0D\u5230 ID \u4E3A ${id} \u7684\u65E5\u5FD7\u6587\u4EF6\u3002`);
    return;
  }
  const content = fs5.readFileSync(logFile, "utf-8");
  console.log(`\u4EFB\u52A1 ${id} \u7684\u7ED3\u679C\u8F93\u51FA:
`);
  console.log(content);
}
function cancel(args) {
  const id = args[0];
  if (!id) {
    console.log("\u8BF7\u63D0\u4F9B\u8981\u53D6\u6D88\u7684\u4EFB\u52A1 ID\u3002\u4F8B\u5982: /trae:cancel 1633022... \n\u4F60\u53EF\u4EE5\u7528 /trae:status \u83B7\u53D6\u4EFB\u52A1 ID\u3002");
    return;
  }
  const pidFile = path5.join(PLUGIN_DIR3, `${id}.pid`);
  if (!fs5.existsSync(pidFile)) {
    console.log(`\u627E\u4E0D\u5230 ID \u4E3A ${id} \u7684\u4EFB\u52A1\u8BB0\u5F55\u3002\u5B83\u53EF\u80FD\u5DF2\u7ECF\u5B8C\u6210\u6216\u88AB\u6E05\u7406\u3002`);
    return;
  }
  try {
    const pidStr = fs5.readFileSync(pidFile, "utf-8").trim();
    const pid = parseInt(pidStr, 10);
    process.kill(pid, "SIGKILL");
    console.log(`\u5DF2\u53D1\u9001\u5F3A\u5236\u7EC8\u6B62\u4FE1\u53F7\u7ED9\u4EFB\u52A1 ${id} (PID: ${pid})\u3002`);
    fs5.unlinkSync(pidFile);
  } catch (e) {
    if (e.code === "ESRCH") {
      console.log(`\u4EFB\u52A1 ${id} \u7684\u8FDB\u7A0B\u5DF2\u7ECF\u4E0D\u518D\u8FD0\u884C\u3002`);
    } else {
      console.error(`\u53D6\u6D88\u4EFB\u52A1\u65F6\u53D1\u751F\u9519\u8BEF: ${e.message}`);
    }
  }
}

// src/commands/hooks.ts
var import_child_process6 = require("child_process");
var import_path = __toESM(require("path"));
async function handleHook(args) {
  const hookType = args[0];
  if (!hookType) {
    console.error("Usage: trae-plugin-cc hooks <session-start|session-end|stop-gate>");
    process.exit(1);
  }
  const hookMap = {
    "session-start": { script: "session-lifecycle-hook.mjs", arg: "SessionStart" },
    "session-end": { script: "session-lifecycle-hook.mjs", arg: "SessionEnd" },
    "stop-gate": { script: "stop-review-gate-hook.mjs", arg: "" }
  };
  const entry = hookMap[hookType];
  if (!entry) {
    console.error(`Unknown hook type: ${hookType}`);
    console.error(`Available: ${Object.keys(hookMap).join(", ")}`);
    process.exit(1);
  }
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || import_path.default.join(__dirname, "..");
  const scriptPath = import_path.default.join(pluginRoot, "scripts", entry.script);
  const spawnArgs = entry.arg ? [scriptPath, entry.arg] : [scriptPath];
  return new Promise((resolve, reject) => {
    const child = (0, import_child_process6.spawn)("node", spawnArgs, {
      stdio: "inherit",
      detached: false
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve(void 0);
      } else {
        reject(new Error(`Hook exited with code ${code}`));
      }
    });
    child.on("error", reject);
  });
}

// src/commands/rescue.ts
var import_child_process7 = require("child_process");
var import_fs = require("fs");
var import_path2 = require("path");
var PLUGIN_DIR4 = ".claude-trae-plugin";
function getLastError() {
  const pluginDir = (0, import_path2.join)(process.cwd(), PLUGIN_DIR4);
  if (!(0, import_fs.existsSync)(pluginDir)) return null;
  try {
    const files = (0, import_fs.readdirSync)(pluginDir);
    const logs = files.filter((f) => f.endsWith(".log"));
    if (logs.length === 0) return null;
    logs.sort().reverse();
    const latestLog = logs[0];
    const logPath = (0, import_path2.join)(pluginDir, latestLog);
    return (0, import_fs.readFileSync)(logPath, "utf-8");
  } catch {
    return null;
  }
}
function getGitStatus() {
  try {
    return (0, import_child_process7.execSync)("git status --short", { encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}
function getRecentChanges() {
  try {
    return (0, import_child_process7.execSync)("git diff --stat -10", { encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}
async function rescue(args) {
  let context = "";
  let retries = 3;
  let force = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--context" && args[i + 1]) {
      context = args[i + 1];
      i++;
    } else if (args[i] === "--retries" && args[i + 1]) {
      retries = parseInt(args[i + 1]) || 3;
      i++;
    } else if (args[i] === "--force") {
      force = true;
    }
  }
  console.log("\u{1F527} [Trae Plugin] Rescue Mode");
  console.log("\u2500".repeat(40));
  const lastError = getLastError();
  const gitStatus = getGitStatus();
  const recentChanges = getRecentChanges();
  console.log("\u{1F4CA} \u6536\u96C6\u6545\u969C\u4FE1\u606F...");
  if (lastError) {
    console.log("\n\u{1F4DD} \u6700\u8FD1\u9519\u8BEF:");
    const errorLines = lastError.split("\n").slice(-10);
    console.log(errorLines.join("\n"));
  }
  if (gitStatus) {
    console.log("\n\u{1F4C1} \u5F53\u524D\u53D8\u66F4:");
    console.log(gitStatus);
  }
  if (recentChanges) {
    console.log("\n\u{1F4C8} \u6700\u8FD1\u63D0\u4EA4:");
    console.log(recentChanges);
  }
  if (context) {
    console.log("\n\u{1F4CB} \u7528\u6237\u63D0\u4F9B\u4E0A\u4E0B\u6587:");
    console.log(context);
  }
  console.log("\n\u{1F50D} \u6B63\u5728\u5206\u6790\u95EE\u9898...");
  const diagnosisPrompt = `\u4F5C\u4E3A Trae Agent \u7684\u6545\u969C\u8BCA\u65AD\u52A9\u624B\uFF0C\u8BF7\u5206\u6790\u4EE5\u4E0B\u5931\u8D25\u4E0A\u4E0B\u6587\u5E76\u63D0\u4F9B\u6062\u590D\u5EFA\u8BAE\uFF1A

${lastError ? `\u9519\u8BEF\u8F93\u51FA:
${lastError}
` : ""}
${gitStatus ? `Git \u72B6\u6001:
${gitStatus}
` : ""}
${context ? `\u9644\u52A0\u4E0A\u4E0B\u6587:
${context}
` : ""}

\u8BF7\u63D0\u4F9B:
1. \u95EE\u9898\u8BCA\u65AD: \u53EF\u80FD\u7684\u539F\u56E0\u662F\u4EC0\u4E48\uFF1F
2. \u6062\u590D\u5EFA\u8BAE: \u5E94\u8BE5\u5C1D\u8BD5\u4EC0\u4E48\u64CD\u4F5C\uFF1F
3. \u9884\u9632\u5EFA\u8BAE: \u5982\u4F55\u907F\u514D\u7C7B\u4F3C\u95EE\u9898\uFF1F`;
  try {
    console.log("\u2500".repeat(40));
    const result2 = await runTraeCli(diagnosisPrompt, false);
    console.log("\n\u{1F4A1} \u8BCA\u65AD\u7ED3\u679C:");
    console.log(result2);
  } catch (error) {
    console.error("\u274C \u8BCA\u65AD\u5931\u8D25:", error.message);
  }
  console.log("\u2500".repeat(40));
}

// src/commands/sessions.ts
var reader = new SessionReader();
var bridge2 = new ContextBridge();
async function sessions(args) {
  const action = args[0] || "list";
  switch (action) {
    case "list":
      return listSessions(args);
    case "detail":
      return detailSession(args);
    case "conversation":
      return conversationSession(args);
    case "tools":
      return toolsSession(args);
    case "context":
      return contextSession(args);
    case "recent":
      return recentSession(args);
    case "find":
      return findSession(args);
    case "delete":
      return deleteSession(args);
    case "delete-smoke":
      return deleteSmokeSessions(args);
    default:
      console.log("\u7528\u6CD5: /trae:sessions <action> [options]");
      console.log("\u52A8\u4F5C:");
      console.log("  list          \u5217\u51FA\u6240\u6709\u4F1A\u8BDD (\u9ED8\u8BA4)");
      console.log("  recent        \u67E5\u770B\u6700\u8FD1\u4F1A\u8BDD");
      console.log("  detail <id>   \u67E5\u770B\u4F1A\u8BDD\u8BE6\u60C5");
      console.log("  conversation <id>  \u83B7\u53D6\u5BF9\u8BDD\u5386\u53F2");
      console.log("  tools <id>    \u83B7\u53D6\u5DE5\u5177\u8C03\u7528\u8BB0\u5F55");
      console.log("  context <id>  \u83B7\u53D6\u5B8C\u6574\u4E0A\u4E0B\u6587\u6458\u8981");
      console.log("  find <topic>  \u6309\u4E3B\u9898\u641C\u7D22\u4F1A\u8BDD");
      console.log("  delete <id>   \u5220\u9664\u4F1A\u8BDD");
      console.log('  delete-smoke  \u5220\u9664\u6807\u9898\u6216ID\u5305\u542B"smoke"\u7684\u4F1A\u8BDD');
  }
}
function listSessions(args) {
  let cwd;
  let limit = 20;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--cwd" && args[i + 1]) {
      cwd = args[i + 1];
      i++;
    }
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    }
  }
  const sessions2 = reader.listSessions({ cwd, limit });
  if (sessions2.length === 0) {
    console.log("\u6CA1\u6709\u627E\u5230\u4EFB\u4F55\u4F1A\u8BDD\u8BB0\u5F55\u3002");
    return;
  }
  console.log(`
\u627E\u5230 ${sessions2.length} \u4E2A\u4F1A\u8BDD:
`);
  console.log(`  ID                                   | \u6A21\u578B          | \u5DE5\u4F5C\u76EE\u5F55                                         | \u6807\u9898`);
  console.log(`  ${"-".repeat(36)}-+-${"-".repeat(14)}-+-${"-".repeat(48)}-+-${"-".repeat(30)}`);
  for (const s of sessions2) {
    const shortId = s.id.substring(0, 36);
    const model = s.metadata.model_name.padEnd(14);
    const cwd2 = s.metadata.cwd.length > 48 ? "..." + s.metadata.cwd.substring(s.metadata.cwd.length - 45) : s.metadata.cwd.padEnd(48);
    const title = s.metadata.title.length > 30 ? s.metadata.title.substring(0, 27) + "..." : s.metadata.title;
    console.log(`  ${shortId} | ${model} | ${cwd2} | ${title}`);
  }
  console.log(`
\u4F7F\u7528 /trae:sessions detail <id> \u67E5\u770B\u8BE6\u60C5`);
}
function detailSession(args) {
  const sessionId = args[1];
  if (!sessionId) {
    console.log("\u8BF7\u63D0\u4F9B\u4F1A\u8BDD ID: /trae:sessions detail <session-id>");
    return;
  }
  const meta = reader.getSession(sessionId);
  if (!meta) {
    console.log(`\u4F1A\u8BDD ${sessionId} \u4E0D\u5B58\u5728\u3002`);
    return;
  }
  console.log("\n## \u4F1A\u8BDD\u8BE6\u60C5\n");
  console.log(`  ID:       ${meta.id}`);
  console.log(`  \u6807\u9898:     ${meta.metadata.title}`);
  console.log(`  \u5DE5\u4F5C\u76EE\u5F55: ${meta.metadata.cwd}`);
  console.log(`  \u6A21\u578B:     ${meta.metadata.model_name}`);
  console.log(`  \u6743\u9650\u6A21\u5F0F: ${meta.metadata.permission_mode}`);
  console.log(`  \u521B\u5EFA\u65F6\u95F4: ${meta.created_at}`);
  console.log(`  \u66F4\u65B0\u65F6\u95F4: ${meta.updated_at}`);
  const events = reader.getEvents(sessionId);
  const eventTypes = {};
  for (const e of events) {
    for (const key of ["message", "tool_call", "tool_call_output", "state_update", "agent_start"]) {
      if (e[key]) {
        eventTypes[key] = (eventTypes[key] || 0) + 1;
      }
    }
  }
  console.log("\n  \u4E8B\u4EF6\u7EDF\u8BA1:");
  for (const [type2, count] of Object.entries(eventTypes)) {
    console.log(`    ${type2}: ${count}`);
  }
}
function conversationSession(args) {
  const sessionId = args[1];
  if (!sessionId) {
    console.log("\u8BF7\u63D0\u4F9B\u4F1A\u8BDD ID: /trae:sessions conversation <session-id>");
    return;
  }
  let limit = 50;
  for (let i = 2; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    }
  }
  const messages = reader.getConversation(sessionId, { limit });
  if (messages.length === 0) {
    console.log("\u8BE5\u4F1A\u8BDD\u6CA1\u6709\u5BF9\u8BDD\u8BB0\u5F55\u3002");
    return;
  }
  console.log(`
## \u5BF9\u8BDD\u5386\u53F2 (${messages.length} \u6761\u6D88\u606F)
`);
  for (const msg of messages) {
    const roleLabel = msg.role === "user" ? "\u{1F464} \u7528\u6237" : "\u{1F916} \u52A9\u624B";
    const content = msg.content.length > 500 ? msg.content.substring(0, 500) + "..." : msg.content;
    console.log(`**${roleLabel}** [${msg.timestamp}]:`);
    console.log(`${content}`);
    if (msg.toolCalls?.length) {
      console.log(`  \u{1F4CE} \u8C03\u7528\u5DE5\u5177: ${msg.toolCalls.join(", ")}`);
    }
    console.log("");
  }
}
function toolsSession(args) {
  const sessionId = args[1];
  if (!sessionId) {
    console.log("\u8BF7\u63D0\u4F9B\u4F1A\u8BDD ID: /trae:sessions tools <session-id>");
    return;
  }
  const toolCalls = reader.getToolCalls(sessionId);
  if (toolCalls.length === 0) {
    console.log("\u8BE5\u4F1A\u8BDD\u6CA1\u6709\u5DE5\u5177\u8C03\u7528\u8BB0\u5F55\u3002");
    return;
  }
  console.log(`
## \u5DE5\u5177\u8C03\u7528\u8BB0\u5F55 (${toolCalls.length} \u6B21)
`);
  const toolStats = {};
  for (const tc of toolCalls) {
    toolStats[tc.name] = (toolStats[tc.name] || 0) + 1;
  }
  console.log("### \u7EDF\u8BA1");
  for (const [name, count] of Object.entries(toolStats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name}: ${count} \u6B21`);
  }
  console.log("\n### \u8BE6\u7EC6\u8BB0\u5F55\n");
  for (const tc of toolCalls.slice(0, 30)) {
    const inputStr = typeof tc.input === "string" ? tc.input.substring(0, 100) : JSON.stringify(tc.input).substring(0, 100);
    const status2 = tc.isError ? "\u274C" : "\u2705";
    console.log(`${status2} **${tc.name}** [${tc.timestamp}]`);
    console.log(`  \u8F93\u5165: ${inputStr}${inputStr.length >= 100 ? "..." : ""}`);
    if (tc.output) {
      const outputStr = typeof tc.output === "string" ? tc.output.substring(0, 100) : JSON.stringify(tc.output).substring(0, 100);
      console.log(`  \u8F93\u51FA: ${outputStr}${outputStr.length >= 100 ? "..." : ""}`);
    }
    console.log("");
  }
}
function contextSession(args) {
  const sessionId = args[1];
  if (!sessionId) {
    console.log("\u8BF7\u63D0\u4F9B\u4F1A\u8BDD ID: /trae:sessions context <session-id>");
    return;
  }
  const summary = reader.getContextSummary(sessionId);
  console.log(summary);
}
function recentSession(args) {
  let cwd;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--cwd" && args[i + 1]) {
      cwd = args[i + 1];
      i++;
    }
  }
  const recent = reader.getRecentSession(cwd);
  if (!recent) {
    console.log("\u6CA1\u6709\u627E\u5230\u6700\u8FD1\u7684\u4F1A\u8BDD\u3002");
    return;
  }
  console.log("\n## \u6700\u8FD1\u4F1A\u8BDD\n");
  console.log(`  ID:       ${recent.id}`);
  console.log(`  \u6807\u9898:     ${recent.metadata.title}`);
  console.log(`  \u5DE5\u4F5C\u76EE\u5F55: ${recent.metadata.cwd}`);
  console.log(`  \u6A21\u578B:     ${recent.metadata.model_name}`);
  console.log(`  \u66F4\u65B0\u65F6\u95F4: ${recent.updated_at}`);
  console.log(`
\u4F7F\u7528 /trae:run "\u7EE7\u7EED" --resume ${recent.id} \u6062\u590D\u8BE5\u4F1A\u8BDD`);
}
function findSession(args) {
  const topic = args.slice(1).join(" ");
  if (!topic) {
    console.log("\u8BF7\u63D0\u4F9B\u641C\u7D22\u5173\u952E\u8BCD: /trae:sessions find <topic>");
    return;
  }
  const match = reader.findSessionByTopic(topic);
  if (!match) {
    console.log(`\u6CA1\u6709\u627E\u5230\u5305\u542B "${topic}" \u7684\u4F1A\u8BDD\u3002`);
    return;
  }
  console.log("\n## \u627E\u5230\u5339\u914D\u4F1A\u8BDD\n");
  console.log(`  ID:       ${match.id}`);
  console.log(`  \u6807\u9898:     ${match.metadata.title}`);
  console.log(`  \u5DE5\u4F5C\u76EE\u5F55: ${match.metadata.cwd}`);
  console.log(`  \u6A21\u578B:     ${match.metadata.model_name}`);
  console.log(`  \u66F4\u65B0\u65F6\u95F4: ${match.updated_at}`);
}
function deleteSession(args) {
  const sessionId = args[1];
  if (!sessionId) {
    console.log("\u8BF7\u63D0\u4F9B\u4F1A\u8BDD ID: /trae:sessions delete <session-id>");
    return;
  }
  const success = reader.deleteSession(sessionId);
  if (success) {
    console.log(`\u4F1A\u8BDD ${sessionId} \u5DF2\u5220\u9664\u3002`);
  } else {
    console.log(`\u5220\u9664\u4F1A\u8BDD ${sessionId} \u5931\u8D25\u3002`);
  }
}
function deleteSmokeSessions(args) {
  const allSessions = reader.listSessions();
  const smokeSessions = allSessions.filter(
    (s) => s.id.toLowerCase().includes("smoke") || s.metadata.title.toLowerCase().includes("smoke")
  );
  if (smokeSessions.length === 0) {
    console.log('\u6CA1\u6709\u627E\u5230\u5305\u542B "smoke" \u7684\u4F1A\u8BDD\u3002');
    return;
  }
  console.log(`
\u627E\u5230 ${smokeSessions.length} \u4E2A\u5305\u542B "smoke" \u7684\u4F1A\u8BDD:
`);
  for (const s of smokeSessions) {
    console.log(`  - ${s.id.substring(0, 36)} | ${s.metadata.title}`);
  }
  let deleted = 0;
  let failed = 0;
  for (const s of smokeSessions) {
    const success = reader.deleteSession(s.id);
    if (success) {
      deleted++;
    } else {
      failed++;
    }
  }
  console.log(`
\u5220\u9664\u5B8C\u6210: \u6210\u529F ${deleted} \u4E2A\uFF0C\u5931\u8D25 ${failed} \u4E2A`);
}

// src/commands/acp.ts
var serverManager = new AcpServerManager();
async function acp(args) {
  const action = args[0] || "status";
  switch (action) {
    case "start":
      return startServer(args);
    case "stop":
      return stopServer();
    case "status":
      return serverStatus();
    case "agents":
      return listAgents();
    case "run":
      return runViaAcp(args);
    case "stream":
      return streamViaAcp(args);
    default:
      console.log("\u7528\u6CD5: /trae:acp <action> [options]");
      console.log("\u52A8\u4F5C:");
      console.log("  start    \u542F\u52A8 ACP Server");
      console.log("  stop     \u505C\u6B62 ACP Server");
      console.log("  status   \u67E5\u770B\u670D\u52A1\u5668\u72B6\u6001");
      console.log("  agents   \u53D1\u73B0\u53EF\u7528 Agent");
      console.log("  run      \u901A\u8FC7 ACP \u6267\u884C\u4EFB\u52A1");
      console.log("  stream   \u901A\u8FC7 ACP \u6D41\u5F0F\u6267\u884C\u4EFB\u52A1");
  }
}
async function startServer(args) {
  const options = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--yolo") {
      options.yolo = true;
    }
    if (args[i] === "--allowed-tool" && args[i + 1]) {
      options.allowedTools = options.allowedTools || [];
      options.allowedTools.push(args[i + 1]);
      i++;
    }
    if (args[i] === "--disabled-tool" && args[i + 1]) {
      options.disabledTools = options.disabledTools || [];
      options.disabledTools.push(args[i + 1]);
      i++;
    }
  }
  console.log("\u6B63\u5728\u542F\u52A8 ACP Server...");
  try {
    const result2 = await serverManager.start(options);
    console.log(`
\u2705 ACP Server \u5DF2\u542F\u52A8`);
    console.log(`  \u7AEF\u53E3: ${result2.port}`);
    console.log(`  \u5730\u5740: ${result2.baseUrl}`);
    console.log(`
\u4F7F\u7528 /trae:acp agents \u67E5\u770B\u53EF\u7528 Agent`);
    console.log(`\u4F7F\u7528 /trae:acp run "\u4EFB\u52A1" \u6267\u884C\u4EFB\u52A1`);
  } catch (error) {
    console.error(`\u274C \u542F\u52A8\u5931\u8D25: ${error.message}`);
  }
}
async function stopServer() {
  if (!serverManager.isRunning()) {
    console.log("ACP Server \u672A\u8FD0\u884C\u3002");
    return;
  }
  console.log("\u6B63\u5728\u505C\u6B62 ACP Server...");
  await serverManager.stop();
  console.log("\u2705 ACP Server \u5DF2\u505C\u6B62\u3002");
}
async function serverStatus() {
  const status2 = serverManager.getStatus();
  console.log("\n## ACP Server \u72B6\u6001\n");
  console.log(`  \u8FD0\u884C\u4E2D: ${status2.running ? "\u2705" : "\u274C"}`);
  if (status2.running) {
    console.log(`  \u7AEF\u53E3: ${status2.port}`);
    console.log(`  \u5730\u5740: ${status2.baseUrl}`);
    const client = serverManager.getClient();
    if (client) {
      const healthy = await client.healthCheck();
      console.log(`  \u5065\u5EB7\u68C0\u67E5: ${healthy ? "\u2705 \u6B63\u5E38" : "\u274C \u5F02\u5E38"}`);
    }
  } else {
    console.log("\n\u4F7F\u7528 /trae:acp start \u542F\u52A8\u670D\u52A1\u5668");
  }
}
async function listAgents() {
  const status2 = serverManager.getStatus();
  if (!status2.running) {
    console.log("ACP Server \u672A\u8FD0\u884C\u3002\u4F7F\u7528 /trae:acp start \u542F\u52A8\u3002");
    return;
  }
  const client = serverManager.getClient();
  if (!client) {
    console.log("\u65E0\u6CD5\u83B7\u53D6 ACP Client\u3002");
    return;
  }
  try {
    const agents = await client.discoverAgents();
    if (agents.length === 0) {
      console.log("\u6CA1\u6709\u53D1\u73B0\u53EF\u7528\u7684 Agent\u3002");
      return;
    }
    console.log(`
## \u53D1\u73B0 ${agents.length} \u4E2A Agent
`);
    for (const agent of agents) {
      console.log(`### ${agent.name}`);
      console.log(`  \u63CF\u8FF0: ${agent.description}`);
      if (agent.metadata) {
        console.log(`  \u5143\u6570\u636E: ${JSON.stringify(agent.metadata)}`);
      }
      console.log("");
    }
  } catch (error) {
    console.error(`\u83B7\u53D6 Agent \u5217\u8868\u5931\u8D25: ${error.message}`);
  }
}
async function runViaAcp(args) {
  const status2 = serverManager.getStatus();
  if (!status2.running) {
    console.log("ACP Server \u672A\u8FD0\u884C\u3002\u6B63\u5728\u542F\u52A8...");
    try {
      await serverManager.start({ yolo: true });
    } catch (error) {
      console.error(`\u542F\u52A8\u5931\u8D25: ${error.message}`);
      return;
    }
  }
  const client = serverManager.getClient();
  if (!client) {
    console.log("\u65E0\u6CD5\u83B7\u53D6 ACP Client\u3002");
    return;
  }
  const prompt = args.slice(1).join(" ");
  if (!prompt) {
    console.log('\u8BF7\u63D0\u4F9B\u4EFB\u52A1\u63CF\u8FF0: /trae:acp run "\u4EFB\u52A1"');
    return;
  }
  console.log(`\u6B63\u5728\u901A\u8FC7 ACP \u6267\u884C\u4EFB\u52A1: ${prompt.substring(0, 50)}...`);
  try {
    const result2 = await client.runAgent({
      agent_name: "trae-agent",
      input: [{
        role: "user",
        parts: [{ content: prompt, content_type: "text/plain" }]
      }]
    });
    console.log("\n## \u6267\u884C\u7ED3\u679C\n");
    console.log(`  Run ID: ${result2.run_id}`);
    console.log(`  Session ID: ${result2.session_id}`);
    console.log(`  \u72B6\u6001: ${result2.status}`);
    if (result2.output && result2.output.length > 0) {
      console.log("\n### \u8F93\u51FA\n");
      for (const out of result2.output) {
        for (const part of out.parts) {
          console.log(part.content);
        }
      }
    }
    if (result2.error) {
      console.log(`
\u274C \u9519\u8BEF: ${result2.error}`);
    }
  } catch (error) {
    console.error(`\u6267\u884C\u5931\u8D25: ${error.message}`);
  }
}
async function streamViaAcp(args) {
  const status2 = serverManager.getStatus();
  if (!status2.running) {
    console.log("ACP Server \u672A\u8FD0\u884C\u3002\u6B63\u5728\u542F\u52A8...");
    try {
      await serverManager.start({ yolo: true });
    } catch (error) {
      console.error(`\u542F\u52A8\u5931\u8D25: ${error.message}`);
      return;
    }
  }
  const client = serverManager.getClient();
  if (!client) {
    console.log("\u65E0\u6CD5\u83B7\u53D6 ACP Client\u3002");
    return;
  }
  const prompt = args.slice(1).join(" ");
  if (!prompt) {
    console.log('\u8BF7\u63D0\u4F9B\u4EFB\u52A1\u63CF\u8FF0: /trae:acp stream "\u4EFB\u52A1"');
    return;
  }
  console.log(`\u6B63\u5728\u901A\u8FC7 ACP \u6D41\u5F0F\u6267\u884C\u4EFB\u52A1: ${prompt.substring(0, 50)}...`);
  console.log("--- \u6D41\u5F0F\u8F93\u51FA ---\n");
  try {
    await client.runStream(
      {
        agent_name: "trae-agent",
        input: [{
          role: "user",
          parts: [{ content: prompt, content_type: "text/plain" }]
        }]
      },
      (event) => {
        if (event.output) {
          for (const out of event.output) {
            if (out.parts) {
              for (const part of out.parts) {
                console.log(part.content);
              }
            }
          }
        }
        if (event.status) {
          console.log(`[\u72B6\u6001: ${event.status}]`);
        }
      }
    );
    console.log("\n--- \u6D41\u5F0F\u8F93\u51FA\u7ED3\u675F ---");
  } catch (error) {
    console.error(`
\u6267\u884C\u5931\u8D25: ${error.message}`);
  }
}

// src/index.ts
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const cmdArgs = args.slice(1);
  if (!command) {
    console.log("\u7528\u6CD5: trae <command> [args]");
    console.log("\u547D\u4EE4: setup, review, adversarial-review, run, status, result, cancel, sessions, acp");
    process.exit(1);
  }
  try {
    switch (command) {
      case "setup":
        await setup(cmdArgs);
        break;
      case "review":
        await review(cmdArgs, false);
        break;
      case "adversarial-review":
        await review(cmdArgs, true);
        break;
      case "run":
        await runTask(cmdArgs);
        break;
      case "status":
        status(cmdArgs);
        break;
      case "result":
        result(cmdArgs);
        break;
      case "cancel":
        cancel(cmdArgs);
        break;
      case "hooks":
        await handleHook(cmdArgs);
        break;
      case "rescue":
        await rescue(cmdArgs);
        break;
      case "sessions":
        await sessions(cmdArgs);
        break;
      case "acp":
        await acp(cmdArgs);
        break;
      default:
        console.log(`\u672A\u77E5\u547D\u4EE4: ${command}`);
        console.log("\u53EF\u7528\u547D\u4EE4: setup, review, adversarial-review, run, status, result, cancel, sessions, acp");
        process.exit(1);
    }
  } catch (error) {
    console.error("\u6267\u884C\u5931\u8D25:", error.message);
    process.exit(1);
  }
}
main();
/*! Bundled license information:

js-yaml/dist/js-yaml.mjs:
  (*! js-yaml 4.1.1 https://github.com/nodeca/js-yaml @license MIT *)
*/
