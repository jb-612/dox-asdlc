# P05-F11: PRD Ideation Studio - User Stories

## Epic Summary

As a product owner or stakeholder, I want an interactive ideation studio where an AI agent interviews me about my product idea, tracks the maturity of my requirements, and produces a formal PRD document with user stories when I'm ready.

---

## User Stories

### US01: Start Ideation Session

**As a** product owner
**I want** to start a new PRD ideation session
**So that** I can begin capturing my product idea with AI guidance

**Acceptance Criteria:**
- [x] User can navigate to /studio/ideation
- [x] "New Session" button starts a fresh ideation session
- [x] Session is assigned a unique ID
- [x] Initial maturity score is 0%
- [x] Agent sends opening message asking about the product concept
- [x] Session state persists across page refreshes

**Test Scenarios:**

```gherkin
Scenario: Start new ideation session
  Given I am on the Studio page
  When I click "New Ideation Session"
  Then a new session is created with unique ID
  And the maturity tracker shows 0%
  And the agent sends an opening message

Scenario: Resume existing session
  Given I have an active ideation session
  When I navigate away and return to /studio/ideation
  Then my session state is restored
  And chat history is visible
  And maturity score is preserved
```

---

### US02: Conversational Interview

**As a** user being interviewed
**I want** to have a natural conversation with the AI agent
**So that** I can describe my product idea in my own words

**Acceptance Criteria:**
- [x] User can type messages in the chat input
- [x] Agent responds with relevant follow-up questions
- [x] Responses stream in real-time (typewriter effect)
- [x] Agent asks probing questions based on gaps in coverage
- [x] User can ask questions back to the agent
- [x] Conversation supports markdown formatting

**Test Scenarios:**

```gherkin
Scenario: Send message and receive response
  Given I am in an active ideation session
  When I type "I want to build a task management app" and press Enter
  Then my message appears in the chat
  And the agent responds with follow-up questions
  And the response streams in real-time

Scenario: Agent probes for missing information
  Given the agent has captured the basic concept
  And "Target Users" category is at 0%
  When the agent responds
  Then the response includes questions about target users

Scenario: User asks clarifying question
  Given I am in an ideation conversation
  When I ask "What do you mean by non-functional requirements?"
  Then the agent explains with examples
  And does not count this as requirement input
```

---

### US03: Maturity Tracking

**As a** product owner
**I want** to see a visual progress indicator of my PRD maturity
**So that** I know how complete my requirements are

**Acceptance Criteria:**
- [x] Maturity tracker displays on the left panel
- [x] Overall score shown as percentage (0-100%)
- [x] Progress bar fills based on score
- [x] Current maturity level label shown (Concept → Complete)
- [x] Individual categories show their own progress
- [x] Categories are expandable to show details
- [x] Score updates after each agent response
- [x] Color coding: red (<40%), yellow (40-79%), green (80%+)

**Test Scenarios:**

```gherkin
Scenario: View maturity progress
  Given I have provided problem statement and target users
  When I view the maturity tracker
  Then overall score is approximately 25%
  And "Problem Statement" category shows ~100%
  And "Target Users" category shows ~100%
  And other categories show 0%
  And maturity level shows "Exploration"

Scenario: Score increases after response
  Given my current maturity is 45%
  When I provide detailed functional requirements
  And the agent processes my input
  Then the maturity score increases
  And the "Functional Requirements" category score increases
  And a visual indicator shows the change

Scenario: Color coding by maturity level
  Given my maturity score is 35%
  Then the progress bar is yellow
  When maturity reaches 80%
  Then the progress bar turns green
  And "Ready to Submit" indicator appears
```

---

### US04: Requirement Extraction

**As a** product owner
**I want** requirements to be automatically extracted from my conversation
**So that** I can see what the agent has captured

**Acceptance Criteria:**
- [x] Extracted requirements appear in a list/panel
- [x] Each requirement shows ID, description, priority, type
- [x] Requirements are categorized (functional, NFR, constraint)
- [x] User can edit extracted requirements
- [x] User can delete incorrect requirements
- [x] Requirements link back to conversation context

**Test Scenarios:**

```gherkin
Scenario: Auto-extract requirement from conversation
  Given I am in an ideation session
  When I say "Users must be able to login with email and password"
  Then a new requirement is extracted: "REQ-001"
  And it appears in the requirements list
  And type is "functional"
  And priority defaults to "should_have"

Scenario: Edit extracted requirement
  Given requirement REQ-001 exists
  When I click to edit REQ-001
  And change description to "Users must login with email, password, or SSO"
  And click Save
  Then the requirement is updated
  And maturity score may adjust

Scenario: Delete incorrect requirement
  Given requirement REQ-003 was incorrectly extracted
  When I click delete on REQ-003
  Then the requirement is removed
  And maturity score adjusts accordingly
```

---

### US05: Gap Identification

**As a** product owner
**I want** to see what areas need more detail
**So that** I can provide complete requirements

**Acceptance Criteria:**
- [x] Gaps list shows categories below threshold
- [x] Each gap includes suggestions for questions to answer
- [x] Clicking a gap scrolls to relevant conversation or prompts agent
- [x] Gaps update in real-time as conversation progresses
- [x] Critical gaps (required for submit) are highlighted

