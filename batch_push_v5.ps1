# batch_push_v5.ps1
# Function: Universal batch uploader (Snowball Fix Version)
# 1. Resets local stuck commits.
# 2. Uploads 1 file at a time.
# 3. Retries indefinitely on failure.

$Branch = "main"

# Force UTF-8 Output
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "Initializing V5 Uploader..." -ForegroundColor Cyan

# 0. Increase Git Buffer
git config --global http.postBuffer 524288000

# 1. Ensure correct branch
$CurrentBranch = git branch --show-current
if ([string]::IsNullOrWhiteSpace($CurrentBranch) -or $CurrentBranch -eq "master") {
    git branch -m master main 2>$null
    $Branch = "main"
} else {
    $Branch = $CurrentBranch
}

# 2. CRITICAL: Reset the "Snowball"
# Fetch latest state from GitHub to know where we really are
Write-Host "Fetching remote state..." -ForegroundColor Cyan
git fetch origin $Branch

# Soft reset to origin: keeps changes in files, but undoes local commits
# This fixes the issue where previous failed commits made the push too large
Write-Host "Resetting local commits to match remote (keeping file changes)..." -ForegroundColor Yellow
git reset --mixed "origin/$Branch"

# 3. Scan files
Write-Host "Scanning file system..." -ForegroundColor Cyan
$AllFiles = Get-ChildItem -Path . -Recurse -File | Where-Object { $_.FullName -notmatch "\\.git\\" }
$TotalScan = $AllFiles.Count

$Count = 0
$ProcessedCount = 0

foreach ($File in $AllFiles) {
    $ProcessedCount++
    if ($ProcessedCount % 50 -eq 0) {
        Write-Host "Scanned $ProcessedCount / $TotalScan ..." -ForegroundColor Gray
    }

    $RelPath = $File.FullName.Substring((Get-Location).Path.Length + 1)
    
    # Check status
    $Status = git status --porcelain "$RelPath"
    
    if (-not [string]::IsNullOrWhiteSpace($Status)) {
        $Count++
        
        Write-Host "[$Count] Processing: $RelPath" -ForegroundColor Green
        
        # Add SINGLE file
        git add "$RelPath"
        git commit -m "Upload: $RelPath" > $null
        
        # PUSH LOOP (Strict)
        $PushSuccess = $false
        while (-not $PushSuccess) {
            Write-Host "  Pushing..." -ForegroundColor Cyan
            try {
                git push origin $Branch
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "  OK!" -ForegroundColor Green
                    $PushSuccess = $true
                } else {
                    Write-Host "  Push Failed (Network/Timeout). Retrying in 5s..." -ForegroundColor Red
                    Start-Sleep -Seconds 5
                }
            } catch {
                Write-Host "  Exception. Retrying in 5s..." -ForegroundColor Red
                Start-Sleep -Seconds 5
            }
        }
        
        # Small delay to be nice to the API
        Start-Sleep -Milliseconds 500
    }
}

Write-Host "All uploads complete!" -ForegroundColor Green
