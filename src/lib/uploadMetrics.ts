/**
 * Lightweight in-memory session metrics tracker for photo uploads.
 * Tracks compression savings, auto-match rates, and upload performance.
 * Client-side only — no DB writes.
 */

export interface UploadMetricEntry {
  originalBytes: number;
  compressedBytes: number;
  durationMs: number;
  matchResult: 'auto-matched' | 'suggested' | 'unmatched' | 'skipped';
}

export interface SessionStats {
  totalUploads: number;
  totalOriginalBytes: number;
  totalCompressedBytes: number;
  savedBytes: number;
  compressionRatio: number; // 0-1, e.g. 0.62 = "62% smaller"
  averageDurationMs: number;
  autoMatchCount: number;
  suggestedCount: number;
  unmatchedCount: number;
  autoMatchRate: number; // 0-1
}

class UploadMetricsTracker {
  private entries: UploadMetricEntry[] = [];

  /** Record a single upload's metrics */
  record(entry: UploadMetricEntry): void {
    this.entries.push(entry);
  }

  /** Get aggregated session stats */
  getSessionStats(): SessionStats {
    if (this.entries.length === 0) {
      return {
        totalUploads: 0,
        totalOriginalBytes: 0,
        totalCompressedBytes: 0,
        savedBytes: 0,
        compressionRatio: 0,
        averageDurationMs: 0,
        autoMatchCount: 0,
        suggestedCount: 0,
        unmatchedCount: 0,
        autoMatchRate: 0,
      };
    }

    const totalOriginalBytes = this.entries.reduce((sum, e) => sum + e.originalBytes, 0);
    const totalCompressedBytes = this.entries.reduce((sum, e) => sum + e.compressedBytes, 0);
    const totalDurationMs = this.entries.reduce((sum, e) => sum + e.durationMs, 0);
    const autoMatchCount = this.entries.filter(e => e.matchResult === 'auto-matched').length;
    const suggestedCount = this.entries.filter(e => e.matchResult === 'suggested').length;
    const unmatchedCount = this.entries.filter(e => e.matchResult === 'unmatched').length;
    const savedBytes = totalOriginalBytes - totalCompressedBytes;

    return {
      totalUploads: this.entries.length,
      totalOriginalBytes,
      totalCompressedBytes,
      savedBytes,
      compressionRatio: totalOriginalBytes > 0 ? 1 - (totalCompressedBytes / totalOriginalBytes) : 0,
      averageDurationMs: totalDurationMs / this.entries.length,
      autoMatchCount,
      suggestedCount,
      unmatchedCount,
      autoMatchRate: this.entries.length > 0 ? autoMatchCount / this.entries.length : 0,
    };
  }

  /** Check if there are any entries this session */
  hasEntries(): boolean {
    return this.entries.length > 0;
  }

  /** Reset session metrics */
  reset(): void {
    this.entries = [];
  }
}

// Singleton instance for the current session
export const uploadMetrics = new UploadMetricsTracker();

/** Format bytes to human-readable string */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
