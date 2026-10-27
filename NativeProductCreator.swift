import UIKit

/// Création de produit 100 % native, calquée sur l'écran Shopify de la vidéo,
/// avec du vrai Liquid Glass Apple (UIGlassEffect, iOS 26+) pour les boutons,
/// les barres de recherche, le stepper de stock et les pastilles.
/// Sous iOS < 26 (ou SDK plus ancien) rien n'est compilé / affiché : la page web garde son formulaire.
#if compiler(>=6.2)

private func tr(_ fr: String, _ en: String) -> String {
    (Locale.preferredLanguages.first ?? "en").hasPrefix("fr") ? fr : en
}

@available(iOS 26.0, *)
enum PCTheme {
    static let bg = UIColor(white: 0.945, alpha: 1)
    static let card = UIColor.white
    static let ink = UIColor(white: 0.07, alpha: 1)
    static let sub = UIColor(white: 0.42, alpha: 1)
    static let line = UIColor(white: 0, alpha: 0.08)
    static let blue = UIColor(red: 0.0, green: 0.36, blue: 0.84, alpha: 1)
    static let banner = UIColor(red: 0.76, green: 0.91, blue: 0.98, alpha: 1)
    static let okBg = UIColor(red: 0.69, green: 0.95, blue: 0.62, alpha: 1)
    static let okFg = UIColor(red: 0.07, green: 0.33, blue: 0.10, alpha: 1)

    static func haptic() { UIImpactFeedbackGenerator(style: .light).impactOccurred() }

    static func symbol(_ name: String, _ size: CGFloat = 16, _ weight: UIImage.SymbolWeight = .semibold) -> UIImage? {
        UIImage(systemName: name, withConfiguration: UIImage.SymbolConfiguration(pointSize: size, weight: weight))
    }
}

// MARK: - Briques Liquid Glass

/// Bouton en verre (capsule ou rond).
@available(iOS 26.0, *)
final class PCGlassButton: UIVisualEffectView {
    private let button = UIButton(type: .system)
    var onTap: (() -> Void)?
    var isEnabled: Bool = true {
        didSet { button.isEnabled = isEnabled; contentView.alpha = isEnabled ? 1 : 0.4 }
    }

