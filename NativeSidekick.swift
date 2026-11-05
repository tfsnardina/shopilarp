import SwiftUI
import UIKit

/// Page « Sidekick » native (SwiftUI + Liquid Glass iOS 26).
///
/// L'IA (Groq), les données du shop et l'exécution réelle des actions restent dans la page web (app.js) :
/// cette vue n'est que l'interface. Elle parle à la page via `SKBridge` (voir WebViewContainer.presentSidekick).
/// iOS < 26 : les verres retombent sur un matériau flou classique.

// MARK: - Thème

enum SK {
    static let purple = Color(white: 0.16)   // « accent » = noir doux (plus de violet)
    static let lilac = Color(white: 0.55)
    static let sky = Color(white: 0.74)
    static let pink = Color(red: 0.20, green: 0.72, blue: 0.50)
    static let green = Color(red: 0.20, green: 0.72, blue: 0.50)
    static let red = Color(red: 0.96, green: 0.25, blue: 0.37)
    static let amber = Color(red: 0.98, green: 0.72, blue: 0.20)
    static let ink = Color(white: 0.07)
    static let sub = Color(white: 0.42)
    static let bg = Color.white
    static let confetti: [Color] = [purple, sky, lilac, Color(white: 0.9), green]

    static func statusColor(_ key: String) -> Color {
        switch key {
        case "Active": return green
        case "Draft": return amber
        case "Unlisted": return sky
        default: return Color(white: 0.6)
        }
    }

    static func tap(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .light) {
        UIImpactFeedbackGenerator(style: style).impactOccurred()
    }
}

// MARK: - Liquid Glass (avec repli iOS < 26)

extension View {
    /// Verre fin et transparent : variante `.clear` + liseré et ombre légers (pas de gris sur fond blanc).
    /// Avec une teinte (bouton principal), on garde le verre normal.
    @ViewBuilder
    func skGlass<S: Shape>(_ shape: S, tint: Color? = nil, interactive: Bool = false) -> some View {
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            if let tint = tint {
                self.glassEffect(.regular.tint(tint).interactive(interactive), in: shape)
            } else {
                self.glassEffect(.clear.interactive(interactive), in: shape)
                    .overlay(shape.stroke(Color.black.opacity(0.07), lineWidth: 0.7))
                    .shadow(color: Color.black.opacity(0.06), radius: 10, y: 3)
            }
        } else {
            self.background(.ultraThinMaterial, in: shape)
                .overlay(shape.stroke(Color.black.opacity(0.08), lineWidth: 0.6))
        }
        #else
        self.background(.ultraThinMaterial, in: shape)
            .overlay(shape.stroke(Color.black.opacity(0.08), lineWidth: 0.6))
        #endif
    }
}

/// Regroupe plusieurs verres pour qu'ils fusionnent / se déforment ensemble.
struct SKGlassContainer<Content: View>: View {
    let spacing: CGFloat
    @ViewBuilder var content: () -> Content

    var body: some View {
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            GlassEffectContainer(spacing: spacing) { content() }
        } else {
            content()
        }
        #else
        content()
        #endif
    }
}

// MARK: - Données reçues de la page

struct SKInfo {
    var title = "New conversation"
    var greeting = ""
    var headline = "How can I help?"
    var whatsNew = "What’s new?"
    var placeholder = "Ask anything..."
    var suggestions: [String] = []
    var thread: [(q: String, a: String)] = []
    var first = ""
    var processing = "Processing"

    init(_ d: [String: Any]) {
        title = (d["title"] as? String) ?? title
        greeting = (d["greeting"] as? String) ?? greeting
        headline = (d["headline"] as? String) ?? headline
        whatsNew = (d["whatsNew"] as? String) ?? whatsNew
        placeholder = (d["placeholder"] as? String) ?? placeholder
        suggestions = (d["suggestions"] as? [String]) ?? []
        first = (d["first"] as? String) ?? ""
        processing = (d["processing"] as? String) ?? processing
        thread = ((d["thread"] as? [[String: Any]]) ?? []).map {
            (q: ($0["q"] as? String) ?? "", a: ($0["a"] as? String) ?? "")
        }
    }
}

private func skNum(_ v: Any?) -> Double? { (v as? NSNumber)?.doubleValue }

private func skJSON(_ s: String) -> [String: Any]? {
    guard let d = s.data(using: .utf8),
          let o = try? JSONSerialization.jsonObject(with: d) as? [String: Any] else { return nil }
    return o
}

struct SKReply {
    var id: Int
    var text: String
    var count: Int
    var failed: Bool

    init(id: Int, text: String, count: Int, failed: Bool) {
        self.id = id; self.text = text; self.count = count; self.failed = failed
    }

    init?(json: String) {
        guard let o = skJSON(json) else { return nil }
        id = Int(skNum(o["id"]) ?? 0)
        text = (o["reply"] as? String) ?? ""
        count = Int(skNum(o["count"]) ?? 0)
        failed = (o["failed"] as? Bool) ?? false
    }
}

struct SKCommit {
    var ok: Bool
    var message: String
    var button: String?
    var after: Bool

    init(ok: Bool, message: String, button: String? = nil, after: Bool = false) {
        self.ok = ok; self.message = message; self.button = button; self.after = after
    }

    init?(json: String) {
        guard let o = skJSON(json) else { return nil }
        ok = (o["ok"] as? Bool) ?? false
        message = (o["msg"] as? String) ?? ""
        button = o["btn"] as? String
        after = (o["after"] as? Bool) ?? false
    }
}

