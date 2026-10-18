$ErrorActionPreference = "Stop"
$tools = Split-Path $PSScriptRoot -Parent
$src = Join-Path $tools "shopify-larp-mobile-local"
$dst = Join-Path $PSScriptRoot "ShopifyWeb.bundle"

if (-not (Test-Path $src)) { throw "Run build-shopify-mobile-local.ps1 first" }

if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
New-Item -ItemType Directory -Path $dst | Out-Null
Copy-Item -Path (Join-Path $src "*") -Destination $dst -Recurse -Force
$bundlePlist = Join-Path $dst "Info.plist"
@'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleIdentifier</key>
	<string>com.checker.shopifyweb</string>
	<key>CFBundleName</key>
	<string>ShopifyWeb</string>
	<key>CFBundlePackageType</key>
	<string>BNDL</string>
	<key>CFBundleShortVersionString</key>
	<string>1.0</string>
	<key>CFBundleVersion</key>
	<string>1</string>
</dict>
</plist>
'@ | Set-Content -Path $bundlePlist -Encoding UTF8
Write-Host "Synced -> $dst"
