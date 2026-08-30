import ExpoModulesCore
import AVFoundation

public class ExpoAudioRouteModule: Module {
  private var routeObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("ExpoAudioRoute")

    Events("onAudioRouteChanged")

    AsyncFunction("getCurrentRouteAsync") { () -> [String: String] in
      Self.routePayload()
    }

    OnStartObserving {
      self.routeObserver = NotificationCenter.default.addObserver(
        forName: AVAudioSession.routeChangeNotification,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        self?.sendEvent("onAudioRouteChanged", Self.routePayload())
      }
    }

    OnStopObserving {
      if let observer = self.routeObserver {
        NotificationCenter.default.removeObserver(observer)
        self.routeObserver = nil
      }
    }
  }

  private static func routePayload() -> [String: String] {
    let session = AVAudioSession.sharedInstance()
    let outputs = session.currentRoute.outputs

    for output in outputs {
      let mapped = mapPort(output.portType, name: output.portName)
      if mapped.kind != "speaker" && mapped.kind != "unknown" {
        return mapped
      }
    }

    if let first = outputs.first {
      return mapPort(first.portType, name: first.portName)
    }

    return ["kind": "unknown", "name": ""]
  }

  private static func mapPort(_ portType: AVAudioSession.Port, name: String) -> [String: String] {
    switch portType {
    case .builtInReceiver:
      return ["kind": "earpiece", "name": name.isEmpty ? "Earpiece" : name]
    case .builtInSpeaker:
      return ["kind": "speaker", "name": name.isEmpty ? "Speaker" : name]
    case .headphones, .headsetMic:
      return ["kind": "wired", "name": name.isEmpty ? "Wired headset" : name]
    case .bluetoothA2DP, .bluetoothHFP, .bluetoothLE:
      return ["kind": "bluetooth", "name": name.isEmpty ? "Bluetooth" : name]
    default:
      if name.lowercased().contains("bluetooth") {
        return ["kind": "bluetooth", "name": name]
      }
      if name.lowercased().contains("headphone") || name.lowercased().contains("headset") {
        return ["kind": "wired", "name": name.isEmpty ? "Wired headset" : name]
      }
      return ["kind": "unknown", "name": name]
    }
  }
}
