---
id: P15-F18
parent_id: P15
type: user_stories
version: 2
updated_at: "2026-03-01T00:00:00Z"
status: draft
created_by: planner
created_at: "2026-03-01T00:00:00Z"
updated_at: "2026-03-01T00:00:00Z"
---

# User Stories: Collaboration (P15-F18)

## US-01: Publish Template to Shared Repository

**As a** workflow author, **I want to** publish my local template to a shared Git-backed
directory, **So that** teammates can discover and import it.

- [ ] "Publish" button on local template cards opens dialog
- [ ] Dialog collects author, description, tags, version
- [ ] Template JSON written to `sharedTemplateDirectory` with metadata
- [ ] Published template appears in shared tab of template browser

## US-02: Browse and Import Shared Templates

**As a** team member, **I want to** search, filter, and import shared templates,
**So that** I reuse proven workflows without recreating them.

- [ ] Template browser shows tabs: All / Local / Shared
- [ ] Search filters by name, tag, author across both sources
- [ ] Sort by: name, date updated, node count
- [ ] "Import" copies shared template to local directory
- [ ] Shared templates show author badge and origin indicator

## US-03: Shared Template Visibility

**As a** team lead, **I want** published templates in `.dox/templates/` to appear
alongside local ones, **So that** team members discover and reuse shared work.

- [ ] Template list merges local and shared with origin badges
- [ ] Shared templates are read-only; import locally to edit
- [ ] Published JSON is Git-trackable with metadata

## US-04: Advisory Locking for Shared Workflows

**As a** workflow editor, **I want to** see if someone else is editing a shared workflow,
**So that** I avoid conflicting changes.

- [ ] Opening shared workflow for edit acquires advisory lock
- [ ] Locked-by-other shows warning with holder name and time
- [ ] Locks auto-expire after 30 minutes; manual release button available
- [ ] Closing workflow releases the lock

## US-05: See Who Is Viewing a Workflow

**As a** team member, **I want to** see avatars of who else is viewing the same workflow,
**So that** I know when to coordinate.

- [ ] Canvas toolbar shows avatar circles for connected users
- [ ] Avatars show first-letter initial with tooltip for full name
- [ ] Presence updates within 15s; stale entries removed after 60s
- [ ] Works across machines via WebSocket

## US-06: Configure Collaboration Settings

**As an** administrator, **I want to** configure shared directory, user identity, and
presence port, **So that** collaboration works for my environment.

- [ ] Settings > Collaboration: shared directory, user name, presence port
- [ ] Directory validates as existing path; warns if not Git repo
- [ ] User name defaults to OS username; presence port defaults to 9380

## US-07: Graceful Solo-User Degradation

**As a** solo user, **I want** collaboration features to be optional,
**So that** my existing workflow is unaffected.

- [ ] All collaboration disabled when shared directory not configured
- [ ] Presence server does not start; no network connections in solo mode
- [ ] Local template browser works without errors
- [ ] Advisory locking skipped for local-only workflows
