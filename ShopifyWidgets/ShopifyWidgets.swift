import SwiftUI
import WidgetKit

// MARK: - Timeline

struct ShopifyEntry: TimelineEntry {
    let date: Date
    let metrics: WidgetMetrics
}

struct ShopifyProvider: TimelineProvider {
    var counter = false

    // Maquette : uniquement pour la galerie de widgets (aperçu / placeholder).
    private func demo() -> WidgetMetrics {
        var m = WidgetMetrics.sample
        if counter { m.orders = 1256 }
        return m
    }

    // Aucune donnée reçue de l'app : on affiche 0 (jamais les chiffres de démo).
    private func empty() -> WidgetMetrics { WidgetMetrics.empty }

    func placeholder(in context: Context) -> ShopifyEntry {
        ShopifyEntry(date: Date(), metrics: demo())
    }

    func getSnapshot(in context: Context, completion: @escaping (ShopifyEntry) -> Void) {
        let now = Date()
        if context.isPreview {
            completion(ShopifyEntry(date: now, metrics: demo()))
            return
        }
        if let snap = ShopifyWidgetStore.load() {
            completion(ShopifyEntry(date: now, metrics: WidgetMetrics.make(snap, at: now)))
        } else {
            completion(ShopifyEntry(date: now, metrics: empty()))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ShopifyEntry>) -> Void) {
        let now = Date()
        let next = now.addingTimeInterval(15 * 60)
        guard let snap = ShopifyWidgetStore.load() else {
            completion(Timeline(entries: [ShopifyEntry(date: now, metrics: empty())], policy: .after(next)))
            return
        }
        // Une entrée maintenant + une à chaque commande planifiée (app fermée) dans les 6 prochaines heures.
        let nowMs = now.timeIntervalSince1970 * 1000
        var dates: [Date] = [now]
        for it in snap.plan where it.at > nowMs && it.at < nowMs + 6 * 3_600_000 && dates.count < 40 {
            dates.append(Date(timeIntervalSince1970: it.at / 1000))
        }
        if snap.dayEnd > nowMs && snap.dayEnd < nowMs + 6 * 3_600_000 {
            dates.append(Date(timeIntervalSince1970: snap.dayEnd / 1000 + 1))
        }
        let entries = dates.sorted().map { ShopifyEntry(date: $0, metrics: WidgetMetrics.make(snap, at: $0)) }
        completion(Timeline(entries: entries, policy: .after(next)))
    }
}

// MARK: - Widgets

struct ShopifyCounterWidget: Widget {
    let kind = "ShopifyCounterWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ShopifyProvider(counter: true)) { entry in
            CounterWidgetView(m: entry.metrics)
        }
        .configurationDisplayName("Counter")
        .description("Track your store's orders. Celebrate wins, big or small.")
        .supportedFamilies([.systemMedium])
    }
}

struct ShopifyInsightsWidget: Widget {
    let kind = "ShopifyInsightsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ShopifyProvider()) { entry in
            InsightsWidgetView(m: entry.metrics)
        }
        .configurationDisplayName("Insights")
        .description("Quickly access your store's performance.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

@main
struct ShopifyWidgetsBundle: WidgetBundle {
    var body: some Widget {
        ShopifyCounterWidget()
        ShopifyInsightsWidget()
    }
}
