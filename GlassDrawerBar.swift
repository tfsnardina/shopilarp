import UIKit

/// Barre du bas du menu (≡) en vrai Liquid Glass Apple (UIGlassEffect, iOS 26+).
/// Même principe que GlassTabBar : natif au-dessus de la WebView, la page web reste le relais (boutons invisibles).
#if compiler(>=6.2)
@available(iOS 26.0, *)
final class GlassDrawerBarView: UIView {
    static let barHeight: CGFloat = 56
    private static let gap: CGFloat = 10
    private static let quickWidth: CGFloat = 176
    static var totalWidth: CGFloat { barHeight * 2 + gap * 2 + quickWidth }

    var onAction: ((String) -> Void)?

    private let settingsGlass = GlassDrawerBarView.makeGlass(tint: nil)
    private let quickGlass = GlassDrawerBarView.makeGlass(
        tint: UIColor(red: 0.16, green: 0.32, blue: 0.91, alpha: 0.9)
    )
    private let closeGlass = GlassDrawerBarView.makeGlass(tint: nil)
    private let settingsButton = UIButton(type: .system)
    private let quickButton = UIButton(type: .system)
    private let closeButton = UIButton(type: .system)
    private(set) var isShown = false

    private static func makeGlass(tint: UIColor?) -> UIVisualEffectView {
        let effect = UIGlassEffect()
        effect.isInteractive = true
        if let tint { effect.tintColor = tint }
        let view = UIVisualEffectView(effect: effect)
        view.cornerConfiguration = .capsule()
        return view
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        // Le menu est sombre : le verre et les icônes passent en mode sombre.
        overrideUserInterfaceStyle = .dark
        backgroundColor = .clear
        alpha = 0
        transform = CGAffineTransform(translationX: 0, y: 140)
        isUserInteractionEnabled = false

        addSubview(settingsGlass)
        addSubview(quickGlass)
        addSubview(closeGlass)

        configureIcon(settingsButton, symbol: "gearshape.fill", label: "Settings", action: "settings")
        configureIcon(closeButton, symbol: "xmark", label: "Close", action: "close")
        settingsGlass.contentView.addSubview(settingsButton)
        closeGlass.contentView.addSubview(closeButton)

        var config = UIButton.Configuration.plain()
        config.image = UIImage(
            systemName: "hand.tap.fill",
            withConfiguration: UIImage.SymbolConfiguration(pointSize: 19, weight: .semibold)
        )
        config.imagePadding = 8
        config.baseForegroundColor = .white
        var title = AttributedString("Quick sale")
        title.font = UIFont.systemFont(ofSize: 18, weight: .semibold)
        config.attributedTitle = title
        quickButton.configuration = config
        quickButton.accessibilityLabel = "Quick sale"
        quickButton.addAction(UIAction { [weak self] _ in self?.onAction?("quicksale") }, for: .touchUpInside)
        quickGlass.contentView.addSubview(quickButton)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func configureIcon(_ button: UIButton, symbol: String, label: String, action: String) {
        button.setImage(
            UIImage(
                systemName: symbol,
                withConfiguration: UIImage.SymbolConfiguration(pointSize: 20, weight: .semibold)
            ),
            for: .normal
        )
        button.tintColor = .white
        button.accessibilityLabel = label
        button.addAction(UIAction { [weak self] _ in self?.onAction?(action) }, for: .touchUpInside)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        let h = Self.barHeight
        settingsGlass.frame = CGRect(x: 0, y: 0, width: h, height: h)
        quickGlass.frame = CGRect(x: h + Self.gap, y: 0, width: Self.quickWidth, height: h)
        closeGlass.frame = CGRect(x: h + Self.gap + Self.quickWidth + Self.gap, y: 0, width: h, height: h)
        settingsButton.frame = settingsGlass.bounds
        quickButton.frame = quickGlass.bounds
        closeButton.frame = closeGlass.bounds
    }

    /// Affiche / masque la barre (ouverture et fermeture du menu).
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
