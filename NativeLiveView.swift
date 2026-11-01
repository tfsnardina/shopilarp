import UIKit

/// Vue en direct native (Liquid Glass, iOS 26) : globe de points qui tourne, visiteurs en ce moment,
/// chiffres du jour, comportement des clients et sessions par lieu. S'ouvre au-dessus de la page web
/// (même « push » que la fiche produit / commande) ; la page web envoie les données (app.js : nativeLiveInfo)
/// puis pousse les chiffres au fil de l'eau (mode « liveUpdate »). Tout le texte arrive déjà traduit.
#if compiler(>=6.2)

// MARK: - Globe

/// Globe de points qui tourne lentement, avec les commandes (violet, anneau) et les visiteurs (bleu, qui pulsent).
/// Même rendu que le globe canvas de la page web.
@available(iOS 26.0, *)
final class LVGlobeView: UIView {
    private struct Dot {
        let cosP: Double, sinP: Double, cosL: Double, sinL: Double
    }

    private var dots: [Dot] = []
    private var pings: [Dot] = []
    private var orderCount = 0
    private var visitors = 0
    private var dead = false
    private var rot: Double = 0            // degrés
    private var didSetHome = false
    private var link: CADisplayLink?
    private var lastTime: CFTimeInterval = 0
    private let tilt = 0.32

