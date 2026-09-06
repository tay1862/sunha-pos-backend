package com.sunha.pos

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.Socket
import java.util.UUID

class SunhaPrinterModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private var bluetoothSocket: BluetoothSocket? = null
  private var output: OutputStream? = null
  override fun getName() = "SunhaPrinter"
  @ReactMethod fun connect(profile: ReadableMap, promise: Promise) {
    try {
      closeConnection(); val transport = profile.getString("transport") ?: throw IllegalArgumentException("TRANSPORT_REQUIRED")
      if (transport == "LAN") { val parts = (profile.getString("address") ?: throw IllegalArgumentException("ADDRESS_REQUIRED")).split(":", limit = 2); val socket = Socket(); socket.connect(InetSocketAddress(parts[0], parts.getOrNull(1)?.toIntOrNull() ?: 9100), 5000); output = socket.getOutputStream() }
      else { val address = profile.getString("address") ?: throw IllegalArgumentException("BLUETOOTH_ADDRESS_REQUIRED"); val adapter = BluetoothAdapter.getDefaultAdapter() ?: throw IllegalStateException("BLUETOOTH_NOT_SUPPORTED"); if (!adapter.isEnabled) throw IllegalStateException("BLUETOOTH_DISABLED"); val device: BluetoothDevice = adapter.getRemoteDevice(address); val socket = device.createRfcommSocketToServiceRecord(UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")); socket.connect(); bluetoothSocket = socket; output = socket.outputStream }
      promise.resolve(null)
    } catch (error: Exception) { promise.reject("PRINTER_CONNECT_FAILED", error.message, error) }
  }
  @ReactMethod fun disconnect(promise: Promise) { closeConnection(); promise.resolve(null) }
  @ReactMethod fun printReceipt(text: String, promise: Promise) { writeEscPos(text, promise) }
  @ReactMethod fun printTest(promise: Promise) { writeEscPos("Sunha POS\nPrinter test\n\n", promise) }
  private fun writeEscPos(text: String, promise: Promise) { try { val stream = output ?: throw IllegalStateException("PRINTER_NOT_CONNECTED"); stream.write(byteArrayOf(0x1B, 0x40)); stream.write(text.toByteArray(Charsets.UTF_8)); stream.write(byteArrayOf(0x0A, 0x0A, 0x1D, 0x56, 0x00)); stream.flush(); promise.resolve(null) } catch (error: Exception) { promise.reject("PRINTER_WRITE_FAILED", error.message, error) } }
  private fun closeConnection() { try { output?.close() } catch (_: Exception) {}; try { bluetoothSocket?.close() } catch (_: Exception) {}; output = null; bluetoothSocket = null }
}
