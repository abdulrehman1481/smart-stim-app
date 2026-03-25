````md
# ESP BLE Signal Controller - Quick Test Guide

## 1. Flash the ESP firmware
- Open the `.ino` firmware in Arduino IDE
- Select the correct ESP32 board and COM port
- Install required libraries if missing:
  - `Adafruit MCP4725`
  - `Adafruit INA219`
  - `ESP32 BLE` support
- Upload the firmware to the ESP

## 2. Run the GUI
Install Python packages:

```bash
py -m pip install pyside6 qasync bleak
````

Run the GUI:

```bash
py Stimulator_code_BLE_v1.0.py
```

## 3. Connect to the ESP

* Make sure Bluetooth is enabled on your PC
* Open the GUI
* Click **Scan**
* Select **ESP_SIGNAL_CTRL**
* Click **Connect**

## 4. Test basic commands

After connecting:

* Click **Ping**
  Expected reply: `PONG`

* Click **Get Config**
  Expected reply: `CFG OFFSET=... PHASE1=...`

* Click **Start**
  Output starts running

* Click **Stop**
  Output stops and DAC returns to offset

## 5. Test parameter update

Change any values in the GUI:

* `OFFSET`
* `PHASE1`
* `PHASE2`
* `TONPOS`
* `TOFF`
* `TONNEG`

Then click **Apply Parameters**

Expected result:

* GUI log shows `ACK ...`
* ESP updates waveform settings
* `Get Config` shows the new values

## 6. Check live logs

If working correctly, the log window should show lines like:

```text
DAC_CMD: 3000 | CH1(mV): 0.123 | CH2(mV): 0.125 | CH3(mV): 0.120
```

## 7. If connection fails

* Make sure the ESP is powered on
* Make sure the firmware uploaded successfully
* Close other apps using the ESP BLE connection
* Scan again and reconnect

## 8. If no data appears

* Open Arduino Serial Monitor at `115200`
* Confirm the ESP is printing logs
* Confirm BLE connected successfully in the GUI


```
