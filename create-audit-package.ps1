# KayraDeniz Agent Systems - ChatGPT Audit Package Creator
# This script creates an optimized ZIP for ChatGPT analysis

Write-Host "🔍 Creating KayraDeniz Agent Systems Audit Package..." -ForegroundColor Cyan

$files = @(
    # Core Agent Logic (stripped version)
    "app-core-logic-only.js",
    
    # Agent Systems
    "src/renderer/event-bus.js",
    "src/renderer/approval-system.js",
    "src/renderer/policy-engine.js",
    "src/renderer/narrator-agent.js",
    "src/renderer/critic-agent.js",
    
    # Memory & Learning
    "src/renderer/session-context.js",
    "src/renderer/context-memory.js",
    "src/renderer/learning-store.js",
    "src/renderer/agent-trace-system.js",
    
    # Execution Systems
    "src/renderer/night-orders-executor.js",
    "src/renderer/multi-edit-system.js",
    "src/renderer/view-diff-system.js",
    "src/renderer/view-repo-map-system.js",
    
    # Validation
    "src/renderer/probe-matrix.js",
    "src/renderer/artifact-gating-system.js",
    "src/renderer/multi-agent-coordinator.js",
    
    # Elysion Chamber
    "src/renderer/elysion-chamber-ui.js",
    
    # Luma Cognitive Engine
    "src/agents/luma-core.js",
    "src/agents/luma-bridge.js",
    "src/agents/luma-suprime-agent.js",
    "src/agents/router-agent.js",
    
    # Documentation
    "AGENT_SYSTEMS_COMPLETE_GUIDE.md",
    "MASTER_ARCHITECTURE_GUIDE.md",
    "USTA_MODU_PLAN.md",
    "PR3_LEARNING_SYSTEM_PLAN.md",
    "REFLEXION_MODULE_PLAN.md",
    "ELYSION_CHAMBER_GUIDE.md",
    ".github/copilot-instructions.md"
)

# Check which files exist
$existingFiles = @()
$missingFiles = @()

foreach ($file in $files) {
    if (Test-Path $file) {
        $existingFiles += $file
        Write-Host "  ✓ $file" -ForegroundColor Green
    } else {
        $missingFiles += $file
        Write-Host "  ✗ $file (missing)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "📊 Summary:" -ForegroundColor Cyan
Write-Host "  Found: $($existingFiles.Count) files" -ForegroundColor Green
Write-Host "  Missing: $($missingFiles.Count) files" -ForegroundColor Yellow

if ($existingFiles.Count -eq 0) {
    Write-Host "❌ No files found! Check your working directory." -ForegroundColor Red
    exit 1
}

# Create ZIP
$zipPath = "KayraDeniz-Agent-Systems-Audit.zip"
Write-Host ""
Write-Host "📦 Creating ZIP package..." -ForegroundColor Cyan

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
    Write-Host "  Removed old package" -ForegroundColor Yellow
}

Compress-Archive -Path $existingFiles -DestinationPath $zipPath -CompressionLevel Optimal

$zipSize = (Get-Item $zipPath).Length / 1MB
Write-Host ""
Write-Host "✅ Package created successfully!" -ForegroundColor Green
Write-Host "  Location: $zipPath" -ForegroundColor Cyan
Write-Host "  Size: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Cyan
Write-Host ""
Write-Host "📤 Ready to upload to ChatGPT!" -ForegroundColor Green
Write-Host ""
Write-Host "Recommended ChatGPT Model: GPT-4 Turbo or o1-preview" -ForegroundColor Yellow
