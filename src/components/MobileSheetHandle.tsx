import { useState } from 'react';

export function MobileSheetHandle({ initiallyExpanded = false }: { initiallyExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  return (
    <button type="button" className="mobile-sheet-handle" data-expanded={expanded}
      aria-expanded={expanded} aria-label={expanded ? 'Kecilkan panel untuk melihat peta' : 'Perluas panel'}
      onClick={() => setExpanded(value => !value)}>
      <span aria-hidden="true" /><span>{expanded ? 'Kecilkan panel' : 'Perluas panel'}</span>
    </button>
  );
}
