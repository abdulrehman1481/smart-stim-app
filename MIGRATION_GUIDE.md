# Migration Guide - New Database Structure

## 🔄 Quick Migration Guide for Existing Components

This guide helps you update your sensor components to use the new database structure.

## 📋 Migration Checklist

- [ ] Update imports in all sensor components
- [ ] Replace old `saveSensorReading()` calls with specific functions
- [ ] Add session management to your workflow
- [ ] Update device registration
- [ ] Test each sensor component

## 🔧 Component-by-Component Migration

### 1. ADS1113Monitor.tsx (EDA/GSR Sensor)

**Before:**
```typescript
import { saveSensorReading } from '../firebase/dataLogger';

await saveSensorReading(user.uid, {
  sensorType: 'EDA',
  value: calculatedConductance,
  unit: 'μS',
  deviceName: connectedDevice?.name
});
```

**After:**
```typescript
import { saveEDAReading } from '../firebase/dataLogger';

await saveEDAReading(user.uid, {
  rawValue: rawADCValue,
  voltage: calculatedVoltage,
  resistance: calculatedResistance,
  conductance: calculatedConductance,
  stressLevel: determineStressLevel(calculatedConductance),
  arousalState: determineArousalState(calculatedConductance),
  deviceId: connectedDevice?.id,
  deviceName: connectedDevice?.name,
  sessionId: currentSessionId // Add if using sessions
});

// Helper function to determine stress level
const determineStressLevel = (conductance: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' => {
  if (conductance < 2) return 'LOW';
  if (conductance < 5) return 'MEDIUM';
  if (conductance < 10) return 'HIGH';
  return 'VERY_HIGH';
};
```

### 2. TemperatureMonitor.tsx (AS6221 Sensor)

**Before:**
```typescript
await saveSensorReading(user.uid, {
  sensorType: 'TEMPERATURE',
  value: temp,
  unit: '°C',
  deviceName: connectedDevice?.name
});
```

**After:**
```typescript
import { saveTemperatureReading } from '../firebase/dataLogger';

await saveTemperatureReading(user.uid, {
  temperature: temp,
  temperatureFahrenheit: (temp * 9/5) + 32,
  bodyLocation: 'WRIST', // Adjust based on your device
  skinContact: temp > 30 && temp < 42, // Basic check
  deviceId: connectedDevice?.id,
  deviceName: connectedDevice?.name,
  sessionId: currentSessionId
});
```

### 3. MAX30101Monitor.tsx (PPG/Heart Rate Sensor)

**Before:**
```typescript
// Old way - separate calls for each value
await saveSensorReading(user.uid, {
  sensorType: 'PPG_IR',
  value: ppgData.ir,
  deviceName: connectedDevice?.name
});
```

**After:**
```typescript
import { 
  savePPGReading, 
  saveHeartRateReading,
  saveSpO2Reading 
} from '../firebase/dataLogger';

// Save raw PPG data
await savePPGReading(user.uid, {
  channel: 'IR',
  rawValue: ppgData.ir,
  signalQuality: calculateSignalQuality(ppgData.ir),
  skinContact: ppgData.ir > 10000, // Threshold for contact
  deviceId: connectedDevice?.id,
  deviceName: connectedDevice?.name,
  sessionId: currentSessionId
});

// Save RED channel
await savePPGReading(user.uid, {
  channel: 'RED',
  rawValue: ppgData.red,
  signalQuality: calculateSignalQuality(ppgData.red),
  skinContact: ppgData.red > 10000,
  deviceId: connectedDevice?.id,
  sessionId: currentSessionId
});

// Save calculated heart rate
if (heartRate > 0) {
  await saveHeartRateReading(user.uid, {
    heartRate: heartRate,
    confidence: calculateConfidence(ppgData),
    derivedFrom: 'PPG_IR',
    deviceId: connectedDevice?.id,
    sessionId: currentSessionId
  });
}

// Save SpO2 if calculated
if (spo2 > 0) {
  await saveSpO2Reading(user.uid, {
    spO2: spo2,
    redValue: ppgData.red,
    irValue: ppgData.ir,
    signalStrength: calculateSignalQuality(ppgData.ir),
    deviceId: connectedDevice?.id,
    sessionId: currentSessionId
  });
}
```

### 4. LSM6DSOMonitor.tsx (IMU Sensor)

