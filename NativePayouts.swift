import UIKit

/// Menu « Versements » 100 % natif (iOS 26), calqué sur l'écran Finance de Shopify : « Solde des versements »,
/// « Afficher les versements », « Taxes ». Il reprend tout le fonctionnement de la version web :
/// liste et détail des versements, transfert en 3 étapes (méthode → montant → compte / e-mail PayPal), récapitulatif
/// puis « glisser pour envoyer » (2 à 5 s de chargement, rafale de vibrations, écran de succès).
/// La page web garde les données et la logique (solde, comptes, historique, notifications) : elle envoie un état déjà traduit
/// (app.js : nativePayoutsInfo, modes « payouts » / « payoutsUpdate ») et reçoit les actions (addAccount, delAccount, send).
#if compiler(>=6.2)

// MARK: - Données

struct POAccount {
    let id: String
    let holder: String
    let label: String
}

struct PORow {
    let label: String
    let sub: String
    let value: String
    let total: Bool
}

struct POItem {
    let id: Int
    let isBank: Bool
    let inTransit: Bool
    let status: String
    let amount: String
    let date: String
    let title: String
    let sub: String
    let rows: [PORow]
}

private final class POWeak {
    weak var value: AnyObject?
    init(_ v: AnyObject) { value = v }
}

/// État partagé par tous les écrans Versements : le dernier état envoyé par la page web + l'envoi des actions.
@available(iOS 26.0, *)
final class POStore {
    private(set) var info: [String: Any]
    var onAct: (([String: Any]) -> Void)?
    private var observers: [(owner: POWeak, run: () -> Void)] = []

    init(info: [String: Any]) { self.info = info }

    func update(_ new: [String: Any]) {
        info = new
        observers.removeAll { $0.owner.value == nil }
        let runs = observers.map { $0.run }
        for run in runs { run() }
    }

    func observe(_ owner: AnyObject, _ run: @escaping () -> Void) {
        observers.append((owner: POWeak(owner), run: run))
    }

    func act(_ payload: [String: Any]) { onAct?(payload) }

    // MARK: Accès

    func str(_ key: String) -> String { (info[key] as? String) ?? "" }
    func flag(_ key: String) -> Bool { (info[key] as? NSNumber)?.boolValue ?? false }

    private var tr: [String: Any] { (info["tr"] as? [String: Any]) ?? [:] }
    private func int(_ key: String, _ fallback: Int) -> Int { (tr[key] as? NSNumber)?.intValue ?? fallback }

    /// Texte du flux de transfert (déjà traduit).
    func s(_ key: String) -> String {
        let table = (tr["s"] as? [String: Any]) ?? [:]
        return (table[key] as? String) ?? ""
    }

    var balance: Int { int("bal", 0) }
    var dec: Int { int("dec", 2) }
    var sep: String { (tr["sep"] as? String) ?? "." }
    var symbol: String { (tr["sym"] as? String) ?? "" }
    var symAfter: Bool { (tr["symAfter"] as? NSNumber)?.boolValue ?? false }
    var defaultMethod: String { (tr["method"] as? String) ?? "bank" }
    var selectedAccount: String { (tr["sel"] as? String) ?? "" }
    var email: String { (tr["email"] as? String) ?? "" }

    var accounts: [POAccount] {
        let raw = (tr["accounts"] as? [[String: Any]]) ?? []
        return raw.map { d in
            POAccount(
                id: (d["id"] as? String) ?? "",
                holder: (d["holder"] as? String) ?? "",
                label: (d["label"] as? String) ?? ""
            )
        }
    }

    var items: [POItem] {
        let raw = (info["items"] as? [[String: Any]]) ?? []
        return raw.map { (d: [String: Any]) -> POItem in
            let rawRows = (d["rows"] as? [[String: Any]]) ?? []
            let rows: [PORow] = rawRows.map { r in
                PORow(
                    label: (r["l"] as? String) ?? "",
                    sub: (r["s"] as? String) ?? "",
                    value: (r["v"] as? String) ?? "",
                    total: (r["tot"] as? NSNumber)?.boolValue ?? false
                )
            }
            return POItem(
                id: (d["id"] as? NSNumber)?.intValue ?? 0,
                isBank: (d["bank"] as? NSNumber)?.boolValue ?? false,
                inTransit: (d["tr"] as? NSNumber)?.boolValue ?? false,
                status: (d["st"] as? String) ?? "",
                amount: (d["amt"] as? String) ?? "",
                date: (d["date"] as? String) ?? "",
                title: (d["title"] as? String) ?? "",
                sub: (d["sub"] as? String) ?? "",
                rows: rows
            )
        }
    }

    // MARK: Montants (mêmes règles que la page web)

    func money(_ cents: Int) -> String {
        let f = NumberFormatter()
        f.locale = Locale(identifier: str("loc").replacingOccurrences(of: "-", with: "_"))
        f.numberStyle = .decimal
        f.minimumFractionDigits = dec
        f.maximumFractionDigits = dec
        let body = f.string(from: NSNumber(value: Double(abs(cents)) / 100.0)) ?? "0"
        let neg = cents < 0 ? "-" : ""
        if symAfter { return neg + body + "\u{00A0}" + symbol.trimmingCharacters(in: .whitespaces) }
        return neg + symbol + body
    }

    /// Centimes → texte saisi (séparateur décimal de la langue).
    func toStr(_ cents: Int) -> String {
        let value = Double(cents) / pow(10.0, Double(dec))
        return String(format: "%.\(dec)f", value).replacingOccurrences(of: ".", with: sep)
    }

    /// Texte saisi → centimes.
    func toCents(_ text: String) -> Int {
        let normalized = text.replacingOccurrences(of: sep, with: ".")
        guard let n = Double(normalized), n.isFinite else { return 0 }
        return Int((n * pow(10.0, Double(dec))).rounded())
    }

    func fee(_ cents: Int, method: String) -> Int {
        let bank = int("feeBank", 25)
        let minimum = int("feeMin", 10)
        if method == "paypal" { return max(minimum, Int((Double(cents) * 0.01).rounded())) }
        return bank
    }
}

/// État du transfert en cours (partagé par les étapes).
@available(iOS 26.0, *)
final class POTransfer {
    var method: String
    var amount = ""
    var sel: String
    var email: String
    var accounts: [POAccount]
    var adding: Bool
    var fee = 0
    var destLabel = ""
    var destHolder = ""

    init(store: POStore) {
        method = store.defaultMethod
        sel = store.selectedAccount
        email = store.email
        accounts = store.accounts
        if sel.isEmpty, let first = accounts.first { sel = first.id }
        adding = accounts.isEmpty
    }
}

// MARK: - Briques d'interface

@available(iOS 26.0, *)
enum POUI {
    static let pageBg = UIColor(white: 0.985, alpha: 1)
    static let link = UIColor(red: 0.16, green: 0.36, blue: 0.86, alpha: 1)
    static let field = UIColor(white: 0.965, alpha: 1)
    static let danger = UIColor(red: 0.82, green: 0.12, blue: 0.10, alpha: 1)
    static let green = UIColor(red: 0.10, green: 0.62, blue: 0.33, alpha: 1)

    static func label(
        _ text: String, _ size: CGFloat, _ weight: UIFont.Weight = .regular,
        color: UIColor = PCTheme.ink, lines: Int = 1, align: NSTextAlignment = .natural
    ) -> UILabel {
        let l = UILabel()
        l.text = text
        l.font = .inter(size, weight)
        l.textColor = color
        l.numberOfLines = lines
        l.textAlignment = align
        return l
    }

    static func padded(_ view: UIView, _ insets: UIEdgeInsets) -> UIView {
        let wrap = UIView()
        view.translatesAutoresizingMaskIntoConstraints = false
        wrap.addSubview(view)
        NSLayoutConstraint.activate([
            view.leadingAnchor.constraint(equalTo: wrap.leadingAnchor, constant: insets.left),
            view.trailingAnchor.constraint(equalTo: wrap.trailingAnchor, constant: -insets.right),
            view.topAnchor.constraint(equalTo: wrap.topAnchor, constant: insets.top),
            view.bottomAnchor.constraint(equalTo: wrap.bottomAnchor, constant: -insets.bottom),
        ])
        return wrap
    }

