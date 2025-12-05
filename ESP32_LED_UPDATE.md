# ESP32 Code Update - LED Control

## Add These Commands to Your parseBLEParameters Function

Add these cases to your `parseBLEParameters()` function in your ESP32 code, right after the `RED` command:

```cpp
void parseBLEParameters(const char* input) {
    char buffer[128];
    char name[20];
    uint32_t value;
    char* token;
    char* colonPos;
    int ch = 1;

    strncpy(buffer, input, sizeof(buffer) - 1);
    buffer[sizeof(buffer) - 1] = '\0';
    token = strtok(buffer, ",");
    while (token != NULL) {
        colonPos = strchr(token, ':');
        if (colonPos != NULL) {
            int nameLen = colonPos - token;
            if (nameLen >= sizeof(name)) nameLen = sizeof(name) - 1;
            strncpy(name, token, nameLen);
            name[nameLen] = '\0';
            value = atoi(colonPos + 1);
            
            if (strcmp(name, "CH") == 0) {
                ch = value;
            }
            // ... your existing MODE, A0, A1, etc. cases ...
            
            // LED CONTROL COMMANDS (add these)
            else if (strcmp(name, "RED") == 0) {
                digitalWrite(PIN_LED_RED, value);
                Serial.printf("Red LED: %s\n", value ? "ON" : "OFF");
            }
            else if (strcmp(name, "GREEN") == 0) {
                digitalWrite(PIN_LED_GREEN, value);
                Serial.printf("Green LED: %s\n", value ? "ON" : "OFF");
            }
            else if (strcmp(name, "BLUE") == 0) {
                digitalWrite(PIN_LED_BLUE, value);
                Serial.printf("Blue LED: %s\n", value ? "ON" : "OFF");
            }
            else if (strcmp(name, "ONBOARD") == 0) {
                digitalWrite(PIN_LED_ONBOARD, value);
                Serial.printf("Onboard LED: %s\n", value ? "ON" : "OFF");
            }
            else if (strcmp(name, "RESET") == 0) {
                if (value) {
                    Serial.println("Resetting ESP32...");
                    delay(100);
                    ESP.restart();
                }
            }
            // ... rest of your existing code ...
        }
        token = strtok(NULL, ",");
    }
    // ... rest of function ...
}
```

## Commands the App Now Sends

The app sends these commands when you tap the LED buttons:

| Button | Command | ESP32 Action |
|--------|---------|--------------|
| 🔴 Red | `RED:1` or `RED:0` | Turn red LED on/off |
| 🟢 Green | `GREEN:1` or `GREEN:0` | Turn green LED on/off |
| 🔵 Blue | `BLUE:1` or `BLUE:0` | Turn blue LED on/off |
| 💡 Board | `ONBOARD:1` or `ONBOARD:0` | Turn onboard LED on/off |
| 🔄 Reset | `RESET:1` | Restart ESP32 |

## What Changed in Your Code

### Before (only RED was handled):
```cpp
else if (strcmp(name, "RED") == 0) {
    digitalWrite(PIN_LED_RED, value);
}
```

### After (all LEDs handled):
```cpp
else if (strcmp(name, "RED") == 0) {
    digitalWrite(PIN_LED_RED, value);
    Serial.printf("Red LED: %s\n", value ? "ON" : "OFF");
}
else if (strcmp(name, "GREEN") == 0) {
    digitalWrite(PIN_LED_GREEN, value);
    Serial.printf("Green LED: %s\n", value ? "ON" : "OFF");
}
else if (strcmp(name, "BLUE") == 0) {
    digitalWrite(PIN_LED_BLUE, value);
    Serial.printf("Blue LED: %s\n", value ? "ON" : "OFF");
}
else if (strcmp(name, "ONBOARD") == 0) {
    digitalWrite(PIN_LED_ONBOARD, value);
    Serial.printf("Onboard LED: %s\n", value ? "ON" : "OFF");
}
else if (strcmp(name, "RESET") == 0) {
    if (value) {
        Serial.println("Resetting ESP32...");
        delay(100);
        ESP.restart();
    }
}
```

## App UI Updates

The Console tab now shows:

```
┌─────────────────────────────────┐
│       ESP32 Control             │
├─────────────────────────────────┤
│  🔴 Red      🟢 Green           │
│   OFF         OFF               │
│                                 │
│  🔵 Blue     💡 Board           │
│   OFF         OFF               │
│                                 │
│  🔄 Reset ESP32                 │
└─────────────────────────────────┘
```

## How to Test

### 1. Update ESP32 Code
- Add the GREEN, BLUE, ONBOARD, and RESET handlers to `parseBLEParameters()`
- Upload to ESP32

### 2. Connect from App
```powershell
npm run android
```

### 3. Test Each LED
1. Connect to ESP32 (Devices tab)
2. Go to Console tab
3. Scroll down to "ESP32 Control" section
4. Tap each LED button
5. Watch LEDs turn on/off on your ESP32 board

### 4. Check Serial Monitor
You should see:
```
Red LED: ON
Red LED: OFF
Green LED: ON
Blue LED: ON
Onboard LED: ON
Resetting ESP32...
```

## LED Button Colors

The app buttons change color when active:
- 🔴 **Red button**: Dark red → Bright red when ON
- 🟢 **Green button**: Dark green → Bright green when ON
- 🔵 **Blue button**: Dark blue → Bright blue when ON
- 💡 **Board button**: Dark gray → Green when ON
- 🔄 **Reset button**: Always red (destructive action)

## Pin Mappings (From Your Code)

