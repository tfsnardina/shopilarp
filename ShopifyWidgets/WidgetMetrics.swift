import Foundation

// MARK: - Textes (même langues que l'app : fr / en / es / de)

enum WText {
    static var lang: String {
        let p = Locale.preferredLanguages.first ?? "en"
        return String(p.prefix(2)).lowercased()
    }

    private static let table: [String: [String: String]] = [
        "totalSales": ["fr": "Ventes totales", "en": "Total sales", "es": "Ventas totales", "de": "Gesamtumsatz"],
        "visits": ["fr": "Visites", "en": "Visits", "es": "Visitas", "de": "Besuche"],
        "aov": ["fr": "Panier moyen", "en": "Average order value", "es": "Valor promedio del pedido", "de": "Ø Bestellwert"],
        "conversion": ["fr": "Taux de conversion", "en": "Conversion rate", "es": "Tasa de conversión", "de": "Conversion-Rate"],
        "orders": ["fr": "Total des commandes", "en": "Total orders", "es": "Total de pedidos", "de": "Bestellungen gesamt"],
        "netSales": ["fr": "Ventes nettes", "en": "Net sales", "es": "Ventas netas", "de": "Nettoumsatz"],
        "visitors": ["fr": "Visiteurs", "en": "Visitors", "es": "Visitantes", "de": "Besucher"],
        "updated": ["fr": "Actualisé : ", "en": "Updated: ", "es": "Actualizado: ", "de": "Aktualisiert: "],
        "myStore": ["fr": "Ma boutique", "en": "My store", "es": "Mi tienda", "de": "Mein Shop"],
    ]

    static func t(_ key: String) -> String {
        guard let row = table[key] else { return key }
        return row[lang] ?? row["en"] ?? key
    }
}

// MARK: - Indicateurs calculés comme dans l'écran d'accueil de l'app (période « Aujourd'hui »)

struct WidgetMetrics {
    var store: String
    var updated: Date

    var sales: Double      // centimes
    var visits: Double
    var aov: Double        // centimes
    var conv: Double       // %
    var orders: Double
    var net: Double        // centimes
    var visitors: Double

    var dSales: Double?    // variation en %, nil = masquée
    var dVisits: Double?
    var dAov: Double?
    var dConv: Double?
    var dOrders: Double?
    var dNet: Double?
    var dVisitors: Double?

    var barsSales: [Double?]      // 24 barres (nil = heure pas encore passée)
    var lineVisits: [Double]
    var lineAov: [Double]
    var lineConv: [Double]
    var lineOrders: [Double]
    var lineNet: [Double]
    var lineVisitors: [Double]

    var sym: String
    var dec: Int

    static let visitorRatio = 0.9828   // visiteurs uniques / visites (rapport des maquettes Shopify)

    private static func change(_ cv: Double, _ pv: Double) -> Double? {
        if pv == 0 { return cv != 0 ? nil : 0 }
        return (cv - pv) / abs(pv) * 100
    }

    /// Snapshot + commandes planifiées pendant que l'app est fermée (même logique que « consumeBg »).
    static func make(_ snap: ShopifyWidgetSnapshot, at date: Date) -> WidgetMetrics {
        let now = date.timeIntervalSince1970 * 1000
        let day = 86_400_000.0
        var s = snap.s, o = snap.o, se = snap.se, net = snap.net
        var hs = snap.hs, ho = snap.ho, he = snap.he
        var ps = snap.ps, po = snap.po, pse = snap.pse, pnet = snap.pnet
        var compare = true

        var items = snap.plan.filter { $0.at > snap.ts && $0.at <= now }
        if snap.dayEnd > 0 && now >= snap.dayEnd {
            // Nouveau jour boutique pendant que l'app était fermée : on repart de zéro.
            let start = snap.dayEnd + floor((now - snap.dayEnd) / day) * day
            s = 0; o = 0; se = 0; net = 0; hs = []; ho = []; he = []
            ps = 0; po = 0; pse = 0; pnet = 0; compare = false
            items = snap.plan.filter { $0.at >= start && $0.at <= now }
            for it in items { add(it, start: start, snap: snap, &s, &o, &se, &net, &hs, &ho, &he) }
            let hour = Int(floor(((now + snap.off).truncatingRemainder(dividingBy: day)) / 3_600_000))
            pad(&hs, &ho, &he, upTo: hour)
        } else {
            let start = snap.dayEnd > 0 ? snap.dayEnd - day : 0
            for it in items where it.at >= start { add(it, start: start, snap: snap, &s, &o, &se, &net, &hs, &ho, &he) }
            let hour = Int(floor(((now + snap.off).truncatingRemainder(dividingBy: day)) / 3_600_000))
            if snap.dayEnd > 0 { pad(&hs, &ho, &he, upTo: max(hour, hs.count - 1)) }
        }

        let visits = se
        let aov = o > 0 ? s / o : 0
        let conv = se > 0 ? o / se * 100 : 0
        let visitors = (se * visitorRatio).rounded()
        let paov = po > 0 ? ps / po : 0
        let pconv = pse > 0 ? po / pse * 100 : 0
        let pvisitors = (pse * visitorRatio).rounded()

        // Séries pour les mini-graphiques
        var aovLine: [Double] = [], convLine: [Double] = []
        var cs = 0.0, co = 0.0, cse = 0.0
        for i in 0..<max(hs.count, 1) {
            cs += i < hs.count ? hs[i] : 0
            co += i < ho.count ? ho[i] : 0
            cse += i < he.count ? he[i] : 0
            aovLine.append(co > 0 ? cs / co : (aovLine.last ?? 0))
            convLine.append(cse > 0 ? co / cse * 100 : (convLine.last ?? 0))
        }
        let netRatio = s > 0 ? net / s : 1
        var bars: [Double?] = []
        for h in 0..<24 { bars.append(h < hs.count ? hs[h] : nil) }

        return WidgetMetrics(
            store: snap.store.isEmpty ? WText.t("myStore") : snap.store,
            updated: date,
            sales: s, visits: visits, aov: aov, conv: conv, orders: o, net: net, visitors: visitors,
            dSales: compare ? change(s, ps) : nil,
            dVisits: compare ? change(visits, pse) : nil,
            dAov: compare ? change(aov, paov) : nil,
            dConv: compare ? change(conv, pconv) : nil,
            dOrders: compare ? change(o, po) : nil,
            dNet: compare ? change(net, pnet) : nil,
            dVisitors: compare ? change(visitors, pvisitors) : nil,
            barsSales: bars,
            lineVisits: he,
            lineAov: aovLine,
            lineConv: convLine,
            lineOrders: ho,
            lineNet: hs.map { $0 * netRatio },
            lineVisitors: he.map { ($0 * visitorRatio).rounded() },
            sym: snap.sym, dec: snap.dec
        )
    }