    /// Centre une vue horizontalement (sans étirer).
    static func centered(_ v: UIView) -> UIView {
        let wrap = UIView()
        v.translatesAutoresizingMaskIntoConstraints = false
        wrap.addSubview(v)
        NSLayoutConstraint.activate([
            v.centerXAnchor.constraint(equalTo: wrap.centerXAnchor),
            v.topAnchor.constraint(equalTo: wrap.topAnchor),
            v.bottomAnchor.constraint(equalTo: wrap.bottomAnchor),
            v.leadingAnchor.constraint(greaterThanOrEqualTo: wrap.leadingAnchor),
            v.trailingAnchor.constraint(lessThanOrEqualTo: wrap.trailingAnchor),
        ])
        return wrap
    }

    static func chip(_ text: String, size: CGFloat = 13, weight: UIFont.Weight = .medium) -> UIView {
        let l = label(text, size, weight, color: UIColor(white: 0.25, alpha: 1))
        let wrap = padded(l, UIEdgeInsets(top: 5, left: 11, bottom: 5, right: 11))
        wrap.backgroundColor = UIColor(white: 0.93, alpha: 1)
        wrap.layer.cornerRadius = 13
        wrap.layer.cornerCurve = .continuous
        wrap.setContentHuggingPriority(.required, for: .horizontal)
        return wrap
    }

    /// Bouton principal noir en capsule (Continuer, Transférer…).
    static func primaryButton(_ title: String, symbol: String? = nil) -> UIButton {
        var config = UIButton.Configuration.filled()
        config.baseBackgroundColor = PCTheme.ink
        config.baseForegroundColor = .white
        config.cornerStyle = .capsule
        config.title = title
        if let symbol {
            config.image = PCTheme.symbol(symbol, 15, .bold)
            config.imagePadding = 8
        }
        config.contentInsets = NSDirectionalEdgeInsets(top: 16, leading: 24, bottom: 16, trailing: 24)
        config.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { attrs in
            var attrs = attrs
            attrs.font = UIFont.inter(17, .semibold)
            return attrs
        }
        let b = UIButton(configuration: config)
        b.translatesAutoresizingMaskIntoConstraints = false
        return b
    }

    static func setTitle(_ button: UIButton, _ title: String) {
        var config = button.configuration
        config?.title = title
        button.configuration = config
    }

    static func errorLabel() -> UILabel {
        let l = label("", 14, .regular, color: danger, lines: 0)
        l.isHidden = true
        return l
    }

    static func showError(_ l: UILabel, _ text: String) {
        l.text = text
        l.isHidden = text.isEmpty
        if !text.isEmpty { UINotificationFeedbackGenerator().notificationOccurred(.warning) }
    }

    /// Rafale de vibrations (comme la version web) quand le transfert part.
    static func burst() {
        let kinds: [UIImpactFeedbackGenerator.FeedbackStyle] = [
            .heavy, .medium, .heavy, .light, .heavy, .medium, .heavy, .heavy, .medium,
            .heavy, .light, .heavy, .medium, .heavy, .heavy, .heavy, .medium, .heavy,
        ]
        for (i, kind) in kinds.enumerated() {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * 0.045) {
                UIImpactFeedbackGenerator(style: kind).impactOccurred()
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + Double(kinds.count) * 0.045 + 0.04) {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
    }

    static func isEmail(_ text: String) -> Bool {
        text.range(of: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$", options: .regularExpression) != nil
    }

    static func isIBAN(_ text: String) -> Bool {
        text.range(of: "^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$", options: .regularExpression) != nil
    }
}

/// Champ de saisie : petit libellé au-dessus, champ arrondi gris dessous.
@available(iOS 26.0, *)
final class POField: UIView {
    let field = UITextField()

    init(caption: String, placeholder: String = "", keyboard: UIKeyboardType = .default, capitalization: UITextAutocapitalizationType = .none) {
        super.init(frame: .zero)
        let cap = POUI.label(caption, 14, .medium, color: PCTheme.sub)
        field.placeholder = placeholder
        field.font = .inter(17)
        field.textColor = PCTheme.ink
        field.keyboardType = keyboard
        field.autocapitalizationType = capitalization
        field.autocorrectionType = .no
        field.spellCheckingType = .no
        field.returnKeyType = .done
        field.clearButtonMode = .whileEditing
        field.addAction(UIAction { [weak self] _ in self?.field.resignFirstResponder() }, for: .editingDidEndOnExit)
        let box = POUI.padded(field, UIEdgeInsets(top: 15, left: 14, bottom: 15, right: 14))
        box.backgroundColor = POUI.field
        box.layer.cornerRadius = 14
        box.layer.cornerCurve = .continuous
        let stack = UIStackView(arrangedSubviews: [cap, box])
        stack.axis = .vertical
        stack.spacing = 6
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor),
            stack.topAnchor.constraint(equalTo: topAnchor),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

/// Coche verte animée (cercle puis coche qui se dessinent).
@available(iOS 26.0, *)
final class POCheckView: UIView {
    private let circle = CAShapeLayer()
    private let check = CAShapeLayer()

    override init(frame: CGRect) {
        super.init(frame: frame)
        for layer in [circle, check] {
            layer.fillColor = UIColor.clear.cgColor
            layer.strokeColor = POUI.green.cgColor
            layer.lineCap = .round
            layer.lineJoin = .round
            layer.strokeEnd = 0
            self.layer.addSublayer(layer)
        }
        circle.lineWidth = 4
        check.lineWidth = 5
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func layoutSubviews() {
        super.layoutSubviews()
        let w = bounds.width, h = bounds.height
        circle.frame = bounds
        check.frame = bounds
        circle.path = UIBezierPath(
            arcCenter: CGPoint(x: w / 2, y: h / 2), radius: min(w, h) / 2 - 3,
            startAngle: -.pi / 2, endAngle: .pi * 1.5, clockwise: true
        ).cgPath
        let p = UIBezierPath()
        p.move(to: CGPoint(x: w * 0.32, y: h * 0.52))
        p.addLine(to: CGPoint(x: w * 0.44, y: h * 0.64))
        p.addLine(to: CGPoint(x: w * 0.69, y: h * 0.37))
        check.path = p.cgPath
    }

    func play() {
        func draw(_ layer: CAShapeLayer, duration: CFTimeInterval, delay: CFTimeInterval) {
            layer.strokeEnd = 1
            let a = CABasicAnimation(keyPath: "strokeEnd")
            a.fromValue = 0
            a.toValue = 1
            a.duration = duration
            a.beginTime = CACurrentMediaTime() + delay
            a.fillMode = .backwards
            a.timingFunction = CAMediaTimingFunction(name: .easeOut)
            layer.add(a, forKey: "draw")
        }
        draw(circle, duration: 0.45, delay: 0)
        draw(check, duration: 0.3, delay: 0.38)
    }
}

// MARK: - Écran principal Versements (calqué sur la capture)

@available(iOS 26.0, *)
final class PayoutsViewController: UIViewController, UIGestureRecognizerDelegate, DetailPushHosting {
    let push = DetailPushTransition()
    var onWillClose: (() -> Void)?
    var onClose: (() -> Void)?
    var onAct: (([String: Any]) -> Void)? {
        didSet { store.onAct = onAct }
    }

    private let store: POStore
    private let scroll = UIScrollView()
    private let content = UIStackView()
    private let topFade = UIView()
    private let fadeLayer = CAGradientLayer()
    private let backButton = PCGlassButton(symbol: "chevron.left", circle: true)
    private var didSetInitialOffset = false
    private var closing = false

    private let headingLabel = POUI.label("", 24, .bold)
    private let infoButton = UIButton(type: .system)
    private let amountLabel = POUI.label("", 24, .bold)
    private let flagLabel = POUI.label("", 26)
    private let currencyLabel = UILabel()
    private let viewButton = UIButton(type: .system)
    private let taxesTitle = POUI.label("", 24, .bold)
    private let taxesRow = PCRow(symbol: nil, title: "", chevron: true)
    private let learnLabel = UILabel()

    init(info: [String: Any]) {
        store = POStore(info: info)
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    // MARK: Cycle de vie

    override func viewDidLoad() {
        super.viewDidLoad()
        overrideUserInterfaceStyle = .light
        view.backgroundColor = POUI.pageBg
        buildScroll()
        buildTopBar()
        buildContent()
        refresh()
        store.observe(self) { [weak self] in self?.refresh() }

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
        let bottom = view.safeAreaInsets.bottom + 32
        if abs(scroll.contentInset.bottom - bottom) > 0.5 {
            scroll.contentInset.bottom = bottom
            scroll.verticalScrollIndicatorInsets.bottom = bottom
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
        guard !closing else { return }
        closing = true
        onWillClose?()
        push.close(velocity: velocity) { [weak self] in
            self?.onClose?()
        }
    }

    /// Nouvel état envoyé par la page web (solde, comptes, historique).
    func update(info: [String: Any]) {
        store.update(info)
    }

    // MARK: Construction

    private func buildScroll() {
        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.alwaysBounceVertical = true
        scroll.contentInsetAdjustmentBehavior = .never
        scroll.showsVerticalScrollIndicator = true
        view.addSubview(scroll)

        content.axis = .vertical
        content.spacing = 0
        content.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(content)
        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: view.topAnchor),
            scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            content.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor),
            content.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor),
            content.leadingAnchor.constraint(equalTo: scroll.frameLayoutGuide.leadingAnchor, constant: 16),
            content.trailingAnchor.constraint(equalTo: scroll.frameLayoutGuide.trailingAnchor, constant: -16),
        ])
    }

    private func buildTopBar() {
        topFade.isUserInteractionEnabled = false
        fadeLayer.colors = [POUI.pageBg.withAlphaComponent(0.96).cgColor, POUI.pageBg.withAlphaComponent(0).cgColor]
        topFade.layer.addSublayer(fadeLayer)
        view.addSubview(topFade)

        backButton.onTap = { [weak self] in self?.closeAnimated() }
        view.addSubview(backButton)
        NSLayoutConstraint.activate([
            backButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 6),
            backButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
        ])
    }