```cpp
#define PIN_LED_RED      18  // GPIO 18
#define PIN_LED_GREEN    25  // GPIO 25
#define PIN_LED_BLUE     26  // GPIO 26
#define PIN_LED_ONBOARD   2  // GPIO 2
```

## Complete Updated Function

Here's the complete updated `parseBLEParameters()` with LED controls:

```cpp
void parseBLEParameters(const char* input) {
    char buffer[128];
    char name[20];
    uint32_t value;
    char* token;
    char* colonPos;
    int ch = 1;

    strncpy(buffer, input, sizeof(buffer) - 1);
    buffer[sizeof(buffer) - 1] = '\0';
    token = strtok(buffer, ",");
    
    while (token != NULL) {
        colonPos = strchr(token, ':');
        if (colonPos != NULL) {
            int nameLen = colonPos - token;
            if (nameLen >= sizeof(name)) nameLen = sizeof(name) - 1;
            strncpy(name, token, nameLen);
            name[nameLen] = '\0';
            value = atoi(colonPos + 1);
            
            if (strcmp(name, "CH") == 0) {
                ch = value;
            }
            else if (strcmp(name, "MODE") == 0) {
                if (value > 6) value = 6;
                if (ch == 1) ch1_MODE = value;
                else if (ch == 2) ch2_MODE = value;
                if ((ch1_MODE) || (ch2_MODE)) outputEN = 1;
                else outputEN = 0;
            }
            else if (strcmp(name, "A0") == 0) {
                if (value < 1750) value = 1750;
                else if (value > 3300) value = 3300;
                if (ch == 1) ch1_A0 = value;
                else if (ch == 2) ch2_A0 = value;
            }
            else if (strcmp(name, "A1") == 0) {
                if (value < 1750) value = 1750;
                else if (value > 3300) value = 3300;
                if (ch == 1) ch1_A1 = value;
                else if (ch == 2) ch2_A1 = value;
            }
            else if (strcmp(name, "A2") == 0) {
                if (value < 1750) value = 1750;
                else if (value > 3300) value = 3300;
                if (ch == 1) ch1_A2 = value;
                else if (ch == 2) ch2_A2 = value;
            }
            else if (strcmp(name, "T1") == 0) {
                if (ch == 1) ch1_T1 = value / TIMESTEP;
                else if (ch == 2) ch2_T1 = value / TIMESTEP;
            }
            else if (strcmp(name, "T2") == 0) {
                if (ch == 1) ch1_T2 = value / TIMESTEP;
                else if (ch == 2) ch2_T2 = value / TIMESTEP;
            }
            else if (strcmp(name, "T3") == 0) {
                if (ch == 1) ch1_T3 = value / TIMESTEP;
                else if (ch == 2) ch2_T3 = value / TIMESTEP;
            }
            else if (strcmp(name, "T4") == 0) {
                if (ch == 1) ch1_T4 = value / TIMESTEP;
                else if (ch == 2) ch2_T4 = value / TIMESTEP;
            }
            else if (strcmp(name, "T5") == 0) {
                if (ch == 1) ch1_T5 = value / TIMESTEP;
                else if (ch == 2) ch2_T5 = value / TIMESTEP;
            }
            else if (strcmp(name, "T6") == 0) {
                if (ch == 1) ch1_T6 = value / TIMESTEP;
                else if (ch == 2) ch2_T6 = value / TIMESTEP;
            }
            else if (strcmp(name, "RP") == 0) {
                if (ch == 1) ch1_RP = value;
                else if (ch == 2) ch2_RP = value;
            }
            else if (strcmp(name, "GP") == 0) {
                if (ch == 1) ch1_GP = value / TIMESTEP;
                else if (ch == 2) ch2_GP = value / TIMESTEP;
            }
            else if (strcmp(name, "DUR") == 0) {
                durMint = value;
            }
            // === LED CONTROL COMMANDS ===
            else if (strcmp(name, "RED") == 0) {
                digitalWrite(PIN_LED_RED, value);
                Serial.printf("Red LED: %s\n", value ? "ON" : "OFF");
            }
            else if (strcmp(name, "GREEN") == 0) {
                digitalWrite(PIN_LED_GREEN, value);
                Serial.printf("Green LED: %s\n", value ? "ON" : "OFF");
            }
            else if (strcmp(name, "BLUE") == 0) {
                digitalWrite(PIN_LED_BLUE, value);
                Serial.printf("Blue LED: %s\n", value ? "ON" : "OFF");
            }
            else if (strcmp(name, "ONBOARD") == 0) {
                digitalWrite(PIN_LED_ONBOARD, value);
                Serial.printf("Onboard LED: %s\n", value ? "ON" : "OFF");
            }
            else if (strcmp(name, "RESET") == 0) {
                if (value) {
                    Serial.println("Resetting ESP32...");
                    delay(100);
                    ESP.restart();
                }
            }
        }
        token = strtok(NULL, ",");
    }
    
    if (ch1_MODE == SINE) generateSine(sineWave1, ch1_T1, ch1_A0, ch1_A1);
    if (ch2_MODE == SINE) generateSine(sineWave2, ch2_T1, ch2_A0, ch2_A1);
    if (ch == 1) intense = ((double)(ch1_A1 - ch1_A0) * 100) / (3300 - ch1_A0);
}
```

## Testing Checklist

- [ ] Upload updated ESP32 code
- [ ] Deploy app to Android device
- [ ] Connect to ESP32
- [ ] Test Red LED on/off
- [ ] Test Green LED on/off
- [ ] Test Blue LED on/off
- [ ] Test Onboard LED on/off
- [ ] Test Reset button (ESP32 should restart)
- [ ] Verify Serial Monitor shows correct messages

---

**Status:** Ready for testing
**Next:** Update ESP32 code and test LED controls
