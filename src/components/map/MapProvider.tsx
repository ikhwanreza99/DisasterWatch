import React, { lazy, Suspense } from 'react';
import type { MapCanvas as MapCanvasComponent } from '../MapCanvas';
import { useI18n } from '../../i18n';
const MapCanvas = lazy(() => import('../MapCanvas').then(module => ({ default: module.MapCanvas })));
import type { DisasterCategory, DisasterIncident } from '../../types';

type Props = React.ComponentProps<typeof MapCanvasComponent> & {
  providerOverride?: 'leaflet' | 'google';
};

export const MapProvider: React.FC<Props> = (props) => {
  const { t } = useI18n();
  return <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-sm text-slate-500" role="status">{t('Memuat peta…')}</div>}><MapCanvas {...props} /></Suspense>;
};

export type { DisasterCategory, DisasterIncident };
