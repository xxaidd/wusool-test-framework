import type { SessionDownloader } from "../application/sessionDownloader";

/** Build a download-safe filename from a session start timestamp. */
export function sessionFileName(startedAt?: string): string {
  const base = startedAt || new Date().toISOString();
  return `wusool-session-${base.slice(0, 19).replace(/[:T]/g, "-")}.json`;
}

/** Downloads a string payload as a file using browser APIs. */
export const browserSessionDownloader: SessionDownloader = {
  download(input) {
    const blob = new Blob([input.content], { type: input.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = sessionFileName(input.startedAt);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
