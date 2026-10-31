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
        case "group": return GlassGroupItem(kind: kind, id: id)
        case "pill": return GlassPillItem(kind: kind, id: id)
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
    "calendar": "calendar",
    "calsync": "calendar.badge.clock",
    "curswap": "dollarsign.arrow.circlepath",
    "cash": "dollarsign.circle",
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

/// Pastille Analytics (période / comparaison / devise) : capsule UIGlassEffect avec icône, texte et chevron optionnel.
/// Le cadre vient de la page ; `cl` / `cr` = partie masquée à gauche / à droite quand la rangée défile.
@available(iOS 26.0, *)
final class GlassPillItem: GlassChromeItem {
    private let glass = GlassChromeItem.glass()
    private let button = UIButton(type: .system)
    private var clipL: CGFloat = 0
    private var clipR: CGFloat = 0
    private var key = ""

    override init(kind: String, id: String) {
        super.init(kind: kind, id: id)
        addSubview(glass)
        glass.contentView.addSubview(button)
        button.tintColor = GlassChromeItem.ink
        button.addAction(UIAction { [weak self] _ in
            guard let self else { return }
            Haptics.play("light")
            self.onTap?(self.itemId, 0)
        }, for: .touchUpInside)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func update(_ d: [String: Any]) {
        let icon = (d["icon"] as? String) ?? ""
        let trail = (d["trail"] as? String) ?? ""
        let title = (d["title"] as? String) ?? ""
        clipL = CGFloat((d["cl"] as? NSNumber)?.doubleValue ?? 0)
        clipR = CGFloat((d["cr"] as? NSNumber)?.doubleValue ?? 0)
        let k = icon + "|" + trail + "|" + title
        if k != key {
            key = k
            var config = UIButton.Configuration.plain()
            config.baseForegroundColor = GlassChromeItem.ink
            config.contentInsets = NSDirectionalEdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16)
            var t = AttributedString(title)
            t.font = UIFont.systemFont(ofSize: 17, weight: .medium)
            config.attributedTitle = t
            if let name = glassSymbols[icon] {
                config.image = UIImage(systemName: name, withConfiguration: UIImage.SymbolConfiguration(pointSize: 18, weight: .medium))
                config.imagePadding = 8
                config.imagePlacement = .leading
            }
            button.configuration = config
            // Chevron à droite : vue accessoire dans le contenu du verre (le bouton ne gère qu'une image).
            glass.contentView.subviews.filter { $0.tag == 77 }.forEach { $0.removeFromSuperview() }
            if let name = glassSymbols[trail], trail != icon {
                let iv = UIImageView(image: UIImage(systemName: name, withConfiguration: UIImage.SymbolConfiguration(pointSize: 13, weight: .bold)))
                iv.tintColor = GlassChromeItem.ink
                iv.tag = 77
                iv.isUserInteractionEnabled = false
                glass.contentView.addSubview(iv)
                var c = config
                c.contentInsets = NSDirectionalEdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 34)
                button.configuration = c
            }
        }
        setNeedsLayout()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        glass.frame = bounds
        button.frame = glass.bounds
        if let iv = glass.contentView.viewWithTag(77) {
            iv.sizeToFit()
            iv.center = CGPoint(x: bounds.width - 18, y: bounds.height / 2)
        }
        // Rangée qui défile : on rogne le verre à la zone visible de la rangée.
        if clipL > 0.5 || clipR > 0.5 {
            let m = CALayer()
            m.backgroundColor = UIColor.black.cgColor
            m.frame = CGRect(x: clipL, y: -4, width: max(0, bounds.width - clipL - clipR), height: bounds.height + 8)
            layer.mask = m
        } else {
            layer.mask = nil
        }
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
    private let pill = UIView()
    private let pillDim = UIView()
    private var buttons: [UIButton] = []
    private var labels: [String] = []
    private var selected = -1
    private var frames: [CGRect] = []
    private var lead: CGFloat = 0
    private var pendingMove = false

