# Work Items

Structured planning artifacts for every feature. Created before implementation begins.

## Naming Convention

Folders: `PNN-FNN-<snake_case_name>/`
- `P` = Project/phase number (P00-P99)
- `F` = Feature number within phase (F01-F99)
- Name = lowercase_snake_case description

Special prefixes:
- `META-NN-` = cross-cutting process improvements
- `SPNN-FNN-` = side projects (separate scope)

Examples: `P15-F01-studio-block-composer/`, `META-01-pm-cli-workflow/`

## Files Per Feature

| File | Purpose | Created By |
|------|---------|------------|
| `design.md` | Technical approach, interfaces, architecture decisions | Planner |
| `user_stories.md` | User-facing requirements with acceptance criteria | Planner |
| `tasks.md` | Atomic TDD tasks with status tracking | Planner |

All files include YAML frontmatter with: `id`, `parent_id`, `type`, `version`, `status`, `dependencies`, `tags`.

## Templates

Copy from `_templates/` when creating a new workitem:
```bash
mkdir -p .workitems/PNN-FNN-name
cp .workitems/_templates/*.md .workitems/PNN-FNN-name/
```

Or use: `./scripts/new-feature.sh PNN FNN "name"`

## Rules

1. **Every file <= 100 lines** — if a file exceeds this, split the feature into sub-features
2. **Plan before code** — workitem folder must exist with design.md + tasks.md before writing to `src/`
3. **Design verdict required** — design.md must have `status: reviewed` or `status: approved` before implementation
4. **Tasks are atomic** — each task < 2 hours, produces one testable behavior change
5. **Progress tracking** — update tasks.md status as work progresses

## Design Verdict Values

| Status | Meaning |
|--------|---------|
| `draft` | Initial creation, not yet reviewed |
| `reviewed` | Design review complete, approved with or without comments |
| `approved` | Explicitly approved, no outstanding concerns |
| `changes_required` | Must address findings before implementation |

## Progress Tracking

Update `PLAN.md` when:
- A new feature is created: add entry with `[ ]`
- A feature reaches 100%: mark `[x]` and update Done count
- A phase gate passes: mark Gate as `PASSED`
