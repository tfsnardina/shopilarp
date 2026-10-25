import UIKit

/// Barre de sélection multiple de la liste Produits en vrai Liquid Glass Apple (UIGlassEffect, iOS 26+) :
/// compteur ⊗ N · Supprimer · ⋯. Natif au-dessus de la WebView, au-dessus de la barre d'onglets ;
/// la page web reste le relais (elle envoie l'état, reçoit les actions).
#if compiler(>=6.2)
@available(iOS 26.0, *)
final class GlassSelectionBarView: UIView {
    static let barHeight: CGFloat = 52
    private static let pad: CGFloat = 6
    private static let inner: CGFloat = 40

    var onAction: ((String) -> Void)?

    private let glass: UIVisualEffectView = {
        let effect = UIGlassEffect()
        effect.isInteractive = true
        effect.tintColor = UIColor(white: 0.05, alpha: 0.9)
        let view = UIVisualEffectView(effect: effect)
        view.cornerConfiguration = .capsule()
        return view
    }()
    private let countButton = UIButton(type: .system)
    private let deleteButton = UIButton(type: .system)
    private let moreButton = UIButton(type: .system)
    private(set) var isShown = false
    private var count = 0
    private var busy = false

    override init(frame: CGRect) {
        super.init(frame: frame)
        // Barre sombre : verre et symboles en mode sombre, quel que soit le réglage de l'iPhone.
        overrideUserInterfaceStyle = .dark
        backgroundColor = .clear
        alpha = 0
        transform = CGAffineTransform(translationX: 0, y: 40).scaledBy(x: 0.97, y: 0.97)
        isUserInteractionEnabled = false

        addSubview(glass)

        var countConfig = UIButton.Configuration.plain()
        countConfig.image = UIImage(
            systemName: "xmark.circle",
            withConfiguration: UIImage.SymbolConfiguration(pointSize: 18, weight: .medium)
        )
        countConfig.imagePadding = 6
        countConfig.contentInsets = NSDirectionalEdgeInsets(top: 0, leading: 12, bottom: 0, trailing: 16)
        countConfig.baseForegroundColor = .white
        countConfig.background.backgroundColor = UIColor(white: 1, alpha: 0.14)
        countConfig.background.cornerRadius = Self.inner / 2
        countButton.configuration = countConfig
        countButton.accessibilityLabel = "Exit selection"
        countButton.addAction(UIAction { [weak self] _ in self?.fire("selexit") }, for: .touchUpInside)

        var delConfig = UIButton.Configuration.plain()
        delConfig.baseForegroundColor = .white
        delConfig.contentInsets = NSDirectionalEdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16)
        var delTitle = AttributedString(Self.deleteTitle)
        delTitle.font = UIFont.systemFont(ofSize: 17, weight: .semibold)
        delConfig.attributedTitle = delTitle
        deleteButton.configuration = delConfig
        deleteButton.accessibilityLabel = Self.deleteTitle
        deleteButton.addAction(UIAction { [weak self] _ in self?.fire("seldel") }, for: .touchUpInside)

        var moreConfig = UIButton.Configuration.plain()
        moreConfig.image = UIImage(
            systemName: "ellipsis",
            withConfiguration: UIImage.SymbolConfiguration(pointSize: 17, weight: .semibold)
        )
        moreConfig.baseForegroundColor = .white
        moreConfig.background.backgroundColor = UIColor(white: 1, alpha: 0.14)
        moreConfig.background.cornerRadius = Self.inner / 2
        moreButton.configuration = moreConfig
        moreButton.accessibilityLabel = "More"
        moreButton.addAction(UIAction { [weak self] _ in self?.fire("selmore") }, for: .touchUpInside)

        glass.contentView.addSubview(countButton)
        glass.contentView.addSubview(deleteButton)
        glass.contentView.addSubview(moreButton)
        applyCount()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private static var deleteTitle: String {
        (Locale.preferredLanguages.first ?? "en").hasPrefix("fr") ? "Supprimer" : "Delete"
    }

    private func fire(_ action: String) {
        Haptics.play("light")
        onAction?(action)
    }

    private func applyCount() {
        var config = countButton.configuration
        var title = AttributedString("\(count)")
        title.font = UIFont.monospacedDigitSystemFont(ofSize: 17, weight: .semibold)
        config?.attributedTitle = title
        countButton.configuration = config
        let enabled = count > 0 && !busy
        deleteButton.isEnabled = enabled
        moreButton.isEnabled = enabled
        deleteButton.alpha = enabled ? 1 : 0.35
        moreButton.alpha = enabled ? 1 : 0.35
        countButton.isEnabled = !busy
        setNeedsLayout()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        glass.frame = bounds
        let p = Self.pad, h = Self.inner
        let y = (bounds.height - h) / 2
        let countWidth = max(countButton.systemLayoutSizeFitting(
            CGSize(width: UIView.layoutFittingCompressedSize.width, height: h)
        ).width, 64)
        countButton.frame = CGRect(x: p, y: y, width: countWidth, height: h)
        moreButton.frame = CGRect(x: bounds.width - p - h, y: y, width: h, height: h)
        let delWidth = max(deleteButton.systemLayoutSizeFitting(
            CGSize(width: UIView.layoutFittingCompressedSize.width, height: h)
        ).width, 96)
        deleteButton.frame = CGRect(x: moreButton.frame.minX - 6 - delWidth, y: y, width: delWidth, height: h)
    }

    /// Met à jour l'état envoyé par la page : visible ou non, nombre de produits cochés, suppression en cours.
    func update(shown: Bool, count: Int, busy: Bool) {
        if self.count != count || self.busy != busy {
            self.count = count
            self.busy = busy
            applyCount()
        }
        setShown(shown, animated: true)
    }

    private func setShown(_ show: Bool, animated: Bool) {
        guard show != isShown else { return }
        isShown = show
        isUserInteractionEnabled = show
        let change = {
            self.alpha = show ? 1 : 0
            self.transform = show ? .identity : CGAffineTransform(translationX: 0, y: 40).scaledBy(x: 0.97, y: 0.97)
        }
        if animated {
            UIView.animate(
                withDuration: 0.42, delay: 0, usingSpringWithDamping: 0.82, initialSpringVelocity: 0,
                options: [.beginFromCurrentState, .allowUserInteraction], animations: change
            )
        } else {
            change()
        }
    }
}
#endif
