import UIKit

/// Boutons, recherche et filtres en vrai Liquid Glass Apple (UIGlassEffect, iOS 26+) pour les pages
/// Commandes / Produits et la fiche commande. Même principe que GlassTabBar : le verre natif est posé
/// au-dessus de la WebView aux coordonnées envoyées par la page ; les éléments web restent en relais invisible.
#if compiler(>=6.2)
@available(iOS 26.0, *)
final class GlassChromeView: UIView {
    var onTap: ((String, Int) -> Void)?
    var onText: ((String, String) -> Void)?

    private var views: [String: GlassChromeItem] = [:]

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        // L'interface de l'app est claire : le verre reste clair même si l'iPhone est en mode sombre.
        overrideUserInterfaceStyle = .light
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    /// Laisse passer tous les toucher qui ne tombent pas sur un élément de verre : la page web reste utilisable.
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        let hit = super.hitTest(point, with: event)
        return hit === self ? nil : hit
    }

    func apply(_ items: [[String: Any]]) {
        var seen = Set<String>()
        var moves: [(GlassChromeItem, CGFloat, Bool)] = []
        UIView.performWithoutAnimation {
            for d in items {
                guard let id = d["id"] as? String, let kind = d["kind"] as? String else { continue }
                let x = (d["x"] as? NSNumber)?.doubleValue ?? 0
                let y = (d["y"] as? NSNumber)?.doubleValue ?? 0
                let w = (d["w"] as? NSNumber)?.doubleValue ?? 0
                let h = (d["h"] as? NSNumber)?.doubleValue ?? 0
                guard w > 1, h > 1 else { continue }
                seen.insert(id)
                let item: GlassChromeItem
                var isNew = false
                if let existing = views[id], existing.kind == kind {
                    item = existing
                } else {
                    views[id]?.removeFromSuperview()
                    item = GlassChromeItem.make(kind: kind, id: id)
                    item.onTap = { [weak self] id, idx in self?.onTap?(id, idx) }
                    item.onText = { [weak self] id, text in self?.onText?(id, text) }
                    addSubview(item)
                    views[id] = item
                    isNew = true
                }
                // bounds + center (et non frame) : la transformation de la feuille peut être active.
                item.bounds = CGRect(x: 0, y: 0, width: w, height: h)
                item.center = CGPoint(x: x + w / 2, y: y + h / 2)
                item.update(d)
                item.applyDim(CGFloat((d["dim"] as? NSNumber)?.doubleValue ?? 0))
                if id.hasPrefix("o:") {
                    let target = CGFloat((d["target"] as? NSNumber)?.doubleValue ?? 0)
                    let drag = (d["drag"] as? Bool) == true
                    if isNew { item.transform = CGAffineTransform(translationX: 0, y: max(target, bounds.height)); item.sheetTarget = .infinity }
                    moves.append((item, target, drag))
                }
            }
            for (id, v) in views where !seen.contains(id) {
                v.removeFromSuperview()
                views[id] = nil
            }
        }
        // Hors du bloc « sans animation » : sinon la montée de la feuille serait sautée.
        for (item, target, drag) in moves { sheetMove(item, to: target, drag: drag) }
    }

    func reset() { apply([]) }

    /// Suit la feuille commande : même courbe que la CSS (.5 s, cubic-bezier(.32,.72,0,1)).
    private func sheetMove(_ item: GlassChromeItem, to target: CGFloat, drag: Bool) {
        if drag {
            item.layer.removeAllAnimations()
            item.transform = CGAffineTransform(translationX: 0, y: target)
            item.sheetTarget = target
            return
        }
        guard item.sheetTarget != target else { return }
        item.sheetTarget = target
        let timing = UICubicTimingParameters(controlPoint1: CGPoint(x: 0.32, y: 0.72), controlPoint2: CGPoint(x: 0, y: 1))
        let animator = UIViewPropertyAnimator(duration: 0.5, timingParameters: timing)
        animator.addAnimations { item.transform = CGAffineTransform(translationX: 0, y: target) }
        animator.startAnimation()
    }

    /// Position du doigt pendant le glissement (message léger, sans passer par le rendu complet).
    func dragSheet(_ dy: CGFloat) {
        for (id, v) in views where id.hasPrefix("o:") {
            v.layer.removeAllAnimations()
            v.transform = CGAffineTransform(translationX: 0, y: dy)
            v.sheetTarget = dy
        }
    }
}

