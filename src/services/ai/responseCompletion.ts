/** Reject transport truncation and visibly unfinished prose before displaying it as a final answer. */
export function assertCompletedGeneration(finishReason?: string): void {
  if (finishReason && finishReason !== 'STOP') throw new Error('Model response did not complete.');
}
export function isCompleteAssistantAnswer(text: string): boolean {
  const clean = text.trim();
  return clean.length > 10 && !/[:：,;\-–—…]$/.test(clean) && !/\.\.\.$/.test(clean);
}
/** Limits UI waiting even when a transport never resolves. Late results cannot update caller state. */
export async function withResponseDeadline<T>(operation: Promise<T>, milliseconds = 30000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('AI response timeout.')), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}
