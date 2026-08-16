param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath,
    [Parameter(Mandatory = $true)]
    [string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$source = [System.Drawing.Bitmap]::FromFile($InputPath)
$output = New-Object System.Drawing.Bitmap(
    $source.Width,
    $source.Height,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
)

try {
    $graphics = [System.Drawing.Graphics]::FromImage($output)
    try {
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $graphics.DrawImageUnscaled($source, 0, 0)
    }
    finally {
        $graphics.Dispose()
    }

    $rect = New-Object System.Drawing.Rectangle(0, 0, $output.Width, $output.Height)
    $data = $output.LockBits(
        $rect,
        [System.Drawing.Imaging.ImageLockMode]::ReadWrite,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    try {
        $byteCount = [Math]::Abs($data.Stride) * $data.Height
        $pixels = New-Object byte[] $byteCount
        [Runtime.InteropServices.Marshal]::Copy($data.Scan0, $pixels, 0, $byteCount)

        for ($y = 0; $y -lt $data.Height; $y++) {
            $row = $y * $data.Stride
            for ($x = 0; $x -lt $data.Width; $x++) {
                $i = $row + $x * 4
                $b = [int]$pixels[$i]
                $g = [int]$pixels[$i + 1]
                $r = [int]$pixels[$i + 2]
                $hi = [Math]::Max($r, [Math]::Max($g, $b))
                $lo = [Math]::Min($r, [Math]::Min($g, $b))
                $range = $hi - $lo

                # ImageGen sometimes bakes its transparency preview into the PNG.
                # The preview tiles are bright neutral grays; actual rural art is
                # substantially darker or chromatic. A narrow feather removes the
                # antialiased fringe without erasing roads, stone, or highlights.
                if ($lo -ge 236 -and $range -le 45) {
                    $pixels[$i + 3] = 0
                }
                elseif ($lo -ge 210 -and $range -le 30) {
                    $alpha = [int][Math]::Round(255 * (236 - $lo) / 26)
                    $pixels[$i + 3] = [byte][Math]::Max(0, [Math]::Min(255, $alpha))
                }
                else {
                    $pixels[$i + 3] = 255
                }
            }
        }

        [Runtime.InteropServices.Marshal]::Copy($pixels, 0, $data.Scan0, $byteCount)
    }
    finally {
        $output.UnlockBits($data)
    }

    $directory = Split-Path -Parent $OutputPath
    if ($directory -and -not (Test-Path -LiteralPath $directory)) {
        New-Item -ItemType Directory -Path $directory | Out-Null
    }
    $output.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
}
finally {
    $output.Dispose()
    $source.Dispose()
}