// MARK: - Éléments

@available(iOS 26.0, *)
class GlassChromeItem: UIView {
    let kind: String
    let itemId: String
    var onTap: ((String, Int) -> Void)?
    var onText: ((String, String) -> Void)?

    static let ink = UIColor(white: 0.07, alpha: 1)
    var sheetTarget: CGFloat = 0

    init(kind: String, id: String) {
        self.kind = kind
        self.itemId = id
        super.init(frame: .zero)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    static func make(kind: String, id: String) -> GlassChromeItem {
        switch kind {
        case "search": return GlassSearchField(kind: kind, id: id)
        case "chips": return GlassChips(kind: kind, id: id)
        default: return GlassButtonItem(kind: kind, id: id)
        }
    }

    static func glass(interactive: Bool = true, tint: UIColor? = nil) -> UIVisualEffectView {
        let effect = UIGlassEffect()
        effect.isInteractive = interactive
        if let tint { effect.tintColor = tint }
        let v = UIVisualEffectView(effect: effect)
        v.cornerConfiguration = .capsule()
        return v
    }

    func update(_ d: [String: Any]) {}

    /// Assombrissement quand une feuille (voile noir) recouvre la page : le verre reste, comme sur iOS.
    private let dimView = UIView()
    func applyDim(_ amount: CGFloat) {
        if dimView.superview == nil {
            dimView.backgroundColor = .black
            dimView.isUserInteractionEnabled = false
            addSubview(dimView)
        }
        dimView.alpha = amount
        dimView.isHidden = amount < 0.005
        bringSubviewToFront(dimView)
        // Sous le voile, les touchers passent à la page (le voile ferme la feuille).
        isUserInteractionEnabled = amount < 0.01
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        dimView.frame = bounds
        dimView.layer.cornerRadius = min(bounds.width, bounds.height) / 2
    }
}

/// Correspondance icônes de la page web -> symboles SF.
private let glassSymbols: [String: String] = [
    "plus-circle": "plus.circle",
    "more": "ellipsis",
    "location": "mappin.and.ellipse",
    "sort": "arrow.up.arrow.down",
    "filter": "line.3.horizontal.decrease",
    "x": "xmark",
    "print": "printer",
    "search": "magnifyingglass",
    "chev-down": "chevron.down",
    "chev-left": "chevron.left",
    "arrow-ur": "arrow.up.right",
]

/// Bouton rond (ou capsule avec texte) en verre.
@available(iOS 26.0, *)
final class GlassButtonItem: GlassChromeItem {
    private let glass: UIVisualEffectView
    private let button = UIButton(type: .system)
    private let dot = UIView()
    private var iconKey = ""
    private var titleKey = ""

