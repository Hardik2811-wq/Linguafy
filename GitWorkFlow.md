# GitWorkFlow.md — Team Git Workflow Guide

Standard procedure for working with the **Linguafy** repository on GitHub:
**https://github.com/Hardik2811-wq/Linguafy**

**Live app (production deployment):** https://linguafy.vercel.app/

The rule is simple:

> **Never push changes directly to `main`.** Always work on your own branch,
> push the branch, open a Pull Request (PR), verify the functionality, and only
> after confirmation merge into `main`.

---

## 1. First-Time Setup (one time only)

### 1.1 Clone the repository

```bash
git clone https://github.com/Hardik2811-wq/Linguafy.git
cd Linguafy
```

### 1.2 Verify your remote

```bash
git remote -v
```

Expected output (both lines point to the Linguafy repo):

```
origin  https://github.com/Hardik2811-wq/Linguafy.git (fetch)
origin  https://github.com/Hardik2811-wq/Linguafy.git (push)
```

If the remote is missing, add it:

```bash
git remote add origin https://github.com/Hardik2811-wq/Linguafy.git
```

### 1.3 Confirm `main` is your default branch

```bash
git branch -a
```

You should see `main` (or `master`). The command below lists the local default.

---

## 2. Branching Strategy

| Branch          | Purpose                                                      | Who can push |
|-----------------|--------------------------------------------------------------|--------------|
| `main`          | Production-ready, fully confirmed code                       | Merge via PR only |
| `dev` (optional)| Shared integration branch for testing before `main`          | Merge via PR only |
| `feature/*`     | Your work-in-progress (e.g. `feature/writing-feedback`, `feature/exam-timer`) | Anyone |

- `main` is **protected**: no direct pushes.
- Every change starts on a new feature branch.
- Long-running experiments get their own branch, e.g. `feature/grammar-drills`.

---

## 3. Daily Workflow (Pull Latest First)

Before doing anything, always sync with the remote so you don't build on stale code.

### 3.1 Get the latest from `main`

```bash
git pull origin main
```

If you are on `main` and want the fast-forward only:

```bash
git checkout main
git pull origin main
```

> `git pull` = `git fetch` + `git merge`. It updates your local copy of the
> remote branch and merges it into your current branch.

### 3.2 If you have local uncommitted changes

Stash them first, pull, then apply them back:

```bash
git stash
git pull origin main
git stash pop
```

---

## 4. Pushing Your Own Changes (Safe Way)

This is the core workflow: change → branch → commit → push → pull request
→ confirm → merge.

### 4.1 Create a new feature branch (from the latest `main`)

```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

Replace `your-feature-name`, e.g. `feature/fix-exam-timer`.

### 4.2 Make your changes, then check what changed

```bash
git status
git diff
```

`git status` shows files added/modified/deleted. `git diff` shows the actual
content changes. Review these before committing.

### 4.3 Stage the files you want to commit

```bash
git add src/main.jsx Developer.md        # specific files
# or add everything in the current directory (careful!)
git add .
```

> Note the `.gitignore` already excludes `node_modules`, `dist`, and `.env`.
> Never add `.env` or any secrets — and never hard-code API keys.

### 4.4 Commit with a clear message

```bash
git commit -m "Fix exam timer not counting down"
```

Good commit message style: short summary of **what** and **why**.
Examples:
- `Add writing feedback module`
- `Fix vocabulary word counter`
- `Refactor sidebar navigation`

### 4.5 Push the branch to GitHub

First push (branch does not exist remotely yet):

```bash
git push -u origin feature/your-feature-name
```

Later pushes on the same branch (remote already knows it):

```bash
git push
```

---

## 5. Request a Pull Request (Never Merge Straight to main)

Now open a Pull Request to get the change reviewed, tested, and confirmed.

### 5.1 Via command line (gh CLI)

If you have GitHub CLI installed:

```bash
gh pr create --base main --head feature/your-feature-name --title "your title" --body "describe the change and what to test"
```

### 5.2 Via the GitHub website

1. Open https://github.com/Hardik2811-wq/Linguafy
2. GitHub shows a yellow banner: **"Compare & pull request"** for your newly
   pushed branch — click it.
3. Set **base** = `main`, **compare** = `feature/your-feature-name`.
4. Add a title and description:
   - What you changed
   - How to test it
   - Anything the reviewer should check
5. Click **Create pull request**.

### 5.3 Review & confirm before merge

- The PR must be **fully reviewed**.
- Test the functionality yourself (run `npm run dev`, click through the module).
- If fixes are needed, push more commits to the **same branch** — the PR
  updates automatically (`git add . && git commit -m "..." && git push`).
- Only when everything works and is confirmed, merge the PR on GitHub:
  - **Merge pull request** (merge commit) or **Squash and merge** for a clean
    history.

> Pull requests allow others to see a diff (`Files changed` tab) and leave
> inline comments (`Review changes`) before anything touches `main`.

---

## 6. Updating Your Branch While the PR Is Open

While your PR is being reviewed, `main` may move ahead. Keep your branch in sync:

```bash
git checkout feature/your-feature-name
git pull origin main
```

If lines conflict, resolve them manually, then:

```bash
git add .
git commit -m "Resolve merge conflicts with main"
git push
```

---

## 7. After Merge — Clean Up

Once the PR is merged into `main`:

### 7.1 Switch back to main and pull the merged work

```bash
git checkout main
git pull origin main
```

### 7.2 Delete your feature branch (local + remote)

```bash
git branch -d feature/your-feature-name     # local (only works if merged)
git push origin --delete feature/your-feature-name   # remote
```

---

## 8. Quick Command Reference

| Goal                                      | Command |
|-------------------------------------------|---------|
| Clone the repo                            | `git clone https://github.com/Hardik2811-wq/Linguafy.git` |
| See current status                        | `git status` |
| See exact content changes                 | `git diff` |
| Update main from remote                   | `git checkout main && git pull origin main` |
| Create a new branch                       | `git checkout -b feature/name` |
| Switch branches                           | `git checkout branch-name` |
| Stage files                               | `git add <file>` or `git add .` |
| Commit with message                       | `git commit -m "message"` |
| Push branch to GitHub                     | `git push -u origin feature/name` (first time) / `git push` |
| Open a PR (gh CLI)                        | `gh pr create --base main --head feature/name --title "t" --body "b"` |
| Update branch with latest main            | `git pull origin main` |
| Delete merged branch locally              | `git branch -d feature/name` |
| Delete branch on GitHub                   | `git push origin --delete feature/name` |
| Temporarily set aside uncommitted changes | `git stash` / `git stash pop` |

---

## 9. Golden Rules

1. **Never push to `main` directly.** Use a branch + Pull Request.
2. **Pull first, always** — before starting new work and before pushing.
3. **Small, focused branches** — one branch = one feature/fix.
4. **Review and confirm before merging** — test the app, run `npm run dev`,
   click through the new functionality on the branch before any merge.
5. **Never commit secrets** — `.env`, API keys, passwords stay out of the repo.
6. **Clean up merged branches** to keep the remote tidy.
7. If unsure, ask. `git status` and `git log --oneline` are your friends.

```bash
git log --oneline -10    # see the last 10 commits
```