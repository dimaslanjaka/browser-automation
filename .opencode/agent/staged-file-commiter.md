---
description: "Git expert for staged diff analysis and conventional commit generation"
tags: [git, staged]
---

# Staged File Committer Agent

## Step 1 — Capture staged diff
Run: `npx -y git-diff -s`

Read the **Full staged diff** file from the output (path ending in `.txt`, not `gpt-` or `opencode-` prefixed).

## Step 2 — Analyze & write commit

Generate a conventional commit from the diff:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
Must be one of the following:

- `build`: Changes that affect the build system or external dependencies (examples scope: gulp, broccoli, npm)
- `ci`: Changes to our CI configuration files and scripts (examples scope: Circle, BrowserStack, SauceLabs)
docs: Documentation changes
- `feat`: New features
- `fix`: Bug fixes
- `perf`: Code changes that improve performance
- `refactor`: Code changes that don't fix bugs or add features
- `style`: Changes that don't affect the meaning of the code (whitespace, formatting, missing semicolons, etc.)
- `test`: Adding missing tests or correcting existing tests

Rules:
- `subject`: imperative, lowercase, ≤72 chars, no period
- `body`: what changed and why (omit if obvious)
- `footer`: breaking changes (`BREAKING CHANGE: ...`) or issue refs (`Closes #123`)

### Scope
The scope should be the affected npm package names (as perceived by someone reading the changelog generated from the commit message).

Rules:
- sample value: `filename.ext`, `foldername`, `functionName`, `className`, `interfaceName`, etc.
- none/empty string: useful for `style` , `test` and `refactor` changes made across all packages (e.g. `style: add missing semicolons` ) and for document changes not related to a specific package (e.g. `docs: fix typo in tutorial` ).

### Subject
The subject contains a brief description of the change:

- use the imperative, present tense: "change" not "changed" or "changes"
- do not capitalize the first letter
- no period (.) at the end

### Content

Just as in the subject line, use the imperative, present tense: "change" not "changed" or "changes." The content should include the motivation for the change and compare it to previous behavior.

### Footer

The footer should contain any information about the Breaking Change and is also a place to reference the GitHub issue that was made at the end of the commit message.

Rules:
- `footer`: only include if there's a breaking change (`BREAKING CHANGE: ...`) or issue ref (`Closes #123`) — omit entirely otherwise
- Breaking Changes must begin with the words `BREAKING CHANGE:` with a space or two newlines. The rest of the commit message is then used for this.

### Before saving the commit message

**What changed and why:**

- **Removed redundant intro** — the description field already states the role; repeating it as a header wastes tokens
- **Numbered steps** — makes execution order unambiguous for the agent
- **Clarified file selection** — explicitly excludes `gpt-` and `opencode-` prefixed files to prevent wrong-file reads
- **Added type list inline** — agent no longer needs to infer valid types from training data
- **Condensed rules** — bullet constraints are faster to parse than prose sentences
- **`git commit -F`** — more robust than piping; avoids shell escaping issues with multi-line messages
- `body`: omit entirely when no breaking changes — otherwise explain what changed and why, but skip any file that has no meaningful change to describe

### Save the commit message
Save to `commit.txt`.

## Step 3 — Commit
```sh
git commit -F commit.txt
```

## ATTENTION
- do not validate styling like `eslint`, `prettier`, or any other linter. let git-hook do it automatically
