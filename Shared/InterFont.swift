import SwiftUI
import UIKit
import CoreText

/// Police Inter (même que l'app Shopify), embarquée dans le bundle (dossier Fonts/).
/// Graisses : Regular = 450, Medium = 500, SemiBold = 650, Bold = 700, Heavy = 800
/// (mêmes valeurs que la version web : body 450, gras 650).
enum Inter {
    private static var registered = false

    /// Enregistre les TTF du bundle courant (app ou widget). Appel idempotent.
    static func register() {
        guard !registered else { return }
        registered = true
        for n in ["Regular", "Medium", "SemiBold", "Bold", "Heavy"] {
            if let url = Bundle.main.url(forResource: "Inter-\(n)", withExtension: "ttf") {
                CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
            }
        }
    }

    static func psName(_ w: UIFont.Weight) -> String {
        switch w {
        case ..<UIFont.Weight.medium: return "Inter-Regular"
        case ..<UIFont.Weight.semibold: return "Inter-Medium"
        case ..<UIFont.Weight.bold: return "Inter-SemiBold"
        case ..<UIFont.Weight.heavy: return "Inter-Bold"
        default: return "Inter-Heavy"
        }
    }

    static func psName(_ w: Font.Weight) -> String {
        switch w {
        case .ultraLight, .thin, .light, .regular: return "Inter-Regular"
        case .medium: return "Inter-Medium"
        case .semibold: return "Inter-SemiBold"
        case .bold: return "Inter-Bold"
        default: return "Inter-Heavy"
        }
    }
}

extension UIFont {
    /// Remplace `UIFont.systemFont(ofSize:weight:)`.
    static func inter(_ size: CGFloat, _ weight: UIFont.Weight = .regular) -> UIFont {
        Inter.register()
        return UIFont(name: Inter.psName(weight), size: size) ?? .systemFont(ofSize: size, weight: weight)
    }
}

extension Font {
    /// Remplace `Font.system(size:weight:)`.
    static func inter(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        Inter.register()
        return .custom(Inter.psName(weight), fixedSize: size)
    }
}
