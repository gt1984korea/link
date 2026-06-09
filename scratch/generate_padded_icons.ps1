Add-Type -AssemblyName System.Drawing

function Resize-And-Pad {
    param (
        [string]$sourcePath,
        [int]$targetSize,
        [string]$destPath
    )
    
    # Load original image
    $srcImg = [System.Drawing.Image]::FromFile($sourcePath)
    $w = $srcImg.Width
    $h = $srcImg.Height
    
    # Calculate new dimensions (keep aspect ratio)
    $newW = $targetSize
    # We want to leave some padding on the sides, say 10% on each side so the logo isn't touching the edge.
    $paddedSize = [math]::Round($targetSize * 0.8)
    
    $newW = $paddedSize
    $newH = [math]::Round($paddedSize * ($h / $w))
    if ($newH -gt $paddedSize) {
        $newH = $paddedSize
        $newW = [math]::Round($paddedSize * ($w / $h))
    }
    
    # Create target square canvas (transparent background)
    $destBmp = New-Object System.Drawing.Bitmap($targetSize, $targetSize)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    
    # Clear background to transparent
    $g.Clear([System.Drawing.Color]::Transparent)
    
    # High-quality rendering settings
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    
    # Calculate center offsets
    $xOffset = ($targetSize - $newW) / 2
    $yOffset = ($targetSize - $newH) / 2
    
    # Draw original image resized
    $g.DrawImage($srcImg, $xOffset, $yOffset, $newW, $newH)
    
    # Save as PNG
    $destBmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    # Dispose resources
    $g.Dispose()
    $destBmp.Dispose()
    $srcImg.Dispose()
}

$workspace = "c:\Users\gt198\Documents\GitHub\testApp\link"
$originalLogo = Join-Path $workspace "logo_original.png"

Resize-And-Pad -sourcePath $originalLogo -targetSize 192 -destPath (Join-Path $workspace "icon-192.png")
Resize-And-Pad -sourcePath $originalLogo -targetSize 512 -destPath (Join-Path $workspace "icon-512.png")

Write-Host "Padded icons successfully generated!"
