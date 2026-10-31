import SwiftUI
import WidgetKit

// MARK: - Widgets d'écran verrouillé (accessoryRectangular)
// 1) « Ventes totales · 7 j » : barres des 7 derniers jours, pic en bas à gauche, minimum en bas à droite.
// 2) « Gross volume » : total des 7 jours + variation vs les 7 jours d'avant.

struct LockChrome: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .containerBackground(for: .widget) { Color.clear }
        } else {
            content.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }
}

/// Règles fines, ligne de points en bas et une barre fine par jour.
struct LockBars: View {
    let values: [Double]

    var body: some View {
        GeometryReader { g in
            let w = g.size.width
            let h = g.size.height
            let hi = max(values.max() ?? 0, 0.000001)
            let step: CGFloat = 4.4
            let dots = max(Int(w / step), 1)
            ZStack(alignment: .topLeading) {
                Path { p in
                    p.move(to: CGPoint(x: 0, y: 0.5)); p.addLine(to: CGPoint(x: w, y: 0.5))
                    p.move(to: CGPoint(x: 0, y: h * 0.42)); p.addLine(to: CGPoint(x: w, y: h * 0.42))
                }
                .stroke(Color.primary.opacity(0.45), lineWidth: 0.7)

                HStack(spacing: step - 2.2) {
                    ForEach(0..<dots, id: \.self) { _ in
                        Capsule().frame(width: 2.2, height: 2.2)
                    }
                }
                .frame(width: w, height: h, alignment: .bottomLeading)

                // Un jour à 0 reste un simple point de la ligne ; un jour avec des ventes = une barre posée exactement sur un point.
                ForEach(Array(values.enumerated()), id: \.offset) { i, v in
                    if v > 0 {
                        let bh = max(4, (h - 2) * CGFloat(v / hi))
                        let target = w * (CGFloat(i) + 0.5) / CGFloat(max(values.count, 1))
                        let j = min(max((target - 1.1) / step, 0).rounded(), CGFloat(dots - 1))
                        Capsule()
                            .frame(width: 2.2, height: bh)
                            .position(x: j * step + 1.1, y: h - bh / 2)
                    }
                }
            }
        }
    }
}

struct LockSalesView: View {
    let m: WidgetMetrics

    var body: some View {
        let v = m.weekSales.isEmpty ? [Double](repeating: 0, count: 7) : m.weekSales
        let hi = v.max() ?? 0
        let lo = v.min() ?? 0
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 4) {
                Text(WText.t("totalSales"))
                    .font(.system(size: 14, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Spacer(minLength: 2)
                Text(WText.t("sevenDays"))
                    .font(.system(size: 14, weight: .medium))
                    .lineLimit(1)
            }
            LockBars(values: v)
                .frame(height: 24)
            HStack {
                Text(hi > 0 ? WFormat.moneyCompact(hi, sym: m.sym) : "-")
                Spacer(minLength: 2)
                Text(lo > 0 ? WFormat.moneyCompact(lo, sym: m.sym) : "-")
            }
            .font(.system(size: 13, weight: .medium))
            .opacity(0.85)
            .lineLimit(1)
        }
        .modifier(LockChrome())
    }
}

struct LockGrossView: View {
    let m: WidgetMetrics

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(WFormat.moneyPlain(m.weekTotal, sym: m.sym))
                    .font(.system(size: 30, weight: .bold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                if let c = m.weekChange {
                    let r = Int(c.rounded())
                    HStack(spacing: 2) {
                        if r != 0 {
                            Text(r > 0 ? "\u{25B2}" : "\u{25BC}").font(.system(size: 12, weight: .bold))
                        }
                        Text(WFormat.change(c)).font(.system(size: 17, weight: .medium))
                    }
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                }
            }
            Text(WText.t("grossVolume"))
                .font(.system(size: 16, weight: .medium))
                .opacity(0.85)
                .lineLimit(1)
        }
        .modifier(LockChrome())
    }
}

struct ShopifyLockSalesWidget: Widget {
    let kind = "ShopifyLockSalesWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ShopifyProvider()) { entry in
            LockSalesView(m: entry.metrics)
        }
        .configurationDisplayName("Sales trend")
        .description("Total sales over the last 7 days.")
        .supportedFamilies([.accessoryRectangular])
    }
}

struct ShopifyLockGrossWidget: Widget {
    let kind = "ShopifyLockGrossWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ShopifyProvider()) { entry in
            LockGrossView(m: entry.metrics)
        }
        .configurationDisplayName("Gross volume")
        .description("Gross volume over the last 7 days, compared with the previous 7.")
        .supportedFamilies([.accessoryRectangular])
    }
}
