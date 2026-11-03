import UIKit

/// Menu « Plage de dates » de l'accueil, en feuille native Liquid Glass (iOS 26).
///
/// • Au tap sur la pastille de période, une petite feuille monte du bas et laisse voir les périodes jusqu'à « 365 derniers jours ».
/// • En l'agrandissant (poignée ou défilement), la même liste continue : semaine / mois / trimestre / année passés, puis « à ce jour ».
/// • Deux boutons en verre en haut à droite : « Dates fixes » (calendrier début → fin) et « Période glissante » (N jours / semaines / mois / années).
///
/// La page web envoie la description (app.js : nativeRangeInfo) ; le choix revient via `onAct`
/// ({ act: "set", key }) puis window.__larpNativeRangeAct. Tout le texte arrive déjà traduit.
#if compiler(>=6.2)

// MARK: - Données envoyées par la page

@available(iOS 26.0, *)
struct RangeInfo {
    struct Item {
        let key: String
        let label: String
    }

    struct Unit {
        let code: String
        let label: String
    }

    let lang: String
    let title: String
    let current: String
    let groups: [[Item]]
    let day0: Double          // instant (ms) du minuit local du jour 0 de la boutique
    let offsetMs: Double      // décalage horaire de la boutique (ms)
    let today: Int            // indice du jour courant
    let fixedTitle: String
    let fixedSub: String
    let fixedDialog: String
    let fromLabel: String
    let toLabel: String
    let applyLabel: String
    let rollTitle: String
    let rollSub: String
    let includeLabel: String
    let units: [Unit]

    private static let dayMs: Double = 86_400_000

    init(info: [String: Any]) {
        func str(_ d: [String: Any], _ k: String) -> String { (d[k] as? String) ?? "" }
        func num(_ d: [String: Any], _ k: String) -> Double { (d[k] as? NSNumber)?.doubleValue ?? 0 }
        lang = str(info, "lang").isEmpty ? "en" : str(info, "lang")
        title = str(info, "title")
        current = str(info, "cur")
        groups = ((info["groups"] as? [[[String: Any]]]) ?? []).map { group in
            group.map { Item(key: str($0, "k"), label: str($0, "l")) }
        }
        day0 = num(info, "day0")
        offsetMs = num(info, "off")
        today = Int(num(info, "today"))
        let fixed = (info["fixed"] as? [String: Any]) ?? [:]
        fixedTitle = str(fixed, "title")
        fixedSub = str(fixed, "sub")
        fixedDialog = str(fixed, "dlg")
        fromLabel = str(fixed, "from")
        toLabel = str(fixed, "to")
        applyLabel = str(fixed, "apply")
        let roll = (info["roll"] as? [String: Any]) ?? [:]
        rollTitle = str(roll, "title")
        rollSub = str(roll, "sub")
        includeLabel = str(roll, "include")
        units = ((roll["units"] as? [[String: Any]]) ?? []).map { Unit(code: str($0, "u"), label: str($0, "l")) }
    }

    /// Calendrier grégorien réglé sur le fuseau de la boutique (les jours de la page sont ceux de la boutique).
    var calendar: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(secondsFromGMT: Int(offsetMs / 1000)) ?? .current
        c.locale = Locale(identifier: lang)
        return c
    }

    func date(forIndex i: Int) -> Date {
        Date(timeIntervalSince1970: (day0 + Double(i) * RangeInfo.dayMs) / 1000)
    }

    func index(for comps: DateComponents) -> Int? {
        guard let d = calendar.date(from: comps) else { return nil }
        return Int(((d.timeIntervalSince1970 * 1000 - day0) / RangeInfo.dayMs).rounded())
    }

    func components(forIndex i: Int) -> DateComponents {
        let cal = calendar
        var c = cal.dateComponents([.era, .year, .month, .day], from: date(forIndex: i))
        c.calendar = cal
        return c
    }

    func format(index i: Int) -> String {
        let f = DateFormatter()
        f.calendar = calendar
        f.timeZone = calendar.timeZone
        f.locale = calendar.locale
        f.dateStyle = .medium
        f.timeStyle = .none
        return f.string(from: date(forIndex: i))
    }
}

