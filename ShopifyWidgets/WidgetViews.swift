import SwiftUI
import WidgetKit

// MARK: - Palette (relevée sur les captures)

enum WColor {
    static let bgTop = Color(red: 0.140, green: 0.140, blue: 0.145)
    static let bgBottom = Color(red: 0.030, green: 0.030, blue: 0.035)
    static let label = Color(white: 0.69)
    static let sub = Color(white: 0.63)
    static let up = Color(red: 0.25, green: 0.72, blue: 0.55)
    static let down = Color(red: 0.93, green: 0.36, blue: 0.31)
    static let flat = Color(white: 0.62)
    static let tile = Color(red: 0.170, green: 0.170, blue: 0.185)
    static let purple = Color(red: 0.50, green: 0.36, blue: 0.98)
    static let blue = Color(red: 0.40, green: 0.55, blue: 0.98)
    static let teal = Color(red: 0.34, green: 0.86, blue: 0.70)
}

struct WidgetBackground: View {
    var body: some View {
        LinearGradient(colors: [WColor.bgTop, WColor.bgBottom], startPoint: .top, endPoint: .bottom)
    }
}

struct WidgetChrome: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .containerBackground(for: .widget) { WidgetBackground() }
        } else {
            content
                .padding(16)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .background(WidgetBackground())
        }
    }
}

extension View {
    func widgetChrome() -> some View { modifier(WidgetChrome()) }
}

// MARK: - Briques

struct ShopifyBagMark: View {
    var width: CGFloat = 24
    var body: some View {
        Image("ShopifyBag")
            .resizable()
            .renderingMode(.template)
            .scaledToFit()
            .frame(width: width, height: width)
            .foregroundColor(.white)
    }
}

struct WidgetHeader: View {
    let m: WidgetMetrics
    var nameSize: CGFloat = 17
    var subSize: CGFloat = 13
    var bagSize: CGFloat = 26

    var body: some View {
        HStack(alignment: .top, spacing: 6) {
            VStack(alignment: .leading, spacing: 1) {
                Text(m.store)
                    .font(.system(size: nameSize, weight: .bold))
                    .foregroundColor(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(WText.t("updated") + WFormat.time(m.updated))
                    .font(.system(size: subSize, weight: .medium))
                    .foregroundColor(WColor.sub)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            Spacer(minLength: 4)
            ShopifyBagMark(width: bagSize)
        }
    }
}

struct ChangeBadge: View {
    let value: Double?
    var size: CGFloat = 14

    private var rounded: Int? { value.map { Int($0.rounded()) } }

    var body: some View {
        if let r = rounded, let v = value {
            if r == 0 {
                Text(WFormat.change(0))
                    .font(.system(size: size, weight: .semibold))
                    .foregroundColor(WColor.flat)
                    .lineLimit(1)
            } else {
                HStack(spacing: 2) {
                    Image(systemName: r > 0 ? "chevron.up" : "chevron.down")
                        .font(.system(size: size * 0.72, weight: .heavy))
                    Text(WFormat.change(v))
                        .font(.system(size: size, weight: .semibold))
                        .lineLimit(1)
                }
                .foregroundColor(r > 0 ? WColor.up : WColor.down)
            }
        }
    }
}

/// Libellé + valeur + variation sur la même ligne (petit et moyen widget).
struct MetricRow: View {
    let label: String
    let value: String
    let change: Double?
    var valueSize: CGFloat = 20
    var labelSize: CGFloat = 12.5
    var badgeSize: CGFloat = 14

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label)
                .font(.system(size: labelSize, weight: .medium))
                .foregroundColor(WColor.label)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(value)
                    .font(.system(size: valueSize, weight: .bold))
                    .foregroundColor(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                Spacer(minLength: 2)
                ChangeBadge(value: change, size: badgeSize)
            }
        }
    }
}

/// Libellé, valeur, puis variation dessous + mini-graphique à droite (grand widget).
struct SparkCell: View {
    let label: String
    let value: String
    let change: Double?
    let values: [Double]

