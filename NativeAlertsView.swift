import UIKit

/// Fenêtre « Alertes » native (feuille iOS avec poignée, boutons Liquid Glass, spinner Apple en tirant vers le bas).
/// La page web envoie la liste (app.js : nativeAlertsInfo) ; les actions (tout marquer comme lu, ouvrir une commande,
/// rafraîchir) repartent vers la page via `onAct`. Tout le texte arrive déjà traduit.
#if compiler(>=6.2)

@available(iOS 26.0, *)
final class AlertCell: UITableViewCell {
    private let iconBox = UIView()
    private let iconView = UIImageView()
    private let srcLabel = UILabel()
    private let titleLabel = UILabel()
    private let bodyLabel = UILabel()
    private let dot = UIView()

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        backgroundColor = .clear
        let sel = UIView()
        sel.backgroundColor = UIColor(white: 0, alpha: 0.05)
        selectedBackgroundView = sel

        iconBox.layer.cornerRadius = 6
        iconBox.layer.cornerCurve = .continuous
        iconBox.translatesAutoresizingMaskIntoConstraints = false
        iconView.tintColor = .white
        iconView.contentMode = .scaleAspectFit
        iconView.translatesAutoresizingMaskIntoConstraints = false
        iconBox.addSubview(iconView)

        dot.backgroundColor = PCTheme.blue
        dot.layer.cornerRadius = 5
        dot.translatesAutoresizingMaskIntoConstraints = false

        titleLabel.font = .inter(20, .bold)
        titleLabel.textColor = PCTheme.ink
        titleLabel.numberOfLines = 0
        bodyLabel.font = .inter(19, .regular)
        bodyLabel.textColor = UIColor(white: 0.33, alpha: 1)
        bodyLabel.numberOfLines = 0

        let head = UIStackView(arrangedSubviews: [iconBox, srcLabel, dot])
        head.axis = .horizontal
        head.alignment = .center
        head.spacing = 8
        let stack = UIStackView(arrangedSubviews: [head, titleLabel, bodyLabel])
        stack.axis = .vertical
        stack.spacing = 8
        stack.setCustomSpacing(10, after: head)
        stack.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(stack)
        NSLayoutConstraint.activate([
            iconBox.widthAnchor.constraint(equalToConstant: 22),
            iconBox.heightAnchor.constraint(equalToConstant: 22),
            iconView.centerXAnchor.constraint(equalTo: iconBox.centerXAnchor),
            iconView.centerYAnchor.constraint(equalTo: iconBox.centerYAnchor),
            iconView.widthAnchor.constraint(equalToConstant: 13),
            iconView.heightAnchor.constraint(equalToConstant: 13),
            dot.widthAnchor.constraint(equalToConstant: 10),
            dot.heightAnchor.constraint(equalToConstant: 10),
            stack.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            stack.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 16),
            stack.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -16),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func configure(kind: String, src: String, when: String, title: String, body: String, unread: Bool) {
        let gray = UIColor(white: 0.38, alpha: 1)
        let text = NSMutableAttributedString(
            string: src,
            attributes: [.font: UIFont.inter(17, .semibold), .foregroundColor: gray]
        )
        text.append(NSAttributedString(
            string: "  •  " + when,
            attributes: [.font: UIFont.inter(17, .regular), .foregroundColor: gray]
        ))
        srcLabel.attributedText = text
        titleLabel.text = title
        bodyLabel.text = body
        bodyLabel.isHidden = body.isEmpty
        dot.isHidden = !unread
        iconBox.backgroundColor = UIColor(red: 0.0, green: 0.50, blue: 0.38, alpha: 1)
        iconView.image = UIImage(
            systemName: kind == "payout" ? "checkmark" : "bag.fill",
            withConfiguration: UIImage.SymbolConfiguration(pointSize: 12, weight: .bold)
        )
    }
}

@available(iOS 26.0, *)
final class AlertsViewController: UIViewController, UITableViewDataSource, UITableViewDelegate {
    private struct Item {
        let id: String, kind: String, src: String, when: String, title: String, body: String
        var unread: Bool
    }

    /// Action vers la page web : ["act": "readall" | "refresh" | "open", "id": …]
    var onAct: (([String: Any]) -> Void)?
    /// La feuille est partie (fermée, glissée vers le bas ou remplacée).
    var onClosed: (() -> Void)?

