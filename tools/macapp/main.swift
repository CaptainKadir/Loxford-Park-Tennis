// Loxford Park Tennis for Mac: a small native window around the game. It starts the bundled Node server
// (the same web/server the browser version uses), waits for it, then shows the game in a web view.
import Cocoa
import WebKit
import Darwin

let appName = "Loxford Park Tennis"

func portFree(_ port: UInt16) -> Bool {
    // free only if it can be bound on every address and on loopback (a server on 127.0.0.1 alone must count as taking it)
    for ip in [INADDR_ANY, INADDR_LOOPBACK] {
        let fd = socket(AF_INET, SOCK_STREAM, 0)
        if fd < 0 { return false }
        defer { close(fd) }
        var addr = sockaddr_in()
        addr.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
        addr.sin_family = sa_family_t(AF_INET)
        addr.sin_port = port.bigEndian
        addr.sin_addr.s_addr = ip.bigEndian
        let ok = withUnsafePointer(to: &addr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { bind(fd, $0, socklen_t(MemoryLayout<sockaddr_in>.size)) == 0 }
        }
        if !ok { return false }
    }
    return true
}

func firstFree(from start: UInt16) -> UInt16? {
    for p in start..<(start + 40) where portFree(p) { return p }
    return nil
}

func lanIP() -> String {
    var ifaddr: UnsafeMutablePointer<ifaddrs>?
    guard getifaddrs(&ifaddr) == 0, let first = ifaddr else { return "127.0.0.1" }
    defer { freeifaddrs(ifaddr) }
    var best = "127.0.0.1"
    for ptr in sequence(first: first, next: { $0.pointee.ifa_next }) {
        let i = ptr.pointee
        guard i.ifa_addr.pointee.sa_family == UInt8(AF_INET), (i.ifa_flags & UInt32(IFF_LOOPBACK)) == 0, (i.ifa_flags & UInt32(IFF_UP)) != 0 else { continue }
        var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
        getnameinfo(i.ifa_addr, socklen_t(i.ifa_addr.pointee.sa_len), &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST)
        let ip = String(cString: host)
        if String(cString: i.ifa_name).hasPrefix("en") { return ip }
        best = ip
    }
    return best
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
    var window: NSWindow!
    var web: WKWebView!
    var server: Process?
    var dataDir: URL!
    var localPort: UInt16 = 8080

    func applicationDidFinishLaunching(_ n: Notification) {
        buildMenu()
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        dataDir = support.appendingPathComponent(appName)
        try? FileManager.default.createDirectory(at: dataDir.appendingPathComponent("certs"), withIntermediateDirectories: true)

        let cfg = WKWebViewConfiguration()
        cfg.mediaTypesRequiringUserActionForPlayback = []
        cfg.preferences.setValue(true, forKey: "developerExtrasEnabled")
        web = WKWebView(frame: .zero, configuration: cfg)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.setValue(false, forKey: "drawsBackground")

        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1280, height: 760),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = appName
        window.backgroundColor = .black
        window.collectionBehavior = [.fullScreenPrimary]
        window.contentView = web
        window.center()
        window.setFrameAutosaveName("main")
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        web.loadHTMLString("<body style='background:#000;color:#ddd;font:20px -apple-system;display:flex;align-items:center;justify-content:center;height:100vh;margin:0'>Starting Loxford Park Tennis...</body>", baseURL: nil)

        DispatchQueue.global().async { self.startServer() }
    }

    func fail(_ text: String) {
        DispatchQueue.main.async {
            let a = NSAlert()
            a.messageText = "\(appName) could not start"
            a.informativeText = text
            a.runModal()
            NSApp.terminate(nil)
        }
    }

    /// A certificate for localhost and this Mac's address, so a phone on the same Wi-Fi can open the controller page (https).
    func ensureCert(ip: String) {
        let certs = dataDir.appendingPathComponent("certs")
        let key = certs.appendingPathComponent("key.pem"), cert = certs.appendingPathComponent("cert.pem"), stamp = certs.appendingPathComponent("ip.txt")
        let old = (try? String(contentsOf: stamp, encoding: .utf8)) ?? ""
        if FileManager.default.fileExists(atPath: key.path), FileManager.default.fileExists(atPath: cert.path), old == ip { return }
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/usr/bin/openssl")
        p.arguments = ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "825", "-keyout", key.path, "-out", cert.path,
                       "-subj", "/CN=loxford-park-tennis", "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:\(ip)"]
        p.standardOutput = FileHandle.nullDevice
        p.standardError = FileHandle.nullDevice
        try? p.run()
        p.waitUntilExit()
        if p.terminationStatus == 0 { try? ip.write(to: stamp, atomically: true, encoding: .utf8) }
    }

    func startServer() {
        let res = Bundle.main.resourceURL!
        let node = res.appendingPathComponent("node")
        let webDir = res.appendingPathComponent("web")
        guard let lp = firstFree(from: 8080), let sp = firstFree(from: 8443) else { fail("No free network port was found (8080 and 8443 upwards are all busy)."); return }
        localPort = lp
        ensureCert(ip: lanIP())
        let p = Process()
        p.executableURL = node
        p.arguments = ["server/index.js"]
        p.currentDirectoryURL = webDir
        var env = ProcessInfo.processInfo.environment
        env["OC_DATA"] = dataDir.path
        env["PORT"] = String(sp)
        env["LOCAL_PORT"] = String(lp)
        p.environment = env
        let logURL = dataDir.appendingPathComponent("server.log")
        FileManager.default.createFile(atPath: logURL.path, contents: nil)
        if let h = try? FileHandle(forWritingTo: logURL) { p.standardOutput = h; p.standardError = h }
        p.terminationHandler = { [weak self] pr in
            if pr.terminationReason == .exit && pr.terminationStatus != 0 { self?.fail("The game server stopped (code \(pr.terminationStatus)). Details: \(logURL.path)") }
        }
        do { try p.run() } catch { fail("Could not start the game server: \(error.localizedDescription)"); return }
        server = p
        let url = URL(string: "http://127.0.0.1:\(lp)/")!
        for _ in 0..<150 {
            let sem = DispatchSemaphore(value: 0)
            var ok = false
            URLSession.shared.dataTask(with: url) { _, r, _ in ok = (r as? HTTPURLResponse)?.statusCode == 200; sem.signal() }.resume()
            sem.wait()
            if ok { DispatchQueue.main.async { self.web.load(URLRequest(url: URL(string: "http://localhost:\(lp)/")!)) }; return }
            Thread.sleep(forTimeInterval: 0.1)
        }
        fail("The game server did not answer. Details: \(logURL.path)")
    }

    // Anything that is not the local game (the project page, a link in a message) opens in the browser.
    func webView(_ w: WKWebView, decidePolicyFor a: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let u = a.request.url, let host = u.host, u.scheme?.hasPrefix("http") == true, host != "localhost", host != "127.0.0.1" {
            NSWorkspace.shared.open(u); decisionHandler(.cancel); return
        }
        decisionHandler(.allow)
    }
    func webView(_ w: WKWebView, createWebViewWith c: WKWebViewConfiguration, for a: WKNavigationAction, windowFeatures f: WKWindowFeatures) -> WKWebView? {
        if let u = a.request.url { NSWorkspace.shared.open(u) }
        return nil
    }

    func buildMenu() {
        let main = NSMenu()
        let appItem = NSMenuItem(); main.addItem(appItem)
        let app = NSMenu(); appItem.submenu = app
        app.addItem(withTitle: "About \(appName)", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        app.addItem(.separator())
        app.addItem(withTitle: "Hide \(appName)", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        app.addItem(.separator())
        app.addItem(withTitle: "Quit \(appName)", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let viewItem = NSMenuItem(); main.addItem(viewItem)
        let view = NSMenu(title: "View"); viewItem.submenu = view
        let fs = view.addItem(withTitle: "Enter Full Screen", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f")
        fs.keyEquivalentModifierMask = [.command, .control]
        view.addItem(withTitle: "Reload", action: #selector(reload), keyEquivalent: "r").target = self
        NSApp.mainMenu = main
    }
    @objc func reload() { web.reload() }

    func applicationShouldTerminateAfterLastWindowClosed(_ s: NSApplication) -> Bool { true }
    func applicationWillTerminate(_ n: Notification) { server?.terminationHandler = nil; server?.terminate() }
}

let app = NSApplication.shared
app.setActivationPolicy(.regular)
let delegate = AppDelegate()
app.delegate = delegate
app.run()
