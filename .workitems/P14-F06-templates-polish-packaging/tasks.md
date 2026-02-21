# P14-F06: Templates, Polish & Packaging - Tasks

## Progress

- Started: Not yet started
- Tasks Complete: 0/4
- Percentage: 0%
- Status: NOT_STARTED
- Blockers: None (all dependencies from P14-F01 through P14-F05 are complete)

---

## Tasks

### T39: Create Built-in Workflow Templates
- [ ] Estimate: 1.5hr
- [ ] Tests: `test/shared/templates.test.ts`
- [ ] Dependencies: T03
- [ ] Notes: Create JSON files in `templates/` directory: `11-step-default.json` (full aSDLC workflow with all 11 steps and HITL gates), `quick-fix.json` (4-node minimal workflow), `design-review.json` (iterative design loop), `tdd-cycle.json` (test-code-refactor cycle). Each must validate against the Zod schema. Include reasonable node positions for visual clarity.

### T40: Implement UI Store and Keyboard Shortcuts
- [ ] Estimate: 1hr
- [ ] Tests: `test/renderer/stores/uiStore.test.ts`
- [ ] Dependencies: T11
- [ ] Notes: `src/renderer/stores/uiStore.ts` managing: sidebar collapsed state, active panel, selected tab, dialog visibility. Global keyboard shortcuts: Ctrl+S (save), Ctrl+Z (undo), Ctrl+Shift+Z (redo), Ctrl+O (open), Ctrl+N (new workflow), Delete (remove selected), Escape (deselect).

### T41: Integration Testing and Bug Fixes
- [ ] Estimate: 2hr
- [ ] Tests: End-to-end test scripts
- [ ] Dependencies: T31, T33, T38, T39
- [ ] Notes: Run through all user story scenarios manually and with Playwright Electron tests. Fix integration issues: IPC serialization edge cases, React Flow render timing, store synchronization, file dialog behavior. Verify all mock-mode flows work without Redis/CLI.

### T42: Electron Build Configuration and Packaging
- [ ] Estimate: 1.5hr
- [ ] Tests: Manual build verification
- [ ] Dependencies: T41
- [ ] Notes: Configure `electron-builder.yml` for host platform (macOS initially). App icons in `resources/`. Build scripts in package.json. Verify `npm run build` produces working distributable. Document installation steps. Rebuild node-pty for Electron version.

---

## Estimates Summary

| Phase | Tasks | Estimate |
|-------|-------|----------|
| Templates, Polish & Packaging | T39-T42 | 6 hours |

## Task Dependency Graph

```
T03 -> T39
T11 -> T40
T31, T33, T38, T39 -> T41
T41 -> T42
```
