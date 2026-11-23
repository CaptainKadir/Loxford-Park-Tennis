// Draws the app icon (a tennis ball on a green court) as a 1024 px PNG: swift icon.swift out.png
import Cocoa
let size = 1024
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
let r = NSRect(x: 40, y: 40, width: 944, height: 944)
let bg = NSBezierPath(roundedRect: r, xRadius: 210, yRadius: 210)
NSGradient(colors: [NSColor(red: 0.12, green: 0.50, blue: 0.88, alpha: 1), NSColor(red: 0.07, green: 0.32, blue: 0.66, alpha: 1)])!.draw(in: bg, angle: -90)
NSColor(red: 0.36, green: 0.56, blue: 0.34, alpha: 1).setFill()
NSBezierPath(rect: NSRect(x: 150, y: 170, width: 724, height: 520)).fill()
NSColor.white.setStroke()
let lines = NSBezierPath(); lines.lineWidth = 12
lines.appendRect(NSRect(x: 190, y: 200, width: 644, height: 460)); lines.move(to: NSPoint(x: 512, y: 200)); lines.line(to: NSPoint(x: 512, y: 660))
lines.move(to: NSPoint(x: 190, y: 430)); lines.line(to: NSPoint(x: 834, y: 430)); lines.stroke()
let ball = NSRect(x: 360, y: 420, width: 330, height: 330)
NSColor(white: 0, alpha: 0.25).setFill(); NSBezierPath(ovalIn: ball.offsetBy(dx: 14, dy: -22)).fill()
NSColor(red: 0.84, green: 0.95, blue: 0.2, alpha: 1).setFill(); NSBezierPath(ovalIn: ball).fill()
NSColor.white.setStroke()
let seam = NSBezierPath(); seam.lineWidth = 14
seam.appendArc(withCenter: NSPoint(x: ball.minX - 120, y: ball.midY), radius: 215, startAngle: -38, endAngle: 38); seam.stroke()
let seam2 = NSBezierPath(); seam2.lineWidth = 14
seam2.appendArc(withCenter: NSPoint(x: ball.maxX + 120, y: ball.midY), radius: 215, startAngle: 142, endAngle: 218); seam2.stroke()
NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