    private func buildContent() {
        // « Solde des versements ⓘ »
        infoButton.setImage(PCTheme.symbol("info.circle", 21, .regular), for: .normal)
        infoButton.tintColor = UIColor(white: 0.36, alpha: 1)
        infoButton.addAction(UIAction { [weak self] _ in self?.showInfo() }, for: .touchUpInside)
        infoButton.setContentHuggingPriority(.required, for: .horizontal)
        headingLabel.setContentHuggingPriority(.required, for: .horizontal)
        let heading = UIStackView(arrangedSubviews: [headingLabel, infoButton, UIView()])
        heading.axis = .horizontal
        heading.alignment = .center
        heading.spacing = 10
        content.addArrangedSubview(UIView.spacer(8))
        content.addArrangedSubview(UIView.inset(heading, left: 4))
        content.addArrangedSubview(UIView.spacer(14))

        // Carte du solde : montant + ligne de devise (drapeau, « 0,00 € EUR »)
        let flagWrap = UIView()
        flagWrap.translatesAutoresizingMaskIntoConstraints = false
        flagLabel.translatesAutoresizingMaskIntoConstraints = false
        flagWrap.addSubview(flagLabel)
        NSLayoutConstraint.activate([
            flagWrap.widthAnchor.constraint(equalToConstant: 44),
            flagLabel.centerXAnchor.constraint(equalTo: flagWrap.centerXAnchor),
            flagLabel.centerYAnchor.constraint(equalTo: flagWrap.centerYAnchor),
        ])
        let curRow = UIStackView(arrangedSubviews: [flagWrap, currencyLabel])
        curRow.axis = .horizontal
        curRow.alignment = .center
        curRow.spacing = 14
        let curBox = UIView.padded(curRow, top: 12, left: 14, bottom: 12, right: 14)
        curBox.backgroundColor = UIColor(white: 0.965, alpha: 1)
        curBox.layer.cornerRadius = 16
        curBox.layer.cornerCurve = .continuous

        let cardStack = UIStackView(arrangedSubviews: [amountLabel, curBox])
        cardStack.axis = .vertical
        cardStack.spacing = 22
        let card = PCDetailCard(rows: [UIView.padded(cardStack, top: 20, left: 20, bottom: 20, right: 20)])
        let cardTap = UITapGestureRecognizer(target: self, action: #selector(showPayouts))
        card.addGestureRecognizer(cardTap)
        content.addArrangedSubview(card)

        // « Afficher les versements »
        viewButton.titleLabel?.font = .inter(20, .regular)
        viewButton.setTitleColor(POUI.link, for: .normal)
        viewButton.addAction(UIAction { [weak self] _ in PCTheme.haptic(); self?.showPayouts() }, for: .touchUpInside)
        content.addArrangedSubview(UIView.spacer(14))
        content.addArrangedSubview(UIView.inset(viewButton, left: 0, height: 52))
        content.addArrangedSubview(UIView.spacer(44))

        // Taxes
        content.addArrangedSubview(UIView.inset(taxesTitle, left: 4))
        content.addArrangedSubview(UIView.spacer(14))
        taxesRow.titleLabel.font = .inter(19, .regular)
        taxesRow.heightAnchor.constraint(greaterThanOrEqualToConstant: 62).isActive = true
        taxesRow.onTap { [weak self] in self?.toast(self?.store.str("soon") ?? "") }
        content.addArrangedSubview(PCDetailCard(rows: [taxesRow]))
        content.addArrangedSubview(UIView.spacer(16))

        // « En savoir plus sur Shopify Finance »
        learnLabel.numberOfLines = 0
        learnLabel.isUserInteractionEnabled = true
        learnLabel.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(openFinanceLink)))
        content.addArrangedSubview(UIView.inset(learnLabel, left: 20))
    }

    // MARK: Mise à jour

    private func refresh() {
        headingLabel.text = store.str("balanceTitle")
        amountLabel.text = store.str("balance")
        flagLabel.text = store.str("flag")
        let cur = NSMutableAttributedString(
            string: store.str("curRow"),
            attributes: [.font: UIFont.inter(20, .regular), .foregroundColor: PCTheme.ink]
        )
        cur.append(NSAttributedString(
            string: " " + store.str("cur"),
            attributes: [.font: UIFont.inter(20, .regular), .foregroundColor: UIColor(white: 0.42, alpha: 1)]
        ))
        currencyLabel.attributedText = cur
        viewButton.setTitle(store.str("viewPayouts"), for: .normal)
        taxesTitle.text = store.str("taxes")
        taxesRow.titleLabel.text = store.str("taxSetup")

        let gray = UIColor(white: 0.30, alpha: 1)
        let learn = NSMutableAttributedString(
            string: store.str("learn") + " ",
            attributes: [.font: UIFont.inter(18), .foregroundColor: gray]
        )
        learn.append(NSAttributedString(
            string: store.str("learnLink"),
            attributes: [
                .font: UIFont.inter(18), .foregroundColor: gray,
                .underlineStyle: NSUnderlineStyle.single.rawValue,
            ]
        ))
        learnLabel.attributedText = learn
    }

    // MARK: Actions

    private func showInfo() {
        PCTheme.haptic()
        let alert = UIAlertController(title: store.str("balanceTitle"), message: store.str("balanceInfo"), preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: store.s("done").isEmpty ? "OK" : store.s("done"), style: .default))
        present(alert, animated: true)
    }

    @objc private func showPayouts() {
        guard presentedViewController == nil else { return }
        let list = POListViewController(store: store)
        let nav = UINavigationController(rootViewController: list)
        nav.overrideUserInterfaceStyle = .light
        nav.modalPresentationStyle = .pageSheet
        if let sheet = nav.sheetPresentationController {
            sheet.detents = [.large()]
            sheet.prefersGrabberVisible = true
        }
        present(nav, animated: true)
    }

    @objc private func openFinanceLink() {
        PCTheme.haptic()
        if let url = URL(string: "https://www.shopify.com/finance") { UIApplication.shared.open(url) }
    }

    private func toast(_ text: String) {
        guard !text.isEmpty else { return }
        let l = POUI.label(text, 15, .semibold, color: .white, align: .center)
        let box = POUI.padded(l, UIEdgeInsets(top: 12, left: 20, bottom: 12, right: 20))
        box.backgroundColor = UIColor(white: 0.1, alpha: 0.92)
        box.layer.cornerRadius = 20
        box.layer.cornerCurve = .continuous
        box.alpha = 0
        box.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(box)
        NSLayoutConstraint.activate([
            box.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            box.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -24),
            box.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 24),
        ])
        UIView.animate(withDuration: 0.2) { box.alpha = 1 }
        UIView.animate(withDuration: 0.25, delay: 1.6, options: []) {
            box.alpha = 0
        } completion: { _ in
            box.removeFromSuperview()
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
                closeAnimated(velocity: vx)
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

private extension UIView {
    static func spacer(_ height: CGFloat) -> UIView {
        let v = UIView()
        v.translatesAutoresizingMaskIntoConstraints = false
        v.heightAnchor.constraint(equalToConstant: height).isActive = true
        return v
    }

    static func inset(_ child: UIView, left: CGFloat, height: CGFloat? = nil) -> UIView {
        let wrap = UIView.padded(child, top: 0, left: left, bottom: 0, right: 0)
        if let height { wrap.heightAnchor.constraint(equalToConstant: height).isActive = true }
        return wrap
    }

    static func padded(_ child: UIView, top: CGFloat, left: CGFloat, bottom: CGFloat, right: CGFloat) -> UIView {
        let wrap = UIView()
        child.translatesAutoresizingMaskIntoConstraints = false
        wrap.addSubview(child)
        NSLayoutConstraint.activate([
            child.leadingAnchor.constraint(equalTo: wrap.leadingAnchor, constant: left),
            child.trailingAnchor.constraint(equalTo: wrap.trailingAnchor, constant: -right),
            child.topAnchor.constraint(equalTo: wrap.topAnchor, constant: top),
            child.bottomAnchor.constraint(equalTo: wrap.bottomAnchor, constant: -bottom),
        ])
        return wrap
    }
}

// MARK: - Liste des versements (feuille) + détail

@available(iOS 26.0, *)
final class POListViewController: UIViewController {
    private let store: POStore
    private let scroll = UIScrollView()
    private let stack = UIStackView()

    init(store: POStore) {
        self.store = store
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = POUI.pageBg
        navigationItem.title = store.str("listTitle")
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            systemItem: .close,
            primaryAction: UIAction { [weak self] _ in self?.dismiss(animated: true) }
        )

        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.alwaysBounceVertical = true
        view.addSubview(scroll)
        stack.axis = .vertical
        stack.spacing = 14
        stack.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(stack)
        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: view.topAnchor),
            scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            stack.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor, constant: 8),
            stack.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor, constant: -32),
            stack.leadingAnchor.constraint(equalTo: scroll.frameLayoutGuide.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: scroll.frameLayoutGuide.trailingAnchor, constant: -16),
        ])
        rebuild()
        store.observe(self) { [weak self] in self?.rebuild() }
    }

    private func rebuild() {
        navigationItem.title = store.str("listTitle")
        for v in stack.arrangedSubviews {
            stack.removeArrangedSubview(v)
            v.removeFromSuperview()
        }
        stack.addArrangedSubview(heroCard())
        if store.flag("statsOn") { stack.addArrangedSubview(statsRow()) }

        stack.addArrangedSubview(UIView.inset(POUI.label(store.str("listTitle"), 22, .bold), left: 4))
        let items = store.items
        if items.isEmpty {
            stack.addArrangedSubview(emptyCard())
        } else {
            var rows: [UIView] = []
            for (i, item) in items.enumerated() {
                if i > 0 { rows.append(ODSeparator()) }
                let row = POPayoutRow(item: item)
                row.addAction(UIAction { [weak self] _ in
                    PCTheme.haptic()
                    self?.openDetail(item)
                }, for: .touchUpInside)
                rows.append(row)
            }
            stack.addArrangedSubview(PCDetailCard(rows: rows))
        }
    }

    private func heroCard() -> UIView {
        let top = UIStackView()
        top.axis = .horizontal
        top.alignment = .center
        top.spacing = 8
        top.addArrangedSubview(POUI.label(store.str("avail"), 15, .medium, color: PCTheme.sub))
        top.addArrangedSubview(UIView())
        if !store.str("est").isEmpty { top.addArrangedSubview(POUI.chip(store.str("est"))) }

        let balance = POUI.label(store.str("balance"), 40, .bold)
        balance.adjustsFontSizeToFitWidth = true
        balance.minimumScaleFactor = 0.6

        let icon = UIImageView(image: PCTheme.symbol("building.columns", 14, .regular))
        icon.tintColor = PCTheme.sub
        icon.setContentHuggingPriority(.required, for: .horizontal)
        let account = UIStackView(arrangedSubviews: [icon, POUI.label(store.str("account"), 15, .regular, color: PCTheme.sub), UIView()])
        account.axis = .horizontal
        account.alignment = .center
        account.spacing = 7

        let transfer = POUI.primaryButton(store.str("transferLabel"), symbol: "arrow.up.right")
        transfer.isEnabled = store.balance > 0
        transfer.addAction(UIAction { [weak self] _ in self?.startTransfer() }, for: .touchUpInside)

        let inner = UIStackView(arrangedSubviews: [top, balance, account, transfer])
        inner.axis = .vertical
        inner.spacing = 12
        inner.setCustomSpacing(18, after: account)
        return PCDetailCard(rows: [UIView.padded(inner, top: 18, left: 20, bottom: 20, right: 20)])
    }

    private func statsRow() -> UIView {
        func cell(_ title: String, _ value: String) -> UIView {
            let s = UIStackView(arrangedSubviews: [
                POUI.label(title, 14, .medium, color: PCTheme.sub),
                POUI.label(value, 20, .bold),
            ])
            s.axis = .vertical
            s.spacing = 4
            return UIView.padded(s, top: 14, left: 16, bottom: 14, right: 16)
        }
        let a = PCDetailCard(rows: [cell(store.str("inTransitL"), store.str("inTransit"))])
        let b = PCDetailCard(rows: [cell(store.str("sentL"), store.str("sent"))])
        let row = UIStackView(arrangedSubviews: [a, b])
        row.axis = .horizontal
        row.spacing = 12
        row.distribution = .fillEqually
        return row
    }

    private func emptyCard() -> UIView {
        let icon = UIImageView(image: PCTheme.symbol("arrow.up.right", 22, .semibold))
        icon.tintColor = PCTheme.sub
        let s = UIStackView(arrangedSubviews: [
            icon,
            POUI.label(store.str("empty"), 17, .semibold, align: .center),
            POUI.label(store.str("emptySub"), 15, .regular, color: PCTheme.sub, lines: 0, align: .center),
        ])
        s.axis = .vertical
        s.alignment = .center
        s.spacing = 8
        return PCDetailCard(rows: [UIView.padded(s, top: 28, left: 20, bottom: 28, right: 20)])
    }

    private func startTransfer() {
        guard store.balance > 0, let nav = navigationController else { return }
        PCTheme.haptic()
        let flow = POTransfer(store: store)
        nav.pushViewController(POMethodViewController(store: store, flow: flow), animated: true)
    }

    private func openDetail(_ item: POItem) {
        navigationController?.pushViewController(PODetailViewController(store: store, item: item), animated: true)
    }
}

