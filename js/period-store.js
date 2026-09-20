/**
 * VPM Period Store  (v10)
 * Primary storage : VPMFileStore  → <root>/snapshots/monthly/{key}.json
 * Fallback        : localStorage  → vpm-snap-{year}-{MM}-{tierId}
 *
 * API is now fully async (all storage methods return Promises).
 * migrate() reads all existing localStorage snapshots and writes them as files.
 *
 * Key format: {YYYY}-{MM}-{tierId}  e.g. "2026-03-T1"
 */
const VPMPeriodStore = (function () {
    'use strict';

    const FS_SUBDIR    = 'monthly';
    const INDEX_KEY    = 'vpm-snap-index';
    const SNAP_PREFIX  = 'vpm-snap-';
    const LS_SKIP      = ['vpm-theme'];
    const LS_SKIP_PFX  = [SNAP_PREFIX];

    const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                         'July', 'August', 'September', 'October', 'November', 'December'];
    const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // ── Key helpers ──────────────────────────────────────────────────────────

    function _fileKey(year, month, tierId) {
        return `${year}-${String(month + 1).padStart(2, '0')}-${tierId}`;
    }

    function _lsKey(year, month, tierId) {
        return `${SNAP_PREFIX}${_fileKey(year, month, tierId)}`;
    }

    // ── Routing helper ────────────────────────────────────────────────────────

    function _useFS() {
        return typeof VPMFileStore !== 'undefined' && VPMFileStore.isReady();
    }

    // ── localStorage index helpers (fallback only) ────────────────────────────

    function _readIndex() {
        try {
            const raw = localStorage.getItem(INDEX_KEY);
            if (raw) {
                const arr = JSON.parse(raw);
                if (Array.isArray(arr)) return arr;
            }
        } catch (e) { /* ignore */ }
        return [];
    }

    function _writeIndex(arr) {
        localStorage.setItem(INDEX_KEY, JSON.stringify(arr));
    }

    // ── localStorage capture / restore ───────────────────────────────────────

    function captureLocalStorage() {
        const captured = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith('vpm-')) continue;
            if (LS_SKIP.includes(key)) continue;
            if (LS_SKIP_PFX.some(p => key.startsWith(p))) continue;
            captured[key] = localStorage.getItem(key);
        }
        return captured;
    }

    function restoreLocalStorage(captured) {
        if (!captured || typeof captured !== 'object') return;
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith('vpm-')) continue;
            if (LS_SKIP.includes(key)) continue;
            if (LS_SKIP_PFX.some(p => key.startsWith(p))) continue;
            toRemove.push(key);
        }
        toRemove.forEach(k => localStorage.removeItem(k));
        Object.entries(captured).forEach(([k, v]) => {
            try { localStorage.setItem(k, v); } catch (e) { /* quota */ }
        });
    }

    // ── Migration ─────────────────────────────────────────────────────────────

    /**
     * Copy all existing localStorage monthly snapshots to file storage.
     * Safe to call multiple times. Returns { ok, migrated, skipped }.
     */
    async function migrate() {
        if (!_useFS()) return { ok: false, reason: 'fs not ready' };
        const flagKey = 'vpm-monthly-snap-migrated';
        if (localStorage.getItem(flagKey)) return { ok: true, skipped: true };

        const idx = _readIndex();
        let migrated = 0;
        for (const meta of idx) {
            const raw = localStorage.getItem(meta.key);
            if (!raw) continue;
            try {
                const snap    = JSON.parse(raw);
                const fileKey = _fileKey(meta.year, meta.month, meta.tierId);
                await VPMFileStore.writeJSON(FS_SUBDIR, fileKey, snap);
                migrated++;
            } catch (e) {
                console.warn('[PeriodStore] migrate: failed for', meta.key, e);
            }
        }
        localStorage.setItem(flagKey, '1');
        console.log('[PeriodStore] Migration complete:', migrated, 'monthly snaps written to files');
        return { ok: true, migrated };
    }

    // ── Public API (all async) ────────────────────────────────────────────────

    /**
     * Save a full snapshot: parsed data + localStorage state.
     */
    async function save(year, month, tierId, tierLabel, data) {
        const snap = {
            savedAt:              new Date().toISOString(),
            year, month, tierId, tierLabel,
            data,
            localStorageSnapshot: captureLocalStorage()
        };

        if (_useFS()) {
            try {
                const fileKey = _fileKey(year, month, tierId);
                await VPMFileStore.writeJSON(FS_SUBDIR, fileKey, snap);
                return { ok: true, storage: 'file' };
            } catch (e) {
                console.warn('[PeriodStore] File write failed, falling back to localStorage:', e);
            }
        }

        // localStorage fallback
        const lsKey = _lsKey(year, month, tierId);
        try {
            localStorage.setItem(lsKey, JSON.stringify(snap));
        } catch (e) {
            if (e.name === 'QuotaExceededError') return { ok: false, reason: 'quota' };
            return { ok: false, reason: e.message };
        }
        const idx      = _readIndex();
        const existing = idx.findIndex(x => x.key === lsKey);
        const meta     = { key: lsKey, year, month, tierId, tierLabel, savedAt: snap.savedAt };
        if (existing >= 0) idx[existing] = meta;
        else               idx.push(meta);
        _writeIndex(idx);
        return { ok: true, storage: 'localStorage' };
    }

    /**
     * List saved snapshots for a tier, newest first.
     */
    async function list(tierId) {
        if (_useFS()) {
            const files = await VPMFileStore.listFiles(FS_SUBDIR);
            const suffix = '-' + tierId;
            const metas  = [];
            for (const f of files.filter(f => f.endsWith(suffix))) {
                const snap = await VPMFileStore.readJSON(FS_SUBDIR, f);
                if (!snap) continue;
                metas.push({
                    key:      f,
                    year:     snap.year,
                    month:    snap.month,
                    tierId:   snap.tierId,
                    tierLabel: snap.tierLabel,
                    savedAt:  snap.savedAt
                });
            }
            return metas.sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);
        }
        return _readIndex()
            .filter(m => m.tierId === tierId)
            .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);
    }

    /**
     * List all snapshots across all tiers, newest first.
     */
    async function listAll() {
        if (_useFS()) {
            const files = await VPMFileStore.listFiles(FS_SUBDIR);
            const metas = [];
            for (const f of files) {
                const snap = await VPMFileStore.readJSON(FS_SUBDIR, f);
                if (!snap) continue;
                metas.push({ key: f, year: snap.year, month: snap.month,
                             tierId: snap.tierId, tierLabel: snap.tierLabel, savedAt: snap.savedAt });
            }
            return metas.sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);
        }
        return _readIndex()
            .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);
    }

    /**
     * Load a snapshot object (includes .data and .localStorageSnapshot).
     */
    async function load(year, month, tierId) {
        if (_useFS()) {
            return VPMFileStore.readJSON(FS_SUBDIR, _fileKey(year, month, tierId));
        }
        try {
            const raw = localStorage.getItem(_lsKey(year, month, tierId));
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) { return null; }
    }

    /**
     * Check whether a snapshot exists for the given period + tier.
     */
    async function exists(year, month, tierId) {
        if (_useFS()) {
            const snap = await VPMFileStore.readJSON(FS_SUBDIR, _fileKey(year, month, tierId));
            return snap !== null;
        }
        return _readIndex().some(m => m.key === _lsKey(year, month, tierId));
    }

    /**
     * Delete a snapshot.
     */
    async function remove(year, month, tierId) {
        if (_useFS()) {
            await VPMFileStore.deleteFile(FS_SUBDIR, _fileKey(year, month, tierId));
            return;
        }
        const key = _lsKey(year, month, tierId);
        localStorage.removeItem(key);
        _writeIndex(_readIndex().filter(m => m.key !== key));
    }

    /**
     * Restore a snapshot's localStorage state then reload the page.
     */
    function applyAndReload(snap) {
        if (!snap) return;
        restoreLocalStorage(snap.localStorageSnapshot || {});
        try {
            sessionStorage.setItem('vpm-restore-data',  JSON.stringify(snap.data));
            sessionStorage.setItem('vpm-restore-label', formatPeriodFull(snap.year, snap.month));
            sessionStorage.setItem('vpm-restore-tier',  snap.tierLabel || '');
        } catch (e) { /* sessionStorage quota — still reload */ }
        location.reload();
    }

    /**
     * Check and consume a pending restore from sessionStorage.
     * Returns { data, label, tier } or null. Called once during app init.
     */
    function consumePendingRestore() {
        const raw   = sessionStorage.getItem('vpm-restore-data');
        const label = sessionStorage.getItem('vpm-restore-label');
        const tier  = sessionStorage.getItem('vpm-restore-tier');
        if (!raw) return null;
        sessionStorage.removeItem('vpm-restore-data');
        sessionStorage.removeItem('vpm-restore-label');
        sessionStorage.removeItem('vpm-restore-tier');
        try {
            return { data: JSON.parse(raw), label: label || 'Snapshot', tier: tier || '' };
        } catch (e) { return null; }
    }

    /**
     * Stash data in sessionStorage for pickup after page reload.
     * Used by daily snapshot restore.
     */
    function setPendingRestore(data, label, tierLabel) {
        try {
            sessionStorage.setItem('vpm-restore-data',  JSON.stringify(data));
            sessionStorage.setItem('vpm-restore-label', label || 'Daily snapshot');
            sessionStorage.setItem('vpm-restore-tier',  tierLabel || '');
        } catch (e) { /* sessionStorage quota */ }
    }

    function formatPeriodShort(year, month) { return `${MONTH_SHORT[month]} ${year}`; }
    function formatPeriodFull(year, month)  { return `${MONTH_NAMES[month]} ${year}`; }

    return {
        save, list, listAll, load, remove, exists,
        applyAndReload, consumePendingRestore, setPendingRestore,
        captureLocalStorage, restoreLocalStorage,
        formatPeriodShort, formatPeriodFull,
        migrate,
        MONTH_NAMES, MONTH_SHORT
    };
})();
