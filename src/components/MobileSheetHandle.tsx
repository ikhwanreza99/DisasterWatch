import { useState } from 'react';
import { useI18n } from '../i18n';

export function MobileSheetHandle({ initiallyExpanded = false }: { initiallyExpanded?: boolean }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(initiallyExpanded);
  return (
    <button type="button" className="mobile-sheet-handle" data-expanded={expanded}
      aria-expanded={expanded} aria-label={expanded ? t('Kecilkan panel untuk melihat peta') : t('Perluas panel')}
      onClick={() => setExpanded(value => !value)}>
      <span aria-hidden="true" /><span>{expanded ? t('Kecilkan panel') : t('Perluas panel')}</span>
    </button>
  );
}
