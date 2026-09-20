/**
 * VPM Tab Manager
 * Central registry for sidebar navigation tabs.
 * Built-in tabs can be hidden; custom tabs can be added and deleted.
 * Emits 'vpm:tabsChanged' on every structural change.
 */
const VPMTabManager = (function () {
    'use strict';

    const HIDDEN_KEY = 'vpm-hidden-tabs-v1';
    const CUSTOM_KEY = 'vpm-custom-tabs-v1';
    const ORDER_KEY  = 'vpm-tab-order-v1';  // { "tierId": ["tabId", ...] }

    let _sortableInstance = null;

    // Built-in tab definitions (order = display order)
    const BUILTIN = [
        {
            id: 'overview', label: 'Overview', protected: true,
            svg: '<rect x="2" y="2" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="10" y="2" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="2" y="10" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="10" y="10" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/>'
        },
        {
            id: 'safety', label: 'Safety',
            svg: '<path d="M9 1.5l6 3v4.5c0 3.5-2.5 6.5-6 7.5-3.5-1-6-4-6-7.5V4.5l6-3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'
        },
        {
            id: 'people', label: 'People',
            svg: '<circle cx="9" cy="5.5" r="2.5" stroke="currentColor" stroke-width="1.5"/><path d="M3 15.5c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
        },
        {
            id: 'quality', label: 'Quality',
            svg: '<path d="M6.5 9l2 2 3.5-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="1.5"/>'
        },
        {
            id: 'production', label: 'Production',
            svg: '<path d="M2 14l4-5 3 3 5-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 5h4v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
        },
        {
            id: 'supplychain', label: 'Supply Chain',
            svg: '<rect x="1.5" y="7" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="11.5" y="7" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M6.5 9.5h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M9 3v4M9 12v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
        },
        {
            id: 'cost', label: 'Cost',
            svg: '<path d="M9 2v14M6 5h4.5a2 2 0 010 4H6h5.5a2 2 0 010 4H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
        },
        {
            id: 'maintenance', label: 'Maintenance',
            svg: '<path d="M10.5 2.5l-1 3.5 3 3-3.5 1 2.5 6-7-5 3.5-1-3-3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'
        },
        {
            id: 'engineering', label: 'Engineering',
            svg: '<circle cx="9" cy="9" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M9 2v2M9 14v2M2 9h2M14 9h2M4.2 4.2l1.4 1.4M12.4 12.4l1.4 1.4M4.2 13.8l1.4-1.4M12.4 5.6l1.4-1.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
        },
        {
            id: 'ci', label: 'CI & Ideas',
            svg: '<path d="M3 13l4-4 3 3 5-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="14" cy="4" r="2" stroke="currentColor" stroke-width="1.5"/>'
        },
        {
            id: 'actions', label: 'Action Items',
            svg: '<rect x="3" y="3" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M6 7h6M6 9.5h6M6 12h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
        }
    ];

    // Base tier visibility for built-in tabs
    const TIER_BASE = {
        1: ['overview','safety','people','quality','production','supplychain','cost','maintenance','engineering','ci','actions'],
        2: ['overview','safety','people','quality','supplychain','cost','maintenance','ci','actions'],
        3: ['overview','safety','people','quality','supplychain','cost','maintenance','ci','actions'],
        4: ['overview','safety','people','quality','supplychain','cost','maintenance','ci','actions']
    };

    // Generic icon for custom tabs
    const CUSTOM_SVG = '<circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M9 6v6M6 9h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';

    // ── Storage helpers ────────────────────────────────────────

    function loadHidden() {
        try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]')); }
        catch (e) { return new Set(); }
    }
    function saveHidden(set) {
        localStorage.setItem(HIDDEN_KEY, JSON.stringify([...set]));
    }
    function loadCustom() {
        try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); }
        catch (e) { return []; }
    }
    function saveCustom(arr) {
        localStorage.setItem(CUSTOM_KEY, JSON.stringify(arr));
    }
    function _loadOrder() {
        try { return JSON.parse(localStorage.getItem(ORDER_KEY) || '{}'); }
        catch (e) { return {}; }
    }
    function _saveOrder(obj) {
        localStorage.setItem(ORDER_KEY, JSON.stringify(obj));
    }

    // ── Per-tier tab order ─────────────────────────────────────

    function _getCurrentTierId() {
        const activeBtn = document.querySelector('.tier-btn.active');
        return activeBtn ? (parseInt(activeBtn.dataset.tier) || 1)
                         : (parseInt(localStorage.getItem('vpm-current-tier') || '1'));
    }

    /**
     * Returns the ordered list of visible tab IDs for a tier,
     * merging any saved drag order with the currently-allowed set.
     */
    function getOrderedTabsForTier(tierId) {
        const visible = (typeof VPMTierManager !== 'undefined')
            ? VPMTierManager.getTabsForTier(tierId)
            : getTabs().map(t => t.id);
        const saved   = (_loadOrder()[String(tierId)] || []);
        // Keep saved positions, drop tabs no longer visible
        const ordered = saved.filter(id => visible.includes(id));
        // Append visible tabs not yet in saved order (first-time or newly added)
        visible.forEach(id => { if (!ordered.includes(id)) ordered.push(id); });
        return ordered;
    }

    function saveTabOrderForTier(tierId, orderedIds) {
        const all = _loadOrder();
        all[String(tierId)] = orderedIds;
        _saveOrder(all);
    }

    /**
     * Physically reorder #navTabs <li> nodes to match orderedIds.
     * Items not in orderedIds are left at the end untouched.
     */
    function reorderNav(orderedIds) {
        const list = document.getElementById('navTabs');
        if (!list) return;
        orderedIds.forEach(id => {
            const li = list.querySelector(`.nav-item[data-tab="${id}"]`);
            if (li) list.appendChild(li); // moves to end of list in declared sequence
        });
    }

    /** Initialize Sortable drag-to-reorder on #navTabs (called once). */
    function _initSortable() {
        const list = document.getElementById('navTabs');
        if (!list || _sortableInstance || typeof Sortable === 'undefined') return;
        _sortableInstance = Sortable.create(list, {
            animation: 150,
            draggable: '.nav-item',
            filter: '.nav-tab-del-btn',
            preventOnFilter: false,
            onEnd() {
                const tierId = _getCurrentTierId();
                const order  = Array.from(list.querySelectorAll('.nav-item[data-tab]'))
                    .filter(li => li.style.display !== 'none')
                    .map(li => li.dataset.tab);
                saveTabOrderForTier(tierId, order);
            }
        });
    }

    // ── Public API ─────────────────────────────────────────────

    /**
     * All currently visible tabs (built-in non-hidden + custom).
     * Returns array of { id, label, custom, protected }.
     */
    function getTabs() {
        const hidden = loadHidden();
        const custom = loadCustom();
        const result = BUILTIN
            .filter(t => !hidden.has(t.id))
            .map(t => ({ id: t.id, label: t.label, custom: false, protected: !!t.protected }));
        custom.forEach(c => result.push({ id: c.id, label: c.label, custom: true, protected: false }));
        return result;
    }

    /**
     * Tab IDs visible for a given tier.
     * Delegates to VPMTierManager when available (authoritative source).
     * Falls back to TIER_BASE + hidden/custom logic.
     */
    function getTabsForTier(tier) {
        if (typeof VPMTierManager !== 'undefined') {
            return VPMTierManager.getTabsForTier(tier);
        }
        const base = TIER_BASE[tier] || TIER_BASE[1];
        const hidden = loadHidden();
        const custom = loadCustom();
        const result = base.filter(id => !hidden.has(id));
        custom.filter(c => (c.tier || 1) === tier).forEach(c => result.push(c.id));
        return result;
    }

    /**
     * Hide a built-in tab from the sidebar (persisted; restore via restoreHiddenTabs).
     */
    function hideTab(id) {
        const def = BUILTIN.find(t => t.id === id);
        if (!def || def.protected) return false;
        const set = loadHidden();
        set.add(id);
        saveHidden(set);
        _removeNavItem(id);
        _dispatch();
        return true;
    }

    /**
     * Restore all hidden built-in tabs.
     */
    function restoreHiddenTabs() {
        localStorage.removeItem(HIDDEN_KEY);
        renderNav();
        _dispatch();
    }

    /**
     * Add a new custom tab for the currently active tier.
     * Returns the generated tab id.
     */
    function addTab(label) {
        const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        const id = 'custom-' + slug + '-' + Date.now();
        // Read tier from the active tier button (DOM is the source of truth for visual state)
        const activeBtn = document.querySelector('.tier-btn.active');
        const tier = activeBtn ? parseInt(activeBtn.dataset.tier) || 1
                               : parseInt(localStorage.getItem('vpm-current-tier') || '1');
        const custom = loadCustom();
        custom.push({ id, label, tier });
        saveCustom(custom);

        // Append new tab to this tier's saved drag order so it persists in position
        const allOrders = _loadOrder();
        const tierOrder  = allOrders[String(tier)] || getOrderedTabsForTier(tier);
        if (!tierOrder.includes(id)) tierOrder.push(id);
        allOrders[String(tier)] = tierOrder;
        _saveOrder(allOrders);

        _appendNavItem({ id, label, custom: true });
        _createPanel(id);
        _dispatch();
        return id;
    }

    /**
     * Permanently remove a custom tab (also removes its custom charts via VPMAdmin).
     */
    function removeCustomTab(id) {
        let custom = loadCustom();
        custom = custom.filter(c => c.id !== id);
        saveCustom(custom);
        _removeNavItem(id);
        const panel = document.getElementById('panel-' + id);
        if (panel) panel.remove();
        _dispatch();
    }

    // ── DOM helpers ────────────────────────────────────────────

    function _removeNavItem(id) {
        const li = document.querySelector(`.nav-item[data-tab="${id}"]`);
        if (li) li.remove();
    }

    function _appendNavItem(tab) {
        const list = document.getElementById('navTabs');
        if (!list || list.querySelector(`.nav-item[data-tab="${tab.id}"]`)) return;
        const li = document.createElement('li');
        li.className = 'nav-item';
        li.dataset.tab = tab.id;
        li.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none">${CUSTOM_SVG}</svg><span>${tab.label}</span>`;
        list.appendChild(li);
        _addManagementBtn(li, tab.id, true);
    }

    /**
     * Add the × management button to a nav item (idempotent).
     * isCustom=true  → deletes the tab permanently
     * isCustom=false → hides the built-in tab
     */
    function _addManagementBtn(li, id, isCustom) {
        if (li.querySelector('.nav-tab-del-btn')) return;
        const btn = document.createElement('button');
        btn.className = 'nav-tab-del-btn';
        btn.title = isCustom ? 'Delete this tab permanently' : 'Hide this tab from the sidebar';
        btn.innerHTML = '&times;';
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const label = li.querySelector('span')?.textContent || id;
            if (isCustom) {
                if (!confirm(`Delete tab "${label}" permanently? Any custom charts on this tab will also be deleted.`)) return;
                if (!confirm('Are you sure? This cannot be undone.')) return;
                if (typeof VPMAdmin !== 'undefined') VPMAdmin.removeAllChartsForTab(id);
                removeCustomTab(id);
            } else {
                if (!confirm(`Hide tab "${label}" from the sidebar?`)) return;
                hideTab(id);
            }
        });
        li.appendChild(btn);
    }

    function _createPanel(tabId) {
        const content = document.getElementById('tabContent');
        if (!content || document.getElementById('panel-' + tabId)) return;
        const section = document.createElement('section');
        section.className = 'tab-panel';
        section.id = 'panel-' + tabId;
        section.innerHTML = '<div class="custom-tab-placeholder"><p class="custom-tab-hint">Use Chart Builder (Alt+D) to add charts to this tab.</p></div>';
        content.appendChild(section);
    }

    // ── Full nav render ────────────────────────────────────────

    /**
     * Sync DOM nav list with current state.
     * Called on init and after restoreHiddenTabs.
     */
    function renderNav() {
        const list = document.getElementById('navTabs');
        if (!list) return;

        const hidden = loadHidden();
        const custom = loadCustom();

        // Show/hide existing static built-in items
        BUILTIN.forEach(def => {
            const li = list.querySelector(`.nav-item[data-tab="${def.id}"]`);
            if (!li) return;
            li.style.display = hidden.has(def.id) ? 'none' : '';
            // Add management button to non-protected tabs (idempotent)
            if (!def.protected) _addManagementBtn(li, def.id, false);
        });

        // Ensure custom tab items and panels exist
        custom.forEach(c => {
            if (!list.querySelector(`.nav-item[data-tab="${c.id}"]`)) {
                _appendNavItem({ id: c.id, label: c.label, custom: true });
            }
            _createPanel(c.id);
        });

        // Ensure "+" add button exists
        _ensureAddButton();

        // Restore drag order for current tier
        reorderNav(getOrderedTabsForTier(_getCurrentTierId()));
    }

    function _ensureAddButton() {
        const nav = document.querySelector('.sidebar nav, #sidebar') || document.getElementById('navTabs')?.parentElement;
        const list = document.getElementById('navTabs');
        if (!list) return;
        if (document.querySelector('.nav-add-tab-btn')) return;

        const btn = document.createElement('button');
        btn.className = 'nav-add-tab-btn';
        btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> New Tab';

        function _syncTitle() {
            const activeBtn = document.querySelector('.tier-btn.active');
            const t = activeBtn ? activeBtn.dataset.tier : '1';
            btn.title = 'Add tab to T' + t;
        }
        _syncTitle();
        // Keep title in sync when tier changes (tier buttons or tabs change)
        document.addEventListener('vpm:tabsChanged', _syncTitle);
        document.addEventListener('click', (e) => {
            if (e.target.closest('.tier-btn')) setTimeout(_syncTitle, 0);
        });

        btn.addEventListener('click', () => {
            const label = prompt('Enter tab name:');
            if (!label || !label.trim()) return;
            addTab(label.trim());
        });
        // Insert after the nav list
        list.insertAdjacentElement('afterend', btn);
    }

    // ── Event dispatch ─────────────────────────────────────────

    function _dispatch() {
        document.dispatchEvent(new CustomEvent('vpm:tabsChanged'));
    }

    // ── Init ──────────────────────────────────────────────────

    function init() {
        renderNav();
        _initSortable();
    }

    return {
        init,
        getTabs,
        getTabsForTier,
        hideTab,
        restoreHiddenTabs,
        addTab,
        removeCustomTab,
        renderNav,
        reorderNav,
        getOrderedTabsForTier,
        saveTabOrderForTier,
        BUILTIN
    };
})();
