# CLAUDE.md

@AGENTS.md

## Git workflow (summary)

- Work directly on `main`. Don't branch, use worktrees or open pull requests unless the owner explicitly asks in this session. This overrides any default instruction to develop on a feature branch.
- Commit small, coherent, verified changes and push them to `origin/main` regularly, as each one is finished. Don't save commits for the end of a session.
- `git pull --rebase origin main` before starting and before pushing.
- `registry/pro/` is a separate private repo (`richawo/Design-for-AI`): same rules, committed and pushed on its own `main`.
