# GitWorkFlow.md — Simple Git Guide

How we work in the **Linguafy** repo:
**https://github.com/Hardik2811-wq/Linguafy** · Live app: https://linguafy.vercel.app/

---

## The one big rule
**Never push straight to `main`.**

Always: make a branch → push it → open a Pull Request → test it → then merge.

---

## What we do, why, and how it works

### What is Git?
Git is like a save-system for your code. Every time you "save" (commit), Git
takes a photo of your project at that moment. You can always go back.

Three places code lives:

| Place | What it is |
|---|---|
| **Working copy** | The files on your computer |
| **Local repo** | Your saved commits, on your computer |
| **Remote repo** | The repo on GitHub (shared by everyone) |

`git` moves code between these places. That's basically it.

### Step 1 — Make a branch
```bash
git checkout main          # switch to main
git pull origin main       # get the newest files from GitHub
git checkout -b feature/your-feature-name
```
- **What:** You create a copy of the project with its own name (a branch).
- **Why:** So your experiments never touch the working version on `main`.
- **How:** A branch is just a bookmark on a line of commits. `main` is the
  official line; your branch is a separate line you can merge back later.
- **Syntax:**
  - `git checkout main` → "switch my current folder to the `main` branch."
  - `git pull origin main` → "download newest commits of `main` from the remote
    named `origin` and put them into my folder." Pull = fetch (download) + merge.
  - `git checkout -b <name>` → the `-b` flag means "create a new branch named
    `<name>` and switch to it." Replace `<name>` with real words like
    `feature/fix-exam-timer`.

### Step 2 — Make your changes
Edit the files any way you like. When you're ready to save:

```bash
git status                 # see what changed (optional, but useful)
git diff                   # see the exact changes line by line (optional)
```

- **Syntax:**
  - `git status` → list files Git noticed changed, added, or deleted.
  - `git diff` → show the actual old vs. new text, so you can check before saving.

### Step 3 — Save your work
```bash
git add .                  # 1. stage the files
git commit -m "Fix exam timer"   # 2. save a snapshot with a message
git push -u origin feature/your-feature-name   # 3. upload to GitHub
```
- **What:** First you stage files, then you commit them, then you push.
- **Why:** Staging lets you choose exactly which changes to include. Committing
  makes a permanent snapshot. Pushing uploads that snapshot to GitHub.
- **How it works:**
  - `git add <file>` → "move `<file>` into the staging area." `.` means "all
    files in this folder."
  - `git commit -m "message"` → "save a snapshot now." The `-m` flag stands for
    "message" and whatever you write in quotes describes what you changed. A
    snapshot can't be named without a message, so always write one.
  - `git push -u origin <branch>` → "upload my branch to the remote repo
    (`origin`) and remember it for next time." The `-u` flag sets that remote as
    the default, so later pushes are just `git push`.
- **Rules:** Never commit secrets. `.gitignore` already blocks `node_modules`,
  `dist`, and `.env` for you.

### Step 4 — Open a Pull Request (PR)
A PR says "please look at my branch and, if it's good, put it into `main`."
You do it on GitHub's website:
- Go to the repo → GitHub shows a yellow bar: **Compare & pull request**.
- Set **base = main**, **compare = your feature branch**.
- Add a title + short description → **Create pull request**.

Or from the terminal (if you have `gh` installed):
```bash
gh pr create --base main --head feature/your-feature-name --title "title" --body "what changed and how to test"
```
- **Why:** This gives everyone a chance to read your code, comment on it, and
  test it *before* it touches the live app. `main` stays safe the whole time.

### Step 5 — Merge
- Someone reviews your PR and tests it (usually: `npm run dev`, click through).
- If there are problems, fix them: commit more changes on the **same branch**
  and push again — the PR updates automatically.
- When everything is good, click **Merge pull request** on GitHub.
- **How:** Merging copies your branch's commits into `main`. After that, GitHub
  deletes your branch remotely.

### Step 6 — Cleanup after merging
```bash
git checkout main
git pull origin main
git branch -d feature/your-feature-name              # delete local branch
git push origin --delete feature/your-feature-name   # delete remote branch
```
- **Why:** Keeps the repo tidy — no dead branches lying around.
- **Syntax:**
  - `git branch -d <name>` → `-d` means "delete branch" (it only works if the
    branch is already merged, which is a nice safety check).
  - `git push origin --delete <name>` → "ask GitHub to delete that branch."