    init(
        title: String? = nil, symbol: String? = nil, tint: UIColor? = nil,
        foreground: UIColor = PCTheme.ink, height: CGFloat = 44, circle: Bool = false,
        weight: UIFont.Weight = .semibold
    ) {
        let effect = UIGlassEffect()
        effect.isInteractive = true
        if let tint { effect.tintColor = tint }
        super.init(effect: effect)
        cornerConfiguration = .capsule()
        translatesAutoresizingMaskIntoConstraints = false
        setContentHuggingPriority(.required, for: .horizontal)

        var config = UIButton.Configuration.plain()
        config.baseForegroundColor = foreground
        config.contentInsets = .zero
        if let symbol { config.image = PCTheme.symbol(symbol) }
        if let title {
            var t = AttributedString(title)
            t.font = UIFont.systemFont(ofSize: 16, weight: weight)
            config.attributedTitle = t
            if symbol != nil { config.imagePadding = 6 }
        }
        button.configuration = config
        button.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(button)

        let pad: CGFloat = circle ? 0 : 18
        NSLayoutConstraint.activate([
            heightAnchor.constraint(equalToConstant: height),
            button.leadingAnchor.constraint(equalTo: leadingAnchor, constant: pad),
            button.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -pad),
            button.topAnchor.constraint(equalTo: topAnchor),
            button.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
        if circle { widthAnchor.constraint(equalToConstant: height).isActive = true }
        button.addAction(UIAction { [weak self] _ in
            PCTheme.haptic()
            self?.onTap?()
        }, for: .touchUpInside)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func setTitle(_ text: String) {
        var config = button.configuration
        var t = AttributedString(text)
        t.font = UIFont.systemFont(ofSize: 16, weight: .semibold)
        config?.attributedTitle = t
        button.configuration = config
    }
}

/// Barre de recherche en verre.
@available(iOS 26.0, *)
final class PCSearchField: UIVisualEffectView, UITextFieldDelegate {
    let field = UITextField()
    var onChange: ((String) -> Void)?
    var onSubmit: ((String) -> Void)?

    init(placeholder: String, trailing: [String] = []) {
        let effect = UIGlassEffect()
        effect.isInteractive = true
        super.init(effect: effect)
        cornerConfiguration = .capsule()
        translatesAutoresizingMaskIntoConstraints = false

        let glass = UIImageView(image: PCTheme.symbol("magnifyingglass", 15))
        glass.tintColor = PCTheme.sub
        glass.setContentHuggingPriority(.required, for: .horizontal)

        field.placeholder = placeholder
        field.font = .systemFont(ofSize: 16)
        field.textColor = PCTheme.ink
        field.returnKeyType = .done
        field.autocorrectionType = .no
        field.clearButtonMode = .whileEditing
        field.delegate = self
        field.addAction(UIAction { [weak self] _ in
            guard let self else { return }
            self.onChange?(self.field.text ?? "")
        }, for: .editingChanged)

        let stack = UIStackView(arrangedSubviews: [glass, field])
        stack.axis = .horizontal
        stack.alignment = .center
        stack.spacing = 8
        for name in trailing {
            let b = UIButton(type: .system)
            b.setImage(PCTheme.symbol(name, 16), for: .normal)
            b.tintColor = PCTheme.sub
            b.widthAnchor.constraint(equalToConstant: 30).isActive = true
            stack.addArrangedSubview(b)
        }
        stack.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(stack)
        NSLayoutConstraint.activate([
            heightAnchor.constraint(equalToConstant: 46),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            stack.topAnchor.constraint(equalTo: topAnchor),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        onSubmit?(textField.text ?? "")
        textField.resignFirstResponder()
        return true
    }
}

/// Stepper − 0 + en verre (stock).
@available(iOS 26.0, *)
final class PCStepper: UIVisualEffectView {
    private let label = UILabel()
    private(set) var value = 0
    var onChange: ((Int) -> Void)?

    init() {
        let effect = UIGlassEffect()
        effect.isInteractive = true
        super.init(effect: effect)
        cornerConfiguration = .capsule()
        translatesAutoresizingMaskIntoConstraints = false
        setContentHuggingPriority(.required, for: .horizontal)

        let minus = UIButton(type: .system)
        minus.setImage(PCTheme.symbol("minus", 15), for: .normal)
        let plus = UIButton(type: .system)
        plus.setImage(PCTheme.symbol("plus", 15), for: .normal)
        [minus, plus].forEach { $0.tintColor = PCTheme.ink; $0.widthAnchor.constraint(equalToConstant: 44).isActive = true }
        label.font = .monospacedDigitSystemFont(ofSize: 17, weight: .semibold)
        label.textAlignment = .center
        label.text = "0"
        label.widthAnchor.constraint(equalToConstant: 48).isActive = true
        minus.addAction(UIAction { [weak self] _ in self?.set((self?.value ?? 0) - 1) }, for: .touchUpInside)
        plus.addAction(UIAction { [weak self] _ in self?.set((self?.value ?? 0) + 1) }, for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [minus, label, plus])
        stack.alignment = .center
        stack.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(stack)
        NSLayoutConstraint.activate([
            heightAnchor.constraint(equalToConstant: 40),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor),
            stack.topAnchor.constraint(equalTo: topAnchor),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func set(_ v: Int) {
        value = max(0, v)
        label.text = "\(value)"
        PCTheme.haptic()
        onChange?(value)
    }
}

/// Pastille de statut (Actif / Brouillon) en verre teinté.
@available(iOS 26.0, *)
final class PCStatusPill: UIVisualEffectView {
    private let label = UILabel()

    init() {
        let effect = UIGlassEffect()
        super.init(effect: effect)
        cornerConfiguration = .capsule()
        translatesAutoresizingMaskIntoConstraints = false
        setContentHuggingPriority(.required, for: .horizontal)
        label.font = .systemFont(ofSize: 13, weight: .semibold)
        label.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(label)
        NSLayoutConstraint.activate([
            label.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            label.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            label.topAnchor.constraint(equalTo: topAnchor, constant: 5),
            label.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -5),
        ])
        setActive(true)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func setActive(_ on: Bool) {
        let e = UIGlassEffect()
        e.tintColor = on ? PCTheme.okBg : UIColor(white: 0.85, alpha: 1)
        effect = e
        label.text = on ? tr("Actif", "Active") : tr("Brouillon", "Draft")
        label.textColor = on ? PCTheme.okFg : PCTheme.ink
    }
}

// MARK: - Lignes et cartes

@available(iOS 26.0, *)
final class PCRow: UIControl {
    let titleLabel = UILabel()
    let valueLabel = UILabel()

    init(symbol: String?, title: String, value: String? = nil, chevron: Bool = true, accent: Bool = false) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false

        let stack = UIStackView()
        stack.axis = .horizontal
        stack.alignment = .center
        stack.spacing = 10
        stack.isUserInteractionEnabled = false
        stack.translatesAutoresizingMaskIntoConstraints = false

        if let symbol {
            let icon = UIImageView(image: PCTheme.symbol(symbol, 16, .regular))
            icon.tintColor = PCTheme.sub
            icon.setContentHuggingPriority(.required, for: .horizontal)
            stack.addArrangedSubview(icon)
        }
        titleLabel.text = title
        titleLabel.font = .systemFont(ofSize: 16, weight: accent ? .semibold : .regular)
        titleLabel.textColor = PCTheme.ink
        titleLabel.numberOfLines = 0
        stack.addArrangedSubview(titleLabel)

        valueLabel.font = .systemFont(ofSize: 15)
        valueLabel.textColor = PCTheme.sub
        valueLabel.textAlignment = .right
        valueLabel.text = value
        valueLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        stack.addArrangedSubview(valueLabel)

        if chevron {
            let c = UIImageView(image: PCTheme.symbol("chevron.right", 13))
            c.tintColor = UIColor(white: 0.6, alpha: 1)
            c.setContentHuggingPriority(.required, for: .horizontal)
            stack.addArrangedSubview(c)
        }
        addSubview(stack)
        NSLayoutConstraint.activate([
            heightAnchor.constraint(greaterThanOrEqualToConstant: 50),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 14),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -14),
            stack.topAnchor.constraint(equalTo: topAnchor, constant: 8),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8),
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

@available(iOS 26.0, *)
func pcCard(_ rows: [UIView]) -> UIView {
    let card = UIView()
    card.backgroundColor = PCTheme.card
    card.layer.cornerRadius = 18
    card.layer.cornerCurve = .continuous
    card.clipsToBounds = true
    let stack = UIStackView()
    stack.axis = .vertical
    stack.translatesAutoresizingMaskIntoConstraints = false
    for (i, row) in rows.enumerated() {
        if i > 0 {
            let sep = UIView()
            sep.backgroundColor = PCTheme.line
            sep.heightAnchor.constraint(equalToConstant: 0.5).isActive = true
            let wrap = UIView()
            sep.translatesAutoresizingMaskIntoConstraints = false
            wrap.addSubview(sep)
            NSLayoutConstraint.activate([
                sep.leadingAnchor.constraint(equalTo: wrap.leadingAnchor, constant: 14),
                sep.trailingAnchor.constraint(equalTo: wrap.trailingAnchor),
                sep.topAnchor.constraint(equalTo: wrap.topAnchor),
                sep.bottomAnchor.constraint(equalTo: wrap.bottomAnchor),
            ])
            stack.addArrangedSubview(wrap)
        }
        stack.addArrangedSubview(row)
    }
    card.addSubview(stack)
    NSLayoutConstraint.activate([
        stack.leadingAnchor.constraint(equalTo: card.leadingAnchor),
        stack.trailingAnchor.constraint(equalTo: card.trailingAnchor),
        stack.topAnchor.constraint(equalTo: card.topAnchor),
        stack.bottomAnchor.constraint(equalTo: card.bottomAnchor),
    ])
    return card
}

@available(iOS 26.0, *)
func pcSectionHeader(_ title: String, count: Int? = nil, action: PCGlassButton? = nil) -> UIView {
    let label = UILabel()
    label.text = title
    label.font = .systemFont(ofSize: 17, weight: .semibold)
    label.textColor = PCTheme.ink
    let stack = UIStackView(arrangedSubviews: [label])
    stack.axis = .horizontal
    stack.alignment = .center
    stack.spacing = 8
    if let count {
        let c = UILabel()
        c.text = "\(count)"
        c.font = .systemFont(ofSize: 15)
        c.textColor = PCTheme.sub
        stack.addArrangedSubview(c)
    }
    stack.addArrangedSubview(UIView())
    if let action { stack.addArrangedSubview(action) }
    return stack
}

// MARK: - Base des sous-feuilles (fermer · titre · actions)

@available(iOS 26.0, *)
class PCSheetBase: UIViewController {
    let sheetTitle: String
    let header = UIView()
    private let trailingStack = UIStackView()

    init(title: String, trailing: [UIView] = [], detents: [UISheetPresentationController.Detent] = [.medium(), .large()]) {
        sheetTitle = title
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .pageSheet
        if let sheet = sheetPresentationController {
            sheet.detents = detents
            sheet.prefersGrabberVisible = true
        }
        trailing.forEach { trailingStack.addArrangedSubview($0) }
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        overrideUserInterfaceStyle = .light
        view.backgroundColor = .white

        let close = PCGlassButton(symbol: "xmark", circle: true)
        close.onTap = { [weak self] in self?.dismiss(animated: true) }
        let title = UILabel()
        title.text = sheetTitle
        title.font = .systemFont(ofSize: 17, weight: .semibold)
        title.textColor = PCTheme.ink
        title.textAlignment = .center

        trailingStack.axis = .horizontal
        trailingStack.spacing = 8
        header.translatesAutoresizingMaskIntoConstraints = false
        close.translatesAutoresizingMaskIntoConstraints = false
        title.translatesAutoresizingMaskIntoConstraints = false
        trailingStack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(header)
        header.addSubview(close)
        header.addSubview(title)
        header.addSubview(trailingStack)
        NSLayoutConstraint.activate([
            header.topAnchor.constraint(equalTo: view.topAnchor, constant: 22),
            header.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            header.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            header.heightAnchor.constraint(equalToConstant: 44),
            close.leadingAnchor.constraint(equalTo: header.leadingAnchor),
            close.centerYAnchor.constraint(equalTo: header.centerYAnchor),
            title.centerXAnchor.constraint(equalTo: header.centerXAnchor),
            title.centerYAnchor.constraint(equalTo: header.centerYAnchor),
            trailingStack.trailingAnchor.constraint(equalTo: header.trailingAnchor),
            trailingStack.centerYAnchor.constraint(equalTo: header.centerYAnchor),
        ])
    }
}

// MARK: - Sous-feuille de recherche / sélection (Type, Fournisseur, Balises, Collections, Catégorie, Fichiers)

@available(iOS 26.0, *)
final class PCSearchSheet: PCSheetBase, UITableViewDataSource, UITableViewDelegate {
    struct Config {
        var title: String
        var placeholder: String
        var emptyTitle: String
        var emptySubtitle: String?
        var items: [String] = []
        var allowAdd = true
        var multi = false
        var headerIcons: [String] = []
        var searchIcons: [String] = []
        var detents: [UISheetPresentationController.Detent] = [.medium(), .large()]
    }

    private let config: Config
    private var items: [String]
    private var selected: [String]
    private var query = ""
    private let table = UITableView(frame: .zero, style: .plain)
    private let empty = UIStackView()
    private let emptyTitle = UILabel()
    private let emptySub = UILabel()
    var onChange: (([String]) -> Void)?

    init(config: Config, selected: [String]) {
        self.config = config
        self.items = config.items
        self.selected = selected
        for s in selected where !items.contains(s) { items.append(s) }
        let icons = config.headerIcons.map { name -> UIView in
            PCGlassButton(symbol: name, circle: true)
        }
        super.init(title: config.title, trailing: icons, detents: config.detents)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private var visible: [String] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        return q.isEmpty ? items : items.filter { $0.lowercased().contains(q) }
    }

    private var canAdd: Bool {
        let q = query.trimmingCharacters(in: .whitespaces)
        return config.allowAdd && !q.isEmpty && !items.contains { $0.caseInsensitiveCompare(q) == .orderedSame }
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        let search = PCSearchField(placeholder: config.placeholder, trailing: config.searchIcons)
        search.onChange = { [weak self] q in self?.query = q; self?.reload() }
        search.onSubmit = { [weak self] _ in if self?.canAdd == true { self?.addCurrent() } }

        table.dataSource = self
        table.delegate = self
        table.backgroundColor = .clear
        table.separatorInset = UIEdgeInsets(top: 0, left: 20, bottom: 0, right: 0)
        table.keyboardDismissMode = .onDrag
        table.translatesAutoresizingMaskIntoConstraints = false

        emptyTitle.font = .systemFont(ofSize: 17, weight: .bold)
        emptyTitle.textColor = PCTheme.ink
        emptyTitle.text = config.emptyTitle
        emptyTitle.textAlignment = .center
        emptySub.font = .systemFont(ofSize: 15)
        emptySub.textColor = PCTheme.sub
        emptySub.text = config.emptySubtitle
        emptySub.textAlignment = .center
        emptySub.numberOfLines = 0
        emptySub.isHidden = config.emptySubtitle == nil
        let icon = UIImageView(image: PCTheme.symbol("info.circle", 54, .regular))
        icon.tintColor = UIColor(white: 0.78, alpha: 1)
        empty.axis = .vertical
        empty.alignment = .center
        empty.spacing = 12
        [icon, emptyTitle, emptySub].forEach { empty.addArrangedSubview($0) }
        empty.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(search)
        view.addSubview(table)
        view.addSubview(empty)
        NSLayoutConstraint.activate([
            search.topAnchor.constraint(equalTo: header.bottomAnchor, constant: 14),
            search.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            search.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            table.topAnchor.constraint(equalTo: search.bottomAnchor, constant: 8),
            table.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            table.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            table.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor),
            empty.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            empty.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: 20),
            empty.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 40),
            empty.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -40),
        ])
        reload()
    }

    private func reload() {
        table.reloadData()
        empty.isHidden = !(visible.isEmpty && !canAdd)
    }

    private func addCurrent() {
        let q = query.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return }
        items.append(q)
        pick(q)
    }

    private func pick(_ value: String) {
        if config.multi {
            if let i = selected.firstIndex(of: value) { selected.remove(at: i) } else { selected.append(value) }
            onChange?(selected)
            reload()
        } else {
            selected = [value]
            onChange?(selected)
            dismiss(animated: true)
        }
    }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        visible.count + (canAdd ? 1 : 0)
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = UITableViewCell(style: .default, reuseIdentifier: nil)
        cell.backgroundColor = .clear
        var content = cell.defaultContentConfiguration()
        if canAdd && indexPath.row == visible.count {
            content.text = tr("Ajouter « \(query.trimmingCharacters(in: .whitespaces)) »", "Add “\(query.trimmingCharacters(in: .whitespaces))”")
            content.image = PCTheme.symbol("plus.circle", 17, .regular)
            content.textProperties.color = PCTheme.blue
            content.imageProperties.tintColor = PCTheme.blue
        } else {
            let value = visible[indexPath.row]
            content.text = value
            content.textProperties.color = PCTheme.ink
            cell.accessoryType = selected.contains(value) ? .checkmark : .none
            cell.tintColor = PCTheme.blue
        }
        cell.contentConfiguration = content
        return cell
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        PCTheme.haptic()
        if canAdd && indexPath.row == visible.count { addCurrent() } else { pick(visible[indexPath.row]) }
    }
}

