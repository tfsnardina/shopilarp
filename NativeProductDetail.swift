import UIKit
import PhotosUI

/// Fiche produit native (Liquid Glass, iOS 26), calquée sur la page produit de l'app Shopify :
/// retour / partage / « … » en verre, statut, supports multimédias, publication, variantes, stock,
/// expédition, type, fournisseur, collections, balises, SEO. S'ouvre au clic sur un produit et
/// reste au-dessus de la page web, sous la barre d'onglets.
#if compiler(>=6.2)

private func dtr(_ fr: String, _ en: String) -> String {
    (Locale.preferredLanguages.first ?? "en").hasPrefix("fr") ? fr : en
}

// MARK: - Images : conversion + sélecteur de photos

enum PCImage {
    /// Recadre au carré, redimensionne et renvoie une data URL JPEG (même format que la page web).
    static func squareDataURL(_ img: UIImage, side: CGFloat = 400) -> String? {
        let src = img.size
        let m = min(src.width, src.height)
        guard m > 0 else { return nil }
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: side, height: side), format: format)
        let out = renderer.image { ctx in
            UIColor.white.setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: side, height: side))
            let k = side / m
            let w = src.width * k
            let h = src.height * k
            img.draw(in: CGRect(x: (side - w) / 2, y: (side - h) / 2, width: w, height: h))
        }
        guard let jpeg = out.jpegData(compressionQuality: 0.8) else { return nil }
        return "data:image/jpeg;base64," + jpeg.base64EncodedString()
    }

    static func image(fromDataURL s: String) -> UIImage? {
        guard s.hasPrefix("data:image/"), let comma = s.firstIndex(of: ",") else { return nil }
        let b64 = String(s[s.index(after: comma)...])
        guard let data = Data(base64Encoded: b64, options: .ignoreUnknownCharacters) else { return nil }
        return UIImage(data: data)
    }
}

/// Sélecteur de photos système (PHPicker : aucune permission à demander).
final class PCPhotoPicker: NSObject, PHPickerViewControllerDelegate {
    private var completion: ((UIImage?) -> Void)?

    func present(from host: UIViewController, completion: @escaping (UIImage?) -> Void) {
        self.completion = completion
        var config = PHPickerConfiguration()
        config.filter = .images
        config.selectionLimit = 1
        let picker = PHPickerViewController(configuration: config)
        picker.delegate = self
        host.present(picker, animated: true)
    }

    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        let done = completion
        completion = nil
        guard let provider = results.first?.itemProvider, provider.canLoadObject(ofClass: UIImage.self) else { return }
        provider.loadObject(ofClass: UIImage.self) { object, _ in
            let image = object as? UIImage
            DispatchQueue.main.async { done?(image) }
        }
    }
}

// MARK: - Briques de la fiche

/// Ligne de la fiche : icône, titre (gras ou non), sous-titre éventuel, chevron.
@available(iOS 26.0, *)
final class PCDRow: UIControl {
    let titleLabel = UILabel()
    private let subLabel = UILabel()

    init(symbol: String?, title: String, bold: Bool = false, chevron: Bool = true, minHeight: CGFloat = 46) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false

        titleLabel.text = title
        titleLabel.font = .systemFont(ofSize: 16, weight: bold ? .semibold : .regular)
        titleLabel.textColor = PCTheme.ink
        titleLabel.numberOfLines = 0
        subLabel.font = .systemFont(ofSize: 16)
        subLabel.textColor = PCTheme.sub
        subLabel.numberOfLines = 1
        subLabel.isHidden = true

        let textStack = UIStackView(arrangedSubviews: [titleLabel, subLabel])
        textStack.axis = .vertical
        textStack.spacing = 2

        let row = UIStackView()
        row.axis = .horizontal
        row.alignment = .top
        row.spacing = 8
        row.isUserInteractionEnabled = false
        row.translatesAutoresizingMaskIntoConstraints = false
        if let symbol {
            let icon = UIImageView(image: PCTheme.symbol(symbol, 17, .regular))
            icon.tintColor = PCTheme.ink
            icon.contentMode = .center
            icon.widthAnchor.constraint(equalToConstant: 19).isActive = true
            icon.heightAnchor.constraint(equalToConstant: 22).isActive = true
            row.addArrangedSubview(icon)
        }
        row.addArrangedSubview(textStack)
        addSubview(row)

        var trailing = row.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16)
        if chevron {
            let c = PCDRow.makeChevron()
            addSubview(c)
            NSLayoutConstraint.activate([
                c.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
                c.centerYAnchor.constraint(equalTo: centerYAnchor),
            ])
            trailing = row.trailingAnchor.constraint(equalTo: c.leadingAnchor, constant: -10)
        }
        NSLayoutConstraint.activate([
            heightAnchor.constraint(greaterThanOrEqualToConstant: minHeight),
            row.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            trailing,
            row.topAnchor.constraint(equalTo: topAnchor, constant: 11),
            row.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -11),
        ])
    }

    /// Chevron de taille fixe : sans largeur ni priorité de « hugging », il s'étirait sur toute la ligne.
    static func makeChevron() -> UIImageView {
        let c = UIImageView(image: PCTheme.symbol("chevron.right", 13))
        c.tintColor = UIColor(white: 0.55, alpha: 1)
        c.contentMode = .scaleAspectFit
        c.translatesAutoresizingMaskIntoConstraints = false
        c.setContentHuggingPriority(.required, for: .horizontal)
        c.setContentCompressionResistancePriority(.required, for: .horizontal)
        c.widthAnchor.constraint(equalToConstant: 10).isActive = true
        c.heightAnchor.constraint(equalToConstant: 16).isActive = true
        return c
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override var isHighlighted: Bool {
        didSet { backgroundColor = isHighlighted ? UIColor(white: 0, alpha: 0.05) : .clear }
    }

    func setSub(_ text: String) {
        subLabel.text = text
        subLabel.isHidden = text.isEmpty
    }

    func onTap(_ handler: @escaping () -> Void) {
        addAction(UIAction { _ in PCTheme.haptic(); handler() }, for: .touchUpInside)
    }
}

