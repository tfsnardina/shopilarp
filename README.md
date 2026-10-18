# Shopify LARP — iOS (IPA)

Native shell with **WKWebView** that loads the bundled mobile mock (`www/preview.html`) and fires **real iOS notifications** (banner + system sound) when a live order arrives — instead of the in-page fake banner.

## Prepare bundle (Windows)

From repo root:

```powershell
.\tools\build-shopify-mobile-local.ps1
.\tools\ShopifyLarp\sync-www.ps1
```

This copies `tools/shopify-larp-mobile-local` into `tools/ShopifyLarp/www`.

## Build IPA (macOS + Xcode)

1. Open Xcode → **File → New → Project → iOS App**.
2. Product name: **ShopifyLarp**, Interface: **SwiftUI**, Language: **Swift**.
3. Replace generated Swift files with the ones in this folder (`ShopifyLarpApp.swift`, `ContentView.swift`, `WebViewContainer.swift`).
4. Merge `Info.plist` keys (display name, ATS, optional `LarpStartURL`).
5. Drag the **`www`** folder into the target (**Create folder references**, not groups).
6. Add **shopify-larp-base.json** from `www` to **Copy Bundle Resources** if not already included.
7. Set app icon to the green Shopify bag (Assets → AppIcon); use `www/apple-touch-icon.png` if present.
8. **Signing & Capabilities** → your team → build for device.
9. **Product → Archive → Distribute** → Ad Hoc / Development → `.ipa`.

### Optional remote URL

Set `LarpStartURL` in Info.plist to a local static server, e.g.:

`http://192.168.1.10:8766/preview.html`

Or rely on bundled `shopify-larp-base.json` in `www`.

## Notifications

On first launch the app requests notification permission. With **Live orders** enabled in Larp settings, new orders call `webkit.messageHandlers.shopifyOrder` → `UNUserNotificationCenter` with default sound.

## Windows WebView2 (Checker desktop)

The same JS bridge posts `{ type: "shopify_order", title, body }` to `chrome.webview` when the mobile mock runs inside the Polysers desktop host.
