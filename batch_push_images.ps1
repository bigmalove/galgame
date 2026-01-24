# batch_push_images.ps1
# Function: Continuously add changed files and push them in batches.
# This prevents timeouts when uploading many large files (like images).

$BatchSize = 2  # Number of files per commit
$Branch = "main"

Write-Host "Scanning for changed files..." -ForegroundColor Cyan

# 1. Get all modified/untracked files using git status
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
        # Remove quotes if present
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
    
    Write-Host "[$Count / $Total] Adding: $FilePath"
    git add "$FilePath"
    
    # If batch size reached or it's the last file
    if ($BatchPaths.Count -ge $BatchSize -or $Count -eq $Total) {
        Write-Host "Committing and Pushing batch..." -ForegroundColor Cyan
        
        try {
            git commit -m "Batch upload ($Count / $Total)"
            git push origin $Branch
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "Batch success!" -ForegroundColor Green
            } else {
                Write-Host "Push failed. Waiting 5s to retry..." -ForegroundColor Red
                Start-Sleep -Seconds 5
                git push origin $Branch
            }
        } catch {
            Write-Host "Error during push. Retrying in 5s..." -ForegroundColor Red
            Start-Sleep -Seconds 5
            try { git push origin $Branch } catch { Write-Host "Retry failed. Moving to next batch." -ForegroundColor Red }
        }
        
        # Reset batch
        $BatchPaths = @()
        Start-Sleep -Seconds 1
    }
}

Write-Host "Process complete!" -ForegroundColor Green
