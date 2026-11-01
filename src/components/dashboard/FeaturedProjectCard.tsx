'use client';

import React from 'react';
import type { Chantier } from '@/types/metier';
import { ChantierAvancementCard } from './ChantierAvancementCard';

interface FeaturedProjectCardProps {
  chantier?: Chantier | null;
  onOpenCockpit?: () => void;
  onNewChantier?: () => void;
  onAvancementUpdated?: (newGlobal: number) => void;
}

export const FeaturedProjectCard: React.FC<FeaturedProjectCardProps> = (props) => {
  return <ChantierAvancementCard {...props} />;
};
