import UIKit
import WebKit

enum WebViewContainer {
    struct WebEntry {
        let index: URL
        let root: URL
    }

    static func appBuildLabel() -> String {
        let v = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "?"
        let b = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "?"
        return "v\(v) (\(b))"
    }

    static func resolveWebEntry() -> WebEntry? {
        let fm = FileManager.default
        var roots: [URL] = []
        if let u = Bundle.main.resourceURL { roots.append(u) }
        roots.append(Bundle.main.bundleURL)

        for root in roots {
            let candidates: [(URL, URL)] = [
                (
                    root.appendingPathComponent("ShopifyWeb.bundle/index.html"),
                    root.appendingPathComponent("ShopifyWeb.bundle")
                ),
                (
                    root.appendingPathComponent("www/index.html"),
                    root.appendingPathComponent("www")
                ),
                (
                    root.appendingPathComponent("index.html"),
                    root
                ),
            ]
            for (index, accessRoot) in candidates where fm.fileExists(atPath: index.path) {
                return WebEntry(index: index, root: accessRoot)
            }
        }

        if let bundleURL = Bundle.main.url(forResource: "ShopifyWeb", withExtension: "bundle"),
           let webBundle = Bundle(url: bundleURL),
           let index = webBundle.url(forResource: "index", withExtension: "html") {
            return WebEntry(index: index, root: bundleURL)
        }
        return nil
    }

    static func bundleDebugHint() -> String {
        let fm = FileManager.default
        guard let resourceURL = Bundle.main.resourceURL else {
            return "\(appBuildLabel()) resourceURL nil"
        }
        let top = (try? fm.contentsOfDirectory(atPath: resourceURL.path))?.sorted() ?? []
        let hasWeb = fm.fileExists(atPath: resourceURL.appendingPathComponent("ShopifyWeb.bundle/index.html").path)
        return "\(appBuildLabel()) ShopifyWeb.bundle=\(hasWeb ? "yes" : "no"); files: \(top.prefix(14).joined(separator: ", "))"
    }

    static let settingsDefaultsKey = "checker.shopifyLarp.settings"
    static let payloadDefaultsKey = "checker.shopifyLarp.payload"

    static func jsStringLiteral(_ value: String) -> String {
        (try? String(data: JSONEncoder().encode(value), encoding: .utf8)) ?? "\"\""
    }