/// Carte blanche très arrondie (capsule quand il n'y a qu'une ligne), liseré fin + ombre douce.
@available(iOS 26.0, *)
final class PCDetailCard: UIView {
    private let clip = UIView()

    init(rows: [UIView], inset: CGFloat = 0) {
        super.init(frame: .zero)
        backgroundColor = .clear
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOpacity = 0.07
        layer.shadowRadius = 9
        layer.shadowOffset = CGSize(width: 0, height: 2)
        clip.backgroundColor = .white
        clip.layer.cornerCurve = .continuous
        clip.layer.masksToBounds = true
        clip.layer.borderWidth = 0.5
        clip.layer.borderColor = UIColor(white: 0, alpha: 0.10).cgColor
        clip.translatesAutoresizingMaskIntoConstraints = false
        addSubview(clip)
        let stack = UIStackView(arrangedSubviews: rows)
        stack.axis = .vertical
        stack.translatesAutoresizingMaskIntoConstraints = false
        clip.addSubview(stack)
        NSLayoutConstraint.activate([
            clip.leadingAnchor.constraint(equalTo: leadingAnchor),
            clip.trailingAnchor.constraint(equalTo: trailingAnchor),
            clip.topAnchor.constraint(equalTo: topAnchor),
            clip.bottomAnchor.constraint(equalTo: bottomAnchor),
            stack.leadingAnchor.constraint(equalTo: clip.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: clip.trailingAnchor),
            stack.topAnchor.constraint(equalTo: clip.topAnchor, constant: inset),
            stack.bottomAnchor.constraint(equalTo: clip.bottomAnchor, constant: -inset),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func layoutSubviews() {
        super.layoutSubviews()
        let r = min(26, bounds.height / 2)
        clip.layer.cornerRadius = r
        layer.shadowPath = UIBezierPath(roundedRect: bounds, cornerRadius: r).cgPath
    }
}

/// Pastille de statut (Actif en vert, Brouillon / Archivé en gris).
@available(iOS 26.0, *)
final class PCDStatusPill: UIVisualEffectView {
    private let label = UILabel()

    init() {
        super.init(effect: UIGlassEffect())
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
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func set(status: String) {
        let on = status == "Active"
        let e = UIGlassEffect()
        e.tintColor = on ? PCTheme.okBg : UIColor(white: 0.85, alpha: 1)
        effect = e
        label.textColor = on ? PCTheme.okFg : PCTheme.ink
        switch status {
        case "Active": label.text = dtr("Actif", "Active")
        case "Archived": label.text = dtr("Archivé", "Archived")
        default: label.text = dtr("Brouillon", "Draft")
        }
    }
}

/// Capsule en verre « partager | … » en haut à droite.
@available(iOS 26.0, *)
final class PCDActionPill: UIVisualEffectView {
    let shareButton = UIButton(type: .system)
    let moreButton = UIButton(type: .system)

    init() {
        let effect = UIGlassEffect()
        effect.isInteractive = true
        super.init(effect: effect)
        cornerConfiguration = .capsule()
        translatesAutoresizingMaskIntoConstraints = false
        shareButton.setImage(PCTheme.symbol("square.and.arrow.up", 18, .medium), for: .normal)
        moreButton.setImage(PCTheme.symbol("ellipsis", 18, .bold), for: .normal)
        [shareButton, moreButton].forEach {
            $0.tintColor = PCTheme.ink
            $0.widthAnchor.constraint(equalToConstant: 50).isActive = true
        }
        let stack = UIStackView(arrangedSubviews: [shareButton, moreButton])
        stack.alignment = .fill
        stack.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(stack)
        NSLayoutConstraint.activate([
            heightAnchor.constraint(equalToConstant: 44),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 4),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -4),
            stack.topAnchor.constraint(equalTo: topAnchor),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

/// Pastille de stock « 0 » en verre, modifiable au clavier numérique.
@available(iOS 26.0, *)
final class PCDNumberPill: UIVisualEffectView {
    let field = UITextField()
    var onChange: ((Int) -> Void)?
    var onBegin: (() -> Void)?

    init(value: Int) {
        let effect = UIGlassEffect()
        effect.isInteractive = true
        super.init(effect: effect)
        cornerConfiguration = .capsule()
        translatesAutoresizingMaskIntoConstraints = false
        setContentHuggingPriority(.required, for: .horizontal)
        field.text = "\(value)"
        field.font = .monospacedDigitSystemFont(ofSize: 17, weight: .regular)
        field.textColor = PCTheme.ink
        field.textAlignment = .center
        field.keyboardType = .numberPad
        field.translatesAutoresizingMaskIntoConstraints = false

        let bar = UIToolbar(frame: CGRect(x: 0, y: 0, width: 320, height: 44))
        let space = UIBarButtonItem(barButtonSystemItem: .flexibleSpace, target: nil, action: nil)
        let done = UIBarButtonItem(title: "OK", style: .done, target: self, action: #selector(dismissKeyboard))
        bar.items = [space, done]
        field.inputAccessoryView = bar

        field.addAction(UIAction { [weak self] _ in
            guard let self else { return }
            let digits = (self.field.text ?? "").filter { $0.isNumber }
            self.onChange?(Int(digits.prefix(7)) ?? 0)
        }, for: .editingChanged)
        field.addAction(UIAction { [weak self] _ in
            guard let self else { return }
            let digits = (self.field.text ?? "").filter { $0.isNumber }
            self.field.text = "\(Int(digits.prefix(7)) ?? 0)"
        }, for: .editingDidEnd)
        field.addAction(UIAction { [weak self] _ in self?.onBegin?() }, for: .editingDidBegin)

        contentView.addSubview(field)
        NSLayoutConstraint.activate([
            widthAnchor.constraint(equalToConstant: 88),
            heightAnchor.constraint(equalToConstant: 38),
            field.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            field.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            field.topAnchor.constraint(equalTo: topAnchor),
            field.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    @objc private func dismissKeyboard() { field.resignFirstResponder() }
}

// MARK: - Fiche produit

@available(iOS 26.0, *)
final class ProductDetailViewController: UIViewController, UIScrollViewDelegate, UIGestureRecognizerDelegate, DetailPushHosting {
    let push = DetailPushTransition()

    /// Appelé à l'enregistrement : idx, id, title, desc, category, price, inv, vendor, type, status, tags, collections, vars, physical, img.
    var onSave: (([String: Any]) -> Void)?
    var onDelete: ((Int) -> Void)?
    var onDuplicate: (([String: Any]) -> Void)?
    var onClose: (() -> Void)?

    private let pageBg = UIColor(white: 0.992, alpha: 1)
    private let currency: String
    private let productIndex: Int
    private let productId: String
    private let canDelete: Bool

    private var productTitle: String
    private var desc: String
    private var category: String
    private var price: Double?
    private var inv: Int
    private var vendor: String
    private var type: String
    private var status: String
    private var tags: [String]
    private var collections: [String]
    private var variants: String
    private var physical: Bool
    private var img: String
    private var imgImage: UIImage?
    private var savedSnapshot = ""

    private let photoPicker = PCPhotoPicker()
    private let scroll = UIScrollView()
    private let content = UIStackView()
    private let topFade = UIView()
    private let fadeLayer = CAGradientLayer()
    private let backButton = PCGlassButton(symbol: "chevron.left", circle: true)
    private let actionPill = PCDActionPill()
    private let saveButton = PCGlassButton(title: dtr("Enregistrer", "Save"), tint: PCTheme.ink, foreground: .white)
    private let barTitle = UILabel()
    private let statusPill = PCDStatusPill()
    private let titleField = UITextField()
    private let titleWrap = UIView()
    private let priceField = UITextField()
    private let mediaTile = UIView()
    private let mediaIcon = UIImageView()
    private let mediaThumb = UIImageView()
    private let mediaLabel = UILabel()
    private let descRow = PCDRow(symbol: "plus.circle", title: dtr("Ajouter une description", "Add description"))
    private let categoryRow = PCDRow(symbol: "plus.circle", title: dtr("Sélectionner une catégorie", "Select a category"))
    private let variantsRow = PCDRow(symbol: "plus.circle", title: dtr("Ajouter des options (couleur, taille,...)", "Add options (color, size,...)"))
    private let typeRow = PCDRow(symbol: "rectangle.stack", title: "Type", bold: true)
    private let vendorRow = PCDRow(symbol: "storefront", title: dtr("Fournisseur", "Vendor"), bold: true)
    private let collectionsRow = PCDRow(symbol: "tag", title: "Collections", bold: true)
    private let tagsRow = PCDRow(symbol: "number", title: dtr("Balises", "Tags"), bold: true)
    private let seoRow = PCDRow(symbol: "magnifyingglass", title: dtr("Référencement naturel (SEO)", "Search engine listing (SEO)"), bold: true)
    private var titleShown = false
    private var didSetInitialOffset = false
    private var toastView: UIView?

    init(info: [String: Any]) {
        currency = ((info["sym"] as? String) ?? "€").trimmingCharacters(in: .whitespaces)
        productIndex = (info["idx"] as? NSNumber)?.intValue ?? -1
        productId = (info["id"] as? String) ?? ""
        canDelete = (info["canDelete"] as? NSNumber)?.boolValue ?? false
        productTitle = (info["title"] as? String) ?? ""
        desc = (info["desc"] as? String) ?? ""
        category = (info["category"] as? String) ?? ""
        price = (info["price"] as? NSNumber)?.doubleValue
        inv = max(0, (info["inv"] as? NSNumber)?.intValue ?? 0)
        let shop = (info["shop"] as? String) ?? ""
        let v = (info["vendor"] as? String) ?? ""
        vendor = v.isEmpty ? (shop.isEmpty ? dtr("Ma boutique", "My store") : shop) : v
        type = (info["type"] as? String) ?? ""
        let st = (info["status"] as? String) ?? "Active"
        status = (st == "Draft" || st == "Archived") ? st : "Active"
        tags = (info["tags"] as? [String]) ?? []
        let cols = (info["collections"] as? [String]) ?? []
        collections = cols.isEmpty ? [dtr("Page d'accueil", "Home page")] : cols
        variants = (info["vars"] as? String) ?? ""
        physical = (info["physical"] as? NSNumber)?.boolValue ?? true
        let imgString = (info["img"] as? String) ?? ""
        img = imgString
        imgImage = PCImage.image(fromDataURL: imgString)
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    // MARK: Cycle de vie

    override func viewDidLoad() {
        super.viewDidLoad()
        overrideUserInterfaceStyle = .light
        view.backgroundColor = pageBg
        view.keyboardLayoutGuide.usesBottomSafeArea = false
        buildScroll()
        buildContent()
        buildTopBar()
        titleField.text = productTitle
        if let price, price > 0 { priceFormatted() }
        refreshMedia()
        refresh()
        savedSnapshot = snapshot()
        updateChrome()

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
        push.attach(to: view)
        push.slideIn()
    }

    func closeAnimated(velocity: CGFloat = 0) {
        view.endEditing(true)
        push.close(velocity: velocity) { [weak self] in
            self?.onClose?()
        }
    }

    // MARK: Construction

    private func buildScroll() {
        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.alwaysBounceVertical = true
        scroll.contentInsetAdjustmentBehavior = .never
        scroll.keyboardDismissMode = .interactive
        scroll.showsVerticalScrollIndicator = true
        scroll.delegate = self
        scroll.contentInset.bottom = 120
        scroll.verticalScrollIndicatorInsets.bottom = 100
        view.addSubview(scroll)
        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: view.topAnchor),
            scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor),
        ])
    }

    private func buildTopBar() {
        topFade.isUserInteractionEnabled = false
        fadeLayer.colors = [pageBg.withAlphaComponent(0.96).cgColor, pageBg.withAlphaComponent(0).cgColor]
        topFade.layer.addSublayer(fadeLayer)
        view.addSubview(topFade)

        backButton.onTap = { [weak self] in self?.backTapped() }
        saveButton.onTap = { [weak self] in self?.save() }
        saveButton.alpha = 0
        saveButton.isHidden = true
        actionPill.shareButton.addAction(UIAction { [weak self] _ in self?.share() }, for: .touchUpInside)
        actionPill.moreButton.showsMenuAsPrimaryAction = true
        actionPill.moreButton.menu = makeMoreMenu()

        barTitle.font = .systemFont(ofSize: 17, weight: .semibold)
        barTitle.textColor = PCTheme.ink
        barTitle.textAlignment = .center
        barTitle.lineBreakMode = .byTruncatingTail
        barTitle.alpha = 0
        barTitle.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(barTitle)
        view.addSubview(backButton)
        view.addSubview(actionPill)
        view.addSubview(saveButton)
        let guide = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            backButton.topAnchor.constraint(equalTo: guide.topAnchor, constant: 6),
            backButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            actionPill.topAnchor.constraint(equalTo: guide.topAnchor, constant: 6),
            actionPill.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            saveButton.topAnchor.constraint(equalTo: guide.topAnchor, constant: 6),
            saveButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            barTitle.centerYAnchor.constraint(equalTo: backButton.centerYAnchor),
            barTitle.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            barTitle.leadingAnchor.constraint(greaterThanOrEqualTo: backButton.trailingAnchor, constant: 12),
            barTitle.trailingAnchor.constraint(lessThanOrEqualTo: actionPill.leadingAnchor, constant: -12),
        ])
    }

    private func makeMoreMenu() -> UIMenu {
        var items: [UIMenuElement] = [
            UIAction(title: dtr("Dupliquer", "Duplicate"), image: UIImage(systemName: "plus.square.on.square")) { [weak self] _ in
                self?.duplicate()
            },
        ]
        if canDelete {
            items.append(UIAction(title: dtr("Supprimer le produit", "Delete product"), image: UIImage(systemName: "trash"), attributes: .destructive) { [weak self] _ in
                self?.confirmDelete()
            })
        }
        return UIMenu(children: items)
    }

    private func header(_ title: String, count: Int? = nil, action: String? = nil) -> UIView {
        let label = UILabel()
        label.text = title
        label.font = .systemFont(ofSize: 17, weight: .bold)
        label.textColor = PCTheme.ink
        let stack = UIStackView(arrangedSubviews: [label])
        stack.axis = .horizontal
        stack.alignment = .center
        stack.spacing = 8
        stack.isLayoutMarginsRelativeArrangement = true
        stack.layoutMargins = UIEdgeInsets(top: 0, left: 15, bottom: 0, right: 15)
        if let count {
            let c = UILabel()
            c.text = "\(count)"
            c.font = .systemFont(ofSize: 16, weight: .semibold)
            c.textColor = UIColor(white: 0.55, alpha: 1)
            stack.addArrangedSubview(c)
        }
        stack.addArrangedSubview(UIView())
        if let action {
            let b = UIButton(type: .system)
            b.setTitle(action, for: .normal)
            b.titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold)
            b.tintColor = PCTheme.blue
            stack.addArrangedSubview(b)
        }
        return stack
    }

    /// Un titre de section s'écarte davantage de la carte qui le précède.
    private func addHeader(_ view: UIView) {
        if let last = content.arrangedSubviews.last { content.setCustomSpacing(26, after: last) }
        content.addArrangedSubview(view)
    }

    private func buildContent() {
        content.axis = .vertical
        content.spacing = 10
        content.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(content)
        NSLayoutConstraint.activate([
            content.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor),
            content.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor, constant: -8),
            content.leadingAnchor.constraint(equalTo: scroll.frameLayoutGuide.leadingAnchor, constant: 12),
            content.trailingAnchor.constraint(equalTo: scroll.frameLayoutGuide.trailingAnchor, constant: -12),
        ])

        // Statut du produit.
        let statusRow = PCDRow(symbol: nil, title: dtr("Statut du produit", "Product status"), bold: true, chevron: true, minHeight: 50)
        let chevron = statusRow.subviews.compactMap { $0 as? UIImageView }.first
        statusPill.translatesAutoresizingMaskIntoConstraints = false
        statusRow.addSubview(statusPill)
        if let chevron {
            NSLayoutConstraint.activate([
                statusPill.trailingAnchor.constraint(equalTo: chevron.leadingAnchor, constant: -10),
                statusPill.centerYAnchor.constraint(equalTo: statusRow.centerYAnchor),
            ])
        }
        let menuButton = UIButton(type: .system)
        menuButton.showsMenuAsPrimaryAction = true
        menuButton.menu = UIMenu(children: [
            UIAction(title: dtr("Actif", "Active")) { [weak self] _ in self?.status = "Active"; self?.refresh() },
            UIAction(title: dtr("Brouillon", "Draft")) { [weak self] _ in self?.status = "Draft"; self?.refresh() },
            UIAction(title: dtr("Archivé", "Archived")) { [weak self] _ in self?.status = "Archived"; self?.refresh() },
        ])
        menuButton.translatesAutoresizingMaskIntoConstraints = false
        statusRow.addSubview(menuButton)
        NSLayoutConstraint.activate([
            menuButton.topAnchor.constraint(equalTo: statusRow.topAnchor),
            menuButton.bottomAnchor.constraint(equalTo: statusRow.bottomAnchor),
            menuButton.leadingAnchor.constraint(equalTo: statusRow.leadingAnchor),
            menuButton.trailingAnchor.constraint(equalTo: statusRow.trailingAnchor),
        ])
        content.addArrangedSubview(PCDetailCard(rows: [statusRow]))

        // Supports multimédias.
        addHeader(header(dtr("Supports multimédias", "Media")))
        content.addArrangedSubview(makeMediaBlock())

        // Titre · description · catégorie · prix.
        titleField.placeholder = dtr("Titre de produit", "Product title")
        titleField.font = .systemFont(ofSize: 17, weight: .semibold)
        titleField.textColor = PCTheme.ink
        titleField.returnKeyType = .done
        titleField.autocapitalizationType = .sentences
        titleField.addAction(UIAction { [weak self] _ in
            self?.productTitle = self?.titleField.text ?? ""
            self?.refresh()
        }, for: .editingChanged)
        titleField.addAction(UIAction { [weak self] _ in self?.titleField.resignFirstResponder() }, for: .editingDidEndOnExit)
        titleField.translatesAutoresizingMaskIntoConstraints = false
        titleWrap.addSubview(titleField)
        NSLayoutConstraint.activate([
            titleField.leadingAnchor.constraint(equalTo: titleWrap.leadingAnchor, constant: 16),
            titleField.trailingAnchor.constraint(equalTo: titleWrap.trailingAnchor, constant: -16),
            titleField.topAnchor.constraint(equalTo: titleWrap.topAnchor, constant: 16),
            titleField.bottomAnchor.constraint(equalTo: titleWrap.bottomAnchor, constant: -8),
        ])

        priceField.placeholder = dtr("0,00 \(currency)", "\(currency)0.00")
        priceField.font = .systemFont(ofSize: 16, weight: .semibold)
        priceField.textColor = PCTheme.ink
        priceField.keyboardType = .decimalPad
        priceField.addAction(UIAction { [weak self] _ in self?.priceEdited(); self?.refresh() }, for: .editingChanged)
        priceField.addAction(UIAction { [weak self] _ in self?.priceFormatted(); self?.refresh() }, for: .editingDidEnd)
        let priceChevron = PCDRow.makeChevron()
        priceField.translatesAutoresizingMaskIntoConstraints = false
        let priceWrap = UIView()
        priceWrap.addSubview(priceField)
        priceWrap.addSubview(priceChevron)
        NSLayoutConstraint.activate([
            priceField.leadingAnchor.constraint(equalTo: priceWrap.leadingAnchor, constant: 16),
            priceField.trailingAnchor.constraint(equalTo: priceChevron.leadingAnchor, constant: -8),
            priceField.topAnchor.constraint(equalTo: priceWrap.topAnchor, constant: 13),
            priceField.bottomAnchor.constraint(equalTo: priceWrap.bottomAnchor, constant: -13),
            priceChevron.trailingAnchor.constraint(equalTo: priceWrap.trailingAnchor, constant: -16),
            priceChevron.centerYAnchor.constraint(equalTo: priceWrap.centerYAnchor),
        ])

        descRow.onTap { [weak self] in self?.editDescription() }
        categoryRow.onTap { [weak self] in self?.pickCategory() }
        content.addArrangedSubview(PCDetailCard(rows: [titleWrap, descRow, categoryRow, priceWrap]))

        // Publication.
        addHeader(header(dtr("Publication", "Publishing"), count: 3, action: dtr("Modifier", "Edit")))
        content.addArrangedSubview(PCDetailCard(rows: [
            PCDRow(symbol: "point.3.connected.trianglepath.dotted", title: dtr("Boutique en ligne, Shop, Point de vente", "Online Store, Shop, Point of Sale"), chevron: false),
            PCDRow(symbol: "books.vertical", title: dtr("Aucun catalogue", "No catalog"), chevron: false),
        ]))

        // Variantes.
        addHeader(header(dtr("Variantes", "Variants")))
        variantsRow.onTap { [weak self] in self?.editVariants() }
        content.addArrangedSubview(PCDetailCard(rows: [variantsRow]))

        // Stock.
        addHeader(header("Stock", action: dtr("Modifier", "Edit")))
        let stockLabel = UILabel()
        stockLabel.text = dtr("Disponible", "Available")
        stockLabel.font = .systemFont(ofSize: 16)
        stockLabel.textColor = PCTheme.ink
        let pill = PCDNumberPill(value: inv)
        pill.onChange = { [weak self] v in self?.inv = v; self?.refresh() }
        pill.onBegin = { [weak self, weak pill] in
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                guard let self, let pill else { return }
                let r = pill.convert(pill.bounds, to: self.scroll).insetBy(dx: 0, dy: -90)
                self.scroll.scrollRectToVisible(r, animated: true)
            }
        }
        let stockRow = UIStackView(arrangedSubviews: [stockLabel, UIView(), pill])
        stockRow.alignment = .center
        stockRow.isLayoutMarginsRelativeArrangement = true
        stockRow.layoutMargins = UIEdgeInsets(top: 12, left: 16, bottom: 12, right: 12)
        content.addArrangedSubview(PCDetailCard(rows: [stockRow]))

        // Expédition · Type · Fournisseur · Collections · Balises · SEO.
        let shippingRow = PCDRow(symbol: "box.truck", title: dtr("Expédition", "Shipping"), bold: true)
        shippingRow.onTap { [weak self] in self?.openShipping() }
        typeRow.onTap { [weak self] in self?.pickType() }
        vendorRow.onTap { [weak self] in self?.pickVendor() }
        collectionsRow.onTap { [weak self] in self?.pickCollections() }
        tagsRow.onTap { [weak self] in self?.pickTags() }
        seoRow.onTap { [weak self] in
            guard let self else { return }
            self.scroll.setContentOffset(CGPoint(x: 0, y: -self.scroll.contentInset.top), animated: true)
            self.titleField.becomeFirstResponder()
        }
        content.setCustomSpacing(18, after: content.arrangedSubviews[content.arrangedSubviews.count - 1])
        content.addArrangedSubview(PCDetailCard(rows: [shippingRow, typeRow, vendorRow, collectionsRow, tagsRow, seoRow], inset: 4))
    }

    private func makeMediaBlock() -> UIView {
        mediaTile.backgroundColor = UIColor(white: 0.95, alpha: 1)
        mediaTile.layer.cornerRadius = 28
        mediaTile.layer.cornerCurve = .continuous
        mediaTile.layer.borderWidth = 3
        mediaTile.layer.borderColor = UIColor.white.cgColor
        mediaTile.layer.shadowColor = UIColor.black.cgColor
        mediaTile.layer.shadowOpacity = 0.12
        mediaTile.layer.shadowRadius = 12
        mediaTile.layer.shadowOffset = CGSize(width: 0, height: 5)
        mediaTile.widthAnchor.constraint(equalToConstant: 96).isActive = true
        mediaTile.heightAnchor.constraint(equalToConstant: 96).isActive = true

        mediaIcon.image = PCTheme.symbol("photo", 24, .regular)
        mediaIcon.tintColor = UIColor(white: 0.62, alpha: 1)
        mediaIcon.contentMode = .center
        mediaIcon.translatesAutoresizingMaskIntoConstraints = false
        mediaThumb.contentMode = .scaleAspectFill
        mediaThumb.clipsToBounds = true
        mediaThumb.layer.cornerRadius = 25
        mediaThumb.layer.cornerCurve = .continuous
        mediaThumb.isHidden = true
        mediaThumb.translatesAutoresizingMaskIntoConstraints = false
        mediaTile.addSubview(mediaIcon)
        mediaTile.addSubview(mediaThumb)
        for v in [mediaIcon, mediaThumb] {
            NSLayoutConstraint.activate([
                v.leadingAnchor.constraint(equalTo: mediaTile.leadingAnchor),
                v.trailingAnchor.constraint(equalTo: mediaTile.trailingAnchor),
                v.topAnchor.constraint(equalTo: mediaTile.topAnchor),
                v.bottomAnchor.constraint(equalTo: mediaTile.bottomAnchor),
            ])
        }

        mediaLabel.font = .systemFont(ofSize: 17, weight: .medium)
        mediaLabel.textColor = PCTheme.sub
        mediaLabel.textAlignment = .center
        let sub = UILabel()
        sub.text = dtr("Choisissez un forfait pour ajouter d'autres types de supports multimédias.", "Choose a plan to add other types of media.")
        sub.font = .systemFont(ofSize: 17)
        sub.textColor = PCTheme.sub
        sub.textAlignment = .center
        sub.numberOfLines = 0

        let stack = UIStackView(arrangedSubviews: [mediaTile, mediaLabel, sub])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 12
        stack.setCustomSpacing(18, after: mediaTile)
        stack.isUserInteractionEnabled = false
        stack.translatesAutoresizingMaskIntoConstraints = false
        let control = UIControl()
        control.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: control.topAnchor, constant: 14),
            stack.bottomAnchor.constraint(equalTo: control.bottomAnchor, constant: -14),
            stack.leadingAnchor.constraint(equalTo: control.leadingAnchor, constant: 28),
            stack.trailingAnchor.constraint(equalTo: control.trailingAnchor, constant: -28),
        ])
        control.addAction(UIAction { [weak self] _ in PCTheme.haptic(); self?.mediaTapped() }, for: .touchUpInside)
        return control
    }

    // MARK: Photos

    private func refreshMedia() {
        if let imgImage {
            mediaThumb.image = imgImage
            mediaThumb.isHidden = false
            mediaIcon.isHidden = true
            mediaTile.transform = .identity
            mediaLabel.text = dtr("Modifier l'image", "Edit image")
        } else {
            mediaThumb.image = nil
            mediaThumb.isHidden = true
            mediaIcon.isHidden = false
            mediaTile.transform = CGAffineTransform(rotationAngle: 0.09)
            mediaLabel.text = dtr("Ajouter des images", "Add images")
        }
    }

    private func setImage(_ dataURL: String) {
        img = dataURL
        imgImage = dataURL.isEmpty ? nil : PCImage.image(fromDataURL: dataURL)
        refreshMedia()
        refresh()
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
        sheet.addAction(UIAlertAction(title: dtr("Choisir une autre photo", "Choose another photo"), style: .default) { [weak self] _ in
            self?.pickPhoto()
        })
        sheet.addAction(UIAlertAction(title: dtr("Supprimer la photo", "Remove photo"), style: .destructive) { [weak self] _ in
            self?.setImage("")
        })
        sheet.addAction(UIAlertAction(title: dtr("Annuler", "Cancel"), style: .cancel))
        present(sheet, animated: true)
    }

    // MARK: Données

    private func snapshot() -> String {
        var parts: [String] = [productTitle, desc, category]
        parts.append(price.map { String($0) } ?? "")
        parts.append(String(inv))
        parts.append(vendor)
        parts.append(type)
        parts.append(status)
        parts.append(tags.joined(separator: "|"))
        parts.append(collections.joined(separator: "|"))
        parts.append(variants)
        parts.append(physical ? "1" : "0")
        parts.append(String(img.count))
        parts.append(String(img.suffix(24)))
        return parts.joined(separator: "\u{1E}")
    }

    private var isDirty: Bool { snapshot() != savedSnapshot }

    private func refresh() {
        statusPill.set(status: status)
        barTitle.text = productTitle
        descRow.titleLabel.text = desc.isEmpty ? dtr("Ajouter une description", "Add description") : desc
        descRow.titleLabel.numberOfLines = 2
        categoryRow.titleLabel.text = category.isEmpty ? dtr("Sélectionner une catégorie", "Select a category") : category
        variantsRow.titleLabel.text = variants.isEmpty ? dtr("Ajouter des options (couleur, taille,...)", "Add options (color, size,...)") : variants
        typeRow.setSub(type)
        vendorRow.setSub(vendor)
        collectionsRow.setSub(collections.joined(separator: ", "))
        tagsRow.setSub(tags.joined(separator: ", "))
        seoRow.setSub(productTitle)
        updateChrome()
    }

    /// Boutons du haut : « partager | … » au repos, « Enregistrer » dès qu'il y a une modification.
    private func updateChrome() {
        let dirty = isDirty
        let canSave = dirty && !productTitle.trimmingCharacters(in: .whitespaces).isEmpty
        saveButton.isEnabled = canSave
        UIView.animate(withDuration: 0.2) {
            self.actionPill.alpha = dirty ? 0 : 1
            self.saveButton.alpha = dirty ? 1 : 0
        }
        actionPill.isUserInteractionEnabled = !dirty
        saveButton.isHidden = !dirty
    }

    private func priceEdited() {
        let raw = (priceField.text ?? "").replacingOccurrences(of: ",", with: ".").filter { "0123456789.".contains($0) }
        price = Double(raw)
    }

    private func priceFormatted() {
        if let text = priceField.text, !text.isEmpty { priceEdited() }
        guard let price else { priceField.text = ""; return }
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.minimumFractionDigits = 2
        f.maximumFractionDigits = 2
        priceField.text = (f.string(from: NSNumber(value: price)) ?? "\(price)") + " " + currency
    }

    // MARK: Actions

    private func editDescription() {
        let sheet = PCTextSheet(title: "Description", placeholder: dtr("Décrivez votre produit", "Describe your product"), text: desc)
        sheet.onDone = { [weak self] text in self?.desc = text; self?.refresh() }
        present(sheet, animated: true)
    }

    private func editVariants() {
        let sheet = PCTextSheet(
            title: dtr("Variantes", "Variants"),
            placeholder: dtr("Options séparées par des virgules : S, M, L", "Options separated by commas: S, M, L"),
            text: variants
        )
        sheet.onDone = { [weak self] text in self?.variants = text; self?.refresh() }
        present(sheet, animated: true)
    }

    private func pickCategory() {
        let sheet = PCSearchSheet(config: .init(
            title: dtr("Catégorie", "Category"),
            placeholder: dtr("Rechercher ou ajouter une catégorie", "Search or add a category"),
            emptyTitle: dtr("Aucune catégorie trouvée", "No category found")
        ), selected: category.isEmpty ? [] : [category])
        sheet.onChange = { [weak self] v in self?.category = v.first ?? ""; self?.refresh() }
        present(sheet, animated: true)
    }

    private func pickType() {
        let sheet = PCSearchSheet(config: .init(
            title: "Type",
            placeholder: dtr("Rechercher ou ajouter un type", "Search or add a type"),
            emptyTitle: dtr("Aucun type trouvé", "No type found"),
            detents: [.large()]
        ), selected: type.isEmpty ? [] : [type])
        sheet.onChange = { [weak self] v in self?.type = v.first ?? ""; self?.refresh() }
        present(sheet, animated: true)
    }

    private func pickVendor() {
        let sheet = PCSearchSheet(config: .init(
            title: dtr("Fournisseur", "Vendor"),
            placeholder: dtr("Rechercher ou ajouter un fournisseur", "Search or add a vendor"),
            emptyTitle: dtr("Aucun fournisseur trouvé", "No vendor found"),
            items: [vendor]
        ), selected: [vendor])
        sheet.onChange = { [weak self] v in if let first = v.first { self?.vendor = first }; self?.refresh() }
        present(sheet, animated: true)
    }

    private func pickCollections() {
        let sheet = PCSearchSheet(config: .init(
            title: "Collections",
            placeholder: dtr("Rechercher des collections", "Search collections"),
            emptyTitle: dtr("Aucune collection trouvée", "No collection found"),
            items: [dtr("Page d'accueil", "Home page")],
            allowAdd: false,
            multi: true
        ), selected: collections)
        sheet.onChange = { [weak self] v in self?.collections = v; self?.refresh() }
        present(sheet, animated: true)
    }

    private func pickTags() {
        let sheet = PCSearchSheet(config: .init(
            title: dtr("Balises", "Tags"),
            placeholder: dtr("Rechercher ou ajouter des balises", "Search or add tags"),
            emptyTitle: dtr("Aucune balise trouvée", "No tags found"),
            emptySubtitle: dtr("Ajouter une nouvelle balise dans la barre de recherche", "Add a new tag in the search bar"),
            items: tags,
            multi: true,
            searchIcons: ["arrow.up.arrow.down"]
        ), selected: tags)
        sheet.onChange = { [weak self] v in self?.tags = v; self?.refresh() }
        present(sheet, animated: true)
    }

    private func openShipping() {
        let sheet = PCShippingSheet(physical: physical)
        sheet.onChange = { [weak self] v in self?.physical = v; self?.refresh() }
        present(sheet, animated: true)
    }

    private func payload() -> [String: Any] {
        [
            "idx": productIndex,
            "id": productId,
            "title": productTitle.trimmingCharacters(in: .whitespaces),
            "desc": desc,
            "category": category,
            "price": price ?? 0,
            "inv": inv,
            "vendor": vendor,
            "type": type,
            "status": status,
            "tags": tags,
            "collections": collections,
            "vars": variants,
            "physical": physical,
            "img": img,
        ]
    }

    private func save() {
        guard !productTitle.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        view.endEditing(true)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        onSave?(payload())
        savedSnapshot = snapshot()
        updateChrome()
        showToast(dtr("Produit enregistré", "Product saved"))
    }

    private func share() {
        let text = productTitle.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }
        present(UIActivityViewController(activityItems: [text], applicationActivities: nil), animated: true)
    }

    private func duplicate() {
        var p = payload()
        p["title"] = dtr("\(productTitle) (copie)", "\(productTitle) (copy)")
        onDuplicate?(p)
        showToast(dtr("Produit dupliqué", "Product duplicated"))
    }

    private func confirmDelete() {
        let alert = UIAlertController(
            title: dtr("Supprimer ce produit ?", "Delete this product?"),
            message: nil,
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: dtr("Annuler", "Cancel"), style: .cancel))
        alert.addAction(UIAlertAction(title: dtr("Supprimer", "Delete"), style: .destructive) { [weak self] _ in
            guard let self else { return }
            self.onDelete?(self.productIndex)
            self.closeAnimated()
        })
        present(alert, animated: true)
    }

    private func backTapped() {
        view.endEditing(true)
        guard isDirty else { closeAnimated(); return }
        let alert = UIAlertController(
            title: dtr("Modifications non enregistrées", "Unsaved changes"),
            message: nil,
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: dtr("Enregistrer", "Save"), style: .default) { [weak self] _ in
            self?.save()
            self?.closeAnimated()
        })
        alert.addAction(UIAlertAction(title: dtr("Abandonner", "Discard"), style: .destructive) { [weak self] _ in
            self?.closeAnimated()
        })
        alert.addAction(UIAlertAction(title: dtr("Annuler", "Cancel"), style: .cancel))
        present(alert, animated: true)
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
        ])
        pill.alpha = 0
        toastView = pill
        UIView.animate(withDuration: 0.2) { pill.alpha = 1 }
        UIView.animate(withDuration: 0.3, delay: 1.7, options: [], animations: { pill.alpha = 0 }, completion: { [weak self, weak pill] _ in
            pill?.removeFromSuperview()
            if self?.toastView === pill { self?.toastView = nil }
        })
    }

    // MARK: Défilement : le titre apparaît dans la barre quand il sort de l'écran

    func scrollViewDidScroll(_ scrollView: UIScrollView) {
        let frame = titleWrap.convert(titleWrap.bounds, to: scroll)
        let barBottom = scroll.contentOffset.y + scroll.contentInset.top
        let show = barBottom > frame.midY && !productTitle.isEmpty
        guard show != titleShown else { return }
        titleShown = show
        UIView.animate(withDuration: 0.18, delay: 0, options: [.beginFromCurrentState]) {
            self.barTitle.alpha = show ? 1 : 0
        }
    }

    // MARK: Retour par glissement depuis le bord gauche

    @objc private func edgePan(_ g: UIScreenEdgePanGestureRecognizer) {
        let w = max(view.bounds.width, 1)
        let x = max(0, g.translation(in: view.superview).x)
        switch g.state {
        case .began, .changed:
            push.setProgress(1 - x / w)
        case .ended, .cancelled:
            let vx = g.velocity(in: view.superview).x
            if g.state == .ended && (x > w * 0.33 || vx > 600) {
                if isDirty {
                    push.animate(open: true, velocity: 0)
                    backTapped()
                } else {
                    closeAnimated(velocity: vx)
                }
            } else {
                push.animate(open: true, velocity: vx)
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
