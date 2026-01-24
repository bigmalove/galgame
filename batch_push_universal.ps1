# batch_push_universal.ps1
# Function: Universal batch uploader for Git
# Note: English-only version to prevent encoding errors on Windows

$BatchSize = 2       # Files per commit
$Branch = "main"     # Target branch

Write-Host "Initializing..." -ForegroundColor Cyan

# 1. Ensure correct branch
$CurrentBranch = git branch --show-current
if ([string]::IsNullOrWhiteSpace($CurrentBranch) -or $CurrentBranch -eq "master") {
    # Try to rename or switch
    git branch -m master main 2>$null
    $Branch = "main"
} else {
    $Branch = $CurrentBranch
}
Write-Host "Current Branch: $Branch" -ForegroundColor Cyan

# 2. Get all files (excluding .git)
Write-Host "Scanning file system..." -ForegroundColor Cyan
$AllFiles = Get-ChildItem -Path . -Recurse -File | Where-Object { $_.FullName -notmatch "\\.git\\" }

$TotalScan = $AllFiles.Count
Write-Host "Scanned $TotalScan files. Checking Git status..." -ForegroundColor Yellow

$Count = 0
$BatchPaths = @()
$ProcessedCount = 0

foreach ($File in $AllFiles) {
    $ProcessedCount++
    if ($ProcessedCount % 100 -eq 0) {
        Write-Host "Checked $ProcessedCount / $TotalScan files..." -ForegroundColor Gray
    }

    # Get relative path unique to current location
    $RelPath = $File.FullName.Substring((Get-Location).Path.Length + 1)
    
    # Query git status for this specific file
    # This avoids parsing garbled output from 'git status'
    $Status = git status --porcelain "$RelPath"
    
    # If output exists, the file is modified/added/untracked
    if (-not [string]::IsNullOrWhiteSpace($Status)) {
        $Count++
        $BatchPaths += $RelPath
        
        Write-Host "[$Count] Found change: $RelPath" -ForegroundColor Green
        git add "$RelPath"
        
        # Commit and push if batch size reached
        if ($BatchPaths.Count -ge $BatchSize) {
            Write-Host "Committing and pushing batch..." -ForegroundColor Cyan
            try {
                git commit -m "Batch upload ($Count)"
                git push origin $Branch
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "Push Success!" -ForegroundColor Green
                } else {
                    Write-Host "Push failed. Retrying in 5s..." -ForegroundColor Red
                    Start-Sleep -Seconds 5
                    git push origin $Branch
                }
            } catch {
                Write-Host "Exception occurred. Skipping push for this batch (files are staged)." -ForegroundColor Red
            }
            $BatchPaths = @()
        }
    }
}

# Process remaining files
if ($BatchPaths.Count -gt 0) {
    Write-Host "Pushing final files ($($BatchPaths.Count))..." -ForegroundColor Cyan
    git commit -m "Batch upload final"
    git push origin $Branch
}

Write-Host "All operations complete!" -ForegroundColor Green
