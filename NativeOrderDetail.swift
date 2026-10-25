import UIKit

/// Page commande native (Liquid Glass, iOS 26), construite comme la fiche produit :
/// retour / « imprimer | … » en verre, carte de statut, sections en cartes très arrondies,
/// boutons d'action en verre. S'ouvre au clic sur une commande, au-dessus de la page web,
/// sous la barre d'onglets. Tout le texte arrive déjà traduit depuis la page web (app.js).
#if compiler(>=6.2)

// MARK: - Briques

/// Pastille de verre teintée (Payée, Non traitée…).
@available(iOS 26.0, *)
final class ODBadge: UIVisualEffectView {
    init(text: String, kind: String) {
        let effect = UIGlassEffect()
        let fg: UIColor
        switch kind {
        case "ok":
            effect.tintColor = PCTheme.okBg
            fg = PCTheme.okFg
        case "att", "warn":
            effect.tintColor = UIColor(red: 1.0, green: 0.88, blue: 0.55, alpha: 1)
            fg = UIColor(red: 0.42, green: 0.27, blue: 0.0, alpha: 1)
        default:
            effect.tintColor = UIColor(white: 0.85, alpha: 1)
            fg = PCTheme.ink
        }
        super.init(effect: effect)
        cornerConfiguration = .capsule()
        translatesAutoresizingMaskIntoConstraints = false
        setContentHuggingPriority(.required, for: .horizontal)
        setContentCompressionResistancePriority(.required, for: .horizontal)
        let label = UILabel()
        label.text = text
        label.font = .systemFont(ofSize: 13, weight: .semibold)
        label.textColor = fg
        label.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(label)
        NSLayoutConstraint.activate([
            label.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            label.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            label.topAnchor.constraint(equalTo: topAnchor, constant: 5),
            label.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -5),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

/// Ligne « Paiement  [Payée] » de la carte de statut.
@available(iOS 26.0, *)
final class ODStatusRow: UIView {
    init(title: String, badge: ODBadge) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        let label = UILabel()
        label.text = title
        label.font = .systemFont(ofSize: 16, weight: .semibold)
        label.textColor = PCTheme.ink
        label.translatesAutoresizingMaskIntoConstraints = false
        addSubview(label)
        addSubview(badge)
        NSLayoutConstraint.activate([
            heightAnchor.constraint(greaterThanOrEqualToConstant: 54),
            label.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            label.centerYAnchor.constraint(equalTo: centerYAnchor),
            badge.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            badge.centerYAnchor.constraint(equalTo: centerYAnchor),
            badge.leadingAnchor.constraint(greaterThanOrEqualTo: label.trailingAnchor, constant: 8),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

/// Filet fin entre deux lignes d'une carte.
@available(iOS 26.0, *)
final class ODSeparator: UIView {
    init() {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        let line = UIView()
        line.backgroundColor = PCTheme.line
        line.translatesAutoresizingMaskIntoConstraints = false
        addSubview(line)
        NSLayoutConstraint.activate([
            heightAnchor.constraint(equalToConstant: 0.5),
            line.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            line.trailingAnchor.constraint(equalTo: trailingAnchor),
            line.topAnchor.constraint(equalTo: topAnchor),
            line.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

/// Ligne « libellé (sous-texte) ……… valeur » (sous-total, taxes, total…).
@available(iOS 26.0, *)
final class ODKVRow: UIView {
    init(label: String, sub: String = "", value: String, bold: Bool = false) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        let l = UILabel()
        l.text = label
        l.font = .systemFont(ofSize: 16, weight: bold ? .semibold : .regular)
        l.textColor = PCTheme.ink
        let s = UILabel()
        s.text = sub
        s.font = .systemFont(ofSize: 14)
        s.textColor = PCTheme.sub
        s.numberOfLines = 0
        s.isHidden = sub.isEmpty
        let left = UIStackView(arrangedSubviews: [l, s])
        left.axis = .vertical
        left.spacing = 1
        let v = UILabel()
        v.text = value
        v.font = .monospacedDigitSystemFont(ofSize: 16, weight: bold ? .semibold : .regular)
        v.textColor = PCTheme.ink
        v.textAlignment = .right
        v.setContentHuggingPriority(.required, for: .horizontal)
        v.setContentCompressionResistancePriority(.required, for: .horizontal)
        let row = UIStackView(arrangedSubviews: [left, v])
        row.alignment = .top
        row.spacing = 12
        row.translatesAutoresizingMaskIntoConstraints = false
        addSubview(row)
        NSLayoutConstraint.activate([
            row.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            row.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            row.topAnchor.constraint(equalTo: topAnchor, constant: 10),
            row.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -10),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

/// Article de la commande : vignette, titre, variante, prix, quantité.
@available(iOS 26.0, *)
final class ODItemRow: UIView {
    init(title: String, variant: String, price: String, qty: Int, img: String) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false

        let thumb = UIImageView()
        thumb.backgroundColor = UIColor(white: 0.95, alpha: 1)
        thumb.contentMode = .scaleAspectFill
        thumb.clipsToBounds = true
        thumb.layer.cornerRadius = 12
        thumb.layer.cornerCurve = .continuous
        thumb.translatesAutoresizingMaskIntoConstraints = false
        if let image = PCImage.image(fromDataURL: img) {
            thumb.image = image
        } else {
            let ph = UIImageView(image: PCTheme.symbol("photo", 16, .regular))
            ph.tintColor = UIColor(white: 0.62, alpha: 1)
            ph.contentMode = .center
            ph.translatesAutoresizingMaskIntoConstraints = false
            thumb.addSubview(ph)
            NSLayoutConstraint.activate([
                ph.centerXAnchor.constraint(equalTo: thumb.centerXAnchor),
                ph.centerYAnchor.constraint(equalTo: thumb.centerYAnchor),
            ])
        }

        let t = UILabel()
        t.text = title
        t.font = .systemFont(ofSize: 16, weight: .semibold)
        t.textColor = PCTheme.ink
        t.numberOfLines = 2
        let v = UILabel()
        v.text = variant
        v.font = .systemFont(ofSize: 14)
        v.textColor = PCTheme.sub
        v.isHidden = variant.isEmpty
        let p = UILabel()
        p.text = price
        p.font = .systemFont(ofSize: 14)
        p.textColor = PCTheme.sub
        let texts = UIStackView(arrangedSubviews: [t, v, p])
        texts.axis = .vertical
        texts.spacing = 1

        let q = UILabel()
        q.text = "× \(qty)"
        q.font = .monospacedDigitSystemFont(ofSize: 16, weight: .regular)
        q.textColor = PCTheme.sub
        q.setContentHuggingPriority(.required, for: .horizontal)
        q.setContentCompressionResistancePriority(.required, for: .horizontal)

        let row = UIStackView(arrangedSubviews: [thumb, texts, q])
        row.alignment = .center
        row.spacing = 12
        row.translatesAutoresizingMaskIntoConstraints = false
        addSubview(row)
        NSLayoutConstraint.activate([
            thumb.widthAnchor.constraint(equalToConstant: 52),
            thumb.heightAnchor.constraint(equalToConstant: 52),
            row.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            row.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            row.topAnchor.constraint(equalTo: topAnchor, constant: 10),
            row.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -10),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

/// Un bouton de verre pleine largeur dans une carte.
@available(iOS 26.0, *)
final class ODButtonRow: UIView {
    init(button: UIView, inset: CGFloat = 16, top: CGFloat = 8, bottom: CGFloat = 14) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        button.setContentHuggingPriority(.defaultLow, for: .horizontal)
        addSubview(button)
        NSLayoutConstraint.activate([
            button.leadingAnchor.constraint(equalTo: leadingAnchor, constant: inset),
            button.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -inset),
            button.topAnchor.constraint(equalTo: topAnchor, constant: top),
            button.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -bottom),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

/// Ligne client : avatar à initiales, nom, nombre de commandes, chevron.
@available(iOS 26.0, *)
final class ODCustomerRow: UIControl {
    init(name: String, sub: String, initials: String) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        let avatar = UILabel()
        avatar.text = initials.uppercased()
        avatar.font = .systemFont(ofSize: 15, weight: .semibold)
        avatar.textColor = PCTheme.ink
        avatar.textAlignment = .center
        avatar.backgroundColor = UIColor(white: 0.92, alpha: 1)
        avatar.layer.cornerRadius = 20
        avatar.clipsToBounds = true
        avatar.translatesAutoresizingMaskIntoConstraints = false

        let n = UILabel()
        n.text = name
        n.font = .systemFont(ofSize: 16, weight: .semibold)
        n.textColor = PCTheme.ink
        let s = UILabel()
        s.text = sub
        s.font = .systemFont(ofSize: 14)
        s.textColor = PCTheme.sub
        let texts = UIStackView(arrangedSubviews: [n, s])
        texts.axis = .vertical
        texts.spacing = 1

        let row = UIStackView(arrangedSubviews: [avatar, texts, UIView(), PCDRow.makeChevron()])
        row.alignment = .center
        row.spacing = 12
        row.isUserInteractionEnabled = false
        row.translatesAutoresizingMaskIntoConstraints = false
        addSubview(row)
        NSLayoutConstraint.activate([
            avatar.widthAnchor.constraint(equalToConstant: 40),
            avatar.heightAnchor.constraint(equalToConstant: 40),
            row.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            row.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            row.topAnchor.constraint(equalTo: topAnchor, constant: 10),
            row.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -10),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override var isHighlighted: Bool {
        didSet { backgroundColor = isHighlighted ? UIColor(white: 0, alpha: 0.05) : .clear }
    }

    func onTap(_ handler: @escaping () -> Void) {
        addAction(UIAction { _ in PCTheme.haptic(); handler() }, for: .touchUpInside)
    }
}

/// Adresse de livraison + bouton copier.
@available(iOS 26.0, *)
final class ODAddressRow: UIView {
    let copyButton = UIButton(type: .system)

    init(title: String, lines: [String]) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        let t = UILabel()
        t.text = title
        t.font = .systemFont(ofSize: 13)
        t.textColor = PCTheme.sub
        t.isHidden = title.isEmpty
        let body = UILabel()
        body.text = lines.joined(separator: "\n")
        body.font = .systemFont(ofSize: 16)
        body.textColor = PCTheme.ink
        body.numberOfLines = 0
        let texts = UIStackView(arrangedSubviews: [t, body])
        texts.axis = .vertical
        texts.spacing = 3

        copyButton.setImage(PCTheme.symbol("doc.on.doc", 17, .regular), for: .normal)
        copyButton.tintColor = PCTheme.ink
        copyButton.setContentHuggingPriority(.required, for: .horizontal)
        copyButton.widthAnchor.constraint(equalToConstant: 36).isActive = true
        copyButton.heightAnchor.constraint(equalToConstant: 36).isActive = true

        let row = UIStackView(arrangedSubviews: [texts, copyButton])
        row.alignment = .top
        row.spacing = 8
        row.translatesAutoresizingMaskIntoConstraints = false
        addSubview(row)
        NSLayoutConstraint.activate([
            row.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            row.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -10),
            row.topAnchor.constraint(equalTo: topAnchor, constant: 8),
            row.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -10),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

/// Niveau de risque de litige : 1 à 3 barres colorées.
@available(iOS 26.0, *)
final class ODRiskRow: UIView {
    init(level: String, label: String) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        let count: Int
        let color: UIColor
        switch level {
        case "Medium": count = 2; color = UIColor(red: 0.95, green: 0.65, blue: 0.10, alpha: 1)
        case "High": count = 3; color = UIColor(red: 0.85, green: 0.20, blue: 0.20, alpha: 1)
        default: count = 1; color = UIColor(red: 0.20, green: 0.70, blue: 0.30, alpha: 1)
        }
        let bars = UIStackView()
        bars.spacing = 3
        bars.alignment = .center
        for i in 0..<3 {
            let b = UIView()
            b.backgroundColor = i < count ? color : UIColor(white: 0.88, alpha: 1)
            b.layer.cornerRadius = 3
            b.translatesAutoresizingMaskIntoConstraints = false
            b.widthAnchor.constraint(equalToConstant: 8).isActive = true
            b.heightAnchor.constraint(equalToConstant: 22).isActive = true
            bars.addArrangedSubview(b)
        }
        bars.setContentHuggingPriority(.required, for: .horizontal)
        let l = UILabel()
        l.text = label
        l.font = .systemFont(ofSize: 16, weight: .semibold)
        l.textColor = PCTheme.ink
        l.numberOfLines = 0
        let row = UIStackView(arrangedSubviews: [bars, l])
        row.alignment = .center
        row.spacing = 12
        row.translatesAutoresizingMaskIntoConstraints = false
        addSubview(row)
        NSLayoutConstraint.activate([
            row.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            row.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            row.topAnchor.constraint(equalTo: topAnchor, constant: 14),
            row.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -14),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

/// Ligne de la chronologie : point, trait de liaison, texte, date.
@available(iOS 26.0, *)
final class ODTimelineRow: UIView {
    init(text: String, when: String, first: Bool, last: Bool) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        let dot = UIView()
        dot.backgroundColor = UIColor(white: 0.55, alpha: 1)
        dot.layer.cornerRadius = 4.5
        dot.translatesAutoresizingMaskIntoConstraints = false
        let line = UIView()
        line.backgroundColor = UIColor(white: 0, alpha: 0.12)
        line.translatesAutoresizingMaskIntoConstraints = false
        addSubview(line)
        addSubview(dot)

        let t = UILabel()
        t.text = text
        t.font = .systemFont(ofSize: 15)
        t.textColor = PCTheme.ink
        t.numberOfLines = 0
        let w = UILabel()
        w.text = when
        w.font = .systemFont(ofSize: 13)
        w.textColor = PCTheme.sub
        let texts = UIStackView(arrangedSubviews: [t, w])
        texts.axis = .vertical
        texts.spacing = 2
        texts.translatesAutoresizingMaskIntoConstraints = false
        addSubview(texts)

        NSLayoutConstraint.activate([
            dot.widthAnchor.constraint(equalToConstant: 9),
            dot.heightAnchor.constraint(equalToConstant: 9),
            dot.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 18),
            dot.centerYAnchor.constraint(equalTo: t.firstBaselineAnchor, constant: -5),
            line.widthAnchor.constraint(equalToConstant: 1.5),
            line.centerXAnchor.constraint(equalTo: dot.centerXAnchor),
            line.topAnchor.constraint(equalTo: first ? dot.centerYAnchor : topAnchor),
            line.bottomAnchor.constraint(equalTo: last ? dot.centerYAnchor : bottomAnchor),
            texts.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 42),
            texts.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            texts.topAnchor.constraint(equalTo: topAnchor, constant: 11),
            texts.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -11),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

/// Bouton rond « … » en verre avec menu (haut de page, comme dans l'app Shopify).
@available(iOS 26.0, *)
final class ODMoreButton: UIVisualEffectView {
    let button = UIButton(type: .system)

    init() {
        let effect = UIGlassEffect()
        effect.isInteractive = true
        super.init(effect: effect)
        cornerConfiguration = .capsule()
        translatesAutoresizingMaskIntoConstraints = false
        button.setImage(PCTheme.symbol("ellipsis", 18, .bold), for: .normal)
        button.tintColor = PCTheme.ink
        button.showsMenuAsPrimaryAction = true
        button.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(button)
        NSLayoutConstraint.activate([
            widthAnchor.constraint(equalToConstant: 44),
            heightAnchor.constraint(equalToConstant: 44),
            button.leadingAnchor.constraint(equalTo: leadingAnchor),
            button.trailingAnchor.constraint(equalTo: trailingAnchor),
            button.topAnchor.constraint(equalTo: topAnchor),
            button.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

/// Carte client : nom en bleu, nombre de commandes, e-mail en bleu + bouton copier.
@available(iOS 26.0, *)
final class ODClientCard: UIView {
    let nameButton = UIButton(type: .system)
    let copyButton = UIButton(type: .system)

    init(name: String, sub: String, email: String, phone: String) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        nameButton.setTitle(name, for: .normal)
        nameButton.titleLabel?.font = .systemFont(ofSize: 16)
        nameButton.setTitleColor(PCTheme.blue, for: .normal)
        nameButton.contentHorizontalAlignment = .leading
        let subLabel = UILabel()
        subLabel.text = sub
        subLabel.font = .systemFont(ofSize: 16)
        subLabel.textColor = PCTheme.ink
        let mail = UILabel()
        mail.text = email
        mail.font = .systemFont(ofSize: 16)
        mail.textColor = PCTheme.blue
        mail.isHidden = email.isEmpty
        let tel = UILabel()
        tel.text = phone
        tel.font = .systemFont(ofSize: 16)
        tel.textColor = PCTheme.ink
        tel.isHidden = phone.isEmpty

        copyButton.setImage(PCTheme.symbol("doc.on.clipboard", 17, .regular), for: .normal)
        copyButton.tintColor = PCTheme.ink
        copyButton.isHidden = email.isEmpty
        copyButton.setContentHuggingPriority(.required, for: .horizontal)
        copyButton.widthAnchor.constraint(equalToConstant: 34).isActive = true
        copyButton.heightAnchor.constraint(equalToConstant: 30).isActive = true

        let mailRow = UIStackView(arrangedSubviews: [mail, UIView(), copyButton])
        mailRow.alignment = .center
        let col = UIStackView(arrangedSubviews: [nameButton, subLabel, tel, mailRow])
        col.axis = .vertical
        col.spacing = 4
        col.translatesAutoresizingMaskIntoConstraints = false
        addSubview(col)
        NSLayoutConstraint.activate([
            col.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            col.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            col.topAnchor.constraint(equalTo: topAnchor, constant: 12),
            col.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -10),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

// MARK: - Feuille « Traiter les articles »

@available(iOS 26.0, *)
final class ODFulfillSheet: PCSheetBase {
    private let trackField = UITextField()
    private let notify = UISwitch()
    private let labels: [String: String]
    private let carrier: String
    private let items: [[String: Any]]
    var onFulfill: ((String, String) -> Void)?

    init(labels: [String: String], carrier: String, items: [[String: Any]]) {
        self.labels = labels
        self.carrier = carrier
        self.items = items
        super.init(title: labels["Fulfill items"] ?? "Fulfill items", detents: [.medium(), .large()])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = PCTheme.bg

        var rows: [UIView] = []
        for it in items {
            rows.append(ODItemRow(
                title: (it["title"] as? String) ?? "",
                variant: (it["variant"] as? String) ?? "",
                price: (it["price"] as? String) ?? "",
                qty: (it["qty"] as? NSNumber)?.intValue ?? 1,
                img: (it["img"] as? String) ?? ""
            ))
        }
        if !rows.isEmpty { rows.append(ODSeparator()) }

        trackField.placeholder = labels["Add tracking number"] ?? "Add tracking number"
        trackField.font = .systemFont(ofSize: 16)
        trackField.textColor = PCTheme.ink
        trackField.keyboardType = .numbersAndPunctuation
        trackField.autocorrectionType = .no
        trackField.returnKeyType = .done
        trackField.addAction(UIAction { [weak self] _ in self?.trackField.resignFirstResponder() }, for: .editingDidEndOnExit)
        let trackWrap = UIView()
        trackField.translatesAutoresizingMaskIntoConstraints = false
        trackWrap.addSubview(trackField)
        NSLayoutConstraint.activate([
            trackField.leadingAnchor.constraint(equalTo: trackWrap.leadingAnchor, constant: 16),
            trackField.trailingAnchor.constraint(equalTo: trackWrap.trailingAnchor, constant: -16),
            trackField.topAnchor.constraint(equalTo: trackWrap.topAnchor, constant: 15),
            trackField.bottomAnchor.constraint(equalTo: trackWrap.bottomAnchor, constant: -15),
        ])
        rows.append(trackWrap)
        rows.append(ODSeparator())
        rows.append(ODKVRow(label: labels["Shipping carrier"] ?? "Shipping carrier", value: carrier))
        rows.append(ODSeparator())

        notify.isOn = true
        notify.onTintColor = PCTheme.ink
        let nLabel = UILabel()
        nLabel.text = labels["Send shipment details to your customer now"] ?? "Send shipment details to your customer now"
        nLabel.font = .systemFont(ofSize: 15)
        nLabel.textColor = PCTheme.ink
        nLabel.numberOfLines = 0
        let nRow = UIStackView(arrangedSubviews: [nLabel, notify])
        nRow.alignment = .center
        nRow.spacing = 12
        nRow.isLayoutMarginsRelativeArrangement = true
        nRow.layoutMargins = UIEdgeInsets(top: 10, left: 16, bottom: 10, right: 16)
        rows.append(nRow)

        let card = PCDetailCard(rows: rows)
        card.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(card)

        let go = PCGlassButton(title: labels["Fulfill items"] ?? "Fulfill items", tint: PCTheme.ink, foreground: .white, height: 50)
        go.setContentHuggingPriority(.defaultLow, for: .horizontal)
        go.onTap = { [weak self] in
            guard let self else { return }
            self.view.endEditing(true)
            self.onFulfill?(self.trackField.text ?? "", self.carrier)
            self.dismiss(animated: true)
        }
        view.addSubview(go)

        NSLayoutConstraint.activate([
            card.topAnchor.constraint(equalTo: header.bottomAnchor, constant: 16),
            card.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 12),
            card.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -12),
            go.topAnchor.constraint(equalTo: card.bottomAnchor, constant: 16),
            go.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            go.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
        ])
    }
}

// MARK: - Page commande

@available(iOS 26.0, *)
final class OrderDetailViewController: UIViewController, UIScrollViewDelegate, UIGestureRecognizerDelegate {
    /// Action vers la page web : { n, act: fulfill | capture | markpaid | customer, trk?, carrier?, idx? }.
    var onAct: (([String: Any]) -> Void)?
    var onClose: (() -> Void)?

    private let pageBg = UIColor(white: 0.992, alpha: 1)
    private var info: [String: Any]

    private let scroll = UIScrollView()
    private let content = UIStackView()
    private let topFade = UIView()
    private let fadeLayer = CAGradientLayer()
    private let backButton = PCGlassButton(symbol: "chevron.left", circle: true)
    private let moreButton = ODMoreButton()
    private let barTitle = UILabel()
    private let titleWrap = UIView()
    private var titleShown = false
    private var didSetInitialOffset = false
    private var toastView: UIView?

    init(info: [String: Any]) {
        self.info = info
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    // MARK: Accès aux données

    private var orderNumber: Int { (info["n"] as? NSNumber)?.intValue ?? 0 }
    private func str(_ key: String) -> String { (info[key] as? String) ?? "" }
    private func lb(_ key: String) -> String { ((info["lb"] as? [String: String]) ?? [:])[key] ?? key }
    private func list(_ key: String) -> [[String: Any]] { (info[key] as? [[String: Any]]) ?? [] }
    private func flag(_ key: String) -> Bool { (info[key] as? NSNumber)?.boolValue ?? false }
    private func labels() -> [String: String] { (info["lb"] as? [String: String]) ?? [:] }

    // MARK: Cycle de vie

    override func viewDidLoad() {
        super.viewDidLoad()
        overrideUserInterfaceStyle = .light
        view.backgroundColor = pageBg
        buildScroll()
        buildTopBar()
        rebuild()

        let edge = UIScreenEdgePanGestureRecognizer(target: self, action: #selector(edgePan(_:)))
        edge.edges = .left
        edge.delegate = self
        view.addGestureRecognizer(edge)
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let top = view.safeAreaInsets.top + 62
        if abs(scroll.contentInset.top - top) > 0.5 {
            scroll.contentInset.top = top
            scroll.verticalScrollIndicatorInsets.top = top
        }
        if !didSetInitialOffset && view.safeAreaInsets.top > 0 {
            didSetInitialOffset = true
            scroll.contentOffset = CGPoint(x: 0, y: -top)
        }
        topFade.frame = CGRect(x: 0, y: 0, width: view.bounds.width, height: view.safeAreaInsets.top + 58)
        fadeLayer.frame = topFade.bounds
    }

    func slideIn() {
        view.transform = CGAffineTransform(translationX: view.bounds.width, y: 0)
        UIView.animate(withDuration: 0.34, delay: 0, options: [.curveEaseOut]) {
            self.view.transform = .identity
        }
    }

    func closeAnimated() {
        view.endEditing(true)
        UIView.animate(withDuration: 0.28, delay: 0, options: [.curveEaseOut], animations: {
            self.view.transform = CGAffineTransform(translationX: self.view.bounds.width, y: 0)
        }, completion: { _ in
            self.onClose?()
        })
    }

    /// Nouvelles données après une action (traitée, payée…) : on reconstruit la page et on affiche le toast.
    func update(info newInfo: [String: Any]) {
        info = newInfo
        rebuild()
        if let t = newInfo["toast"] as? String, !t.isEmpty {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            showToast(t)
        }
    }

    // MARK: Construction

    private func buildScroll() {
        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.alwaysBounceVertical = true
        scroll.contentInsetAdjustmentBehavior = .never
        scroll.showsVerticalScrollIndicator = true
        scroll.delegate = self
        scroll.contentInset.bottom = 120
        scroll.verticalScrollIndicatorInsets.bottom = 100
        view.addSubview(scroll)

        content.axis = .vertical
        content.spacing = 10
        content.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(content)
        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: view.topAnchor),
            scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            content.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor),
            content.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor, constant: -8),
            content.leadingAnchor.constraint(equalTo: scroll.frameLayoutGuide.leadingAnchor, constant: 12),
            content.trailingAnchor.constraint(equalTo: scroll.frameLayoutGuide.trailingAnchor, constant: -12),
        ])
    }

    private func buildTopBar() {
        topFade.isUserInteractionEnabled = false
        fadeLayer.colors = [pageBg.withAlphaComponent(0.96).cgColor, pageBg.withAlphaComponent(0).cgColor]
        topFade.layer.addSublayer(fadeLayer)
        view.addSubview(topFade)

        backButton.onTap = { [weak self] in self?.closeAnimated() }

        barTitle.font = .systemFont(ofSize: 17, weight: .semibold)
        barTitle.textColor = PCTheme.ink
        barTitle.textAlignment = .center
        barTitle.alpha = 0
        barTitle.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(barTitle)
        view.addSubview(backButton)
        view.addSubview(moreButton)
        let guide = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            backButton.topAnchor.constraint(equalTo: guide.topAnchor, constant: 6),
            backButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            moreButton.topAnchor.constraint(equalTo: guide.topAnchor, constant: 6),
            moreButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            barTitle.centerYAnchor.constraint(equalTo: backButton.centerYAnchor),
            barTitle.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            barTitle.leadingAnchor.constraint(greaterThanOrEqualTo: backButton.trailingAnchor, constant: 12),
            barTitle.trailingAnchor.constraint(lessThanOrEqualTo: moreButton.leadingAnchor, constant: -12),
        ])
    }

    private func makeMoreMenu() -> UIMenu {
        func item(_ key: String, _ symbol: String) -> UIAction {
            UIAction(title: lb(key), image: UIImage(systemName: symbol)) { [weak self] _ in
                self?.showToast(self?.lb(key) ?? key)
            }
        }
        return UIMenu(children: [
            item("Edit order", "square.and.pencil"),
            item("Refund", "arrow.uturn.backward"),
            item("Print packing slip", "printer"),
            item("Archive", "archivebox"),
        ])
    }

    private func moreMenuButton() -> UIButton {
        let b = UIButton(type: .system)
        b.setImage(PCTheme.symbol("ellipsis", 17, .bold), for: .normal)
        b.tintColor = PCTheme.ink
        b.showsMenuAsPrimaryAction = true
        b.menu = makeMoreMenu()
        b.translatesAutoresizingMaskIntoConstraints = false
        b.widthAnchor.constraint(equalToConstant: 36).isActive = true
        b.heightAnchor.constraint(equalToConstant: 30).isActive = true
        return b
    }

    private func header(_ title: String, count: Int? = nil, more: Bool = false) -> UIView {
        let label = UILabel()
        label.text = title
        label.font = .systemFont(ofSize: 17, weight: .bold)
        label.textColor = PCTheme.ink
        label.numberOfLines = 0
        let stack = UIStackView(arrangedSubviews: [label])
        stack.axis = .horizontal
        stack.alignment = .center
        stack.spacing = 8
        stack.isLayoutMarginsRelativeArrangement = true
        stack.layoutMargins = UIEdgeInsets(top: 0, left: 15, bottom: 0, right: more ? 6 : 15)
        if let count {
            let c = UILabel()
            c.text = "\(count)"
            c.font = .systemFont(ofSize: 16, weight: .semibold)
            c.textColor = UIColor(white: 0.55, alpha: 1)
            c.setContentHuggingPriority(.required, for: .horizontal)
            stack.addArrangedSubview(c)
        }
        stack.addArrangedSubview(UIView())
        if more { stack.addArrangedSubview(moreMenuButton()) }
        return stack
    }

    private func addHeader(_ title: String, count: Int? = nil, more: Bool = false) {
        if let last = content.arrangedSubviews.last { content.setCustomSpacing(22, after: last) }
        content.addArrangedSubview(header(title, count: count, more: more))
    }

    /// Bouton principal (noir, en verre) ou secondaire (verre clair).
    private func primaryButton(_ title: String, disables: Bool = true, _ handler: @escaping () -> Void) -> PCGlassButton {
        let b = PCGlassButton(title: title, tint: PCTheme.ink, foreground: .white, height: 50)
        b.onTap = { [weak b] in
            if disables { b?.isEnabled = false }   // la page est reconstruite dès que la réponse arrive
            handler()
        }
        return b
    }

    private func secondaryButton(_ title: String, symbol: String? = nil, _ handler: @escaping () -> Void) -> PCGlassButton {
        let b = PCGlassButton(title: title, symbol: symbol, tint: UIColor(white: 0.93, alpha: 1), height: 46)
        b.onTap = handler
        return b
    }

    private func rebuild() {
        for v in content.arrangedSubviews {
            content.removeArrangedSubview(v)
            v.removeFromSuperview()
        }
        moreButton.button.menu = makeMoreMenu()
        barTitle.text = str("title")

        // En-tête : « #1017 » + pastilles de statut, puis la ligne de date / canal.
        let title = UILabel()
        title.text = str("title")
        title.font = .systemFont(ofSize: 30, weight: .bold)
        title.textColor = PCTheme.ink
        title.setContentHuggingPriority(.required, for: .horizontal)
        title.setContentCompressionResistancePriority(.required, for: .horizontal)
        let line = UIStackView(arrangedSubviews: [
            title,
            ODBadge(text: str("ful"), kind: str("fulKind")),
            ODBadge(text: str("pay"), kind: str("payKind")),
            UIView(),
        ])
        line.alignment = .center
        line.spacing = 8
        let sub = UILabel()
        sub.text = str("sub")
        sub.font = .systemFont(ofSize: 14)
        sub.textColor = PCTheme.sub
        sub.numberOfLines = 0
        let head = UIStackView(arrangedSubviews: [line, sub])
        head.axis = .vertical
        head.spacing = 4
        head.isLayoutMarginsRelativeArrangement = true
        head.layoutMargins = UIEdgeInsets(top: 4, left: 15, bottom: 2, right: 15)
        titleWrap.subviews.forEach { $0.removeFromSuperview() }
        head.translatesAutoresizingMaskIntoConstraints = false
        titleWrap.addSubview(head)
        NSLayoutConstraint.activate([
            head.leadingAnchor.constraint(equalTo: titleWrap.leadingAnchor),
            head.trailingAnchor.constraint(equalTo: titleWrap.trailingAnchor),
            head.topAnchor.constraint(equalTo: titleWrap.topAnchor),
            head.bottomAnchor.constraint(equalTo: titleWrap.bottomAnchor),
        ])
        content.addArrangedSubview(titleWrap)

        buildCustomer()
        buildAddress()
        buildItems()
        buildPayment()
        buildNotes()
        buildConversion()
        buildRisk()
        buildTimeline()
    }

    private func buildCustomer() {
        addHeader(lb("Customer"), more: true)
        guard let c = info["customer"] as? [String: Any] else {
            let row = PCDRow(symbol: nil, title: lb("No customer"), chevron: false)
            row.titleLabel.textColor = PCTheme.sub
            content.addArrangedSubview(PCDetailCard(rows: [row]))
            return
        }
        let card = ODClientCard(
            name: (c["name"] as? String) ?? "",
            sub: (c["sub"] as? String) ?? "",
            email: str("email"),
            phone: str("phone")
        )
        let idx = (c["idx"] as? NSNumber)?.intValue ?? -1
        card.nameButton.addAction(UIAction { [weak self] _ in
            PCTheme.haptic()
            self?.send(["act": "customer", "idx": idx])
        }, for: .touchUpInside)
        card.copyButton.addAction(UIAction { [weak self] _ in
            guard let self else { return }
            UIPasteboard.general.string = self.str("email")
            PCTheme.haptic()
            self.showToast(self.lb("Copied"))
        }, for: .touchUpInside)
        content.addArrangedSubview(PCDetailCard(rows: [card]))
    }

    private func buildAddress() {
        addHeader(lb("Shipping and billing address"), more: true)
        let lines = (info["addr"] as? [String]) ?? []
        let address = ODAddressRow(title: "", lines: lines)
        address.copyButton.addAction(UIAction { [weak self] _ in
            guard let self else { return }
            UIPasteboard.general.string = lines.joined(separator: "\n")
            PCTheme.haptic()
            self.showToast(self.lb("Copied"))
        }, for: .touchUpInside)
        content.addArrangedSubview(PCDetailCard(rows: [address]))
    }

    private func buildItems() {
        let n = (info["unitsCount"] as? NSNumber)?.intValue ?? 0
        addHeader(lb("Products"), count: n, more: true)

        var rows: [UIView] = []
        let shipSub = UILabel()
        shipSub.text = str("shipSub")
        shipSub.font = .systemFont(ofSize: 15)
        shipSub.textColor = PCTheme.sub
        shipSub.numberOfLines = 0
        let shipWrap = UIStackView(arrangedSubviews: [shipSub])
        shipWrap.isLayoutMarginsRelativeArrangement = true
        shipWrap.layoutMargins = UIEdgeInsets(top: 14, left: 16, bottom: 4, right: 16)
        rows.append(shipWrap)

        for it in list("items") {
            rows.append(ODItemRow(
                title: (it["title"] as? String) ?? "",
                variant: (it["variant"] as? String) ?? "",
                price: (it["price"] as? String) ?? "",
                qty: (it["qty"] as? NSNumber)?.intValue ?? 1,
                img: (it["img"] as? String) ?? ""
            ))
        }

        if flag("fulfilled") {
            rows.append(ODSeparator())
            let truck = PCDRow(symbol: "box.truck", title: str("carrier"), bold: true, chevron: false)
            truck.setSub(str("trk"))
            rows.append(truck)
            rows.append(ODButtonRow(button: secondaryButton(lb("Track"), symbol: "location") { [weak self] in
                guard let self else { return }
                self.showToast(self.lb("Track"))
            }))
        } else {
            rows.append(ODButtonRow(button: primaryButton(lb("Fulfill items"), disables: false) { [weak self] in self?.openFulfill() }))
        }
        content.addArrangedSubview(PCDetailCard(rows: rows))
    }

    private func buildPayment() {
        addHeader(lb("Payment"), more: true)
        var rows: [UIView] = []
        func add(_ v: UIView) {
            if !rows.isEmpty { rows.append(ODSeparator()) }
            rows.append(v)
        }
        for l in list("lines") {
            add(ODKVRow(label: (l["l"] as? String) ?? "", sub: (l["s"] as? String) ?? "", value: (l["v"] as? String) ?? ""))
        }
        add(ODKVRow(label: lb("Total"), value: str("total"), bold: true))
        for l in list("paid") {
            add(ODKVRow(label: (l["l"] as? String) ?? "", value: (l["v"] as? String) ?? ""))
        }
        content.addArrangedSubview(PCDetailCard(rows: rows, inset: 2))

        // Gros bouton noir sous la carte, comme « Marquer comme payé » dans l'app Shopify.
        if flag("canCapture") {
            content.addArrangedSubview(ODButtonRow(button: primaryButton(lb("Capture payment")) { [weak self] in
                self?.send(["act": "capture"])
            }, inset: 0, top: 2, bottom: 0))
        } else if flag("canMarkPaid") {
            content.addArrangedSubview(ODButtonRow(button: primaryButton(lb("Mark as paid")) { [weak self] in
                self?.send(["act": "markpaid"])
            }, inset: 0, top: 2, bottom: 0))
        }
    }

    private func buildNotes() {
        let note = str("note")
        let row = PCDRow(symbol: "note.text", title: lb("Notes"), bold: true)
        row.setSub(note.isEmpty ? str("noEmptyNote") : note)
        if let c = content.arrangedSubviews.last { content.setCustomSpacing(18, after: c) }
        content.addArrangedSubview(PCDetailCard(rows: [row], inset: 4))
    }

    private func buildConversion() {
        addHeader(lb("Conversion summary"))
        let symbols = ["cart": "cart", "globe": "globe", "clock": "clock"]
        let rows: [UIView] = list("conv").map { c in
            PCDRow(symbol: symbols[(c["i"] as? String) ?? ""] ?? "circle", title: (c["t"] as? String) ?? "", chevron: false)
        }
        content.addArrangedSubview(PCDetailCard(rows: rows, inset: 4))
    }

    private func buildRisk() {
        addHeader(lb("Order risk"))
        content.addArrangedSubview(PCDetailCard(rows: [ODRiskRow(level: str("risk"), label: str("riskLabel"))]))
    }

    private func buildTimeline() {
        addHeader(lb("Timeline"))
        let events = list("timeline")
        var rows: [UIView] = []
        for (i, e) in events.enumerated() {
            rows.append(ODTimelineRow(
                text: (e["text"] as? String) ?? "",
                when: (e["when"] as? String) ?? "",
                first: i == 0,
                last: i == events.count - 1
            ))
        }
        content.addArrangedSubview(PCDetailCard(rows: rows, inset: 2))
    }

    // MARK: Actions

    private func send(_ payload: [String: Any]) {
        var p = payload
        p["n"] = orderNumber
        onAct?(p)
    }

    private func openFulfill() {
        view.endEditing(true)
        let sheet = ODFulfillSheet(labels: labels(), carrier: str("defaultCarrier"), items: list("items"))
        sheet.onFulfill = { [weak self] trk, carrier in
            self?.send(["act": "fulfill", "trk": trk, "carrier": carrier])
        }
        present(sheet, animated: true)
    }

    private func showToast(_ text: String) {
        toastView?.removeFromSuperview()
        let pill = UIVisualEffectView(effect: UIGlassEffect())
        pill.cornerConfiguration = .capsule()
        pill.translatesAutoresizingMaskIntoConstraints = false
        let label = UILabel()
        label.text = text
        label.font = .systemFont(ofSize: 15, weight: .semibold)
        label.textColor = PCTheme.ink
        label.translatesAutoresizingMaskIntoConstraints = false
        pill.contentView.addSubview(label)
        view.addSubview(pill)
        NSLayoutConstraint.activate([
            label.leadingAnchor.constraint(equalTo: pill.leadingAnchor, constant: 18),
            label.trailingAnchor.constraint(equalTo: pill.trailingAnchor, constant: -18),
            label.topAnchor.constraint(equalTo: pill.topAnchor, constant: 11),
            label.bottomAnchor.constraint(equalTo: pill.bottomAnchor, constant: -11),
            pill.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            pill.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -92),
            pill.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 20),
            pill.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -20),
        ])
        pill.alpha = 0
        toastView = pill
        UIView.animate(withDuration: 0.2) { pill.alpha = 1 }
        UIView.animate(withDuration: 0.3, delay: 1.7, options: [], animations: { pill.alpha = 0 }, completion: { [weak self, weak pill] _ in
            pill?.removeFromSuperview()
            if self?.toastView === pill { self?.toastView = nil }
        })
    }

    // MARK: Défilement : le numéro apparaît dans la barre quand il sort de l'écran

    func scrollViewDidScroll(_ scrollView: UIScrollView) {
        let frame = titleWrap.convert(titleWrap.bounds, to: scroll)
        let barBottom = scroll.contentOffset.y + scroll.contentInset.top
        let show = barBottom > frame.midY
        guard show != titleShown else { return }
        titleShown = show
        UIView.animate(withDuration: 0.18, delay: 0, options: [.beginFromCurrentState]) {
            self.barTitle.alpha = show ? 1 : 0
        }
    }

    // MARK: Retour par glissement depuis le bord gauche

    @objc private func edgePan(_ g: UIScreenEdgePanGestureRecognizer) {
        let x = max(0, g.translation(in: view).x)
        switch g.state {
        case .changed:
            view.transform = CGAffineTransform(translationX: x, y: 0)
        case .ended, .cancelled:
            let fast = g.velocity(in: view).x > 600
            if g.state == .ended && (x > view.bounds.width * 0.33 || fast) {
                closeAnimated()
            } else {
                UIView.animate(withDuration: 0.25) { self.view.transform = .identity }
            }
        default:
            break
        }
    }

    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool {
        true
    }
}

#endif