    override init(frame: CGRect) {
        super.init(frame: frame)
        isOpaque = false
        backgroundColor = .clear
        contentMode = .redraw
        isUserInteractionEnabled = false
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private static func dot(lat: Double, lon: Double) -> Dot {
        let p = lat * .pi / 180, l = lon * .pi / 180
        return Dot(cosP: cos(p), sinP: sin(p), cosL: cos(l), sinL: sin(l))
    }

    /// Masque des terres : 180 colonnes (depuis 180°O) × 90 lignes (depuis 90°N), un point tous les 2°, codé en base64.
    func setLandMask(_ base64: String) {
        guard dots.isEmpty, let data = Data(base64Encoded: base64) else { return }
        let bytes = [UInt8](data)
        var out: [Dot] = []
        out.reserveCapacity(3200)
        for r in 0..<90 {
            let la = 89 - r * 2
            if la < -58 { continue }
            for c in 0..<180 {
                let k = r * 180 + c
                let byte = k >> 3
                if byte < bytes.count, bytes[byte] & (1 << UInt8(k & 7)) != 0 {
                    out.append(LVGlobeView.dot(lat: Double(la), lon: Double(-179 + c * 2)))
                }
            }
        }
        dots = out
        setNeedsDisplay()
    }

    /// pts : [[lat, lon]], les `orders` premiers sont des commandes ; home : [lat, lon] (le globe se tourne vers ce point au départ).
    func apply(globe: [String: Any], visitors: Int) {
        let raw = (globe["pts"] as? [[Any]]) ?? []
        pings = raw.compactMap { (p: [Any]) -> Dot? in
            guard p.count >= 2, let la = (p[0] as? NSNumber)?.doubleValue, let lo = (p[1] as? NSNumber)?.doubleValue else { return nil }
            return LVGlobeView.dot(lat: la, lon: lo)
        }
        orderCount = (globe["nOrd"] as? NSNumber)?.intValue ?? 0
        dead = (globe["dead"] as? NSNumber)?.boolValue ?? false
        self.visitors = visitors
        if !didSetHome {
            didSetHome = true
            if let h = globe["home"] as? [Any], h.count >= 2, let lon = (h[1] as? NSNumber)?.doubleValue {
                rot = -lon - 10
            }
        }
    }

    // MARK: Animation

    override func didMoveToWindow() {
        super.didMoveToWindow()
        link?.invalidate()
        link = nil
        guard window != nil else { return }
        let l = CADisplayLink(target: self, selector: #selector(tick(_:)))
        l.preferredFrameRateRange = CAFrameRateRange(minimum: 24, maximum: 60, preferred: 40)
        lastTime = CACurrentMediaTime()
        l.add(to: .main, forMode: .common)
        link = l
    }

    deinit { link?.invalidate() }

    @objc private func tick(_ l: CADisplayLink) {
        let now = CACurrentMediaTime()
        let dt = now - lastTime
        lastTime = now
        if !UIAccessibility.isReduceMotionEnabled { rot += dt * 4.0 }   // 4°/s, comme la page web
        setNeedsDisplay()
    }

    // MARK: Dessin

    private func project(_ d: Dot, _ sinR: Double, _ cosR: Double, _ cx: Double, _ cy: Double, _ R: Double) -> (x: Double, y: Double, z: Double) {
        // sin/cos de (lon + rot) par addition d'angles
        let sinLR = d.sinL * cosR + d.cosL * sinR
        let cosLR = d.cosL * cosR - d.sinL * sinR
        let x = d.cosP * sinLR, y = d.sinP, z = d.cosP * cosLR
        let y2 = y * cos(tilt) - z * sin(tilt)
        let z2 = y * sin(tilt) + z * cos(tilt)
        return (cx + x * R, cy - y2 * R, z2)
    }

    override func draw(_ rect: CGRect) {
        guard let ctx = UIGraphicsGetCurrentContext() else { return }
        let size = Double(min(bounds.width, bounds.height))
        guard size > 20 else { return }
        let R = size / 2 - 6, cx = Double(bounds.midX), cy = Double(bounds.midY)

        // Sphère
        ctx.saveGState()
        ctx.addEllipse(in: CGRect(x: cx - R, y: cy - R, width: R * 2, height: R * 2))
        ctx.clip()
        let colors = [UIColor.white.cgColor, UIColor(red: 0.933, green: 0.941, blue: 0.953, alpha: 1).cgColor] as CFArray
        if let g = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 1]) {
            ctx.drawRadialGradient(
                g,
                startCenter: CGPoint(x: cx - R * 0.3, y: cy - R * 0.35), startRadius: CGFloat(R * 0.1),
                endCenter: CGPoint(x: cx, y: cy), endRadius: CGFloat(R),
                options: [.drawsAfterEndLocation]
            )
        }
        ctx.restoreGState()

        let r = rot * .pi / 180
        let sinR = sin(r), cosR = cos(r)

        // Terres
        let ds = 1.8
        for d in dots {
            let q = project(d, sinR, cosR, cx, cy, R)
            if q.z <= 0 { continue }
            ctx.setFillColor(red: 0.463, green: 0.494, blue: 0.541, alpha: CGFloat(0.3 + q.z * 0.6))
            ctx.fill(CGRect(x: q.x - ds / 2, y: q.y - ds / 2, width: ds, height: ds))
        }

        // Commandes (violet, anneau qui s'étend) puis visiteurs (bleu, qui apparaissent et s'effacent)
        if dead { return }
        let tt = CACurrentMediaTime()
        for (k, d) in pings.enumerated() {
            let c = project(d, sinR, cosR, cx, cy, R)
            if c.z <= 0.05 { continue }
            let isOrder = k < orderCount
            if !isOrder && k - orderCount >= max(0, visitors) { continue }   // un point bleu par visiteur, aucun à 0
            let ph = (tt * (isOrder ? 0.5 : 0.35) + Double(k) * 0.37).truncatingRemainder(dividingBy: 1)
            if isOrder {
                ctx.setStrokeColor(red: 0.502, green: 0.318, blue: 1.0, alpha: CGFloat(0.7 * (1 - ph)))
                ctx.setLineWidth(1.6)
                let rr = 3.5 + ph * 12
                ctx.strokeEllipse(in: CGRect(x: c.x - rr, y: c.y - rr, width: rr * 2, height: rr * 2))
                ctx.setFillColor(red: 0.502, green: 0.318, blue: 1.0, alpha: 1)
                ctx.fillEllipse(in: CGRect(x: c.x - 3.6, y: c.y - 3.6, width: 7.2, height: 7.2))
            } else {
                let a = sin(ph * .pi)
                let rr = 2.4 + a
                ctx.setFillColor(red: 0, green: 0.58, blue: 0.835, alpha: CGFloat(0.25 + a * 0.75))
                ctx.fillEllipse(in: CGRect(x: c.x - rr, y: c.y - rr, width: rr * 2, height: rr * 2))
            }
        }
    }
}