struct SKChange: Identifiable {
    let id = UUID()
    let label: String
    let from: String
    let to: String
}

struct SKStatusItem: Identifiable {
    let id = UUID()
    let title: String
    let fromLabel: String
    let fromKey: String
}

enum SKPreview {
    case none
    case create(title: String, price: String, stock: String, status: String, statusKey: String, hue: Double)
    case update(title: String, changes: [SKChange])
    case remove(title: String)
    case status(items: [SKStatusItem], more: Int, toLabel: String, toKey: String)
    case fulfill(number: String, customer: String, total: String)
    case nav(label: String)
}

struct SKPlan {
    var title: String
    var done: String
    var steps: [String]
    var error: String?
    var delay: Double          // secondes
    var commitAt: Int
    var preview: SKPreview

    init?(json: String) {
        guard let o = skJSON(json) else { return nil }
        title = (o["title"] as? String) ?? "Sidekick"
        done = (o["done"] as? String) ?? title
        steps = (o["steps"] as? [String]) ?? [""]
        if steps.isEmpty { steps = [""] }
        error = o["err"] as? String
        delay = (skNum(o["delay"]) ?? 540) / 1000
        commitAt = Int(skNum(o["commitAt"]) ?? Double(steps.count - 1))
        preview = SKPlan.parse(o["nv"] as? [String: Any])
    }

    private static func parse(_ nv: [String: Any]?) -> SKPreview {
        guard let nv = nv, let k = nv["k"] as? String else { return .none }
        func s(_ key: String) -> String {
            if let v = nv[key] as? String { return v }
            if let n = nv[key] as? NSNumber { return n.stringValue }
            return ""
        }
        switch k {
        case "create":
            return .create(title: s("title"), price: s("price"), stock: s("stock"),
                           status: s("status"), statusKey: s("st"), hue: skNum(nv["hue"]) ?? 260)
        case "update":
            let rows = (nv["changes"] as? [[String: Any]]) ?? []
            let ch = rows.map {
                SKChange(label: ($0["l"] as? String) ?? "", from: ($0["from"] as? String) ?? "", to: ($0["to"] as? String) ?? "")
            }
            return .update(title: s("title"), changes: ch)
        case "delete":
            return .remove(title: s("title"))
        case "status":
            let rows = (nv["items"] as? [[String: Any]]) ?? []
            let items = rows.map {
                SKStatusItem(title: ($0["title"] as? String) ?? "", fromLabel: ($0["label"] as? String) ?? "", fromKey: ($0["st"] as? String) ?? "")
            }
            return .status(items: items, more: Int(skNum(nv["more"]) ?? 0), toLabel: s("toLabel"), toKey: s("to"))
        case "fulfill":
            return .fulfill(number: s("n"), customer: s("name"), total: s("total"))
        case "nav":
            return .nav(label: s("label"))
        default:
            return .none
        }
    }
}

/// Ponts vers la page web (implémentés par WebViewContainer).
struct SKBridge {
    var ask: (String) async -> SKReply
    var plan: (Int, Int) async -> SKPlan?
    var commit: (Int, Int) async -> SKCommit
    var button: (Int, Int) -> Void
    var after: (Int, Int) -> Void
    var reset: () -> Void
}

// MARK: - Modèles

@MainActor
final class SKCardModel: ObservableObject, Identifiable {
    enum Phase { case waiting, working, done, failed }

    let id = UUID()
    let index: Int
    let replyID: Int

    @Published var plan: SKPlan?
    @Published var phase: Phase = .waiting
    @Published var step = 0              // étape en cours ; celles d'avant sont terminées
    @Published var shown = false
    @Published var folded = false
    @Published var progress: CGFloat = 0
    @Published var error: String?
    @Published var buttonLabel: String?
    @Published var burstID = 0
    @Published var shake: CGFloat = 0

    init(index: Int, replyID: Int) {
        self.index = index
        self.replyID = replyID
    }

    private func pause(_ s: Double) async {
        try? await Task.sleep(nanoseconds: UInt64(max(0, s) * 1_000_000_000))
    }

    private func fail(_ message: String, layout: () -> Void) {
        error = message.isEmpty ? "Error" : message
        withAnimation(.spring(response: 0.4, dampingFraction: 0.7)) { phase = .failed }
        withAnimation(.easeOut(duration: 0.5)) { shake = 1 }
        UINotificationFeedbackGenerator().notificationOccurred(.error)
        layout()
    }

    func run(bridge: SKBridge, layout: @escaping () -> Void) async {
        guard let p = await bridge.plan(replyID, index) else { return }
        plan = p
        phase = .working
        withAnimation(.spring(response: 0.65, dampingFraction: 0.72)) { shown = true }
        layout()
        await pause(0.42)

        var result: SKCommit?
        for i in 0..<p.steps.count {
            if Task.isCancelled { return }
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) { step = i }
            UIImpactFeedbackGenerator(style: .soft).impactOccurred()
            if i == 0, case .fulfill = p.preview {
                let total = max(0.8, p.delay * Double(p.steps.count))
                withAnimation(.easeInOut(duration: total)) { progress = 1 }
            }
            layout()
            await pause(p.delay)
            if Task.isCancelled { return }
            if let e = p.error { fail(e, layout: layout); return }
            if i == p.commitAt {
                let r = await bridge.commit(replyID, index)
                if !r.ok { fail(r.message, layout: layout); return }
                result = r
            }
        }

        withAnimation(.spring(response: 0.5, dampingFraction: 0.75)) {
            step = p.steps.count
            phase = .done
            burstID += 1
            if let label = result?.button { buttonLabel = label }
        }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        layout()