/// Ligne de la liste : pastille, titre, date • destination, montant et statut.
@available(iOS 26.0, *)
final class POPayoutRow: UIControl {
    init(item: POItem) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false

        let iconBox = UIView()
        iconBox.backgroundColor = item.inTransit ? UIColor(white: 0.90, alpha: 1) : UIColor(red: 0.86, green: 0.96, blue: 0.88, alpha: 1)
        iconBox.layer.cornerRadius = 20
        iconBox.layer.cornerCurve = .continuous
        iconBox.translatesAutoresizingMaskIntoConstraints = false
        let icon = UIImageView(image: PCTheme.symbol(item.isBank ? "arrow.up.right" : "bag", 16, .semibold))
        icon.tintColor = item.inTransit ? PCTheme.ink : PCTheme.okFg
        icon.translatesAutoresizingMaskIntoConstraints = false
        iconBox.addSubview(icon)
        NSLayoutConstraint.activate([
            iconBox.widthAnchor.constraint(equalToConstant: 40),
            iconBox.heightAnchor.constraint(equalToConstant: 40),
            icon.centerXAnchor.constraint(equalTo: iconBox.centerXAnchor),
            icon.centerYAnchor.constraint(equalTo: iconBox.centerYAnchor),
        ])

        let title = POUI.label(item.title, 16, .semibold)
        let sub = POUI.label(item.sub, 14, .regular, color: PCTheme.sub, lines: 2)
        let left = UIStackView(arrangedSubviews: [title, sub])
        left.axis = .vertical
        left.spacing = 2

