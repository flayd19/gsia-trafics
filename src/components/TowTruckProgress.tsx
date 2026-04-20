import React, { useState, useEffect } from 'react';
import { CircularProgress } from '@/components/ui/circular-progress';

interface TowTruckProgressProps {
  startTime: number;
  duration: number; // in seconds
}

export const TowTruckProgress: React.FC<TowTruckProgressProps> = ({
  startTime,
  duration
}) => {
  const [progress, setProgress] = useState<number>(0);
  const [remainingTime, setRemainingTime] = useState<number>(duration);

  useEffect(() => {
    const updateProgress = () => {
      const now = Date.now();
      const elapsed = (now - startTime) / 1000; // seconds
      const progressPercent = Math.min((elapsed / duration) * 100, 100);
      const remaining = Math.max(0, duration - elapsed);
      
      setProgress(progressPercent);
      setRemainingTime(remaining);
    };

    updateProgress();
    const interval = setInterval(updateProgress, 100);
    return () => clearInterval(interval);
  }, [startTime, duration]);

  return (
    <div className="text-center py-8 space-y-4">
      <div className="relative w-20 h-20 mx-auto">
        <CircularProgress 
          progress={progress} 
          size={80}
          strokeWidth={6}
          color="hsl(var(--warning))"
        />
        <div className="absolute inset-2 rounded-full bg-muted flex items-center justify-center overflow-hidden">
          <img 
            src="/lovable-uploads/clodoaldo.guincho.png" 
            alt="SOS Guincho - Clodoaldo"
            className="w-full h-full object-cover rounded-full"
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <p className="text-sm text-center">
          Clodoaldo está buscando o veículo...
        </p>
        <div className="text-xs text-muted-foreground text-center">
          {Math.ceil(remainingTime)}s restantes
        </div>
      </div>
    </div>
  );
};