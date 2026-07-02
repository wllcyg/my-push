$BUCKET = "live2d-models"
$LOCAL_DIR = Join-Path $PSScriptRoot "..\public\live2d"

$files = Get-ChildItem -Path $LOCAL_DIR -Recurse -File
$total = $files.Count
$current = 0

Write-Host "Found $total files to upload to R2 bucket: $BUCKET"
Write-Host ""

foreach ($file in $files) {
    $current++
    $relativePath = $file.FullName.Substring($LOCAL_DIR.Length).TrimStart('\', '/')
    $r2Key = $relativePath.Replace('\', '/')

    Write-Host "[$current/$total] $r2Key"

    $mimeType = switch ($file.Extension.ToLower()) {
        ".json"  { "application/json" }
        ".png"   { "image/png" }
        ".jpg"   { "image/jpeg" }
        ".jpeg"  { "image/jpeg" }
        ".moc"   { "application/octet-stream" }
        ".moc3"  { "application/octet-stream" }
        ".mtn"   { "application/octet-stream" }
        ".wav"   { "audio/wav" }
        ".exp.json" { "application/json" }
        default  { "application/octet-stream" }
    }

    wrangler r2 object put "$BUCKET/$r2Key" --file $file.FullName --content-type $mimeType
}

Write-Host ""
Write-Host "Done! $total files uploaded to r2://$BUCKET"
