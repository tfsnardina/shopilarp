import UIKit

/// Spinner de rafraîchissement Apple (UIRefreshControl, celui du système).
/// Le geste « tirer pour rafraîchir » reste géré par la page web (l'en-tête ne bouge pas, seul le contenu descend) ;
/// ce UIScrollView transparent, posé par-dessus la WebView, reçoit la distance tirée et affiche le vrai spinner Apple
/// dans l'espace qui s'ouvre sous l'en-tête. Il ne capte aucun toucher.
final class PullRefreshHost: UIScrollView {
    private let refresh = UIRefreshControl()
    private(set) var isLoading = false
    private static let hostHeight: CGFloat = 220

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isUserInteractionEnabled = false
        showsVerticalScrollIndicator = false
        showsHorizontalScrollIndicator = false
        alwaysBounceVertical = true
        contentInsetAdjustmentBehavior = .never
        // L'accueil est noir : spinner blanc, mode sombre.
        overrideUserInterfaceStyle = .dark
        refresh.tintColor = .white
        refreshControl = refresh
        isHidden = true
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    /// Positionne la zone juste sous l'en-tête de la page (top = bas de l'en-tête, en points).
    func place(top: CGFloat, width: CGFloat) {
        frame = CGRect(x: 0, y: top, width: width, height: Self.hostHeight)
        contentSize = CGSize(width: width, height: Self.hostHeight + 1)
    }

    /// Distance tirée (points) : le spinner se dévoile progressivement comme dans les apps Apple.
    func pull(_ y: CGFloat) {
        if y > 0.5 {
            isHidden = false
            contentOffset = CGPoint(x: 0, y: -y)
        } else {
            contentOffset = .zero
            if !isLoading { isHidden = true }
        }
    }

    func beginLoading() {
        isLoading = true
        isHidden = false
        if !refresh.isRefreshing { refresh.beginRefreshing() }
    }

    func endLoading() {
        isLoading = false
        if refresh.isRefreshing { refresh.endRefreshing() }
    }
}