**Before:**
```typescript
// Old way - saving as generic sensor reading
await saveSensorReading(user.uid, {
  sensorType: 'ACCELEROMETER',
  value: imuData.accel.x,
  // Only could save one axis at a time
});
```

**After:**
```typescript
import { 
  saveIMUReading,
  saveAccelerometerReading,
  saveGyroscopeReading 
} from '../firebase/dataLogger';

// Option 1: Save combined IMU reading (recommended for analysis)
await saveIMUReading(user.uid, {
  accelerometer: {
    x: imuData.accel.x,
    y: imuData.accel.y,
    z: imuData.accel.z,
    magnitude: Math.sqrt(
      imuData.accel.x ** 2 + 
      imuData.accel.y ** 2 + 
      imuData.accel.z ** 2
    )
  },
  gyroscope: {
    x: imuData.gyro.x,
    y: imuData.gyro.y,
    z: imuData.gyro.z,
    magnitude: Math.sqrt(
      imuData.gyro.x ** 2 + 
      imuData.gyro.y ** 2 + 
      imuData.gyro.z ** 2
    )
  },
  activity: detectActivity(imuData), // Add activity detection
  deviceId: connectedDevice?.id,
  sessionId: currentSessionId
});

// Option 2: Save separately (if needed for specific analysis)
await saveAccelerometerReading(user.uid, {
  x: imuData.accel.x,
  y: imuData.accel.y,
  z: imuData.accel.z,
  deviceId: connectedDevice?.id,
  sessionId: currentSessionId
});

await saveGyroscopeReading(user.uid, {
  x: imuData.gyro.x,
  y: imuData.gyro.y,
  z: imuData.gyro.z,
  deviceId: connectedDevice?.id,
  sessionId: currentSessionId
});

// Helper function for activity detection
const detectActivity = (imuData: IMUData): 'STILL' | 'WALKING' | 'RUNNING' | 'MOVING' => {
  const accelMag = Math.sqrt(
    imuData.accel.x ** 2 + 
    imuData.accel.y ** 2 + 
    imuData.accel.z ** 2
  );
  
  if (accelMag < 1050) return 'STILL';
  if (accelMag < 1200) return 'WALKING';
  if (accelMag < 1500) return 'RUNNING';
  return 'MOVING';
};
```

### 5. W25N01Monitor.tsx (Flash Logs)

**Before:**
```typescript
import { saveSensorLog } from '../firebase/dataLogger';

await saveSensorLog(user.uid, {
  module: 'w25n01_demo',
  message: logMessage,
  logLevel: 'INFO'
});
```

**After:**
```typescript
import { saveRawSensorLog } from '../firebase/dataLogger';

await saveRawSensorLog(user.uid, {
  module: 'w25n01_demo',
  logLevel: 'INFO',
  message: logMessage,
  rawData: originalLogLine, // Store original log line
  deviceId: connectedDevice?.id,
  sessionId: currentSessionId
});
```

## 🎯 Adding Session Management

### In Your Main Screen Component:

```typescript
import { startSession, endSession } from '../firebase/dataLogger';
import { SensorType } from '../firebase/sensorTypes';
import { useState } from 'react';

export const MainSensorScreen = () => {
  const { user } = useAuth();
  const { connectedDevice } = useBLE();
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  // Start recording
  const handleStartRecording = async () => {
    try {
      const sessionId = await startSession(user.uid, {
        sessionName: `Session ${new Date().toLocaleString()}`,
        deviceId: connectedDevice?.id,
        deviceName: connectedDevice?.name,
        activeSensors: [
          SensorType.EDA,
          SensorType.TEMPERATURE,
          SensorType.HEART_RATE,
          SensorType.ACCELEROMETER,
          SensorType.GYROSCOPE
        ],
        activity: 'Monitoring',
        tags: ['automated']
      });
      
      setCurrentSessionId(sessionId);
      setIsRecording(true);
      console.log('[Session] Started:', sessionId);
    } catch (error) {
      console.error('[Session] Failed to start:', error);
    }
  };

  // Stop recording
  const handleStopRecording = async () => {
    if (!currentSessionId) return;
    
    try {
      await endSession(user.uid, currentSessionId, {
        qualityScore: 90, // Calculate based on data quality
        notes: 'Session completed successfully'
      });
      
      setIsRecording(false);
      setCurrentSessionId(null);
      console.log('[Session] Ended:', currentSessionId);
    } catch (error) {
      console.error('[Session] Failed to end:', error);
    }
  };

  // Pass currentSessionId to child components
  return (
    <View>
      <Button 
        title={isRecording ? "Stop Recording" : "Start Recording"}
        onPress={isRecording ? handleStopRecording : handleStartRecording}
      />
      
      <ADS1113Monitor sessionId={currentSessionId} />
      <TemperatureMonitor sessionId={currentSessionId} />
      <MAX30101Monitor sessionId={currentSessionId} />
      <LSM6DSOMonitor sessionId={currentSessionId} />
    </View>
  );
};
```

