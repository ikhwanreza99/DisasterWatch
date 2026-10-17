/** Process conversation controls before interpreting a message as a form answer. */
export function isReportCancellation(text: string): boolean {
  const value = text.toLowerCase().replace(/[’]/g, "'").trim();
  // An explicit refusal to cancel is not a cancellation request.
  if (/\b(jangan|tidak perlu|don't|do not)\s+(batal(?:kan)?|cancel|stop)\b/.test(value)) return false;
  return /^(?:batal(?:kan)?|cancel|stop|never\s*mind|forget it|tidak jadi|nggak jadi|gak jadi|ga jadi)[.!?]*$/.test(value)
    || /\b(?:tidak|nggak|gak|ga)\s+jadi\s+(?:buat\s+)?(?:melapor(?:kan)?|lapor(?:an)?|mengirim(?:kan)?|kirim)\b/.test(value)
    || /\b(?:batal(?:kan)?|hentikan)\s+(?:(?:buat|kirim|mengirim)\s+)?lapor(?:an)?(?:nya)?\b/.test(value)
    || /\b(?:tidak|nggak|gak)\s+(?:ingin|mau)\s+(?:melapor(?:kan)?|lapor)\b/.test(value)
    || /\b(?:cancel|stop)\s+(?:it|that)\b/.test(value)
    || /\b(?:cancel|stop|discard)\s+(?:(?:my|the|this|disaster|aid)\s+)*(?:report|reporting)\b/.test(value)
    || /\b(?:don't|do not|no longer)\s+(?:want to\s+)?(?:report|submit|send|continue reporting)\b/.test(value);
}
