import { app } from 'electron';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import type { SessionHistoryEntry, CLIPreset } from '../../shared/types/cli';

// ---------------------------------------------------------------------------
// SessionHistoryService
//
// Persists CLI session history and quick-launch presets to JSON files in the
// Electron userData directory. History is a ring buffer capped at MAX_ENTRIES.
// ---------------------------------------------------------------------------

const MAX_ENTRIES = 50;
const HISTORY_FILE = 'cli-sessions.json';
const PRESETS_FILE = 'cli-presets.json';

export class SessionHistoryService {
  private historyPath: string;
  private presetsPath: string;
  private entries: SessionHistoryEntry[] = [];
  private presets: CLIPreset[] = [];
  private loaded = false;

  constructor() {
    const dataDir = app.getPath('userData');
    this.historyPath = join(dataDir, HISTORY_FILE);
    this.presetsPath = join(dataDir, PRESETS_FILE);
  }

  // -------------------------------------------------------------------------
  // History
  // -------------------------------------------------------------------------

  /** Add a session entry to the ring buffer and persist. */
  addEntry(entry: SessionHistoryEntry): void {
    this.ensureLoaded();
    this.entries.push(entry);
    // Ring buffer: keep only the newest MAX_ENTRIES
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(-MAX_ENTRIES);
    }
    this.saveHistory();
  }

  /** Return the last `limit` entries (newest first). */
  list(limit?: number): SessionHistoryEntry[] {
    this.ensureLoaded();
    const count = limit ?? MAX_ENTRIES;
    // Return newest first
    return [...this.entries].reverse().slice(0, count);
  }

  /** Clear all history entries and persist. */
  clear(): void {
    this.entries = [];
    this.saveHistory();
  }

  // -------------------------------------------------------------------------
  // Presets
  // -------------------------------------------------------------------------

  /** Load presets from disk. */
  loadPresets(): CLIPreset[] {
    this.ensurePresetsLoaded();
    return this.presets;
  }

  /** Save presets to disk. */
  savePresets(presets: CLIPreset[]): void {
    this.presets = presets;
    this.persistPresets();
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      if (existsSync(this.historyPath)) {
        const raw = readFileSync(this.historyPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.entries = parsed;
        }
      }
    } catch {
      this.entries = [];
    }
  }

  private saveHistory(): void {
    try {
      const dir = join(this.historyPath, '..');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(this.historyPath, JSON.stringify(this.entries, null, 2));
    } catch {
      // Silently ignore persistence errors
    }
  }

  private ensurePresetsLoaded(): void {
    if (this.presets.length > 0) return;
    try {
      if (existsSync(this.presetsPath)) {
        const raw = readFileSync(this.presetsPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.presets = parsed;
        }
      }
    } catch {
      this.presets = [];
    }
  }

  private persistPresets(): void {
    try {
      const dir = join(this.presetsPath, '..');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(this.presetsPath, JSON.stringify(this.presets, null, 2));
    } catch {
      // Silently ignore persistence errors
    }
  }
}
