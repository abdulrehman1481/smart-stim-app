import { useState, useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { earbudService } from '../functionality/EarbudService'; // Adjust path if needed

export interface EarbudConfig {
  offset: number; phase1: number; phase2: number;
  tonpos: number; toff: number; tonneg: number;
}

export interface EarbudLiveStatus {
  run: string; dac_cmd: string;
  ch1: string; ch2: string; ch3: string;
}

export function useEarbud() {
  const [config, setConfig] = useState<EarbudConfig>({
    offset: 2505, phase1: 3000, phase2: 2010, tonpos: 2, toff: 1, tonneg: 1
  });
  const [liveStatus, setLiveStatus] = useState<EarbudLiveStatus>({
    run: '-', dac_cmd: '-', ch1: '-', ch2: '-', ch3: '-'
  });
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('EARBUD_DATA', (line: string) => {
      setLogs(prev => [...prev.slice(-19), line]); // Keep last 20 logs

      // Parse CFG lines
      if (line.startsWith('CFG ')) {
        const pairs = line.match(/([A-Z0-9_]+)=([^\s]+)/g);
        if (pairs) {
          setConfig(prev => {
            const next = { ...prev };
            pairs.forEach(pair => {
              const [key, val] = pair.split('=');
              const numVal = parseFloat(val);
              if (key === 'OFFSET') next.offset = numVal;
              if (key === 'PHASE1') next.phase1 = numVal;
              if (key === 'PHASE2') next.phase2 = numVal;
              if (key === 'TONPOS') next.tonpos = numVal;
              if (key === 'TOFF') next.toff = numVal;
              if (key === 'TONNEG') next.tonneg = numVal;
              if (key === 'RUN') setLiveStatus(s => ({ ...s, run: val }));
            });
            return next;
          });
        }
      }
      // Parse DAC_CMD lines
      else if (line.startsWith('DAC_CMD:')) {
        const dacMatch = line.match(/DAC_CMD:\s*([0-9]+)/);
        const ch1Match = line.match(/CH1\(mV\):\s*([-0-9.]+)/);
        const ch2Match = line.match(/CH2\(mV\):\s*([-0-9.]+)/);
        const ch3Match = line.match(/CH3\(mV\):\s*([-0-9.]+)/);

        setLiveStatus(prev => ({
          ...prev,
          dac_cmd: dacMatch ? dacMatch[1] : prev.dac_cmd,
          ch1: ch1Match ? ch1Match[1] : prev.ch1,
          ch2: ch2Match ? ch2Match[1] : prev.ch2,
          ch3: ch3Match ? ch3Match[1] : prev.ch3,
        }));
      }
    });

    return () => subscription.remove();
  }, []);

  return { config, liveStatus, logs };
}