    var body: some View {
        HStack(alignment: .center, spacing: 6) {
            VStack(alignment: .leading, spacing: 1) {
                Text(label)
                    .font(.system(size: 12.5, weight: .medium))
                    .foregroundColor(WColor.label)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(value)
                    .font(.system(size: 21, weight: .bold))
                    .foregroundColor(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                ChangeBadge(value: change, size: 13)
            }
            Spacer(minLength: 0)
            Sparkline(values: values)
                .frame(width: 38, height: 30)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Graphiques

struct Sparkline: View {
    let values: [Double]

    private static func points(_ raw: [Double], in size: CGSize) -> [CGPoint] {
        var v = raw
        if v.isEmpty { v = [0, 0] }
        if v.count == 1 { v = [v[0], v[0]] }
        let lo = v.min() ?? 0
        let hi = v.max() ?? 1
        let span = hi - lo
        let inset: CGFloat = 2
        return v.enumerated().map { i, y in
            let x = size.width * CGFloat(i) / CGFloat(v.count - 1)
            let t = span > 0.000001 ? CGFloat((y - lo) / span) : 0.5
            return CGPoint(x: x, y: inset + (size.height - inset * 2) * (1 - t))
        }
    }

    private static func smooth(_ p: [CGPoint], height: CGFloat) -> Path {
        var path = Path()
        guard let first = p.first else { return path }
        path.move(to: first)
        if p.count == 2 { path.addLine(to: p[1]); return path }
        for i in 0..<(p.count - 1) {
            let p0 = i > 0 ? p[i - 1] : p[i]
            let p1 = p[i]
            let p2 = p[i + 1]
            let p3 = i + 2 < p.count ? p[i + 2] : p[i + 1]
            let c1 = CGPoint(x: p1.x + (p2.x - p0.x) / 6, y: min(max(p1.y + (p2.y - p0.y) / 6, 0), height))
            let c2 = CGPoint(x: p2.x - (p3.x - p1.x) / 6, y: min(max(p2.y - (p3.y - p1.y) / 6, 0), height))
            path.addCurve(to: p2, control1: c1, control2: c2)
        }
        return path
    }

    var body: some View {
        GeometryReader { geo in
            Self.smooth(Self.points(values, in: geo.size), height: geo.size.height)
                .stroke(
                    LinearGradient(colors: [WColor.purple, WColor.blue, WColor.teal], startPoint: .leading, endPoint: .trailing),
                    style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round)
                )
        }
    }
}

struct BarChart: View {
    let values: [Double?]

    var body: some View {
        GeometryReader { geo in
            let n = max(values.count, 1)
            let gap: CGFloat = 2.2
            let barW = max(1, (geo.size.width - gap * CGFloat(n - 1)) / CGFloat(n))
            let maxV = max(values.compactMap { $0 }.max() ?? 0, 1)
            LinearGradient(colors: [WColor.purple, WColor.purple, WColor.blue, WColor.teal], startPoint: .bottom, endPoint: .top)
                .mask(
                    HStack(alignment: .bottom, spacing: gap) {
                        ForEach(0..<n, id: \.self) { i in
                            let v = (i < values.count ? values[i] : nil) ?? 0
                            Capsule()
                                .frame(width: barW, height: max(barW, geo.size.height * CGFloat(v / maxV)))
                        }
                    }
                    .frame(width: geo.size.width, height: geo.size.height, alignment: .bottom)
                )
        }
    }
}

// MARK: - Widget « Counter »

struct DigitTile: View {
    let char: Character
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 11, style: .continuous)
                .fill(WColor.tile)
            RoundedRectangle(cornerRadius: 11, style: .continuous)
                .strokeBorder(Color.white.opacity(0.05), lineWidth: 0.5)
            Text(String(char))
                .font(.system(size: 62, weight: .bold, design: .rounded))
                .foregroundColor(.white)
                .minimumScaleFactor(0.5)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct CounterWidgetView: View {
    let m: WidgetMetrics

    private var digits: [Character] {
        let n = Int(min(max(m.orders.rounded(), 0), 99_999))
        return Array(String(format: "%05d", n))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            WidgetHeader(m: m)
            HStack(spacing: 7) {
                ForEach(Array(digits.enumerated()), id: \.offset) { _, c in
                    DigitTile(char: c)
                }
            }
        }
        .widgetChrome()
    }
}

// MARK: - Widget « Aperçus » (Insights)

struct InsightsSmallView: View {
    let m: WidgetMetrics
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            WidgetHeader(m: m, nameSize: 15, subSize: 11, bagSize: 22)
            Spacer(minLength: 6)
            MetricRow(label: WText.t("totalSales"),
                      value: WFormat.money(m.sales, sym: m.sym, dec: m.dec),
                      change: m.dSales, valueSize: 18, labelSize: 12, badgeSize: 13)
            Spacer(minLength: 6)
            MetricRow(label: WText.t("visits"),
                      value: WFormat.count(m.visits),
                      change: m.dVisits, valueSize: 18, labelSize: 12, badgeSize: 13)
        }
        .widgetChrome()
    }
}

