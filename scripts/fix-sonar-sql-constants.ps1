# ============================================================================
# Script: Fix SonarQube SQL Issues Automatically
# ============================================================================
# يقوم هذا السكريبت بإصلاح المشاكل الحرجة في ملفات SQL migrations
# من خلال استبدال القيم الثابتة المكررة بدوال الثوابت

param(
    [switch]$DryRun = $false,
    [string]$Path = ".\supabase\migrations"
)

$ErrorActionPreference = "Stop"

# ============================================================================
# Constants Mapping
# ============================================================================
$replacements = @{
    # Order status
    "'cancelled'" = "_const_order_cancelled()"

    # Work types
    "'orders'" = "_const_work_orders()"
    "'shift'" = "_const_work_shift()"
    "'hybrid'" = "_const_work_hybrid()"

    # Approval status
    "'approved'" = "_const_approval_approved()"

    # Installment statuses
    "'pending'" = "_const_installment_pending()"
    "'deferred'" = "_const_installment_deferred()"

    # Payment methods
    "'cash'" = "_const_payment_cash()"
    "'bank'" = "_const_payment_bank()"

    # Calculation status
    "'calculated'" = "_const_calc_calculated()"

    # Calculation sources
    "'engine_v6_shift_fallback'" = "_const_calc_source_v6()"
    "'engine_v7_shift_fixed'" = "_const_calc_source_v7()"

    # Calculation methods
    # Note: These need context-aware replacement
    # "'orders'" already mapped above
    # "'shift'" already mapped above
    "'shift_fixed'" = "_const_calc_method_shift_fixed()"
    "'shift_full_month'" = "_const_calc_method_shift_full_month()"
    "'mixed'" = "_const_calc_method_mixed()"
    "'orders_fallback'" = "_const_calc_method_orders_fallback()"

    # Tier types
    "'fixed_amount'" = "_const_tier_fixed()"
    "'base_plus_incremental'" = "_const_tier_incremental()"

    # Employee status
    "'active'" = "_const_employee_active()"

    # Numeric constants
    "30.0" = "_const_days_per_month()"
    "/ 30 " = "/ _const_days_per_month() "
}

# ============================================================================
# Boolean comparison fixes
# ============================================================================
$booleanFixes = @{
    "= true" = "IS TRUE"
    "= false" = "IS FALSE"
    "<> true" = "IS NOT TRUE"
    "<> false" = "IS NOT FALSE"
    "!= true" = "IS NOT TRUE"
    "!= false" = "IS NOT FALSE"
}

# ============================================================================
# Functions
# ============================================================================

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Output $Message -ForegroundColor $Color
}

function Get-SqlFiles {
    param([string]$Directory)

    Get-ChildItem -Path $Directory -Filter "*.sql" -Recurse |
        Where-Object { $_.Name -notlike "_*" } # Skip _constants.sql
}

function Test-NeedsReplacement {
    param(
        [string]$Content,
        [hashtable]$Replacements
    )

    foreach ($key in $Replacements.Keys) {
        if ($Content -match [regex]::Escape($key)) {
            return $true
        }
    }
    return $false
}

function Apply-Replacements {
    param(
        [string]$Content,
        [hashtable]$Replacements
    )

    $modified = $Content
    $changeCount = 0

    foreach ($key in $Replacements.Keys) {
        $value = $Replacements[$key]
        $pattern = [regex]::Escape($key)

        # Count occurrences
        $matchRes = [regex]::Matches($modified, $pattern)
        if ($matchRes.Count -gt 0) {
            $modified = $modified -replace $pattern, $value
            $changeCount += $matchRes.Count
            Write-ColorOutput "  [OK] Replaced $key with $value ($($matchRes.Count) times)" "Green"
        }
    }

    return @{
        Content = $modified
        ChangeCount = $changeCount
    }
}

function Fix-BooleanComparisons {
    param([string]$Content)

    $modified = $Content
    $changeCount = 0

    foreach ($key in $booleanFixes.Keys) {
        $value = $booleanFixes[$key]
        $pattern = [regex]::Escape($key)

        $matchRes = [regex]::Matches($modified, $pattern)
        if ($matchRes.Count -gt 0) {
            $modified = $modified -replace $pattern, $value
            $changeCount += $matchRes.Count
            Write-ColorOutput "  [OK] Fixed boolean: $key with $value ($($matchRes.Count) times)" "Cyan"
        }
    }

    return @{
        Content = $modified
        ChangeCount = $changeCount
    }
}

# ============================================================================
# Main Script
# ============================================================================

Write-ColorOutput "`n+============================================================+" "Yellow"
Write-ColorOutput "|  SonarQube SQL Issues Auto-Fix Script                     |" "Yellow"
Write-ColorOutput "+============================================================+`n" "Yellow"

if ($DryRun) {
    Write-ColorOutput "[DRY RUN MODE] - No files will be modified`n" "Magenta"
}

# Get all SQL files
$sqlFiles = Get-SqlFiles -Directory $Path
Write-ColorOutput "Found $($sqlFiles.Count) SQL files in '$Path'`n" "White"

$stats = @{
    TotalFiles = $sqlFiles.Count
    ModifiedFiles = 0
    TotalReplacements = 0
    SkippedFiles = 0
}

foreach ($file in $sqlFiles) {
    Write-ColorOutput "Processing: $($file.Name)" "Yellow"

    try {
        $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8

        # Check if file needs changes
        if (-not (Test-NeedsReplacement -Content $content -Replacements $replacements)) {
            Write-ColorOutput "  No changes needed`n" "Gray"
            $stats.SkippedFiles++
            continue
        }

        # Apply string replacements
        $result1 = Apply-Replacements -Content $content -Replacements $replacements

        # Apply boolean fixes
        $result2 = Fix-BooleanComparisons -Content $result1.Content

        $totalChanges = $result1.ChangeCount + $result2.ChangeCount

        if ($totalChanges -gt 0) {
            if (-not $DryRun) {
                Set-Content -Path $file.FullName -Value $result2.Content -Encoding UTF8 -NoNewline
                Write-ColorOutput "  Saved $totalChanges changes`n" "Green"
            } else {
                Write-ColorOutput "  Would save $totalChanges changes (dry run)`n" "Cyan"
            }

            $stats.ModifiedFiles++
            $stats.TotalReplacements += $totalChanges
        }

    } catch {
        Write-ColorOutput "  Error: $($_.Exception.Message)`n" "Red"
    }
}

# ============================================================================
# Summary
# ============================================================================

Write-ColorOutput "`n+============================================================+" "Yellow"
Write-ColorOutput "|  Summary                                                   |" "Yellow"
Write-ColorOutput "+============================================================+`n" "Yellow"

Write-ColorOutput "Total files scanned:    $($stats.TotalFiles)" "White"
Write-ColorOutput "Files modified:         $($stats.ModifiedFiles)" "Green"
Write-ColorOutput "Files skipped:          $($stats.SkippedFiles)" "Gray"
Write-ColorOutput "Total replacements:     $($stats.TotalReplacements)" "Cyan"

if ($DryRun) {
    Write-ColorOutput "`nRun without -DryRun to apply changes" "Magenta"
}

Write-ColorOutput "`nDone!`n" "Green"
