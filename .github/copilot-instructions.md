# AI Agent Instructions for KayraDeniz Code Assistant

## Project Overview

KayraDeniz is an Electron-based AI-powered code editor with advanced agent capabilities. The core architecture revolves around the `KodCanavari` class which orchestrates autonomous code generation through a sophisticated event-driven system.

## Core Architecture Patterns

### Night Orders Protocol
The primary execution model uses "Night Orders" - structured mission-based workflows:

```javascript
// All AI operations use this JSON schema:
{
  "mission": "single sentence objective", 
  "acceptance": ["build: exit 0", "probe: #elementId exists"],
  "steps": [
    {
      "id": "S1",
      "tool": "fs.write|run_cmd|fs.read",
      "args": { "path": "file.js", "content": "..." },
      "explain": {
        "goal": "What are we doing (30+ chars)",
        "rationale": "Why this approach (50+ chars)" 
      },
      "verify": ["lint", "build", "probe"]
    }
  ]
}
```

### Phase Context System
Projects execute in tracked phases to prevent infinite loops:

```javascript
// Always check phase context before starting work
this.phaseContext = {
  currentPhase: 1,
  completedFiles: new Set(),
  lastMission: null
}
```

### Event-Driven Narration (Usta Modu)
Three critical events power the teaching interface:
- `NARRATION_BEFORE` - Step explanation
- `NARRATION_AFTER` - Completion summary  
- `NARRATION_VERIFY` - Verification results

Always emit these events without checking `step.explain` conditions.

## Key Development Workflows

### Building & Testing
```bash
# Primary development commands
npm start                    # Start Electron app
cd proxy && node server.js  # Start MCP server
npm run build               # Production build
```

### Project Generation Pipeline
1. **Router Agent** analyzes user intent
2. **Generator Agent** creates Night Orders JSON
3. **Executor** runs tools (fs.write, run_cmd)  
4. **Verifier** checks build/lint/probe status
5. **Reflexion Module** auto-fixes detected issues

## Critical Code Patterns

### File Creation with Deduplication
```javascript
// Always check if file already exists in phase
if (this.phaseContext.completedFiles.has(normalizedPath)) {
  return; // Skip duplicate creation
}
```

### Placeholder Detection (STRICT)
Never allow these patterns in generated content:
- Comment placeholders: `// ... mantığı`, `// buraya gelecek`
- Bracket placeholders: `<GÜNCELLE>`, `<TAM_İÇERİK>`  
- TODO markers: `TODO`, `PLACEHOLDER`, `...`

### README Quality Enforcement
All README files must meet these criteria:
- Minimum 500 characters
- Required sections: Kurulum, Kullanım, Özellikler
- Code examples with backticks
- Terminal commands (npm, git)

### Multi-Phase Project Structure
For complex projects (9+ files), use mandatory phases:
- **Phase 1**: Skeleton (package.json, README, .gitignore)
- **Phase 2**: Backend/Server implementation
- **Phase 3**: Frontend/Client implementation

## Integration Points

### MCP (Model Context Protocol)
- Server runs on `proxy/server.js`
- Tools available in `src/mcp-tools/`
- Use `mcp-mini.js` for standalone operations

### Elysion Chamber (Approval System)
- Handles user permissions via `ApprovalSystem` class
- Events managed through `EventBus`  
- Developer Mode bypasses all approvals

### File System Operations
Always use agent methods, not direct Node.js:
```javascript
await this.createFileWithAgent(path, content)  // Not fs.writeFile
await this.runCommandWithAgent(cmd)           // Not child_process
```

## Project-Specific Conventions

### Turkish Interface
- All user-facing messages in Turkish
- Error messages use Turkish explanations
- Phase completion messages: "PHASE X TAMAMLANDI!"

### Verification Matrix  
Every operation reports status:
- `lint: PASS/FAIL/SKIP`
- `build: PASS/FAIL/SKIP` 
- `probe: PASS/FAIL/SKIP`
- `detector: PASS/FAIL/SKIP`

### Developer Mode
When `this.developerMode` is true:
- Auto-approve all operations
- Suppress narrator messages
- Skip approval gates

## Common Pitfalls to Avoid

1. **Never** use `step.explain &&` conditions - always emit narration events
2. **Never** create files without checking `phaseContext.completedFiles`  
3. **Never** use placeholder content in generated files
4. **Always** include `explain` field with proper Turkish descriptions
5. **Always** use absolute paths for file operations
6. **Remember** Windows path format uses backslashes in JSON strings

## File Structure Reference

```
src/
├── main/           # Electron main process
├── renderer/       # UI and core logic  
│   ├── app.js      # Main KodCanavari class
│   ├── narrator-agent.js    # Event narration
│   ├── usta-modu-ui.js     # Teaching interface
│   └── elysion-chamber-ui.js # Approval system
├── ai/             # AI integration modules
└── mcp-tools/      # MCP protocol handlers
```

This architecture enables autonomous code generation with built-in safety, user feedback, and educational narration.