import Foundation
import WidgetKit

/// Reçoit le snapshot des chiffres du jour envoyé par la page (message « larpWidget »),
/// l'écrit dans l'App Group et demande aux widgets de se rafraîchir.
enum WidgetBridge {
    private static var lastReload = Date.distantPast
    private static var lastRaw = ""

    static func update(body: Any) {
        var raw: String?
        if let s = body as? String {
            raw = s
        } else if JSONSerialization.isValidJSONObject(body),
                  let data = try? JSONSerialization.data(withJSONObject: body),
                  let s = String(data: data, encoding: .utf8) {
            raw = s
        }
        guard let json = raw, !json.isEmpty, json != lastRaw else { return }
        lastRaw = json
        guard ShopifyWidgetStore.save(json: json) else { return }
        let now = Date()
        // Les rechargements demandés depuis l'app au premier plan ne sont pas limités, on évite juste le spam.
        if now.timeIntervalSince(lastReload) >= 4 {
            lastReload = now
            WidgetCenter.shared.reloadAllTimelines()
        }
    }
}
