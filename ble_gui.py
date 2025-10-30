import sys
import asyncio
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from PySide6 import QtWidgets, QtCore
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QGridLayout,
    QPushButton, QLabel, QListWidget, QListWidgetItem, QComboBox, QLineEdit,
    QCheckBox, QGroupBox, QFileDialog
)
from PySide6.QtCore import Qt, QDateTime, QTimer, Slot
from PySide6.QtGui import QTextCursor

# pip install PySide6 bleak qasync
from bleak import BleakScanner, BleakClient
from qasync import QEventLoop, asyncSlot

# ---------- Nordic UART UUIDs ----------
NUS_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e".lower()
NUS_RX_CHAR  = "6e400002-b5a3-f393-e0a9-e50e24dcca9e".lower()  # Write
NUS_TX_CHAR  = "6e400003-b5a3-f393-e0a9-e50e24dcca9e".lower()  # Notify

PREFERRED_NAME = "DeepSleepDongle"  # optional: helps highlight your device


@dataclass
class DiscoveredDevice:
    name: str
    address: str
    rssi: Optional[int]


class LogPane(QtWidgets.QTextEdit):
    def __init__(self):
        super().__init__()
        self.setReadOnly(True)
        self.setLineWrapMode(QtWidgets.QTextEdit.NoWrap)

    @Slot(str)  # <— make invokable from invokeMethod (fixes "no such method" warnings)
    def log(self, msg: str):
        self.append(msg)
        self.moveCursor(QTextCursor.End)


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("BLE Console — NUS mode (like nRF Connect)")
        self.resize(1120, 760)

        # State
        self.devices: Dict[str, DiscoveredDevice] = {}
        self.client: Optional[BleakClient] = None
        self.connected: bool = False
        self.services_cache = None
        self.rx_chunk_buffer: bytearray = bytearray()
        self.last_chunk_timer = QTimer(self)
        self.last_chunk_timer.setInterval(300)  # flush partial data every 300ms
        self.last_chunk_timer.timeout.connect(self._flush_partial)
        self.rx_uuid: Optional[str] = None  # device -> PC (notify)
        self.tx_uuid: Optional[str] = None  # PC -> device (write)

        # -------- Left: devices ----------
        self.device_list = QListWidget()
        self.status_lbl = QLabel("Status: Idle")
        self.scan_btn = QPushButton("Scan")
        self.connect_btn = QPushButton("Connect")
        self.disconnect_btn = QPushButton("Disconnect")

        left_box = QVBoxLayout()
        left_box.addWidget(QLabel("Discovered Devices"))
        left_box.addWidget(self.device_list)
        btns = QHBoxLayout()
        btns.addWidget(self.scan_btn)
        btns.addWidget(self.connect_btn)
        btns.addWidget(self.disconnect_btn)
        left_box.addLayout(btns)
        left_box.addWidget(self.status_lbl)

        # -------- Right: console ----------
        self.refresh_svcs_btn = QPushButton("Refresh Services")
        self.rx_combo = QComboBox()
        self.tx_combo = QComboBox()
        self.auto_sub_chk = QCheckBox("Auto-subscribe RX")
        self.auto_sub_chk.setChecked(True)

        # Console area
        self.log = LogPane()
        self.input_line = QLineEdit()
        self.input_line.setPlaceholderText("Type text (e.g., 1 or sleep) and press Enter/Send")
        self.send_btn = QPushButton("Send")
        self.send1_btn = QPushButton("Send '1'")
        self.send0_btn = QPushButton("Send '0'")

        # Transmission options
        self.encoding_combo = QComboBox()
        self.encoding_combo.addItems(["UTF-8", "ASCII"])
        self.line_ending_combo = QComboBox()
        self.line_ending_combo.addItems(["None", r"\n", r"\r", r"\r\n"])
        self.wwr_chk = QCheckBox("Write w/o response")  # some FW wants write-without-response
        self.timestamps_chk = QCheckBox("Timestamps"); self.timestamps_chk.setChecked(True)
        self.clear_btn = QPushButton("Clear")
        self.save_btn = QPushButton("Save Log")

        # ---- Layouts ----
        right_top = QGroupBox("Nordic UART Mapping (auto)")
        grid = QGridLayout(right_top)
        grid.addWidget(self.refresh_svcs_btn, 0, 0, 1, 5)
        grid.addWidget(QLabel("RX (notifications from device, NUS TX 0003):"), 1, 0)
        grid.addWidget(self.rx_combo, 1, 1, 1, 4)
        grid.addWidget(QLabel("TX (write to device, NUS RX 0002):"), 2, 0)
        grid.addWidget(self.tx_combo, 2, 1, 1, 4)
        grid.addWidget(self.auto_sub_chk, 3, 0)

        right_mid = QGroupBox("Console")
        mid = QVBoxLayout(right_mid)
        mid.addWidget(self.log)

        send_row1 = QHBoxLayout()
        send_row1.addWidget(QLabel("Encoding:")); send_row1.addWidget(self.encoding_combo)
        send_row1.addWidget(QLabel("Line end:")); send_row1.addWidget(self.line_ending_combo)
        send_row1.addWidget(self.wwr_chk)
        send_row1.addStretch()
        mid.addLayout(send_row1)

        send_row2 = QHBoxLayout()
        send_row2.addWidget(self.input_line, 1)
        send_row2.addWidget(self.send_btn)
        send_row2.addWidget(self.send1_btn)
        send_row2.addWidget(self.send0_btn)
        mid.addLayout(send_row2)

        util_row = QHBoxLayout()
        util_row.addWidget(self.timestamps_chk)
        util_row.addStretch()
        util_row.addWidget(self.clear_btn)
        util_row.addWidget(self.save_btn)
        mid.addLayout(util_row)

        right_box = QVBoxLayout()
        right_box.addWidget(right_top)
        right_box.addWidget(right_mid)

        central = QWidget()
        root = QHBoxLayout(central)
        root.addLayout(left_box, 3)
        root.addLayout(right_box, 7)
        self.setCentralWidget(central)

        # Signals
        self.scan_btn.clicked.connect(self.on_scan_clicked)
        self.connect_btn.clicked.connect(self.on_connect_clicked)
        self.disconnect_btn.clicked.connect(self.on_disconnect_clicked)
        self.refresh_svcs_btn.clicked.connect(self.on_refresh_services_clicked)
        self.send_btn.clicked.connect(self.on_console_send)
        self.send1_btn.clicked.connect(lambda: self._quick_send("1"))
        self.send0_btn.clicked.connect(lambda: self._quick_send("0"))
        self.input_line.returnPressed.connect(self.on_console_send)
        self.clear_btn.clicked.connect(lambda: self.log.clear())
        self.save_btn.clicked.connect(self.on_save_log)

    # ---------------- utilities ----------------
    def _ts(self) -> str:
        if not self.timestamps_chk.isChecked():
            return ""
        return QDateTime.currentDateTime().toString("yyyy-MM-dd HH:mm:ss.zzz ")  # space at end

    def set_status(self, text: str):
        self.status_lbl.setText(f"Status: {text}")
        try:
            self.log.log(self._ts() + text)
        except Exception:
            pass

    async def _update_connected_flag(self):
        try:
            ic = getattr(self.client, "is_connected", False)
            if callable(ic):
                self.connected = await ic()
            else:
                self.connected = bool(ic)
        except Exception:
            self.connected = False

    async def _get_services(self):
        if self.client is None:
            return None
        if hasattr(self.client, "get_services"):
            try:
                svcs = await self.client.get_services()  # old API
            except TypeError:
                svcs = self.client.get_services()
        else:
            svcs = getattr(self.client, "services", None)
        self.services_cache = svcs
        return svcs

    def _list_chars(self):
        items = []
        if not self.services_cache:
            return items
        for svc in self.services_cache:
            for ch in svc.characteristics:
                props = list(ch.properties) if hasattr(ch, "properties") else []
                items.append((str(svc.uuid).lower(), str(ch.uuid).lower(), props))
        return items

    def _fill_nus_combos(self):
        """Populate RX/TX dropdowns; prefer exact NUS UUIDs."""
        self.rx_combo.clear()
        self.tx_combo.clear()
        rx_idx = tx_idx = -1
        for svc_uuid, ch_uuid, props in self._list_chars():
            label = f"{ch_uuid}  [{'|'.join(props)}]"
            if "notify" in props or "indicate" in props:
                self.rx_combo.addItem(label, userData=(svc_uuid, ch_uuid, props))
                if ch_uuid == NUS_TX_CHAR and svc_uuid == NUS_SERVICE:
                    rx_idx = self.rx_combo.count() - 1
            if "write" in props or "write-without-response" in props:
                self.tx_combo.addItem(label, userData=(svc_uuid, ch_uuid, props))
                if ch_uuid == NUS_RX_CHAR and svc_uuid == NUS_SERVICE:
                    tx_idx = self.tx_combo.count() - 1

        if rx_idx >= 0:
            self.rx_combo.setCurrentIndex(rx_idx)
        elif self.rx_combo.count():
            self.rx_combo.setCurrentIndex(0)
        if tx_idx >= 0:
            self.tx_combo.setCurrentIndex(tx_idx)
        elif self.tx_combo.count():
            self.tx_combo.setCurrentIndex(0)

        self.rx_uuid = self._current_uuid(self.rx_combo)
        self.tx_uuid = self._current_uuid(self.tx_combo)

    def _current_uuid(self, combo: QComboBox) -> Optional[str]:
        sel = combo.itemData(combo.currentIndex())
        return sel[1] if sel else None

    def _build_payload(self, text: str) -> bytes:
        # line ending
        le = self.line_ending_combo.currentText()
        if le == r"\n": text = text + "\n"
        elif le == r"\r": text = text + "\r"
        elif le == r"\r\n": text = text + "\r\n"
        # encoding
        enc = "utf-8" if self.encoding_combo.currentText() == "UTF-8" else "ascii"
        return text.encode(enc, errors="replace")

    def _quick_send(self, s: str):
        self.input_line.setText(s)
        self.on_console_send()

    # ---- RX notification handling (line + chunk modes) ----
    def _notify_cb(self, sender: str, data: bytearray):
        # accumulate bytes
        self.rx_chunk_buffer.extend(data)
        # emit complete lines (LF)
        while True:
            try:
                idx = self.rx_chunk_buffer.index(0x0A)  # LF
            except ValueError:
                break
            line = self.rx_chunk_buffer[:idx + 1]
            del self.rx_chunk_buffer[:idx + 1]
            try:
                text = line.decode("utf-8", errors="strict").rstrip("\r\n")
            except Exception:
                text = " ".join(f"{b:02X}" for b in line)
            QtCore.QMetaObject.invokeMethod(
                self.log, "log", Qt.QueuedConnection,
                QtCore.Q_ARG(str, self._ts() + f"RX({sender}) line: {text}")
            )
        # schedule a flush so you also see partial messages
        self.last_chunk_timer.start()

    def _flush_partial(self):
        if not self.rx_chunk_buffer:
            return
        try:
            text = self.rx_chunk_buffer.decode("utf-8", errors="replace")
        except Exception:
            text = " ".join(f"{b:02X}" for b in self.rx_chunk_buffer)
        self.rx_chunk_buffer.clear()
        self.log.log(self._ts() + f"RX chunk: {text}")

    # ---------------- BLE actions ----------------
    @asyncSlot()
    async def on_scan_clicked(self):
        self.set_status("Scanning for BLE devices...")
        self.device_list.clear()
        self.devices.clear()
        try:
            found = await BleakScanner.discover(timeout=5.0)
        except Exception as e:
            self.set_status(f"Scan failed: {e}")
            return

        if not found:
            self.set_status("No devices found.")
            return

        found.sort(key=lambda d: (0 if (d.name or "").strip() == PREFERRED_NAME else 1, d.name or ""))
        for d in found:
            name = d.name or "(no name)"
            addr = getattr(d, "address", getattr(d, "device", "unknown"))
            rssi = getattr(d, "rssi", None)
            dev = DiscoveredDevice(name=name, address=addr, rssi=rssi)
            self.devices[addr] = dev
            item = QListWidgetItem(f"{name}  |  {addr}  |  RSSI: {rssi}")
            item.setData(Qt.UserRole, addr)
            if name == PREFERRED_NAME:
                item.setSelected(True)
            self.device_list.addItem(item)

        self.set_status(f"Discovered {len(found)} device(s).")

    @asyncSlot()
    async def on_connect_clicked(self):
        item = self.device_list.currentItem()
        if item is None:
            self.set_status("Select a device first.")
            return
        address = item.data(Qt.UserRole)
        if address not in self.devices:
            self.set_status("Internal error: device not in map.")
            return

        await self.on_disconnect_clicked()  # close previous
        self.set_status(f"Connecting to {address} ...")
        try:
            self.client = BleakClient(address, timeout=10.0)
            await self.client.connect()
            await self._update_connected_flag()
        except Exception as e:
            self.set_status(f"Connection failed: {e}")
            self.client = None
            self.connected = False
            return

        if not self.connected:
            self.set_status("Connection did not complete.")
            return

        self.set_status(f"Connected to {address}.")
        await self._populate_services_and_subscribe()

    @asyncSlot()
    async def on_disconnect_clicked(self):
        if self.client:
            try:
                await self.client.disconnect()
            except Exception as e:
                self.set_status(f"Disconnect error: {e}")
        self.client = None
        self.connected = False
        self.rx_combo.clear()
        self.tx_combo.clear()
        self.rx_chunk_buffer.clear()
        self.last_chunk_timer.stop()
        self.set_status("Disconnected.")

    async def _populate_services_and_subscribe(self):
        try:
            await self._get_services()
        except Exception as e:
            self.set_status(f"Service discovery failed: {e}")
            return
        if not self.services_cache:
            self.set_status("No services available from device.")
            return

        self._fill_nus_combos()
        self.rx_uuid = self._current_uuid(self.rx_combo)
        self.tx_uuid = self._current_uuid(self.tx_combo)

        if self.auto_sub_chk.isChecked() and self.rx_uuid:
            try:
                await self.client.start_notify(self.rx_uuid, self._notify_cb)
                self.set_status(f"Subscribed RX to {self.rx_uuid}.")
            except Exception as e:
                self.set_status(f"Subscribe failed: {e}")

    @asyncSlot()
    async def on_refresh_services_clicked(self):
        if not self.connected:
            self.set_status("Not connected.")
            return
        await self._populate_services_and_subscribe()

    @asyncSlot()
    async def on_console_send(self):
        if not self.connected:
            self.set_status("Not connected.")
            return
        if not self.tx_uuid:
            self.set_status("TX characteristic not selected.")
            return
        text = self.input_line.text()
        if text == "":
            return
        payload = self._build_payload(text)
        await self._write_payload(payload)
        self.input_line.clear()

    async def _write_payload(self, payload: bytes):
        try:
            # choose write mode
            wwr = self.wwr_chk.isChecked()
            await self.client.write_gatt_char(self.tx_uuid, payload, response=(not wwr))
            mode = "write-without-response" if wwr else "write-with-response"
            self.log.log(self._ts() + f"TX [{mode}] -> {self.tx_uuid}: {payload!r}")
        except Exception as e:
            self.set_status(f"Send failed: {e}")

    def on_save_log(self):
        path, _ = QFileDialog.getSaveFileName(self, "Save Log", "ble_log.txt", "Text Files (*.txt)")
        if path:
            with open(path, "w", encoding="utf-8") as f:
                f.write(self.log.toPlainText())
            self.set_status(f"Saved log to {path}")


# --------------- app bootstrap -----------------
def main():
    app = QApplication(sys.argv)
    loop = QEventLoop(app)
    asyncio.set_event_loop(loop)

    win = MainWindow()
    win.show()

    with loop:
        loop.run_forever()


if __name__ == "__main__":
    main()
