import UIKit

/// Vrai Liquid Glass Apple (UIGlassEffect, iOS 26+).
/// - Xcode 26 + iOS 26 : la barre du bas est native, au-dessus de la WebView (le verre échantillonne la page en direct).
/// - Sinon (iOS < 26 ou SDK plus ancien) : on garde la barre web (CSS) comme avant.
enum NativeGlass {
    static var isAvailable: Bool {
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) { return true }
        #endif
        return false
    }
}

#if compiler(>=6.2)
@available(iOS 26.0, *)
final class GlassTabBarView: UIView {
    static let barHeight: CGFloat = 56
    private static let gap: CGFloat = 9
    private static let itemWidth: CGFloat = 52.5
    private static let pad: CGFloat = 4
    static var totalWidth: CGFloat {
        barHeight * 2 + gap * 2 + itemWidth * 4 + pad * 2
    }

    private static let idleTint = UIColor(white: 0.40, alpha: 1)
    private static let activeTint = UIColor(white: 0.07, alpha: 1)

    /// (nom côté web, icône inactive, icône active)
    private let tabs: [(name: String, off: String, on: String)] = [
        ("home", "tab-home-off", "tab-home-on"),
        ("orders", "tab-orders-off", "tab-orders-on"),
        ("products", "tab-products-off", "tab-products-on"),
        ("menu", "tab-menu", "tab-menu"),
    ]

    var onTab: ((String) -> Void)?
    var onAction: ((String) -> Void)?

    private let searchGlass = GlassTabBarView.makeGlass()
    private let pillGlass = GlassTabBarView.makeGlass()
    private let sidekickGlass = GlassTabBarView.makeGlass()
    private let indicator = UIView()
    private let searchButton = UIButton(type: .system)
    private let sidekickButton = UIButton(type: .system)
    private var tabButtons: [UIButton] = []
    private var active = "home"
    private(set) var isShown = false

    private static func makeGlass() -> UIVisualEffectView {
        let effect = UIGlassEffect()
        effect.isInteractive = true
        let view = UIVisualEffectView(effect: effect)
        view.cornerConfiguration = .capsule()
        return view
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        // L'interface de l'app est claire : le verre reste en mode clair même si l'iPhone est en mode sombre.
        overrideUserInterfaceStyle = .light
        backgroundColor = .clear
        alpha = 0
        transform = CGAffineTransform(translationX: 0, y: 140)
        isUserInteractionEnabled = false

        addSubview(searchGlass)
        addSubview(pillGlass)
        addSubview(sidekickGlass)

        configureActionButton(searchButton, image: "act-search", action: "search")
        configureActionButton(sidekickButton, image: "act-sidekick", action: "sidekick")
        searchGlass.contentView.addSubview(searchButton)
        sidekickGlass.contentView.addSubview(sidekickButton)

        indicator.backgroundColor = UIColor(white: 0, alpha: 0.07)
        indicator.layer.cornerCurve = .continuous
        pillGlass.contentView.addSubview(indicator)

        for tab in tabs {
            let button = UIButton(type: .system)
            button.accessibilityLabel = tab.name
            button.addAction(UIAction { [weak self] _ in self?.onTab?(tab.name) }, for: .touchUpInside)
            pillGlass.contentView.addSubview(button)
            tabButtons.append(button)
        }
        applyActive(animated: false)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func configureActionButton(_ button: UIButton, image: String, action: String) {
        button.setImage(GlassIcons.image(image), for: .normal)
        button.tintColor = Self.idleTint
        button.accessibilityLabel = action
        button.addAction(UIAction { [weak self] _ in self?.onAction?(action) }, for: .touchUpInside)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        let h = Self.barHeight
        let pillWidth = Self.itemWidth * 4 + Self.pad * 2
        searchGlass.frame = CGRect(x: 0, y: 0, width: h, height: h)
        pillGlass.frame = CGRect(x: h + Self.gap, y: 0, width: pillWidth, height: h)
        sidekickGlass.frame = CGRect(x: h + Self.gap + pillWidth + Self.gap, y: 0, width: h, height: h)
        searchButton.frame = searchGlass.bounds
        sidekickButton.frame = sidekickGlass.bounds
        for (index, button) in tabButtons.enumerated() {
            button.frame = CGRect(
                x: Self.pad + CGFloat(index) * Self.itemWidth,
                y: Self.pad,
                width: Self.itemWidth,
                height: h - Self.pad * 2
            )
        }
        indicator.layer.cornerRadius = (h - Self.pad * 2) / 2
        indicator.frame = indicatorFrame(for: active)
    }

    private func indicatorFrame(for name: String) -> CGRect {
        let index = tabs.firstIndex(where: { $0.name == name }) ?? 0
        return CGRect(
            x: Self.pad + CGFloat(index) * Self.itemWidth,
            y: Self.pad,
            width: Self.itemWidth,
            height: Self.barHeight - Self.pad * 2
        )
    }

    /// Onglet actif (envoyé par la page web).
    func setActive(_ name: String, animated: Bool) {
        guard tabs.contains(where: { $0.name == name }), name != active else { return }
        active = name
        applyActive(animated: animated)
    }

    private func applyActive(animated: Bool) {
        for (index, tab) in tabs.enumerated() {
            let isOn = tab.name == active
            let button = tabButtons[index]
            button.setImage(GlassIcons.image(isOn ? tab.on : tab.off), for: .normal)
            button.tintColor = isOn ? Self.activeTint : Self.idleTint
        }
        let target = indicatorFrame(for: active)
        if animated {
            UIView.animate(
                withDuration: 0.5, delay: 0, usingSpringWithDamping: 0.78, initialSpringVelocity: 0.4,
                options: [.beginFromCurrentState, .allowUserInteraction]
            ) { self.indicator.frame = target }
        } else {
            indicator.frame = target
        }
    }

    /// Affiche / masque la barre (écrans de connexion, pages plein écran, menu latéral…).
    func setShown(_ show: Bool, animated: Bool) {
        guard show != isShown else { return }
        isShown = show
        isUserInteractionEnabled = show
        let change = {
            self.alpha = show ? 1 : 0
            self.transform = show ? .identity : CGAffineTransform(translationX: 0, y: 140)
        }
        if animated {
            UIView.animate(
                withDuration: 0.45, delay: 0, usingSpringWithDamping: 0.9, initialSpringVelocity: 0,
                options: [.beginFromCurrentState, .allowUserInteraction], animations: change
            )
        } else {
            change()
        }
    }
}
#endif