        let amount = POUI.label(item.amount, 16, .semibold, align: .right)
        amount.setContentCompressionResistancePriority(.required, for: .horizontal)
        let badge = ODBadge(text: item.status, kind: item.inTransit ? "info" : "ok")
        let right = UIStackView(arrangedSubviews: [amount, badge])
        right.axis = .vertical
        right.alignment = .trailing
        right.spacing = 4
        right.setContentHuggingPriority(.required, for: .horizontal)

        let row = UIStackView(arrangedSubviews: [iconBox, left, right])
        row.axis = .horizontal
        row.alignment = .center
        row.spacing = 12
        row.isUserInteractionEnabled = false
        row.translatesAutoresizingMaskIntoConstraints = false
        addSubview(row)
        NSLayoutConstraint.activate([
            row.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            row.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            row.topAnchor.constraint(equalTo: topAnchor, constant: 12),
            row.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -12),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override var isHighlighted: Bool {
        didSet { backgroundColor = isHighlighted ? UIColor(white: 0, alpha: 0.05) : .clear }
    }
}

/// Détail d'un versement : date, montant, statut et lignes (destination, frais, total…).
@available(iOS 26.0, *)
final class PODetailViewController: UIViewController {
    private let store: POStore
    private let item: POItem

    init(store: POStore, item: POItem) {
        self.store = store
        self.item = item
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = POUI.pageBg
        navigationItem.title = item.title

        let scroll = UIScrollView()
        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.alwaysBounceVertical = true
        view.addSubview(scroll)

        let head = UIStackView(arrangedSubviews: [
            POUI.label(item.date, 16, .medium, color: PCTheme.sub, align: .center),
            POUI.label(item.amount, 40, .bold, align: .center),
            ODBadge(text: item.status, kind: item.inTransit ? "info" : "ok"),
        ])
        head.axis = .vertical
        head.alignment = .center
        head.spacing = 8

        var rows: [UIView] = []
        for (i, r) in item.rows.enumerated() {
            if i > 0 { rows.append(ODSeparator()) }
            rows.append(ODKVRow(label: r.label, sub: r.sub, value: r.value, bold: r.total))
        }
        let stack = UIStackView(arrangedSubviews: [UIView.padded(head, top: 12, left: 0, bottom: 12, right: 0), PCDetailCard(rows: rows)])
        stack.axis = .vertical
        stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(stack)
        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: view.topAnchor),
            scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            stack.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor, constant: 8),
            stack.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor, constant: -32),
            stack.leadingAnchor.constraint(equalTo: scroll.frameLayoutGuide.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: scroll.frameLayoutGuide.trailingAnchor, constant: -16),
        ])
    }
}

// MARK: - Transfert : socle commun des étapes (titre, n/3, bouton fixe en bas)

@available(iOS 26.0, *)
class POFlowBase: UIViewController {
    let store: POStore
    let flow: POTransfer
    let stepNumber: Int
    let scroll = UIScrollView()
    let stack = UIStackView()
    let footer = UIView()
    let primary = POUI.primaryButton("")

    init(store: POStore, flow: POTransfer, step: Int) {
        self.store = store
        self.flow = flow
        self.stepNumber = step
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .white
        navigationItem.title = store.s("transfer")
        if stepNumber <= 3 {
            let step = UIBarButtonItem(title: "\(stepNumber)/3", style: .plain, target: nil, action: nil)
            step.isEnabled = false
            navigationItem.rightBarButtonItem = step
        }

        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.alwaysBounceVertical = true
        scroll.keyboardDismissMode = .interactive
        footer.translatesAutoresizingMaskIntoConstraints = false
        footer.backgroundColor = .white
        view.addSubview(scroll)
        view.addSubview(footer)

        stack.axis = .vertical
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(stack)

        footer.addSubview(primary)
        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: footer.topAnchor),
            footer.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            footer.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            footer.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor),
            stack.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor, constant: 12),
            stack.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor, constant: -20),
            stack.leadingAnchor.constraint(equalTo: scroll.frameLayoutGuide.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: scroll.frameLayoutGuide.trailingAnchor, constant: -16),
            primary.leadingAnchor.constraint(equalTo: footer.leadingAnchor, constant: 16),
            primary.trailingAnchor.constraint(equalTo: footer.trailingAnchor, constant: -16),
            primary.topAnchor.constraint(equalTo: footer.topAnchor, constant: 8),
            primary.bottomAnchor.constraint(equalTo: footer.bottomAnchor, constant: -8),
        ])
    }

    func heading(_ title: String, _ text: String) -> UIView {
        let s = UIStackView(arrangedSubviews: [
            POUI.label(title, 26, .bold, lines: 0),
            POUI.label(text, 16, .regular, color: PCTheme.sub, lines: 0),
        ])
        s.axis = .vertical
        s.spacing = 6
        return UIView.padded(s, top: 4, left: 2, bottom: 10, right: 2)
    }

    func clearStack() {
        for v in stack.arrangedSubviews {
            stack.removeArrangedSubview(v)
            v.removeFromSuperview()
        }
    }
}

// MARK: Étape 1 : méthode de retrait

/// Carte à choisir (compte bancaire / PayPal) avec pastille de sélection.
@available(iOS 26.0, *)
final class POOptionView: UIControl {
    private let radio = UIView()
    private let dot = UIView()

    init(symbol: String, title: String, sub: String) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = .white
        layer.cornerRadius = 18
        layer.cornerCurve = .continuous
        layer.borderWidth = 1
        layer.borderColor = UIColor(white: 0, alpha: 0.12).cgColor

        let icon = UIImageView(image: PCTheme.symbol(symbol, 18, .regular))
        icon.tintColor = PCTheme.ink
        let iconBox = UIView()
        iconBox.backgroundColor = UIColor(white: 0.94, alpha: 1)
        iconBox.layer.cornerRadius = 20
        iconBox.translatesAutoresizingMaskIntoConstraints = false
        icon.translatesAutoresizingMaskIntoConstraints = false
        iconBox.addSubview(icon)

        radio.layer.cornerRadius = 11
        radio.layer.borderWidth = 2
        radio.layer.borderColor = UIColor(white: 0.7, alpha: 1).cgColor
        radio.translatesAutoresizingMaskIntoConstraints = false
        dot.backgroundColor = PCTheme.ink
        dot.layer.cornerRadius = 6
        dot.translatesAutoresizingMaskIntoConstraints = false
        radio.addSubview(dot)

        let texts = UIStackView(arrangedSubviews: [
            POUI.label(title, 17, .semibold),
            POUI.label(sub, 14, .regular, color: PCTheme.sub),
        ])
        texts.axis = .vertical
        texts.spacing = 2
        let row = UIStackView(arrangedSubviews: [iconBox, texts, radio])
        row.axis = .horizontal
        row.alignment = .center
        row.spacing = 12
        row.isUserInteractionEnabled = false
        row.translatesAutoresizingMaskIntoConstraints = false
        addSubview(row)
        NSLayoutConstraint.activate([
            iconBox.widthAnchor.constraint(equalToConstant: 40),
            iconBox.heightAnchor.constraint(equalToConstant: 40),
            icon.centerXAnchor.constraint(equalTo: iconBox.centerXAnchor),
            icon.centerYAnchor.constraint(equalTo: iconBox.centerYAnchor),
            radio.widthAnchor.constraint(equalToConstant: 22),
            radio.heightAnchor.constraint(equalToConstant: 22),
            dot.centerXAnchor.constraint(equalTo: radio.centerXAnchor),
            dot.centerYAnchor.constraint(equalTo: radio.centerYAnchor),
            dot.widthAnchor.constraint(equalToConstant: 12),
            dot.heightAnchor.constraint(equalToConstant: 12),
            row.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 14),
            row.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -14),
            row.topAnchor.constraint(equalTo: topAnchor, constant: 14),
            row.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -14),
        ])
        setPicked(false)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func setPicked(_ on: Bool) {
        dot.isHidden = !on
        radio.layer.borderColor = (on ? PCTheme.ink : UIColor(white: 0.7, alpha: 1)).cgColor
        layer.borderWidth = on ? 2 : 1
        layer.borderColor = (on ? PCTheme.ink : UIColor(white: 0, alpha: 0.12)).cgColor
    }
}

@available(iOS 26.0, *)
final class POMethodViewController: POFlowBase {
    private var bankOption: POOptionView?
    private var paypalOption: POOptionView?

