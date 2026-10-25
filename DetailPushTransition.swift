import UIKit

/// Transition « push » façon iOS pour les pages natives Commande et Produit :
/// la page arrive de la droite avec un ressort fluide, la page du dessous recule en parallaxe
/// (≈ 30 %) en s'assombrissant légèrement, et la page qui arrive projette une ombre sur son bord gauche.
/// Le même mécanisme suit le doigt pour le retour par glissement depuis le bord gauche.
protocol DetailPushHosting: AnyObject {
    var push: DetailPushTransition { get }
}

final class DetailPushTransition {
    private weak var detail: UIView?
    private var under: [UIView] = []
    private let dim = UIView()
    private let parallax: CGFloat = 0.30
    private let maxDim: CGFloat = 0.10

    /// À appeler une fois la vue ajoutée à la hiérarchie, avant toute animation.
    func attach(to detailView: UIView) {
        detail = detailView
        guard let parent = detailView.superview,
              let idx = parent.subviews.firstIndex(of: detailView) else { return }
        under = Array(parent.subviews[..<idx]).filter { $0 !== dim }
        dim.backgroundColor = .black
        dim.alpha = 0
        dim.isUserInteractionEnabled = false
        dim.frame = parent.bounds
        dim.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        parent.insertSubview(dim, belowSubview: detailView)

        let layer = detailView.layer
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowRadius = 16
        layer.shadowOffset = CGSize(width: -6, height: 0)
        layer.shadowOpacity = 0
        layer.masksToBounds = false
    }

    /// progress : 0 = page fermée (hors écran), 1 = page ouverte.
    func setProgress(_ p: CGFloat) {
        guard let v = detail else { return }
        let p = min(max(p, 0), 1)
        let w = v.bounds.width
        v.transform = CGAffineTransform(translationX: (1 - p) * w, y: 0)
        let back = CGAffineTransform(translationX: -p * w * parallax, y: 0)
        under.forEach { $0.transform = back }
        dim.alpha = maxDim * p
        v.layer.shadowOpacity = Float(0.16 * p)
        v.layer.shadowPath = UIBezierPath(rect: v.bounds).cgPath
    }

    /// Anime vers l'état ouvert ou fermé, en reprenant la vitesse du geste (points/s, positive = vers la droite).
    func animate(open: Bool, velocity: CGFloat = 0, completion: (() -> Void)? = nil) {
        guard let v = detail else { completion?(); return }
        let w = max(v.bounds.width, 1)
        let current = 1 - ((v.transform.tx) / w)
        let distance = abs((open ? 1 : 0) - current)
        let initial = distance > 0.01 ? min(abs(velocity) / (w * distance), 8) : 0
        let wantsHelp = open ? velocity < 0 : velocity > 0
        UIView.animate(withDuration: open ? 0.5 : 0.42,
                       delay: 0,
                       usingSpringWithDamping: 1.0,
                       initialSpringVelocity: wantsHelp ? initial : 0,
                       options: [.allowUserInteraction, .beginFromCurrentState],
                       animations: { self.setProgress(open ? 1 : 0) },
                       completion: { _ in completion?() })
    }

    func slideIn() {
        setProgress(0)
        UIImpactFeedbackGenerator(style: .light).impactOccurred(intensity: 0.5)
        animate(open: true)
    }

    func close(velocity: CGFloat = 0, completion: (() -> Void)? = nil) {
        animate(open: false, velocity: velocity) { [weak self] in
            self?.reset()
            completion?()
        }
    }

    /// Remet la page du dessous en place (fermeture sans animation, changement d'onglet…).
    func reset() {
        under.forEach { $0.transform = .identity }
        under.removeAll()
        dim.removeFromSuperview()
        detail?.layer.shadowOpacity = 0
    }
}
