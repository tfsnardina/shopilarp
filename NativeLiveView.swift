import UIKit

/// Vue en direct native (Liquid Glass, iOS 26) : globe de points qui tourne, visiteurs en ce moment,
/// chiffres du jour, comportement des clients et sessions par lieu. S'ouvre au-dessus de la page web
/// (même « push » que la fiche produit / commande) ; la page web envoie les données (app.js : nativeLiveInfo)
/// puis pousse les chiffres au fil de l'eau (mode « liveUpdate »). Tout le texte arrive déjà traduit.
#if compiler(>=6.2)

// MARK: - Globe

/// Pays (code ISO, latitude, longitude, rayon approximatif en degrés) : sert à afficher le nom du pays au centre quand on zoome.
private let lvCountries: [(String, Double, Double, Double)] = [
    ("FR", 46.6, 2.4, 4.5), ("DE", 51.2, 10.4, 3.8), ("ES", 40.0, -3.7, 5.0), ("PT", 39.6, -8.0, 2.2), ("IT", 42.8, 12.5, 4.5),
    ("GB", 54.0, -2.5, 4.0), ("IE", 53.2, -8.0, 1.8), ("NL", 52.2, 5.5, 1.4), ("BE", 50.6, 4.6, 1.2), ("LU", 49.8, 6.1, 0.5),
    ("CH", 46.8, 8.2, 1.3), ("AT", 47.6, 14.1, 2.2), ("CZ", 49.8, 15.5, 1.8), ("PL", 52.0, 19.4, 3.5), ("DK", 56.0, 10.0, 1.8),
    ("NO", 62.0, 9.0, 6.0), ("SE", 62.0, 15.0, 5.5), ("FI", 64.0, 26.0, 4.5), ("EE", 58.7, 25.5, 1.2), ("LV", 56.9, 24.8, 1.2),
    ("LT", 55.3, 23.9, 1.2), ("BY", 53.7, 27.9, 2.5), ("UA", 49.0, 31.4, 5.0), ("RO", 45.9, 25.0, 2.8), ("HU", 47.1, 19.5, 2.0),
    ("SK", 48.7, 19.5, 1.4), ("SI", 46.1, 14.8, 0.8), ("HR", 45.2, 15.5, 1.8), ("BA", 44.0, 17.8, 1.3), ("RS", 44.0, 20.8, 1.6),
    ("BG", 42.7, 25.3, 2.0), ("GR", 39.0, 22.0, 2.8), ("AL", 41.1, 20.0, 1.0), ("MK", 41.6, 21.7, 0.8), ("ME", 42.7, 19.3, 0.7),
    ("MD", 47.2, 28.5, 1.2), ("IS", 65.0, -18.0, 3.2), ("CY", 35.0, 33.2, 0.7), ("MT", 35.9, 14.4, 0.3), ("TR", 39.0, 35.0, 5.5),
    ("RU", 58.0, 42.0, 13), ("RU", 62.0, 95.0, 26), ("RU", 63.0, 150.0, 18),
    ("US", 39.0, -98.0, 14), ("US", 64.0, -150.0, 8), ("CA", 58.0, -100.0, 16), ("CA", 50.0, -72.0, 6), ("MX", 23.6, -102.5, 9),
    ("GL", 72.0, -40.0, 12), ("GT", 15.5, -90.3, 1.6), ("CU", 21.6, -79.0, 3.0), ("DO", 18.9, -70.5, 1.3), ("HT", 19.0, -72.4, 1.2),
    ("JM", 18.1, -77.3, 0.8), ("CR", 9.9, -84.2, 1.0), ("PA", 8.5, -80.0, 1.4), ("HN", 14.8, -86.6, 1.8), ("NI", 12.9, -85.0, 1.6),
    ("SV", 13.7, -88.9, 0.8), ("CO", 4.5, -73.0, 5.0), ("VE", 7.0, -66.0, 4.5), ("PE", -9.5, -75.0, 5.5), ("EC", -1.5, -78.5, 2.4),
    ("BO", -16.5, -64.5, 5.0), ("CL", -33.0, -71.0, 8.0), ("PY", -23.4, -58.4, 3.0), ("UY", -32.8, -56.0, 2.2), ("BR", -10.0, -52.0, 14),
    ("AR", -38.0, -65.0, 10),
    ("MA", 31.8, -7.1, 4.0), ("DZ", 28.0, 2.6, 9.0), ("TN", 34.0, 9.5, 2.0), ("LY", 27.0, 17.0, 8.0), ("EG", 26.8, 30.0, 5.5),
    ("MR", 20.0, -10.5, 6.0), ("ML", 17.5, -3.5, 7.0), ("NE", 17.5, 9.5, 7.0), ("TD", 15.5, 18.5, 6.5), ("SD", 15.5, 30.0, 7.0),
    ("SS", 7.5, 30.0, 4.0), ("ET", 9.0, 40.0, 6.0), ("SN", 14.5, -14.5, 2.5), ("GH", 7.9, -1.0, 2.2), ("CI", 7.5, -5.5, 2.8),
    ("NG", 9.1, 8.7, 4.5), ("CM", 5.7, 12.7, 4.0), ("CD", -2.5, 23.5, 8.0), ("CG", -0.7, 15.2, 3.5), ("AO", -12.0, 17.5, 6.0),
    ("ZM", -13.5, 27.8, 4.5), ("ZW", -19.0, 29.8, 3.0), ("MZ", -18.0, 35.0, 6.0), ("TZ", -6.4, 34.8, 5.0), ("KE", 0.5, 38.0, 4.5),
    ("UG", 1.3, 32.3, 2.3), ("SO", 5.0, 46.0, 6.0), ("MG", -19.0, 46.7, 5.0), ("ZA", -29.0, 24.5, 6.5), ("NA", -22.0, 17.0, 5.0),
    ("BW", -22.0, 24.0, 3.5), ("GA", -0.8, 11.7, 2.5), ("GN", 10.5, -11.0, 2.5), ("SL", 8.5, -11.8, 1.3), ("LR", 6.4, -9.4, 1.5),
    ("BF", 12.2, -1.6, 2.8), ("BJ", 9.3, 2.3, 2.0), ("TG", 8.6, 0.8, 1.2), ("RW", -2.0, 29.9, 0.8), ("BI", -3.4, 29.9, 0.8),
    ("MW", -13.3, 34.3, 2.5), ("ER", 15.3, 39.5, 2.0), ("DJ", 11.8, 42.6, 0.7), ("GM", 13.4, -15.4, 0.7), ("GW", 12.0, -15.0, 0.9),
    ("GQ", 1.7, 10.3, 0.8), ("CF", 6.6, 20.9, 4.5), ("LS", -29.6, 28.2, 0.8), ("SZ", -26.5, 31.5, 0.6),
    ("SA", 24.0, 45.0, 7.0), ("IR", 32.4, 53.7, 7.0), ("IQ", 33.0, 43.7, 4.0), ("SY", 35.0, 38.5, 2.5), ("JO", 31.0, 36.5, 1.6),
    ("IL", 31.5, 35.0, 1.0), ("LB", 33.9, 35.9, 0.7), ("YE", 15.6, 48.5, 4.0), ("OM", 21.0, 57.0, 4.0), ("AE", 24.0, 54.0, 2.0),
    ("QA", 25.3, 51.2, 0.7), ("KW", 29.3, 47.6, 0.9), ("AF", 33.9, 67.7, 5.0), ("PK", 30.0, 70.0, 6.0), ("IN", 22.0, 79.0, 9.0),
    ("BD", 23.7, 90.3, 2.0), ("LK", 7.9, 80.7, 1.6), ("NP", 28.4, 84.0, 2.8), ("BT", 27.5, 90.4, 0.8), ("MM", 21.0, 96.5, 5.0),
    ("TH", 15.5, 101.0, 4.5), ("LA", 19.8, 102.5, 3.5), ("KH", 12.5, 104.9, 2.2), ("VN", 16.0, 106.3, 5.0), ("MY", 4.2, 102.0, 3.5),
    ("MY", 3.5, 113.5, 3.0), ("SG", 1.35, 103.8, 0.3), ("ID", -2.5, 118.0, 12), ("PH", 12.5, 122.0, 5.0), ("TW", 23.7, 121.0, 1.5),
    ("CN", 35.0, 103.0, 15), ("MN", 46.8, 103.8, 8.0), ("KZ", 48.0, 67.0, 10), ("UZ", 41.4, 64.6, 4.5), ("TM", 39.0, 59.5, 4.5),
    ("KG", 41.5, 74.5, 3.0), ("TJ", 38.8, 71.0, 2.2), ("AZ", 40.3, 47.7, 1.8), ("GE", 42.2, 43.5, 1.8), ("AM", 40.2, 45.0, 1.3),
    ("KP", 40.2, 127.0, 2.5), ("KR", 36.5, 127.9, 2.0), ("JP", 36.5, 138.0, 6.0),
    ("AU", -25.0, 134.0, 15), ("NZ", -41.0, 172.5, 6.0), ("PG", -6.3, 145.0, 5.0), ("FJ", -17.7, 178.0, 1.5),
]