    /// Seeds saved LARP data only when the page has none, so a fresh Done tap is not overwritten.
    static func nativeChromeScript() -> String {
        let settings = UserDefaults.standard.string(forKey: settingsDefaultsKey) ?? ""
        let payload = UserDefaults.standard.string(forKey: payloadDefaultsKey) ?? ""
        return """
        window.__CHECKER_NATIVE__=true;
        document.documentElement.classList.add('checker-native');
        document.documentElement.classList.toggle('ios-bold', \(UIAccessibility.isBoldTextEnabled ? "true" : "false"));
        (function(){
          var settings = \(jsStringLiteral(settings));
          var payload = \(jsStringLiteral(payload));
          window.__LARP_SAVED_SETTINGS__ = settings;
          window.__LARP_SAVED_PAYLOAD__ = payload;
          function fill(store, key, value) {
            if (!value) return;
            try { if (!store.getItem(key)) store.setItem(key, value); } catch (e) {}
          }
          try { fill(localStorage, 'checker.settings.shopifyLarp', settings); } catch (e) {}
          try { fill(localStorage, 'checker.shopifyLarp.payload', payload); } catch (e) {}
          try { fill(sessionStorage, 'checker.shopifyLarp.payload', payload); } catch (e) {}
          try { var b = document.getElementById('banner'); if (b) b.style.display = 'none'; } catch (e) {}
        })();
        """
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        var wwwRoot: URL?
        weak var host: WebHostViewController?
        private var keyboardObservers: [NSObjectProtocol] = []

        deinit {
            keyboardObservers.forEach { NotificationCenter.default.removeObserver($0) }
        }

        func installKeyboardObservers(for webView: WKWebView) {
            keyboardObservers.forEach { NotificationCenter.default.removeObserver($0) }
            keyboardObservers.removeAll()
            let scroll = webView.scrollView
            let show = NotificationCenter.default.addObserver(
                forName: UIResponder.keyboardWillShowNotification,
                object: nil,
                queue: .main
            ) { [weak self] note in
                guard let frame = note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else { return }
                let overlap = webView.convert(frame, from: nil).intersection(webView.bounds).height
                scroll.contentInset.bottom = overlap
                scroll.verticalScrollIndicatorInsets.bottom = overlap
            }
            let hide = NotificationCenter.default.addObserver(
                forName: UIResponder.keyboardWillHideNotification,
                object: nil,
                queue: .main
            ) { _ in
                scroll.contentInset.bottom = 0
                scroll.verticalScrollIndicatorInsets.bottom = 0
            }
            keyboardObservers = [show, hide]
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            if message.name == "larpStore", let dict = message.body as? [String: Any] {
                if let settings = dict["settings"] as? String {
                    UserDefaults.standard.set(settings, forKey: WebViewContainer.settingsDefaultsKey)
                }
                if let payload = dict["payload"] as? String, !payload.isEmpty {
                    UserDefaults.standard.set(payload, forKey: WebViewContainer.payloadDefaultsKey)
                }
                let shouldOpen = (dict["open"] as? Bool) == true || (dict["open"] as? NSNumber)?.boolValue == true
                if shouldOpen {
                    DispatchQueue.main.async { [weak self] in
                        self?.host?.reloadShopHome()
                    }
                }
                return
            }
            if message.name == "larpHaptic" {
                let kind = (message.body as? String) ?? "light"
                DispatchQueue.main.async { Haptics.play(kind) }
                return
            }
            if message.name == "larpStatusBar" {
                let dark = (message.body as? String) == "dark"
                DispatchQueue.main.async { [weak self] in self?.host?.setStatusBar(dark: dark) }
                return
            }
            if message.name == "shopifySchedule", let dict = message.body as? [String: Any] {
                NotificationPermission.replaceScheduled(dict["items"] as? [[String: Any]] ?? [])
                return
            }
            guard message.name == "shopifyOrder",
                  let dict = message.body as? [String: Any] else { return }
            let title = (dict["title"] as? String) ?? "New order"
            let body = (dict["body"] as? String) ?? ""
            NotificationPermission.postOrder(title: title, body: body)
        }

        func pushSafeArea(to webView: WKWebView, insets: UIEdgeInsets) {
            // Keyboard inflates bottom inset into the hundreds and letterboxes the page. Keep the home indicator only.
            let top = max(0, insets.top)
            let bottom = insets.bottom > 80 ? 0 : max(0, insets.bottom)
            let js = """
            document.documentElement.style.setProperty('--top','\(top)px');
            document.documentElement.style.setProperty('--bot','\(bottom)px');
            """
            webView.evaluateJavaScript(js, completionHandler: nil)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            if let host {
                pushSafeArea(to: webView, insets: host.deviceSafeAreaInsets())
            }
            webView.evaluateJavaScript(
                """
                document.querySelectorAll('a[aria-label="Made with LarpLabs"]').forEach(function(a){a.remove();});
                """
            )
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            showLoadError(on: webView, message: error.localizedDescription)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            showLoadError(on: webView, message: error.localizedDescription)
        }

        func showLoadError(on webView: WKWebView, message: String) {
            let safe = message
                .replacingOccurrences(of: "&", with: "&amp;")
                .replacingOccurrences(of: "<", with: "&lt;")
            let html = """
            <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
            <style>body{margin:0;background:#000;color:#fff;font:16px -apple-system,sans-serif;padding:24px}</style></head>
            <body><h3>Shopify LARP</h3><p>Failed to load bundled UI.</p><pre>\(safe)</pre></body></html>
            """
            webView.loadHTMLString(html, baseURL: wwwRoot)
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            // The seed script embeds the saved settings as they are *now*. Rebuild it before every navigation,
            // otherwise the editor opens with the settings from when this web view was created (stale totals).
            let controller = webView.configuration.userContentController
            controller.removeAllUserScripts()
            controller.addUserScript(
                WKUserScript(
                    source: WebViewContainer.nativeChromeScript(),
                    injectionTime: .atDocumentStart,
                    forMainFrameOnly: true
                )
            )
            decisionHandler(.allow)
        }
    }
}

