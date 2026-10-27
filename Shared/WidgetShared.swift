import Foundation

// Données partagées entre l'app et l'extension widgets (App Group).
// L'app (JS -> WebViewContainer -> WidgetBridge) écrit un « snapshot » des chiffres du jour ;
// les widgets le lisent et calculent exactement les mêmes indicateurs que l'écran d'accueil.

struct WidgetPlanItem: Codable {
    var at: Double      // ms epoch — commande planifiée pendant que l'app est fermée
    var s: Double       // total (centimes)
    var g: Double       // ventes brutes (centimes)
    var d: Double       // remises (centimes)
    var se: Double      // sessions ajoutées
}

struct ShopifyWidgetSnapshot: Codable {
    var store: String = ""
    var sym: String = "$"
    var cur: String = "USD"
    var dec: Int = 2
    var ts: Double = 0          // ms epoch de la dernière mise à jour
    var off: Double = 0         // décalage horaire de la boutique (ms)
    var dayEnd: Double = 0      // ms epoch de la fin du jour boutique
    // Aujourd'hui (centimes pour les montants)
    var s: Double = 0
    var o: Double = 0
    var se: Double = 0
    var net: Double = 0
    // Hier jusqu'à la même heure (comparaison)
    var ps: Double = 0
    var po: Double = 0
    var pse: Double = 0
    var pnet: Double = 0
    // Séries horaires d'aujourd'hui (0h -> heure courante)
    var hs: [Double] = []
    var ho: [Double] = []
    var he: [Double] = []
    var plan: [WidgetPlanItem] = []

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Keys.self)
        store = try c.decodeIfPresent(String.self, forKey: .store) ?? ""
        sym = try c.decodeIfPresent(String.self, forKey: .sym) ?? "$"
        cur = try c.decodeIfPresent(String.self, forKey: .cur) ?? "USD"
        dec = try c.decodeIfPresent(Int.self, forKey: .dec) ?? 2
        ts = try c.decodeIfPresent(Double.self, forKey: .ts) ?? 0
        off = try c.decodeIfPresent(Double.self, forKey: .off) ?? 0
        dayEnd = try c.decodeIfPresent(Double.self, forKey: .dayEnd) ?? 0
        s = try c.decodeIfPresent(Double.self, forKey: .s) ?? 0
        o = try c.decodeIfPresent(Double.self, forKey: .o) ?? 0
        se = try c.decodeIfPresent(Double.self, forKey: .se) ?? 0
        net = try c.decodeIfPresent(Double.self, forKey: .net) ?? 0
        ps = try c.decodeIfPresent(Double.self, forKey: .ps) ?? 0
        po = try c.decodeIfPresent(Double.self, forKey: .po) ?? 0
        pse = try c.decodeIfPresent(Double.self, forKey: .pse) ?? 0
        pnet = try c.decodeIfPresent(Double.self, forKey: .pnet) ?? 0
        hs = try c.decodeIfPresent([Double].self, forKey: .hs) ?? []
        ho = try c.decodeIfPresent([Double].self, forKey: .ho) ?? []
        he = try c.decodeIfPresent([Double].self, forKey: .he) ?? []
        plan = try c.decodeIfPresent([WidgetPlanItem].self, forKey: .plan) ?? []
    }

    private enum Keys: String, CodingKey {
        case store, sym, cur, dec, ts, off, dayEnd, s, o, se, net, ps, po, pse, pnet, hs, ho, he, plan
    }
}

enum ShopifyWidgetStore {
    static let key = "shopify.widget.snapshot"

    static let defaultGroup = "group.com.checker.shopifylarp"

    /// Identifiant de l'app (pas de l'extension), même si l'outil de signature a réécrit les bundle IDs.
    private static var appBundleID: String {
        let url = Bundle.main.bundleURL
        if url.pathExtension == "appex" {
            // App.app/PlugIns/ShopifyWidgets.appex -> App.app
            let appURL = url.deletingLastPathComponent().deletingLastPathComponent()
            if let id = Bundle(url: appURL)?.bundleIdentifier { return id }
            if let id = Bundle.main.bundleIdentifier, let dot = id.lastIndex(of: ".") {
                return String(id[id.startIndex..<dot])
            }
        }
        return Bundle.main.bundleIdentifier ?? "com.checker.shopifylarp"
    }

    /// Groupe réellement accessible : « group.<bundle id de l'app> » (AltStore / Sideloadly réécrivent le
    /// groupe ainsi), sinon le groupe d'origine. On garde le premier dont le conteneur existe.
    static let groupID: String = {
        let candidates = ["group." + appBundleID, defaultGroup]
        for id in candidates where FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: id) != nil {
            return id
        }
        return candidates[0]
    }()

    static var defaults: UserDefaults? { UserDefaults(suiteName: groupID) }

    @discardableResult
    static func save(json: String) -> Bool {
        guard let d = defaults else { return false }
        d.set(json, forKey: key)
        return true
    }

    static func load() -> ShopifyWidgetSnapshot? {
        guard let raw = defaults?.string(forKey: key),
              let data = raw.data(using: .utf8),
              let snap = try? JSONDecoder().decode(ShopifyWidgetSnapshot.self, from: data) else { return nil }
        return snap
    }
}