// MARK: - Lignes de la liste

@available(iOS 26.0, *)
final class RangeCell: UITableViewCell {
    private let label = UILabel()
    private let check = UIImageView(image: PCTheme.symbol("checkmark", 16, .bold))

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        selectionStyle = .none
        backgroundColor = .clear
        label.font = .inter(17, .medium)
        label.textColor = PCTheme.ink
        label.translatesAutoresizingMaskIntoConstraints = false
        check.tintColor = PCTheme.ink
        check.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(label)
        contentView.addSubview(check)
        NSLayoutConstraint.activate([
            label.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 28),
            label.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            label.trailingAnchor.constraint(lessThanOrEqualTo: check.leadingAnchor, constant: -8),
            check.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -28),
            check.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func configure(text: String, selected: Bool) {
        label.text = text
        check.isHidden = !selected
        var bg = UIBackgroundConfiguration.clear()
        if selected {
            bg.backgroundColor = UIColor(white: 0, alpha: 0.06)
            bg.cornerRadius = 22
            bg.backgroundInsets = NSDirectionalEdgeInsets(top: 2, leading: 12, bottom: 2, trailing: 12)
        }
        backgroundConfiguration = bg
    }

    override func setHighlighted(_ highlighted: Bool, animated: Bool) {
        super.setHighlighted(highlighted, animated: animated)
        UIView.animate(withDuration: 0.12) { self.contentView.alpha = highlighted ? 0.45 : 1 }
    }
}

/// « Dates fixes » / « Période glissante » : icône · titre · sous-titre · chevron, comme dans l'app Shopify.
@available(iOS 26.0, *)
final class RangeLinkCell: UITableViewCell {
    private let icon = UIImageView()
    private let titleLabel = UILabel()
    private let subLabel = UILabel()
    private let chevron = UIImageView(image: PCTheme.symbol("chevron.right", 15, .semibold))

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        selectionStyle = .none
        backgroundColor = .clear
        icon.tintColor = PCTheme.ink
        icon.contentMode = .scaleAspectFit
        icon.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.font = .inter(17, .medium)
        titleLabel.textColor = PCTheme.ink
        subLabel.font = .inter(16)
        subLabel.textColor = PCTheme.sub
        subLabel.numberOfLines = 2
        chevron.tintColor = PCTheme.sub
        chevron.contentMode = .scaleAspectFit
        chevron.setContentHuggingPriority(.required, for: .horizontal)
        chevron.setContentCompressionResistancePriority(.required, for: .horizontal)
        chevron.translatesAutoresizingMaskIntoConstraints = false
        let texts = UIStackView(arrangedSubviews: [titleLabel, subLabel])
        texts.axis = .vertical
        texts.spacing = 2
        texts.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(icon)
        contentView.addSubview(texts)
        contentView.addSubview(chevron)
        NSLayoutConstraint.activate([
            icon.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 22),
            icon.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            icon.widthAnchor.constraint(equalToConstant: 24),
            icon.heightAnchor.constraint(equalToConstant: 24),
            texts.leadingAnchor.constraint(equalTo: icon.trailingAnchor, constant: 12),
            texts.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            texts.trailingAnchor.constraint(equalTo: chevron.leadingAnchor, constant: -12),
            chevron.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -24),
            chevron.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            chevron.widthAnchor.constraint(equalToConstant: 10),
            chevron.heightAnchor.constraint(equalToConstant: 16),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func configure(symbol: String, title: String, sub: String) {
        icon.image = PCTheme.symbol(symbol, 19, .regular)
        titleLabel.text = title
        subLabel.text = sub
    }

    override func setHighlighted(_ highlighted: Bool, animated: Bool) {
        super.setHighlighted(highlighted, animated: animated)
        UIView.animate(withDuration: 0.12) { self.contentView.alpha = highlighted ? 0.45 : 1 }
    }
}

// MARK: - Feuille principale : deux hauteurs (jusqu'à 365 jours, puis tout)

@available(iOS 26.0, *)
final class RangePickerViewController: UIViewController, UITableViewDataSource, UITableViewDelegate {
    var onAct: (([String: Any]) -> Void)?

