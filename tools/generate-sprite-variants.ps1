param(
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

Add-Type -AssemblyName System.Drawing

$assetRoot = Join-Path $ProjectRoot 'public\assets'
$files = @(
  'soldado-sheet.png', 'soldado-attack01.png', 'soldado-attack02.png',
  'soldado-idle.png', 'soldado-death.png',
  'Knight_Walk.png', 'Knight_Attack01.png', 'Knight_Attack02.png',
  'Knight_Attack03.png', 'Knight_Idle.png', 'Knight_Death.png',
  'Knight_Hurt.png', 'Knight_Block.png'
)

foreach ($team in @('jade','coral')) {
  $outputRoot = Join-Path $assetRoot "variants\$team"
  New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
  foreach ($file in $files) {
    $sourcePath = Join-Path $assetRoot $file
    $targetPath = Join-Path $outputRoot $file
    $loaded = [System.Drawing.Bitmap]::FromFile($sourcePath)
    try {
      $target = New-Object System.Drawing.Bitmap($loaded.Width, $loaded.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
      try {
        $graphics = [System.Drawing.Graphics]::FromImage($target)
        try { $graphics.DrawImageUnscaled($loaded, 0, 0) } finally { $graphics.Dispose() }
        $rect = New-Object System.Drawing.Rectangle(0, 0, $target.Width, $target.Height)
        $data = $target.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        try {
          $length = [Math]::Abs($data.Stride) * $target.Height
          $pixels = New-Object byte[] $length
          [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $pixels, 0, $length)
          for ($i=0; $i -lt $length; $i+=4) {
            $b=$pixels[$i]; $g=$pixels[$i+1]; $r=$pixels[$i+2]; $a=$pixels[$i+3]
            if ($a -eq 0) { continue }
            $redLead = $r - [Math]::Max($g,$b)
            $balancedRed = [Math]::Abs($g-$b) -le [Math]::Max(9,$g*0.28)
            if ($r -lt 65 -or $redLead -lt 24 -or -not $balancedRed) { continue }
            $level=[Math]::Max($r,[Math]::Max($g,$b))/255.0
            if ($team -eq 'jade') {
              $pixels[$i+2]=[byte][Math]::Min(255,[Math]::Round(5+46*$level))
              $pixels[$i+1]=[byte][Math]::Min(255,[Math]::Round(35+190*$level))
              $pixels[$i]=[byte][Math]::Min(255,[Math]::Round(31+140*$level))
            } else {
              $pixels[$i+2]=[byte][Math]::Min(255,[Math]::Round(72+180*$level))
              $pixels[$i+1]=[byte][Math]::Min(255,[Math]::Round(12+62*$level))
              $pixels[$i]=[byte][Math]::Min(255,[Math]::Round(38+96*$level))
            }
          }
          [System.Runtime.InteropServices.Marshal]::Copy($pixels, 0, $data.Scan0, $length)
        } finally { $target.UnlockBits($data) }
        if (Test-Path -LiteralPath $targetPath) { Remove-Item -LiteralPath $targetPath -Force }
        $target.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
      } finally { $target.Dispose() }
    } finally { $loaded.Dispose() }
  }
}

Write-Output "Variantes Jade y Coral generadas: $($files.Count * 2) hojas PNG"
