import React from 'react';
import { MapCanvas } from '../MapCanvas';
import type { DisasterCategory, DisasterIncident } from '../../types';

type Props = React.ComponentProps<typeof MapCanvas> & {
  providerOverride?: 'leaflet' | 'google';
};

export const MapProvider: React.FC<Props> = (props) => {
  return <MapCanvas {...props} />;
};

export type { DisasterCategory, DisasterIncident };