    private enum Section { case links, items(Int) }

    private let info: RangeInfo
    private let sections: [Section]
    private let table = UITableView(frame: .zero, style: .plain)
    private let titleLabel = UILabel()

    private static let headH: CGFloat = 64
    private static let rowH: CGFloat = 48
    private static let fixedH: CGFloat = 64
    private static let rollH: CGFloat = 88
    private static let gap: CGFloat = 12

    private var bottomInset: CGFloat { max(34, view.window?.safeAreaInsets.bottom ?? 34) }

    init(info: [String: Any]) {
        let parsed = RangeInfo(info: info)
        self.info = parsed
        sections = [.links] + parsed.groups.indices.map { Section.items($0) }
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .pageSheet
        if let sheet = sheetPresentationController {
            // Hauteur « compacte » : en-tête + les deux lignes (dates fixes / glissante) + Aujourd'hui … 365 derniers jours, rien de plus.
            let rows = CGFloat(self.info.groups.first?.count ?? 6)
            let compact = UISheetPresentationController.Detent.custom(identifier: .init("compact")) { [weak self] ctx in
                // iOS ajoute lui-même la zone de l'indicateur d'accueil à cette valeur : on ne la compte pas ici.
                let h = RangePickerViewController.headH + RangePickerViewController.fixedH + RangePickerViewController.rollH
                    + RangePickerViewController.gap + rows * RangePickerViewController.rowH
                return min(ctx.maximumDetentValue, h)
            }
            sheet.detents = [compact, .large()]
            sheet.selectedDetentIdentifier = compact.identifier
            sheet.prefersGrabberVisible = true
            sheet.prefersScrollingExpandsWhenScrolledToEdge = true
        }
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        overrideUserInterfaceStyle = .light
        view.backgroundColor = .white

        titleLabel.text = info.title
        titleLabel.font = .inter(20, .bold)
        titleLabel.textColor = PCTheme.ink
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        table.dataSource = self
        table.delegate = self
        table.register(RangeCell.self, forCellReuseIdentifier: "RangeCell")
        table.register(RangeLinkCell.self, forCellReuseIdentifier: "RangeLinkCell")
        table.backgroundColor = .clear
        table.separatorStyle = .none
        table.sectionHeaderTopPadding = 0
        table.showsVerticalScrollIndicator = false
        table.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(table)
        view.addSubview(titleLabel)
        NSLayoutConstraint.activate([
            titleLabel.topAnchor.constraint(equalTo: view.topAnchor, constant: 30),
            titleLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            titleLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            table.topAnchor.constraint(equalTo: view.topAnchor, constant: RangePickerViewController.headH),
            table.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            table.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            table.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        table.reloadData()   // la hauteur de l'espace sous « 365 jours » dépend de la zone de l'indicateur d'accueil
    }

    // MARK: Liste

    func numberOfSections(in tableView: UITableView) -> Int { sections.count }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        switch sections[section] {
        case .links: return 2
        case .items(let g): return info.groups[g].count
        }
    }

    func tableView(_ tableView: UITableView, heightForRowAt indexPath: IndexPath) -> CGFloat {
        switch sections[indexPath.section] {
        case .links: return indexPath.row == 0 ? RangePickerViewController.fixedH : RangePickerViewController.rollH
        case .items: return RangePickerViewController.rowH
        }
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        switch sections[indexPath.section] {
        case .links:
            let cell = tableView.dequeueReusableCell(withIdentifier: "RangeLinkCell", for: indexPath) as! RangeLinkCell
            if indexPath.row == 0 {
                cell.configure(symbol: "calendar", title: info.fixedTitle, sub: info.fixedSub)
            } else {
                cell.configure(symbol: "calendar.badge.clock", title: info.rollTitle, sub: info.rollSub)
            }
            return cell
        case .items(let g):
            let cell = tableView.dequeueReusableCell(withIdentifier: "RangeCell", for: indexPath) as! RangeCell
            let item = info.groups[g][indexPath.row]
            cell.configure(text: item.label, selected: item.key == info.current)
            return cell
        }
    }

    func tableView(_ tableView: UITableView, heightForHeaderInSection section: Int) -> CGFloat { .leastNormalMagnitude }

    func tableView(_ tableView: UITableView, viewForHeaderInSection section: Int) -> UIView? { nil }

    /// Sous « 365 derniers jours » on laisse du blanc (hauteur compacte) : la suite n'apparaît qu'en agrandissant la feuille.
    func tableView(_ tableView: UITableView, heightForFooterInSection section: Int) -> CGFloat {
        if case .items(0) = sections[section] { return bottomInset + RangePickerViewController.gap + 16 }
        return RangePickerViewController.gap
    }

    func tableView(_ tableView: UITableView, viewForFooterInSection section: Int) -> UIView? { nil }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: false)
        UISelectionFeedbackGenerator().selectionChanged()
        switch sections[indexPath.section] {
        case .links:
            if indexPath.row == 0 { openFixed() } else { openRolling() }
        case .items(let g):
            finish(key: info.groups[g][indexPath.row].key)
        }
    }

    // MARK: Actions

    /// Ferme toute la pile de feuilles puis prévient la page (après l'animation, pour ne pas saccader le graphique).
    func finish(key: String) {
        let act = onAct
        dismiss(animated: true) { act?(["act": "set", "key": key]) }
    }

    private func openFixed() {
        let vc = RangeFixedSheet(info: info)
        vc.onApply = { [weak self] key in self?.finish(key: key) }
        present(vc, animated: true)
    }

    private func openRolling() {
        let vc = RangeRollingSheet(info: info)
        vc.onApply = { [weak self] key in self?.finish(key: key) }
        present(vc, animated: true)
    }
}