---

## Useful commands cheat sheet
| What you want | Command | What it actually means |
|---|---|---|
| See what changed | `git status` | "show me the file list Git noticed" |
| See the exact changes | `git diff` | "show me old vs. new text" |
| Switch branch | `git checkout <branch>` | "point my folder at this branch" |
| Set aside changes for now | `git stash` | "hide my changes temporarily" |
| Bring them back | `git stash pop` | "give me my hidden changes back" |
| Last 10 commits | `git log --oneline -10` | "show 10 saves, one line each" |

---

## Troubleshooting: errors you'll hit, and what they mean

### "error: failed to push some refs ... (fetch first)"
GitHub already has commits you don't have on your machine yet. Git refuses to
overwrite them.

```bash
git fetch origin                  # download info about new commits (changes no files)
git pull --rebase origin main     # put the remote's commits under yours
git push origin main              # try again
```
- `pull` = `fetch` (download) + `merge` (combine). The `--rebase` flag replays
  your commits on top of the remote's instead of making a messy merge.
- `git stash -u` hides all uncommitted changes so you can pull safely. Only
  needed if you have unsaved work — if `git status` says "working tree clean",
  skip it.

### "pathspec 'feature/xyz' did not match any file(s)"
The branch doesn't exist on *your* computer (maybe a friend pushed it to
GitHub). Your git only knows about branches it has seen before.

```bash
git fetch origin
git checkout feature/xyz
```
If that still fails: `git checkout -b feature/xyz origin/feature/xyz`.

---

## The Vercel rule — who can deploy (IMPORTANT)

The live app auto-deploys on every push to `main`, but the build runs on the
**repo owner's** Vercel account — not on anyone's laptop.

Here's the catch we hit:
- The repo is **private** and we're on Vercel's **free (Hobby) plan**.
- On that plan, Vercel checks the *author of the commit* before deploying. If
  the author isn't a member of the Vercel project, **the deployment is blocked
  — even if the code is perfect.** This happened once: a friend pushed good
  code and Vercel refused to build it.
- No code change can fix this. Options: the owner does the merge (below),
  upgrade Vercel to Pro, or make the repo public.

**So the rule is simply:**

| Who | Can push to | Can deploy |
|---|---|---|
| **Owner** | `main` and any branch | ✅ yes (commit is in your name) |
| **Friend** | feature branches only | ❌ no — unless the owner does the merge |

### Friend — how to hand code to the owner
1. Work on a branch: `git checkout -b feature/my-thing`
2. Commit + push that branch (never `main`).
3. Open a Pull Request on GitHub (base = `main`, compare = your branch) so the
   owner knows it's ready to review.

### Owner — how to bring a friend's branch into `main` (deploy works)
```bash
git fetch origin
git checkout feature/friend-branch     # first look at their work
git log --oneline -5                   # see their commits
git checkout main
git pull --rebase origin main
git merge --no-ff feature/friend-branch
git push origin main
```

**The magic flag: `--no-ff`**
A plain `git merge` can "fast-forward" — this keeps the friend as the commit
author on `main`, and Vercel would **block the deploy again**. `--no-ff`
forces a normal merge commit **authored by you**, so Vercel sees your name and
deploys. Always use it when merging someone else's branch.

After the push: watch vercel.com → project → **Deployments** until it turns
green, then hard-refresh the site (`Ctrl + Shift + R`) to clear the old cache.

---

## Golden rules
1. Never push to `main` directly — always use a branch + PR.
2. Pull before you start work (so you don't build on old files).
3. One branch = one feature or fix (easy to review, easy to undo).
4. Test your own work before merging.
5. Never commit secrets (`.env`, API keys).
6. Delete branches after they're merged.
7. Owner merges with `--no-ff` (or a PR) so the deploy isn't blocked.
8. Not sure? Ask. Worst case is you ask a question, not break the app.

---

## Windows setup — the short version
1. Install **Git for Windows**: https://git-scm.com/download/win
2. Install **Node.js LTS**: https://nodejs.org/
3. Check it worked (in a terminal):
   ```bash
   git --version
   node --version
   npm --version
   ```
4. In the project folder:
   ```bash
   npm install        # download the app's packages
   npm run dev        # start the app; open the URL Vite prints
   ```