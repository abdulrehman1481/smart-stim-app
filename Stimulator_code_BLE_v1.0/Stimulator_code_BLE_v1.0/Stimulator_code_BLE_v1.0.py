import sys
import re
import asyncio

from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QPushButton, QLabel, QTextEdit, QListWidget, QListWidgetItem,
    QMessageBox, QGroupBox, QFormLayout, QSpinBox, QGridLayout
)
from PySide6.QtCore import Qt

from qasync import QEventLoop, asyncSlot
from bleak import BleakScanner, BleakClient

DEVICE_NAME = "ESP_SIGNAL_CTRL"
SERVICE_UUID = "12345678-1234-1234-1234-1234567890AB"
RX_CHAR_UUID = "12345678-1234-1234-1234-1234567890AC"
TX_CHAR_UUID = "12345678-1234-1234-1234-1234567890AD"


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("ESP BLE Signal Controller")
        self.resize(1150, 700)

        self.client = None
        self.devices = {}
        self._rx_buf = ""

        self.build_ui()

    def build_ui(self):
        root = QWidget()
        self.setCentralWidget(root)
        main = QHBoxLayout(root)

        # ---------------- Left ----------------
        left = QVBoxLayout()

        self.device_list = QListWidget()
        self.scan_btn = QPushButton("Scan")
        self.connect_btn = QPushButton("Connect")
        self.disconnect_btn = QPushButton("Disconnect")
        self.status_lbl = QLabel("Status: Idle")

        left.addWidget(QLabel("Discovered BLE Devices"))
        left.addWidget(self.device_list)

        btn_row = QHBoxLayout()
        btn_row.addWidget(self.scan_btn)
        btn_row.addWidget(self.connect_btn)
        btn_row.addWidget(self.disconnect_btn)
        left.addLayout(btn_row)

        left.addWidget(self.status_lbl)

        main.addLayout(left, 3)

        # ---------------- Right ----------------
        right = QVBoxLayout()

        param_group = QGroupBox("Waveform Parameters")
        form = QFormLayout(param_group)

        self.offset_sb = QSpinBox()
        self.offset_sb.setRange(0, 4095)
        self.offset_sb.setValue(2505)

        self.phase1_sb = QSpinBox()
        self.phase1_sb.setRange(0, 4095)
        self.phase1_sb.setValue(3000)

        self.phase2_sb = QSpinBox()
        self.phase2_sb.setRange(0, 4095)
        self.phase2_sb.setValue(2010)

        self.tonpos_sb = QSpinBox()
        self.tonpos_sb.setRange(0, 100000)
        self.tonpos_sb.setValue(2)

        self.toff_sb = QSpinBox()
        self.toff_sb.setRange(0, 100000)
        self.toff_sb.setValue(1)

        self.tonneg_sb = QSpinBox()
        self.tonneg_sb.setRange(0, 100000)
        self.tonneg_sb.setValue(1)

        form.addRow("OFFSET", self.offset_sb)
        form.addRow("PHASE1", self.phase1_sb)
        form.addRow("PHASE2", self.phase2_sb)
        form.addRow("TONPOS", self.tonpos_sb)
        form.addRow("TOFF", self.toff_sb)
        form.addRow("TONNEG", self.tonneg_sb)

        action_group = QGroupBox("Controls")
        action_layout = QGridLayout(action_group)

        self.apply_btn = QPushButton("Apply Parameters")
        self.start_btn = QPushButton("Start")
        self.stop_btn = QPushButton("Stop")
        self.get_btn = QPushButton("Get Config")
        self.ping_btn = QPushButton("Ping")
        self.clear_btn = QPushButton("Clear Log")

        action_layout.addWidget(self.apply_btn, 0, 0)
        action_layout.addWidget(self.start_btn, 0, 1)
        action_layout.addWidget(self.stop_btn, 0, 2)
        action_layout.addWidget(self.get_btn, 1, 0)
        action_layout.addWidget(self.ping_btn, 1, 1)
        action_layout.addWidget(self.clear_btn, 1, 2)

        live_group = QGroupBox("Live Status")
        live_layout = QGridLayout(live_group)

        self.run_lbl = QLabel("RUN: -")
        self.dac_lbl = QLabel("DAC_CMD: -")
        self.ch1_lbl = QLabel("CH1: -")
        self.ch2_lbl = QLabel("CH2: -")
        self.ch3_lbl = QLabel("CH3: -")

        live_layout.addWidget(self.run_lbl, 0, 0)
        live_layout.addWidget(self.dac_lbl, 0, 1)
        live_layout.addWidget(self.ch1_lbl, 1, 0)
        live_layout.addWidget(self.ch2_lbl, 1, 1)
        live_layout.addWidget(self.ch3_lbl, 1, 2)

        self.log_box = QTextEdit()
        self.log_box.setReadOnly(True)

        right.addWidget(param_group)
        right.addWidget(action_group)
        right.addWidget(live_group)
        right.addWidget(QLabel("Logs"))
        right.addWidget(self.log_box)

        main.addLayout(right, 7)

        # Signals
        self.scan_btn.clicked.connect(self.on_scan)
        self.connect_btn.clicked.connect(self.on_connect)
        self.disconnect_btn.clicked.connect(self.on_disconnect)
        self.apply_btn.clicked.connect(self.on_apply)
        self.start_btn.clicked.connect(self.on_start)
        self.stop_btn.clicked.connect(self.on_stop)
        self.get_btn.clicked.connect(self.on_get)
        self.ping_btn.clicked.connect(self.on_ping)
        self.clear_btn.clicked.connect(self.log_box.clear)

    def log(self, text: str):
        self.log_box.append(text)
        self.log_box.ensureCursorVisible()

    def set_status(self, text: str):
        self.status_lbl.setText(f"Status: {text}")

    @asyncSlot()
    async def on_scan(self):
        self.set_status("Scanning...")
        self.log("Scanning for BLE devices...")
        self.device_list.clear()
        self.devices.clear()

        try:
            devices = await BleakScanner.discover(timeout=6.0)
        except Exception as e:
            self.set_status("Scan failed")
            QMessageBox.critical(self, "Scan failed", str(e))
            return

        if not devices:
            self.set_status("No devices found")
            self.log("No BLE devices found.")
            return

        for d in devices:
            name = d.name or "(Unknown)"
            addr = d.address
            self.devices[addr] = d

            item = QListWidgetItem(f"{name} | {addr}")
            item.setData(Qt.UserRole, addr)

            if name == DEVICE_NAME:
                item.setBackground(Qt.green)

            self.device_list.addItem(item)

        self.set_status(f"Found {len(devices)} device(s)")
        self.log(f"Found {len(devices)} device(s).")

    def get_selected_device(self):
        item = self.device_list.currentItem()
        if not item:
            return None
        addr = item.data(Qt.UserRole)
        return self.devices.get(addr)

    def on_notify(self, sender: int, data: bytearray):
        chunk = bytes(data).decode("utf-8", errors="replace")
        self._rx_buf += chunk
        self._rx_buf = self._rx_buf.replace("\r\n", "\n").replace("\r", "\n")

        while "\n" in self._rx_buf:
            line, self._rx_buf = self._rx_buf.split("\n", 1)
            line = line.strip()
            if not line:
                continue

            self.log(line)
            self.parse_line(line)

    def parse_line(self, line: str):
        if line.startswith("CFG "):
            pairs = dict(re.findall(r"([A-Z0-9_]+)=([^\s]+)", line))

            if "OFFSET" in pairs:
                self.offset_sb.setValue(int(float(pairs["OFFSET"])))
            if "PHASE1" in pairs:
                self.phase1_sb.setValue(int(float(pairs["PHASE1"])))
            if "PHASE2" in pairs:
                self.phase2_sb.setValue(int(float(pairs["PHASE2"])))
            if "TONPOS" in pairs:
                self.tonpos_sb.setValue(int(float(pairs["TONPOS"])))
            if "TOFF" in pairs:
                self.toff_sb.setValue(int(float(pairs["TOFF"])))
            if "TONNEG" in pairs:
                self.tonneg_sb.setValue(int(float(pairs["TONNEG"])))
            if "RUN" in pairs:
                self.run_lbl.setText(f"RUN: {pairs['RUN']}")

        elif line.startswith("DAC_CMD:"):
            dac_match = re.search(r"DAC_CMD:\s*([0-9]+)", line)
            ch1_match = re.search(r"CH1\(mV\):\s*([-0-9.]+)", line)
            ch2_match = re.search(r"CH2\(mV\):\s*([-0-9.]+)", line)
            ch3_match = re.search(r"CH3\(mV\):\s*([-0-9.]+)", line)

            if dac_match:
                self.dac_lbl.setText(f"DAC_CMD: {dac_match.group(1)}")
            if ch1_match:
                self.ch1_lbl.setText(f"CH1: {ch1_match.group(1)} mV")
            if ch2_match:
                self.ch2_lbl.setText(f"CH2: {ch2_match.group(1)} mV")
            if ch3_match:
                self.ch3_lbl.setText(f"CH3: {ch3_match.group(1)} mV")

    @asyncSlot()
    async def on_connect(self):
        if self.client:
            await self.on_disconnect()

        target = self.get_selected_device()
        if target is None:
            QMessageBox.warning(self, "No device selected", "Please select the ESP device first.")
            return

        self.set_status(f"Connecting to {target.address}...")
        self.log(f"Connecting to {target.name} | {target.address}")

        self.client = BleakClient(target, timeout=15.0)

        try:
            await self.client.connect()
            await self.client.start_notify(TX_CHAR_UUID, self.on_notify)
        except Exception as e:
            self.set_status("Connection failed")
            QMessageBox.critical(self, "Connection failed", str(e))
            self.client = None
            return

        self.set_status("Connected")
        self.log("Connected. Notifications enabled.")
        await self.send_cmd("GET")

    @asyncSlot()
    async def on_disconnect(self):
        if self.client:
            try:
                try:
                    await self.client.stop_notify(TX_CHAR_UUID)
                except Exception:
                    pass
                await self.client.disconnect()
            except Exception:
                pass
            self.client = None

        self._rx_buf = ""
        self.set_status("Disconnected")
        self.log("Disconnected.")

    async def send_cmd(self, cmd: str):
        if not self.client or not self.client.is_connected:
            QMessageBox.warning(self, "Not connected", "Connect to the ESP first.")
            return

        try:
            payload = (cmd + "\n").encode("utf-8")
            await self.client.write_gatt_char(RX_CHAR_UUID, payload, response=True)
            self.log(f"> {cmd}")
        except Exception as e:
            QMessageBox.critical(self, "Write failed", str(e))

    @asyncSlot()
    async def on_apply(self):
        cmds = [
            f"SET OFFSET {self.offset_sb.value()}",
            f"SET PHASE1 {self.phase1_sb.value()}",
            f"SET PHASE2 {self.phase2_sb.value()}",
            f"SET TONPOS {self.tonpos_sb.value()}",
            f"SET TOFF {self.toff_sb.value()}",
            f"SET TONNEG {self.tonneg_sb.value()}",
            "GET",
        ]

        for cmd in cmds:
            await self.send_cmd(cmd)
            await asyncio.sleep(0.05)

    @asyncSlot()
    async def on_start(self):
        await self.send_cmd("START")

    @asyncSlot()
    async def on_stop(self):
        await self.send_cmd("STOP")

    @asyncSlot()
    async def on_get(self):
        await self.send_cmd("GET")

    @asyncSlot()
    async def on_ping(self):
        await self.send_cmd("PING")


def main():
    if sys.platform.startswith("win"):
        try:
            asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        except Exception:
            pass

    app = QApplication(sys.argv)
    loop = QEventLoop(app)
    asyncio.set_event_loop(loop)

    win = MainWindow()
    win.show()

    with loop:
        loop.run_forever()


if __name__ == "__main__":
    main()