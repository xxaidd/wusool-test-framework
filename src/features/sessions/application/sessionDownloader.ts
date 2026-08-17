/** Writes a serialized session out to the user's machine. Implemented by infrastructure. */
export interface SessionDownloader {
  download(input: {
    startedAt?: string;
    content: string;
    mimeType: string;
  }): void;
}