// MARK: - Sous-feuille de texte (description, options de variantes)

@available(iOS 26.0, *)
final class PCTextSheet: PCSheetBase, UITextViewDelegate {
    private let textView = UITextView()
    private let placeholder: String
    private let placeholderLabel = UILabel()
    private var initial: String
    var onDone: ((String) -> Void)?

    init(title: String, placeholder: String, text: String) {
        self.placeholder = placeholder
        self.initial = text
        let ok = PCGlassButton(title: "OK", tint: PCTheme.ink, foreground: .white, height: 44)
        super.init(title: title, trailing: [ok], detents: [.medium(), .large()])
        ok.onTap = { [weak self] in
            guard let self else { return }
            self.onDone?(self.textView.text.trimmingCharacters(in: .whitespacesAndNewlines))
            self.dismiss(animated: true)
        }
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = PCTheme.bg
        let card = UIView()
        card.backgroundColor = .white
        card.layer.cornerRadius = 18
        card.layer.cornerCurve = .continuous
        card.translatesAutoresizingMaskIntoConstraints = false
        textView.text = initial
        textView.font = .systemFont(ofSize: 17)
        textView.textColor = PCTheme.ink
        textView.backgroundColor = .clear
        textView.textContainerInset = UIEdgeInsets(top: 14, left: 10, bottom: 14, right: 10)
        textView.delegate = self
        textView.translatesAutoresizingMaskIntoConstraints = false
        placeholderLabel.text = placeholder
        placeholderLabel.font = .systemFont(ofSize: 17)
        placeholderLabel.textColor = UIColor(white: 0.65, alpha: 1)
        placeholderLabel.isHidden = !initial.isEmpty
        placeholderLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(card)
        card.addSubview(textView)
        card.addSubview(placeholderLabel)
        NSLayoutConstraint.activate([
            card.topAnchor.constraint(equalTo: header.bottomAnchor, constant: 16),
            card.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            card.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            card.heightAnchor.constraint(greaterThanOrEqualToConstant: 150),
            textView.topAnchor.constraint(equalTo: card.topAnchor),
            textView.bottomAnchor.constraint(equalTo: card.bottomAnchor),
            textView.leadingAnchor.constraint(equalTo: card.leadingAnchor),
            textView.trailingAnchor.constraint(equalTo: card.trailingAnchor),
            placeholderLabel.topAnchor.constraint(equalTo: card.topAnchor, constant: 14),
            placeholderLabel.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 15),
        ])
        textView.becomeFirstResponder()
    }

    func textViewDidChange(_ textView: UITextView) {
        placeholderLabel.isHidden = !textView.text.isEmpty
    }
}

