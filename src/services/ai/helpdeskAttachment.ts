/** Shared validation for files from the map composer and helpdesk picker. */
export function attachmentError(file: Pick<File, 'size' | 'type'>): string | null {
  if (file.size > 5 * 1024 * 1024) return 'Ukuran dokumen maksimal 5 MB. Pilih file yang lebih kecil.';
  if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) return 'Gunakan foto JPG, PNG, WebP, atau dokumen PDF.';
  return null;
}
