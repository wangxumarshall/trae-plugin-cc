# Refactoring Findings: trae-plugin-cc

## 1. Code Architecture Analysis

### 1.1 Major Issues

#### CRITICAL: No CLI Framework (Manual Parsing Everywhere)
- `src/commands/run.ts:11-71` — 61 lines of manual `for` loop argument parsing
- `src/commands/review.ts:11-29` — Manual loop for 5 options
- `src/commands/sessions.ts:48-56`, `131-136`, `221-225` — Repeated parsing in 3 sub-functions
- `src/commands/acp.ts:36-49` — Manual parsing for 3 options
- `src/commands/rescue.ts:49-53` — Manual parsing for --context
- No auto-generated `--help` for any subcommand
- No input validation (type, required, choices)
- No option defaults or env var support
- No tab completion support

#### CRITICAL: No CLI Entry Point Pattern
- `src/index.ts:23-61` — Hardcoded switch statement for 11 commands
- No command registry, no plugin architecture
- Manual usage/error messages
- No `-h/--help` flag support

#### HIGH: Mixed Concerns
- Command handlers mix: argument parsing + business logic + output formatting + error handling
- `src/commands/sessions.ts:309` lines doing everything
- `src/commands/acp.ts:228` lines doing everything
- No separation of presentation layer

#### HIGH: Duplicate Code
- `ensurePluginDir()` defined in both `src/utils.ts:42-46` AND `src/utils/trae-executor.ts:33-37`
- Error handling patterns inconsistent across all commands
- Arg accumulation logic repeated (allowedTools, disallowedTools patterns)

#### MEDIUM: Scattered Type Definitions
- Types inline in every file instead of centralized `src/types/`
- Only `src/types/errors.ts` exists as a types file
- `TraeTaskConfig` and `TraeTaskResult` in trae-executor.ts
- Session types in session-reader.ts
- ACP types in acp-client.ts
- `DataSource` type in session-reader.ts only

#### MEDIUM: Inconsistent Error Handling
- Some commands `process.exit(1)`, some `return`, some swallow errors
- `src/commands/review.ts:82` — exits with 1
- `src/commands/run.ts:114-116` — catches but doesn't exit with 1
- `src/commands/rescue.ts:105-107` — catches and logs, no exit code

#### MEDIUM: No Structured Logging
- Raw `console.log` with Chinese output + emoji throughout
- No configurable log levels
- Not easily testable
- No structured output option

#### MEDIUM: Missing Tests (42% Coverage Gap)
| File | Tests? | Gap |
|------|--------|-----|
| acp.ts | NONE | 228 lines untested |
| acp-client.ts | NONE | 216 lines untested |
| acp-server-manager.ts | NONE | 171 lines untested |
| sessions.ts | NONE | 309 lines untested |
| rescue.ts | NONE | 110 lines untested |
| hooks.ts | NONE | 46 lines untested |
| context-bridge.ts | NONE | 99 lines untested |
| branch-detection.ts | NONE | 188 lines untested |

#### LOW: No Lint/Typecheck Scripts
- `package.json` only has `build` and `test`
- No ESLint, no Prettier
- No commit hooks
- No coverage reports

#### LOW: Scripts Not in TypeScript
- `scripts/*.mjs` are plain JavaScript, not TypeScript
- Cannot share types between src/ and scripts/
- Duplicate `getPluginDir()`, `getRunningJobs()` logic
- But practical to keep as .mjs for child_process compatibility

## 2. Target Architecture

### 2.1 New Directory Structure
```
src/
├── cli.ts                    # Commander.js entry point
├── config/
│   └── index.ts              # Centralized configuration
├── types/
│   ├── index.ts              # All shared types
│   └── errors.ts             # Error classes (existing)
├── logger.ts                 # Structured logging
├── utils/
│   ├── env.ts                # PATH manipulation (refined)
│   ├── auth-bridge.ts        # Auth config (refined)
│   ├── branch-detection.ts   # Git utilities (refined)
│   ├── trae-executor.ts      # Core executor (refined)
│   ├── session-reader.ts     # Session parser (refined)
│   ├── context-bridge.ts     # Context injection (refined)
│   ├── acp-client.ts         # ACP protocol client (refined)
│   └── acp-server-manager.ts # ACP server manager (refined)
├── commands/
│   ├── setup.ts              # Setup command
│   ├── run.ts                # Run command
│   ├── review.ts             # Review command
│   ├── sessions.ts           # Sessions subcommands
│   ├── acp.ts                # ACP subcommands
│   ├── jobs.ts               # Status/result/cancel
│   ├── rescue.ts             # Rescue command
│   └── hooks.ts              # Hook dispatcher
├── formatters/
│   ├── table.ts              # Table output
│   ├── session.ts            # Session output
│   └── review.ts             # Review output
```

### 2.2 Dependency Additions
- `commander` - CLI framework (production)
- `eslint` + `@typescript-eslint/parser` - Linting (dev)
- `prettier` - Formatting (dev)

### 2.3 Key Patterns
- **Command Registry**: Commander.js handles dispatch, no switch statement
- **Dependency Injection**: Singleton instances at module level, not inside functions
- **Formatters**: Pure functions that take data and return strings
- **Logger**: Configurable levels (debug/info/warn/error), supports JSON output
- **Types**: Single source of truth in `src/types/index.ts`

## 3. Open Source References

### Commander.js (tj/commander.js) - 28.1k stars
- Standard for Node.js CLI - fluent API, auto-help, validation
- Subcommands with nested actions
- Option types: boolean, value, variadic, required, defaults
- Hook system: preAction, postAction
- TypeScript full support

### Google/zx - 45.4k stars
- Cross-platform process spawning
- Pipe-based composition
- Sensible defaults for child_process
- Template literal command building

### CLI Best Practices Applied
- Single responsibility per module
- Pure functions for formatting
- Composition over inheritance
- Test-driven development
- Semantic versioning
- Conventional commits