// MARK: - Sous-feuille Expédition (chargement puis réglages)

@available(iOS 26.0, *)
final class PCShippingSheet: PCSheetBase {
    private let spinner = UIActivityIndicatorView(style: .medium)
    private var physical: Bool
    private var fee: Double
    private let currency: String
    var onChange: ((Bool) -> Void)?
    var onFeeChange: ((Double) -> Void)?

    init(physical: Bool, fee: Double = 0, currency: String = "") {
        self.physical = physical
        self.fee = fee
        self.currency = currency.trimmingCharacters(in: .whitespaces)
        super.init(title: tr("Expédition et frais", "Shipping & fees"), detents: [.large()])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = PCTheme.bg
        spinner.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(spinner)
        NSLayoutConstraint.activate([
            spinner.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])
        spinner.startAnimating()
        let tap = UITapGestureRecognizer(target: view, action: #selector(UIView.endEditing(_:)))
        tap.cancelsTouchesInView = false
        view.addGestureRecognizer(tap)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) { [weak self] in self?.showContent() }
    }

    private func showContent() {
        spinner.stopAnimating()
        let label = UILabel()
        label.text = tr("Ce produit est physique", "This is a physical product")
        label.font = .systemFont(ofSize: 16)
        label.textColor = PCTheme.ink
        let toggle = UISwitch()
        toggle.isOn = physical
        toggle.onTintColor = PCTheme.blue
        toggle.addAction(UIAction { [weak self, weak toggle] _ in
            self?.physical = toggle?.isOn ?? true
            self?.onChange?(self?.physical ?? true)
        }, for: .valueChanged)
        let row = UIStackView(arrangedSubviews: [label, toggle])
        row.alignment = .center
        row.isLayoutMarginsRelativeArrangement = true
        row.layoutMargins = UIEdgeInsets(top: 10, left: 14, bottom: 10, right: 14)
        let card = pcCard([row])
        card.translatesAutoresizingMaskIntoConstraints = false
        card.alpha = 0
        view.addSubview(card)

        // Frais de service : montant ajouté à chaque unité vendue de ce produit.
        let feeLabel = UILabel()
        feeLabel.text = tr("Frais de service", "Service fee")
        feeLabel.font = .systemFont(ofSize: 16)
        feeLabel.textColor = PCTheme.ink
        feeLabel.setContentHuggingPriority(.required, for: .horizontal)
        let feeField = UITextField()
        feeField.font = .systemFont(ofSize: 16)
        feeField.textColor = PCTheme.ink
        feeField.textAlignment = .right
        feeField.keyboardType = .decimalPad
        feeField.placeholder = tr("0,00 \(currency)", "\(currency)0.00")
        if fee > 0 {
            let f = NumberFormatter()
            f.numberStyle = .decimal
            f.minimumFractionDigits = 2
            f.maximumFractionDigits = 2
            feeField.text = f.string(from: NSNumber(value: fee)) ?? "\(fee)"
        }
        feeField.addAction(UIAction { [weak self, weak feeField] _ in
            guard let self else { return }
            let raw = (feeField?.text ?? "").replacingOccurrences(of: ",", with: ".").filter { "0123456789.".contains($0) }
            self.fee = max(0, Double(raw) ?? 0)
            self.onFeeChange?(self.fee)
        }, for: .editingChanged)
        let cur = UILabel()
        cur.text = currency
        cur.font = .systemFont(ofSize: 16)
        cur.textColor = PCTheme.sub
        cur.setContentHuggingPriority(.required, for: .horizontal)
        let feeRow = UIStackView(arrangedSubviews: [feeLabel, feeField, cur])
        feeRow.alignment = .center
        feeRow.spacing = 8
        feeRow.isLayoutMarginsRelativeArrangement = true
        feeRow.layoutMargins = UIEdgeInsets(top: 14, left: 14, bottom: 14, right: 14)
        let feeCard = pcCard([feeRow])
        feeCard.translatesAutoresizingMaskIntoConstraints = false
        feeCard.alpha = 0
        view.addSubview(feeCard)

        let note = UILabel()
        note.text = tr("Ajoutés au prix de chaque unité vendue et affichés sur la commande.", "Added to each unit sold and shown on the order.")
        note.font = .systemFont(ofSize: 13)
        note.textColor = PCTheme.sub
        note.numberOfLines = 0
        note.translatesAutoresizingMaskIntoConstraints = false
        note.alpha = 0
        view.addSubview(note)

        NSLayoutConstraint.activate([
            card.topAnchor.constraint(equalTo: header.bottomAnchor, constant: 16),
            card.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            card.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            feeCard.topAnchor.constraint(equalTo: card.bottomAnchor, constant: 12),
            feeCard.leadingAnchor.constraint(equalTo: card.leadingAnchor),
            feeCard.trailingAnchor.constraint(equalTo: card.trailingAnchor),
            note.topAnchor.constraint(equalTo: feeCard.bottomAnchor, constant: 8),
            note.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 6),
            note.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -6),
        ])
        UIView.animate(withDuration: 0.25) { card.alpha = 1; feeCard.alpha = 1; note.alpha = 1 }
    }
}