    init(store: POStore, flow: POTransfer) {
        super.init(store: store, flow: flow, step: 1)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        stack.addArrangedSubview(heading(store.s("methodH"), store.s("methodP")))
        let bank = POOptionView(symbol: "building.columns", title: store.s("bank"), sub: store.s("bankSub"))
        let paypal = POOptionView(symbol: "wallet.bifold", title: store.s("paypal"), sub: store.s("paypalSub"))
        bankOption = bank
        paypalOption = paypal
        bank.addAction(UIAction { [weak self] _ in self?.pick("bank") }, for: .touchUpInside)
        paypal.addAction(UIAction { [weak self] _ in self?.pick("paypal") }, for: .touchUpInside)
        stack.addArrangedSubview(bank)
        stack.addArrangedSubview(paypal)
        pick(flow.method, haptic: false)

        POUI.setTitle(primary, store.s("cont"))
        primary.addAction(UIAction { [weak self] _ in
            guard let self else { return }
            PCTheme.haptic()
            self.navigationController?.pushViewController(POAmountViewController(store: self.store, flow: self.flow), animated: true)
        }, for: .touchUpInside)
    }

    private func pick(_ method: String, haptic: Bool = true) {
        flow.method = method
        bankOption?.setPicked(method == "bank")
        paypalOption?.setPicked(method == "paypal")
        if haptic { UISelectionFeedbackGenerator().selectionChanged() }
    }
}

// MARK: Étape 2 : montant (clavier numérique)

@available(iOS 26.0, *)
final class POAmountViewController: POFlowBase {
    private let amountLabel = POUI.label("0", 56, .bold, align: .center)
    private let symbolLabel = POUI.label("", 34, .semibold, color: PCTheme.sub)
    private let availableButton = UIButton(type: .system)
    private var amountRow: UIStackView?

    init(store: POStore, flow: POTransfer) {
        super.init(store: store, flow: flow, step: 2)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        scroll.isScrollEnabled = true

        symbolLabel.text = store.symbol.trimmingCharacters(in: .whitespaces)
        amountLabel.adjustsFontSizeToFitWidth = true
        amountLabel.minimumScaleFactor = 0.5
        let order: [UIView] = store.symAfter ? [amountLabel, symbolLabel] : [symbolLabel, amountLabel]
        let row = UIStackView(arrangedSubviews: order)
        row.axis = .horizontal
        row.alignment = .firstBaseline
        row.spacing = 6
        amountRow = row
        stack.addArrangedSubview(UIView.padded(POUI.centered(row), top: 20, left: 0, bottom: 14, right: 0))

        // Pastilles : méthode choisie + solde disponible (touche pour tout transférer)
        let methodIcon = UIImageView(image: PCTheme.symbol(flow.method == "bank" ? "building.columns" : "wallet.bifold", 14, .regular))
        methodIcon.tintColor = PCTheme.ink
        let methodChip = UIStackView(arrangedSubviews: [methodIcon, POUI.label(flow.method == "bank" ? store.s("bank") : store.s("paypal"), 14, .medium)])
        methodChip.axis = .horizontal
        methodChip.spacing = 6
        let methodBox = UIView.padded(methodChip, top: 8, left: 12, bottom: 8, right: 12)
        methodBox.backgroundColor = POUI.field
        methodBox.layer.cornerRadius = 16

        var config = UIButton.Configuration.plain()
        config.title = store.money(store.balance) + "  " + store.s("available")
        config.baseForegroundColor = PCTheme.ink
        config.contentInsets = NSDirectionalEdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12)
        config.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { attrs in
            var attrs = attrs
            attrs.font = UIFont.inter(14, .medium)
            return attrs
        }
        availableButton.configuration = config
        availableButton.backgroundColor = POUI.field
        availableButton.layer.cornerRadius = 16
        availableButton.addAction(UIAction { [weak self] _ in
            guard let self else { return }
            self.flow.amount = self.store.toStr(self.store.balance)
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            self.updateAmount()
        }, for: .touchUpInside)

        let chips = UIStackView(arrangedSubviews: [methodBox, availableButton])
        chips.axis = .horizontal
        chips.spacing = 10
        chips.alignment = .center
        stack.addArrangedSubview(POUI.centered(chips))
        stack.addArrangedSubview(UIView.spacerView(14))

        stack.addArrangedSubview(keypad())

        primary.addAction(UIAction { [weak self] _ in
            guard let self else { return }
            PCTheme.haptic()
            self.navigationController?.pushViewController(POAccountViewController(store: self.store, flow: self.flow), animated: true)
        }, for: .touchUpInside)
        updateAmount()
    }

    private func keypad() -> UIView {
        let sep = store.dec > 0 ? store.sep : ""
        let layout: [[String]] = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], [sep, "0", "del"]]
        let rows = UIStackView()
        rows.axis = .vertical
        rows.spacing = 6
        rows.distribution = .fillEqually
        for line in layout {
            let r = UIStackView()
            r.axis = .horizontal
            r.distribution = .fillEqually
            r.spacing = 6
            for key in line {
                if key.isEmpty {
                    r.addArrangedSubview(UIView())
                    continue
                }
                let b = UIButton(type: .system)
                if key == "del" {
                    b.setImage(PCTheme.symbol("delete.left", 22, .regular), for: .normal)
                } else {
                    b.setTitle(key, for: .normal)
                    b.titleLabel?.font = .inter(30, .medium)
                }
                b.tintColor = PCTheme.ink
                b.setTitleColor(PCTheme.ink, for: .normal)
                b.addAction(UIAction { [weak self] _ in self?.tap(key) }, for: .touchUpInside)
                r.addArrangedSubview(b)
            }
            rows.addArrangedSubview(r)
        }
        rows.heightAnchor.constraint(equalToConstant: 4 * 62 + 3 * 6).isActive = true
        return rows
    }

    private func tap(_ key: String) {
        let before = flow.amount
        let sep = store.sep
        if key == "del" {
            if !flow.amount.isEmpty { flow.amount.removeLast() }
        } else if key == sep {
            if !flow.amount.contains(sep) { flow.amount += (flow.amount.isEmpty ? "0" : "") + sep }
        } else {
            let parts = flow.amount.components(separatedBy: sep)
            if parts.count > 1, parts[1].count >= store.dec {
                UINotificationFeedbackGenerator().notificationOccurred(.warning)
                return
            }
            if flow.amount.replacingOccurrences(of: sep, with: "").count >= 9 {
                UINotificationFeedbackGenerator().notificationOccurred(.warning)
                return
            }
            flow.amount = flow.amount == "0" ? key : flow.amount + key
        }
        if flow.amount == before { return }
        UISelectionFeedbackGenerator().selectionChanged()
        updateAmount()
        if store.toCents(flow.amount) > store.balance { shake() }
    }

    private func updateAmount() {
        let cents = store.toCents(flow.amount)
        let over = cents > store.balance
        amountLabel.text = flow.amount.isEmpty ? "0" : flow.amount
        amountLabel.textColor = over ? POUI.danger : PCTheme.ink
        let valid = cents > 0 && !over
        primary.isEnabled = valid
        POUI.setTitle(primary, cents > 0 ? store.s("cont") + " · " + store.money(cents) : store.s("cont"))
    }

    private func shake() {
        UINotificationFeedbackGenerator().notificationOccurred(.warning)
        let a = CAKeyframeAnimation(keyPath: "transform.translation.x")
        a.values = [0, -9, 9, -6, 6, -3, 3, 0]
        a.duration = 0.4
        amountRow?.layer.add(a, forKey: "shake")
    }
}

private extension UIView {
    static func spacerView(_ h: CGFloat) -> UIView { spacer(h) }
}

// MARK: Étape 3 : compte bancaire ou e-mail PayPal

@available(iOS 26.0, *)
final class POAccountViewController: POFlowBase {
    private let errorLabel = POUI.errorLabel()
    private var mailField: POField?
    private var nameField: POField?
    private var ibanField: POField?

    init(store: POStore, flow: POTransfer) {
        super.init(store: store, flow: flow, step: 3)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        primary.addAction(UIAction { [weak self] _ in self?.continueTapped() }, for: .touchUpInside)
        rebuild()
    }