    private static func add(_ it: WidgetPlanItem, start: Double, snap: ShopifyWidgetSnapshot,
                            _ s: inout Double, _ o: inout Double, _ se: inout Double, _ net: inout Double,
                            _ hs: inout [Double], _ ho: inout [Double], _ he: inout [Double]) {
        s += it.s; o += 1; se += it.se; net += it.g - it.d
        let hour = max(0, min(23, Int(floor(((it.at + snap.off).truncatingRemainder(dividingBy: 86_400_000)) / 3_600_000))))
        pad(&hs, &ho, &he, upTo: hour)
        hs[hour] += it.s; ho[hour] += 1; he[hour] += it.se
    }

    private static func pad(_ a: inout [Double], _ b: inout [Double], _ c: inout [Double], upTo hour: Int) {
        let n = min(23, max(0, hour)) + 1
        while a.count < n { a.append(0) }
        while b.count < n { b.append(0) }
        while c.count < n { c.append(0) }
    }

    // Maquette utilisée dans la galerie de widgets (valeurs des captures Shopify).
    static var sample: WidgetMetrics {
        let hours: [Double] = [0, 0, 0, 0, 0, 0, 0, 6, 14, 22, 24, 20, 23, 28, 25, 19, 26, 30, 27, 22, 14, 8, 3, 0]
        let line: [Double] = [3, 5, 4, 6, 9, 7, 11, 8, 12, 10, 14, 9, 13, 16, 12, 18, 15, 11, 14, 10]
        return WidgetMetrics(
            store: WText.t("myStore"), updated: Date(),
            sales: 263_850, visits: 8_954, aov: 4_350, conv: 2.5, orders: 87, net: 243_000, visitors: 8_800,
            dSales: 6, dVisits: -1, dAov: 9, dConv: 4, dOrders: -3, dNet: 1, dVisitors: -1,
            barsSales: hours.map { Optional($0) },
            lineVisits: line, lineAov: line.reversed(), lineConv: line.map { $0 * 0.8 },
            lineOrders: line.map { $0 + 2 }, lineNet: line.reversed().map { $0 + 1 }, lineVisitors: line.map { $0 * 0.9 },
            sym: "$", dec: 2
        )
    }
}

// MARK: - Formatage

enum WFormat {
    private static let suffixLangs: Set<String> = ["fr", "de", "es", "it", "pt", "nl", "pl", "sv", "da", "nb", "fi", "cs", "ru"]

    static func number(_ v: Double, decimals: Int, grouping: Bool = true) -> String {
        let nf = NumberFormatter()
        nf.locale = Locale.current
        nf.numberStyle = .decimal
        nf.usesGroupingSeparator = grouping
        nf.minimumFractionDigits = decimals
        nf.maximumFractionDigits = decimals
        return nf.string(from: NSNumber(value: v)) ?? String(v)
    }

    static func money(_ cents: Double, sym: String, dec: Int) -> String {
        let neg = cents < 0
        let body = number(abs(cents) / 100, decimals: dec)
        let symbol = sym.trimmingCharacters(in: .whitespaces)
        let text = suffixLangs.contains(WText.lang) ? body + "\u{00A0}" + symbol : symbol + body
        return (neg ? "-" : "") + text
    }

    static func count(_ v: Double) -> String { number(v.rounded(), decimals: 0) }

    /// « 2,5 % » (fr) / « 2.5% » (en) — même règle que pctStr() de l'app.
    static func rate(_ v: Double) -> String {
        let decimals = (v >= 10 || v == 0) ? 1 : (v < 1 ? 2 : 1)
        var s = number(v, decimals: decimals)
        let sep = Locale.current.decimalSeparator ?? "."
        if s.hasSuffix(sep + "0") { s.removeLast(sep.count + 1) }
        return s + percentSuffix
    }

    static var percentSuffix: String { ["fr", "de", "es", "ru", "cs", "sv", "nb", "fi"].contains(WText.lang) ? "\u{00A0}%" : "%" }

    static func change(_ v: Double) -> String { String(Int(abs(v).rounded())) + percentSuffix }

    static func time(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale.current
        f.timeStyle = .short
        f.dateStyle = .none
        return f.string(from: date)
    }
}
