# TraceForge

> **Software development, fully traceable.**

TraceForge is an open-source, self-hosted development traceability platform that connects the complete lifecycle of software work:

**Requirements → Tasks → Branches → Commits → Pull Requests → Reviews → CI → Deployments → Production → Regressions**

It is designed for both **human developers and AI coding agents**, with first-class support for **MCP**, GitHub, Cursor, Claude Code, and machine-readable development history.

## Why TraceForge?

Traditional task managers tell you **what needs to be done**.

TraceForge is designed to answer:

* Why does this task exist?
* What requirements led to it?
* What decisions were made?
* What code changed?
* Which commits implemented it?
* Which pull request reviewed it?
* Which tests passed or failed?
* Where was it deployed?
* What happened after deployment?
* Which future bugs or regressions originated from it?

A task becomes the central entity connecting planning, implementation, review, deployment, and future maintenance.

## Core capabilities

* Configurable software-development workflows
* Kanban, list, table, calendar, timeline, sprint, and roadmap views
* Rich tasks, subtasks, dependencies, relationships, labels, milestones, and custom fields
* Complete task activity and audit history
* GitHub branches, commits, pull requests, reviews, CI checks, releases, and deployments
* Automatic and explicit task-to-Git association
* Git history exposed as machine-readable context
* First-class MCP server
* Cursor and Claude Code integration
* AI-oriented task and project operations
* Structured AI context for coding agents
* Notion and Linear integrations
* Configurable automation rules
* REST API and OpenAPI
* Optional CLI
* Full data export
* Self-hosted deployment with Docker
* Provider-agnostic integration architecture
* Security-focused authentication, authorization, webhook validation, SSRF protection, and audit logging

## AI-first development workflow

TraceForge treats AI agents as first-class clients rather than simply adding an AI chatbot to a task manager.

A coding agent can:

1. Search for an existing task.
2. Retrieve the complete task context.
3. Inspect related requirements and decisions.
4. Retrieve related Git history.
5. Implement the change.
6. Associate branches and commits.
7. Create or update a pull request.
8. Observe CI and review activity.
9. Update the task lifecycle.
10. Retrieve the complete history later when investigating a regression.

For example:

```text
get_ai_context(TF-123)
```

can provide structured context containing:

```text
Task
├── Requirements
├── Acceptance criteria
├── Decisions
├── Related tasks
├── Dependencies
├── Blockers
├── Comments
├── Git branches
├── Commits
├── Pull requests
├── Reviews
├── Changed files
├── CI checks
├── Deployments
├── External references
├── Activity history
└── Previous bugs
```

This allows an AI coding agent to understand not only **what to change**, but also **why the system reached its current state**.

## Git traceability

TraceForge can associate tasks with Git artifacts through:

* Task IDs in branch names
* Task IDs in commit messages
* Task IDs in pull requests
* GitHub issue references
* Webhooks
* Explicit manual linking
* Automatic discovery

For example:

```text
TF-123
│
├── feature/TF-123-user-authentication
│
├── Commits
│   ├── abc123
│   ├── def456
│   └── ghi789
│
├── Pull Request #482
│
├── Reviews
│
├── CI checks
│
├── Merge
│
├── Deployment
│
└── Release
```

## Self-hosted

TraceForge is designed to run entirely under your control.

The core system is intended to work without requiring a managed SaaS platform.

Planned deployment options include:

* Docker
* Docker Compose
* PostgreSQL
* Local object storage
* S3-compatible storage
* MinIO
* AWS S3

## Integrations

### Development

* GitHub
* GitLab
* Bitbucket

### AI

* MCP
* Cursor
* Claude Code
* Other MCP-compatible clients

### Knowledge and project management

* Notion
* Linear
* Jira

### Infrastructure and observability

* Vercel
* AWS
* Azure
* GCP
* Sentry
* Datadog
* CI/CD providers

Integrations are implemented through provider abstractions so the core domain remains independent from individual vendors.

## Architecture

TraceForge is designed around a modular architecture separating:

```text
Core Domain
├── Task Management
├── Workflow Engine
├── Audit System
├── Search
├── Automation
├── Integrations
│   ├── GitHub
│   ├── Notion
│   ├── Linear
│   └── Other Providers
├── AI / MCP
├── API
├── Web UI
├── CLI
├── Notifications
└── Storage
```

The exact technology stack is evaluated based on maintainability, ecosystem maturity, operational complexity, performance, licensing, and self-hosting requirements.

## Quick start (local)

```bash
cp .env.example .env
docker compose up -d db
pnpm install
export DATABASE_URL=postgresql://traceforge:traceforge@localhost:5432/traceforge
pnpm db:generate && pnpm db:migrate && pnpm db:seed
pnpm dev
```

- Web: http://localhost:3000 (demo `demo@traceforge.local` / `demo123456` after seed)
- API docs: http://localhost:4000/docs
- MCP example: `docs/mcp/cursor-mcp.json.example`

See [docs/self-hosting.md](docs/self-hosting.md) and [docs/architecture.md](docs/architecture.md).

## Naming note (TaskForge vs TraceForge)

The working name **TaskForge** is crowded on GitHub/npm (multiple unrelated repos and `@taskforge-ai/*` packages). This repository uses **TraceForge** for product identity while keeping **TF-** task identifiers (e.g. `TF-123`). Recommended GitHub target: `traceforgehq/traceforge`.

## Project status

TraceForge is under active development.

The project is being developed incrementally, prioritizing a stable core task-management system before adding advanced integrations and automation.

### Roadmap

#### Phase 1 — Core

* Authentication
* Workspaces
* Projects
* Tasks
* Configurable workflows
* Kanban
* List view
* Comments
* Labels
* Assignees
* Relationships
* Attachments
* URLs
* Activity history

#### Phase 2 — GitHub

* GitHub OAuth
* Repository connections
* Branch association
* Commit association
* Pull request association
* Webhooks
* Git history
* CI status
* Deployment tracking

#### Phase 3 — AI

* MCP server
* Cursor integration
* Claude Code integration
* AI context API
* AI-oriented task operations
* CLI

#### Phase 4 — External knowledge

* Notion
* Linear
* External references
* Synchronization

#### Phase 5 — Advanced capabilities

* Automation engine
* Advanced views
* Roadmaps
* Gantt
* Semantic search
* Analytics
* Additional integrations

## Open source

TraceForge is intended to be a fully open-source, self-hosted developer tool.

The project aims to avoid unnecessary vendor lock-in and prefers open standards and self-hostable infrastructure.

See:

* [LICENSE](LICENSE)
* [CONTRIBUTING.md](CONTRIBUTING.md)
* [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
* [SECURITY.md](SECURITY.md)

## Contributing

Contributions are welcome.

Before submitting a pull request, please read [CONTRIBUTING.md](CONTRIBUTING.md).

Architecture changes should be discussed before implementation when they affect core domain boundaries, public APIs, integrations, or persistence.

## Security

Security issues should be reported according to the process described in [SECURITY.md](SECURITY.md).

Do not publicly disclose sensitive vulnerabilities before the project maintainers have had an opportunity to investigate them.

## License

TraceForge is distributed under an OSI-approved open-source license.

See [LICENSE](LICENSE) for details.