    private static let font = UIFont.systemFont(ofSize: 17, weight: .semibold)      // mesure (le plus large)
    private static let fontOff = UIFont.systemFont(ofSize: 17, weight: .medium)
    private static let offColor = UIColor(white: 0.40, alpha: 1)
    private static let pad: CGFloat = 16
    private static let gap: CGFloat = 3.5

    override init(kind: String, id: String) {
        super.init(kind: kind, id: id)
        scroll.showsHorizontalScrollIndicator = false
        scroll.alwaysBounceHorizontal = true
        scroll.clipsToBounds = false
        scroll.delaysContentTouches = false
        addSubview(scroll)
        // Pastille plate gris clair (comme sur la capture), pas de verre.
        pill.backgroundColor = UIColor(white: 0.955, alpha: 1)
        pill.layer.cornerRadius = 17.5
        pill.layer.cornerCurve = .continuous
        scroll.addSubview(pill)
    }

    /// Chip actif : texte noir en gras ; les autres : gris, graisse moyenne.
    private func styleButtons() {
        for (i, b) in buttons.enumerated() where i < labels.count {
            let on = i == selected
            var config = b.configuration ?? UIButton.Configuration.plain()
            var t = AttributedString(labels[i])
            t.font = on ? GlassChips.font : GlassChips.fontOff
            config.attributedTitle = t
            config.baseForegroundColor = on ? GlassChromeItem.ink : GlassChips.offColor
            b.configuration = config
        }
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
                t.font = GlassChips.fontOff
                config.attributedTitle = t
                config.baseForegroundColor = GlassChips.offColor
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
        styleButtons()
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
            // apply() tourne dans performWithoutAnimation : on lance le glissement au tour suivant,
            // sinon la pastille se téléporte. pendingMove empêche layoutSubviews de la placer avant.
            pendingMove = true
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                self.pendingMove = false
                guard self.selected >= 0, self.selected < self.frames.count else { return }
                let end = self.frames[self.selected].offsetBy(dx: 0, dy: self.yOffset)
                UIView.animate(
                    withDuration: 0.55, delay: 0, usingSpringWithDamping: 0.82, initialSpringVelocity: 0.5,
                    options: [.beginFromCurrentState, .allowUserInteraction]
                ) { self.pill.frame = end }
            }
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
            pill.addSubview(pillDim)
        }
        pillDim.frame = pill.bounds
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
        if !pendingMove, selected >= 0, selected < frames.count, pill.layer.animationKeys() == nil {
            pill.frame = frames[selected].offsetBy(dx: 0, dy: yOffset)
        }
    }
}
/// Capsule de verre unique qui assemble plusieurs boutons (+ et …) ou un champ de recherche suivi de
/// boutons (localisation / trier / filtrer), comme dans l'app Shopify. Les positions des boutons
/// viennent de la page web (relative à la capsule) ; le texte du champ est relayé vers l'input web.
@available(iOS 26.0, *)
final class GlassGroupItem: GlassChromeItem, UITextFieldDelegate {
    private struct Part {
        let id: String
        let icon: String
        let frame: CGRect
        let dot: Bool
    }

    private let glass = GlassChromeItem.glass(interactive: false)
    private var buttons: [UIButton] = []
    private var dots: [UIView] = []
    private var parts: [Part] = []
    private var partsKey = ""
    private let searchIcon = UIImageView()
    private let field = UITextField()
    private var hasSearch = false

