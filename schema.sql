PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
    project_id TEXT PRIMARY KEY,
    project_name TEXT NOT NULL,
    project_description TEXT NOT NULL,
    project_owner TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_team_members (
    member_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    member_name TEXT NOT NULL,
    member_role TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_risks (
    risk_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    risk_description TEXT NOT NULL,
    likelihood TEXT NOT NULL,
    impact TEXT NOT NULL,
    risk_status TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_requirements (
    requirement_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    requirement_code TEXT NOT NULL,
    requirement_type TEXT CHECK(requirement_type IN ('Functional', 'Non-Functional')) NOT NULL,
    requirement_description TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS effort_records (
    effort_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    requirement_id TEXT NOT NULL,
    tracking_interval TEXT CHECK(tracking_interval IN ('Daily', 'Weekly')) NOT NULL,
    entry_date TEXT NOT NULL,
    hours_req_analysis REAL DEFAULT 0,
    hours_designing REAL DEFAULT 0,
    hours_coding REAL DEFAULT 0,
    hours_testing REAL DEFAULT 0,
    hours_project_management REAL DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (requirement_id) REFERENCES project_requirements(requirement_id) ON DELETE CASCADE
);