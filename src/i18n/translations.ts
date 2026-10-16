/**
 * English translation dictionary.
 *
 * The application's source language is Indonesian, so Indonesian text doubles
 * as the translation key. Every key is the exact Indonesian string used in the
 * UI; the value is its English counterpart. Missing keys safely fall back to the
 * Indonesian source string (see `translate` in ./index.tsx).
 *
 * Translations are split into slices so independent areas of the app can be
 * maintained (and edited) without touching a single giant file.
 */
import common from './translations/common';
import header from './translations/header';
import shell from './translations/shell';
import detail from './translations/detail';
import map from './translations/map';
import modals from './translations/modals';
import views from './translations/views';
import weather from './translations/weather';
import status from './translations/status';
import admin from './translations/admin';
import services from './translations/services';

const slices: Array<Record<string, string>> = [
  common,
  header,
  shell,
  detail,
  map,
  modals,
  views,
  weather,
  status,
  admin,
  services,
];

export const en: Record<string, string> = Object.assign({}, ...slices);

export default en;
