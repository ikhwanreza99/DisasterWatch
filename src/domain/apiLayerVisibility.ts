import type { CategoryFilter } from '../types';

/** Shared by desktop/mobile and Google/Leaflet renderers. */
export function apiLayerVisibility(category: CategoryFilter, enabled = true) {
  const all = enabled && category === 'all';
  const geology = enabled && category === 'earthquake';
  return {
    showFirms: all || (enabled && category === 'fire'),
    showWeather: all || (enabled && category === 'flood'),
    showBmkgWeather: all,
    showBmkg: all || geology,
    showMagma: all || geology,
    showAsh: all || geology,
  };
}
