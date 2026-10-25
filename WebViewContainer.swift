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
        window.__LARP_NATIVE_PRODUCT__=\(NativeGlass.isAvailable ? "true" : "false");
        document.documentElement.classList.add('checker-native');
        document.documentElement.classList.toggle('ios-bold', \(UIAccessibility.isBoldTextEnabled ? "true" : "false"));
        document.documentElement.classList.toggle('native-glass-tabbar', \(NativeGlass.isAvailable ? "true" : "false"));
        document.documentElement.classList.toggle('native-glass-drawer', \(NativeGlass.isAvailable ? "true" : "false"));
        document.documentElement.classList.toggle('native-glass-hdr', \(NativeGlass.isAvailable ? "true" : "false"));
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
        private var offsetObservation: NSKeyValueObservation?
        private var lockOffset = false

        deinit {
            keyboardObservers.forEach { NotificationCenter.default.removeObserver($0) }
        }

        func installKeyboardObservers(for webView: WKWebView) {
            keyboardObservers.forEach { NotificationCenter.default.removeObserver($0) }
            keyboardObservers.removeAll()
            let scroll = webView.scrollView
            // Quand la barre Sidekick est ouverte, la page ne doit JAMAIS défiler : sinon tout l'écran
            // (en-tête compris) remonte quand le clavier apparaît.
            offsetObservation = scroll.observe(\.contentOffset, options: [.new]) { [weak self] sv, _ in
                guard let self, self.lockOffset, sv.contentOffset != .zero else { return }
                sv.contentOffset = .zero
            }
            let show = NotificationCenter.default.addObserver(
                forName: UIResponder.keyboardWillShowNotification,
                object: nil,
                queue: .main
            ) { [weak self] note in
                guard let frame = note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else { return }
                let overlap = webView.convert(frame, from: nil).intersection(webView.bounds).height
                let js = "document.documentElement.setAttribute('data-native-kb','1');document.documentElement.style.setProperty('--kb','\(Int(overlap))px');(document.querySelector('.sk-ov')?1:0)"
                // On sait tout de suite si la barre Sidekick est ouverte : pas de décalage avant le clavier.
                webView.evaluateJavaScript(js) { result, _ in
                    let sidekick = (result as? Int) == 1
                    self?.lockOffset = sidekick
                    if sidekick {
                        scroll.contentInset.bottom = 0
                        scroll.verticalScrollIndicatorInsets.bottom = 0
                        scroll.contentOffset = .zero
                    } else {
                        scroll.contentInset.bottom = overlap
                        scroll.verticalScrollIndicatorInsets.bottom = overlap
                    }
                }
            }
            let hide = NotificationCenter.default.addObserver(
                forName: UIResponder.keyboardWillHideNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                self?.lockOffset = false
                scroll.contentInset.bottom = 0
                scroll.verticalScrollIndicatorInsets.bottom = 0
                webView.evaluateJavaScript("document.documentElement.style.setProperty('--kb','0px');", completionHandler: nil)
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
            if message.name == "larpTabbar", let dict = message.body as? [String: Any] {
                let active = (dict["active"] as? String) ?? "home"
                let hidden = (dict["hidden"] as? NSNumber)?.boolValue ?? false
                DispatchQueue.main.async { [weak self] in
                    self?.host?.updateGlassTabBar(active: active, hidden: hidden)
                }
                return
            }
            if message.name == "larpGlass", let dict = message.body as? [String: Any] {
                if let dy = (dict["dy"] as? NSNumber)?.doubleValue {
                    DispatchQueue.main.async { [weak self] in self?.host?.dragGlassSheet(CGFloat(dy)) }
                    return
                }
                let items = (dict["items"] as? [[String: Any]]) ?? []
                DispatchQueue.main.async { [weak self] in
                    self?.host?.updateGlassChrome(items: items)
                }
                return
            }
            if message.name == "larpDrawer", let dict = message.body as? [String: Any] {
                let open = (dict["open"] as? NSNumber)?.boolValue ?? false
                DispatchQueue.main.async { [weak self] in
                    self?.host?.updateGlassDrawerBar(open: open)
                }
                return
            }
            if message.name == "larpProduct" {
                let dict = (message.body as? [String: Any]) ?? [:]
                DispatchQueue.main.async { [weak self] in
                    if (dict["mode"] as? String) == "edit" {
                        self?.host?.presentProductDetail(info: dict)
                    } else {
                        self?.host?.presentProductCreator(
                            currency: (dict["sym"] as? String) ?? "€",
                            vendor: (dict["vendor"] as? String) ?? ""
                        )
                    }
                }
                return
            }
            if message.name == "larpPtr", let dict = message.body as? [String: Any] {
                DispatchQueue.main.async { [weak self] in
                    self?.host?.handlePull(dict)
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
            // editor.html (Préférences) est un autre document : il n'envoie jamais de message "larpTabbar",
            // la barre native resterait donc affichée par-dessus son bouton « Done ». On la cache ici.
            if navigationAction.targetFrame?.isMainFrame ?? true,
               let url = navigationAction.request.url,
               url.lastPathComponent == "editor.html" {
                DispatchQueue.main.async { [weak self] in
                    self?.host?.updateGlassTabBar(active: "home", hidden: true)
                }
            }
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
    private var glassTabBar: UIView?
    private var productDetail: UIViewController?
    private var glassTabBarBottom: NSLayoutConstraint?
    private var glassDrawerBar: UIView?
    private var glassChrome: UIView?
    private var pullHost: PullRefreshHost?
    private var glassDrawerBarBottom: NSLayoutConstraint?

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
        installGlassChrome()
        installGlassTabBar()
        installGlassDrawerBar()
        installPullHost()

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
        removeProductDetail()
        updateGlassChrome(items: [])
        let old = webView?.configuration.userContentController
        old?.removeScriptMessageHandler(forName: "shopifyOrder")
        old?.removeScriptMessageHandler(forName: "larpStore")
        old?.removeScriptMessageHandler(forName: "shopifySchedule")
        old?.removeScriptMessageHandler(forName: "larpStatusBar")
        old?.removeScriptMessageHandler(forName: "larpHaptic")
        old?.removeScriptMessageHandler(forName: "larpTabbar")
        old?.removeScriptMessageHandler(forName: "larpDrawer")
        old?.removeScriptMessageHandler(forName: "larpGlass")
        old?.removeScriptMessageHandler(forName: "larpPtr")
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
        config.userContentController.add(coordinator, name: "larpTabbar")
        config.userContentController.add(coordinator, name: "larpDrawer")
        config.userContentController.add(coordinator, name: "larpGlass")
        config.userContentController.add(coordinator, name: "larpProduct")
        config.userContentController.add(coordinator, name: "larpPtr")
        config.userContentController.addUserScript(
            WKUserScript(
                source: WebViewContainer.nativeChromeScript(),
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )
        let web = LarpWebView(frame: .zero, configuration: config)
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
        if let chrome = glassChrome { view.bringSubviewToFront(chrome) }
        if let glass = glassTabBar { view.bringSubviewToFront(glass) }
        if let host = pullHost { view.bringSubviewToFront(host) }
        if let drawerGlass = glassDrawerBar { view.bringSubviewToFront(drawerGlass) }
    }

    // MARK: - Création de produit native (Liquid Glass, iOS 26)

    /// Ouvre l'écran natif « Ajouter un produit » ; à l'enregistrement, la page web crée le produit.
    func presentProductCreator(currency: String, vendor: String) {
        #if compiler(>=6.2)
        guard #available(iOS 26.0, *), presentedViewController == nil else { return }
        let creator = ProductCreatorViewController(currencySymbol: currency, vendor: vendor)
        creator.onSave = { [weak self] payload in
            guard let data = try? JSONSerialization.data(withJSONObject: payload),
                  let json = String(data: data, encoding: .utf8) else { return }
            let literal = WebViewContainer.jsStringLiteral(json)
            self?.runJS("window.__larpNativeProductSave && window.__larpNativeProductSave(JSON.parse(\(literal)))")
        }
        present(creator, animated: true)
        #endif
    }

    // MARK: - Fiche produit native (clic sur un produit)

    /// Ouvre la fiche produit native au-dessus de la page web, sous la barre d'onglets (comme dans l'app Shopify).
    func presentProductDetail(info: [String: Any]) {
        #if compiler(>=6.2)
        guard #available(iOS 26.0, *), productDetail == nil, presentedViewController == nil else { return }
        let detail = ProductDetailViewController(info: info)
        detail.onSave = { [weak self] payload in self?.sendProductEvent("__larpNativeProductUpdate", payload) }
        detail.onDuplicate = { [weak self] payload in self?.sendProductEvent("__larpNativeProductDuplicate", payload) }
        detail.onDelete = { [weak self] index in self?.sendProductEvent("__larpNativeProductDelete", ["idx": index]) }
        detail.onClose = { [weak self] in self?.removeProductDetail() }
        addChild(detail)
        detail.view.frame = view.bounds
        detail.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        if let anchor = glassChrome ?? webView {
            view.insertSubview(detail.view, aboveSubview: anchor)
        } else {
            view.addSubview(detail.view)
        }
        detail.didMove(toParent: self)
        productDetail = detail
        detail.slideIn()
        #endif
    }

    /// Retire la fiche produit (sans animation) : changement d'onglet, rechargement…
    func removeProductDetail() {
        guard let detail = productDetail else { return }
        detail.willMove(toParent: nil)
        detail.view.removeFromSuperview()
        detail.removeFromParent()
        productDetail = nil
    }

    private func sendProductEvent(_ function: String, _ payload: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else { return }
        let literal = WebViewContainer.jsStringLiteral(json)
        runJS("window.\(function) && window.\(function)(JSON.parse(\(literal)))")
    }

    // MARK: - Boutons / recherche / filtres Liquid Glass natifs (iOS 26)

    private func installGlassChrome() {
        #if compiler(>=6.2)
        guard #available(iOS 26.0, *), glassChrome == nil else { return }
        let chrome = GlassChromeView(frame: view.bounds)
        chrome.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        chrome.onTap = { [weak self] id, index in
            self?.runJS("window.__larpGlassTap && window.__larpGlassTap(\(WebViewContainer.jsStringLiteral(id)), \(index))")
        }
        chrome.onText = { [weak self] id, text in
            self?.runJS("window.__larpGlassText && window.__larpGlassText(\(WebViewContainer.jsStringLiteral(id)), \(WebViewContainer.jsStringLiteral(text)))")
        }
        view.addSubview(chrome)
        glassChrome = chrome
        #endif
    }

    /// Glissement de la feuille commande : les boutons suivent le doigt sans attendre le prochain rendu.
    func dragGlassSheet(_ dy: CGFloat) {
        #if compiler(>=6.2)
        guard #available(iOS 26.0, *), let chrome = glassChrome as? GlassChromeView else { return }
        chrome.dragSheet(dy)
        #endif
    }

    /// Appelé par la page web : éléments de verre à afficher (positions en points, repère de la WebView).
    func updateGlassChrome(items: [[String: Any]]) {
        #if compiler(>=6.2)
        guard #available(iOS 26.0, *), let chrome = glassChrome as? GlassChromeView else { return }
        chrome.apply(items)
        #endif
    }

    // MARK: - Barre d'onglets Liquid Glass native (iOS 26)

    private func runJS(_ source: String) {
        webView?.evaluateJavaScript(source, completionHandler: nil)
    }

    private func installGlassTabBar() {
        #if compiler(>=6.2)
        guard #available(iOS 26.0, *), glassTabBar == nil else { return }
        let bar = GlassTabBarView()
        bar.translatesAutoresizingMaskIntoConstraints = false
        bar.onTab = { [weak self] name in
            self?.removeProductDetail()
            self?.runJS("window.__larpNativeTab && window.__larpNativeTab(\(WebViewContainer.jsStringLiteral(name)))")
        }
        bar.onAction = { [weak self] name in
            self?.removeProductDetail()
            self?.runJS("window.__larpNativeAct && window.__larpNativeAct(\(WebViewContainer.jsStringLiteral(name)))")
        }
        view.addSubview(bar)
        let bottom = bar.bottomAnchor.constraint(
            equalTo: view.bottomAnchor,
            constant: -(deviceSafeAreaInsets().bottom + 8)
        )
        NSLayoutConstraint.activate([
            bar.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            bar.widthAnchor.constraint(equalToConstant: GlassTabBarView.totalWidth),
            bar.heightAnchor.constraint(equalToConstant: GlassTabBarView.barHeight),
            bottom,
        ])
        glassTabBar = bar
        glassTabBarBottom = bottom
        #endif
    }

    /// Appelé par la page web : onglet actif + barre visible ou non.
    func updateGlassTabBar(active: String, hidden: Bool) {
        #if compiler(>=6.2)
        guard #available(iOS 26.0, *), let bar = glassTabBar as? GlassTabBarView else { return }
        bar.setActive(active, animated: bar.isShown)
        bar.setShown(!hidden, animated: true)
        #endif
    }

    // MARK: - Spinner Apple du « tirer pour rafraîchir »

    private func installPullHost() {
        guard pullHost == nil else { return }
        let host = PullRefreshHost(frame: .zero)
        view.addSubview(host)
        pullHost = host
    }

    /// Messages de la page web : start (position sous l'en-tête), pull (distance), load, end.
    func handlePull(_ d: [String: Any]) {
        guard let host = pullHost else { return }
        let y = CGFloat((d["y"] as? NSNumber)?.doubleValue ?? 0)
        let top = CGFloat((d["top"] as? NSNumber)?.doubleValue ?? 0)
        switch (d["s"] as? String) ?? "" {
        case "start": host.place(top: top, width: view.bounds.width)
        case "pull": host.pull(y)
        case "load": host.beginLoading()
        case "end": host.endLoading()
        default: break
        }
    }

    // MARK: - Barre du menu (≡) Liquid Glass native (iOS 26)

    private func installGlassDrawerBar() {
        #if compiler(>=6.2)
        guard #available(iOS 26.0, *), glassDrawerBar == nil else { return }
        let bar = GlassDrawerBarView()
        bar.translatesAutoresizingMaskIntoConstraints = false
        bar.onAction = { [weak self] name in
            self?.runJS("window.__larpNativeDrawer && window.__larpNativeDrawer(\(WebViewContainer.jsStringLiteral(name)))")
        }
        view.addSubview(bar)
        let bottom = bar.bottomAnchor.constraint(
            equalTo: view.bottomAnchor,
            constant: -max(20, deviceSafeAreaInsets().bottom + 2)
        )
        NSLayoutConstraint.activate([
            bar.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            bar.widthAnchor.constraint(equalToConstant: GlassDrawerBarView.totalWidth),
            bar.heightAnchor.constraint(equalToConstant: GlassDrawerBarView.barHeight),
            bottom,
        ])
        glassDrawerBar = bar
        glassDrawerBarBottom = bottom
        #endif
    }

    /// Appelé par la page web : menu ouvert ou fermé.
    func updateGlassDrawerBar(open: Bool) {
        #if compiler(>=6.2)
        guard #available(iOS 26.0, *), let bar = glassDrawerBar as? GlassDrawerBarView else { return }
        bar.setShown(open, animated: true)
        #endif
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
            glassTabBarBottom?.constant = -(insets.bottom + 8)
            glassDrawerBarBottom?.constant = -max(20, insets.bottom + 2)
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


/// WKWebView sans la barre d'accessoires du clavier (˄ ˅ ✓), comme dans l'app Shopify.
final class LarpWebView: WKWebView {
    override var inputAccessoryView: UIView? { nil }
}
