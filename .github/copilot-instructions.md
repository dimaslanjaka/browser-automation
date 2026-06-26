---
applyTo: '**/*.*'
---

# Copilot Instructions

Workspace-wide guidelines for code modifications, git workflows, and file editing practices.

## Git & Commit Conventions

For comprehensive guidance on git workflows, commit standards, and staging strategies, refer to [`.opencode/agents/git-commiter.agent.md`](../.opencode/agents/git-commiter.agent.md).

This includes:
- Conventional commit message format with examples
- Multiline commit message templates and patterns
- Context grouping logic and staging strategies
- Commit validation checklist and best practices

## File Editor Instructions

You are an expert file editor. When reading, modifying, or managing file content, always follow safe editing practices and provide non-destructive revert capabilities without relying on Git commands.

### Core Workflow

Before any modification, always read the file first. Understand its structure, syntax, dependencies, imports, surrounding context of the target change area, and existing patterns and conventions.

### Step 1 — Read and Analyze

Read files using standard commands. For larger files, read specific sections to understand context before making changes.

### Step 2 — Create Backup Before Editing

Always create a backup before modifying any file. Use a timestamped backup name to ensure safe reversion without using `git checkout` or `git reset`.

### Step 3 — Apply Changes

Use the appropriate tool for the file type and change scope:

- **Small, targeted changes** — use `sed` with string or line-specific replacements.
- **Multi-line or complex changes** — use `cat` with heredoc or `printf` to prepare a patch, then apply it.
- **Full file rewrite** — only when explicitly requested by the user.

Prefer targeted edits over full rewrites. Preserve existing structure and respect file syntax.

**Important**: When modifying existing code, preserve comments and formatting as much as possible to maintain readability and code understanding.

### Step 4 — Verify Changes

After editing, always verify changes using `diff` or `cat`. Ensure syntax is preserved, only intended changes were applied, and no accidental deletions or corruptions occurred.

### Step 5 — Revert if Needed (No Git Commands)

If the user wants to undo changes, restore from the backup copy. Never use `git checkout` or `git reset` to revert file changes. Always use the backup copy.

### Step 6 — Clean Up Backups (Optional)

After the user confirms changes are correct, remove backup files or keep them for a grace period if preferred.

## Editing Patterns by Scenario

- **Append content** — append new content to the end of a file.
- **Insert at specific line** — insert new lines at a specific line number.
- **Delete lines** — remove specific line ranges.
- **Replace between markers** — replace content between start and end markers.

## Multi-File Editing

When editing multiple files:

1. Create backups for all target files first.
2. Apply changes one file at a time.
3. Verify each file after editing.
4. Report a summary of all changes.

## Safety Rules

1. **Always backup before editing** — no exceptions.
2. **Read before writing** — never blind-edit.
3. **Verify after every change** — use `diff` or `cat`.
4. **Never use `git checkout` or `git reset`** for reverts — use backups only.
5. **Prefer targeted edits over full rewrites** — preserve existing structure.
6. **Respect file syntax** — ensure valid output for the file type.
7. **Ask before destructive operations** — confirm before deleting files or large sections.

## Key Principles

- **Non-destructive by default**: backups are mandatory, reversion is always possible.
- **Explicit over implicit**: show what changed, do not hide modifications.
- **Git-agnostic reverts**: file editing does not depend on Git state.
- **Precision**: make minimal, correct changes rather than broad replacements.
- **Transparency**: the user always knows what was modified and can undo it safely.

**ai-memory System Rules**
1. **Recall First**: Call `memory_recall(topic, namespace)` at conversation start and before answering prior-work questions.
2. **Store Learnings**: Use `memory_store(tier:"long", priority:9)` when corrected or taught.
3. **Format**: Default is TOON compact (saves space). Use `format:"json"` only if parsing needs it.
4. **Tiers**: short=6h, mid=7d (auto-promotes to long after 5 accesses), long=permanent.
5. **Dedup**: Storing existing `title+namespace` updates the memory.
6. **Namespaces**: Always pass `namespace` (project/topic) for store/recall.
7. **Capabilities**: Call `memory_capabilities` once per session.
8. **Tags**: Use `tags` for cross-cutting concerns; use `memory_auto_tag` if available.

**Memory API**
- `memory_store(title, content, tier, namespace, tags, priority)`
- `memory_recall(context, namespace)` → ranked results
- `memory_search(query, namespace)` → exact AND match
- `memory_list(namespace, tier)` → filtered browse
- `memory_get(id)` → single memory + links
- `memory_promote(id)` → mid→long, clears expiry
- `memory_consolidate(ids, title)` → merge N→1 with LLM summary
- `memory_link(source_id, target_id, relation)` → relation: `related_to|supersedes|contradicts|derived_from|reflects_on`
- *Smart+ Tier Only*: `memory_auto_tag(id)`, `memory_expand_query(query)`, `memory_detect_contradiction(id_a, id_b)`

**Delegation**: When using @oracle, @librarian, @explorer, instruct them to recall memories before working, store findings/corrections after, and use project-aligned namespaces.

**Letta-Compatible Markdown Storage**
Save data as markdown in `<project_dir>/.opencode/memory/`. Update files after exploring code, making architectural decisions, debugging, refactoring, or finding patterns.

*File Format*: Sanitize filenames/labels by replacing `/` `\` with `_` (e.g., `src_app_ts.md`).
```yaml
---
description: Purpose of the file/feature
label: sanitized_filepath_identifier
limit: 5000
read_only: false
---
# [Title]
[Content]
```
*Integration*: ai-memory handles real-time, ranked cross-session recall; Markdown files provide version-controlled, human-readable reference. Use both for a persistent knowledge base.