**Test Scenarios:**

```gherkin
Scenario: View requirement gaps
  Given maturity is at 60%
  And "Non-Functional Requirements" is at 20%
  When I view the gaps section
  Then "Non-Functional Requirements" is listed as a gap
  And suggestions include "What are your performance requirements?"

Scenario: Address a gap via agent
  Given "Success Criteria" is listed as a gap
  When I click "Ask about this"
  Then the agent sends a message asking about success criteria
  And focus moves to chat input
```

---

### US06: Submit for PRD Generation

**As a** product owner
**I want** to submit my ideation for PRD generation when ready
**So that** a formal document is created

**Acceptance Criteria:**
- [x] Submit button is disabled below 80% maturity
- [x] Button shows current maturity and threshold
- [x] Clicking submit shows confirmation dialog
- [x] Confirmation shows what will be generated (PRD + User Stories)
- [x] Submission triggers PRD generation via PRDAgent
- [x] User sees "Generating..." state with progress
- [x] On completion, PRD draft is shown in preview panel

**Test Scenarios:**

```gherkin
Scenario: Submit button state at low maturity
  Given maturity is 65%
  Then Submit button is disabled
  And tooltip shows "Reach 80% maturity to submit"
  And button shows "65% / 80% required"

Scenario: Submit at sufficient maturity
  Given maturity is 82%
  When I click "Submit for PRD"
  Then a confirmation dialog appears
  And shows "Generate PRD and User Stories?"
  When I confirm
  Then submission starts
  And "Generating PRD..." state is shown

Scenario: View generated PRD
  Given I submitted for PRD generation
  And generation completed successfully
  Then PRD draft appears in the output panel
  And user stories appear in a separate list
  And a HITL gate is created with status "pending_review"
```

---

### US07: HITL Gate Integration

**As a** product owner
**I want** my generated PRD to go through a review gate
**So that** it can be validated before use

**Acceptance Criteria:**
- [x] After submission, a HITL gate is created
- [x] Gate status badge shows "Pending Review"
- [x] Gate card links to gate detail page
- [x] User can view gate in Gates dashboard
- [x] PRD can be approved/rejected via gate
- [x] Approval notification updates studio view

**Test Scenarios:**

```gherkin
Scenario: Gate created after submission
  Given I submitted my ideation for PRD
  When generation completes
  Then a HITL gate is created with type "prd_review"
  And gate status is "pending"
  And studio shows gate badge with "Pending Review"

Scenario: Navigate to gate from studio
  Given a gate exists for my PRD
  When I click the gate badge
  Then I navigate to /gates/{gateId}
  And can review the full PRD

Scenario: Gate approval updates studio
  Given my PRD gate is pending
  When the gate is approved
  Then studio shows "PRD Approved" status
  And PRD is marked as final
```

---

### US08: User Stories Output

**As a** product owner
**I want** user stories generated alongside the PRD
**So that** development work can be scoped

**Acceptance Criteria:**
- [x] User stories are generated from requirements
- [x] Each story follows "As a... I want... So that..." format
- [x] Stories include acceptance criteria
- [x] Stories are linked to source requirements
- [x] Stories can be viewed in a separate panel
- [x] Stories can be exported as markdown

**Test Scenarios:**

```gherkin
Scenario: View generated user stories
  Given PRD generation completed
  When I view the User Stories panel
  Then stories are listed with ID, title, and priority
  And each story shows "As a / I want / So that"

Scenario: Expand user story details
  Given user stories are displayed
  When I click on story US-001
  Then acceptance criteria are shown
  And linked requirements are listed

Scenario: Export user stories
  Given user stories are generated
  When I click "Export as Markdown"
  Then a markdown file is downloaded
  And contains all stories in standard format
```

---

### US09: Save and Resume Draft

**As a** product owner
**I want** to save my ideation progress as a draft
**So that** I can continue later

**Acceptance Criteria:**
- [x] "Save Draft" button available at all times
- [x] Draft saves conversation, maturity, and requirements
- [x] Drafts listed in studio dashboard
- [x] Can resume draft from dashboard
- [x] Auto-save triggers every 2 minutes

**Test Scenarios:**

```gherkin
Scenario: Save ideation draft
  Given I have an active ideation at 45% maturity
  When I click "Save Draft"
  Then draft is saved with current state
  And confirmation toast appears

Scenario: Resume from draft
  Given I have a saved draft "Task Manager App"
  When I view the drafts list
  And click "Resume" on the draft
  Then session is restored
  And conversation history is loaded
  And maturity is restored to saved state
```

---

## Definition of Done

- [ ] All user stories implemented
- [ ] Unit tests pass (>80% coverage)
- [ ] Integration tests pass
- [ ] E2E tests for critical flows (start, chat, submit, gate)
- [ ] Mobile responsive design
- [ ] Accessibility: keyboard navigation, screen reader support
- [ ] Performance: maturity updates < 100ms, chat response < 3s
- [ ] Documentation updated