// MARK: - Écran principal « Ajouter un produit »

@available(iOS 26.0, *)
final class ProductCreatorViewController: UIViewController {
    /// Appelé à l'enregistrement : title, desc, category, price, inv, vendor, type, status, tags, collections, vars, physical.
    var onSave: (([String: Any]) -> Void)?

    private let currency: String
    private var productTitle = ""
    private var desc = ""
    private var category = ""
    private var price: Double?
    private var inv = 0
    private var vendor: String
    private var type = ""
    private var isActive = true
    private var tags: [String] = []
    private var collections = [tr("Page d'accueil", "Home page")]
    private var variants = ""
    private var physical = true
    private var fee: Double = 0
    private var img = ""
    private var imgImage: UIImage?
    private let photoPicker = PCPhotoPicker()
    private let mediaIcon = UIImageView(image: PCTheme.symbol("photo", 26, .regular))
    private let mediaThumb = UIImageView()
    private let mediaLabel = UILabel()

    private let saveButton = PCGlassButton(title: tr("Enregistrer", "Save"), tint: PCTheme.ink, foreground: .white)
    private let statusPill = PCStatusPill()
    private let titleField = UITextField()
    private let priceField = UITextField()
    private let descRow = PCRow(symbol: "plus.circle", title: tr("Ajouter une description", "Add description"), accent: false)
    private let categoryRow = PCRow(symbol: "plus.circle", title: tr("Sélectionner une catégorie", "Select a category"))
    private let variantsRow = PCRow(symbol: "plus.circle", title: tr("Ajouter des options (couleur, taille,...)", "Add options (color, size,...)"))
    private let typeRow = PCRow(symbol: "tag", title: "Type")
    private let vendorRow = PCRow(symbol: "building.2", title: tr("Fournisseur", "Vendor"))
    private let collectionsRow = PCRow(symbol: "square.stack", title: "Collections")
    private let tagsRow = PCRow(symbol: "number", title: tr("Balises", "Tags"))
    private let scroll = UIScrollView()
    private let content = UIStackView()

    init(currencySymbol: String, vendor: String) {
        self.currency = currencySymbol.trimmingCharacters(in: .whitespaces)
        self.vendor = vendor.isEmpty ? tr("Ma boutique", "My store") : vendor
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .pageSheet
        if let sheet = sheetPresentationController {
            sheet.detents = [.large()]
            sheet.prefersGrabberVisible = true
        }
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        overrideUserInterfaceStyle = .light
        view.backgroundColor = PCTheme.bg
        buildTopBar()
        buildContent()
        refresh()
    }

