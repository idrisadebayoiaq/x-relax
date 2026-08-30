package expo.modules.audioroute

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoAudioRouteModule : Module() {
  private var receiver: BroadcastReceiver? = null

  override fun definition() = ModuleDefinition {
    Name("ExpoAudioRoute")

    Events("onAudioRouteChanged")

    AsyncFunction("getCurrentRouteAsync") {
      routePayload()
    }

    OnStartObserving {
      val ctx = appContext.reactContext ?: return@OnStartObserving
      val filter = IntentFilter().apply {
        addAction(AudioManager.ACTION_HEADSET_PLUG)
        addAction(AudioManager.ACTION_AUDIO_BECOMING_NOISY)
        addAction(AudioManager.ACTION_SCO_AUDIO_STATE_UPDATED)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
          addAction(AudioManager.ACTION_HDMI_AUDIO_PLUG)
        }
      }
      receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
          sendEvent("onAudioRouteChanged", routePayload())
        }
      }
      ctx.registerReceiver(receiver, filter)
    }

    OnStopObserving {
      val ctx = appContext.reactContext
      receiver?.let { r ->
        try {
          ctx?.unregisterReceiver(r)
        } catch (_: IllegalArgumentException) {
        }
      }
      receiver = null
    }
  }

  private fun routePayload(): Map<String, String> {
    val ctx = appContext.reactContext
    val audioManager = ctx?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
      ?: return mapOf("kind" to "unknown", "name" to "")

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      val outputs = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
      val bluetooth = outputs.firstOrNull {
        it.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP ||
          it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO
      }
      if (bluetooth != null) {
        val label = bluetooth.productName?.toString()?.takeIf { it.isNotBlank() } ?: "Bluetooth"
        return mapOf("kind" to "bluetooth", "name" to label)
      }

      val wired = outputs.firstOrNull {
        it.type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
          it.type == AudioDeviceInfo.TYPE_WIRED_HEADSET ||
          it.type == AudioDeviceInfo.TYPE_USB_HEADSET
      }
      if (wired != null) {
        val label = wired.productName?.toString()?.takeIf { it.isNotBlank() } ?: "Wired headset"
        return mapOf("kind" to "wired", "name" to label)
      }

      if (audioManager.isBluetoothScoOn || audioManager.isBluetoothA2dpOn) {
        return mapOf("kind" to "bluetooth", "name" to "Bluetooth")
      }
      if (audioManager.isWiredHeadsetOn) {
        return mapOf("kind" to "wired", "name" to "Wired headset")
      }

      if (audioManager.isSpeakerphoneOn) {
        return mapOf("kind" to "speaker", "name" to "Speaker")
      }

      return mapOf("kind" to "earpiece", "name" to "Earpiece")
    }

    return when {
      audioManager.isBluetoothA2dpOn || audioManager.isBluetoothScoOn ->
        mapOf("kind" to "bluetooth", "name" to "Bluetooth")
      audioManager.isWiredHeadsetOn ->
        mapOf("kind" to "wired", "name" to "Wired headset")
      audioManager.isSpeakerphoneOn ->
        mapOf("kind" to "speaker", "name" to "Speaker")
      else -> mapOf("kind" to "earpiece", "name" to "Earpiece")
    }
  }
}