        await pause(0.95)
        if Task.isCancelled { return }
        withAnimation(.easeInOut(duration: 0.45)) { folded = true }
        layout()
        await pause(0.5)
        layout()

        if result?.after == true {
            await pause(0.4)
            bridge.after(replyID, index)
        }
    }
}

@MainActor
final class SKTurn: ObservableObject, Identifiable {
    let id = UUID()
    let isUser: Bool
    @Published var text: String
    @Published var typing = false
    @Published var cards: [SKCardModel] = []

    init(user: String) { isUser = true; text = user }
    init(assistant: String, typing: Bool = false) { isUser = false; text = assistant; self.typing = typing }
}

@MainActor
final class SKChatModel: ObservableObject {
    let info: SKInfo
    let bridge: SKBridge
    @Published var turns: [SKTurn] = []
    @Published var input = ""
    @Published var busy = false
    @Published var scrollTick = 0
    var dismiss: (() -> Void)?
    private var worker: Task<Void, Never>?

    init(info: SKInfo, bridge: SKBridge) {
        self.info = info
        self.bridge = bridge
        for m in info.thread {
            turns.append(SKTurn(user: m.q))
            turns.append(SKTurn(assistant: m.a))
        }
        if !info.first.isEmpty {
            let q = info.first
            Task { [weak self] in
                try? await Task.sleep(nanoseconds: 480_000_000)
                self?.send(q)
            }
        }
    }

    func bump() { scrollTick += 1 }

    func reset() {
        worker?.cancel()
        worker = nil
        withAnimation(.spring(response: 0.5, dampingFraction: 0.85)) { turns = [] }
        input = ""
        busy = false
        bridge.reset()
    }

    func send(_ raw: String) {
        let q = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty, !busy else { return }
        input = ""
        busy = true
        SK.tap(.medium)
        withAnimation(.spring(response: 0.5, dampingFraction: 0.85)) {
            turns.append(SKTurn(user: q))
        }
        let reply = SKTurn(assistant: "", typing: true)
        turns.append(reply)
        bump()

        worker = Task { [weak self] in
            guard let self = self else { return }
            let r = await self.bridge.ask(q)
            if Task.isCancelled { return }
            reply.typing = false
            await self.typewrite(reply, r.text)
            if Task.isCancelled { return }
            for i in 0..<r.count {
                let card = SKCardModel(index: i, replyID: r.id)
                reply.cards.append(card)
                await card.run(bridge: self.bridge, layout: { [weak self] in self?.bump() })
                if Task.isCancelled { return }
            }
            self.busy = false
        }
    }

    private func typewrite(_ turn: SKTurn, _ text: String) async {
        let chars = Array(text)
        var k = 0
        while k < chars.count {
            k = min(chars.count, k + Int.random(in: 2...4))
            turn.text = String(chars[0..<k])
            bump()
            try? await Task.sleep(nanoseconds: 22_000_000)
            if Task.isCancelled { return }
        }
    }
}

// MARK: - Racine

struct SKRootView: View {
    @ObservedObject var model: SKChatModel

    var body: some View {
        ZStack {
            SKBackdrop()
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        if model.turns.isEmpty { SKIntro(info: model.info) }
                        ForEach(model.turns) { t in SKTurnView(turn: t, model: model) }
                        Color.clear.frame(height: 1).id("bottom")
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 8)
                    .padding(.bottom, 12)
                }
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: model.scrollTick) { _ in
                    withAnimation(.easeOut(duration: 0.28)) { proxy.scrollTo("bottom", anchor: .bottom) }
                }
            }
        }
        .safeAreaInset(edge: .top, spacing: 0) { SKHeader(model: model) }
        .safeAreaInset(edge: .bottom, spacing: 0) { SKInputBar(model: model) }
    }
}

struct SKBackdrop: View {
    var body: some View { Color.white.ignoresSafeArea() }
}

// MARK: - En-tête

struct SKCircleButton: View {
    let icon: String
    var size: CGFloat = 46
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(SK.ink)
                .frame(width: size, height: size)
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .skGlass(Circle(), interactive: true)
    }
}

struct SKHeader: View {
    @ObservedObject var model: SKChatModel

    var body: some View {
        SKGlassContainer(spacing: 12) {
            HStack(spacing: 12) {
                SKCircleButton(icon: "xmark") { SK.tap(); model.dismiss?() }
                HStack(spacing: 6) {
                    Text(model.info.title).font(.inter(18, .medium)).lineLimit(1)
                    Image(systemName: "chevron.down").font(.system(size: 12, weight: .semibold))
                }
                .foregroundStyle(Color(white: 0.3))
                .frame(maxWidth: .infinity)
                SKCircleButton(icon: "square.and.pencil") { SK.tap(); model.reset() }
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 26)
        .padding(.bottom, 12)
    }
}

// MARK: - Accueil

struct SKIntro: View {
    let info: SKInfo

    var body: some View {
        VStack(spacing: 8) {
            SKMascot().frame(width: 68, height: 68).padding(.bottom, 6)
            if !info.greeting.isEmpty {
                Text(info.greeting).font(.inter(17, .medium)).foregroundStyle(SK.sub)
            }
            Text(info.headline).font(.inter(32, .bold)).foregroundStyle(SK.ink).multilineTextAlignment(.center)
            HStack(spacing: 8) {
                Circle().fill(SK.purple).frame(width: 8, height: 8)
                Text(info.whatsNew).font(.inter(15, .semibold)).foregroundStyle(SK.ink)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .skGlass(Capsule(), interactive: true)
            .padding(.top, 10)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 56)
        .transition(.opacity.combined(with: .scale(scale: 0.94)))
    }
}

// MARK: - Messages

struct SKTurnView: View {
    @ObservedObject var turn: SKTurn
    @ObservedObject var model: SKChatModel

