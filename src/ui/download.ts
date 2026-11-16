/** Trigger a browser download of text content. */
export function downloadText(filename: string, content: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function timestampForFile(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