// MARK: - Champ « Date de début / Date de fin »

@available(iOS 26.0, *)
final class RangeFieldButton: UIButton {
    override init(frame: CGRect) {
        super.init(frame: frame)
        layer.cornerRadius = 16
        layer.cornerCurve = .continuous
        layer.borderWidth = 1.5
        translatesAutoresizingMaskIntoConstraints = false
        heightAnchor.constraint(equalToConstant: 48).isActive = true
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func set(text: String, isPlaceholder: Bool, isActive: Bool) {
        var c = UIButton.Configuration.plain()
        c.image = PCTheme.symbol("calendar", 15, .regular)
        c.imagePadding = 8
        c.baseForegroundColor = isPlaceholder ? PCTheme.sub : PCTheme.ink
        c.contentInsets = NSDirectionalEdgeInsets(top: 0, leading: 8, bottom: 0, trailing: 8)
        var t = AttributedString(text)
        t.font = UIFont.inter(15, .medium)
        c.attributedTitle = t
        configuration = c
        layer.borderColor = (isActive ? PCTheme.blue : UIColor(white: 0, alpha: 0.16)).cgColor
    }
}

// MARK: - Dates fixes : début → fin sur un calendrier

@available(iOS 26.0, *)
final class RangeFixedSheet: PCSheetBase, UICalendarSelectionMultiDateDelegate, UICalendarViewDelegate {
    var onApply: ((String) -> Void)?

    private enum Field { case start, end }

    private let info: RangeInfo
    private var start: Int?
    private var end: Int?
    private var active: Field = .start
    private let startField = RangeFieldButton()
    private let endField = RangeFieldButton()
    private let calendarView = UICalendarView()
    private var selection: UICalendarSelectionMultiDate?
    private var startHour = 0     // 00:00
    private var endHour = 23      // 23:59
    private let startTime = UIButton(type: .system)
    private let endTime = UIButton(type: .system)
    private var applyButton: PCGlassButton!

