# Pack all skill packages into ZIP files
# Usage: Run .\pack.ps1 in the workbuddy-skills directory

$skills = @(
    "lesson-material-collector",
    "lesson-plan-generator",
    "lesson-folder-builder",
    "ppt-notes-generator",
    "student-data-analyzer",
    "audio-script-maker"
)

$outputDir = ".\dist"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

foreach ($skill in $skills) {
    $sourcePath = ".\$skill"
    $zipPath = "$outputDir\$skill.zip"
    
    if (Test-Path $sourcePath) {
        if (Test-Path $zipPath) {
            Remove-Item $zipPath -Force
        }
        Compress-Archive -Path "$sourcePath\*" -DestinationPath $zipPath
        Write-Host "[OK] Packed: $skill.zip" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Directory not found: $skill" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "[DONE] All skill packages packed to $outputDir" -ForegroundColor Cyan
Write-Host "[TIP] Upload ZIP files via WorkBuddy: Expert -> Skills -> Upload Skill (do NOT unzip!)" -ForegroundColor Yellow
