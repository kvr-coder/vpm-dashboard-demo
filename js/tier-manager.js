/**
 * VPMTierManager v2
 * Tree-based board system: each board has a parentId defining hierarchy.
 * Escalation flows up (board -> parent), cascade flows down (board -> children).
 * Emits 'vpm:tiersChanged' on every structural change.
 * Storage: 'vpm-tiers-v2' (auto-migrates from v1).
 */
const VPMTierManager = (function () {
    'use strict';

    const STORE_V2  = 'vpm-tiers-v2';
    const STORE_V1  = 'vpm-tiers-v1';

    const DEFAULT_TIERS = [
        { id: 1, label: 'T1 \u2014 Shop Floor', role: 'Team', level: 1,
          accent: '#3b82f6', accentHover: '#2563eb', parentId: 2,
          tabs: ['overview','safety','people','quality','production','supplychain','cost','maintenance','engineering','ci','recognitions','actions','feedback'] },
        { id: 2, label: 'T2 \u2014 Department', role: 'Manager', level: 2,
          accent: '#f59e0b', accentHover: '#d97706', parentId: 3,
          tabs: ['overview','safety','people','quality','supplychain','cost','maintenance','ci','recognitions','actions','feedback'] },
        { id: 3, label: 'T3 \u2014 Management', role: 'Management', level: 3,
          accent: '#a855f7', accentHover: '#9333ea', parentId: 4,
          tabs: ['overview','safety','people','quality','supplychain','cost','maintenance','ci','recognitions','actions','feedback'] },
        { id: 4, label: 'T4 \u2014 Executive', role: 'Executive', level: 4,
          accent: '#ec4899', accentHover: '#db2777', parentId: null,
          tabs: ['overview','safety','people','quality','supplychain','cost','maintenance','ci','recognitions','actions','feedback'] }
    ];

    const COLOR_PRESETS = [
        '#3b82f6', '#f59e0b', '#a855f7', '#ec4899',
        '#22c55e', '#ef4444', '#06b6d4', '#f97316',
        '#8b5cf6', '#64748b'
    ];

    const REQUIRED_TABS = [
        'overview','safety','people','quality','production',
        'supplychain','cost','maintenance','engineering','ci','recognitions','actions','feedback'
    ];

    const ALL_DEFAULT_TABS = [
        'overview','safety','people','quality','production',
        'supplychain','cost','maintenance','engineering','ci','recognitions','actions'
    ];

    // ── Storage ──────────────────────────────────────────────────────

    function _load() {
        // Try v2 first
        try {
            const s = JSON.parse(localStorage.getItem(STORE_V2));
            if (Array.isArray(s) && s.length > 0) { _ensureTabs(s); return s; }
        } catch (e) { /* fall through */ }

        // Migrate from v1
        try {
            const v1 = JSON.parse(localStorage.getItem(STORE_V1));
            if (Array.isArray(v1) && v1.length > 0) {
                const migrated = _migrateV1(v1);
                _save(migrated);
                return migrated;
            }
        } catch (e) { /* fall through */ }

        return DEFAULT_TIERS.map(t => Object.assign({}, t));
    }

    function _migrateV1(v1Tiers) {
        return v1Tiers.map((t, i) => {
            const parent = (i < v1Tiers.length - 1) ? v1Tiers[i + 1].id : null;
            return Object.assign({}, t, {
                level:    i + 1,
                parentId: parent
            });
        });
    }

    function _ensureTabs(tiers) {
        let dirty = false;
        tiers.forEach(t => {
            if (!Array.isArray(t.tabs)) { t.tabs = [...REQUIRED_TABS]; dirty = true; return; }
            REQUIRED_TABS.forEach(tab => {
                if (!t.tabs.includes(tab)) { t.tabs.push(tab); dirty = true; }
            });
        });
        if (dirty) _save(tiers);
    }

    function _save(tiers) {
        localStorage.setItem(STORE_V2, JSON.stringify(tiers));
    }

    // ── Tree traversal ──────────────────────────────────────────────

    function getTiers()            { return _load(); }
    function getTierMeta(id)       { return _load().find(t => t.id === id) || null; }
    function getTierPosition(id)   { const b = getTierMeta(id); return b ? b.level : -1; }

    function getParentId(id) {
        const b = getTierMeta(id);
        return b ? b.parentId : null;
    }

    function getChildIds(id) {
        return _load().filter(t => t.parentId === id).map(t => t.id);
    }

    function getDescendantIds(id) {
        const result = [];
        const queue = getChildIds(id);
        while (queue.length) {
            const cid = queue.shift();
            result.push(cid);
            getChildIds(cid).forEach(gc => queue.push(gc));
        }
        return result;
    }

    function getAncestorIds(id) {
        const result = [];
        let pid = getParentId(id);
        while (pid != null) {
            result.push(pid);
            pid = getParentId(pid);
        }
        return result;
    }

    function getSiblingIds(id) {
        const b = getTierMeta(id);
        if (!b) return [];
        return _load().filter(t => t.parentId === b.parentId && t.id !== id).map(t => t.id);
    }

    function getBoardsAtLevel(level) {
        return _load().filter(t => t.level === level);
    }

    function isBottom(id)  { return getChildIds(id).length === 0; }
    function isTop(id)     { const b = getTierMeta(id); return b ? b.parentId == null : false; }

    // Backward compat wrappers — old code calls these
    function getNextTierId(id) { return getParentId(id); }
    function getPrevTierId(id) { const c = getChildIds(id); return c.length > 0 ? c[0] : null; }

    function getTabsForTier(id) {
        const tier = getTierMeta(id);
        if (!tier) return [];
        let hidden;
        try { hidden = new Set(JSON.parse(localStorage.getItem('vpm-hidden-tabs-v1') || '[]')); }
        catch (e) { hidden = new Set(); }
        const base = (tier.tabs || []).filter(tabId => !hidden.has(tabId));
        let custom = [];
        try {
            custom = JSON.parse(localStorage.getItem('vpm-custom-tabs-v1') || '[]')
                .filter(c => (c.tier || 1) === id)
                .map(c => c.id);
        } catch (e) {}
        return [...base, ...custom];
    }

    // ── Mutations ───────────────────────────────────────────────────

    function addBoard(parentId) {
        const ts = _load();
        const maxId = ts.reduce((m, t) => Math.max(m, t.id), 0);
        const newId = maxId + 1;
        const parent = parentId != null ? ts.find(t => t.id === parentId) : null;
        const level = parent ? Math.max(1, parent.level - 1) : 1;
        const color = COLOR_PRESETS[ts.length % COLOR_PRESETS.length];
        ts.push({
            id:          newId,
            label:       'T' + level + ' \u2014 New Board',
            role:        'Custom',
            level:       level,
            parentId:    parentId,
            accent:      color,
            accentHover: color,
            tabs:        [...ALL_DEFAULT_TABS]
        });
        _save(ts);
        _dispatch();
        return newId;
    }

    // Legacy wrapper
    function addTier() {
        const ts = _load();
        const roots = ts.filter(t => t.parentId == null);
        const topRoot = roots.length ? roots[0] : null;
        return addBoard(topRoot ? topRoot.id : null);
    }

    function deleteTier(id, rerouteToId) {
        let ts = _load();
        if (ts.length <= 1) return false;
        // Reparent children to the reroute target
        ts.forEach(t => { if (t.parentId === id) t.parentId = rerouteToId; });
        ts = ts.filter(t => t.id !== id);
        _save(ts);
        _rerouteData(id, rerouteToId);
        _dispatch();
        return true;
    }

    function updateTier(id, changes) {
        const ts = _load();
        const idx = ts.findIndex(t => t.id === id);
        if (idx < 0) return false;
        Object.assign(ts[idx], changes);
        // Validate: prevent circular parentId
        if (changes.parentId !== undefined) {
            const ancestors = [];
            let pid = changes.parentId;
            while (pid != null) {
                if (pid === id) { ts[idx].parentId = null; break; } // circular - break
                ancestors.push(pid);
                const p = ts.find(t => t.id === pid);
                pid = p ? p.parentId : null;
            }
        }
        _save(ts);
        _dispatch();
        return true;
    }

    function reparentBoard(id, newParentId) {
        return updateTier(id, { parentId: newParentId });
    }

    function reorderTiers(newIdOrder) {
        const ts = _load();
        const sorted = newIdOrder.map(id => ts.find(t => t.id === id)).filter(Boolean);
        ts.forEach(t => { if (!sorted.find(s => s.id === t.id)) sorted.push(t); });
        _save(sorted);
        _dispatch();
    }

    // ── Data migration on delete ─────────────────────────────────────

    function _rerouteData(deletedId, rerouteToId) {
        try {
            let msgs = JSON.parse(localStorage.getItem('vpm-escalation-messages') || '[]');
            msgs = msgs.map(m => {
                if (m.tier            === deletedId) m.tier            = rerouteToId;
                if (m.reportsTo       === deletedId) m.reportsTo       = rerouteToId;
                if (m.escalatedToTier === deletedId) m.escalatedToTier = rerouteToId;
                return m;
            });
            localStorage.setItem('vpm-escalation-messages', JSON.stringify(msgs));
        } catch (e) {}
        try {
            let tabs = JSON.parse(localStorage.getItem('vpm-custom-tabs-v1') || '[]');
            tabs = tabs.map(t => { if (t.tier === deletedId) t.tier = rerouteToId; return t; });
            localStorage.setItem('vpm-custom-tabs-v1', JSON.stringify(tabs));
        } catch (e) {}
    }

    // ── Event ────────────────────────────────────────────────────────

    function _dispatch() {
        document.dispatchEvent(new CustomEvent('vpm:tiersChanged'));
    }

    // ── Init ─────────────────────────────────────────────────────────

    function init() {
        const ts = _load();
        if (!localStorage.getItem(STORE_V2)) _save(ts);
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', _addGearBtn);
        } else {
            _addGearBtn();
        }
    }

    function _addGearBtn() {
        const wrap = document.querySelector('.tier-switcher-wrap');
        if (!wrap || wrap.querySelector('.tier-mgr-gear-btn')) return;
        const btn = document.createElement('button');
        btn.className = 'tier-mgr-gear-btn';
        btn.title = 'Manage boards';
        btn.innerHTML =
            '<svg width="14" height="14" viewBox="0 0 18 18" fill="none">' +
            '<circle cx="9" cy="9" r="3" stroke="currentColor" stroke-width="1.5"/>' +
            '<path d="M9 2v2M9 14v2M2 9h2M14 9h2M4.2 4.2l1.4 1.4M12.4 12.4l1.4 1.4M4.2 13.8l1.4-1.4M12.4 5.6l1.4-1.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
            '</svg>';
        btn.addEventListener('click', openUI);
        wrap.appendChild(btn);
    }

    // ── UI Panel ─────────────────────────────────────────────────────

    function openUI() {
        let panel = document.getElementById('tierMgrPanel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'tierMgrPanel';
            panel.className = 'tier-mgr-panel';
            document.body.appendChild(panel);
            const bd = document.createElement('div');
            bd.className = 'tier-mgr-backdrop';
            bd.id = 'tierMgrBackdrop';
            bd.addEventListener('click', closeUI);
            document.body.appendChild(bd);
        }
        _renderPanel(panel);
        panel.getBoundingClientRect();
        panel.classList.add('open');
        const bd2 = document.getElementById('tierMgrBackdrop');
        if (bd2) { bd2.getBoundingClientRect(); bd2.classList.add('open'); }
    }

    function closeUI() {
        const panel = document.getElementById('tierMgrPanel');
        const bd    = document.getElementById('tierMgrBackdrop');
        if (panel) panel.classList.remove('open');
        if (bd)    bd.classList.remove('open');
    }

    function _renderPanel(panel) {
        panel.innerHTML = '';
        const ts = _load();

        // Header
        const hdr = document.createElement('div');
        hdr.className = 'tier-mgr-header';
        hdr.innerHTML =
            '<span class="tier-mgr-title">Manage Boards</span>' +
            '<button class="tier-mgr-close-btn" title="Close">&times;</button>';
        hdr.querySelector('.tier-mgr-close-btn').addEventListener('click', closeUI);
        panel.appendChild(hdr);

        const hint = document.createElement('p');
        hint.className = 'tier-mgr-hint';
        hint.textContent = 'Tree shows board hierarchy. Click + to add child boards.';
        panel.appendChild(hint);

        // Build tree recursively
        const list = document.createElement('div');
        list.id = 'tierMgrList';
        list.className = 'tier-mgr-tree';
        const roots = ts.filter(t => t.parentId == null);
        roots.forEach(root => _renderTreeNode(list, root, ts, panel, 0));
        // Orphans (parentId set but parent doesn't exist)
        const allIds = new Set(ts.map(t => t.id));
        const orphans = ts.filter(t => t.parentId != null && !allIds.has(t.parentId));
        orphans.forEach(o => _renderTreeNode(list, o, ts, panel, 0));
        panel.appendChild(list);

        // Add root board button
        const addBtn = document.createElement('button');
        addBtn.className = 'tier-mgr-add-btn';
        addBtn.innerHTML =
            '<svg width="11" height="11" viewBox="0 0 12 12" fill="none">' +
            '<path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
            '</svg> Add Root Board';
        addBtn.addEventListener('click', () => {
            const newTs = _load();
            const maxId = newTs.reduce((m, t) => Math.max(m, t.id), 0);
            const newId = maxId + 1;
            newTs.push({
                id: newId, label: 'T4 \u2014 New Root', role: 'Executive',
                level: 4, parentId: null,
                accent: COLOR_PRESETS[newTs.length % COLOR_PRESETS.length],
                accentHover: COLOR_PRESETS[newTs.length % COLOR_PRESETS.length],
                tabs: [...ALL_DEFAULT_TABS]
            });
            _save(newTs);
            _dispatch();
            _renderPanel(panel);
            _notifyEscalation();
        });
        panel.appendChild(addBtn);
    }

    function _renderTreeNode(container, tier, allTiers, panel, depth) {
        const row = document.createElement('div');
        row.className = 'tier-mgr-row';
        row.dataset.tierId = tier.id;
        row.style.paddingLeft = (12 + depth * 20) + 'px';

        const canDelete = allTiers.length > 1;
        const levelLabel = 'T' + tier.level;
        const indent = depth > 0 ? '<span class="tree-branch">\u2514\u2500</span> ' : '';
        const boardLocked = typeof VPMBoardLock !== 'undefined' && VPMBoardLock.isLocked(tier.id);
        const lockIcon = boardLocked ? '&#128274;' : '&#128275;';
        const lockTitle = boardLocked ? 'Locked — click to manage' : 'Unlocked — click to set PIN';

        row.innerHTML =
            indent +
            '<span class="tier-row-color" style="background:' + tier.accent + '"></span>' +
            '<span class="tier-row-label">' + _esc(tier.label) + '</span>' +
            (boardLocked ? '<span class="tier-row-locked-tag">LOCKED</span>' : '') +
            '<div class="tier-row-actions">' +
                '<button class="tier-row-add-child" title="Add child board">+</button>' +
                '<button class="tier-row-lock-btn' + (boardLocked ? ' is-locked' : '') + '" title="' + lockTitle + '">' + lockIcon + '</button>' +
                '<button class="tier-row-edit-btn" title="Edit board">&#9998;</button>' +
                (canDelete ? '<button class="tier-row-del-btn" title="Delete board">&times;</button>' : '') +
            '</div>';

        row.querySelector('.tier-row-add-child').addEventListener('click', () => {
            addBoard(tier.id);
            _renderPanel(panel);
            _notifyEscalation();
        });
        row.querySelector('.tier-row-lock-btn').addEventListener('click', () => {
            if (typeof VPMBoardLock !== 'undefined') {
                VPMBoardLock.showLockSettings(tier.id, () => _renderPanel(panel));
            }
        });
        row.querySelector('.tier-row-edit-btn').addEventListener('click', () => _showEdit(row, tier, panel));
        const delBtn = row.querySelector('.tier-row-del-btn');
        if (delBtn) delBtn.addEventListener('click', () => _showDeleteConfirm(row, tier, allTiers, panel));

        container.appendChild(row);

        // Render children recursively
        const children = allTiers.filter(t => t.parentId === tier.id);
        children.forEach(child => _renderTreeNode(container, child, allTiers, panel, depth + 1));
    }

    function _showEdit(row, tier, panel) {
        const ts = _load();
        const others = ts.filter(t => t.id !== tier.id);
        const parentOpts = '<option value="">(None - root board)</option>' +
            others.map(t => '<option value="' + t.id + '"' +
                (t.id === tier.parentId ? ' selected' : '') + '>' +
                _esc(t.label) + '</option>'
            ).join('');
        const levelOpts = [1,2,3,4,5,6].map(l =>
            '<option value="' + l + '"' + (l === tier.level ? ' selected' : '') + '>T' + l + '</option>'
        ).join('');
        const swatches = COLOR_PRESETS.map(c =>
            '<button class="tier-color-swatch' + (c === tier.accent ? ' selected' : '') + '" ' +
            'data-color="' + c + '" style="background:' + c + '" title="' + c + '"></button>'
        ).join('');

        row.innerHTML =
            '<div class="tier-edit-form">' +
                '<input class="tier-edit-input" type="text" value="' + _esc(tier.label) +
                    '" maxlength="40" placeholder="Board name">' +
                '<div class="tier-edit-selects">' +
                    '<label>Level: <select class="tier-level-select">' + levelOpts + '</select></label>' +
                    '<label>Reports to: <select class="tier-parent-select">' + parentOpts + '</select></label>' +
                '</div>' +
                '<div class="tier-color-presets">' + swatches + '</div>' +
                '<div class="tier-edit-btns">' +
                    '<button class="tier-edit-save">Save</button>' +
                    '<button class="tier-edit-cancel">Cancel</button>' +
                '</div>' +
            '</div>';

        let chosenColor = tier.accent;
        row.querySelectorAll('.tier-color-swatch').forEach(sw => {
            sw.addEventListener('click', () => {
                row.querySelectorAll('.tier-color-swatch').forEach(s => s.classList.remove('selected'));
                sw.classList.add('selected');
                chosenColor = sw.dataset.color;
            });
        });

        row.querySelector('.tier-edit-save').addEventListener('click', () => {
            const lbl = row.querySelector('.tier-edit-input').value.trim();
            if (!lbl) return;
            const newLevel = parseInt(row.querySelector('.tier-level-select').value) || tier.level;
            const parentVal = row.querySelector('.tier-parent-select').value;
            const newParent = parentVal === '' ? null : parseInt(parentVal);
            updateTier(tier.id, {
                label: lbl, level: newLevel, parentId: newParent,
                accent: chosenColor, accentHover: chosenColor
            });
            _renderPanel(panel);
            _notifyEscalation();
        });
        row.querySelector('.tier-edit-cancel').addEventListener('click', () => _renderPanel(panel));
    }

    function _showDeleteConfirm(row, tier, allTiers, panel) {
        const others = allTiers.filter(t => t.id !== tier.id);
        const opts = others.map(t =>
            '<option value="' + t.id + '">' + _esc(t.label) + '</option>'
        ).join('');
        row.innerHTML =
            '<div class="tier-delete-confirm">' +
                '<span class="tier-delete-warning">Delete <strong>' + _esc(tier.label) + '</strong>?</span>' +
                '<label class="tier-reroute-label">Route data to:' +
                    '<select class="tier-reroute-select">' + opts + '</select>' +
                '</label>' +
                '<div class="tier-delete-btns">' +
                    '<button class="tier-del-ok">Delete</button>' +
                    '<button class="tier-del-cancel">Cancel</button>' +
                '</div>' +
            '</div>';
        row.querySelector('.tier-del-ok').addEventListener('click', () => {
            const toId = parseInt(row.querySelector('.tier-reroute-select').value);
            const currentTierStr = localStorage.getItem('vpm-current-tier');
            if (currentTierStr && parseInt(currentTierStr) === tier.id) {
                localStorage.setItem('vpm-current-tier', String(toId));
            }
            deleteTier(tier.id, toId);
            _renderPanel(panel);
            _notifyEscalation();
        });
        row.querySelector('.tier-del-cancel').addEventListener('click', () => _renderPanel(panel));
    }

    function _notifyEscalation() {
        if (typeof VPMEscalation !== 'undefined' &&
            typeof VPMEscalation.rebuildTierSwitcher === 'function') {
            VPMEscalation.rebuildTierSwitcher();
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────

    function _esc(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    return {
        init,
        getTiers,
        getTierMeta,
        getTierPosition,
        isBottom,
        isTop,
        getNextTierId,
        getPrevTierId,
        getParentId,
        getChildIds,
        getDescendantIds,
        getAncestorIds,
        getSiblingIds,
        getBoardsAtLevel,
        getTabsForTier,
        addTier,
        addBoard,
        deleteTier,
        updateTier,
        reparentBoard,
        reorderTiers,
        openUI,
        closeUI
    };
})();
