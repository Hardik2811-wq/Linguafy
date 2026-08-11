# Push-to-GitHub helper script
# Usage: run from repository root in PowerShell: `.	emplates\scripts\push_to_github.ps1` or `powershell -ExecutionPolicy Bypass -File .\scripts\push_to_github.ps1`

# NOTE: This script runs git commands on your machine. It will stop if git isn't available or if a rebase conflict occurs.

function Exec-Git {
    param($args)
    Write-Output "\n> git $args"
    & git $args
    return $LASTEXITCODE
}

# Check git
try {
    & git --version > $null 2>&1
} catch {
    Write-Error "Git doesn't appear to be installed or not on PATH. Install Git and re-run this script."
    exit 1
}

Write-Output "This script will:"
Write-Output " - (optionally) stop tracking backend/.env and large zip assets"
Write-Output " - update .gitignore"
Write-Output " - stage all files, commit, fetch and rebase onto origin/main, then push"

$ok = Read-Host "Proceed? Type Y to continue"
if ($ok -ne 'Y') { Write-Output 'Aborted by user.'; exit 0 }

# Optionally remove tracked secrets and large zips
$cleanup = Read-Host "Remove tracked backend/.env and large zip assets from the index? (Y/N)"
if ($cleanup -eq 'Y') {
    Write-Output "Removing tracked backend/.env (keeps your local file)..."
    Exec-Git 'rm --cached backend/.env' | Out-Null
    if (-not (Test-Path .gitignore)) { Set-Content .gitignore "node_modules`ndist`n.env`n" }
    if (-not (Select-String -Path .gitignore -Pattern 'backend/.env' -Quiet)) { Add-Content .gitignore "backend/.env" }

    $zip1 = 'linguafy_upload.zip'
    $zip2 = 'linguafy-brand-assets.zip'
    if (Test-Path $zip1) { Exec-Git "rm --cached $zip1" | Out-Null; if (-not (Select-String -Path .gitignore -Pattern [regex]::Escape($zip1) -Quiet)) { Add-Content .gitignore $zip1 } }
    if (Test-Path $zip2) { Exec-Git "rm --cached $zip2" | Out-Null; if (-not (Select-String -Path .gitignore -Pattern [regex]::Escape($zip2) -Quiet)) { Add-Content .gitignore $zip2 } }

    Exec-Git 'add .gitignore' | Out-Null
    Write-Output "Staged .gitignore updates."
}

# Stage everything
Exec-Git 'add -A'

# Commit
$msg = Read-Host "Commit message (press Enter for 'Update project')"
if ([string]::IsNullOrWhiteSpace($msg)) { $msg = 'Update project' }
$exit = Exec-Git "commit -m `"$msg`""
if ($exit -ne 0) { Write-Output "No new commit created (maybe nothing to commit)." }

# Fetch and rebase
Exec-Git 'fetch origin'
$exit = Exec-Git 'pull --rebase origin main'
if ($exit -ne 0) {
    Write-Error "Pull --rebase failed. If there are conflicts, resolve them manually, then run: git rebase --continue"
    Write-Output "To abort the rebase and restore previous state: git rebase --abort"
    exit $exit
}

# Push
$exit = Exec-Git 'push -u origin main'
if ($exit -ne 0) {
    Write-Error "Push failed. Inspect output above and try again (you may need to force push only if you intend to overwrite remote)."
    exit $exit
}

Write-Output "Push completed successfully. Branch 'main' now tracks origin/main."
exit 0