    init(info: RangeInfo) {
        self.info = info
        super.init(title: info.fixedDialog, detents: [.large()])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()

        let arrow = UIImageView(image: PCTheme.symbol("arrow.right", 14, .semibold))
        arrow.tintColor = PCTheme.sub
        arrow.setContentHuggingPriority(.required, for: .horizontal)
        let row = UIStackView(arrangedSubviews: [startField, arrow, endField])
        row.axis = .horizontal
        row.alignment = .center
        row.spacing = 10
        row.translatesAutoresizingMaskIntoConstraints = false
        endField.widthAnchor.constraint(equalTo: startField.widthAnchor).isActive = true
        startField.addAction(UIAction { [weak self] _ in self?.activate(.start) }, for: .touchUpInside)
        endField.addAction(UIAction { [weak self] _ in self?.activate(.end) }, for: .touchUpInside)

        // Heures : « 00:00 ⌄ → 23:59 ⌄ »
        let arrow2 = UIImageView(image: PCTheme.symbol("arrow.right", 14, .semibold))
        arrow2.tintColor = PCTheme.sub
        arrow2.setContentHuggingPriority(.required, for: .horizontal)
        [startTime, endTime].forEach { b in
            b.showsMenuAsPrimaryAction = true
            b.layer.cornerRadius = 16
            b.layer.cornerCurve = .continuous
            b.layer.borderWidth = 1
            b.layer.borderColor = UIColor(white: 0, alpha: 0.16).cgColor
            b.translatesAutoresizingMaskIntoConstraints = false
            b.heightAnchor.constraint(equalToConstant: 48).isActive = true
        }
        let timeRow = UIStackView(arrangedSubviews: [startTime, arrow2, endTime])
        timeRow.axis = .horizontal
        timeRow.alignment = .center
        timeRow.spacing = 10
        timeRow.translatesAutoresizingMaskIntoConstraints = false
        endTime.widthAnchor.constraint(equalTo: startTime.widthAnchor).isActive = true

        let cal = info.calendar
        calendarView.calendar = cal
        calendarView.locale = cal.locale ?? .current
        calendarView.availableDateRange = DateInterval(
            start: info.date(forIndex: 0),
            end: info.date(forIndex: info.today).addingTimeInterval(86_399)
        )
        calendarView.tintColor = PCTheme.ink
        calendarView.delegate = self
        let sel = UICalendarSelectionMultiDate(delegate: self)
        calendarView.selectionBehavior = sel
        selection = sel
        calendarView.translatesAutoresizingMaskIntoConstraints = false

        applyButton = PCGlassButton(title: info.applyLabel, tint: PCTheme.ink, foreground: .white, height: 54)
        applyButton.onTap = { [weak self] in
            guard let self, let s = self.start, let e = self.end else { return }
            var key = "c:\(min(s, e)):\(max(s, e))"
            if self.startHour != 0 || self.endHour != 23 { key += ":\(self.startHour):\(self.endHour)" }
            self.onApply?(key)
        }

        view.addSubview(row)
        view.addSubview(timeRow)
        view.addSubview(calendarView)
        view.addSubview(applyButton)
        NSLayoutConstraint.activate([
            row.topAnchor.constraint(equalTo: header.bottomAnchor, constant: 12),
            row.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            row.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            timeRow.topAnchor.constraint(equalTo: row.bottomAnchor, constant: 10),
            timeRow.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            timeRow.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            calendarView.topAnchor.constraint(equalTo: timeRow.bottomAnchor, constant: 8),
            calendarView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 12),
            calendarView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -12),
            calendarView.bottomAnchor.constraint(lessThanOrEqualTo: applyButton.topAnchor, constant: -8),
            applyButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            applyButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            applyButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -12),
        ])
        refresh(oldMiddle: [])
    }

    private func hourText(_ h: Int, start: Bool) -> String { String(format: "%02d:%@", h, start ? "00" : "59") }

    private func refreshTimeButtons() {
        for (button, isStart) in [(startTime, true), (endTime, false)] {
            var c = UIButton.Configuration.plain()
            c.baseForegroundColor = PCTheme.ink
            c.image = PCTheme.symbol("clock", 15, .regular)
            c.imagePadding = 8
            c.contentInsets = NSDirectionalEdgeInsets(top: 0, leading: 10, bottom: 0, trailing: 10)
            var t = AttributedString(hourText(isStart ? startHour : endHour, start: isStart))
            t.font = UIFont.inter(15, .medium)
            c.attributedTitle = t
            button.configuration = c
            button.menu = UIMenu(children: (0..<24).map { h in
                UIAction(
                    title: hourText(h, start: isStart),
                    state: h == (isStart ? startHour : endHour) ? .on : .off
                ) { [weak self] _ in
                    guard let self else { return }
                    if isStart { self.startHour = h } else { self.endHour = h }
                    self.refresh(oldMiddle: self.middle())
                }
            })
        }
    }

    private func activate(_ f: Field) {
        active = f
        refresh(oldMiddle: middle())
    }

    /// Jours strictement entre le début et la fin (marqués d'un point sur le calendrier).
    private func middle() -> [Int] {
        guard let s = start, let e = end, e - s > 1, e - s < 4000 else { return [] }
        return Array((s + 1)..<e)
    }

    private func tapped(_ comps: DateComponents) {
        guard let i = info.index(for: comps) else { return }
        let before = middle()
        switch active {
        case .start:
            start = i
            if let e = end, e < i { end = nil }
            active = .end
        case .end:
            if let s = start {
                if i < s { start = i; end = nil } else { end = i }
            } else {
                end = i
                active = .start
            }
        }
        PCTheme.haptic()
        refresh(oldMiddle: before)
    }

    private func refresh(oldMiddle: [Int]) {
        startField.set(
            text: start.map { info.format(index: $0) } ?? info.fromLabel,
            isPlaceholder: start == nil, isActive: active == .start
        )
        endField.set(
            text: end.map { info.format(index: $0) } ?? info.toLabel,
            isPlaceholder: end == nil, isActive: active == .end
        )
        // Même jour : l'heure de fin ne peut pas précéder celle de début.
        let timeOK = !(start != nil && start == end && endHour < startHour)
        applyButton.isEnabled = start != nil && end != nil && timeOK
        refreshTimeButtons()
        let picked = [start, end].compactMap { $0 }.map { info.components(forIndex: $0) }
        selection?.setSelectedDates(picked, animated: true)
        let changed = Set(oldMiddle).union(middle()).map { info.components(forIndex: $0) }
        if !changed.isEmpty { calendarView.reloadDecorations(forDateComponents: changed, animated: false) }
    }

    // MARK: UICalendarSelectionMultiDateDelegate

    func multiDateSelection(_ selection: UICalendarSelectionMultiDate, didSelectDate dateComponents: DateComponents) {
        tapped(dateComponents)
    }

    func multiDateSelection(_ selection: UICalendarSelectionMultiDate, didDeselectDate dateComponents: DateComponents) {
        tapped(dateComponents)
    }

    // MARK: UICalendarViewDelegate

    func calendarView(_ calendarView: UICalendarView, decorationFor dateComponents: DateComponents) -> UICalendarView.Decoration? {
        guard let s = start, let e = end, let i = info.index(for: dateComponents), i > s, i < e else { return nil }
        return .default(color: PCTheme.blue, size: .small)
    }
}