    override init(kind: String, id: String) {
        glass = kind == "cta"
            ? GlassChromeItem.glass(tint: UIColor(white: 0.14, alpha: 0.92))
            : GlassChromeItem.glass()
        super.init(kind: kind, id: id)
        addSubview(glass)
        glass.contentView.addSubview(button)
        button.tintColor = kind == "cta" ? .white : GlassChromeItem.ink
        button.addAction(UIAction { [weak self] _ in
            guard let self else { return }
            Haptics.play("light")
            self.onTap?(self.itemId, 0)
        }, for: .touchUpInside)

        dot.backgroundColor = UIColor(white: 0.29, alpha: 1)
        dot.layer.borderColor = UIColor.white.cgColor
        dot.layer.borderWidth = 2
        dot.isHidden = true
        dot.isUserInteractionEnabled = false
        addSubview(dot)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func update(_ d: [String: Any]) {
        let icon = (d["icon"] as? String) ?? ""
        let title = (d["title"] as? String) ?? ""
        if icon != iconKey || title != titleKey {
            iconKey = icon
            titleKey = title
            var config = UIButton.Configuration.plain()
            config.baseForegroundColor = kind == "cta" ? .white : GlassChromeItem.ink
            config.contentInsets = .zero
            if kind == "txt" || kind == "cta" {
                var t = AttributedString(title)
                t.font = UIFont.systemFont(ofSize: kind == "cta" ? 17 : 16, weight: .semibold)
                config.attributedTitle = t
                if kind == "cta", let name = glassSymbols[icon] {
                    config.image = UIImage(
                        systemName: name,
                        withConfiguration: UIImage.SymbolConfiguration(pointSize: 15, weight: .semibold)
                    )
                    config.imagePadding = 8
                }
            } else if let name = glassSymbols[icon] {
                let size: CGFloat = kind == "mini" ? 12 : 19
                let weight: UIImage.SymbolWeight = kind == "mini" ? .bold : .medium
                config.image = UIImage(
                    systemName: name,
                    withConfiguration: UIImage.SymbolConfiguration(pointSize: size, weight: weight)
                )
            }
            button.configuration = config
        }
        dot.isHidden = (d["dot"] as? Bool) != true
        let disabled = (d["disabled"] as? Bool) == true
        button.isEnabled = !disabled
        glass.contentView.alpha = disabled ? 0.45 : 1
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        glass.frame = bounds
        button.frame = glass.bounds
        let s: CGFloat = 11
        dot.frame = CGRect(x: bounds.width - s - 1, y: -1, width: s, height: s)
        dot.layer.cornerRadius = s / 2
    }
}

/// Champ de recherche en verre ; le texte est relayé vers l'input de la page web.
@available(iOS 26.0, *)
final class GlassSearchField: GlassChromeItem, UITextFieldDelegate {
    private let glass = GlassChromeItem.glass(interactive: false)
    private let icon = UIImageView()
    private let field = UITextField()

    override init(kind: String, id: String) {
        super.init(kind: kind, id: id)
        addSubview(glass)
        icon.image = UIImage(
            systemName: "magnifyingglass",
            withConfiguration: UIImage.SymbolConfiguration(pointSize: 17, weight: .medium)
        )
        icon.tintColor = UIColor(white: 0.45, alpha: 1)
        icon.contentMode = .scaleAspectFit
        glass.contentView.addSubview(icon)

        field.font = .systemFont(ofSize: 17)
        field.textColor = GlassChromeItem.ink
        field.tintColor = UIColor(red: 0.0, green: 0.36, blue: 0.84, alpha: 1)
        field.returnKeyType = .search
        field.clearButtonMode = .whileEditing
        field.autocorrectionType = .no
        field.autocapitalizationType = .none
        field.delegate = self
        field.addAction(UIAction { [weak self] _ in
            guard let self else { return }
            self.onText?(self.itemId, self.field.text ?? "")
        }, for: .editingChanged)
        glass.contentView.addSubview(field)

        // Toucher n'importe où dans la capsule met le curseur dans le champ.
        addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(focusField)))
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    @objc private func focusField() { field.becomeFirstResponder() }

    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        textField.resignFirstResponder()
        return true
    }

    override func update(_ d: [String: Any]) {
        let ph = (d["placeholder"] as? String) ?? ""
        if field.placeholder != ph {
            field.attributedPlaceholder = NSAttributedString(
                string: ph,
                attributes: [.foregroundColor: UIColor(white: 0.55, alpha: 1), .font: UIFont.systemFont(ofSize: 17)]
            )
        }
        // La page ne réécrit le texte que s'il a changé ailleurs (ex. rendu) ; on ne casse pas la saisie en cours.
        let text = (d["text"] as? String) ?? ""
        if !field.isFirstResponder, field.text != text { field.text = text }
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        glass.frame = bounds
        let h = bounds.height
        icon.frame = CGRect(x: 16, y: (h - 22) / 2, width: 22, height: 22)
        field.frame = CGRect(x: 44, y: 0, width: max(0, bounds.width - 44 - 12), height: h)
    }
}

/// Rangée de filtres (Toutes / Non traitées / …) : texte simple + pastille de verre sur le filtre actif.
@available(iOS 26.0, *)
final class GlassChips: GlassChromeItem {
    private let scroll = UIScrollView()
    private let pill = GlassChromeItem.glass()
    private let pillDim = UIView()
    private var buttons: [UIButton] = []
    private var labels: [String] = []
    private var selected = -1
    private var frames: [CGRect] = []
    private var lead: CGFloat = 0

