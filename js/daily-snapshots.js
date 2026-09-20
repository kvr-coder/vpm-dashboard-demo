/**
 * VPM Daily Snapshots  (v4)
 * Primary storage : VPMFileStore  → <root>/snapshots/daily/{key}.json
 * Fallback        : IndexedDB     → vpm-daily-snapshots / snaps
 *
 * File storage is used automatically when VPMFileStore.isReady() is true.
 * migrate() reads existing IndexedDB entries and writes them as files.
 *
 * Key format: {YYYY-MM-DD}-{tierId}  (one per day per tier, same-day overwrites)
 */
const VPMDailySnapshots = (function () {
    'use strict';

    const FS_SUBDIR  = 'daily';
    const DB_NAME    = 'vpm-daily-snapshots';
    const STORE_NAME = 'snaps';
    const DB_VERSION = 1;

    // ── IndexedDB helpers (fallback + migration source) ──────────────────────

    function _openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const os = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                    os.createIndex('tierId',  'tierId',  { unique: false });
                    os.createIndex('savedAt', 'savedAt', { unique: false });
                }
            };
            req.onsuccess = e => resolve(e.target.result);
            req.onerror   = () => reject(req.error);
        });
    }

    async function _dbPut(snap) {
        let db;
        try {
            db = await _openDB();
            await new Promise((res, rej) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).put(snap);
                tx.oncomplete = res;
                tx.onerror    = () => rej(tx.error);
            });
            db.close();
            return { ok: true, key: snap.key };
        } catch (e) {
            if (db) db.close();
            console.warn('[DailySnap] IndexedDB save failed:', e);
            return { ok: false, reason: e.message };
        }
    }

    async function _dbGetAll() {
        let db;
        try {
            db = await _openDB();
            const all = await new Promise((res, rej) => {
                const tx  = db.transaction(STORE_NAME, 'readonly');
                const req = tx.objectStore(STORE_NAME).getAll();
                req.onsuccess = e => res(e.target.result);
                req.onerror   = () => rej(req.error);
            });
            db.close();
            return all;
        } catch (e) {
            if (db) db.close();
            return [];
        }
    }

    async function _dbGet(key) {
        let db;
        try {
            db = await _openDB();
            const snap = await new Promise((res, rej) => {
                const tx  = db.transaction(STORE_NAME, 'readonly');
                const req = tx.objectStore(STORE_NAME).get(key);
                req.onsuccess = e => res(e.target.result);
                req.onerror   = () => rej(req.error);
            });
            db.close();
            return snap || null;
        } catch (e) {
            if (db) db.close();
            return null;
        }
    }

    async function _dbDelete(key) {
        let db;
        try {
            db = await _openDB();
            await new Promise((res, rej) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).delete(key);
                tx.oncomplete = res;
                tx.onerror    = () => rej(tx.error);
            });
            db.close();
        } catch (e) { if (db) db.close(); }
    }

    // ── Routing helper ────────────────────────────────────────────────────────

    function _useFS() {
        return typeof VPMFileStore !== 'undefined' && VPMFileStore.isReady();
    }

    // ── Migration ─────────────────────────────────────────────────────────────

    /**
     * Copy all existing IndexedDB daily snapshots to file storage.
     * Safe to call multiple times — tracks completion via localStorage flag.
     * Returns { ok, migrated, skipped }.
     */
    async function migrate() {
        if (!_useFS()) return { ok: false, reason: 'fs not ready' };
        const flagKey = 'vpm-daily-snap-migrated';
        if (localStorage.getItem(flagKey)) return { ok: true, skipped: true };

        const all = await _dbGetAll();
        let migrated = 0;
        for (const snap of all) {
            try {
                await VPMFileStore.writeJSON(FS_SUBDIR, snap.key, snap);
                migrated++;
            } catch (e) {
                console.warn('[DailySnap] migrate: failed to write', snap.key, e);
            }
        }
        localStorage.setItem(flagKey, '1');
        console.log('[DailySnap] Migration complete:', migrated, 'snaps written to files');
        return { ok: true, migrated };
    }

    // ── Private ───────────────────────────────────────────────────────────────

    function _captureLSState() {
        const skip = ['vpm-theme'];
        const out  = {};
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k.startsWith('vpm-snap-')) continue;
            if (skip.includes(k)) continue;
            if (k.startsWith('vpm-')) out[k] = localStorage.getItem(k);
        }
        return out;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Save today's snapshot for a tier.
     * Prefers file storage; falls back to IndexedDB.
     */
    async function save(tierId, tierLabel, data) {
        const now     = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        const key     = `${dateStr}-${tierId}`;

        const snap = {
            key, dateStr, tierId, tierLabel,
            savedAt:  now.toISOString(),
            data,
            lsState:  _captureLSState()
        };

        if (_useFS()) {
            try {
                await VPMFileStore.writeJSON(FS_SUBDIR, key, snap);
                return { ok: true, key, storage: 'file' };
            } catch (e) {
                console.warn('[DailySnap] File write failed, falling back to IndexedDB:', e);
            }
        }
        return _dbPut(snap);
    }

    /**
     * List snapshots for a tier, newest first.
     */
    async function list(tierId) {
        if (_useFS()) {
            const files   = await VPMFileStore.listFiles(FS_SUBDIR);
            const suffix  = '-' + tierId;
            const matching = files.filter(f => f.endsWith(suffix));
            const snaps   = [];
            for (const f of matching) {
                const s = await VPMFileStore.readJSON(FS_SUBDIR, f);
                if (s) snaps.push(s);
            }
            return snaps.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
        }
        const all = await _dbGetAll();
        return all
            .filter(s => s.tierId === tierId)
            .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    }

    /**
     * List ALL snapshots across all tiers, newest first.
     */
    async function listAll() {
        if (_useFS()) {
            const files = await VPMFileStore.listFiles(FS_SUBDIR);
            const snaps = [];
            for (const f of files) {
                const s = await VPMFileStore.readJSON(FS_SUBDIR, f);
                if (s) snaps.push(s);
            }
            return snaps.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
        }
        const all = await _dbGetAll();
        return all.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    }

    /**
     * Load a specific snapshot by key.
     */
    async function load(key) {
        if (_useFS()) return VPMFileStore.readJSON(FS_SUBDIR, key);
        return _dbGet(key);
    }

    /**
     * Delete a snapshot by key.
     */
    async function remove(key) {
        if (_useFS()) {
            await VPMFileStore.deleteFile(FS_SUBDIR, key);
            return;
        }
        return _dbDelete(key);
    }

    /**
     * Storage info: count and size.
     */
    async function getStorageInfo() {
        if (_useFS()) {
            const files = await VPMFileStore.listFiles(FS_SUBDIR);
            return {
                count:   files.length,
                totalKB: null,
                totalMB: null,
                oldest:  files.length ? files[files.length - 1]?.slice(0, 10) : null,
                newest:  files.length ? files[0]?.slice(0, 10) : null,
                storage: 'file',
                folder:  VPMFileStore.folderName()
            };
        }
        const snaps = await listAll();
        let bytes = 0;
        for (const s of snaps) bytes += new Blob([JSON.stringify(s)]).size;
        return {
            count:   snaps.length,
            totalKB: (bytes / 1024).toFixed(1),
            totalMB: (bytes / 1024 / 1024).toFixed(2),
            oldest:  snaps[snaps.length - 1]?.dateStr || null,
            newest:  snaps[0]?.dateStr || null,
            storage: 'indexeddb'
        };
    }

    // ── Tree drill-down helpers ───────────────────────────────────────────────

    async function getYears(tierId) {
        const snaps = await list(tierId);
        return [...new Set(snaps.map(s => s.dateStr.slice(0, 4)))].sort().reverse();
    }

    async function getMonths(tierId, year) {
        const snaps = await list(tierId);
        return [...new Set(
            snaps.filter(s => s.dateStr.startsWith(year))
                 .map(s => s.dateStr.slice(0, 7))
        )].sort().reverse();
    }

    async function getDays(tierId, yearMonth) {
        const snaps = await list(tierId);
        return [...new Set(
            snaps.filter(s => s.dateStr.startsWith(yearMonth))
                 .map(s => s.dateStr)
        )].sort().reverse();
    }

    async function getSnapsForDay(tierId, dateStr) {
        const snaps = await list(tierId);
        return snaps.filter(s => s.dateStr === dateStr);
    }

    return {
        save, list, listAll, load, remove,
        getStorageInfo,
        getYears, getMonths, getDays, getSnapsForDay,
        migrate
    };
})();