### Update Component Props:

```typescript
// In each monitor component
interface MonitorProps {
  sessionId?: string | null;
}

export const ADS1113Monitor: React.FC<MonitorProps> = ({ sessionId }) => {
  // Use sessionId when saving data
  await saveEDAReading(user.uid, {
    // ... other fields
    sessionId: sessionId || undefined
  });
};
```

## 📊 Adding Device Registration

### On Device Connection:

```typescript
import { saveDeviceInfo } from '../firebase/dataLogger';

// In your BLE connection handler
const handleDeviceConnected = async (device: Device) => {
  try {
    await saveDeviceInfo(user.uid, {
      deviceId: device.id,
      deviceName: device.name || 'Unknown Device',
      deviceType: 'NRF52840', // Or detect from device
      firmwareVersion: await getFirmwareVersion(device), // If available
      batteryLevel: await getBatteryLevel(device), // If available
      isActive: true
    });
    
    console.log('[Device] Registered:', device.name);
  } catch (error) {
    console.error('[Device] Failed to register:', error);
  }
};
```

## 🔄 Using Batch Operations for High-Frequency Data

If you're collecting data at high rates (>10 Hz), use batch operations:

```typescript
import { saveSensorBatch } from '../firebase/dataLogger';

// Accumulate readings
const [pendingReadings, setPendingReadings] = useState({
  accelerometer: [],
  gyroscope: [],
  heartRate: []
});

// Save batch every N readings or every X seconds
useEffect(() => {
  const interval = setInterval(async () => {
    if (pendingReadings.accelerometer.length > 0) {
      await saveSensorBatch(user.uid, {
        sessionId: currentSessionId,
        deviceId: connectedDevice?.id,
        ...pendingReadings
      });
      
      // Clear pending readings
      setPendingReadings({
        accelerometer: [],
        gyroscope: [],
        heartRate: []
      });
    }
  }, 5000); // Save every 5 seconds
  
  return () => clearInterval(interval);
}, [pendingReadings, currentSessionId]);
```

## ✅ Testing Your Migration

1. **Test each sensor individually**
   - Verify data appears in correct collection
   - Check all fields are populated
   - Confirm timestamps are correct

2. **Test session management**
   - Start/stop sessions
   - Verify sessionId in readings
   - Check session metadata

3. **Test device registration**
   - Connect device
   - Verify device document created
   - Check lastConnected updates

4. **Verify in Firebase Console**
   - Open Firebase Console
   - Navigate to Firestore Database
   - Verify data structure matches schema

## 🐛 Common Issues

### Issue: "Cannot find module 'sensorTypes'"
**Solution**: Update import path
```typescript
import { SensorType } from '../firebase/sensorTypes';
```

### Issue: TypeScript errors with new types
**Solution**: Import all required types
```typescript
import { 
  saveEDAReading,
  saveTemperatureReading,
  SensorType,
  DataQuality
} from '../firebase/dataLogger';
```

### Issue: Session not updating data counts
**Solution**: Ensure sessionId is passed when saving readings

### Issue: Backward compatibility problems
**Solution**: Old functions still work, but migrate gradually:
```typescript
// This still works
await saveSensorReading(user.uid, {
  sensorType: 'HEART_RATE',
  value: 75
});
```

## 📚 Additional Resources

- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Complete schema documentation
- [Firebase Firestore Docs](https://firebase.google.com/docs/firestore)
- [TypeScript Types Reference](./src/firebase/sensorTypes.ts)

---

**Need Help?** Check the examples in DATABASE_SCHEMA.md or review the dataLogger.ts implementation.