/// Globe de points hexagonaux turquoise (comme la Vue en direct de Shopify) : tourne tout seul, se pince pour zoomer
/// jusqu'à la carte, se fait glisser avec un doigt, affiche le nom du pays au centre quand on zoome.
/// Commandes = violet (anneau qui s'étend), visiteurs = bleu (hexagone qui pulse).
@available(iOS 26.0, *)
final class LVGlobeView: UIView, UIGestureRecognizerDelegate {
    private struct Dot {
        let cosP: Double, sinP: Double, cosL: Double, sinL: Double
    }

    private static let spacing = 1.2          // distance entre deux hexagones, en degrés
    private static let maxZoom = 5.0
    private static let tilt = 0.32            // latitude du centre de la vue au repos (radians)
    private static let hexUnit: [(Double, Double)] = (0..<6).map { k in
        let a = (30.0 + 60.0 * Double(k)) * .pi / 180
        return (cos(a), sin(a))
    }

    private var dots: [Dot] = []
    private var pings: [Dot] = []
    private var pingCell: [Int] = []          // hexagone du globe le plus proche de chaque point
    private var pingSignature = ""
    /// Vrai pendant que la page défile (doigt ou inertie) : le globe se redessine moins souvent pour ne pas voler de temps au défilement.
    var pageScrolling = false
    private var frameSkip = 0
    private var orderCount = 0
    private var visitors = 0
    private var dead = false
    private var didSetHome = false

