---
name: project-continuity
description: Continue, implement, verify, or hand off work in this project using its durable state, task, evidence, and Git records. Use for application development, resuming unfinished work, completing a task, checking progress, or claiming that work is finished.
---

# Project Continuity

Use the project files under `.ai-project/` as the source of truth. Conversation history and Claude's own memory are secondary.

## Start or resume work

1. Read `FEATURES.json`, `STATUS.json`, `TASKS.json`, `CURRENT.md`, recent `PROGRESS.md`, and `DECISIONS.md`.
2. Inspect Git status and recent commits.
3. Continue the existing `IN_PROGRESS` or `IMPLEMENTED_UNVERIFIED` item before selecting anything new.
4. If nothing is active, select one highest-priority item and record it before editing code.

## Verify a task

1. Ensure `.ai-project/VERIFICATION_PLAN.json` contains the real project commands. Never replace them with trivial commands such as `echo`, `exit 0`, or a no-op.
2. Run only the exact trusted verifier command injected by Project Worker at SessionStart. Its executable script must be under `%LOCALAPPDATA%\ClaudeProjectWorker\versions\`; never run a verifier copied into the project.
3. Read the generated evidence and fix every failing check.
4. Mark work `VERIFIED` only when the verifier succeeds for the current Git commit.

The first verification accepts a baseline only after `requirements_locked` is the JSON boolean `true`, `ui_project` is an explicit JSON boolean, and every feature has an ID, verification task, and nonempty acceptance criteria. Never amend a locked baseline from Claude. A later user requirement must be recorded through the external, explicit user/Codex amendment path and all affected work must be verified again.

## Pause or hand off

Update `CURRENT.md` with the active item, last successful step, exact next step, changed files, test result, and blocker. Append a dated entry to `PROGRESS.md`. Do not erase old progress or decisions.

## Completion boundary

Claude cannot approve project completion and cannot use a model-written status flag as proof. Run the trusted installed verifier command from the SessionStart context with `-CheckCompletion`; only a successful JSON result containing `project_complete=true` permits a technical completion statement. It does not prove that the first catalog captured every user need or that tests were semantically sufficient. User acceptance and release authority remain separate from automated verification.
