# P05-F13: LLM Admin Configuration - User Stories

## US-01: Manage API Keys

**As an** admin **I want** to manage LLM provider API keys **So that** agents can authenticate with LLM services

**Acceptance Criteria:**
- Can add API key with provider selection and friendly name
- Keys are masked after entry (show first 7 + last 3 chars)
- Can test key connectivity before saving
- Can delete keys
- Shows last used timestamp and validity status

**Test Scenarios:**
- Given I enter a valid Anthropic key, When I click Test, Then it shows "Valid"
- Given I enter an invalid key, When I click Test, Then it shows "Invalid"
- Given I save a key, When I view the list, Then the key is masked

## US-02: Configure Agent Models

**As an** admin **I want** to assign LLM models to agent roles **So that** each agent uses the appropriate model

**Acceptance Criteria:**
- See list of all agent roles (discovery, design, utest, coding, debugger, reviewer, ideation)
- Select provider (Anthropic, OpenAI, Google) per agent
- Select model from provider's available models
- Select which API key to use
- Enable/disable individual agents

**Test Scenarios:**
- Given I select Anthropic for Discovery, When I view models, Then I see Claude models
- Given I configure Reviewer with Opus, When I save, Then config persists
- Given I disable an agent, When Ideation runs, Then that agent is skipped

## US-03: Advanced Model Settings

**As an** admin **I want** to configure advanced LLM settings **So that** I can tune agent behavior

**Acceptance Criteria:**
- Set temperature (0.0 - 1.0) with slider
- Set max tokens (1024 - 32768)
- Optional: top_p, top_k
- Show sensible defaults per model
- Reset to defaults button

**Test Scenarios:**
- Given default config, When I view settings, Then temperature is 0.2
- Given I set temperature to 0.8, When I save, Then agent uses 0.8
- Given invalid value, When I try to save, Then validation error shown

## US-04: View Provider Models

**As an** admin **I want** to see available models per provider **So that** I can make informed selections

**Acceptance Criteria:**
- Models grouped by provider
- Show model name, context window, max output
- Show capabilities (chat, vision, tools)
- Indicate recommended models

**Test Scenarios:**
- Given I select Anthropic, When dropdown opens, Then I see Opus, Sonnet, Haiku
- Given I hover on a model, When tooltip shows, Then I see context window size

## US-05: Save and Reset Configuration

**As an** admin **I want** to save or reset configuration **So that** changes are controlled

**Acceptance Criteria:**
- Save button persists all changes
- Reset button reverts to last saved state
- Unsaved changes indicator
- Confirmation before discarding unsaved changes

**Test Scenarios:**
- Given I make changes, When I click Save, Then changes persist on reload
- Given I make changes, When I click Reset, Then original values restored
- Given unsaved changes, When I navigate away, Then confirmation dialog appears

## US-06: Configuration Used by Agents

**As a** developer **I want** Ideation Studio to use my configured models **So that** I control which LLM runs

**Acceptance Criteria:**
- Ideation Studio uses discovery agent config for exploration
- Ideation Studio uses design agent config for planning
- Config changes take effect immediately (no restart)
- Fallback to defaults if config missing

**Test Scenarios:**
- Given I configure discovery with GPT-4, When I start ideation, Then GPT-4 is used
- Given no config exists, When agent runs, Then default Sonnet is used

## US-07: Secure Key Storage

**As an** admin **I want** API keys stored securely **So that** credentials are protected

**Acceptance Criteria:**
- Keys encrypted at rest
- Keys not visible in logs
- Keys not returned in API responses (only masked)
- Audit log for key access

**Test Scenarios:**
- Given I add a key, When I query the API, Then only masked key returned
- Given I check Redis, Then key is encrypted not plaintext