// MARK: - Briques

/// Carte blanche « libellé / valeur » du bandeau de chiffres.
@available(iOS 26.0, *)
final class LVStatCell: UIView {
    let valueLabel = UILabel()
    private let nameLabel = UILabel()

    init(label: String, value: String) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        nameLabel.text = label
        nameLabel.font = .systemFont(ofSize: 14, weight: .regular)
        nameLabel.textColor = PCTheme.sub
        nameLabel.numberOfLines = 2
        valueLabel.text = value
        valueLabel.font = .systemFont(ofSize: 24, weight: .bold)
        valueLabel.textColor = PCTheme.ink
        valueLabel.adjustsFontSizeToFitWidth = true
        valueLabel.minimumScaleFactor = 0.6
        let stack = UIStackView(arrangedSubviews: [nameLabel, valueLabel])
        stack.axis = .vertical
        stack.spacing = 4
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            stack.topAnchor.constraint(equalTo: topAnchor, constant: 14),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -14),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func set(label: String, value: String) {
        nameLabel.text = label
        if valueLabel.text != value { valueLabel.text = value }
    }
}

/// Une colonne « libellé / chiffre » de la carte « Comportement des clients ».
@available(iOS 26.0, *)
final class LVBehaviorColumn: UIView {
    private let nameLabel = UILabel()
    private let valueLabel = UILabel()

    init(label: String, value: String) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        nameLabel.text = label
        nameLabel.font = .systemFont(ofSize: 13, weight: .regular)
        nameLabel.textColor = PCTheme.sub
        nameLabel.numberOfLines = 2
        valueLabel.text = value
        valueLabel.font = .monospacedDigitSystemFont(ofSize: 24, weight: .bold)
        valueLabel.textColor = PCTheme.ink
        let stack = UIStackView(arrangedSubviews: [nameLabel, valueLabel])
        stack.axis = .vertical
        stack.spacing = 4
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

    func set(label: String, value: String) {
        nameLabel.text = label
        guard valueLabel.text != value else { return }
        UIView.transition(with: valueLabel, duration: 0.2, options: [.transitionCrossDissolve, .allowUserInteraction]) {
            self.valueLabel.text = value
        }
    }
}

/// Ligne « lieu ……… 42 % » avec sa barre.
@available(iOS 26.0, *)
final class LVLocRow: UIView {
    init(name: String, pct: Int) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        let n = UILabel()
        n.text = name
        n.font = .systemFont(ofSize: 15, weight: .regular)
        n.textColor = PCTheme.ink
        let p = UILabel()
        p.text = "\(pct) %"
        p.font = .monospacedDigitSystemFont(ofSize: 15, weight: .semibold)
        p.textColor = PCTheme.ink
        p.textAlignment = .right
        p.setContentHuggingPriority(.required, for: .horizontal)
        p.setContentCompressionResistancePriority(.required, for: .horizontal)
        let top = UIStackView(arrangedSubviews: [n, p])
        top.spacing = 8
        top.translatesAutoresizingMaskIntoConstraints = false

        let track = UIView()
        track.backgroundColor = UIColor(white: 0, alpha: 0.06)
        track.layer.cornerRadius = 3
        track.translatesAutoresizingMaskIntoConstraints = false
        let fill = UIView()
        fill.backgroundColor = UIColor(red: 0, green: 0.588, blue: 0.871, alpha: 1)
        fill.layer.cornerRadius = 3
        fill.translatesAutoresizingMaskIntoConstraints = false
        track.addSubview(fill)

