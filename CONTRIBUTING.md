# Contributing to TraceForge

Thank you for contributing. Please:

1. Open an issue for large architectural changes.
2. Keep domain logic in `packages/domain` free of vendor SDKs.
3. Add tests for workflow, webhook, and MCP behavior when touching those areas.
4. Run `pnpm test` and `pnpm build` before opening a PR.

See `docs/architecture.md` for module boundaries.