    private func rebuild() {
        clearStack()
        let cents = store.toCents(flow.amount)
        let label = store.s("transfer") + " · " + store.money(cents)
        POUI.setTitle(primary, label)

        if flow.method == "paypal" {
            stack.addArrangedSubview(heading(store.s("mailH"), store.s("mailP")))
            let f = POField(caption: store.s("mailH"), placeholder: "name@example.com", keyboard: .emailAddress)
            f.field.text = flow.email
            f.field.textContentType = .emailAddress
            mailField = f
            stack.addArrangedSubview(f)
            stack.addArrangedSubview(errorLabel)
            primary.isEnabled = true
            return
        }

        stack.addArrangedSubview(heading(store.s("chooseH"), store.s("chooseP") + " " + store.money(cents) + "."))
        for acc in flow.accounts {
            let row = POAccountRow(account: acc, picked: acc.id == flow.sel && !flow.adding, deleteTitle: store.s("del"))
            row.addAction(UIAction { [weak self] _ in
                guard let self else { return }
                self.flow.sel = acc.id
                self.flow.adding = false
                UISelectionFeedbackGenerator().selectionChanged()
                self.rebuild()
            }, for: .touchUpInside)
            row.onDelete = { [weak self] in self?.removeAccount(acc) }
            stack.addArrangedSubview(row)
        }

        if flow.adding {
            let name = POField(caption: store.s("holder"), keyboard: .default, capitalization: .words)
            name.field.textContentType = .name
            let iban = POField(caption: store.s("iban"), placeholder: "FR76 0000 0000 0000 0000 0000 000", keyboard: .asciiCapable, capitalization: .allCharacters)
            nameField = name
            ibanField = iban
            stack.addArrangedSubview(name)
            stack.addArrangedSubview(iban)
            stack.addArrangedSubview(errorLabel)

            let save = POUI.primaryButton(store.s("save"))
            save.addAction(UIAction { [weak self] _ in self?.saveAccount() }, for: .touchUpInside)
            stack.addArrangedSubview(save)
            if !flow.accounts.isEmpty {
                var config = UIButton.Configuration.plain()
                config.title = store.s("cancel")
                config.baseForegroundColor = POUI.link
                let cancel = UIButton(configuration: config)
                cancel.addAction(UIAction { [weak self] _ in
                    self?.flow.adding = false
                    self?.rebuild()
                }, for: .touchUpInside)
                stack.addArrangedSubview(cancel)
            }
            primary.isEnabled = false
        } else {
            var config = UIButton.Configuration.plain()
            config.title = store.s("add")
            config.image = PCTheme.symbol("plus", 15, .semibold)
            config.imagePadding = 8
            config.baseForegroundColor = PCTheme.ink
            config.contentInsets = NSDirectionalEdgeInsets(top: 16, leading: 16, bottom: 16, trailing: 16)
            let add = UIButton(configuration: config)
            add.contentHorizontalAlignment = .leading
            add.layer.cornerRadius = 18
            add.layer.cornerCurve = .continuous
            add.layer.borderWidth = 1
            add.layer.borderColor = UIColor(white: 0, alpha: 0.12).cgColor
            add.addAction(UIAction { [weak self] _ in
                self?.flow.adding = true
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                self?.rebuild()
            }, for: .touchUpInside)
            stack.addArrangedSubview(add)
            stack.addArrangedSubview(errorLabel)
            primary.isEnabled = true
        }
    }

    private func removeAccount(_ acc: POAccount) {
        flow.accounts.removeAll { $0.id == acc.id }
        if flow.sel == acc.id { flow.sel = flow.accounts.first?.id ?? "" }
        if flow.accounts.isEmpty { flow.adding = true }
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        store.act(["act": "delAccount", "id": acc.id])
        rebuild()
    }

