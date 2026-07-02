$BASE_URL = "https://model.hacxy.cn"
$OUTPUT_DIR = Join-Path $PSScriptRoot "..\public\live2d"

$MODELS = @(
    "shizuku_pajama"
    "Senko_Normals"
    "umaru"
)

function Download-Dir {
    param([string]$Url, [string]$LocalPath)
    New-Item -ItemType Directory -Force -Path $LocalPath | Out-Null
    try {
        $html = Invoke-WebRequest -Uri $Url -UseBasicParsing
    } catch {
        Write-Warning "Cannot access: $Url"
        return
    }
    $links = $html.Links | Where-Object {
        $_.href -notmatch "^\.\.\/" -and $_.href -ne "" -and $_.href -notmatch "^#"
    } | Select-Object -ExpandProperty href

    foreach ($link in $links) {
        $absUrl = if ($link -match "^https?://") { $link } else { ($Url.TrimEnd("/") + "/" + $link.TrimStart("/")) }
        $name = $link.TrimEnd("/").Split("/")[-1]
        $localTarget = Join-Path $LocalPath $name
        if ($link.EndsWith("/")) {
            Write-Host "  [DIR] $name"
            Download-Dir -Url $absUrl.TrimEnd("/") -LocalPath $localTarget
        } else {
            if (-not (Test-Path $localTarget)) {
                Write-Host "  [DL]  $name"
                try { Invoke-WebRequest -Uri $absUrl -OutFile $localTarget -UseBasicParsing }
                catch { Write-Warning "Failed: $absUrl" }
            } else {
                Write-Host "  [OK]  $name (skip)"
            }
        }
    }
}

Write-Host "Start downloading Live2D models..."
Write-Host "Output: $OUTPUT_DIR"

foreach ($model in $MODELS) {
    Write-Host "Model: $model"
    Download-Dir -Url "$BASE_URL/$model" -LocalPath (Join-Path $OUTPUT_DIR $model)
    Write-Host "Done: $model"
}

Write-Host "All finished!"