// MARK: - Période glissante : N jours / semaines / mois / années

@available(iOS 26.0, *)
final class RangeRollingSheet: PCSheetBase, UITextFieldDelegate {
    var onApply: ((String) -> Void)?

    private let info: RangeInfo
    private let field = UITextField()
    private let unitButton = UIButton(type: .system)
    private let includeSwitch = UISwitch()
    private var unit: String
    private var applyButton: PCGlassButton!

    init(info: RangeInfo) {
        self.info = info
        self.unit = info.units.first?.code ?? "d"
        super.init(title: info.rollTitle, detents: [.medium(), .large()])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()

        let sub = UILabel()
        sub.text = info.rollSub
        sub.font = .inter(15)
        sub.textColor = PCTheme.sub
        sub.numberOfLines = 0

        // Champ « 30 | Jours ⌃⌄ »
        field.text = "30"
        field.font = .inter(17, .medium)
        field.textColor = PCTheme.ink
        field.keyboardType = .numberPad
        field.delegate = self
        field.addTarget(self, action: #selector(valueChanged), for: .editingChanged)
        field.translatesAutoresizingMaskIntoConstraints = false
        unitButton.showsMenuAsPrimaryAction = true
        unitButton.translatesAutoresizingMaskIntoConstraints = false
        unitButton.setContentHuggingPriority(.required, for: .horizontal)
        let box = UIView()
        box.layer.cornerRadius = 16
        box.layer.cornerCurve = .continuous
        box.layer.borderWidth = 1
        box.layer.borderColor = UIColor(white: 0, alpha: 0.16).cgColor
        box.translatesAutoresizingMaskIntoConstraints = false
        box.addSubview(field)
        box.addSubview(unitButton)
        NSLayoutConstraint.activate([
            box.heightAnchor.constraint(equalToConstant: 52),
            field.leadingAnchor.constraint(equalTo: box.leadingAnchor, constant: 16),
            field.centerYAnchor.constraint(equalTo: box.centerYAnchor),
            field.trailingAnchor.constraint(equalTo: unitButton.leadingAnchor, constant: -8),
            unitButton.trailingAnchor.constraint(equalTo: box.trailingAnchor, constant: -10),
            unitButton.centerYAnchor.constraint(equalTo: box.centerYAnchor),
        ])
        rebuildUnitMenu()

        // « Inclure la période actuelle » + interrupteur
        let includeLabel = UILabel()
        includeLabel.text = info.includeLabel
        includeLabel.font = .inter(16, .medium)
        includeLabel.textColor = PCTheme.ink
        includeLabel.numberOfLines = 0
        includeSwitch.onTintColor = PCTheme.ink
        let includeRow = UIStackView(arrangedSubviews: [includeLabel, includeSwitch])
        includeRow.axis = .horizontal
        includeRow.alignment = .center
        includeRow.spacing = 12

        applyButton = PCGlassButton(title: info.applyLabel, tint: PCTheme.ink, foreground: .white, height: 54)
        applyButton.onTap = { [weak self] in self?.apply() }

        let stack = UIStackView(arrangedSubviews: [sub, box, includeRow, applyButton])
        stack.axis = .vertical
        stack.spacing = 16
        stack.setCustomSpacing(22, after: includeRow)
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: header.bottomAnchor, constant: 12),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
        ])

        let tap = UITapGestureRecognizer(target: view, action: #selector(UIView.endEditing(_:)))
        tap.cancelsTouchesInView = false
        view.addGestureRecognizer(tap)
        valueChanged()
    }

    private func rebuildUnitMenu() {
        let current = info.units.first(where: { $0.code == unit })
        var c = UIButton.Configuration.plain()
        c.baseForegroundColor = PCTheme.ink
        c.image = PCTheme.symbol("chevron.up.chevron.down", 13, .semibold)
        c.imagePlacement = .trailing
        c.imagePadding = 6
        var t = AttributedString(current?.label ?? "")
        t.font = UIFont.inter(17, .medium)
        c.attributedTitle = t
        unitButton.configuration = c
        unitButton.menu = UIMenu(children: info.units.map { u in
            UIAction(title: u.label, state: u.code == unit ? .on : .off) { [weak self] _ in
                self?.unit = u.code
                self?.rebuildUnitMenu()
                self?.valueChanged()
            }
        })
    }

    /// Entier de 1 à 999 (50 max pour les années), ou nil si le champ est vide / nul.
    private var value: Int? {
        guard let n = Int(field.text ?? ""), n > 0 else { return nil }
        return min(n, unit == "y" ? 50 : 999)
    }

    @objc private func valueChanged() {
        applyButton.isEnabled = value != nil
    }

    private func apply() {
        guard let n = value else { return }
        view.endEditing(true)
        onApply?("r:\(n):\(unit):\(includeSwitch.isOn ? 1 : 0)")
    }

    // MARK: UITextFieldDelegate

    func textField(_ textField: UITextField, shouldChangeCharactersIn range: NSRange, replacementString string: String) -> Bool {
        let current = (textField.text ?? "") as NSString
        let next = current.replacingCharacters(in: range, with: string)
        return next.count <= 3 && next.allSatisfy { $0.isNumber && $0.isASCII }
    }

    /// Le clavier a besoin de place : la feuille passe en grand.
    func textFieldDidBeginEditing(_ textField: UITextField) {
        sheetPresentationController?.animateChanges {
            self.sheetPresentationController?.selectedDetentIdentifier = .large
        }
    }
}

#endif
