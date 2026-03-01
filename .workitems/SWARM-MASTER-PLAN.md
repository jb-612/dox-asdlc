# Swarm Master Plan — 60-Issue Fix Operation

## Status
- **12 issues closed** (already fixed + duplicates): #98, #58, #147, #173, #269, #270, #189, #248, #249, #250, #278, #15
- **47 actionable issues** across 22 work packages in 4 waves
- **3 issues rerouted**: #174, #179, #204 (guardrails context)
- **Triage and planning COMPLETE** — detailed file-level implementation plans available

## Quick Reference: Closed Issues
```
gh issue close 98 -c "Fixed: Slack bridge URL validated"
gh issue close 58 -c "Fixed: PromQL validation in place"
gh issue close 147 -c "Fixed: ES index prefix validation"
gh issue close 173 -c "Fixed: PostToolUse confirmed supported"
gh issue close 269 -c "Fixed: abort check exists"
gh issue close 270 -c "Fixed: HTTP response check exists"
gh issue close 189 -c "Fixed: lazy loading implemented"
gh issue close 248 -c "Duplicate of #255"
gh issue close 249 -c "Duplicate of #260"
gh issue close 250 -c "Duplicate of #258"
gh issue close 278 -c "Fixed: vite.config externalizes node-pty"
gh issue close 15  -c "Fixed: no console.log in RuleProposalsPage"
```

## Wave 1: P0 Security/Crash (5 packages, ~17h)

### WP-01: Path Traversal (#283, #284)
- #283: workitem-handlers.ts — replace `resolved.includes('..')` with `isPathWithinRoot()` helper
- #284: execution-engine.ts — add `sanitizeNodeId()` with `/^[\w-]{1,128}$/` validation
- Files: workitem-handlers.ts (lines 68-72, 127-131), execution-engine.ts (line 662)

### WP-02: Prompt Injection (#285)
- #285: buildSystemPrompt — add `sanitizePromptField()` (strip null bytes, cap 4096 chars)
- Apply to: systemPromptPrefix, task instructions, checklist items, file restrictions
- File: execution-engine.ts (lines 585-642)

### WP-03: Node-pty Crash (#278) — ALREADY FIXED, CLOSED

### WP-04: Cursor-Agent Hardening (#268, #267, #266)
- #268: Dockerfile — pin installer with SHA256 checksum
- #267: docker-compose.yml — bind port to 127.0.0.1
- #266: server.ts — add hostname allowlist for CURSOR_ALLOWED_HOSTS

### WP-05: Guardrails Auth (#139, #121)
- #139: guardrails_api.py — add verify_api_key to 5 read endpoints
- #121: guardrails-inject.py — prioritize CLAUDE_INSTANCE_ID over keyword matching

## Wave 2: P1 Correctness (5 packages, ~23h)

### WP-06: IPC Contract Integrity (#287, #290, #281)
- #287: preload.ts — use IPC_CHANNELS constants instead of hardcoded strings
- #290: electron-api.d.ts — rename container→containerPool, fix method names
- #281: Add EXECUTION_MERGE_RESOLVE channel, handler, preload bridge, d.ts type

### WP-07: Execution Engine Correctness (#282, #286, #291)
- #286: Change `node.type === 'code'` to `'coding'` at lines 750, 794
- #282: Replace waitForExit stub with real waitForCLIExit delegation
- #291: Implement transition condition evaluator (on_success, on_failure, always)

### WP-08: Startup Reliability (#289)
- #289: Wrap telemetryReceiver.start() in try/catch at index.ts:259

### WP-09: HITL Type/Build Breaks (#256, #247, #257, #254, #255)
- #256: main.tsx — import queryClient singleton instead of inline creation
- #247: mocks/index.ts — fix SearchService re-export path
- #257: MermaidConfig flowchart field, Button outline variant, ExcalidrawElement import
- #254: StudioDiscoveryPage — fix timestamp, Omit, Skeleton, SectionStatus types
- #255: RunDetailPage/ArtifactDetailPage — pass required props to child components

### WP-10: Hook Enforcement (#158, #150, #174, #204)
- #158: Add MultiEdit/NotebookEdit to tool check, add notebook_path extraction
- #150: Change allow-list advisory (exit 0) to block (exit 2)
- #174: Verify test-writer in path rules (likely already fixed)
- #204: Add Bash command path extraction

## Wave 3: P2 Quality (9 packages, ~22h)

### WP-11: API Consolidation (#260, #258, #259)
- #260: Remove `|| import.meta.env.DEV` from 7 API files
- #258: Remove error-swallowing try/catch in services.ts
- #259: Add MutationCache onError to queryClient

### WP-12: HITL Identity (#5, #116)
- #5: Create AuthContext, replace hardcoded 'admin'/'operator'
- #116: Create backend GitHub proxy, remove VITE_GITHUB_TOKEN refs

### WP-13: Agent Defense (#186) — add disallowedTools to test-writer.md
### WP-14: Studio Hardening (#288, #292)
### WP-15: Rate Limiting (#117, #142)
### WP-16: Config Dedup (#261)
### WP-17: Redis Key Validation (#99)
### WP-18: Batch Size Limit (#101)
### WP-19: Metrics Auth (#66)

## Wave 4: P3 Cleanup (3 packages, ~9h)

### WP-20: Test Gaps (#252, #253, #265, #264)
### WP-21: Frontend Cleanup (#16, #83, #64)
### WP-22: Python Backend Cleanup (#105, #81)
