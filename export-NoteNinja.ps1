# Simple Project Exporter for React Native / Expo Projects
# Usage: PowerShell -ExecutionPolicy Bypass -File .\export-NoteNinja-clean.ps1

# Configuration
$ProjectPath = Get-Location
$OutputFile = "NoteNinja-project-export.txt"

$ExcludeFolders = @(
    "node_modules", 
    ".git", 
    ".expo", 
    "android", 
    "ios", 
    "build", 
    "dist",
    ".vscode",
    ".idea"
)

$IncludeExtensions = @(
    "*.ts",
    "*.tsx",
    "*.js",
    "*.jsx",
    "*.json",
    "*.md",
    "*.txt"
)

# Script start
Clear-Host
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  NOTE-NINJA PROJECT EXPORTER" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project: $ProjectPath" -ForegroundColor Yellow
Write-Host "Output:  $OutputFile" -ForegroundColor Yellow
Write-Host ""

function Get-Tree {
    param(
        [string]$Path,
        [string]$Prefix = "",
        [string[]]$Exclude
    )
    
    $items = Get-ChildItem -Path $Path -ErrorAction SilentlyContinue | 
        Where-Object { $_.Name -notin $Exclude } |
        Sort-Object { $_.PSIsContainer }, Name
    
    $result = ""
    $count = $items.Count
    $current = 0
    
    foreach ($item in $items) {
        $current++
        $isLast = ($current -eq $count)
        
        if ($isLast) {
            $connector = "+-- "
            $extension = "    "
        } else {
            $connector = "+-- "
            $extension = "|   "
        }
        
        if ($item.PSIsContainer) {
            $result += "$Prefix$connector$($item.Name)/`n"
            $result += Get-Tree -Path $item.FullName -Prefix "$Prefix$extension" -Exclude $Exclude
        } else {
            $result += "$Prefix$connector$($item.Name)`n"
        }
    }
    
    return $result
}

# Start building output
$output = @()
$output += "=" * 80
$output += "NOTE-NINJA APP - PROJECT EXPORT"
$output += "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$output += "Path: $ProjectPath"
$output += "=" * 80
$output += ""

# Directory Structure
Write-Host "Building directory tree..." -ForegroundColor Cyan
$output += "=" * 80
$output += "DIRECTORY STRUCTURE"
$output += "=" * 80
$output += ""
$output += "$((Get-Item $ProjectPath).Name)/"
$output += Get-Tree -Path $ProjectPath -Exclude $ExcludeFolders
$output += ""

# File Contents
Write-Host "Reading files..." -ForegroundColor Cyan
$output += "=" * 80
$output += "FILE CONTENTS"
$output += "=" * 80
$output += ""

# Get all matching files
$files = Get-ChildItem -Path $ProjectPath -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
        $inExcluded = $false
        foreach ($folder in $ExcludeFolders) {
            if ($_.FullName -match [regex]::Escape($folder)) {
                $inExcluded = $true
                break
            }
        }
        
        if (-not $inExcluded) {
            foreach ($ext in $IncludeExtensions) {
                if ($_.Name -like $ext) {
                    return $true
                }
            }
        }
        
        return $false
    } |
    Sort-Object FullName

$fileCount = 0
$errorCount = 0

foreach ($file in $files) {
    $relativePath = $file.FullName.Replace($ProjectPath, "").TrimStart("\", "/")
    
    try {
        $output += "-" * 80
        $output += "FILE: $relativePath"
        $output += "-" * 80
        $output += ""
        
        $content = Get-Content -Path $file.FullName -Raw -ErrorAction Stop
        $output += $content
        $output += ""
        $output += ""
        
        $fileCount++
        Write-Host "  OK: $relativePath" -ForegroundColor Gray
    }
    catch {
        $output += "[ERROR: Could not read file]"
        $output += ""
        $errorCount++
        Write-Host "  ERROR: $relativePath" -ForegroundColor Red
    }
}

# Write output
Write-Host ""
Write-Host "Writing to file..." -ForegroundColor Cyan
$outputPath = Join-Path -Path $ProjectPath -ChildPath $OutputFile
$output -join "`n" | Out-File -FilePath $outputPath -Encoding UTF8

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  EXPORT COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Statistics:" -ForegroundColor Yellow
Write-Host "  Files processed: $fileCount" -ForegroundColor White
Write-Host "  Errors: $errorCount" -ForegroundColor White
Write-Host "  Output size: $([math]::Round((Get-Item $outputPath).Length / 1KB, 2)) KB" -ForegroundColor White
Write-Host ""
Write-Host "Saved to: $outputPath" -ForegroundColor White
Write-Host ""
Write-Host "Ready to upload to Claude!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")