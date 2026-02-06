-- P02-F09: Ideation Studio Persistence Layer
-- Database schema for PostgreSQL
-- See .workitems/P02-F09-persistence-layer/design.md for design details

-- Table: ideation_sessions
-- Stores session metadata for ideation projects
CREATE TABLE ideation_sessions (
    id VARCHAR(64) PRIMARY KEY,
    project_name VARCHAR(255) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) DEFAULT 'draft',
    data_source VARCHAR(32) DEFAULT 'mock',
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table: ideation_messages
-- Stores chat messages within an ideation session
CREATE TABLE ideation_messages (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) REFERENCES ideation_sessions(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    maturity_delta INTEGER DEFAULT 0,
    metadata JSONB
);

-- Table: ideation_requirements
-- Stores extracted requirements from ideation sessions
CREATE TABLE ideation_requirements (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) REFERENCES ideation_sessions(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    type VARCHAR(32) NOT NULL,
    priority VARCHAR(32) NOT NULL,
    category_id VARCHAR(32),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table: ideation_maturity
-- Stores maturity state for each session (one-to-one with sessions)
CREATE TABLE ideation_maturity (
    session_id VARCHAR(64) PRIMARY KEY REFERENCES ideation_sessions(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    level VARCHAR(32) NOT NULL,
    categories JSONB NOT NULL,
    can_submit BOOLEAN DEFAULT FALSE,
    gaps JSONB,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table: ideation_prd_drafts
-- Stores PRD draft documents generated from ideation sessions
CREATE TABLE ideation_prd_drafts (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) REFERENCES ideation_sessions(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    version VARCHAR(32) NOT NULL,
    sections JSONB NOT NULL,
    status VARCHAR(32) DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table: ideation_user_stories
-- Stores user stories generated from ideation sessions
CREATE TABLE ideation_user_stories (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) REFERENCES ideation_sessions(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    as_a TEXT NOT NULL,
    i_want TEXT NOT NULL,
    so_that TEXT NOT NULL,
    acceptance_criteria JSONB NOT NULL,
    linked_requirements JSONB,
    priority VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for query performance

-- Sessions indexes
CREATE INDEX idx_sessions_user_id ON ideation_sessions(user_id);
CREATE INDEX idx_sessions_updated_at ON ideation_sessions(updated_at);

-- Messages indexes
CREATE INDEX idx_messages_session_id ON ideation_messages(session_id);
CREATE INDEX idx_messages_timestamp ON ideation_messages(timestamp);

-- Requirements indexes
CREATE INDEX idx_requirements_session_id ON ideation_requirements(session_id);

-- PRD drafts indexes
CREATE INDEX idx_prd_drafts_session_id ON ideation_prd_drafts(session_id);

-- User stories indexes
CREATE INDEX idx_user_stories_session_id ON ideation_user_stories(session_id);
