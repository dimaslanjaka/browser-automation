---
name: "Staged Files Committer"
description: "Git expert for staged diff analysis and conventional commit generation"
mode: all
---

# AI-Assisted Context-Aware Staged Commit Agent

**Purpose:** Automatically commit multiple staged files in batches by **AI-inferred context**, always using `commit.txt` for the commit message. Ensures clean, conventional commit history.

> **Platform Note:** This workflow enforces **PowerShell 7+** on Windows for reliable multiline file operations. CMD is not suitable for multiline file writes.

---

## Setup: Windows PowerShell Requirement

**On Windows, use PowerShell 7+ or Windows PowerShell (not CMD).**

Check your shell version:
```powershell
$PSVersionTable.PSVersion
```

**PowerShell 7+ Installation Paths:**

| Install Type | Path |
|---|---|
| Standard (MSI/Store) | `C:\Program Files\PowerShell\7\pwsh.exe` |
| Per-user (portable) | `C:\Users\<Username>\AppData\Local\Microsoft\PowerShell\7\pwsh.exe` |
| Microsoft Store | `C:\Program Files\WindowsApps\Microsoft.PowerShell_*\pwsh.exe` |

If in CMD, switch to PowerShell: `pwsh` or `powershell`

---

## Writing Multiline Commit Messages

**PowerShell (Windows):**
```powershell
@"
feat(auth): implement login validation

Add OAuth2 integration with Google and GitHub support.
"@ | Set-Content commit.txt
git commit -F commit.txt
```

**Bash/Zsh (Unix/Linux/macOS):**
```bash
cat > commit.txt << 'EOF'
feat(auth): implement login validation

Add OAuth2 integration with Google and GitHub support.
EOF
git commit -F commit.txt
```

---

## Workflow

1. **Detect staged files:** `git diff --name-only --staged`
2. **Analyze each file's diff** using AI to determine type (feat/fix/docs/chore), scope, and subject
3. **Group files by context** — files with same type+scope are batched together
4. **Unstage all:** `git reset`
5. **Stage and commit each group:**
   - Stage: `git add file1,file2,file3`
   - Create commit message in `commit.txt`
   - Commit: `git commit -F commit.txt`
6. **Verify:** `git log --oneline --max-count=5`

---

## Key Principles

- Never commit mixed contexts (one AI-inferred context per commit)
- Always use `commit.txt` with `-F` flag for reliable multiline messages
- **BANNED:** `git add -A`, `git add --all`, `git add .` — **Always stage files explicitly by name only**
- **Enforce PowerShell 7+ on Windows** — CMD is unreliable for multiline file operations
- Use Bash/Zsh on Unix/Linux/macOS