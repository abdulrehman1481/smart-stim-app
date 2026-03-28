import React, { createContext, useContext } from 'react';
import { useSensorPipeline } from './useSensorPipeline';

export type SensorPipelineValue = ReturnType<typeof useSensorPipeline>;

const SensorPipelineContext = createContext<SensorPipelineValue | null>(null);

export const SensorPipelineProvider = ({ children }: { children: React.ReactNode }) => {
  const pipeline = useSensorPipeline();
  return (
    <SensorPipelineContext.Provider value={pipeline}>
      {children}
    </SensorPipelineContext.Provider>
  );
};

export const useSharedSensorPipeline = (): SensorPipelineValue => {
  const ctx = useContext(SensorPipelineContext);
  if (!ctx) {
    throw new Error('useSharedSensorPipeline must be used inside SensorPipelineProvider');
  }
  return ctx;
};