struct InsightsMediumView: View {
    let m: WidgetMetrics
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            WidgetHeader(m: m)
            Spacer(minLength: 8)
            HStack(alignment: .top, spacing: 18) {
                MetricRow(label: WText.t("totalSales"),
                          value: WFormat.money(m.sales, sym: m.sym, dec: m.dec), change: m.dSales)
                MetricRow(label: WText.t("visits"),
                          value: WFormat.count(m.visits), change: m.dVisits)
            }
            Spacer(minLength: 8)
            HStack(alignment: .top, spacing: 18) {
                MetricRow(label: WText.t("aov"),
                          value: WFormat.money(m.aov, sym: m.sym, dec: m.dec), change: m.dAov)
                MetricRow(label: WText.t("conversion"),
                          value: WFormat.rate(m.conv), change: m.dConv)
            }
        }
        .widgetChrome()
    }
}

struct InsightsLargeView: View {
    let m: WidgetMetrics
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            WidgetHeader(m: m)
            Spacer(minLength: 4)
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(WText.t("totalSales"))
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(WColor.label)
                        .lineLimit(1)
                    Text(WFormat.money(m.sales, sym: m.sym, dec: m.dec))
                        .font(.system(size: 26, weight: .bold))
                        .foregroundColor(.white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.55)
                    ChangeBadge(value: m.dSales, size: 14)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                BarChart(values: m.barsSales)
                    .frame(width: 150, height: 48)
            }
            Spacer(minLength: 4)
            HStack(alignment: .center, spacing: 14) {
                SparkCell(label: WText.t("visits"), value: WFormat.count(m.visits), change: m.dVisits, values: m.lineVisits)
                SparkCell(label: WText.t("aov"), value: WFormat.money(m.aov, sym: m.sym, dec: m.dec), change: m.dAov, values: m.lineAov)
            }
            Spacer(minLength: 4)
            HStack(alignment: .center, spacing: 14) {
                SparkCell(label: WText.t("conversion"), value: WFormat.rate(m.conv), change: m.dConv, values: m.lineConv)
                SparkCell(label: WText.t("orders"), value: WFormat.count(m.orders), change: m.dOrders, values: m.lineOrders)
            }
            Spacer(minLength: 4)
            HStack(alignment: .center, spacing: 14) {
                SparkCell(label: WText.t("netSales"), value: WFormat.money(m.net, sym: m.sym, dec: m.dec), change: m.dNet, values: m.lineNet)
                SparkCell(label: WText.t("visitors"), value: WFormat.count(m.visitors), change: m.dVisitors, values: m.lineVisitors)
            }
        }
        .widgetChrome()
    }
}

struct InsightsWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let m: WidgetMetrics

    var body: some View {
        switch family {
        case .systemSmall: InsightsSmallView(m: m)
        case .systemLarge: InsightsLargeView(m: m)
        default: InsightsMediumView(m: m)
        }
    }
}
