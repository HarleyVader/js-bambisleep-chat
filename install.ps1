# BambiSleep Chat - Windows PowerShell Install Script
# Version: v0.3.0
# Compatible: Windows 10+, Windows Server 2019+

param(
    [string]$InstallPath = "$env:USERPROFILE\bambisleep-chat",
    [switch]$SkipNodeJs,
    [switch]$DevMode
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Color functions for better output
function Write-Success($Message) {
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Warning($Message) {
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Error($Message) {
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Info($Message) {
    Write-Host "ℹ️  $Message" -ForegroundColor Blue
}

function Write-Header($Message) {
    Write-Host "`n$Message" -ForegroundColor Cyan
    Write-Host ("=" * $Message.Length) -ForegroundColor Cyan
}

Write-Header "🚀 BambiSleep Chat v0.3.0 - Windows Installation"

# Check PowerShell version
if ($PSVersionTable.PSVersion.Major -lt 5) {
    Write-Error "PowerShell 5.0 or higher is required"
    exit 1
}

Write-Success "PowerShell $($PSVersionTable.PSVersion) detected"

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if ($isAdmin) {
    Write-Warning "Running as Administrator - this is not required for user installation"
}

# Check for Node.js
$nodeVersion = $null
try {
    $nodeVersion = node --version 2>$null
    $nodeMajor = [int]($nodeVersion -replace "v(\d+)\..*", '$1')
    
    if ($nodeMajor -ge 20) {
        Write-Success "Node.js $nodeVersion detected (compatible)"
    } else {
        Write-Warning "Node.js $nodeVersion detected (requires v20+)"
        $SkipNodeJs = $false
    }
} catch {
    Write-Warning "Node.js not found or not in PATH"
    $SkipNodeJs = $false
}

# Install Node.js if needed
if (-not $SkipNodeJs -and ($null -eq $nodeVersion -or $nodeMajor -lt 20)) {
    Write-Info "Node.js 20 LTS installation required"
    Write-Info "Please install Node.js 20 LTS from: https://nodejs.org/"
    Write-Info "After installation, restart PowerShell and run this script again with -SkipNodeJs"
    
    $openBrowser = Read-Host "Open Node.js download page in browser? (y/N)"
    if ($openBrowser -eq 'y' -or $openBrowser -eq 'Y') {
        Start-Process "https://nodejs.org/en/download/"
    }
    exit 0
}

# Check for Git
try {
    $gitVersion = git --version 2>$null
    Write-Success "Git detected: $gitVersion"
} catch {
    Write-Error "Git is required but not found. Please install Git from: https://git-scm.com/"
    
    $openBrowser = Read-Host "Open Git download page in browser? (y/N)"
    if ($openBrowser -eq 'y' -or $openBrowser -eq 'Y') {
        Start-Process "https://git-scm.com/download/win"
    }
    exit 1
}

# Remove existing installation
if (Test-Path $InstallPath) {
    Write-Warning "Directory $InstallPath already exists"
    $overwrite = Read-Host "Remove existing installation? (y/N)"
    if ($overwrite -eq 'y' -or $overwrite -eq 'Y') {
        Remove-Item -Recurse -Force $InstallPath
        Write-Success "Existing installation removed"
    } else {
        Write-Error "Installation cancelled"
        exit 1
    }
}

# Clone repository
Write-Info "Cloning BambiSleep Chat repository..."
try {
    git clone https://github.com/HarleyVader/js-bambisleep-chat.git $InstallPath
    Set-Location $InstallPath
    Write-Success "Repository cloned to $InstallPath"
} catch {
    Write-Error "Failed to clone repository: $($_.Exception.Message)"
    exit 1
}

# Install dependencies
Write-Info "Installing NPM dependencies..."
try {
    if ($DevMode) {
        npm install
    } else {
        npm install --production
    }
    Write-Success "Dependencies installed successfully"
} catch {
    Write-Error "Failed to install dependencies: $($_.Exception.Message)"
    exit 1
}

# Setup environment configuration
if (-not (Test-Path "config\env.js")) {
    Write-Info "Setting up environment configuration..."
    Copy-Item "config\env.js.example" "config\env.js"
    Write-Success "Environment configuration created"
}

# Run tests
Write-Info "Running test suite..."
try {
    $testResult = npm test 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Test suite completed successfully"
    } else {
        Write-Warning "Some tests failed, but installation can continue"
        Write-Info "Test output: $testResult"
    }
} catch {
    Write-Warning "Test suite encountered issues: $($_.Exception.Message)"
}

# Build production assets
Write-Info "Building production assets..."
try {
    npm run build
    Write-Success "Production build completed"
} catch {
    Write-Warning "Production build failed: $($_.Exception.Message)"
}

# Windows Service Setup (optional)
$setupService = Read-Host "Setup Windows Service? (requires Administrator privileges) (y/N)"
if ($setupService -eq 'y' -or $setupService -eq 'Y') {
    if (-not $isAdmin) {
        Write-Warning "Administrator privileges required for Windows Service setup"
        Write-Info "Restart PowerShell as Administrator and run: "
        Write-Info "  Set-Location '$InstallPath'"
        Write-Info "  node scripts\deploy.js"
    } else {
        Write-Info "Setting up Windows Service..."
        try {
            node scripts\deploy.js
            Write-Success "Windows Service configured"
            
            # Validate deployment
            Write-Info "Validating deployment..."
            Start-Sleep -Seconds 5
            
            node scripts\validate-service.js
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Deployment validation successful"
            } else {
                Write-Warning "Deployment validation had issues, check logs"
            }
        } catch {
            Write-Warning "Service setup failed: $($_.Exception.Message)"
            Write-Info "You can start manually with: npm start"
        }
    }
} else {
    Write-Info "Skipping Windows Service setup"
    Write-Info "Start manually with: npm start"
}

# Final instructions
Write-Header "🎉 BambiSleep Chat Installation Complete!"

Write-Host ""
Write-Info "📍 Installation Directory: $InstallPath"
Write-Info "🌐 Application URL: http://localhost:6969"
Write-Host ""

Write-Host "🔧 Manual Controls:" -ForegroundColor Cyan
Write-Host "  Start Application:    npm start"
Write-Host "  Development Mode:     npm run dev"
Write-Host "  Run Tests:            npm test"
Write-Host "  Build Production:     npm run build"
Write-Host ""

Write-Host "📚 Documentation:" -ForegroundColor Cyan
Write-Host "  Main Guide:  $InstallPath\README.md"
Write-Host "  Deployment:  $InstallPath\DEPLOYMENT.md"
Write-Host "  Docs:        $InstallPath\public\docs\"
Write-Host ""

Write-Host "🏥 Health Check:" -ForegroundColor Cyan
Write-Host "  Invoke-RestMethod http://localhost:6969/api/health"
Write-Host ""

Write-Host "🎯 Status: Production Ready v0.3.0" -ForegroundColor Green
Write-Host "Ready to use! 🚀" -ForegroundColor Green

# Offer to start immediately
$startNow = Read-Host "`nStart BambiSleep Chat now? (y/N)"
if ($startNow -eq 'y' -or $startNow -eq 'Y') {
    Write-Info "Starting BambiSleep Chat..."
    Write-Info "Press Ctrl+C to stop"
    Write-Info "Access at: http://localhost:6969"
    Start-Sleep -Seconds 2
    npm start
}