    // Vue : longitude au centre (degrés), latitude au centre (radians), zoom.
    private var centerLon: Double = 0
    private var centerLat: Double = LVGlobeView.tilt
    private var zoom: Double = 1
    private var velLon: Double = 0            // inertie du glissement, °/s
    private var panActive = false
    private var pinchActive = false
    private var pinchStartZoom: Double = 1
    private var interacting: Bool { panActive || pinchActive }

    private var link: CADisplayLink?
    private var lastTime: CFTimeInterval = 0

    private let countryTag = UIView()
    private let tagLabel = UILabel()
    private var tagShown = false
    private var tagCode = ""
    private var langCode = Locale.current.identifier

    override init(frame: CGRect) {
        super.init(frame: frame)
        isOpaque = false
        backgroundColor = .clear
        contentMode = .redraw
        clipsToBounds = true
        isUserInteractionEnabled = true
        // Dessin CPU : 2x suffit pour des hexagones (et divise par ~2 le travail sur un écran 3x) ; dessiné hors du thread principal.
        contentScaleFactor = min(UIScreen.main.scale, 2)
        layer.drawsAsynchronously = true

        let pan = UIPanGestureRecognizer(target: self, action: #selector(onPan(_:)))
        pan.delegate = self
        addGestureRecognizer(pan)
        let pinch = UIPinchGestureRecognizer(target: self, action: #selector(onPinch(_:)))
        pinch.delegate = self
        addGestureRecognizer(pinch)

        // Étiquette du pays (centre de la vue, visible quand on zoome)
        countryTag.backgroundColor = UIColor(white: 1, alpha: 0.72)
        countryTag.layer.cornerRadius = 7
        countryTag.layer.cornerCurve = .continuous
        countryTag.alpha = 0
        countryTag.isUserInteractionEnabled = false
        countryTag.translatesAutoresizingMaskIntoConstraints = false
        tagLabel.font = .systemFont(ofSize: 14, weight: .semibold)
        tagLabel.textColor = UIColor(white: 0.15, alpha: 1)
        tagLabel.translatesAutoresizingMaskIntoConstraints = false
        countryTag.addSubview(tagLabel)
        addSubview(countryTag)
        NSLayoutConstraint.activate([
            tagLabel.leadingAnchor.constraint(equalTo: countryTag.leadingAnchor, constant: 9),
            tagLabel.trailingAnchor.constraint(equalTo: countryTag.trailingAnchor, constant: -9),
            tagLabel.topAnchor.constraint(equalTo: countryTag.topAnchor, constant: 4),
            tagLabel.bottomAnchor.constraint(equalTo: countryTag.bottomAnchor, constant: -4),
            countryTag.centerXAnchor.constraint(equalTo: centerXAnchor),
            countryTag.centerYAnchor.constraint(equalTo: centerYAnchor),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private static func dot(lat: Double, lon: Double) -> Dot {
        let p = lat * .pi / 180, l = lon * .pi / 180
        return Dot(cosP: cos(p), sinP: sin(p), cosL: cos(l), sinL: sin(l))
    }

    /// Masque des terres : 180 colonnes (depuis 180°O) × 90 lignes (depuis 90°N), un point tous les 2°, codé en base64.
    /// On échantillonne un réseau d'hexagones plus fin (1,2°) en interpolant le masque, pour des côtes lisses.
    func setLandMask(_ base64: String) {
        guard dots.isEmpty, let data = Data(base64Encoded: base64) else { return }
        let bytes = [UInt8](data)
        func land(_ r: Int, _ c: Int) -> Double {
            let rr = min(max(r, 0), 89)
            let cc = ((c % 180) + 180) % 180
            let k = rr * 180 + cc
            let byte = k >> 3
            guard byte < bytes.count else { return 0 }
            return bytes[byte] & (1 << UInt8(k & 7)) != 0 ? 1 : 0
        }
        func landAt(lat: Double, lon: Double) -> Bool {
            let fr = (89 - lat) / 2, fc = (lon + 179) / 2
            let r0 = Int(floor(fr)), c0 = Int(floor(fc))
            let tr = fr - Double(r0), tc = fc - Double(c0)
            let top = land(r0, c0) * (1 - tc) + land(r0, c0 + 1) * tc
            let bot = land(r0 + 1, c0) * (1 - tc) + land(r0 + 1, c0 + 1) * tc
            return top * (1 - tr) + bot * tr >= 0.5
        }
        let d = LVGlobeView.spacing
        let rowStep = d * 0.8660254
        var out: [Dot] = []
        out.reserveCapacity(9000)
        var j = 0
        var lat = -58.0
        while lat <= 84 {
            let cosLat = max(cos(lat * .pi / 180), 0.05)
            let n = max(8, Int((360 * cosLat / d).rounded()))
            let step = 360.0 / Double(n)
            let offset = (j % 2 == 0) ? 0.0 : step / 2
            for i in 0..<n {
                var lon = -180 + offset + Double(i) * step
                if lon > 180 { lon -= 360 }
                if landAt(lat: lat, lon: lon) { out.append(LVGlobeView.dot(lat: lat, lon: lon)) }
            }
            lat += rowStep
            j += 1
        }
        dots = out
        setNeedsDisplay()
    }

    /// pts : [[lat, lon]], les `orders` premiers sont des commandes ; home : [lat, lon] (le globe se tourne vers ce point au départ).
    func apply(globe: [String: Any], visitors: Int, lang: String) {
        let raw = (globe["pts"] as? [[Any]]) ?? []
        // Les points ne changent presque jamais d'une mise à jour à l'autre : on ne refait le calcul (coûteux) que s'ils changent.
        var sig = "\(dots.count)#"
        for p in raw where p.count >= 2 {
            sig += "\((p[0] as? NSNumber)?.doubleValue ?? 0),\((p[1] as? NSNumber)?.doubleValue ?? 0);"
        }
        if sig != pingSignature {
            pingSignature = sig
            pings = raw.compactMap { (p: [Any]) -> Dot? in
                guard p.count >= 2, let la = (p[0] as? NSNumber)?.doubleValue, let lo = (p[1] as? NSNumber)?.doubleValue else { return nil }
                return LVGlobeView.dot(lat: la, lon: lo)
            }
            pingCell = pings.map { p in
                var best = -1
                var bestDot = -2.0
                for (i, d) in dots.enumerated() {
                    let s = d.sinP * p.sinP + d.cosP * p.cosP * (d.cosL * p.cosL + d.sinL * p.sinL)
                    if s > bestDot { bestDot = s; best = i }
                }
                return best
            }
        }
        orderCount = (globe["nOrd"] as? NSNumber)?.intValue ?? 0
        dead = (globe["dead"] as? NSNumber)?.boolValue ?? false
        self.visitors = visitors
        if !lang.isEmpty { langCode = lang }
        if !didSetHome {
            didSetHome = true
            if let h = globe["home"] as? [Any], h.count >= 2, let lon = (h[1] as? NSNumber)?.doubleValue {
                centerLon = lon + 10
            }
        }
    }

    // MARK: Gestes

    private var viewRadius: Double {
        let size = Double(min(bounds.width, bounds.height))
        return max(size * 0.4, 40)
    }

    @objc private func onPan(_ g: UIPanGestureRecognizer) {
        switch g.state {
        case .began:
            panActive = true
            velLon = 0
        case .changed:
            let t = g.translation(in: self)
            g.setTranslation(.zero, in: self)
            let radPerPt = 1 / (viewRadius * zoom)
            let k = max(cos(centerLat), 0.35)
            centerLon -= Double(t.x) * radPerPt / k * 180 / .pi
            centerLat = min(max(centerLat + Double(t.y) * radPerPt, -1.2), 1.2)
        case .ended:
            panActive = false
            let radPerPt = 1 / (viewRadius * zoom)
            velLon = -Double(g.velocity(in: self).x) * radPerPt * 180 / .pi
        default:
            panActive = false
        }
    }

    @objc private func onPinch(_ g: UIPinchGestureRecognizer) {
        switch g.state {
        case .began:
            pinchActive = true
            pinchStartZoom = zoom
        case .changed:
            zoom = min(max(pinchStartZoom * Double(g.scale), 0.85), LVGlobeView.maxZoom)
        default:
            pinchActive = false
        }
    }

    /// Au repos le globe laisse la page défiler verticalement ; il ne capte que le glissement horizontal (ou tout, une fois zoomé).
    override func gestureRecognizerShouldBegin(_ g: UIGestureRecognizer) -> Bool {
        if let pan = g as? UIPanGestureRecognizer {
            if zoom > 1.08 { return true }
            let v = pan.velocity(in: self)
            return abs(v.x) > abs(v.y)
        }
        return true
    }

    func gestureRecognizer(_ g: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool {
        (g is UIPinchGestureRecognizer && other is UIPanGestureRecognizer) || (g is UIPanGestureRecognizer && other is UIPinchGestureRecognizer)
    }

    // MARK: Animation

    override func didMoveToWindow() {
        super.didMoveToWindow()
        link?.invalidate()
        link = nil
        guard window != nil else { return }
        let l = CADisplayLink(target: self, selector: #selector(tick(_:)))
        l.preferredFrameRateRange = CAFrameRateRange(minimum: 24, maximum: 30, preferred: 30)
        lastTime = CACurrentMediaTime()
        l.add(to: .main, forMode: .common)
        link = l
    }

    deinit { link?.invalidate() }

    @objc private func tick(_ l: CADisplayLink) {
        let now = CACurrentMediaTime()
        // Globe hors de l'écran (page défilée vers le bas) : rien à animer ni à dessiner.
        if let w = window, !convert(bounds, to: nil).intersects(w.bounds) { lastTime = now; return }
        // Pendant le défilement on ne redessine qu'une image sur trois : la page reste à 60 images/s.
        if pageScrolling && !interacting {
            frameSkip += 1
            if frameSkip % 3 != 0 { return }
        }
        let dt = min(now - lastTime, 0.1)
        lastTime = now
        if !interacting {
            if zoom < 1.12 {
                // Globe entier : revient à 100 %, se redresse et tourne lentement (4°/s, comme la page web).
                zoom += (1 - zoom) * min(1, dt * 8)
                if abs(zoom - 1) < 0.002 { zoom = 1 }
                centerLat += (LVGlobeView.tilt - centerLat) * min(1, dt * 2.5)
                if !UIAccessibility.isReduceMotionEnabled { centerLon -= dt * 4.0 }
            }
            if abs(velLon) > 0.5 {
                centerLon += velLon * dt
                velLon *= exp(-dt * 3.2)
            } else {
                velLon = 0
            }
        }
        if centerLon > 360 || centerLon < -360 { centerLon = centerLon.truncatingRemainder(dividingBy: 360) }
        updateTag()
        setNeedsDisplay()
    }

    // MARK: Nom du pays

    private func countryCode(lat: Double, lon: Double) -> String {
        var best = ""
        var bestScore = Double.greatestFiniteMagnitude
        let p = lat * .pi / 180
        for c in lvCountries {
            let q = c.1 * .pi / 180
            var dl = abs(lon - c.2)
            if dl > 180 { dl = 360 - dl }
            let dx = dl * cos((p + q) / 2)
            let dy = lat - c.1
            let score = (dx * dx + dy * dy).squareRoot() / c.3
            if score < bestScore { bestScore = score; best = c.0 }
        }
        return best
    }

    private func updateTag() {
        let show = zoom > 2.6
        if show {
            var lon = centerLon.truncatingRemainder(dividingBy: 360)
            if lon > 180 { lon -= 360 }
            if lon < -180 { lon += 360 }
            let code = countryCode(lat: centerLat * 180 / .pi, lon: lon)
            if code != tagCode {
                tagCode = code
                tagLabel.text = Locale(identifier: langCode).localizedString(forRegionCode: code) ?? code
            }
        }
        if show != tagShown {
            tagShown = show
            UIView.animate(withDuration: 0.2, delay: 0, options: [.beginFromCurrentState, .allowUserInteraction]) {
                self.countryTag.alpha = show ? 1 : 0
            }
        }
    }

    // MARK: Dessin

    override func draw(_ rect: CGRect) {
        guard let ctx = UIGraphicsGetCurrentContext() else { return }
        let w = Double(bounds.width), h = Double(bounds.height)
        guard min(w, h) > 20 else { return }
        let R = viewRadius * zoom, cx = w / 2, cy = h / 2
        let space = CGColorSpaceCreateDeviceRGB()

        // Halo : vert en haut à gauche, bleu en bas à droite. Il s'efface avant d'atteindre le bord de la vue
        // (sinon on voit un rectangle) et disparaît dès qu'on zoome.
        let glowFade = min(1, max(0, 1 - (zoom - 1) / 0.3))
        if glowFade > 0.01 {
            let glowR0 = R * 0.92, glowR1 = R * 1.18
            for (dx, dy, r, g, b) in [(-0.08, -0.06, 0.30, 0.90, 0.72), (0.08, 0.08, 0.25, 0.62, 1.0)] as [(Double, Double, Double, Double, Double)] {
                let c = [
                    UIColor(red: r, green: g, blue: b, alpha: 0.30 * glowFade).cgColor,
                    UIColor(red: r, green: g, blue: b, alpha: 0).cgColor,
                ] as CFArray
                if let grad = CGGradient(colorsSpace: space, colors: c, locations: [0, 1]) {
                    let o = CGPoint(x: cx + dx * R, y: cy + dy * R)
                    ctx.drawRadialGradient(grad, startCenter: o, startRadius: CGFloat(glowR0), endCenter: o, endRadius: CGFloat(glowR1), options: [])
                }
            }
        }

        // Sphère translucide
        ctx.saveGState()
        ctx.addEllipse(in: CGRect(x: cx - R, y: cy - R, width: R * 2, height: R * 2))
        ctx.clip()
        let sphere = [
            UIColor(red: 0.95, green: 0.985, blue: 0.97, alpha: 1).cgColor,
            UIColor(red: 0.84, green: 0.935, blue: 0.945, alpha: 1).cgColor,
            UIColor(red: 0.70, green: 0.86, blue: 0.95, alpha: 1).cgColor,
        ] as CFArray
        if let g = CGGradient(colorsSpace: space, colors: sphere, locations: [0, 0.62, 1]) {
            ctx.drawRadialGradient(
                g,
                startCenter: CGPoint(x: cx - R * 0.28, y: cy - R * 0.34), startRadius: CGFloat(R * 0.08),
                endCenter: CGPoint(x: cx + R * 0.05, y: cy + R * 0.05), endRadius: CGFloat(R * 1.05),
                options: [.drawsAfterEndLocation]
            )
        }

        // Projection orthographique centrée sur (centerLon, centerLat)
        let l0 = centerLon * .pi / 180
        let sinL0 = sin(l0), cosL0 = cos(l0)
        let sinP0 = sin(centerLat), cosP0 = cos(centerLat)
        func project(_ d: Dot) -> (x: Double, y: Double, z: Double, sinD: Double, cosD: Double) {
            let sinD = d.sinL * cosL0 - d.cosL * sinL0
            let cosD = d.cosL * cosL0 + d.sinL * sinL0
            let x = d.cosP * sinD
            let y = cosP0 * d.sinP - sinP0 * d.cosP * cosD
            let z = sinP0 * d.sinP + cosP0 * d.cosP * cosD
            return (cx + x * R, cy - y * R, z, sinD, cosD)
        }

        // Hexagone « vrai » : ses 6 sommets suivent la sphère (axes est / nord du point projetés à l'écran),
        // donc il se déforme exactement comme la surface et les voisins se touchent proprement.
        let hexAng = LVGlobeView.spacing * .pi / 180 / 3.0.squareRoot()
        let hexPx = hexAng * R
        func addHex(_ path: CGMutablePath, _ d: Dot, _ q: (x: Double, y: Double, z: Double, sinD: Double, cosD: Double), _ scale: Double) {
            let ex = q.cosD, ey = -q.sinD * sinP0
            let nx = -d.sinP * q.sinD, ny = -(d.cosP * cosP0 + d.sinP * sinP0 * q.cosD)
            let r = hexPx * scale
            for (k, v) in LVGlobeView.hexUnit.enumerated() {
                let px = q.x + r * (v.0 * ex + v.1 * nx)
                let py = q.y + r * (v.0 * ey + v.1 * ny)
                if k == 0 { path.move(to: CGPoint(x: px, y: py)) } else { path.addLine(to: CGPoint(x: px, y: py)) }
            }
            path.closeSubpath()
        }

        // Terres : hexagones turquoise regroupés par éclairage (5 tons) pour peu d'appels de dessin.
        let buckets = 5
        let paths = (0..<buckets).map { _ in CGMutablePath() }
        let margin = hexPx + 2
        for d in dots {
            let q = project(d)
            if q.z <= 0.02 { continue }
            if q.x < -margin || q.x > w + margin || q.y < -margin || q.y > h + margin { continue }
            addHex(paths[min(buckets - 1, Int(q.z * Double(buckets)))], d, q, 0.9)
        }
        for i in 0..<buckets {
            let t = (Double(i) + 0.5) / Double(buckets)       // 0 = bord, 1 = centre
            ctx.setFillColor(
                red: CGFloat(0.40 - 0.13 * t), green: CGFloat(0.72 + 0.14 * t), blue: CGFloat(0.88 - 0.13 * t),
                alpha: CGFloat(0.50 + 0.50 * t)
            )
            ctx.addPath(paths[i])
            ctx.fillPath()
        }

        // Commandes (violet) et visiteurs (bleu) : l'hexagone vert du lieu change de couleur (il ne s'ajoute pas par-dessus).
        if !dead {
            let tt = CACurrentMediaTime()
            let grow = max(1.0, 2.1 - zoom * 0.55)          // un peu plus gros quand le globe est entier, pour rester visible
            for (k, d) in pings.enumerated() where k < pingCell.count && pingCell[k] >= 0 && pingCell[k] < dots.count {
                let isOrder = k < orderCount
                if !isOrder && k - orderCount >= max(0, visitors) { continue }   // un hexagone bleu par visiteur, aucun à 0
                let cell = dots[pingCell[k]]
                let q = project(cell)
                if q.z <= 0.05 { continue }
                if q.x < -40 || q.x > w + 40 || q.y < -40 || q.y > h + 40 { continue }
                let ph = (tt * (isOrder ? 0.5 : 0.35) + Double(k) * 0.37).truncatingRemainder(dividingBy: 1)
                let path = CGMutablePath()
                if isOrder {
                    addHex(path, cell, q, 0.96 * grow)
                    ctx.setFillColor(red: 0.502, green: 0.318, blue: 1.0, alpha: 1)
                    ctx.addPath(path)
                    ctx.fillPath()
                    // anneau discret qui s'étend autour de la commande
                    ctx.setStrokeColor(red: 0.502, green: 0.318, blue: 1.0, alpha: CGFloat(0.6 * (1 - ph)))
                    ctx.setLineWidth(1.4)
                    let rr = hexPx * grow * (1.4 + ph * 5)
                    ctx.strokeEllipse(in: CGRect(x: q.x - rr, y: q.y - rr, width: rr * 2, height: rr * 2))
                } else {
                    let a = sin(ph * .pi)
                    addHex(path, cell, q, 0.96 * grow)
                    ctx.setFillColor(red: 0.07, green: 0.62, blue: 0.97, alpha: CGFloat(0.55 + a * 0.45))
                    ctx.addPath(path)
                    ctx.fillPath()
                }
            }
        }
        ctx.restoreGState()
    }
}

// MARK: - Légende du globe

/// Hexagone plein (icône « visiteurs » de la légende).
@available(iOS 26.0, *)
final class LVHexIcon: UIView {
    var color: UIColor = .blue { didSet { setNeedsDisplay() } }
    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isOpaque = false
    }
    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    override func draw(_ rect: CGRect) {
        let r = min(bounds.width, bounds.height) / 2
        let c = CGPoint(x: bounds.midX, y: bounds.midY)
        let p = UIBezierPath()
        for k in 0..<6 {
            let a = (30.0 + 60.0 * Double(k)) * .pi / 180
            let pt = CGPoint(x: c.x + CGFloat(cos(a)) * r, y: c.y + CGFloat(sin(a)) * r)
            if k == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
        }
        p.close()
        color.setFill()
        p.fill()
    }
}

/// Pastille de légende : « ● Commandes » (violet) ou « ⬢ Visiteurs en ce moment » (bleu).
@available(iOS 26.0, *)
final class LVLegendPill: UIView {
    let label = UILabel()

    init(purple: Bool) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = UIColor(white: 1, alpha: 0.62)
        layer.cornerRadius = 15
        layer.cornerCurve = .continuous
        isUserInteractionEnabled = false

        let icon = UIView()
        icon.translatesAutoresizingMaskIntoConstraints = false
        if purple {
            icon.backgroundColor = UIColor(red: 0.502, green: 0.318, blue: 1.0, alpha: 0.22)
            icon.layer.cornerRadius = 11
            let dot = UIView()
            dot.backgroundColor = UIColor(red: 0.502, green: 0.318, blue: 1.0, alpha: 1)
            dot.layer.cornerRadius = 5.5
            dot.translatesAutoresizingMaskIntoConstraints = false
            icon.addSubview(dot)
            NSLayoutConstraint.activate([
                dot.centerXAnchor.constraint(equalTo: icon.centerXAnchor),
                dot.centerYAnchor.constraint(equalTo: icon.centerYAnchor),
                dot.widthAnchor.constraint(equalToConstant: 11),
                dot.heightAnchor.constraint(equalToConstant: 11),
            ])
        } else {
            let hex = LVHexIcon()
            hex.color = UIColor(red: 0.07, green: 0.62, blue: 0.97, alpha: 1)
            hex.translatesAutoresizingMaskIntoConstraints = false
            icon.addSubview(hex)
            NSLayoutConstraint.activate([
                hex.centerXAnchor.constraint(equalTo: icon.centerXAnchor),
                hex.centerYAnchor.constraint(equalTo: icon.centerYAnchor),
                hex.widthAnchor.constraint(equalToConstant: 18),
                hex.heightAnchor.constraint(equalToConstant: 18),
            ])
        }
        label.font = .systemFont(ofSize: 15, weight: .regular)
        label.textColor = PCTheme.ink
        label.lineBreakMode = .byTruncatingTail
        label.translatesAutoresizingMaskIntoConstraints = false
        label.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        addSubview(icon)
        addSubview(label)
        NSLayoutConstraint.activate([
            heightAnchor.constraint(equalToConstant: 30),
            icon.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 4),
            icon.centerYAnchor.constraint(equalTo: centerYAnchor),
            icon.widthAnchor.constraint(equalToConstant: 22),
            icon.heightAnchor.constraint(equalToConstant: 22),
            label.leadingAnchor.constraint(equalTo: icon.trailingAnchor, constant: 7),
            label.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            label.centerYAnchor.constraint(equalTo: centerYAnchor),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}

// MARK: - Briques

/// Titre en gras avec le soulignement pointillé de la vraie Vue en direct.
@available(iOS 26.0, *)
func lvDotted(_ text: String, size: CGFloat = 17) -> NSAttributedString {
    NSAttributedString(string: text, attributes: [
        .font: UIFont.systemFont(ofSize: size, weight: .bold),
        .foregroundColor: PCTheme.ink,
        .underlineStyle: NSUnderlineStyle.single.rawValue | NSUnderlineStyle.patternDot.rawValue,
        .underlineColor: UIColor(white: 0.62, alpha: 1),
    ])
}

/// Carte blanche « libellé / valeur » du bandeau de chiffres.
@available(iOS 26.0, *)
final class LVStatCell: UIView {
    let valueLabel = UILabel()
    private let nameLabel = UILabel()

    init(label: String, value: String) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        nameLabel.attributedText = lvDotted(label)
        nameLabel.numberOfLines = 1
        nameLabel.lineBreakMode = .byTruncatingTail
        valueLabel.text = value
        valueLabel.font = .systemFont(ofSize: 17, weight: .bold)
        valueLabel.textColor = PCTheme.ink
        valueLabel.adjustsFontSizeToFitWidth = true
        valueLabel.minimumScaleFactor = 0.6
        let stack = UIStackView(arrangedSubviews: [nameLabel, valueLabel])
        stack.axis = .vertical
        stack.spacing = 8
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            stack.topAnchor.constraint(equalTo: topAnchor, constant: 16),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -16),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func set(label: String, value: String) {
        if nameLabel.attributedText?.string != label { nameLabel.attributedText = lvDotted(label) }
        if valueLabel.text != value { valueLabel.text = value }
    }
}

/// Fine ligne verticale qui s'estompe vers le bas (séparateur des colonnes de « Comportement des clients »).
@available(iOS 26.0, *)
final class LVFadeLine: UIView {
    private let grad = CAGradientLayer()

    override init(frame: CGRect) {
        super.init(frame: frame)
        grad.colors = [UIColor(white: 0, alpha: 0.10).cgColor, UIColor(white: 0, alpha: 0).cgColor]
        layer.addSublayer(grad)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func layoutSubviews() {
        super.layoutSubviews()
        grad.frame = bounds
    }
}

/// Une colonne « libellé / chiffre » de la carte « Comportement des clients ».
@available(iOS 26.0, *)
final class LVBehaviorColumn: UIView {
    private let nameLabel = UILabel()
    private let valueLabel = UILabel()

    init(label: String, value: String, divider: Bool) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        nameLabel.text = label
        nameLabel.font = .systemFont(ofSize: 14, weight: .regular)
        nameLabel.textColor = PCTheme.ink
        nameLabel.numberOfLines = 1
        nameLabel.lineBreakMode = .byTruncatingTail
        valueLabel.text = value
        valueLabel.font = .monospacedDigitSystemFont(ofSize: 17, weight: .regular)
        valueLabel.textColor = PCTheme.ink
        let stack = UIStackView(arrangedSubviews: [nameLabel, valueLabel])
        stack.axis = .vertical
        stack.spacing = 6
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        let pad: CGFloat = divider ? 12 : 0
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: pad),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor),
            stack.topAnchor.constraint(equalTo: topAnchor),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: bottomAnchor),
        ])
        if divider {
            let line = LVFadeLine()
            line.translatesAutoresizingMaskIntoConstraints = false
            addSubview(line)
            NSLayoutConstraint.activate([
                line.leadingAnchor.constraint(equalTo: leadingAnchor),
                line.topAnchor.constraint(equalTo: topAnchor),
                line.bottomAnchor.constraint(equalTo: bottomAnchor),
                line.widthAnchor.constraint(equalToConstant: 1),
            ])
        }
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func set(label: String, value: String) {
        if nameLabel.text != label { nameLabel.text = label }
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
final class LiveViewController: UIViewController, UIGestureRecognizerDelegate, UIScrollViewDelegate, DetailPushHosting {
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
    private let legendOrders = LVLegendPill(purple: true)
    private let legendVisitors = LVLegendPill(purple: false)
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
        scroll.delegate = self
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
        // 1. Globe pleine largeur (zoomable) + légende : commandes en violet, visiteurs en bleu
        let globeWrap = UIView()
        globeWrap.translatesAutoresizingMaskIntoConstraints = false
        globe.translatesAutoresizingMaskIntoConstraints = false
        globeWrap.addSubview(globe)

        let legend = UIStackView(arrangedSubviews: [legendOrders, legendVisitors])
        legend.axis = .horizontal
        legend.spacing = 8
        legend.alignment = .center
        legend.isUserInteractionEnabled = false
        legend.translatesAutoresizingMaskIntoConstraints = false
        globeWrap.addSubview(legend)

        content.addArrangedSubview(globeWrap)
        NSLayoutConstraint.activate([
            globeWrap.heightAnchor.constraint(equalToConstant: 340),
            globe.topAnchor.constraint(equalTo: globeWrap.topAnchor),
            globe.bottomAnchor.constraint(equalTo: globeWrap.bottomAnchor),
            globe.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            globe.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            legend.topAnchor.constraint(equalTo: globeWrap.topAnchor, constant: 6),
            legend.leadingAnchor.constraint(equalTo: globeWrap.leadingAnchor, constant: 4),
            legend.trailingAnchor.constraint(lessThanOrEqualTo: globeWrap.trailingAnchor, constant: -4),
        ])

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
        behaviorColumns = cols.enumerated().map { LVBehaviorColumn(label: $0.element.l, value: $0.element.v, divider: $0.offset > 0) }
        let colStack = UIStackView(arrangedSubviews: behaviorColumns)
        colStack.axis = .horizontal
        colStack.spacing = 0
        colStack.distribution = .fillEqually
        colStack.alignment = .fill
        colStack.heightAnchor.constraint(equalToConstant: 200).isActive = true
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
        if barTitle.text != str("title") { barTitle.text = str("title") }
        let visitors = (info["visitors"] as? NSNumber)?.intValue ?? 0
        let ordersLabel = str("ordersLabel")
        let ordersText = ordersLabel.isEmpty ? "Orders" : ordersLabel
        if legendOrders.label.text != ordersText { legendOrders.label.text = ordersText }
        if legendVisitors.label.text != str("visitorsLabel") { legendVisitors.label.text = str("visitorsLabel") }
        if let g = info["globe"] as? [String: Any] { globe.apply(globe: g, visitors: visitors, lang: str("lang")) }

        for (cell, s) in zip(statCells, pairs("stats")) { cell.set(label: s.l, value: s.v) }

        if behaviorTitle.attributedText?.string != str("behaviorTitle") { behaviorTitle.attributedText = lvDotted(str("behaviorTitle")) }
        for (col, b) in zip(behaviorColumns, pairs("behavior")) { col.set(label: b.l, value: b.v) }

        if locTitle.attributedText?.string != str("locTitle") { locTitle.attributedText = lvDotted(str("locTitle")) }
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
                none.font = .systemFont(ofSize: 17)
                none.textColor = PCTheme.sub
                none.numberOfLines = 0
                let wrap = UIView()
                none.translatesAutoresizingMaskIntoConstraints = false
                wrap.addSubview(none)
                NSLayoutConstraint.activate([
                    none.leadingAnchor.constraint(equalTo: wrap.leadingAnchor, constant: 16),
                    none.trailingAnchor.constraint(equalTo: wrap.trailingAnchor, constant: -16),
                    none.topAnchor.constraint(equalTo: wrap.topAnchor, constant: 18),
                    none.bottomAnchor.constraint(equalTo: wrap.bottomAnchor, constant: -26),
                ])
                locStack.addArrangedSubview(wrap)
            } else {
                for l in locs { locStack.addArrangedSubview(LVLocRow(name: l.name, pct: l.pct)) }
            }
        }
    }

    // MARK: Défilement (le globe se met en retrait pendant que la page bouge)

    func scrollViewWillBeginDragging(_ scrollView: UIScrollView) { globe.pageScrolling = true }
    func scrollViewDidEndDragging(_ scrollView: UIScrollView, willDecelerate decelerate: Bool) {
        if !decelerate { globe.pageScrolling = false }
    }
    func scrollViewDidEndDecelerating(_ scrollView: UIScrollView) { globe.pageScrolling = false }
    func scrollViewDidEndScrollingAnimation(_ scrollView: UIScrollView) { globe.pageScrolling = false }

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