    private var info: [String: Any]
    private var filter = "all"
    private var all: [Item] = []
    private var shown: [Item] = []
    private var refreshStart: CFTimeInterval = 0
    private var closedReported = false

    private let table = UITableView(frame: .zero, style: .plain)
    private let refresh = UIRefreshControl()
    private let titleLabel = UILabel()
    private let closeButton = PCGlassButton(symbol: "xmark", circle: true)
    private let group = UIVisualEffectView(effect: nil)
    private let filterButton = UIButton(type: .system)
    private let readButton = UIButton(type: .system)
    private let emptyLabel = UILabel()

    init(info: [String: Any]) {
        self.info = info
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .pageSheet
        if let sheet = sheetPresentationController {
            sheet.detents = [.large()]
            sheet.prefersGrabberVisible = true
        }
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    // MARK: Cycle de vie

    override func viewDidLoad() {
        super.viewDidLoad()
        overrideUserInterfaceStyle = .light
        view.backgroundColor = .white

        closeButton.onTap = { [weak self] in self?.dismiss(animated: true) }

        titleLabel.font = .inter(18, .bold)
        titleLabel.textColor = PCTheme.ink
        titleLabel.textAlignment = .center
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        // Capsule en verre à deux boutons : filtrer + tout marquer comme lu
        let glass = UIGlassEffect()
        glass.isInteractive = true
        group.effect = glass
        group.cornerConfiguration = .capsule()
        group.translatesAutoresizingMaskIntoConstraints = false
        configureIcon(filterButton, symbol: "line.3.horizontal.decrease")
        configureIcon(readButton, symbol: "checkmark.circle")
        readButton.addTarget(self, action: #selector(markAllRead), for: .touchUpInside)
        let buttons = UIStackView(arrangedSubviews: [filterButton, readButton])
        buttons.axis = .horizontal
        buttons.distribution = .fillEqually
        buttons.translatesAutoresizingMaskIntoConstraints = false
        group.contentView.addSubview(buttons)

        let hairline = UIView()
        hairline.backgroundColor = UIColor(white: 0, alpha: 0.10)
        hairline.translatesAutoresizingMaskIntoConstraints = false

        table.dataSource = self
        table.delegate = self
        table.register(AlertCell.self, forCellReuseIdentifier: "AlertCell")
        table.backgroundColor = .clear
        table.separatorColor = UIColor(white: 0, alpha: 0.10)
        table.separatorInset = UIEdgeInsets(top: 0, left: 16, bottom: 0, right: 16)
        table.rowHeight = UITableView.automaticDimension
        table.estimatedRowHeight = 120
        table.alwaysBounceVertical = true
        table.tableFooterView = UIView()
        table.translatesAutoresizingMaskIntoConstraints = false
        refresh.tintColor = UIColor(white: 0.5, alpha: 1)
        refresh.addTarget(self, action: #selector(pulled), for: .valueChanged)
        table.refreshControl = refresh

        emptyLabel.font = .inter(17)
        emptyLabel.textColor = PCTheme.sub
        emptyLabel.textAlignment = .center
        emptyLabel.numberOfLines = 0
        emptyLabel.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(table)
        view.addSubview(emptyLabel)
        view.addSubview(hairline)
        view.addSubview(titleLabel)
        view.addSubview(group)
        view.addSubview(closeButton)
        NSLayoutConstraint.activate([
            closeButton.topAnchor.constraint(equalTo: view.topAnchor, constant: 18),
            closeButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            group.topAnchor.constraint(equalTo: closeButton.topAnchor),
            group.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            group.heightAnchor.constraint(equalToConstant: 44),
            group.widthAnchor.constraint(equalToConstant: 100),
            buttons.leadingAnchor.constraint(equalTo: group.contentView.leadingAnchor),
            buttons.trailingAnchor.constraint(equalTo: group.contentView.trailingAnchor),
            buttons.topAnchor.constraint(equalTo: group.contentView.topAnchor),
            buttons.bottomAnchor.constraint(equalTo: group.contentView.bottomAnchor),
            titleLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            titleLabel.centerYAnchor.constraint(equalTo: closeButton.centerYAnchor),
            titleLabel.leadingAnchor.constraint(greaterThanOrEqualTo: closeButton.trailingAnchor, constant: 8),
            titleLabel.trailingAnchor.constraint(lessThanOrEqualTo: group.leadingAnchor, constant: -8),
            hairline.topAnchor.constraint(equalTo: closeButton.bottomAnchor, constant: 10),
            hairline.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            hairline.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            hairline.heightAnchor.constraint(equalToConstant: 1),
            table.topAnchor.constraint(equalTo: hairline.bottomAnchor),
            table.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            table.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            table.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            emptyLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            emptyLabel.topAnchor.constraint(equalTo: hairline.bottomAnchor, constant: 80),
            emptyLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 32),
            emptyLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -32),
        ])
        reloadFromInfo()
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        if isBeingDismissed, !closedReported {
            closedReported = true
            onClosed?()
        }
    }

    private func configureIcon(_ button: UIButton, symbol: String) {
        var config = UIButton.Configuration.plain()
        config.image = UIImage(
            systemName: symbol,
            withConfiguration: UIImage.SymbolConfiguration(pointSize: 21, weight: .semibold)
        )
        config.baseForegroundColor = PCTheme.ink
        button.configuration = config
    }

    // MARK: Données

    /// La page web envoie une liste à jour (rafraîchissement, nouvelle commande…).
    func update(info newInfo: [String: Any]) {
        info = newInfo
        guard isViewLoaded else { return }
        reloadFromInfo()
        if refresh.isRefreshing {
            let wait = max(0, 0.8 - (CACurrentMediaTime() - refreshStart))
            DispatchQueue.main.asyncAfter(deadline: .now() + wait) { [weak self] in self?.refresh.endRefreshing() }
        }
    }

    private func reloadFromInfo() {
        titleLabel.text = (info["title"] as? String) ?? ""
        emptyLabel.text = (info["empty"] as? String) ?? ""
        all = ((info["items"] as? [[String: Any]]) ?? []).map {
            Item(
                id: ($0["id"] as? String) ?? "", kind: ($0["kind"] as? String) ?? "order",
                src: ($0["src"] as? String) ?? "", when: ($0["when"] as? String) ?? "",
                title: ($0["title"] as? String) ?? "", body: ($0["body"] as? String) ?? "",
                unread: ($0["unread"] as? NSNumber)?.boolValue ?? false
            )
        }
        rebuildMenu()
        applyFilter()
    }

    private func rebuildMenu() {
        let filters = ((info["filters"] as? [[String: Any]]) ?? []).map {
            (k: ($0["k"] as? String) ?? "all", l: ($0["l"] as? String) ?? "")
        }
        let actions = filters.map { f in
            UIAction(title: f.l, state: f.k == filter ? .on : .off) { [weak self] _ in
                self?.filter = f.k
                self?.rebuildMenu()
                self?.applyFilter()
            }
        }
        filterButton.menu = UIMenu(children: actions)
        filterButton.showsMenuAsPrimaryAction = true
        filterButton.accessibilityLabel = (info["filterTitle"] as? String) ?? ""
        readButton.accessibilityLabel = (info["markAll"] as? String) ?? ""
    }

    private func applyFilter() {
        switch filter {
        case "unread": shown = all.filter { $0.unread }
        case "order": shown = all.filter { $0.kind == "order" }
        case "payout": shown = all.filter { $0.kind == "payout" }
        default: shown = all
        }
        table.reloadData()
        emptyLabel.isHidden = !shown.isEmpty
    }

    // MARK: Actions

    @objc private func markAllRead() {
        PCTheme.haptic()
        for i in all.indices { all[i].unread = false }
        applyFilter()
        onAct?(["act": "readall"])
    }

    @objc private func pulled() {
        refreshStart = CACurrentMediaTime()
        onAct?(["act": "refresh"])
        // Si la page ne répond pas, le spinner s'arrête quand même.
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) { [weak self] in
            if self?.refresh.isRefreshing == true { self?.refresh.endRefreshing() }
        }
    }

    // MARK: Table

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int { shown.count }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "AlertCell", for: indexPath) as! AlertCell
        let it = shown[indexPath.row]
        cell.configure(kind: it.kind, src: it.src, when: it.when, title: it.title, body: it.body, unread: it.unread)
        return cell
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        let id = shown[indexPath.row].id
        PCTheme.haptic()
        dismiss(animated: true) { [weak self] in self?.onAct?(["act": "open", "id": id]) }
    }
}

#endif