        addSubview(top)
        addSubview(track)
        let ratio = CGFloat(min(max(pct, 2), 100)) / 100
        NSLayoutConstraint.activate([
            top.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            top.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            top.topAnchor.constraint(equalTo: topAnchor, constant: 10),
            track.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            track.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            track.topAnchor.constraint(equalTo: top.bottomAnchor, constant: 7),
            track.heightAnchor.constraint(equalToConstant: 6),
            track.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -10),
            fill.leadingAnchor.constraint(equalTo: track.leadingAnchor),
            fill.topAnchor.constraint(equalTo: track.topAnchor),
            fill.bottomAnchor.constraint(equalTo: track.bottomAnchor),
            fill.widthAnchor.constraint(equalTo: track.widthAnchor, multiplier: ratio),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

// MARK: - Page

@available(iOS 26.0, *)
final class LiveViewController: UIViewController, UIGestureRecognizerDelegate, DetailPushHosting {
    let push = DetailPushTransition()

    /// Appelé dès que la fermeture commence (pour réafficher la barre d'onglets) puis une fois la page retirée.
    var onWillClose: (() -> Void)?
    var onClose: (() -> Void)?

    private let pageBg = PCTheme.bg
    private var info: [String: Any]

    private let scroll = UIScrollView()
    private let content = UIStackView()
    private let topFade = UIView()
    private let fadeLayer = CAGradientLayer()
    private let closeButton = PCGlassButton(symbol: "xmark", circle: true)
    private let barTitle = UILabel()
    private var didSetInitialOffset = false
    private var closing = false

    // Éléments mis à jour sur place (le globe ne doit jamais être reconstruit : il tourne en continu).
    private let globe = LVGlobeView()
    private let visitorsName = UILabel()
    private let visitorsValue = UILabel()
    private var statCells: [LVStatCell] = []
    private let behaviorTitle = UILabel()
    private var behaviorColumns: [LVBehaviorColumn] = []
    private let locTitle = UILabel()
    private let locStack = UIStackView()
    private var locSignature = ""

    init(info: [String: Any]) {
        self.info = info
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    // MARK: Accès aux données

    private func str(_ key: String) -> String { (info[key] as? String) ?? "" }
    private func pairs(_ key: String) -> [(l: String, v: String)] {
        ((info[key] as? [[String: Any]]) ?? []).map { (($0["l"] as? String) ?? "", ($0["v"] as? String) ?? "") }
    }

    // MARK: Cycle de vie

    override func viewDidLoad() {
        super.viewDidLoad()
        overrideUserInterfaceStyle = .light
        view.backgroundColor = pageBg
        buildScroll()
        buildTopBar()
        buildContent()
        if let mask = info["mask"] as? String { globe.setLandMask(mask) }
        refresh()

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
        let bottom = view.safeAreaInsets.bottom + 24
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

    /// Nouveaux chiffres envoyés par la page web.
    func update(info newInfo: [String: Any]) {
        var merged = newInfo
        if merged["mask"] == nil, let mask = info["mask"] { merged["mask"] = mask }
        info = merged
        refresh()
    }

    // MARK: Construction

    private func buildScroll() {
        scroll.translatesAutoresizingMaskIntoConstraints = false
        scroll.alwaysBounceVertical = true
        scroll.contentInsetAdjustmentBehavior = .never
        scroll.showsVerticalScrollIndicator = true
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

        closeButton.onTap = { [weak self] in self?.closeAnimated() }

        barTitle.font = .systemFont(ofSize: 17, weight: .semibold)
        barTitle.textColor = PCTheme.ink
        barTitle.textAlignment = .center
        barTitle.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(barTitle)
        view.addSubview(closeButton)
        let guide = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            closeButton.topAnchor.constraint(equalTo: guide.topAnchor, constant: 6),
            closeButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            barTitle.centerYAnchor.constraint(equalTo: closeButton.centerYAnchor),
            barTitle.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            barTitle.leadingAnchor.constraint(greaterThanOrEqualTo: closeButton.trailingAnchor, constant: 12),
            barTitle.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -68),
        ])
    }

    private func sectionTitleRow(_ label: UILabel) -> UIView {
        label.font = .systemFont(ofSize: 17, weight: .bold)
        label.textColor = PCTheme.ink
        label.numberOfLines = 0
        let wrap = UIView()
        wrap.translatesAutoresizingMaskIntoConstraints = false
        label.translatesAutoresizingMaskIntoConstraints = false
        wrap.addSubview(label)
        NSLayoutConstraint.activate([
            label.leadingAnchor.constraint(equalTo: wrap.leadingAnchor, constant: 16),
            label.trailingAnchor.constraint(equalTo: wrap.trailingAnchor, constant: -16),
            label.topAnchor.constraint(equalTo: wrap.topAnchor, constant: 14),
            label.bottomAnchor.constraint(equalTo: wrap.bottomAnchor, constant: -4),
        ])
        return wrap
    }

    private func buildContent() {
        // 1. Globe + visiteurs en ce moment
        let globeWrap = UIView()
        globeWrap.translatesAutoresizingMaskIntoConstraints = false
        globe.translatesAutoresizingMaskIntoConstraints = false
        globeWrap.addSubview(globe)

        visitorsName.font = .systemFont(ofSize: 15, weight: .regular)
        visitorsName.textColor = PCTheme.sub
        visitorsName.textAlignment = .center
        visitorsValue.font = .monospacedDigitSystemFont(ofSize: 44, weight: .bold)
        visitorsValue.textColor = PCTheme.ink
        visitorsValue.textAlignment = .center
        let vStack = UIStackView(arrangedSubviews: [visitorsName, visitorsValue])
        vStack.axis = .vertical
        vStack.spacing = 0
        vStack.translatesAutoresizingMaskIntoConstraints = false
        globeWrap.addSubview(vStack)
        NSLayoutConstraint.activate([
            globe.topAnchor.constraint(equalTo: globeWrap.topAnchor, constant: 12),
            globe.leadingAnchor.constraint(equalTo: globeWrap.leadingAnchor, constant: 8),
            globe.trailingAnchor.constraint(equalTo: globeWrap.trailingAnchor, constant: -8),
            globe.heightAnchor.constraint(equalToConstant: 300),
            vStack.topAnchor.constraint(equalTo: globe.bottomAnchor, constant: 2),
            vStack.leadingAnchor.constraint(equalTo: globeWrap.leadingAnchor, constant: 16),
            vStack.trailingAnchor.constraint(equalTo: globeWrap.trailingAnchor, constant: -16),
            vStack.bottomAnchor.constraint(equalTo: globeWrap.bottomAnchor, constant: -16),
        ])
        content.addArrangedSubview(PCDetailCard(rows: [globeWrap]))

        // 2. Chiffres du jour (2 × 2)
        let stats = pairs("stats")
        statCells = stats.map { LVStatCell(label: $0.l, value: $0.v) }
        var rows: [UIStackView] = []
        var i = 0
        while i < statCells.count {
            let pair = Array(statCells[i..<min(i + 2, statCells.count)]).map { PCDetailCard(rows: [$0]) }
            let row = UIStackView(arrangedSubviews: pair)
            row.axis = .horizontal
            row.spacing = 10
            row.distribution = .fillEqually
            rows.append(row)
            i += 2
        }
        rows.forEach { content.addArrangedSubview($0) }

        // 3. Comportement des clients
        let behaviorWrap = UIView()
        behaviorWrap.translatesAutoresizingMaskIntoConstraints = false
        let titleRow = sectionTitleRow(behaviorTitle)
        let cols = pairs("behavior")
        behaviorColumns = cols.map { LVBehaviorColumn(label: $0.l, value: $0.v) }
        let colStack = UIStackView(arrangedSubviews: behaviorColumns)
        colStack.axis = .horizontal
        colStack.spacing = 12
        colStack.distribution = .fillEqually
        colStack.alignment = .top
        colStack.isLayoutMarginsRelativeArrangement = true
        colStack.layoutMargins = UIEdgeInsets(top: 8, left: 16, bottom: 16, right: 16)
        let behaviorStack = UIStackView(arrangedSubviews: [titleRow, colStack])
        behaviorStack.axis = .vertical
        behaviorStack.translatesAutoresizingMaskIntoConstraints = false
        behaviorWrap.addSubview(behaviorStack)
        NSLayoutConstraint.activate([
            behaviorStack.leadingAnchor.constraint(equalTo: behaviorWrap.leadingAnchor),
            behaviorStack.trailingAnchor.constraint(equalTo: behaviorWrap.trailingAnchor),
            behaviorStack.topAnchor.constraint(equalTo: behaviorWrap.topAnchor),
            behaviorStack.bottomAnchor.constraint(equalTo: behaviorWrap.bottomAnchor),
        ])
        content.addArrangedSubview(PCDetailCard(rows: [behaviorWrap]))

        // 4. Sessions par lieu
        locStack.axis = .vertical
        let locWrap = UIView()
        locWrap.translatesAutoresizingMaskIntoConstraints = false
        let locTitleRow = sectionTitleRow(locTitle)
        locStack.translatesAutoresizingMaskIntoConstraints = false
        let locOuter = UIStackView(arrangedSubviews: [locTitleRow, locStack])
        locOuter.axis = .vertical
        locOuter.translatesAutoresizingMaskIntoConstraints = false
        locWrap.addSubview(locOuter)
        NSLayoutConstraint.activate([
            locOuter.leadingAnchor.constraint(equalTo: locWrap.leadingAnchor),
            locOuter.trailingAnchor.constraint(equalTo: locWrap.trailingAnchor),
            locOuter.topAnchor.constraint(equalTo: locWrap.topAnchor),
            locOuter.bottomAnchor.constraint(equalTo: locWrap.bottomAnchor, constant: -8),
        ])
        content.addArrangedSubview(PCDetailCard(rows: [locWrap]))
    }

    // MARK: Mise à jour sur place

    private func refresh() {
        barTitle.text = str("title")
        let visitors = (info["visitors"] as? NSNumber)?.intValue ?? 0
        visitorsName.text = str("visitorsLabel")
        let vText = "\(visitors)"
        if visitorsValue.text != vText {
            if visitorsValue.text == nil {
                visitorsValue.text = vText
            } else {
                UIView.transition(with: visitorsValue, duration: 0.2, options: [.transitionCrossDissolve, .allowUserInteraction]) {
                    self.visitorsValue.text = vText
                }
            }
        }
        if let g = info["globe"] as? [String: Any] { globe.apply(globe: g, visitors: visitors) }

        for (cell, s) in zip(statCells, pairs("stats")) { cell.set(label: s.l, value: s.v) }

        behaviorTitle.text = str("behaviorTitle")
        for (col, b) in zip(behaviorColumns, pairs("behavior")) { col.set(label: b.l, value: b.v) }

        locTitle.text = str("locTitle")
        let locs = ((info["locs"] as? [[String: Any]]) ?? []).map {
            (name: ($0["name"] as? String) ?? "", pct: ($0["pct"] as? NSNumber)?.intValue ?? 0)
        }
        let signature = locs.isEmpty ? "∅" : locs.map { "\($0.name)|\($0.pct)" }.joined(separator: ";")
        if signature != locSignature {
            locSignature = signature
            for v in locStack.arrangedSubviews {
                locStack.removeArrangedSubview(v)
                v.removeFromSuperview()
            }
            if locs.isEmpty {
                let none = UILabel()
                none.text = str("noSessions")
                none.font = .systemFont(ofSize: 15)
                none.textColor = PCTheme.sub
                let wrap = UIView()
                none.translatesAutoresizingMaskIntoConstraints = false
                wrap.addSubview(none)
                NSLayoutConstraint.activate([
                    none.leadingAnchor.constraint(equalTo: wrap.leadingAnchor, constant: 16),
                    none.trailingAnchor.constraint(equalTo: wrap.trailingAnchor, constant: -16),
                    none.topAnchor.constraint(equalTo: wrap.topAnchor, constant: 6),
                    none.bottomAnchor.constraint(equalTo: wrap.bottomAnchor, constant: -10),
                ])
                locStack.addArrangedSubview(wrap)
            } else {
                for l in locs { locStack.addArrangedSubview(LVLocRow(name: l.name, pct: l.pct)) }
            }
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

#endif
