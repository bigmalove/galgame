# batch_push_images.ps1
# Function: Continuously add changed files and push them in batches.
# Version: 3.0 (Fixes Chinese paths & Branch name)

$BatchSize = 2  # Number of files per commit

# 1. Fix git encoding output (Crucial for Chinese paths)
Write-Host "Configuring git encoding..." -ForegroundColor Cyan
git config core.quotePath false
git config --global core.quotepath false

# 2. Ensure we are on 'main' branch
$CurrentBranch = git branch --show-current
if ($CurrentBranch -eq "master") {
    Write-Host "Renaming branch 'master' to 'main'..." -ForegroundColor Yellow
    git branch -m master main
    $CurrentBranch = "main"
} elseif ([string]::IsNullOrWhiteSpace($CurrentBranch)) {
    # In case of fresh init without commits, force main
    git checkout -b main 2>$null
    $CurrentBranch = "main"
}

Write-Host "Current Branch: $CurrentBranch" -ForegroundColor Cyan

Write-Host "Scanning for changed files..." -ForegroundColor Cyan

# 3. Get all modified/untracked files using git status
# returns lines like: "?? path/to/file.jpg" or " M path/to/file.js"
$GitStatus = git status --porcelain

if ($null -eq $GitStatus -or $GitStatus.Count -eq 0) {
    Write-Host "No changes found to upload." -ForegroundColor Green
    exit
}

$FilesToProcess = @()
foreach ($Line in $GitStatus) {
    if ($Line.Length -gt 3) {
        # Extract file path (remove status code at start)
        # Remove quotes if present (standard output shouldn't have quotes with quotePath false)
        $Path = $Line.Substring(3).Trim('"')
        $FilesToProcess += $Path
    }
}

$Total = $FilesToProcess.Count
Write-Host "Found $Total files to upload." -ForegroundColor Yellow

$Count = 0
$BatchPaths = @()

foreach ($FilePath in $FilesToProcess) {
    $Count++
    $BatchPaths += $FilePath
    
    # Check if file exists to avoid errors
    if (!(Test-Path $FilePath)) {
        Write-Host "Skipping deleted file: $FilePath" -ForegroundColor Gray
        continue
    }

    Write-Host "[$Count / $Total] Adding: $FilePath"
    git add "$FilePath"
    
    # If batch size reached or it's the last file
    if ($BatchPaths.Count -ge $BatchSize -or $Count -eq $Total) {
        Write-Host "Committing and Pushing batch..." -ForegroundColor Cyan
        
        try {
            git commit -m "Batch upload ($Count / $Total)"
            
            # Use --set-upstream for the first push if needed
            git push origin $CurrentBranch
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "Batch success!" -ForegroundColor Green
            } else {
                Write-Host "Push failed. Waiting 5s to retry..." -ForegroundColor Red
                Start-Sleep -Seconds 5
                git push origin $CurrentBranch
            }
        } catch {
            Write-Host "Error during push. Retrying in 5s..." -ForegroundColor Red
            Start-Sleep -Seconds 5
            try { git push origin $CurrentBranch } catch { Write-Host "Retry failed. Moving to next batch." -ForegroundColor Red }
        }
        
        # Reset batch
        $BatchPaths = @()
        Start-Sleep -Seconds 1
    }
}

Write-Host "Process complete!" -ForegroundColor Green
