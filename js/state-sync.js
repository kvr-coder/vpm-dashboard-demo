/**
 * VPM State Sync  (v2)
 * Keeps ALL vpm-* localStorage keys synced to a JSON file in the VPM folder.
 *
 * File location:  <VPM-root>/state/vpm-state.json
 *
 * READ path (no permission needed):
 *   On init, tries fetch('state/vpm-state.json') — works on file:// protocol
 *   without any user interaction. If localStorage is empty/sparse, imports
 *   from the file and reloads the page.
 *
 * WRITE path (needs File System Access API):
 *   After VPMFileStore grants folder access, monkey-patches localStorage
 *   so every vpm-* write triggers a debounced save back to the file.
 *
 * Depends on: VPMFileStore (fs-store.js) for writes only
 */
const VPMStateSync = (function () {
    'use strict';

    const STATE_FILE    = 'vpm-state';
    const STATE_PATH    = 'state/vpm-state.json';
    const DEBOUNCE_MS   = 2000;
    const INTERVAL_MS   = 30000;
    const VPM_PREFIX    = 'vpm-';
    const DEMO_VERSION  = 'northstar-v2.1';
    const VERSION_KEY   = 'vpm-demo-version';

    let _ready          = false;
    let _debounceTimer  = null;
    let _intervalTimer  = null;
    let _saving         = false;

    // ── Snapshot ────────────────────────────────────────────────────────────

    function _snapshotLocal() {
        const obj = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(VPM_PREFIX)) {
                obj[key] = localStorage.getItem(key);
            }
        }
        return obj;
    }

    function _countLocalKeys() {
        let count = 0;
        for (let i = 0; i < localStorage.length; i++) {
            if (localStorage.key(i)?.startsWith(VPM_PREFIX)) count++;
        }
        return count;
    }

    // ── Save to file (needs File System Access API) ─────────────────────

    async function _saveToFile() {
        if (_saving || !VPMFileStore.isReady()) return;
        _saving = true;
        try {
            const state = _snapshotLocal();
            state._savedAt = new Date().toISOString();
            // Write JSON (for XHR/fetch fallback)
            await VPMFileStore.writeState(STATE_FILE, state);
            // Write JS (for <script> tag — works on file:// protocol)
            await VPMFileStore.writeStateRaw(
                STATE_FILE + '.js',
                'window.__VPM_STATE__ = ' + JSON.stringify(state, null, 2) + ';'
            );
        } catch (e) {
            console.warn('[StateSync] Save failed:', e.message);
        } finally {
            _saving = false;
        }
    }

    function _scheduleSave() {
        if (!_ready) return;
        clearTimeout(_debounceTimer);
        _debounceTimer = setTimeout(_saveToFile, DEBOUNCE_MS);
    }

    // ── Import state from parsed JSON object ────────────────────────────

    function _importState(state) {
        const fileKeys = Object.keys(state).filter(k => k.startsWith(VPM_PREFIX));
        if (fileKeys.length === 0) return false;

        const localCount = _countLocalKeys();

        // Always import all keys from file that are missing or shorter in localStorage.
        // File is the source of truth when the folder is copied to a new machine.
        let imported = 0;
        fileKeys.forEach(k => {
            const localVal = localStorage.getItem(k);
            const fileVal  = state[k];
            if (localVal === null || (fileVal && fileVal.length > (localVal || '').length)) {
                _origSetItem.call(localStorage, k, fileVal);
                imported++;
            }
        });

        if (imported > 0) {
            console.log('[StateSync] Imported', imported, 'keys from file (file had', fileKeys.length, ', localStorage had', localCount, ').');
        } else {
            console.log('[StateSync] localStorage already up-to-date with file.');
        }
        return imported > 0;
    }

    // ── Read from embedded script (works on file:// — no permissions) ──

    function _tryEmbeddedState() {
        // state/vpm-state.js sets window.__VPM_STATE__ when loaded as <script>
        if (typeof window.__VPM_STATE__ === 'object' && window.__VPM_STATE__) {
            const state = window.__VPM_STATE__;
            const vpmKeys = Object.keys(state).filter(k => k.startsWith(VPM_PREFIX));
            if (vpmKeys.length > 0) {
                _stateFileFound = true;
                console.log('[StateSync] State loaded from embedded script (' + vpmKeys.length + ' keys).');
                return _importState(state);
            }
        }
        return false;
    }

    async function _tryFetchState() {
        // 1. Try embedded <script> tag (always works on file://)
        if (_tryEmbeddedState()) return true;

        // 2. Try sync XHR (works in some browsers on file://)
        try {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', STATE_PATH, false);
            xhr.send();
            if (xhr.status === 0 || xhr.status === 200) {
                const text = xhr.responseText;
                if (text && text.trim()) {
                    const state = JSON.parse(text);
                    const vpmKeys = Object.keys(state).filter(k => k.startsWith(VPM_PREFIX));
                    if (vpmKeys.length > 0) {
                        _stateFileFound = true;
                        console.log('[StateSync] State file found via XHR (' + vpmKeys.length + ' keys).');
                        return _importState(state);
                    }
                }
            }
        } catch (e) { /* XHR blocked on file:// */ }

        // 3. Try async fetch (works on http:// servers)
        try {
            const resp = await fetch(STATE_PATH);
            if (!resp.ok) return false;
            const text = await resp.text();
            if (!text.trim()) return false;
            const state = JSON.parse(text);
            _stateFileFound = true;
            console.log('[StateSync] State file found via fetch (' + Object.keys(state).filter(k => k.startsWith(VPM_PREFIX)).length + ' keys).');
            return _importState(state);
        } catch (e) {
            console.log('[StateSync] All read methods failed — will wait for folder access.');
            return false;
        }
    }

    // ── Read via File System Access API ──────────────────────────────────

    async function _loadFromFile() {
        try {
            const state = await VPMFileStore.readState(STATE_FILE);
            if (!state) {
                console.log('[StateSync] No state file found via FS API.');
                return false;
            }
            return _importState(state);
        } catch (e) {
            console.warn('[StateSync] FS API load failed:', e.message);
            return false;
        }
    }

    // ── Monkey-patch localStorage ───────────────────────────────────────

    const _origSetItem    = localStorage.setItem;
    const _origRemoveItem = localStorage.removeItem;

    function _patchLocalStorage() {
        localStorage.setItem = function (key, value) {
            _origSetItem.call(localStorage, key, value);
            if (key.startsWith(VPM_PREFIX)) _scheduleSave();
        };

        localStorage.removeItem = function (key) {
            _origRemoveItem.call(localStorage, key);
            if (key.startsWith(VPM_PREFIX)) _scheduleSave();
        };
    }

    // ── Init ────────────────────────────────────────────────────────────

    async function init() {
        if (localStorage.getItem(VERSION_KEY) !== DEMO_VERSION) {
            const staleKeys = [];
            for (let index = 0; index < localStorage.length; index++) {
                const key = localStorage.key(index);
                if (key && key.startsWith(VPM_PREFIX)) staleKeys.push(key);
            }
            staleKeys.forEach(key => _origRemoveItem.call(localStorage, key));
            _origSetItem.call(localStorage, VERSION_KEY, DEMO_VERSION);
            console.info('[StateSync] Initialized isolated public demo state.');
        }
        _patchLocalStorage();

        // Try reading state via fetch first (no permission needed)
        const imported = await _tryFetchState();
        if (imported) {
            document.dispatchEvent(new CustomEvent('vpm:stateImported'));
        }

        // Also listen for folder access for WRITE capability
        if (typeof VPMFileStore !== 'undefined') {
            if (VPMFileStore.isReady()) {
                _onFolderReady(imported);
            } else {
                document.addEventListener('vpm:fsFolderReady', () => _onFolderReady(imported));
            }
        }
    }

    async function _onFolderReady(alreadyImported) {
        _ready = true;

        // If fetch didn't import, try via File System Access API
        if (!alreadyImported) {
            const imported = await _loadFromFile();
            if (imported) {
                document.dispatchEvent(new CustomEvent('vpm:stateImported'));
            }
        }

        // Initial save (captures current state to file)
        _scheduleSave();

        // Safety-net interval
        _intervalTimer = setInterval(() => {
            if (!_saving) _saveToFile();
        }, INTERVAL_MS);

        console.log('[StateSync] Write-sync ready — saving to', VPMFileStore.folderName() + '/state/' + STATE_FILE + '.json');
    }

    async function flush() {
        clearTimeout(_debounceTimer);
        if (_ready) await _saveToFile();
    }

    /** True if state was loaded from file via fetch (no FS API needed). */
    function hasStateFile() { return _stateFileFound; }

    let _stateFileFound = false;

    return { init, flush, hasStateFile };
})();
