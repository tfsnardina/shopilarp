import UIKit
import UserNotifications

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = NotificationDelegate.shared
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
        return true
    }

    func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default", sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let bounds = windowScene.screen.bounds
        let window = UIWindow(windowScene: windowScene)
        window.frame = bounds
        window.backgroundColor = .black
        window.rootViewController = WebHostViewController(coordinator: WebViewContainer.Coordinator())
        window.makeKeyAndVisible()
        self.window = window
    }
}

enum NotificationPermission {
    static func postOrder(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = UNNotificationSound(named: UNNotificationSoundName("cha-ching.caf"))
        // Unique thread per order so iOS does not merge them into one group.
        content.threadIdentifier = UUID().uuidString
        let request = UNNotificationRequest(
            identifier: "shopify-order-\(UUID().uuidString)",
            content: content,
            trigger: nil
        )
        UNUserNotificationCenter.current().add(request)
    }

    /// Orders planned by the page for when the app is closed. iOS allows 64 pending local notifications,
    /// so we keep 60. Fixed identifiers: scheduling again replaces the previous plan, an empty list cancels it.
    static let scheduledCount = 60

    static func replaceScheduled(_ items: [[String: Any]]) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(
            withIdentifiers: (0..<scheduledCount).map { "shopify-bg-\($0)" }
        )
        let now = Date().timeIntervalSince1970
        for (index, item) in items.prefix(scheduledCount).enumerated() {
            guard let atMs = (item["at"] as? NSNumber)?.doubleValue else { continue }
            let delay = atMs / 1000 - now
            if delay < 1 { continue }
            let content = UNMutableNotificationContent()
            content.title = (item["title"] as? String) ?? "New order"
            content.body = (item["body"] as? String) ?? ""
            content.sound = UNNotificationSound(named: UNNotificationSoundName("cha-ching.caf"))
            content.threadIdentifier = UUID().uuidString
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: delay, repeats: false)
            center.add(UNNotificationRequest(identifier: "shopify-bg-\(index)", content: content, trigger: trigger))
        }
    }
}

final class NotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationDelegate()

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .list])
    }
}
