/**
 * VPM File Store  (v1)
 * Wraps the File System Access API so VPM can read/write real .json files
 * in a user-selected folder (e.g. E:\VPM\snapshots\).
 *
 * The directory handle is persisted in IndexedDB so the user only needs to
 * pick the folder once per browser profile. Works in Chrome 86+ and Edge 86+.
 *
 * Folder layout written by this module:
 *   <chosen-root>/snapshots/daily/    -- auto daily snaps
 *   <chosen-root>/snapshots/monthly/  -- manual period snaps
 */
const VPMFileStore = (function () {
    'use strict';

    const HANDLE_DB_NAME    = 'vpm-fs-handle';
    const HANDLE_DB_VERSION = 1;
    const HANDLE_STORE      = 'handles';
    const HANDLE_KEY        = 'root';

    let _rootHandle = null; // in-memory cache

    // ── IndexedDB handle persistence ─────────────────────────────────────────

    function _openHandleDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(HANDLE_DB_NAME, HANDLE_DB_VERSION);
            req.onupgradeneeded = e => e.target.result.createObjectStore(HANDLE_STORE);
            req.onsuccess = e => resolve(e.target.result);
            req.onerror   = () => reject(req.error);
        });
    }

    async function _persistHandle(handle) {
        const db = await _openHandleDB();
        await new Promise((res, rej) => {
            const tx = db.transaction(HANDLE_STORE, 'readwrite');
            tx.objectStore(HANDLE_STORE).put(handle, HANDLE_KEY);
            tx.oncomplete = res;
            tx.onerror    = () => rej(tx.error);
        });
        db.close();
    }

    async function _retrieveHandle() {
        let db;
        try {
            db = await _openHandleDB();
            const h = await new Promise((res, rej) => {
                const tx  = db.transaction(HANDLE_STORE, 'readonly');
                const req = tx.objectStore(HANDLE_STORE).get(HANDLE_KEY);
                req.onsuccess = e => res(e.target.result);
                req.onerror   = () => rej(req.error);
            });
            db.close();
            return h || null;
        } catch (e) {
            if (db) db.close();
            return null;
        }
    }

    // ── Permission ────────────────────────────────────────────────────────────

    async function _checkPermission(handle) {
        if (!handle) return false;
        const opts = { mode: 'readwrite' };
        try {
            if (await handle.queryPermission(opts) === 'granted') return true;
            if (await handle.requestPermission(opts) === 'granted') return true;
        } catch (e) { /* handle may be stale */ }
        return false;
    }

    // ── Subfolder helper ─────────────────────────────────────────────────────

    async function _getSnapsDir(create = true) {
        if (!_rootHandle) return null;
        try {
            return await _rootHandle.getDirectoryHandle('snapshots', { create });
        } catch (e) { return null; }
    }

    async function _getSubdir(name, create = true) {
        const snaps = await _getSnapsDir(create);
        if (!snaps) return null;
        try {
            return await snaps.getDirectoryHandle(name, { create });
        } catch (e) { return null; }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Show directory picker. User selects the root VPM folder (or any folder).
     * Handle is persisted for future sessions. Returns true if successful.
     */
    async function requestFolder() {
        if (!window.showDirectoryPicker) {
            alert('Your browser does not support the File System Access API.\nPlease use Chrome or Edge 86+.');
            return false;
        }
        try {
            const h = await window.showDirectoryPicker({ mode: 'readwrite', id: 'vpm-root' });
            _rootHandle = h;
            await _persistHandle(h);
            return true;
        } catch (e) {
            // User cancelled — not an error
            return false;
        }
    }

    /**
     * Try to restore a previously selected folder from IndexedDB.
     * Call once on app init. Returns true if folder is accessible.
     */
    async function restoreFolder() {
        const h = await _retrieveHandle();
        if (!h) return false;
        const ok = await _checkPermission(h);
        if (ok) {
            _rootHandle = h;
            return true;
        }
        return false;
    }

    /**
     * Forget the stored folder (clear from IndexedDB and memory).
     */
    async function forgetFolder() {
        _rootHandle = null;
        try {
            const db = await _openHandleDB();
            await new Promise((res, rej) => {
                const tx = db.transaction(HANDLE_STORE, 'readwrite');
                tx.objectStore(HANDLE_STORE).delete(HANDLE_KEY);
                tx.oncomplete = res;
                tx.onerror    = () => rej(tx.error);
            });
            db.close();
        } catch (e) { /* ignore */ }
    }

    /** Returns true when a folder is selected and accessible. */
    function isReady() { return _rootHandle !== null; }

    /** Returns the folder name (e.g. "VPM") or null. */
    function folderName() { return _rootHandle ? _rootHandle.name : null; }

    /**
     * Check if a handle exists in IndexedDB (without requesting permission).
     * Use to distinguish "first time" vs "returning user needing re-permission".
     */
    async function hasStoredHandle() {
        const h = await _retrieveHandle();
        return h !== null;
    }

    /**
     * Re-request permission on a stored handle. MUST be called from a user gesture
     * (click handler) since requestPermission requires user activation.
     * Returns true if permission granted (folder is now ready).
     */
    async function tryRestore() {
        const h = await _retrieveHandle();
        if (!h) return false;
        try {
            const perm = await h.requestPermission({ mode: 'readwrite' });
            if (perm === 'granted') {
                _rootHandle = h;
                return true;
            }
        } catch (e) { /* handle stale or user denied */ }
        return false;
    }

    /**
     * Write obj as JSON to  <root>/snapshots/<subdir>/<filename>.json
     */
    async function writeJSON(subdir, filename, obj) {
        if (!_rootHandle) throw new Error('VPMFileStore: no folder selected');
        const dir = await _getSubdir(subdir, true);
        if (!dir) throw new Error('Cannot create subfolder: ' + subdir);
        const fh = await dir.getFileHandle(filename + '.json', { create: true });
        const ws = await fh.createWritable();
        await ws.write(JSON.stringify(obj, null, 2));
        await ws.close();
    }

    /**
     * Read and parse <root>/snapshots/<subdir>/<filename>.json
     * Returns parsed object or null if not found / parse error.
     */
    async function readJSON(subdir, filename) {
        if (!_rootHandle) return null;
        try {
            const dir  = await _getSubdir(subdir, false);
            if (!dir) return null;
            const fh   = await dir.getFileHandle(filename + '.json');
            const file = await fh.getFile();
            return JSON.parse(await file.text());
        } catch (e) { return null; }
    }

    /**
     * List all filenames (without .json) in <root>/snapshots/<subdir>/.
     * Returned sorted newest-first (lexicographic, works for date-prefixed names).
     */
    async function listFiles(subdir) {
        if (!_rootHandle) return [];
        try {
            const dir = await _getSubdir(subdir, false);
            if (!dir) return [];
            const names = [];
            for await (const [name] of dir.entries()) {
                if (name.endsWith('.json')) names.push(name.slice(0, -5));
            }
            return names.sort().reverse();
        } catch (e) { return []; }
    }

    /**
     * Delete <root>/snapshots/<subdir>/<filename>.json
     */
    async function deleteFile(subdir, filename) {
        if (!_rootHandle) return;
        try {
            const dir = await _getSubdir(subdir, false);
            if (dir) await dir.removeEntry(filename + '.json');
        } catch (e) { /* ignore if not found */ }
    }

    // ── Shared cross-tier data (stored in <root>/shared/) ────────────────────

    async function _getSharedDir(create = true) {
        if (!_rootHandle) return null;
        try {
            return await _rootHandle.getDirectoryHandle('shared', { create });
        } catch (e) { return null; }
    }

    /**
     * Write obj as JSON to <root>/shared/<filename>.json
     */
    async function writeShared(filename, obj) {
        if (!_rootHandle) throw new Error('VPMFileStore: no folder selected');
        const dir = await _getSharedDir(true);
        if (!dir) throw new Error('Cannot create shared folder');
        const fh = await dir.getFileHandle(filename + '.json', { create: true });
        const ws = await fh.createWritable();
        await ws.write(JSON.stringify(obj, null, 2));
        await ws.close();
    }

    /**
     * Read and parse <root>/shared/<filename>.json
     * Returns parsed object or null if not found / parse error.
     */
    async function readShared(filename) {
        if (!_rootHandle) return null;
        try {
            const dir = await _getSharedDir(false);
            if (!dir) return null;
            const fh   = await dir.getFileHandle(filename + '.json');
            const file = await fh.getFile();
            return JSON.parse(await file.text());
        } catch (e) { return null; }
    }

    // ── Images (stored in <root>/images/<subdir>/) ─────────────────────────

    async function _getImagesDir(subdir, create = true) {
        if (!_rootHandle) return null;
        try {
            const imgRoot = await _rootHandle.getDirectoryHandle('images', { create });
            if (!imgRoot) return null;
            return await imgRoot.getDirectoryHandle(subdir, { create });
        } catch (e) { return null; }
    }

    async function writeImage(subdir, filename, blob) {
        if (!_rootHandle) throw new Error('VPMFileStore: no folder selected');
        const dir = await _getImagesDir(subdir, true);
        if (!dir) throw new Error('Cannot create images folder');
        const fh = await dir.getFileHandle(filename, { create: true });
        const ws = await fh.createWritable();
        await ws.write(blob);
        await ws.close();
    }

    async function readImage(subdir, filename) {
        if (!_rootHandle) return null;
        try {
            const dir = await _getImagesDir(subdir, false);
            if (!dir) return null;
            const fh = await dir.getFileHandle(filename);
            const file = await fh.getFile();
            return URL.createObjectURL(file);
        } catch (e) { return null; }
    }

    async function deleteImage(subdir, filename) {
        if (!_rootHandle) return;
        try {
            const dir = await _getImagesDir(subdir, false);
            if (dir) await dir.removeEntry(filename);
        } catch (e) { /* ignore */ }
    }

    // ── Root-level state file (stored in <root>/state/) ─────────────────────

    async function _getStateDir(create = true) {
        if (!_rootHandle) return null;
        try {
            return await _rootHandle.getDirectoryHandle('state', { create });
        } catch (e) { return null; }
    }

    async function writeState(filename, obj) {
        if (!_rootHandle) throw new Error('VPMFileStore: no folder selected');
        const dir = await _getStateDir(true);
        if (!dir) throw new Error('Cannot create state folder');
        const fh = await dir.getFileHandle(filename + '.json', { create: true });
        const ws = await fh.createWritable();
        await ws.write(JSON.stringify(obj, null, 2));
        await ws.close();
    }

    async function writeStateRaw(filename, text) {
        if (!_rootHandle) throw new Error('VPMFileStore: no folder selected');
        const dir = await _getStateDir(true);
        if (!dir) throw new Error('Cannot create state folder');
        const fh = await dir.getFileHandle(filename, { create: true });
        const ws = await fh.createWritable();
        await ws.write(text);
        await ws.close();
    }

    async function readState(filename) {
        if (!_rootHandle) return null;
        try {
            const dir = await _getStateDir(false);
            if (!dir) return null;
            const fh   = await dir.getFileHandle(filename + '.json');
            const file = await fh.getFile();
            return JSON.parse(await file.text());
        } catch (e) { return null; }
    }

    return {
        requestFolder, restoreFolder, forgetFolder,
        isReady, folderName,
        hasStoredHandle, tryRestore,
        writeJSON, readJSON, listFiles, deleteFile,
        writeShared, readShared,
        writeStateRaw,
        writeImage, readImage, deleteImage,
        writeState, readState
    };
})();
