/**
 * VPM Chart Layout — drag-and-drop (SortableJS) + width toggle.
 * Covers both chart-card grids and KPI card grids.
 * Layout stored per tier (T1/T2/T3). Save/Reset activate on dirty state only.
 */
const VPMLayout = (() => {
    'use strict';

    // ── Storage keys ──────────────────────────────────────────────────────────

    const CHART_KEY = 'vpm-layout-v1';
    const KPI_KEY   = 'vpm-kpi-layout-v1';

    function currentTier() {
        return (typeof VPMEscalation !== 'undefined') ? VPMEscalation.getCurrentTier() : 1;
    }
    function chartStorageKey() { return CHART_KEY + '-t' + currentTier(); }
    function kpiStorageKey()   { return KPI_KEY   + '-t' + currentTier(); }

    function getChartLayout() {
        try { return JSON.parse(localStorage.getItem(chartStorageKey()) || '{}'); } catch { return {}; }
    }
    function setChartLayout(obj) { localStorage.setItem(chartStorageKey(), JSON.stringify(obj)); }

    function getKpiLayout() {
        try { return JSON.parse(localStorage.getItem(kpiStorageKey()) || '{}'); } catch { return {}; }
    }
    function setKpiLayout(obj) { localStorage.setItem(kpiStorageKey(), JSON.stringify(obj)); }

    // ── Card key helpers ──────────────────────────────────────────────────────

    function chartCardKey(card) {
        const canvas = card.querySelector('canvas');
        if (canvas && canvas.id) return canvas.id;
        const el = card.querySelector('[id]');
        return el ? el.id : null;
    }

    function kpiCardKey(card) {
        const canvas = card.querySelector('canvas');
        if (canvas && canvas.id) return canvas.id;
        const el = card.querySelector('[id]');
        return el ? el.id : null;
    }

    // ── Snapshots ─────────────────────────────────────────────────────────────

    function _cardWidth(card) {
        if (card.classList.contains('wide'))    return 'wide';
        if (card.classList.contains('quarter')) return 'quarter';
        return 'half';
    }

    function snapshotChartGrid(grid) {
        const order = [], widths = {};
        grid.querySelectorAll('.chart-card').forEach(card => {
            const k = chartCardKey(card);
            if (k) { order.push(k); widths[k] = _cardWidth(card); }
        });
        return { order, widths };
    }

    function snapshotKpiGrid(grid) {
        const order = [];
        grid.querySelectorAll('.kpi-card').forEach(c => {
            const k = kpiCardKey(c); if (k) order.push(k);
        });
        return order;
    }

    // ── Dirty detection ───────────────────────────────────────────────────────

    function isChartGridDirty(grid) {
        const panelId = grid.dataset.panelId;
        const saved   = getChartLayout()[panelId];
        const current = snapshotChartGrid(grid);
        const baseOrder  = saved ? saved.order  : JSON.parse(grid.dataset.originalOrder || '[]');
        const baseWidths = saved ? saved.widths : {};
        return JSON.stringify(current.order)  !== JSON.stringify(baseOrder) ||
               JSON.stringify(current.widths) !== JSON.stringify(baseWidths);
    }

    function isKpiGridDirty(grid) {
        const gridId  = grid.dataset.kpiId;
        const saved   = getKpiLayout()[gridId] || [];
        const current = snapshotKpiGrid(grid);
        const base    = saved.length ? saved : JSON.parse(grid.dataset.originalOrder || '[]');
        return JSON.stringify(current) !== JSON.stringify(base);
    }

    function checkDirty() {
        const chartsDirty = Array.from(document.querySelectorAll('.layout-grid')).some(isChartGridDirty);
        const kpiDirty    = Array.from(document.querySelectorAll('[data-kpi-id]')).some(isKpiGridDirty);
        const dirty = chartsDirty || kpiDirty;
        const saveBtn = document.getElementById('saveLayoutBtn');
        const resetBtn= document.getElementById('resetLayoutBtn');
        const actions = document.getElementById('layoutActions');
        // Save always enabled — changes auto-save but users expect to click it
        if (saveBtn)  saveBtn.disabled  = false;
        if (resetBtn) resetBtn.disabled = !dirty;
        if (actions)  actions.classList.toggle('has-changes', dirty);
    }

    // ── Apply layout helpers ──────────────────────────────────────────────────

    function applyChartOrder(cards, savedOrder) {
        if (!savedOrder || !savedOrder.length) return cards;
        const byKey = {};
        cards.forEach(c => { const k = chartCardKey(c); if (k) byKey[k] = c; });
        const ordered = [];
        savedOrder.forEach(k => { if (byKey[k]) { ordered.push(byKey[k]); delete byKey[k]; } });
        cards.forEach(c => { const k = chartCardKey(c); if (!k || byKey[k]) ordered.push(c); });
        return ordered;
    }

    function applyChartGridLayout(grid, order, widths) {
        const byKey = {};
        grid.querySelectorAll('.chart-card').forEach(c => {
            const k = chartCardKey(c); if (!k) return;
            byKey[k] = c;
            const w = widths[k];
            c.classList.toggle('wide',    w === 'wide');
            c.classList.toggle('quarter', w === 'quarter');
            syncAllWidthBtns(c);
        });
        order.forEach(k => { if (byKey[k]) grid.appendChild(byKey[k]); });
        grid.querySelectorAll('canvas').forEach(canvas => {
            const ch = window.Chart && Chart.getChart(canvas);
            if (ch) setTimeout(() => ch.resize(), 60);
        });
    }

    function applyKpiGridOrder(grid, order) {
        const byKey = {};
        grid.querySelectorAll('.kpi-card').forEach(c => {
            const k = kpiCardKey(c); if (k) byKey[k] = c;
        });
        order.forEach(k => { if (byKey[k]) grid.appendChild(byKey[k]); });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CHART CARD GRIDS
    // ═══════════════════════════════════════════════════════════════════════

    function initTab(panelId) {
        const panel = document.getElementById(panelId);
        if (!panel) return;

        const existingGrid = panel.querySelector('.layout-grid');
        if (existingGrid) {
            existingGrid.querySelectorAll('.chart-card').forEach(card => {
                if (!card.querySelector('.layout-controls')) addChartControls(card, panelId);
            });
            return;
        }

        const rows = Array.from(panel.querySelectorAll('.charts-row'));
        if (!rows.length) return;

        const tabLayout = getChartLayout()[panelId] || {};
        let cards = [];
        rows.forEach(row => Array.from(row.querySelectorAll('.chart-card')).forEach(c => cards.push(c)));

        const originalOrder = cards.map(chartCardKey).filter(Boolean);
        cards = applyChartOrder(cards, tabLayout.order || []);

        const grid = document.createElement('div');
        grid.className = 'layout-grid';
        grid.dataset.panelId       = panelId;
        grid.dataset.originalOrder = JSON.stringify(originalOrder);

        cards.forEach(card => {
            const k = chartCardKey(card);
            const w = k && tabLayout.widths && tabLayout.widths[k];
            card.classList.toggle('wide',    w === 'wide');
            card.classList.toggle('quarter', w === 'quarter');
            addChartControls(card, panelId);
            grid.appendChild(card);
        });

        rows[0].parentNode.insertBefore(grid, rows[0]);
        rows.forEach(r => r.remove());
        setupChartSort(grid, panelId);
        checkDirty();
    }

    function addChartControls(card, panelId) {
        if (card.querySelector('.layout-controls')) return;
        const header = card.querySelector('.chart-header');
        if (!header) return;

        const wrap = document.createElement('div');
        wrap.className = 'layout-controls';
        wrap.innerHTML = `
            <button class="layout-btn width-btn" title="Expand to full width">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <rect x="1" y="5" width="6" height="6" rx="1.2" stroke="currentColor" stroke-width="1.4"/>
                    <rect x="9" y="5" width="6" height="6" rx="1.2" stroke="currentColor" stroke-width="1.4"/>
                </svg>
            </button>
            <button class="layout-btn quarter-btn" title="Shrink to quarter width">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <rect x="1"  y="1"  width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.4"/>
                    <rect x="9"  y="1"  width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.4"/>
                    <rect x="1"  y="9"  width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.4"/>
                    <rect x="9"  y="9"  width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.4"/>
                </svg>
            </button>
            <div class="drag-handle" title="Drag to reorder">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <circle cx="6"  cy="4"  r="1.4" fill="currentColor"/>
                    <circle cx="10" cy="4"  r="1.4" fill="currentColor"/>
                    <circle cx="6"  cy="8"  r="1.4" fill="currentColor"/>
                    <circle cx="10" cy="8"  r="1.4" fill="currentColor"/>
                    <circle cx="6"  cy="12" r="1.4" fill="currentColor"/>
                    <circle cx="10" cy="12" r="1.4" fill="currentColor"/>
                </svg>
            </div>`;
        header.appendChild(wrap);

        syncAllWidthBtns(card);

        const widthBtn    = wrap.querySelector('.width-btn');
        const quarterBtn  = wrap.querySelector('.quarter-btn');

        widthBtn.addEventListener('click', () => {
            // Toggle: if already wide → go to half; otherwise → go wide (remove quarter)
            if (card.classList.contains('wide')) {
                card.classList.remove('wide');
            } else {
                card.classList.add('wide');
                card.classList.remove('quarter');
            }
            syncAllWidthBtns(card);
            _resizeAndSave(card);
        });

        quarterBtn.addEventListener('click', () => {
            // Toggle: if already quarter → go to half; otherwise → go quarter (remove wide)
            if (card.classList.contains('quarter')) {
                card.classList.remove('quarter');
            } else {
                card.classList.add('quarter');
                card.classList.remove('wide');
            }
            syncAllWidthBtns(card);
            _resizeAndSave(card);
        });
    }

    function _resizeAndSave(card) {
        saveCurrentLayout();
        card.querySelectorAll('canvas').forEach(canvas => {
            const ch = window.Chart && Chart.getChart(canvas);
            if (ch) setTimeout(() => ch.resize(), 60);
        });
    }

    /** Update both width buttons on a card to reflect current state */
    function syncAllWidthBtns(card) {
        const isWide    = card.classList.contains('wide');
        const isQuarter = card.classList.contains('quarter');
        const widthBtn   = card.querySelector('.width-btn');
        const quarterBtn = card.querySelector('.quarter-btn');
        if (widthBtn) {
            widthBtn.title = isWide ? 'Shrink to half width' : 'Expand to full width';
            widthBtn.classList.toggle('wide-active', isWide);
        }
        if (quarterBtn) {
            quarterBtn.title = isQuarter ? 'Expand to half width' : 'Shrink to quarter width';
            quarterBtn.classList.toggle('wide-active', isQuarter);
        }
    }

    /** @deprecated kept for compatibility — use syncAllWidthBtns */
    function syncWidthBtn(btn, isWide) {
        if (!btn) return;
        btn.title = isWide ? 'Shrink to half width' : 'Expand to full width';
        btn.classList.toggle('wide-active', isWide);
    }

    function setupChartSort(grid, panelId) {
        if (typeof Sortable === 'undefined') return;
        Sortable.create(grid, {
            animation: 150, handle: '.drag-handle',
            ghostClass: 'sort-ghost', chosenClass: 'sort-chosen', dragClass: 'sort-drag',
            onEnd() {
                saveCurrentLayout(); // auto-save immediately
                grid.querySelectorAll('canvas').forEach(canvas => {
                    const ch = window.Chart && Chart.getChart(canvas);
                    if (ch) setTimeout(() => ch.resize(), 60);
                });
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // KPI CARD GRIDS
    // ═══════════════════════════════════════════════════════════════════════

    function initKpiGrid(gridId) {
        const grid = document.getElementById(gridId);
        if (!grid) return;

        const alreadyInited = !!grid.dataset.kpiId;
        grid.dataset.kpiId = gridId;

        const cards = Array.from(grid.querySelectorAll('.kpi-card'));
        grid.dataset.originalOrder = JSON.stringify(cards.map(kpiCardKey).filter(Boolean));

        // Apply saved order for this tier
        const saved = getKpiLayout()[gridId] || [];
        if (saved.length) applyKpiGridOrder(grid, saved);

        // Always apply visibility (cards may have been rebuilt by buildKpiCards)
        applyKpiVisibility(grid);

        // Add drag handle to each KPI card header
        grid.querySelectorAll('.kpi-card').forEach(addKpiHandle);

        if (!alreadyInited) {
            if (typeof Sortable !== 'undefined') {
                Sortable.create(grid, {
                    animation: 150, handle: '.kpi-drag-handle',
                    ghostClass: 'sort-ghost', chosenClass: 'sort-chosen', dragClass: 'sort-drag',
                    onEnd() { saveCurrentLayout(); } // auto-save immediately
                });
            }

            setupKpiConfigureBtn(grid);
        }
        checkDirty();
    }

    function addKpiHandle(card) {
        if (card.querySelector('.kpi-drag-handle')) return;
        const header = card.querySelector('.kpi-header');
        if (!header) return;
        const handle = document.createElement('div');
        handle.className = 'kpi-drag-handle';
        handle.title = 'Drag to reorder';
        handle.innerHTML = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <circle cx="6"  cy="4"  r="1.3" fill="currentColor"/>
            <circle cx="10" cy="4"  r="1.3" fill="currentColor"/>
            <circle cx="6"  cy="8"  r="1.3" fill="currentColor"/>
            <circle cx="10" cy="8"  r="1.3" fill="currentColor"/>
            <circle cx="6"  cy="12" r="1.3" fill="currentColor"/>
            <circle cx="10" cy="12" r="1.3" fill="currentColor"/>
        </svg>`;
        header.appendChild(handle);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // KPI VISIBILITY (which cards appear on overview)
    // ═══════════════════════════════════════════════════════════════════════

    const KPI_VIS_KEY = 'vpm-kpi-visible-v1';

    function kpiVisStorageKey() { return KPI_VIS_KEY + '-t' + currentTier(); }

    function getKpiVisible() {
        try { return JSON.parse(localStorage.getItem(kpiVisStorageKey()) || 'null'); } catch { return null; }
    }

    function setKpiVisible(arr) { localStorage.setItem(kpiVisStorageKey(), JSON.stringify(arr)); }

    // Apply visibility: hide/show cards based on saved list (null = all visible)
    function applyKpiVisibility(grid) {
        const visible = getKpiVisible();   // null means all shown
        grid.querySelectorAll('.kpi-card').forEach(card => {
            const k = kpiCardKey(card);
            const show = !visible || visible.includes(k);
            card.classList.toggle('kpi-hidden', !show);
        });
    }

    // Build / refresh the configure panel
    function renderKpiConfigurePanel(grid) {
        const panel = document.getElementById('kpiConfigurePanel');
        if (!panel) return;

        const visible = getKpiVisible();   // null = all
        const sel     = getMetricSel();
        const cards   = Array.from(grid.querySelectorAll('.kpi-card'));
        const allOpts = getKpiMetricOptions();

        panel.innerHTML = `
            <div class="kpi-cfg-title">Configure KPI cards for T${currentTier()}</div>
            <div class="kpi-cfg-toggles">
                ${cards.map(card => {
                    const k       = kpiCardKey(card);
                    const label   = card.querySelector('.kpi-label')?.textContent || k;
                    const checked = !visible || visible.includes(k);
                    const opts    = allOpts[k] || [];
                    const curSel  = sel[k] || (opts[0]?.id || '');
                    const selectHtml = opts.length > 1
                        ? `<select class="kpi-metric-sel" data-key="${k}" title="Choose metric to display">
                               ${opts.map(m => `<option value="${m.id}"${m.id === curSel ? ' selected' : ''}>${m.label}</option>`).join('')}
                           </select>`
                        : '';
                    return `<label class="kpi-cfg-item ${checked ? '' : 'kpi-cfg-off'}">
                        <input type="checkbox" class="kpi-cfg-check" data-key="${k}" ${checked ? 'checked' : ''}>
                        <span class="kpi-cfg-name">${label}</span>
                        ${selectHtml}
                    </label>`;
                }).join('')}
            </div>
            <div class="kpi-cfg-actions">
                <button class="kpi-cfg-all-btn" id="kpiCfgShowAll">Show All</button>
            </div>`;

        // Checkbox change — toggle visibility and auto-save
        panel.querySelectorAll('.kpi-cfg-check').forEach(cb => {
            cb.addEventListener('change', () => {
                const checkedKeys = Array.from(panel.querySelectorAll('.kpi-cfg-check:checked')).map(c => c.dataset.key);
                const allKeys     = cards.map(kpiCardKey).filter(Boolean);
                const toStore     = checkedKeys.length === allKeys.length ? null : checkedKeys;
                setKpiVisible(toStore);
                applyKpiVisibility(grid);
                cb.closest('.kpi-cfg-item').classList.toggle('kpi-cfg-off', !cb.checked);
                saveCurrentLayout(); // auto-save immediately
            });
        });

        // Metric select change — update stored selection + re-apply to card
        panel.querySelectorAll('.kpi-metric-sel').forEach(selEl => {
            selEl.addEventListener('change', (e) => {
                // stop label click from toggling checkbox
                e.stopPropagation();
                const k   = selEl.dataset.key;
                const cur = getMetricSel();
                cur[k]    = selEl.value;
                setMetricSel(cur);
                // Signal app.js to re-apply metric selections with current data
                document.dispatchEvent(new CustomEvent('vpm:applyKpiMetrics'));
            });

            // Prevent label click from toggling the checkbox when clicking the select
            selEl.addEventListener('click', e => e.stopPropagation());
        });

        // Show all — auto-save
        panel.querySelector('#kpiCfgShowAll').addEventListener('click', () => {
            setKpiVisible(null);
            applyKpiVisibility(grid);
            renderKpiConfigurePanel(grid);
            saveCurrentLayout(); // auto-save immediately
        });
    }

    // Wire the Configure button
    function setupKpiConfigureBtn(grid) {
        const btn   = document.getElementById('kpiConfigureBtn');
        const panel = document.getElementById('kpiConfigurePanel');
        if (!btn || !panel) return;

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = !panel.hidden;
            panel.hidden = open;
            btn.classList.toggle('active', !open);
            if (!open) renderKpiConfigurePanel(grid);
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!panel.hidden && !panel.contains(e.target) && e.target !== btn) {
                panel.hidden = true;
                btn.classList.remove('active');
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // KPI METRIC PICKER (which specific metric each card shows)
    // ═══════════════════════════════════════════════════════════════════════

    const KPI_METRIC_SEL_KEY = 'vpm-kpi-metric-v1';
    function metricSelKey() { return KPI_METRIC_SEL_KEY + '-t' + currentTier(); }
    function getMetricSel()  { try { return JSON.parse(localStorage.getItem(metricSelKey()) || '{}'); } catch { return {}; } }
    function setMetricSel(o) { localStorage.setItem(metricSelKey(), JSON.stringify(o)); }

    // Helper: last non-null value in an array
    function lastVal(arr) {
        if (!arr) return null;
        for (let i = arr.length - 1; i >= 0; i--) if (arr[i] !== null && arr[i] !== undefined) return arr[i];
        return null;
    }
    function fmtPct(v)  { return v !== null && v !== undefined ? (v * 100).toFixed(1) + '%' : '--'; }
    function fmtNum(v)  { return v !== null && v !== undefined ? Number(v).toLocaleString() : '--'; }
    function fmtK(v)    { return v !== null && v !== undefined ? Math.round(v / 1000) + 'k' : '--'; }
    function tn(arr)    { return (arr || []).filter(v => v !== null && v !== undefined); }

    // ── Dynamic KPI metric discovery ────────────────────────────────────
    // Scans each tab panel for real chart cards and builds dropdown options
    // from what actually exists. Custom Data Studio charts are included.

    // Tabs that don't have chart data — excluded from KPI cards
    const _NO_KPI_TABS = ['overview', 'actions', 'feedback', 'recognitions', 'ci'];

    // Built dynamically from available tabs
    let KPI_TO_PANEL = {};
    const _METRIC_COLORS = ['#22c55e','#3b82f6','#f59e0b','#8b5cf6','#06b6d4','#ef4444','#f97316','#a855f7','#ec4899','#14b8a6'];

    /** Generate KPI cards into the grid from available tabs. */
    function _buildKpiCards() {
        const grid = document.getElementById('kpiGridMain');
        if (!grid) return;

        const tier = (typeof VPMEscalation !== 'undefined') ? VPMEscalation.getCurrentTier() : 1;

        // Get tabs for the CURRENT tier only, exclude non-chart tabs
        let tabs = [];
        if (typeof VPMTierManager !== 'undefined') {
            const TAB_LABELS = { safety:'Safety', people:'People', quality:'Quality', production:'Production',
                supplychain:'Supply Chain', cost:'Cost', maintenance:'Maintenance', engineering:'Engineering' };
            const rawTabs = VPMTierManager.getTabsForTier(tier);
            tabs = rawTabs
                .map(t => typeof t === 'string' ? { id: t, label: TAB_LABELS[t] || t.charAt(0).toUpperCase() + t.slice(1) } : t)
                .filter(t => !_NO_KPI_TABS.includes(t.id));
        } else if (typeof VPMTabManager !== 'undefined') {
            tabs = VPMTabManager.getTabs().filter(t => !_NO_KPI_TABS.includes(t.id));
        } else {
            document.querySelectorAll('.nav-item[data-tab]').forEach(el => {
                const id = el.dataset.tab;
                if (!_NO_KPI_TABS.includes(id)) {
                    tabs.push({ id, label: el.textContent.trim() });
                }
            });
        }

        // Deduplicate by tab id
        const seen = new Set();
        tabs = tabs.filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true; });

        // Clear existing cards (preserve configure panel)
        grid.querySelectorAll('.kpi-card').forEach(c => c.remove());

        // Build KPI_TO_PANEL mapping and create cards
        KPI_TO_PANEL = {};
        tabs.forEach(tab => {
            const sparkId = 'sparkline-' + tab.id;
            const panelId = 'panel-' + tab.id;
            // Only add if the panel exists in the DOM
            if (!document.getElementById(panelId)) return;

            KPI_TO_PANEL[sparkId] = panelId;

            const card = document.createElement('div');
            card.className = 'kpi-card kpi-' + tab.id;
            card.innerHTML =
                '<div class="kpi-header">' +
                    '<span class="kpi-label">' + (tab.label || tab.id).toUpperCase() + '</span>' +
                    '<span class="kpi-badge badge-green" style="visibility:hidden">OK</span>' +
                    '<button class="kpi-data-btn" title="Quick data entry">+Data</button>' +
                    '<img class="kpi-drag-handle" src="data:image/svg+xml,' + encodeURIComponent('<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' fill=\'%2394a3b8\'><circle cx=\'3\' cy=\'3\' r=\'1.2\'/><circle cx=\'9\' cy=\'3\' r=\'1.2\'/><circle cx=\'3\' cy=\'9\' r=\'1.2\'/><circle cx=\'9\' cy=\'9\' r=\'1.2\'/></svg>') + '" draggable="false">' +
                '</div>' +
                '<div class="kpi-value">--</div>' +
                '<div class="kpi-sub">' + (tab.label || tab.id) + '</div>' +
                '<div class="sparkline-wrap"><canvas id="' + sparkId + '" class="sparkline"></canvas></div>';
            grid.appendChild(card);
        });
    }

    // Read last value from a Chart.js instance on a canvas.
    // Picks the dataset with the most variation (actual data, not a flat target line).
    // Also detects flat reference lines as potential targets.
    function _readChart(canvas) {
        try {
            if (!canvas || typeof Chart === 'undefined') return null;
            const ch = Chart.getChart(canvas);
            if (!ch?.data?.datasets?.length) return null;

            let bestDs = null, bestVar = -1, bestVals = [];

            for (const ds of ch.data.datasets) {
                const vals = (ds.data || []).filter(v => v !== null && v !== undefined && !isNaN(v));
                if (!vals.length) continue;
                const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
                const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
                if (variance > bestVar || (variance === bestVar && vals.length > bestVals.length)) {
                    bestVar = variance;
                    bestDs  = ds;
                    bestVals = vals;
                }
            }
            if (!bestVals.length) return null;

            const last = bestVals[bestVals.length - 1];
            const fv   = Math.abs(last) < 1 && last !== 0
                ? (last * 100).toFixed(1) + '%'
                : Number(last).toLocaleString();

            // Detect a flat target from the other datasets
            let target = null;
            for (const ds of ch.data.datasets) {
                if (ds === bestDs) continue;
                const tv = (ds.data || []).filter(v => v !== null && v !== undefined);
                if (tv.length && tv.every(v => v === tv[0])) { target = tv[0]; break; }
            }

            // Read trigger result stored by charts.js evaluateTrigger
            let triggerResult = null;
            try {
                if (canvas.dataset.triggerResult) triggerResult = JSON.parse(canvas.dataset.triggerResult);
            } catch (_) { /* ignore */ }

            return {
                val: fv, raw: last, spark: bestVals, target, triggerResult,
                color: bestDs.borderColor || bestDs.backgroundColor || null
            };
        } catch { return null; }
    }

    function _discoverMetrics(panelId) {
        const panel = document.getElementById(panelId);
        if (!panel) return [];

        const metrics = [];
        const seen = new Set();
        let ci = 0;

        panel.querySelectorAll('.chart-card').forEach(card => {
            const titleEl = card.querySelector('.chart-header h3, .chart-title');
            const title   = titleEl?.textContent?.trim();
            if (!title) return;
            // Skip escalation / cascade / message boards
            if (/escalation|cascade/i.test(title)) return;

            // Primary canvas (not sparklines)
            const canvas  = card.querySelector('canvas:not(.sparkline)');
            const chartId = canvas?.id
                || ('card-' + (card.dataset.customChartId || title.replace(/\W+/g, '-').toLowerCase()));
            if (seen.has(chartId)) return;
            seen.add(chartId);

            const color = _METRIC_COLORS[ci++ % _METRIC_COLORS.length];

            metrics.push({
                id: chartId,
                label: title,
                color,
                dir: null,
                get: () => {
                    // Try reading from Chart.js instance
                    if (canvas) {
                        const r = _readChart(canvas);
                        if (r) {
                            // Use the chart's own dataset colour when available
                            if (r.color) r._color = r.color;
                            return r;
                        }
                    }
                    return { val: '--', raw: null, spark: [], target: null };
                }
            });
        });

        return metrics;
    }

    // Build the full metric options map (replaces old hardcoded KPI_METRIC_OPTIONS)
    function getKpiMetricOptions() {
        const result = {};
        for (const [sparkKey, panelId] of Object.entries(KPI_TO_PANEL)) {
            result[sparkKey] = _discoverMetrics(panelId);
        }
        return result;
    }

    // Apply selected metric to a KPI card, updating value + sparkline.
    // Sub-label always comes from metric.label — no per-metric hardcoding needed.
    function applyKpiMetricSelections(data) {
        if (!data) return;
        const sel  = getMetricSel();
        const grid = document.getElementById('kpiGridMain');
        if (!grid) return;
        const allOpts = getKpiMetricOptions();

        grid.querySelectorAll('.kpi-card').forEach(card => {
            const k        = kpiCardKey(card);
            const opts     = allOpts[k] || [];
            if (!opts.length) return;

            // Use saved selection; fall back to first available metric so every tier
            // always shows its own independent defaults rather than stale DOM from another tier.
            const metricId = sel[k] || opts[0].id;
            const metric   = opts.find(m => m.id === metricId);
            if (!metric) return;

            const result = metric.get(data);
            if (!result) return;

            const valEl   = card.querySelector('.kpi-value');
            const subEl   = card.querySelector('.kpi-sub');
            const badgeEl = card.querySelector('.kpi-badge');
            if (valEl) valEl.textContent = result.val;
            if (subEl) subEl.textContent = metric.label;   // always the metric's own label

            // Update badge — use trigger result if available, else direction-based
            if (badgeEl) {
                if (result.triggerResult) {
                    const t = result.triggerResult;
                    badgeEl.style.visibility = '';
                    badgeEl.textContent = t.triggered ? 'ALERT' : 'OK';
                    badgeEl.className = 'kpi-badge ' + (t.triggered ? 'badge-red' : 'badge-green');
                } else if (typeof VPMCharts !== 'undefined') {
                    VPMCharts._kpiBadge(badgeEl, result.raw ?? null, result.target ?? null, metric.dir ?? null);
                }
            }

            // Update sparkline via VPMCharts if available
            if (result.spark && result.spark.length && typeof VPMCharts !== 'undefined') {
                const sparkColor = result._color || metric.color;
                VPMCharts.buildSparkline(k, result.spark, sparkColor, result.target ?? null);
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SAVE / RESET / REFRESH
    // ═══════════════════════════════════════════════════════════════════════

    function saveCurrentLayout() {
        // Chart grids
        const chartLayout = getChartLayout();
        document.querySelectorAll('.layout-grid').forEach(grid => {
            const p = grid.dataset.panelId;
            if (p) chartLayout[p] = snapshotChartGrid(grid);
        });
        setChartLayout(chartLayout);

        // KPI grids
        const kpiLayout = getKpiLayout();
        document.querySelectorAll('[data-kpi-id]').forEach(grid => {
            kpiLayout[grid.dataset.kpiId] = snapshotKpiGrid(grid);
        });
        setKpiLayout(kpiLayout);

        checkDirty();
    }

    function resetLayout() {
        // Chart grids
        const chartLayout = getChartLayout();
        document.querySelectorAll('.layout-grid').forEach(grid => {
            const p    = grid.dataset.panelId;
            const saved = chartLayout[p];
            const orig  = JSON.parse(grid.dataset.originalOrder || '[]');
            applyChartGridLayout(grid, saved ? saved.order : orig, saved ? saved.widths : {});
        });

        // KPI grids
        const kpiLayout = getKpiLayout();
        document.querySelectorAll('[data-kpi-id]').forEach(grid => {
            const saved = kpiLayout[grid.dataset.kpiId] || [];
            const orig  = JSON.parse(grid.dataset.originalOrder || '[]');
            applyKpiGridOrder(grid, saved.length ? saved : orig);
        });

        checkDirty();
    }

    function refreshForTier() {
        // Rebuild KPI cards for the new tier's tabs
        _buildKpiCards();

        // Chart grids
        const chartLayout = getChartLayout();
        document.querySelectorAll('.layout-grid').forEach(grid => {
            const p     = grid.dataset.panelId;
            const saved = chartLayout[p];
            const orig  = JSON.parse(grid.dataset.originalOrder || '[]');
            applyChartGridLayout(grid, saved ? saved.order : orig, saved ? saved.widths : {});
        });

        // KPI grids — order + visibility
        const kpiLayout = getKpiLayout();
        document.querySelectorAll('[data-kpi-id]').forEach(grid => {
            const saved = kpiLayout[grid.dataset.kpiId] || [];
            const orig  = JSON.parse(grid.dataset.originalOrder || '[]');
            applyKpiGridOrder(grid, saved.length ? saved : orig);
            applyKpiVisibility(grid);
            // Re-render configure panel if open
            const panel = document.getElementById('kpiConfigurePanel');
            if (panel && !panel.hidden) renderKpiConfigurePanel(grid);
        });

        checkDirty();
    }

    // ── Tier change via vpm:requestRender ─────────────────────────────────────

    let _lastTier = null;
    document.addEventListener('vpm:requestRender', () => {
        const tier = currentTier();
        if (_lastTier !== null && _lastTier !== tier) refreshForTier();
        _lastTier = tier;
    });

    // ── Public API ────────────────────────────────────────────────────────────

    return { initTab, initKpiGrid, buildKpiCards: _buildKpiCards, refreshForTier, saveCurrentLayout, resetLayout, checkDirty, applyKpiMetricSelections };
})();
