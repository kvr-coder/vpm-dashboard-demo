/**
 * VPM Board Lock  (v2)
 *
 * Two-layer PIN system:
 *   1. Admin PIN — gates lock management (setting/removing board PINs)
 *   2. Per-board PINs — gate access to locked boards
 *
 * Admin PIN hash stored in localStorage ('vpm-admin-pin-hash').
 * Board PIN hashes stored in tier config ('pinHash' field in vpm-tiers-v2).
 * Session unlocks stored in sessionStorage (per-board, cleared on tab close).
 */
const VPMBoardLock = (function () {
    'use strict';

    const ADMIN_PIN_KEY = 'vpm-admin-pin-hash';

    // ── Hashing (portable — same result on file:// and https://) ──

    function _hash(str) {
        let h1 = 5381, h2 = 52711, h3 = 31;
        for (let i = 0; i < str.length; i++) {
            const c = str.charCodeAt(i);
            h1 = ((h1 << 5) + h1 + c) >>> 0;
            h2 = ((h2 << 5) + h2 + c) >>> 0;
            h3 = ((h3 * 31) + c) >>> 0;
        }
        return h1.toString(16).padStart(8, '0') +
               h2.toString(16).padStart(8, '0') +
               h3.toString(16).padStart(8, '0');
    }

    // ── Admin PIN ───────────────────────────────────────────────────

    async function init() {
        const stored = localStorage.getItem(ADMIN_PIN_KEY);
        // One-time migration from SHA-256 (64 chars) to portable hash (24 chars)
        if (!stored || (stored.length !== 24 && !localStorage.getItem('vpm-pin-v2'))) {
            localStorage.setItem(ADMIN_PIN_KEY, _hash('4567'));
            localStorage.setItem('vpm-pin-v2', '1');
        }
    }

    function _isAdminUnlocked() {
        return sessionStorage.getItem('vpm-admin-unlocked') === 'true';
    }

    function _unlockAdmin() {
        sessionStorage.setItem('vpm-admin-unlocked', 'true');
    }

    // ── Board PIN helpers ───────────────────────────────────────────

    function _getBoardPinHash(boardId) {
        if (typeof VPMTierManager === 'undefined') return null;
        const board = VPMTierManager.getTierMeta(boardId);
        return board?.pinHash || null;
    }

    function isLocked(boardId) {
        return !!_getBoardPinHash(boardId);
    }

    function isBoardUnlocked(boardId) {
        if (!isLocked(boardId)) return true;
        return sessionStorage.getItem('vpm-board-unlocked-' + boardId) === 'true';
    }

    function _unlockBoard(boardId) {
        sessionStorage.setItem('vpm-board-unlocked-' + boardId, 'true');
    }

    // ── Generic PIN modal builder ───────────────────────────────────

    function _showPinModal(opts) {
        const existing = document.getElementById('boardPinModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'boardPinModal';
        modal.style.cssText =
            'position:fixed;inset:0;z-index:999999;display:flex;align-items:center;' +
            'justify-content:center;background:rgba(0,0,0,0.5)';

        const iconHtml = opts.icon || '&#128274;';
        const titleHtml = opts.title || 'Enter PIN';
        const subtitleHtml = opts.subtitle || '';

        modal.innerHTML = `
            <div style="background:var(--card-bg,#fff);border-radius:12px;padding:28px 32px;
                        min-width:300px;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,0.3)">
                <div style="font-size:20px;margin-bottom:6px">${iconHtml}</div>
                <div style="font-size:14px;font-weight:700;margin-bottom:4px;color:var(--text-primary,#1e293b)">
                    ${titleHtml}
                </div>
                ${subtitleHtml ? '<div style="font-size:12px;color:var(--text-muted,#64748b);margin-bottom:16px">' + subtitleHtml + '</div>' : '<div style="margin-bottom:16px"></div>'}
                <input id="bpInput" type="password" maxlength="6" inputmode="numeric"
                       placeholder="${opts.placeholder || 'PIN'}"
                       style="width:140px;text-align:center;font-size:24px;letter-spacing:8px;
                              padding:8px 12px;border:2px solid var(--border,#e2e8f0);border-radius:8px;
                              background:var(--bg-secondary,#f8fafc);color:var(--text-primary,#1e293b);
                              outline:none">
                <div id="bpError" style="color:#ef4444;font-size:11px;margin-top:8px;min-height:16px"></div>
                <div style="display:flex;gap:8px;justify-content:center;margin-top:12px">
                    ${opts.extraBtn || ''}
                    <button id="bpCancel" style="padding:6px 16px;border-radius:6px;border:1px solid var(--border,#e2e8f0);
                            background:transparent;color:var(--text-primary,#1e293b);cursor:pointer;font-size:13px">
                        Cancel
                    </button>
                    <button id="bpSubmit" style="padding:6px 16px;border-radius:6px;border:none;
                            background:var(--accent,#7c3aed);color:#fff;cursor:pointer;font-size:13px;font-weight:600">
                        ${opts.submitLabel || 'Unlock'}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const input = document.getElementById('bpInput');
        input.focus();

        // Auto-submit when PIN reaches expected length (try each keystroke)
        const _autoLen = opts.autoSubmitLength || 0;
        if (_autoLen > 0) {
            input.addEventListener('input', () => {
                if (input.value.length >= _autoLen) {
                    document.getElementById('bpSubmit')?.click();
                }
            });
        }

        document.getElementById('bpCancel').addEventListener('click', () => {
            modal.remove();
            if (opts.onCancel) opts.onCancel();
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) { modal.remove(); if (opts.onCancel) opts.onCancel(); }
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { modal.remove(); if (opts.onCancel) opts.onCancel(); }
        });

        return { modal, input, errEl: document.getElementById('bpError'), submit: document.getElementById('bpSubmit') };
    }

    // ── Admin PIN prompt (for lock management) ──────────────────────

    function requireAdmin(onSuccess, onCancel) {
        if (_isAdminUnlocked()) {
            if (onSuccess) onSuccess();
            return;
        }

        const { input, errEl, submit } = _showPinModal({
            icon: '&#128272;',
            title: 'Admin Access',
            subtitle: 'Enter Admin PIN to manage board locks',
            autoSubmitLength: 4,
            onCancel
        });

        async function tryUnlock() {
            const pin = input.value.trim();
            if (!pin) { errEl.textContent = 'Enter a PIN'; return; }
            const hash = _hash(pin);
            if (hash === localStorage.getItem(ADMIN_PIN_KEY)) {
                _unlockAdmin();
                document.getElementById('boardPinModal')?.remove();
                if (onSuccess) onSuccess();
            } else {
                errEl.textContent = 'Incorrect Admin PIN';
                input.value = '';
                input.focus();
            }
        }

        submit.addEventListener('click', tryUnlock);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryUnlock(); });
    }

    // ── Board PIN prompt (for daily access) ─────────────────────────

    function requireBoardAccess(boardId, onAllow, onDeny) {
        if (isBoardUnlocked(boardId)) {
            if (onAllow) onAllow();
            return true;
        }

        const board = typeof VPMTierManager !== 'undefined'
            ? VPMTierManager.getTierMeta(boardId) : null;
        const label = board?.label || 'Board ' + boardId;

        const { input, errEl, submit } = _showPinModal({
            icon: '&#128274;',
            title: 'Board Locked',
            subtitle: 'Enter PIN to access <strong>' + label + '</strong>',
            autoSubmitLength: 4,
            onCancel: onDeny
        });

        async function tryUnlock() {
            const pin = input.value.trim();
            if (!pin) { errEl.textContent = 'Enter a PIN'; return; }
            const hash = _hash(pin);
            if (hash === _getBoardPinHash(boardId)) {
                _unlockBoard(boardId);
                document.getElementById('boardPinModal')?.remove();
                if (onAllow) onAllow();
            } else {
                errEl.textContent = 'Incorrect PIN';
                input.value = '';
                input.focus();
            }
        }

        submit.addEventListener('click', tryUnlock);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryUnlock(); });
        return false;
    }

    // ── Set / Remove Board PIN (admin-gated) ────────────────────────

    function showLockSettings(boardId, onDone) {
        requireAdmin(() => _showSetPinDialog(boardId, onDone));
    }

    function _showSetPinDialog(boardId, onDone) {
        const board = typeof VPMTierManager !== 'undefined'
            ? VPMTierManager.getTierMeta(boardId) : null;
        const label = board?.label || 'Board ' + boardId;
        const currentlyLocked = isLocked(boardId);

        const extraBtn = currentlyLocked
            ? '<button id="bpRemove" style="padding:6px 16px;border-radius:6px;border:1px solid #ef4444;background:transparent;color:#ef4444;cursor:pointer;font-size:13px">Remove Lock</button>'
            : '';

        const { modal, input, errEl, submit } = _showPinModal({
            icon: currentlyLocked ? '&#128275;' : '&#128274;',
            title: currentlyLocked ? 'Change Board Lock' : 'Lock Board',
            subtitle: '<strong>' + label + '</strong>',
            placeholder: 'New PIN (4+)',
            submitLabel: 'Save',
            extraBtn
        });

        async function savePin() {
            const pin = input.value.trim();
            if (pin.length < 4) { errEl.textContent = 'PIN must be at least 4 digits'; return; }
            const hash = _hash(pin);
            VPMTierManager.updateTier(boardId, { pinHash: hash });
            modal.remove();
            if (onDone) onDone();
        }

        function removeLock() {
            VPMTierManager.updateTier(boardId, { pinHash: null });
            // Clean the field entirely
            const ts = VPMTierManager.getTiers();
            const t = ts.find(b => b.id === boardId);
            if (t) delete t.pinHash;
            localStorage.setItem('vpm-tiers-v2', JSON.stringify(ts));
            sessionStorage.removeItem('vpm-board-unlocked-' + boardId);
            modal.remove();
            if (onDone) onDone();
        }

        submit.addEventListener('click', savePin);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') savePin(); });
        const removeBtn = document.getElementById('bpRemove');
        if (removeBtn) removeBtn.addEventListener('click', removeLock);
    }

    // ── Change Admin PIN ────────────────────────────────────────────

    function showChangeAdminPin() {
        requireAdmin(() => {
            const { input, errEl, submit } = _showPinModal({
                icon: '&#128272;',
                title: 'Change Admin PIN',
                placeholder: 'New PIN (4+)',
                submitLabel: 'Save'
            });

            async function save() {
                const pin = input.value.trim();
                if (pin.length < 4) { errEl.textContent = 'PIN must be at least 4 digits'; return; }
                const hash = _hash(pin);
                localStorage.setItem(ADMIN_PIN_KEY, hash);
                document.getElementById('boardPinModal')?.remove();
            }

            submit.addEventListener('click', save);
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
        });
    }

    return {
        init,
        isLocked,
        isBoardUnlocked,
        requireBoardAccess,
        showLockSettings,
        showChangeAdminPin
    };
})();