    // Barre du haut : Annuler / Enregistrer en verre.
    private func buildTopBar() {
        let cancel = PCGlassButton(title: tr("Annuler", "Cancel"))
        cancel.onTap = { [weak self] in self?.dismiss(animated: true) }
        saveButton.isEnabled = false
        saveButton.onTap = { [weak self] in self?.save() }
        cancel.translatesAutoresizingMaskIntoConstraints = false
        saveButton.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(cancel)
        view.addSubview(saveButton)
        NSLayoutConstraint.activate([
            cancel.topAnchor.constraint(equalTo: view.topAnchor, constant: 22),
            cancel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            saveButton.topAnchor.constraint(equalTo: view.topAnchor, constant: 22),
            saveButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
        ])
        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.alwaysBounceVertical = true
        scroll.keyboardDismissMode = .interactive
        scroll.showsVerticalScrollIndicator = false
        view.addSubview(scroll)
        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: cancel.bottomAnchor, constant: 12),
            scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor),
        ])
    }

    private func buildContent() {
        content.axis = .vertical
        content.spacing = 14
        content.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(content)
        NSLayoutConstraint.activate([
            content.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor, constant: 4),
            content.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor, constant: -40),
            content.leadingAnchor.constraint(equalTo: scroll.frameLayoutGuide.leadingAnchor, constant: 16),
            content.trailingAnchor.constraint(equalTo: scroll.frameLayoutGuide.trailingAnchor, constant: -16),
        ])

        // Statut du produit (menu natif sur la ligne).
        let statusRow = PCRow(symbol: nil, title: tr("Statut du produit", "Product status"), chevron: true)
        statusRow.valueLabel.isHidden = true
        let statusStack = statusRow.subviews.compactMap { $0 as? UIStackView }.first
        if let statusStack, let chevron = statusStack.arrangedSubviews.last {
            statusStack.insertArrangedSubview(statusPill, at: statusStack.arrangedSubviews.firstIndex(of: chevron) ?? 0)
        }
        let menuButton = UIButton(type: .system)
        menuButton.showsMenuAsPrimaryAction = true
        menuButton.menu = UIMenu(children: [
            UIAction(title: tr("Actif", "Active")) { [weak self] _ in self?.isActive = true; self?.refresh() },
            UIAction(title: tr("Brouillon", "Draft")) { [weak self] _ in self?.isActive = false; self?.refresh() },
        ])
        menuButton.translatesAutoresizingMaskIntoConstraints = false
        statusRow.addSubview(menuButton)
        NSLayoutConstraint.activate([
            menuButton.topAnchor.constraint(equalTo: statusRow.topAnchor),
            menuButton.bottomAnchor.constraint(equalTo: statusRow.bottomAnchor),
            menuButton.leadingAnchor.constraint(equalTo: statusRow.leadingAnchor),
            menuButton.trailingAnchor.constraint(equalTo: statusRow.trailingAnchor),
        ])
        content.addArrangedSubview(pcCard([statusRow]))

        // Supports multimédias.
        content.addArrangedSubview(pcSectionHeader(tr("Supports multimédias", "Media")))
        content.addArrangedSubview(makeBanner())
        content.addArrangedSubview(makeMediaBlock())

        // Titre · description · catégorie · prix.
        titleField.placeholder = tr("Titre de produit", "Product title")
        titleField.font = .systemFont(ofSize: 17)
        titleField.textColor = PCTheme.ink
        titleField.returnKeyType = .done
        titleField.autocapitalizationType = .sentences
        titleField.addAction(UIAction { [weak self] _ in
            self?.productTitle = self?.titleField.text ?? ""
            self?.refresh()
        }, for: .editingChanged)
        titleField.addAction(UIAction { [weak self] _ in self?.titleField.resignFirstResponder() }, for: .editingDidEndOnExit)
        let titleWrap = UIView()
        titleField.translatesAutoresizingMaskIntoConstraints = false
        titleWrap.addSubview(titleField)
        NSLayoutConstraint.activate([
            titleField.leadingAnchor.constraint(equalTo: titleWrap.leadingAnchor, constant: 14),
            titleField.trailingAnchor.constraint(equalTo: titleWrap.trailingAnchor, constant: -14),
            titleField.topAnchor.constraint(equalTo: titleWrap.topAnchor, constant: 15),
            titleField.bottomAnchor.constraint(equalTo: titleWrap.bottomAnchor, constant: -15),
        ])

        priceField.placeholder = tr("0,00 \(currency)", "\(currency)0.00")
        priceField.font = .systemFont(ofSize: 16)
        priceField.textColor = PCTheme.ink
        priceField.keyboardType = .decimalPad
        priceField.addAction(UIAction { [weak self] _ in self?.priceEdited() }, for: .editingChanged)
        priceField.addAction(UIAction { [weak self] _ in self?.priceFormatted() }, for: .editingDidEnd)
        let priceWrap = UIView()
        priceField.translatesAutoresizingMaskIntoConstraints = false
        priceWrap.addSubview(priceField)
        NSLayoutConstraint.activate([
            priceField.leadingAnchor.constraint(equalTo: priceWrap.leadingAnchor, constant: 14),
            priceField.trailingAnchor.constraint(equalTo: priceWrap.trailingAnchor, constant: -14),
            priceField.topAnchor.constraint(equalTo: priceWrap.topAnchor, constant: 15),
            priceField.bottomAnchor.constraint(equalTo: priceWrap.bottomAnchor, constant: -15),
        ])

        descRow.onTap { [weak self] in self?.editDescription() }
        categoryRow.onTap { [weak self] in self?.pickCategory() }
        content.addArrangedSubview(pcCard([titleWrap, descRow, categoryRow, priceWrap]))

        // Publication.
        let modifyPub = PCGlassButton(title: tr("Modifier", "Edit"), foreground: PCTheme.blue, height: 34)
        content.addArrangedSubview(pcSectionHeader(tr("Publication", "Publishing"), count: 3, action: modifyPub))
        content.addArrangedSubview(pcCard([
            PCRow(symbol: "storefront", title: tr("Boutique en ligne, Shop, Point de vente", "Online Store, Shop, Point of Sale"), chevron: false),
            PCRow(symbol: "books.vertical", title: tr("Aucun catalogue", "No catalog"), chevron: false),
        ]))

        // Variantes.
        content.addArrangedSubview(pcSectionHeader(tr("Variantes", "Variants")))
        variantsRow.onTap { [weak self] in self?.editVariants() }
        content.addArrangedSubview(pcCard([variantsRow]))

        // Stock avec stepper en verre.
        let modifyStock = PCGlassButton(title: tr("Modifier", "Edit"), foreground: PCTheme.blue, height: 34)
        content.addArrangedSubview(pcSectionHeader("Stock", action: modifyStock))
        let stockLabel = UILabel()
        stockLabel.text = tr("Disponible", "Available")
        stockLabel.font = .systemFont(ofSize: 16)
        stockLabel.textColor = PCTheme.ink
        let stepper = PCStepper()
        stepper.onChange = { [weak self] v in self?.inv = v }
        let stockRow = UIStackView(arrangedSubviews: [stockLabel, UIView(), stepper])
        stockRow.alignment = .center
        stockRow.isLayoutMarginsRelativeArrangement = true
        stockRow.layoutMargins = UIEdgeInsets(top: 10, left: 14, bottom: 10, right: 10)
        content.addArrangedSubview(pcCard([stockRow]))

        // Expédition · Type · Fournisseur · Collections · Balises · SEO.
        let shippingRow = PCRow(symbol: "shippingbox", title: tr("Expédition et frais de service", "Shipping & service fee"))
        shippingRow.onTap { [weak self] in self?.openShipping() }
        typeRow.onTap { [weak self] in self?.pickType() }
        vendorRow.onTap { [weak self] in self?.pickVendor() }
        collectionsRow.onTap { [weak self] in self?.pickCollections() }
        tagsRow.onTap { [weak self] in self?.pickTags() }
        let seoRow = PCRow(symbol: "magnifyingglass", title: tr("Référencement naturel (SEO)", "Search engine listing (SEO)"))
        content.addArrangedSubview(pcCard([shippingRow, typeRow, vendorRow, collectionsRow, tagsRow, seoRow]))
    }

    private func makeBanner() -> UIView {
        let control = UIControl()
        control.backgroundColor = PCTheme.banner
        control.layer.cornerRadius = 14
        control.layer.cornerCurve = .continuous
        let thumb = UIImageView(image: PCTheme.symbol("shippingbox.fill", 18))
        thumb.tintColor = PCTheme.ink
        thumb.contentMode = .center
        thumb.backgroundColor = UIColor(white: 1, alpha: 0.6)
        thumb.layer.cornerRadius = 8
        thumb.clipsToBounds = true
        thumb.widthAnchor.constraint(equalToConstant: 34).isActive = true
        thumb.heightAnchor.constraint(equalToConstant: 34).isActive = true
        let label = UILabel()
        label.text = tr("Vous explorez simplement ? Ajoutez un exemple de produit.", "Just exploring? Add a sample product.")
        label.font = .systemFont(ofSize: 13, weight: .semibold)
        label.textColor = UIColor(red: 0.0, green: 0.2, blue: 0.3, alpha: 1)
        label.numberOfLines = 0
        let chevron = UIImageView(image: PCTheme.symbol("chevron.right", 13))
        chevron.tintColor = PCTheme.ink
        let stack = UIStackView(arrangedSubviews: [thumb, label, chevron])
        stack.alignment = .center
        stack.spacing = 10
        stack.isUserInteractionEnabled = false
        stack.translatesAutoresizingMaskIntoConstraints = false
        control.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: control.leadingAnchor, constant: 12),
            stack.trailingAnchor.constraint(equalTo: control.trailingAnchor, constant: -12),
            stack.topAnchor.constraint(equalTo: control.topAnchor, constant: 10),
            stack.bottomAnchor.constraint(equalTo: control.bottomAnchor, constant: -10),
        ])
        control.addAction(UIAction { [weak self] _ in
            PCTheme.haptic()
            self?.productTitle = tr("Exemple de produit", "Sample product")
            self?.titleField.text = self?.productTitle
            self?.price = 29
            self?.priceFormatted()
            self?.refresh()
        }, for: .touchUpInside)
        return control
    }

    private func makeMediaBlock() -> UIView {
        let box = UIView()
        box.backgroundColor = .white
        box.layer.cornerRadius = 20
        box.layer.cornerCurve = .continuous
        box.layer.shadowColor = UIColor.black.cgColor
        box.layer.shadowOpacity = 0.12
        box.layer.shadowRadius = 10
        box.layer.shadowOffset = CGSize(width: 0, height: 4)
        box.widthAnchor.constraint(equalToConstant: 72).isActive = true
        box.heightAnchor.constraint(equalToConstant: 72).isActive = true
        mediaIcon.tintColor = UIColor(white: 0.55, alpha: 1)
        mediaIcon.contentMode = .center
        mediaIcon.translatesAutoresizingMaskIntoConstraints = false
        mediaThumb.contentMode = .scaleAspectFill
        mediaThumb.clipsToBounds = true
        mediaThumb.layer.cornerRadius = 20
        mediaThumb.layer.cornerCurve = .continuous
        mediaThumb.isHidden = true
        mediaThumb.translatesAutoresizingMaskIntoConstraints = false
        box.addSubview(mediaIcon)
        box.addSubview(mediaThumb)
        for v in [mediaIcon, mediaThumb] {
            NSLayoutConstraint.activate([
                v.leadingAnchor.constraint(equalTo: box.leadingAnchor),
                v.trailingAnchor.constraint(equalTo: box.trailingAnchor),
                v.topAnchor.constraint(equalTo: box.topAnchor),
                v.bottomAnchor.constraint(equalTo: box.bottomAnchor),
            ])
        }
        mediaLabel.text = tr("Ajouter des images", "Add images")
        mediaLabel.font = .systemFont(ofSize: 15, weight: .medium)
        mediaLabel.textColor = PCTheme.ink
        let sub = UILabel()
        sub.text = tr("Choisissez un forfait pour ajouter d'autres types de supports multimédias.", "Choose a plan to add other types of media.")
        sub.font = .systemFont(ofSize: 15)
        sub.textColor = PCTheme.sub
        sub.textAlignment = .center
        sub.numberOfLines = 0
        let stack = UIStackView(arrangedSubviews: [box, mediaLabel, sub])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 10
        stack.isUserInteractionEnabled = false
        stack.translatesAutoresizingMaskIntoConstraints = false
        let control = UIControl()
        control.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: control.topAnchor, constant: 12),
            stack.bottomAnchor.constraint(equalTo: control.bottomAnchor, constant: -12),
            stack.leadingAnchor.constraint(equalTo: control.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: control.trailingAnchor, constant: -24),
        ])
        control.addAction(UIAction { [weak self] _ in PCTheme.haptic(); self?.mediaTapped() }, for: .touchUpInside)
        return control
    }

    // MARK: Actions

    private func refresh() {
        statusPill.setActive(isActive)
        saveButton.isEnabled = !productTitle.trimmingCharacters(in: .whitespaces).isEmpty
        descRow.titleLabel.text = desc.isEmpty ? tr("Ajouter une description", "Add description") : desc
        descRow.titleLabel.numberOfLines = 2
        categoryRow.titleLabel.text = category.isEmpty ? tr("Sélectionner une catégorie", "Select a category") : category
        variantsRow.titleLabel.text = variants.isEmpty ? tr("Ajouter des options (couleur, taille,...)", "Add options (color, size,...)") : variants
        typeRow.valueLabel.text = type
        vendorRow.valueLabel.text = vendor
        collectionsRow.valueLabel.text = collections.joined(separator: ", ")
        tagsRow.valueLabel.text = tags.joined(separator: ", ")
    }

    private func priceEdited() {
        let raw = (priceField.text ?? "").replacingOccurrences(of: ",", with: ".").filter { "0123456789.".contains($0) }
        price = Double(raw)
    }

    private func priceFormatted() {
        priceEdited()
        guard let price else { priceField.text = ""; return }
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.minimumFractionDigits = 2
        f.maximumFractionDigits = 2
        priceField.text = (f.string(from: NSNumber(value: price)) ?? "\(price)") + " " + currency
    }

    private func editDescription() {
        let sheet = PCTextSheet(title: "Description", placeholder: tr("Décrivez votre produit", "Describe your product"), text: desc)
        sheet.onDone = { [weak self] text in self?.desc = text; self?.refresh() }
        present(sheet, animated: true)
    }

    private func editVariants() {
        let sheet = PCTextSheet(
            title: tr("Variantes", "Variants"),
            placeholder: tr("Options séparées par des virgules : S, M, L", "Options separated by commas: S, M, L"),
            text: variants
        )
        sheet.onDone = { [weak self] text in self?.variants = text; self?.refresh() }
        present(sheet, animated: true)
    }

    private func pickCategory() {
        let sheet = PCSearchSheet(config: .init(
            title: tr("Catégorie", "Category"),
            placeholder: tr("Rechercher ou ajouter une catégorie", "Search or add a category"),
            emptyTitle: tr("Aucune catégorie trouvée", "No category found")
        ), selected: category.isEmpty ? [] : [category])
        sheet.onChange = { [weak self] v in self?.category = v.first ?? ""; self?.refresh() }
        present(sheet, animated: true)
    }

    private func pickType() {
        let sheet = PCSearchSheet(config: .init(
            title: "Type",
            placeholder: tr("Rechercher ou ajouter un type", "Search or add a type"),
            emptyTitle: tr("Aucun type trouvé", "No type found"),
            detents: [.large()]
        ), selected: type.isEmpty ? [] : [type])
        sheet.onChange = { [weak self] v in self?.type = v.first ?? ""; self?.refresh() }
        present(sheet, animated: true)
    }

    private func pickVendor() {
        let sheet = PCSearchSheet(config: .init(
            title: tr("Fournisseur", "Vendor"),
            placeholder: tr("Rechercher ou ajouter un fournisseur", "Search or add a vendor"),
            emptyTitle: tr("Aucun fournisseur trouvé", "No vendor found"),
            items: [vendor]
        ), selected: [vendor])
        sheet.onChange = { [weak self] v in if let first = v.first { self?.vendor = first }; self?.refresh() }
        present(sheet, animated: true)
    }

    private func pickCollections() {
        let sheet = PCSearchSheet(config: .init(
            title: "Collections",
            placeholder: tr("Rechercher des collections", "Search collections"),
            emptyTitle: tr("Aucune collection trouvée", "No collection found"),
            items: [tr("Page d'accueil", "Home page")],
            allowAdd: false,
            multi: true
        ), selected: collections)
        sheet.onChange = { [weak self] v in self?.collections = v; self?.refresh() }
        present(sheet, animated: true)
    }

    private func pickTags() {
        let sheet = PCSearchSheet(config: .init(
            title: tr("Balises", "Tags"),
            placeholder: tr("Rechercher ou ajouter des balises", "Search or add tags"),
            emptyTitle: tr("Aucune balise trouvée", "No tags found"),
            emptySubtitle: tr("Ajouter une nouvelle balise dans la barre de recherche", "Add a new tag in the search bar"),
            multi: true,
            searchIcons: ["arrow.up.arrow.down"]
        ), selected: tags)
        sheet.onChange = { [weak self] v in self?.tags = v; self?.refresh() }
        present(sheet, animated: true)
    }

    private func refreshMedia() {
        if let imgImage {
            mediaThumb.image = imgImage
            mediaThumb.isHidden = false
            mediaIcon.isHidden = true
            mediaLabel.text = tr("Modifier l'image", "Edit image")
        } else {
            mediaThumb.image = nil
            mediaThumb.isHidden = true
            mediaIcon.isHidden = false
            mediaLabel.text = tr("Ajouter des images", "Add images")
        }
    }

    private func setImage(_ dataURL: String) {
        img = dataURL
        imgImage = dataURL.isEmpty ? nil : PCImage.image(fromDataURL: dataURL)
        refreshMedia()
    }

    private func pickPhoto() {
        photoPicker.present(from: self) { [weak self] image in
            guard let self, let image, let data = PCImage.squareDataURL(image) else { return }
            self.setImage(data)
        }
    }

    private func mediaTapped() {
        view.endEditing(true)
        if img.isEmpty { pickPhoto(); return }
        let sheet = UIAlertController(title: nil, message: nil, preferredStyle: .actionSheet)
        sheet.addAction(UIAlertAction(title: tr("Choisir une autre photo", "Choose another photo"), style: .default) { [weak self] _ in
            self?.pickPhoto()
        })
        sheet.addAction(UIAlertAction(title: tr("Supprimer la photo", "Remove photo"), style: .destructive) { [weak self] _ in
            self?.setImage("")
        })
        sheet.addAction(UIAlertAction(title: tr("Annuler", "Cancel"), style: .cancel))
        present(sheet, animated: true)
    }

    private func openShipping() {
        let sheet = PCShippingSheet(physical: physical, fee: fee, currency: currency)
        sheet.onChange = { [weak self] v in self?.physical = v }
        sheet.onFeeChange = { [weak self] v in self?.fee = v }
        present(sheet, animated: true)
    }

    private func save() {
        let t = productTitle.trimmingCharacters(in: .whitespaces)
        guard !t.isEmpty else { return }
        view.endEditing(true)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        onSave?([
            "title": t,
            "desc": desc,
            "category": category,
            "price": price ?? 0,
            "inv": inv,
            "vendor": vendor,
            "type": type,
            "status": isActive ? "Active" : "Draft",
            "tags": tags,
            "collections": collections,
            "vars": variants,
            "physical": physical,
            "fee": fee,
            "img": img,
        ])
        dismiss(animated: true)
    }
}

#endif