final class WebHostViewController: UIViewController {
    private let coordinator: WebViewContainer.Coordinator
    private var webView: WKWebView!
    private var lastLayoutInsets: UIEdgeInsets = .zero
    private var homeIndicatorBottom: CGFloat = 34

    init(coordinator: WebViewContainer.Coordinator) {
        self.coordinator = coordinator
        super.init(nibName: nil, bundle: nil)
        edgesForExtendedLayout = .all
        extendedLayoutIncludesOpaqueBars = true
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        view.insetsLayoutMarginsFromSafeArea = false
        coordinator.host = self
        installLifecycleObservers()
        installBoldTextObserver()
        if #available(iOS 15.0, *) {
            view.keyboardLayoutGuide.followsUndockedKeyboard = false
        }

        let web = makeWebView()
        showWebView(web)

        guard let entry = WebViewContainer.resolveWebEntry() else {
            coordinator.showLoadError(on: web, message: WebViewContainer.bundleDebugHint())
            return
        }
        coordinator.wwwRoot = entry.root
        web.loadFileURL(entry.index, allowingReadAccessTo: entry.root)
    }

    private var lifecycleObservers: [NSObjectProtocol] = []

    /// When the app leaves the screen the page plans the orders/notifications for the time it is closed;
    /// when it comes back, the orders that happened meanwhile are created and the plan is cancelled.
    private func installLifecycleObservers() {
        let center = NotificationCenter.default
        let background = center.addObserver(
            forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main
        ) { [weak self] _ in
            var task = UIBackgroundTaskIdentifier.invalid
            task = UIApplication.shared.beginBackgroundTask {
                UIApplication.shared.endBackgroundTask(task)
                task = .invalid
            }
            self?.webView?.evaluateJavaScript("window.__larpPlanBg && window.__larpPlanBg()") { _, _ in
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                    if task != .invalid {
                        UIApplication.shared.endBackgroundTask(task)
                        task = .invalid
                    }
                }
            }
        }
        let foreground = center.addObserver(
            forName: UIApplication.willEnterForegroundNotification, object: nil, queue: .main
        ) { [weak self] _ in
            self?.webView?.evaluateJavaScript("window.__larpConsumeBg && window.__larpConsumeBg()", completionHandler: nil)
        }
        lifecycleObservers = [background, foreground]
    }

    deinit {
        lifecycleObservers.forEach { NotificationCenter.default.removeObserver($0) }
    }

    /// Mirrors the iOS "Bold Text" accessibility setting into the page (html.ios-bold).
    private func installBoldTextObserver() {
        let obs = NotificationCenter.default.addObserver(
            forName: UIAccessibility.boldTextStatusDidChangeNotification, object: nil, queue: .main
        ) { [weak self] _ in
            let on = UIAccessibility.isBoldTextEnabled ? "true" : "false"
            self?.webView?.evaluateJavaScript(
                "document.documentElement.classList.toggle('ios-bold', \(on))", completionHandler: nil
            )
        }
        lifecycleObservers.append(obs)
    }

    func reloadShopHome() {
        guard let root = coordinator.wwwRoot else { return }
        let old = webView?.configuration.userContentController
        old?.removeScriptMessageHandler(forName: "shopifyOrder")
        old?.removeScriptMessageHandler(forName: "larpStore")
        old?.removeScriptMessageHandler(forName: "shopifySchedule")
        old?.removeScriptMessageHandler(forName: "larpStatusBar")
        old?.removeScriptMessageHandler(forName: "larpHaptic")
        let web = makeWebView()
        showWebView(web)
        lastLayoutInsets = .zero
        web.loadFileURL(root.appendingPathComponent("index.html"), allowingReadAccessTo: root)
    }

    private func makeWebView() -> WKWebView {
        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.userContentController.add(coordinator, name: "shopifyOrder")
        config.userContentController.add(coordinator, name: "larpStore")
        config.userContentController.add(coordinator, name: "shopifySchedule")
        config.userContentController.add(coordinator, name: "larpStatusBar")
        config.userContentController.add(coordinator, name: "larpHaptic")
        config.userContentController.addUserScript(
            WKUserScript(
                source: WebViewContainer.nativeChromeScript(),
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )
        let web = WKWebView(frame: .zero, configuration: config)
        web.isOpaque = true
        web.backgroundColor = .black
        web.scrollView.backgroundColor = .black
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.scrollView.contentInset = .zero
        web.scrollView.scrollIndicatorInsets = .zero
        web.scrollView.bounces = true
        web.scrollView.alwaysBounceVertical = true
        web.scrollView.alwaysBounceHorizontal = false
        web.scrollView.delaysContentTouches = false
        web.navigationDelegate = coordinator
        web.translatesAutoresizingMaskIntoConstraints = false
        return web
    }

    private func showWebView(_ web: WKWebView) {
        webView?.removeFromSuperview()
        webView = web
        coordinator.installKeyboardObservers(for: web)
        view.addSubview(web)
        NSLayoutConstraint.activate([
            web.topAnchor.constraint(equalTo: view.topAnchor),
            web.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            web.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
    }

    /// Insets of this view only. Do not invent 47/34 — that double-pads when the system already inset the window.
    func deviceSafeAreaInsets() -> UIEdgeInsets {
        let raw = view.safeAreaInsets
        if raw.bottom > 0, raw.bottom < 60 {
            homeIndicatorBottom = raw.bottom
        }
        let bottom = raw.bottom > 80 ? homeIndicatorBottom : raw.bottom
        return UIEdgeInsets(top: raw.top, left: 0, bottom: bottom, right: 0)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        refreshWebLayout()
    }

    private func refreshWebLayout() {
        guard webView != nil else { return }
        let insets = deviceSafeAreaInsets()
        if insets != lastLayoutInsets {
            lastLayoutInsets = insets
            coordinator.pushSafeArea(to: webView, insets: insets)
        }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        refreshWebLayout()
    }

    private var statusStyle: UIStatusBarStyle = .lightContent
    override var preferredStatusBarStyle: UIStatusBarStyle { statusStyle }

    /// Dark status bar while the white launch screen is shown, light (for the black header) afterwards.
    func setStatusBar(dark: Bool) {
        statusStyle = dark ? .darkContent : .lightContent
        setNeedsStatusBarAppearanceUpdate()
    }
}
/// Taptic Engine feedback requested by the page (see hap() in app.js).
enum Haptics {
    private static let selection = UISelectionFeedbackGenerator()
    private static let light = UIImpactFeedbackGenerator(style: .light)
    private static let medium = UIImpactFeedbackGenerator(style: .medium)
    private static let heavy = UIImpactFeedbackGenerator(style: .heavy)
    private static let notify = UINotificationFeedbackGenerator()

    static func play(_ kind: String) {
        switch kind {
        case "selection": selection.selectionChanged(); selection.prepare()
        case "light": light.impactOccurred(); light.prepare()
        case "medium": medium.impactOccurred(); medium.prepare()
        case "heavy": heavy.impactOccurred(); heavy.prepare()
        case "success": notify.notificationOccurred(.success); notify.prepare()
        case "warning": notify.notificationOccurred(.warning); notify.prepare()
        case "error": notify.notificationOccurred(.error); notify.prepare()
        default: break
        }
    }
}