    private func saveAccount() {
        let name = (nameField?.field.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let iban = (ibanField?.field.text ?? "").replacingOccurrences(of: " ", with: "").uppercased()
        if name.isEmpty { return POUI.showError(errorLabel, store.s("eName")) }
        if !POUI.isIBAN(iban) { return POUI.showError(errorLabel, store.s("eIban")) }
        let id = "a" + String(Int(Date().timeIntervalSince1970 * 1000))
        let compact = iban
        let label = String(compact.prefix(4)) + " •••• " + String(compact.suffix(4))
        flow.accounts.append(POAccount(id: id, holder: name, label: label))
        flow.sel = id
        flow.adding = false
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        store.act(["act": "addAccount", "id": id, "holder": name, "iban": iban])
        rebuild()
    }

    private func continueTapped() {
        let cents = store.toCents(flow.amount)
        var holder = ""
        var label = ""
        if flow.method == "paypal" {
            let mail = (mailField?.field.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            if !POUI.isEmail(mail) { return POUI.showError(errorLabel, store.s("eMail")) }
            flow.email = mail
            let parts = mail.components(separatedBy: "@")
            label = "PayPal " + String(parts[0].prefix(1)) + "***@" + (parts.count > 1 ? parts[1] : "")
        } else {
            guard let acc = flow.accounts.first(where: { $0.id == flow.sel }) else {
                return POUI.showError(errorLabel, store.s("eAcc"))
            }
            holder = acc.holder
            label = acc.label
        }
        if cents <= 0 || cents > store.balance { return POUI.showError(errorLabel, store.s("eOver")) }
        let fee = store.fee(cents, method: flow.method)
        if cents <= fee { return POUI.showError(errorLabel, store.s("eFee")) }
        flow.fee = fee
        flow.destLabel = label
        flow.destHolder = holder
        PCTheme.haptic()
        navigationController?.pushViewController(POReviewViewController(store: store, flow: flow), animated: true)
    }
}

/// Compte enregistré : pastille de sélection, titulaire, IBAN masqué, corbeille.
@available(iOS 26.0, *)
final class POAccountRow: UIControl {
    var onDelete: (() -> Void)?

    init(account: POAccount, picked: Bool, deleteTitle: String) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = .white
        layer.cornerRadius = 18
        layer.cornerCurve = .continuous
        layer.borderWidth = picked ? 2 : 1
        layer.borderColor = (picked ? PCTheme.ink : UIColor(white: 0, alpha: 0.12)).cgColor

        let radio = UIView()
        radio.layer.cornerRadius = 11
        radio.layer.borderWidth = 2
        radio.layer.borderColor = (picked ? PCTheme.ink : UIColor(white: 0.7, alpha: 1)).cgColor
        radio.translatesAutoresizingMaskIntoConstraints = false
        if picked {
            let dot = UIView()
            dot.backgroundColor = PCTheme.ink
            dot.layer.cornerRadius = 6
            dot.translatesAutoresizingMaskIntoConstraints = false
            radio.addSubview(dot)
            NSLayoutConstraint.activate([
                dot.centerXAnchor.constraint(equalTo: radio.centerXAnchor),
                dot.centerYAnchor.constraint(equalTo: radio.centerYAnchor),
                dot.widthAnchor.constraint(equalToConstant: 12),
                dot.heightAnchor.constraint(equalToConstant: 12),
            ])
        }

        let texts = UIStackView(arrangedSubviews: [
            POUI.label(account.holder, 16, .semibold),
            POUI.label(account.label, 14, .regular, color: PCTheme.sub),
        ])
        texts.axis = .vertical
        texts.spacing = 2

        let trash = UIButton(type: .system)
        trash.setImage(PCTheme.symbol("trash", 17, .regular), for: .normal)
        trash.tintColor = POUI.danger
        trash.accessibilityLabel = deleteTitle
        trash.setContentHuggingPriority(.required, for: .horizontal)
        trash.addAction(UIAction { [weak self] _ in self?.onDelete?() }, for: .touchUpInside)

        let row = UIStackView(arrangedSubviews: [radio, texts, trash])
        row.axis = .horizontal
        row.alignment = .center
        row.spacing = 12
        row.translatesAutoresizingMaskIntoConstraints = false
        addSubview(row)
        NSLayoutConstraint.activate([
            radio.widthAnchor.constraint(equalToConstant: 22),
            radio.heightAnchor.constraint(equalToConstant: 22),
            trash.widthAnchor.constraint(equalToConstant: 36),
            trash.heightAnchor.constraint(equalToConstant: 36),
            row.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 14),
            row.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            row.topAnchor.constraint(equalTo: topAnchor, constant: 12),
            row.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -12),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

// MARK: Récapitulatif + « glisser pour envoyer »

/// Curseur « Glisse pour envoyer » : on tire la pastille jusqu'au bout (88 %), elle se transforme en spinner.
@available(iOS 26.0, *)
final class POSwipeSlider: UIView {
    var onSlide: (() -> Void)?

    private let fill = UIView()
    private let label = UILabel()
    private let knob = UIView()
    private let arrow = UIImageView()
    private let spinner = UIActivityIndicatorView(style: .medium)
    private var progress: CGFloat = 0
    private var done = false
    private var lastTick = -1

    init(text: String) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = UIColor(white: 0.93, alpha: 1)
        clipsToBounds = true

        fill.backgroundColor = PCTheme.ink
        addSubview(fill)

        label.text = text
        label.font = .inter(17, .semibold)
        label.textColor = UIColor(white: 0.35, alpha: 1)
        label.textAlignment = .center
        addSubview(label)

        knob.backgroundColor = .white
        knob.layer.shadowColor = UIColor.black.cgColor
        knob.layer.shadowOpacity = 0.18
        knob.layer.shadowRadius = 5
        knob.layer.shadowOffset = CGSize(width: 0, height: 2)
        addSubview(knob)
        arrow.image = PCTheme.symbol("arrow.right", 20, .bold)
        arrow.tintColor = PCTheme.ink
        arrow.contentMode = .center
        knob.addSubview(arrow)
        spinner.color = PCTheme.ink
        spinner.hidesWhenStopped = true
        knob.addSubview(spinner)
        knob.addGestureRecognizer(UIPanGestureRecognizer(target: self, action: #selector(pan(_:))))
        heightAnchor.constraint(equalToConstant: 62).isActive = true
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private var knobSize: CGFloat { bounds.height - 8 }
    private var travel: CGFloat { max(1, bounds.width - knobSize - 8) }

    override func layoutSubviews() {
        super.layoutSubviews()
        layer.cornerRadius = bounds.height / 2
        place()
    }

    private func place() {
        let k = knobSize
        let x = 4 + progress * travel
        knob.frame = CGRect(x: x, y: 4, width: k, height: k)
        knob.layer.cornerRadius = k / 2
        arrow.frame = knob.bounds
        spinner.frame = knob.bounds
        fill.frame = CGRect(x: 0, y: 0, width: x + k + 4, height: bounds.height)
        label.frame = bounds
        if !done { label.alpha = max(0, 1 - progress / 0.55) }
    }

    @objc private func pan(_ g: UIPanGestureRecognizer) {
        guard !done else { return }
        switch g.state {
        case .began:
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        case .changed:
            let dx = g.translation(in: self).x
            progress = min(1, max(0, dx / travel))
            let tick = Int(progress * 14)
            if tick != lastTick {
                lastTick = tick
                if progress > 0.85 {
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                } else if progress > 0.5 {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                } else {
                    UISelectionFeedbackGenerator().selectionChanged()
                }
            }
            place()
        case .ended, .cancelled, .failed:
            if progress >= 0.88 {
                complete()
            } else {
                UIView.animate(withDuration: 0.45, delay: 0, usingSpringWithDamping: 0.85, initialSpringVelocity: 0.3, options: []) {
                    self.progress = 0
                    self.place()
                }
                lastTick = -1
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
            }
        default:
            break
        }
    }

    private func complete() {
        done = true
        UIView.animate(withDuration: 0.2) {
            self.progress = 1
            self.place()
        }
        arrow.isHidden = true
        spinner.startAnimating()
        onSlide?()
    }

    func setSending(_ text: String) {
        label.text = text
        label.textColor = .white
        label.alpha = 1
    }

    func showDone() {
        spinner.stopAnimating()
        arrow.image = PCTheme.symbol("checkmark", 22, .bold)
        arrow.tintColor = POUI.green
        arrow.isHidden = false
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }
}

@available(iOS 26.0, *)
final class POReviewViewController: POFlowBase {
    private var slider: POSwipeSlider?
    private var sending = false

    init(store: POStore, flow: POTransfer) {
        super.init(store: store, flow: flow, step: 4)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        stack.addArrangedSubview(heading(store.s("reviewH"), store.s("reviewP")))

        let cents = store.toCents(flow.amount)
        var rows: [UIView] = []
        rows.append(ODKVRow(label: store.s("amount"), value: store.money(cents)))
        rows.append(ODSeparator())
        rows.append(ODKVRow(label: store.s("fee"), value: flow.fee > 0 ? "-" + store.money(flow.fee) : store.s("free")))
        rows.append(ODSeparator())
        rows.append(ODKVRow(label: store.s("to"), value: flow.destLabel))
        if !flow.destHolder.isEmpty {
            rows.append(ODSeparator())
            rows.append(ODKVRow(label: store.s("holder"), value: flow.destHolder))
        }
        rows.append(ODSeparator())
        rows.append(ODKVRow(label: store.s("arrival"), value: flow.method == "paypal" ? store.s("arrPaypal") : store.s("arrBank")))
        rows.append(ODSeparator())
        rows.append(ODKVRow(label: store.s("receive"), value: store.money(cents - flow.fee), bold: true))
        stack.addArrangedSubview(PCDetailCard(rows: rows))

        // Le bouton principal laisse la place au curseur
        primary.isHidden = true
        let s = POSwipeSlider(text: store.s("swipe"))
        footer.addSubview(s)
        NSLayoutConstraint.activate([
            s.leadingAnchor.constraint(equalTo: footer.leadingAnchor, constant: 16),
            s.trailingAnchor.constraint(equalTo: footer.trailingAnchor, constant: -16),
            s.topAnchor.constraint(equalTo: footer.topAnchor, constant: 10),
            s.bottomAnchor.constraint(equalTo: footer.bottomAnchor, constant: -10),
        ])
        s.onSlide = { [weak self] in self?.startSending() }
        slider = s
    }

    private func startSending() {
        sending = true
        // Plus de retour possible pendant l'envoi
        navigationItem.hidesBackButton = true
        navigationController?.interactivePopGestureRecognizer?.isEnabled = false
        navigationController?.isModalInPresentation = true
        slider?.setSending(store.s("sending"))
        POUI.burst()

        let wait = 2.0 + Double.random(in: 0..<3.0)   // le chargement dure 2 à 5 secondes
        DispatchQueue.main.asyncAfter(deadline: .now() + max(0.2, wait - 0.35)) { [weak self] in
            self?.slider?.showDone()
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + wait) { [weak self] in
            self?.finish()
        }
    }

    private func finish() {
        let cents = store.toCents(flow.amount)
        store.act([
            "act": "send", "method": flow.method, "cents": cents,
            "sel": flow.sel, "email": flow.email,
        ])
        let net = cents - flow.fee
        let success = POSuccessViewController(
            store: store, amount: store.money(net),
            kind: flow.method == "paypal" ? store.s("paypal") : store.s("bank"),
            dest: flow.destLabel
        )
        navigationController?.pushViewController(success, animated: true)
    }
}

// MARK: Succès

@available(iOS 26.0, *)
final class POSuccessViewController: UIViewController {
    private let store: POStore
    private let amount: String
    private let kind: String
    private let dest: String
    private let check = POCheckView()

    init(store: POStore, amount: String, kind: String, dest: String) {
        self.store = store
        self.amount = amount
        self.kind = kind
        self.dest = dest
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .white
        navigationItem.hidesBackButton = true
        navigationController?.interactivePopGestureRecognizer?.isEnabled = false

        check.translatesAutoresizingMaskIntoConstraints = false
        let title = POUI.label(store.s("sent"), 26, .bold, align: .center)
        let amountLabel = POUI.label(amount, 40, .bold, align: .center)
        let sub = POUI.label(kind + "  " + dest, 16, .regular, color: PCTheme.sub, lines: 0, align: .center)
        let col = UIStackView(arrangedSubviews: [check, title, amountLabel, sub])
        col.axis = .vertical
        col.alignment = .center
        col.spacing = 10
        col.setCustomSpacing(22, after: check)
        col.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(col)

        let done = POUI.primaryButton(store.s("done"))
        done.addAction(UIAction { [weak self] _ in
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            self?.navigationController?.dismiss(animated: true)
        }, for: .touchUpInside)
        view.addSubview(done)

        NSLayoutConstraint.activate([
            check.widthAnchor.constraint(equalToConstant: 88),
            check.heightAnchor.constraint(equalToConstant: 88),
            col.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            col.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: -40),
            col.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 24),
            done.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            done.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            done.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -10),
        ])
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        navigationController?.isModalInPresentation = false
        // Coup sourd à l'ouverture, petits tics pendant que l'anneau se dessine, succès quand la coche arrive.
        UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
        for t in [0.16, 0.28, 0.40] {
            DispatchQueue.main.asyncAfter(deadline: .now() + t) {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.62) {
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
        check.play()
    }
}

#endif