    override init(kind: String, id: String) {
        super.init(kind: kind, id: id)
        addSubview(glass)

        searchIcon.image = UIImage(
            systemName: "magnifyingglass",
            withConfiguration: UIImage.SymbolConfiguration(pointSize: 15, weight: .medium)
        )
        searchIcon.tintColor = UIColor(white: 0.45, alpha: 1)
        searchIcon.contentMode = .scaleAspectFit
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
            // Le champ web vit sous l'id « s:search » (même relais que le champ de recherche seul).
            self.onText?("s:search", self.field.text ?? "")
        }, for: .editingChanged)
        addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(focusField)))
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    @objc private func focusField() { if hasSearch { field.becomeFirstResponder() } }

    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        textField.resignFirstResponder()
        return true
    }

    override func update(_ d: [String: Any]) {
        let gray = (d["tone"] as? String) == "gray"
        let tint = gray ? UIColor(white: 0.40, alpha: 1) : GlassChromeItem.ink

        let raw = (d["parts"] as? [[String: Any]]) ?? []
        let newParts: [Part] = raw.compactMap { p in
            guard let id = p["id"] as? String else { return nil }
            func num(_ k: String) -> CGFloat { CGFloat((p[k] as? NSNumber)?.doubleValue ?? 0) }
            return Part(
                id: id,
                icon: (p["icon"] as? String) ?? "",
                frame: CGRect(x: num("x"), y: num("y"), width: num("w"), height: num("h")),
                dot: (p["dot"] as? Bool) == true
            )
        }
        let key = newParts.map { "\($0.id)|\($0.icon)|\($0.dot)" }.joined(separator: ";") + (gray ? "#g" : "#i")
        if key != partsKey {
            partsKey = key
            buttons.forEach { $0.removeFromSuperview() }
            dots.forEach { $0.removeFromSuperview() }
            buttons = []
            dots = []
            for part in newParts {
                let b = UIButton(type: .system)
                var config = UIButton.Configuration.plain()
                config.baseForegroundColor = tint
                config.contentInsets = .zero
                if let name = glassSymbols[part.icon] {
                    config.image = UIImage(
                        systemName: name,
                        withConfiguration: UIImage.SymbolConfiguration(pointSize: gray ? 16 : 21, weight: .medium)
                    )
                }
                b.configuration = config
                b.tintColor = tint
                let pid = part.id
                b.addAction(UIAction { [weak self] _ in
                    Haptics.play("light")
                    self?.onTap?(pid, 0)
                }, for: .touchUpInside)
                glass.contentView.addSubview(b)
                buttons.append(b)

                let dot = UIView()
                dot.backgroundColor = UIColor(white: 0.29, alpha: 1)
                dot.layer.borderColor = UIColor.white.cgColor
                dot.layer.borderWidth = 2
                dot.isHidden = !part.dot
                dot.isUserInteractionEnabled = false
                glass.contentView.addSubview(dot)
                dots.append(dot)
            }
        }
        parts = newParts

        hasSearch = d["placeholder"] != nil
        if hasSearch {
            if searchIcon.superview == nil {
                glass.contentView.addSubview(searchIcon)
                glass.contentView.addSubview(field)
            }
            let ph = (d["placeholder"] as? String) ?? ""
            if field.placeholder != ph {
                field.attributedPlaceholder = NSAttributedString(
                    string: ph,
                    attributes: [.foregroundColor: UIColor(white: 0.55, alpha: 1), .font: UIFont.systemFont(ofSize: 17)]
                )
            }
            let text = (d["text"] as? String) ?? ""
            if !field.isFirstResponder, field.text != text { field.text = text }
        } else {
            searchIcon.removeFromSuperview()
            field.removeFromSuperview()
        }
        setNeedsLayout()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        glass.frame = bounds
        for (i, part) in parts.enumerated() where i < buttons.count {
            buttons[i].frame = part.frame
            let s: CGFloat = 11
            dots[i].frame = CGRect(x: part.frame.maxX - s - 8, y: part.frame.minY + 6, width: s, height: s)
            dots[i].layer.cornerRadius = s / 2
        }
        if hasSearch {
            let h = bounds.height
            searchIcon.frame = CGRect(x: 16, y: (h - 22) / 2, width: 22, height: 22)
            let firstX = parts.map { $0.frame.minX }.min() ?? bounds.width
            field.frame = CGRect(x: 44, y: 0, width: max(0, firstX - 44 - 4), height: h)
        }
    }
}
#endif