    private static let font = UIFont.systemFont(ofSize: 15, weight: .medium)
    private static let pad: CGFloat = 18
    private static let gap: CGFloat = 3.5

    override init(kind: String, id: String) {
        super.init(kind: kind, id: id)
        scroll.showsHorizontalScrollIndicator = false
        scroll.alwaysBounceHorizontal = true
        scroll.clipsToBounds = false
        scroll.delaysContentTouches = false
        addSubview(scroll)
        scroll.addSubview(pill)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    /// `lead` = marge gauche de la rangée côté web ; le cadre reçu est celui des chips (hauteur 35).
    override func update(_ d: [String: Any]) {
        let newLabels = (d["labels"] as? [String]) ?? []
        let sel = (d["sel"] as? NSNumber)?.intValue ?? -1
        let newLead = CGFloat((d["lead"] as? NSNumber)?.doubleValue ?? 0)
        if newLabels != labels || newLead != lead {
            lead = newLead
            labels = newLabels
            buttons.forEach { $0.removeFromSuperview() }
            buttons = newLabels.enumerated().map { index, text in
                let b = UIButton(type: .system)
                var config = UIButton.Configuration.plain()
                config.contentInsets = .zero
                var t = AttributedString(text)
                t.font = GlassChips.font
                config.attributedTitle = t
                config.baseForegroundColor = GlassChromeItem.ink
                b.configuration = config
                b.addAction(UIAction { [weak self] _ in
                    guard let self else { return }
                    Haptics.play("selection")
                    self.onTap?(self.itemId, index)
                }, for: .touchUpInside)
                scroll.addSubview(b)
                return b
            }
            computeFrames()
        }
        if sel != selected {
            let first = selected < 0
            selected = sel
            moveSelection(animated: !first && window != nil)
        }
        setNeedsLayout()
    }

    private func computeFrames() {
        var x: CGFloat = lead
        frames = labels.map { text in
            let w = ceil((text as NSString).size(withAttributes: [.font: GlassChips.font]).width) + GlassChips.pad * 2
            defer { x += w + GlassChips.gap }
            return CGRect(x: x, y: 0, width: w, height: 35)
        }
    }

    private func moveSelection(animated: Bool) {
        guard selected >= 0, selected < frames.count else { pill.isHidden = true; return }
        pill.isHidden = false
        let target = frames[selected].offsetBy(dx: 0, dy: yOffset)
        if animated {
            UIView.animate(
                withDuration: 0.45, delay: 0, usingSpringWithDamping: 0.78, initialSpringVelocity: 0.3,
                options: [.beginFromCurrentState, .allowUserInteraction]
            ) { self.pill.frame = target }
        } else {
            pill.frame = target
        }
    }

    private var yOffset: CGFloat { 0 }

    /// Seule la pastille de verre s'assombrit (le texte et le fond sont déjà sous le voile de la page).
    override func applyDim(_ amount: CGFloat) {
        if pillDim.superview == nil {
            pillDim.backgroundColor = .black
            pillDim.isUserInteractionEnabled = false
            pillDim.layer.cornerRadius = 17.5
            pillDim.layer.cornerCurve = .continuous
            pillDim.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            pill.contentView.addSubview(pillDim)
        }
        pillDim.frame = pill.contentView.bounds
        pillDim.alpha = amount
        pillDim.isHidden = amount < 0.005
        isUserInteractionEnabled = amount < 0.01
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        scroll.frame = bounds
        for (i, b) in buttons.enumerated() where i < frames.count {
            b.frame = frames[i].offsetBy(dx: 0, dy: yOffset)
        }
        let contentW = (frames.last?.maxX ?? 0) + lead
        scroll.contentSize = CGSize(width: max(contentW, bounds.width), height: bounds.height)
        if selected >= 0, selected < frames.count, pill.layer.animationKeys() == nil {
            pill.frame = frames[selected].offsetBy(dx: 0, dy: yOffset)
        }
    }
}
#endif