    var body: some View {
        if turn.isUser {
            HStack {
                Spacer(minLength: 56)
                Text(turn.text)
                    .font(.inter(18, .regular))
                    .foregroundStyle(SK.ink)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 14)
                    .background(Color(white: 0.925), in: RoundedRectangle(cornerRadius: 26, style: .continuous))
            }
            .transition(.move(edge: .trailing).combined(with: .opacity))
        } else {
            VStack(alignment: .leading, spacing: 14) {
                if turn.typing {
                    SKProcessing(label: model.info.processing)
                } else if !turn.text.isEmpty {
                    Text(turn.text)
                        .font(.inter(18, .regular))
                        .foregroundStyle(SK.ink)
                        .lineSpacing(5)
                        .fixedSize(horizontal: false, vertical: true)
                }
                ForEach(turn.cards) { c in
                    SKActionCard(m: c) { model.bridge.button(c.replyID, c.index) }
                }
                if !turn.typing && !turn.text.isEmpty && !turn.isUser && turn.cards.allSatisfy({ $0.phase != .working && $0.phase != .waiting }) {
                    HStack(spacing: 22) {
                        ForEach(["doc.on.doc", "hand.thumbsup", "hand.thumbsdown"], id: \.self) { n in
                            Button { SK.tap(.soft) } label: { Image(systemName: n).font(.system(size: 18, weight: .regular)) }
                                .buttonStyle(.plain)
                        }
                    }
                    .foregroundStyle(Color(white: 0.3))
                    .padding(.top, 2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

/// Spinner « braille » (6 points qui s'allument en boucle) + « Traitement en cours », petit et discret.
struct SKProcessing: View {
    let label: String
    /// Points allumés à chaque image (colonne * 3 + ligne), 10 images de ~83 ms comme dans l'animation de référence.
    private static let frames: [[Int]] = [
        [3, 4, 2, 5], [4, 2, 5], [1, 2, 5], [0, 1, 2, 5], [0, 1, 2],
        [0, 3, 1, 2], [0, 3, 1], [0, 3, 4], [0, 3, 4, 5], [3, 4, 5],
    ]
    private let pitch: CGFloat = 5.0
    private let dia: CGFloat = 2.4

    var body: some View {
        HStack(spacing: 9) {
            TimelineView(.animation) { tl in
                let idx = Int(tl.date.timeIntervalSinceReferenceDate / 0.0833) % SKProcessing.frames.count
                let lit = SKProcessing.frames[idx]
                Canvas { ctx, _ in
                    for d in 0..<6 where lit.contains(d) {
                        let col = CGFloat(d / 3), row = CGFloat(d % 3)
                        let r = CGRect(x: col * pitch, y: row * pitch, width: dia, height: dia)
                        ctx.fill(Path(ellipseIn: r), with: .color(Color(white: 0.24)))
                    }
                }
                .frame(width: pitch + dia, height: pitch * 2 + dia)
            }
            Text(label)
                .font(.inter(15, .regular))
                .foregroundStyle(Color(white: 0.29))
        }
    }
}

// MARK: - Barre de saisie

struct SKInputBar: View {
    @ObservedObject var model: SKChatModel
    @FocusState private var focused: Bool

    private var hasText: Bool { !model.input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    var body: some View {
        VStack(spacing: 10) {
            if model.turns.isEmpty && !model.info.suggestions.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    SKGlassContainer(spacing: 10) {
                        HStack(spacing: 10) {
                            ForEach(model.info.suggestions, id: \.self) { s in
                                Button { SK.tap(); model.send(s) } label: {
                                    Text(s).font(.inter(15, .semibold)).foregroundStyle(SK.ink)
                                        .padding(.horizontal, 16).padding(.vertical, 11)
                                }
                                .buttonStyle(.plain)
                                .skGlass(Capsule(), interactive: true)
                            }
                        }
                        .padding(.horizontal, 20)
                    }
                }
                .transition(.opacity.combined(with: .move(edge: .bottom)))
            }

            VStack(alignment: .leading, spacing: 10) {
                TextField(model.info.placeholder, text: $model.input)
                    .font(.inter(19, .regular))
                    .focused($focused)
                    .submitLabel(.send)
                    .onSubmit { model.send(model.input) }
                    .padding(.horizontal, 6)
                HStack(spacing: 10) {
                    SKMascot().frame(width: 30, height: 30)
                    Spacer()
                    Button { SK.tap() } label: {
                        Image(systemName: "plus").font(.system(size: 22, weight: .regular))
                            .foregroundStyle(Color(white: 0.3)).frame(width: 38, height: 38)
                    }
                    .buttonStyle(.plain)
                    Button {
                        if hasText { model.send(model.input) } else { SK.tap() }
                    } label: {
                        ZStack {
                            if hasText {
                                Circle().fill(SK.ink)
                                Image(systemName: "arrow.up").font(.system(size: 16, weight: .bold)).foregroundStyle(.white)
                            } else {
                                Image(systemName: "mic").font(.system(size: 22, weight: .regular)).foregroundStyle(Color(white: 0.3))
                            }
                        }
                        .frame(width: 38, height: 38)
                        .animation(.spring(response: 0.35, dampingFraction: 0.75), value: hasText)
                    }
                    .buttonStyle(.plain)
                    .disabled(model.busy && !hasText)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .skGlass(RoundedRectangle(cornerRadius: 30, style: .continuous), interactive: true)
            .padding(.horizontal, 16)
        }
        .padding(.top, 6)
        .padding(.bottom, 6)
    }
}

// MARK: - Mascotte

struct SKMascot: View {
    var body: some View {
        Canvas { ctx, size in
            let s = size.width / 40
            func P(_ x: Double, _ y: Double) -> CGPoint { CGPoint(x: x * s, y: y * s) }
            let navy = Color(white: 0.12)

            ctx.fill(Path(ellipseIn: CGRect(x: 0, y: 0, width: 40 * s, height: 40 * s)),
                     with: .color(Color(white: 0.95)))

            var hair = Path()
            hair.move(to: P(8, 17))
            hair.addCurve(to: P(20, 6), control1: P(8, 10), control2: P(13.5, 6))
            hair.addCurve(to: P(32, 17), control1: P(26.5, 6), control2: P(32, 10))
            hair.addLine(to: P(32, 20))
            hair.addLine(to: P(8, 20))
            hair.closeSubpath()
            ctx.fill(hair, with: .color(navy))

            ctx.fill(Path(ellipseIn: CGRect(x: 8.5 * s, y: 12 * s, width: 23 * s, height: 22 * s)), with: .color(.white))
            ctx.fill(Path(roundedRect: CGRect(x: 8.5 * s, y: 20.5 * s, width: 23 * s, height: 6.5 * s), cornerRadius: 3 * s),
                     with: .color(Color(white: 0.34)))
            for cx in [14.5, 25.5] {
                ctx.fill(Path(ellipseIn: CGRect(x: (cx - 2.5) * s, y: 21.2 * s, width: 5 * s, height: 5 * s)), with: .color(.white))
                ctx.fill(Path(ellipseIn: CGRect(x: (cx - 1.1) * s, y: 22.6 * s, width: 2.2 * s, height: 2.2 * s)), with: .color(navy))
            }
            var smile = Path()
            smile.move(to: P(16.5, 30))
            smile.addQuadCurve(to: P(23.5, 30), control: P(20, 33.2))
            ctx.stroke(smile, with: .color(navy), style: StrokeStyle(lineWidth: 1.2 * s, lineCap: .round))
        }
        .aspectRatio(1, contentMode: .fit)
    }
}

// MARK: - Carte d'action

struct SKActionCard: View {
    @ObservedObject var m: SKCardModel
    let onButton: () -> Void
    private let shape = RoundedRectangle(cornerRadius: 28, style: .continuous)

    private var tint: Color {
        switch m.phase {
        case .done: return SK.green.opacity(0.05)
        case .failed: return SK.red.opacity(0.06)
        default: return Color.clear
        }
    }

    var body: some View {
        if let plan = m.plan {
            VStack(alignment: .leading, spacing: 14) {
                header(plan)
                SKPreviewView(m: m, plan: plan)
                if let e = m.error {
                    Text(e).font(.inter(15, .medium)).foregroundStyle(SK.red)
                        .transition(.opacity)
                }
                if !m.folded {
                    steps(plan).transition(.opacity.combined(with: .move(edge: .top)))
                }
                if let label = m.buttonLabel {
                    Button(action: onButton) {
                        Text(label)
                            .font(.inter(17, .semibold))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 15)
                    }
                    .buttonStyle(.plain)
                    .skGlass(Capsule(), tint: SK.ink, interactive: true)
                    .transition(.scale(scale: 0.9).combined(with: .opacity))
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(shape.fill(Color.white.opacity(0.82)))
            .background(shape.fill(tint))
            .skGlass(shape)
            .overlay(SKBorder(phase: m.phase))
            .overlay(SKShine(on: m.phase == .done))
            .overlay(alignment: .topTrailing) {
                if m.burstID > 0 { SKBurst().id(m.burstID).offset(x: -29, y: 30) }
            }
            .modifier(SKShake(amount: m.shake))
            .scaleEffect(m.shown ? 1 : 0.93)
            .opacity(m.shown ? 1 : 0)
            .blur(radius: m.shown ? 0 : 6)
            .offset(y: m.shown ? 0 : 20)
        }
    }

    private func header(_ plan: SKPlan) -> some View {
        HStack(spacing: 12) {
            SKBobbingMascot(active: m.phase == .working)
                .frame(width: 38, height: 38)
            SKShimmerTitle(text: m.phase == .done ? plan.done : plan.title, active: m.phase == .working)
            Spacer(minLength: 8)
            SKStatusIcon(phase: m.phase)
        }
    }

    private func steps(_ plan: SKPlan) -> some View {
        VStack(alignment: .leading, spacing: 11) {
            ForEach(Array(plan.steps.enumerated()), id: \.offset) { i, text in
                HStack(spacing: 12) {
                    SKStepDot(state: stepState(i))
                    Text(text)
                        .font(.inter(16, .medium))
                        .foregroundStyle(stepState(i) == .current ? SK.ink : Color(white: stepState(i) == .done ? 0.62 : 0.72))
                }
            }
        }
        .padding(.leading, 2)
    }

    private func stepState(_ i: Int) -> SKStepDot.Kind {
        if m.phase == .failed && m.step == i { return .bad }
        if m.step > i { return .done }
        if m.step == i && m.phase == .working { return .current }
        return .pending
    }
}

struct SKBobbingMascot: View {
    let active: Bool

    var body: some View {
        if active {
            TimelineView(.animation) { tl in
                let t = tl.date.timeIntervalSinceReferenceDate * 3.6
                SKMascot().offset(y: -3 * sin(t)).rotationEffect(.degrees(-5 * sin(t)))
            }
        } else {
            SKMascot()
        }
    }
}

struct SKShimmerTitle: View {
    let text: String
    let active: Bool

    private var label: some View {
        Text(text).font(.inter(18, .semibold)).lineLimit(2).fixedSize(horizontal: false, vertical: true)
    }

    var body: some View {
        if active {
            TimelineView(.animation) { tl in
                let p = CGFloat((tl.date.timeIntervalSinceReferenceDate * 0.6).truncatingRemainder(dividingBy: 1))
                label.foregroundStyle(
                    LinearGradient(colors: [SK.purple, SK.lilac, SK.purple],
                                   startPoint: UnitPoint(x: p * 2 - 1, y: 0.5),
                                   endPoint: UnitPoint(x: p * 2, y: 0.5))
                )
            }
        } else {
            label.foregroundStyle(SK.ink)
        }
    }
}

struct SKStatusIcon: View {
    let phase: SKCardModel.Phase

    var body: some View {
        ZStack {
            switch phase {
            case .waiting, .working: SKSpinner(size: 26)
            case .done: SKBadge(color: SK.green, ok: true)
            case .failed: SKBadge(color: SK.red, ok: false)
            }
        }
        .frame(width: 30, height: 30)
    }
}

struct SKSpinner: View {
    let size: CGFloat

    var body: some View {
        TimelineView(.animation) { tl in
            let a = (tl.date.timeIntervalSinceReferenceDate * 1.25).truncatingRemainder(dividingBy: 1) * 360
            ZStack {
                Circle().stroke(SK.purple.opacity(0.16), lineWidth: size * 0.1)
                Circle().trim(from: 0, to: 0.28)
                    .stroke(SK.purple, style: StrokeStyle(lineWidth: size * 0.1, lineCap: .round))
                    .rotationEffect(.degrees(a))
            }
            .frame(width: size, height: size)
        }
        .transition(.scale.combined(with: .opacity))
    }
}

struct SKMark: Shape {
    let ok: Bool

    func path(in r: CGRect) -> Path {
        var p = Path()
        if ok {
            p.move(to: CGPoint(x: r.width * 0.12, y: r.height * 0.52))
            p.addLine(to: CGPoint(x: r.width * 0.40, y: r.height * 0.80))
            p.addLine(to: CGPoint(x: r.width * 0.88, y: r.height * 0.22))
        } else {
            p.move(to: CGPoint(x: r.width * 0.15, y: r.height * 0.15))
            p.addLine(to: CGPoint(x: r.width * 0.85, y: r.height * 0.85))
            p.move(to: CGPoint(x: r.width * 0.85, y: r.height * 0.15))
            p.addLine(to: CGPoint(x: r.width * 0.15, y: r.height * 0.85))
        }
        return p
    }
}

struct SKBadge: View {
    let color: Color
    let ok: Bool
    @State private var draw: CGFloat = 0

    var body: some View {
        ZStack {
            Circle().fill(color)
            SKMark(ok: ok)
                .trim(from: 0, to: draw)
                .stroke(Color.white, style: StrokeStyle(lineWidth: 2.6, lineCap: .round, lineJoin: .round))
                .padding(8)
        }
        .frame(width: 28, height: 28)
        .transition(.scale(scale: 0.3).combined(with: .opacity))
        .onAppear { withAnimation(.easeOut(duration: 0.4).delay(0.1)) { draw = 1 } }
    }
}

struct SKStepDot: View {
    enum Kind { case pending, current, done, bad }
    let state: Kind

    var body: some View {
        ZStack {
            switch state {
            case .pending:
                Circle().stroke(Color(white: 0, opacity: 0.14), lineWidth: 1.6)
            case .current:
                SKSpinner(size: 22)
            case .done:
                Circle().fill(SK.green.opacity(0.16))
                SKMark(ok: true).stroke(SK.green, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round)).padding(6)
            case .bad:
                Circle().fill(SK.red.opacity(0.16))
                SKMark(ok: false).stroke(SK.red, style: StrokeStyle(lineWidth: 2, lineCap: .round)).padding(7)
            }
        }
        .frame(width: 24, height: 24)
        .animation(.spring(response: 0.4, dampingFraction: 0.7), value: state)
    }
}

// MARK: - Effets de carte

struct SKBorder: View {
    let phase: SKCardModel.Phase
    private let shape = RoundedRectangle(cornerRadius: 28, style: .continuous)

    var body: some View {
        switch phase {
        case .waiting, .working:
            TimelineView(.animation) { tl in
                let a = (tl.date.timeIntervalSinceReferenceDate * 0.5).truncatingRemainder(dividingBy: 1) * 360
                shape.strokeBorder(
                    AngularGradient(colors: [SK.purple, SK.lilac, SK.sky, SK.pink, SK.purple],
                                    center: .center, angle: .degrees(a)),
                    lineWidth: 2
                )
            }
        case .done:
            shape.strokeBorder(LinearGradient(colors: [SK.green.opacity(0.9), SK.green.opacity(0.6)],
                                              startPoint: .topLeading, endPoint: .bottomTrailing), lineWidth: 2)
        case .failed:
            shape.strokeBorder(SK.red.opacity(0.85), lineWidth: 2)
        }
    }
}

struct SKShine: View {
    let on: Bool
    @State private var x: CGFloat = -1.3

    var body: some View {
        GeometryReader { g in
            LinearGradient(colors: [Color.clear, Color.white.opacity(0.7), Color.clear],
                           startPoint: .leading, endPoint: .trailing)
                .frame(width: g.size.width * 0.55)
                .offset(x: x * g.size.width)
        }
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .allowsHitTesting(false)
        .onChange(of: on) { v in
            if v { withAnimation(.easeInOut(duration: 0.95).delay(0.1)) { x = 1.3 } }
        }
    }
}

struct SKBurst: View {
    @State private var go = false
    private let parts: [(dx: Double, dy: Double, rot: Double, color: Color)] = (0..<18).map { i in
        let a = Double(i) / 18 * 2 * Double.pi + Double.random(in: 0...0.4)
        let d = Double.random(in: 40...90)
        return (cos(a) * d, sin(a) * d, Double.random(in: 0...360), SK.confetti[i % SK.confetti.count])
    }

    var body: some View {
        ZStack {
            ForEach(0..<parts.count, id: \.self) { i in
                RoundedRectangle(cornerRadius: 2)
                    .fill(parts[i].color)
                    .frame(width: 7, height: 10)
                    .rotationEffect(.degrees(go ? parts[i].rot : 0))
                    .offset(x: go ? parts[i].dx : 0, y: go ? parts[i].dy : 0)
                    .scaleEffect(go ? 0.6 : 1)
                    .opacity(go ? 0 : 1)
            }
        }
        .allowsHitTesting(false)
        .onAppear { withAnimation(.easeOut(duration: 0.95)) { go = true } }
    }
}

struct SKShake: GeometryEffect {
    var amount: CGFloat
    var animatableData: CGFloat {
        get { amount }
        set { amount = newValue }
    }

    func effectValue(size: CGSize) -> ProjectionTransform {
        ProjectionTransform(CGAffineTransform(translationX: 6 * sin(amount * .pi * 4), y: 0))
    }
}

// MARK: - Aperçus

struct SKTruck: Shape {
    func path(in r: CGRect) -> Path {
        let s = min(r.width / 24, r.height / 16)
        func P(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: r.minX + x * s, y: r.minY + y * s) }
        var p = Path()
        p.addRect(CGRect(x: r.minX + 1 * s, y: r.minY + 2 * s, width: 14 * s, height: 10 * s))
        p.move(to: P(15, 5))
        p.addLine(to: P(20, 5))
        p.addLine(to: P(23, 8))
        p.addLine(to: P(23, 12))
        p.addLine(to: P(15, 12))
        p.closeSubpath()
        p.addEllipse(in: CGRect(x: r.minX + 4 * s, y: r.minY + 11 * s, width: 4 * s, height: 4 * s))
        p.addEllipse(in: CGRect(x: r.minX + 17 * s, y: r.minY + 11 * s, width: 4 * s, height: 4 * s))
        return p
    }
}

struct SKBone: View {
    var width: CGFloat = 120

    var body: some View {
        TimelineView(.animation) { tl in
            let k = (sin(tl.date.timeIntervalSinceReferenceDate * 4) + 1) / 2
            Capsule().fill(Color.black.opacity(0.05 + 0.05 * k)).frame(width: width, height: 12)
        }
    }
}

struct SKTile<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(Color.white.opacity(0.66))
                    .shadow(color: SK.purple.opacity(0.10), radius: 10, y: 4)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .strokeBorder(Color.black.opacity(0.06), lineWidth: 0.8)
            )
    }
}

struct SKPreviewView: View {
    @ObservedObject var m: SKCardModel
    let plan: SKPlan

    var body: some View {
        switch plan.preview {
        case .none:
            EmptyView()
        case .fulfill(let number, let customer, let total):
            SKTile {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        Text("#\(number)").font(.inter(23, .bold)).foregroundStyle(SK.ink)
                        Text(customer).font(.inter(20, .medium)).foregroundStyle(SK.sub).lineLimit(1)
                        Spacer(minLength: 6)
                        Text(total).font(.inter(23, .bold)).foregroundStyle(SK.ink).lineLimit(1)
                    }
                    GeometryReader { g in
                        let w = g.size.width
                        VStack(alignment: .leading, spacing: 5) {
                            SKTruck()
                                .stroke(SK.purple, style: StrokeStyle(lineWidth: 1.8, lineCap: .round, lineJoin: .round))
                                .frame(width: 30, height: 20)
                                .offset(x: (w - 30) * m.progress)
                            ZStack(alignment: .leading) {
                                Capsule().fill(SK.purple.opacity(0.10))
                                Capsule()
                                    .fill(LinearGradient(colors: [SK.purple, SK.sky], startPoint: .leading, endPoint: .trailing))
                                    .frame(width: max(14, w * m.progress))
                            }
                            .frame(height: 14)
                        }
                    }
                    .frame(height: 42)
                }
            }
        case .create(let title, let price, let stock, let status, let statusKey, let hue):
            SKTile {
                HStack(spacing: 14) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(m.step >= 1
                                  ? AnyShapeStyle(LinearGradient(colors: [Color(white: 0.42), Color(white: 0.22)],
                                                                 startPoint: .topLeading, endPoint: .bottomTrailing))
                                  : AnyShapeStyle(Color.black.opacity(0.07)))
                        Text(String(title.prefix(1)).uppercased())
                            .font(.inter(22, .bold)).foregroundStyle(.white)
                            .opacity(m.step >= 1 ? 1 : 0)
                    }
                    .frame(width: 54, height: 54)
                    VStack(alignment: .leading, spacing: 8) {
                        if m.step >= 1 {
                            Text(title).font(.inter(18, .bold)).foregroundStyle(SK.ink).lineLimit(2)
                                .transition(.opacity.combined(with: .move(edge: .leading)))
                        } else {
                            SKBone(width: 150)
                        }
                        if m.step >= 2 {
                            HStack(spacing: 8) {
                                chip(price, SK.purple)
                                chip(stock, SK.sub)
                            }
                            .transition(.scale(scale: 0.85, anchor: .leading).combined(with: .opacity))
                        } else {
                            SKBone(width: 90)
                        }
                    }
                    Spacer(minLength: 4)
                    VStack(spacing: 4) {
                        Circle().fill(m.step >= 3 ? SK.statusColor(statusKey) : Color.black.opacity(0.10)).frame(width: 12, height: 12)
                        if m.step >= 3 { Text(status).font(.inter(11, .semibold)).foregroundStyle(SK.sub) }
                    }
                }
                .animation(.spring(response: 0.5, dampingFraction: 0.78), value: m.step)
            }
        case .update(let title, let changes):
            SKTile {
                VStack(alignment: .leading, spacing: 10) {
                    Text(title).font(.inter(18, .bold)).foregroundStyle(SK.ink).lineLimit(1)
                    ForEach(Array(changes.enumerated()), id: \.offset) { k, c in
                        HStack(spacing: 8) {
                            Text(c.label).font(.inter(14, .medium)).foregroundStyle(SK.sub)
                            Spacer(minLength: 4)
                            Text(c.from).font(.inter(14, .medium)).foregroundStyle(SK.sub).strikethrough().lineLimit(1)
                            Image(systemName: "arrow.right").font(.system(size: 11, weight: .bold)).foregroundStyle(SK.sub)
                            Text(c.to).font(.inter(15, .bold)).foregroundStyle(SK.purple).lineLimit(1)
                        }
                        .opacity(m.step >= 1 ? 1 : 0)
                        .offset(x: m.step >= 1 ? 0 : 14)
                        .animation(.spring(response: 0.5, dampingFraction: 0.78).delay(Double(min(k, 5)) * 0.18), value: m.step)
                    }
                }
            }
        case .remove(let title):
            SKTile {
                HStack(spacing: 12) {
                    Image(systemName: "trash").font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(m.step >= 1 ? SK.red : SK.sub)
                    Text(title).font(.inter(18, .bold)).foregroundStyle(SK.ink).lineLimit(1)
                        .strikethrough(m.step >= 1, color: SK.red)
                }
                .opacity(m.step >= 1 ? 0.5 : 1)
                .scaleEffect(m.step >= 1 ? 0.97 : 1, anchor: .leading)
                .animation(.spring(response: 0.5, dampingFraction: 0.8), value: m.step)
            }
        case .status(let items, let more, let toLabel, let toKey):
            SKTile {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(Array(items.enumerated()), id: \.offset) { k, it in
                        let changed = m.step >= 1
                        HStack(spacing: 10) {
                            Circle().fill(SK.statusColor(changed ? toKey : it.fromKey)).frame(width: 11, height: 11)
                            Text(it.title).font(.inter(17, .semibold)).foregroundStyle(SK.ink).lineLimit(1)
                            Spacer(minLength: 4)
                            Text(changed ? toLabel : it.fromLabel)
                                .font(.inter(13, .semibold))
                                .foregroundStyle(changed ? SK.statusColor(toKey) : SK.sub)
                                .padding(.horizontal, 10).padding(.vertical, 5)
                                .background(Capsule().fill((changed ? SK.statusColor(toKey) : Color.black).opacity(0.10)))
                                .scaleEffect(changed ? 1 : 0.96)
                        }
                        .animation(.spring(response: 0.45, dampingFraction: 0.7).delay(Double(k) * 0.17), value: changed)
                    }
                    if more > 0 { Text("+\(more)").font(.inter(14, .semibold)).foregroundStyle(SK.sub) }
                }
            }
        case .nav(let label):
            SKTile {
                HStack {
                    Text(label).font(.inter(18, .bold)).foregroundStyle(SK.ink).lineLimit(1)
                    Spacer()
                    Image(systemName: "arrow.right").font(.system(size: 15, weight: .bold)).foregroundStyle(SK.purple)
                        .offset(x: m.step >= 1 ? 4 : 0)
                        .animation(.easeInOut(duration: 0.6).repeatForever(autoreverses: true), value: m.step)
                }
            }
        }
    }

    private func chip(_ text: String, _ color: Color) -> some View {
        Text(text).font(.inter(13, .semibold)).foregroundStyle(color)
            .padding(.horizontal, 10).padding(.vertical, 5)
            .background(Capsule().fill(color.opacity(0.12)))
    }
}

// MARK: - Contrôleur

final class SidekickViewController: UIHostingController<SKRootView> {
    var onClosed: (() -> Void)?
    private let model: SKChatModel

    init(info: [String: Any], bridge: SKBridge) {
        let m = SKChatModel(info: SKInfo(info), bridge: bridge)
        model = m
        super.init(rootView: SKRootView(model: m))
        modalPresentationStyle = .pageSheet
        if let sheet = sheetPresentationController {
            sheet.detents = [.large()]
            sheet.prefersGrabberVisible = true
            sheet.prefersScrollingExpandsWhenScrolledToEdge = false
        }
        view.backgroundColor = .white
        m.dismiss = { [weak self] in self?.dismiss(animated: true) }
    }

    @available(*, unavailable)
    @MainActor required dynamic init?(coder aDecoder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override var preferredStatusBarStyle: UIStatusBarStyle { .darkContent }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        if isBeingDismissed || presentingViewController == nil { onClosed?() }
    }
}
