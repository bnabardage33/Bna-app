'use client';

import React from 'react';
import { ChantierWeatherCard } from '../weather/ChantierWeatherCard';
import type { Chantier } from '@/types/metier';

export interface WeatherCardProps {
  chantier?: Chantier | null;
  allChantiers?: Chantier[];
  onSelectChantier?: (id: string) => void;
  compact?: boolean;
}

export const WeatherCard: React.FC<WeatherCardProps> = (props) => {
  return <ChantierWeatherCard {...props} />;
};
