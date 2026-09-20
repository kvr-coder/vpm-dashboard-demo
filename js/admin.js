/**
 * VPM Admin Data Studio
 * Open with Alt+D  |  Close with Escape
 * Three tabs: Daily Entry | Metric Tables | Chart Builder
 */
const VPMAdmin = (function () {
    'use strict';

    // ====================================================
    // CHART TEMPLATES
    // ====================================================

    const TEMPLATES = [
        // ── Line charts ─────────────────────────────────────────────────────────
        {
            id: 'line-target',
            label: 'Line + Target',
            icon: '📈',
            description: 'Single line with a flat red target reference line',
            showTarget: true, showGreen: false, showInput2: false,
            type: 'line'
        },
        {
            id: 'line-band',
            label: 'Line + Band',
            icon: '📊',
            description: 'Single line with green upper and red lower threshold bands',
            showTarget: false, showGreen: true, showRed: true, showInput2: false,
            type: 'line'
        },
        {
            id: 'simple-line',
            label: 'Simple Line',
            icon: '〰️',
            description: 'Clean trend line with no targets — ideal for raw metrics',
            showTarget: false, showGreen: false, showInput2: false,
            type: 'line'
        },
        {
            id: 'dual-line',
            label: 'Dual Line',
            icon: '↔',
            description: 'Two overlapping line series on the same axis',
            showTarget: false, showGreen: false, showInput2: true,
            type: 'line'
        },
        {
            id: 'multi-line',
            label: 'Multi-Line (3 series)',
            icon: '≋',
            description: 'Three line series on the same axis — great for comparing machines or shifts',
            showTarget: false, showGreen: false, showInput2: true, showInput3: true,
            type: 'multiLine'
        },
        {
            id: 'dual-line-target',
            label: 'Dual Line + Target',
            icon: '📉',
            description: 'Two line series with a shared target reference line',
            showTarget: true, showGreen: false, showInput2: true,
            type: 'line'
        },
        // ── Area charts ──────────────────────────────────────────────────────────
        {
            id: 'area-fill',
            label: 'Area Fill',
            icon: '🏔',
            description: 'Filled area chart — great for volume and MTD trends',
            showTarget: false, showGreen: false, showInput2: false,
            type: 'area'
        },
        {
            id: 'area-target',
            label: 'Area + Target',
            icon: '🎚',
            description: 'Filled area with a flat target reference line',
            showTarget: true, showGreen: false, showInput2: false,
            type: 'area'
        },
        {
            id: 'mtd-cumulative',
            label: 'MTD Cumulative',
            icon: '∑',
            description: 'Running MTD actual vs cumulative target — auto-accumulates daily values',
            showTarget: true, showGreen: false, showInput2: false,
            type: 'line'
        },
        // ── Bar charts ───────────────────────────────────────────────────────────
        {
            id: 'simple-bar',
            label: 'Simple Bar',
            icon: '▌',
            description: 'Basic vertical bar chart — no target overlay',
            showTarget: false, showGreen: false, showInput2: false,
            type: 'bar'
        },
        {
            id: 'bar-target',
            label: 'Bar + Target',
            icon: '📉',
            description: 'Vertical bars with a flat target overlay line',
            showTarget: true, showGreen: false, showInput2: false,
            type: 'bar'
        },
        {
            id: 'bar-band',
            label: 'Bar + Band',
            icon: '🎯',
            description: 'Vertical bars with green upper and red lower threshold lines',
            showTarget: false, showGreen: true, showRed: true, showInput2: false,
            type: 'bar'
        },
        {
            id: 'grouped-bar',
            label: 'Grouped Bars',
            icon: '🗂',
            description: 'Two bar datasets side by side (e.g. Assembly vs CC)',
            showTarget: false, showGreen: false, showInput2: true,
            type: 'bar'
        },
        {
            id: 'stacked-bar',
            label: 'Stacked Bar',
            icon: '📦',
            description: 'Two bar series stacked vertically — useful for KA vs DC, causes, etc.',
            showTarget: false, showGreen: false, showInput2: true,
            type: 'stackedBar'
        },
        {
            id: 'horizontal-bar',
            label: 'Horizontal Bar',
            icon: '↔️',
            description: 'Horizontal bars — great for rankings, comparisons, and named categories',
            showTarget: false, showGreen: false, showInput2: false,
            type: 'horizontalBar'
        },
        {
            id: 'horizontal-bar-target',
            label: 'Horizontal Bar + Target',
            icon: '➡',
            description: 'Horizontal bars with a vertical target reference line',
            showTarget: true, showGreen: false, showInput2: false,
            type: 'horizontalBar'
        },
        // ── Specialty charts ─────────────────────────────────────────────────────
        {
            id: 'donut',
            label: 'Donut / Pie',
            icon: '🍩',
            description: 'Composition chart — each label gets a coloured slice (% breakdown)',
            showTarget: false, showGreen: false, showInput2: false,
            type: 'donut'
        },
        {
            id: 'scatter',
            label: 'Scatter Plot',
            icon: '✦',
            description: 'Correlation chart — plot two variables against each other (X vs Y)',
            showTarget: false, showGreen: false, showInput2: true,
            type: 'scatter'
        },
        {
            id: 'radar',
            label: 'Radar / Spider',
            icon: '🕸',
            description: 'Multi-axis radar chart — compare performance across several categories at once',
            showTarget: false, showGreen: false, showInput2: false,
            type: 'radar'
        },
        // ── Non-chart visuals ────────────────────────────────────────────────────
        {
            id: 'stat-block',
            label: 'Stat / Counter Block',
            icon: '🔢',
            description: 'Large number block — ideal for days without incident, counts, or milestones. Shows current value + optional previous best + milestone.',
            showTarget: false, showGreen: false, showInput2: true, showInput3: true,
            type: 'statBlock'
        },
        {
            id: 'kpi-card',
            label: 'KPI Card',
            icon: '🎯',
            description: 'Large number card showing the latest metric value with optional target',
            showTarget: true, showGreen: false, showInput2: false,
            type: 'kpi'
        },
        {
            id: 'data-table',
            label: 'Data Table',
            icon: '📋',
            description: 'Custom multi-column table — define your own columns, add/edit/delete rows directly on the card',
            showTarget: false, showGreen: false, showInput2: false,
            type: 'table'
        },
        {
            id: 'calendar',
            label: 'Calendar Grid',
            icon: '📅',
            description: 'Monthly red / yellow / green calendar — click any day to cycle its colour',
            showTarget: false, showGreen: false, showInput2: false,
            type: 'calendar'
        },
        {
            id: 'image-board',
            label: 'Image Board',
            icon: '🖼',
            description: 'Paste images from clipboard — escalate or cascade visuals across tiers (max 5 images)',
            showTarget: false, showGreen: false, showInput2: false,
            type: 'imageBoard'
        }
    ];

    // Dynamic: reads from VPMTabManager so custom/hidden tabs stay in sync
    function getTabOptions() {
        if (typeof VPMTabManager !== 'undefined') {
            return VPMTabManager.getTabs()
                .filter(t => t.id !== 'actions')
                .map(t => ({ value: t.id, label: t.label }));
        }
        // Fallback if tab-manager not loaded
        return [
            { value: 'safety', label: 'Safety' },
            { value: 'people', label: 'People' },
            { value: 'quality', label: 'Quality' },
            { value: 'production', label: 'Production' },
            { value: 'supplychain', label: 'Supply Chain' },
            { value: 'cost', label: 'Cost' },
            { value: 'maintenance', label: 'Maintenance' },
            { value: 'engineering', label: 'Engineering' },
            { value: 'ci', label: 'CI & Ideas' }
        ];
    }

    // ====================================================
    // STATE
    // ====================================================

    let _activeAdminTab = 'daily';
    let _builderStep = 1;          // 1=pick template, 2=configure, 3=preview
    let _selectedTemplate = null;
    let _editingChartId = null;

    // ====================================================
    // INIT
    // ====================================================

    function _migrateTemplateMismatches() {
        const FIX = ['builtin-cost-eff-ost', 'builtin-cost-eff-cc', 'builtin-cost-variances', 'builtin-sc-dioh'];
        FIX.forEach(id => {
            const def = VPMDataStore.getCustomCharts().find(c => c.id === id);
            if (def && def.templateType === 'line-band') {
                def.templateType = 'bar-band';
                VPMDataStore.saveCustomChart(def);
            }
        });
    }

    function init() {
        _migrateTemplateMismatches();
        _bindOverlayControls();
        _bindKeyboard();
        _bindAdminTabs();
        // Re-inject any previously saved custom charts into the DOM
        _reinjectAllCharts();
        // When the dashboard tab changes, refresh Data Studio panels so they
        // show only the charts belonging to the newly active tab.
        document.querySelectorAll('.nav-item[data-tab]').forEach(navItem => {
            navItem.addEventListener('click', () => {
                const overlay = document.getElementById('adminOverlay');
                if (!overlay || !overlay.classList.contains('active')) return;
                if (_activeAdminTab === 'daily')   _renderDailyPanel();
                if (_activeAdminTab === 'metrics') _renderMetricsPanel();
            });
        });
    }

    // ====================================================
    // OVERLAY CONTROLS
    // ====================================================

    function open() {
        const overlay = document.getElementById('adminOverlay');
        if (!overlay) return;
        overlay.classList.add('active');
        _switchAdminTab(_activeAdminTab);
    }

    /**
     * Open Data Studio on the Metric Tables tab, pre-selected to a specific metric.
     * Called from chart data-entry buttons.
     * @param {string} metricId  - ID from getMetricManifest(), e.g. 'prd_vol_ost'
     */
    function openForMetric(metricId) {
        const overlay = document.getElementById('adminOverlay');
        if (!overlay) return;
        overlay.classList.add('active');
        _switchAdminTab('metrics');
        const select = document.getElementById('adminMetricSelect');
        if (select && metricId) {
            select.value = metricId;
            loadMetricTable(metricId);
        }
    }

    /**
     * Open Data Studio on the Daily Entry tab, scrolled to a specific tab group.
     * Called from chart data-entry buttons when no specific metric matches.
     * @param {string} tabName  - e.g. 'safety', 'production'
     */
    function openForTab(tabName) {
        const overlay = document.getElementById('adminOverlay');
        if (!overlay) return;
        overlay.classList.add('active');
        _switchAdminTab('daily');
        if (tabName) {
            requestAnimationFrame(() => {
                const groups = document.querySelectorAll('.admin-metric-group-title');
                for (const g of groups) {
                    if (g.textContent.toLowerCase().includes(tabName.toLowerCase())) {
                        g.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        g.parentElement.style.outline = '2px solid var(--accent)';
                        setTimeout(() => { g.parentElement.style.outline = ''; }, 2000);
                        break;
                    }
                }
            });
        }
    }

    function close() {
        const overlay = document.getElementById('adminOverlay');
        if (overlay) overlay.classList.remove('active');
    }

    function _bindOverlayControls() {
        document.getElementById('adminCloseBtn')?.addEventListener('click', close);

        document.getElementById('adminExportBtn')?.addEventListener('click', () => {
            VPMDataStore.exportJSON();
            _showToast('Data exported successfully');
        });

        const importFile = document.getElementById('adminImportFile');
        document.getElementById('adminImportBtn')?.addEventListener('click', () => {
            importFile?.click();
        });

        importFile?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            VPMDataStore.importJSON(file, (err) => {
                if (err) {
                    _showToast('Import failed: ' + err, true);
                } else {
                    _showToast('Data imported successfully');
                    _reinjectAllCharts();
                }
                importFile.value = '';
            });
        });


        // Close on backdrop click
        document.getElementById('adminOverlay')?.addEventListener('click', (e) => {
            if (e.target.id === 'adminOverlay') close();
        });

    }

    function _bindKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.altKey && e.key === 'd') { open(); return; }
            if (e.key === 'Escape') {
                const overlay = document.getElementById('adminOverlay');
                if (overlay?.classList.contains('active')) close();
            }
        });
    }

    // ====================================================
    // ADMIN TABS
    // ====================================================

    function _bindAdminTabs() {
        document.querySelectorAll('[data-admin-tab]').forEach(btn => {
            btn.addEventListener('click', () => _switchAdminTab(btn.dataset.adminTab));
        });
    }

    function _switchAdminTab(tab) {
        _activeAdminTab = tab;

        document.querySelectorAll('[data-admin-tab]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.adminTab === tab);
        });

        document.querySelectorAll('.admin-panel-body').forEach(panel => {
            panel.style.display = panel.id === 'admin-panel-' + tab ? '' : 'none';
        });

        if (tab === 'daily') _renderDailyPanel();
        if (tab === 'metrics') _renderMetricsPanel();
        if (tab === 'builder') _renderBuilderStep1();
    }

    // ====================================================
    // TAB: DAILY ENTRY
    // ====================================================

    /** Returns the currently active dashboard tab id (e.g. 'cost', 'safety') */
    function _currentDashboardTab() {
        return document.querySelector('.nav-item.active[data-tab]')?.dataset.tab || null;
    }

    function _renderDailyPanel() {
        const container = document.getElementById('admin-panel-daily');
        if (!container) return;

        const currentTier     = parseInt(localStorage.getItem('vpm-current-tier') || '1');
        const activeDashTab   = _currentDashboardTab();
        const tabOpts         = getTabOptions();
        const tabLabel        = tabOpts.find(t => t.value === activeDashTab)?.label || activeDashTab || 'current tab';
        const allCharts       = VPMDataStore.getCustomCharts();

        // Charts on this tier + current tab that have numeric data
        const entryCharts = allCharts.filter(c => {
            if (c.linkedTo) return false;
            if (c.tier && c.tier !== currentTier) return false;
            if (!c.opts) return false;
            const t = c.opts.type;
            if (t === 'table' || t === 'calendar') return false;
            // Filter to active dashboard tab only
            if (activeDashTab && c.tab !== activeDashTab) return false;
            return Array.isArray(c.opts.input) || t === 'kpi' || t === 'statBlock';
        });

        let html = '<div class="admin-daily-intro">' +
            'Showing <strong>' + tabLabel + '</strong> charts — switch dashboard tab to see other tabs. ' +
            'Linked charts (from lower tiers) are updated at their source tier.' +
            '</div>';

        if (entryCharts.length === 0) {
            html += '<p class="admin-note" style="color:var(--text-muted);font-style:italic;padding:20px 0">No charts with numeric data on the <strong>' + tabLabel + '</strong> tab for this tier yet. Create charts in Chart Builder first.</p>';
            container.innerHTML = html;
            return;
        }

        // Flat list — all charts are from the same tab so no grouping needed
        html += '<div class="admin-metric-group">';

        entryCharts.forEach(chart => {
            // KPI detection
            const isKpi = chart.opts.type === 'kpi' || chart.opts.type === 'statBlock'
                || (chart.opts.value !== undefined && !Array.isArray(chart.opts.input));
            const series   = chart.opts.input;
            const series2  = chart.opts.input2;
            const hasInput2 = !isKpi && Array.isArray(series2);

            // Last label from x-axis (e.g. "02/19"), fallback to entry count
            const lastLabel = Array.isArray(chart.opts.labels) && chart.opts.labels.length
                ? chart.opts.labels[chart.opts.labels.length - 1] : null;
            const entryCount = !isKpi && Array.isArray(series) && series.length ? series.length : null;
            const periodText = lastLabel || (entryCount ? 'entry ' + entryCount : null);
            const periodLine = periodText
                ? '<div class="admin-metric-period">Last period: <strong>' + periodText + '</strong></div>'
                : '';

            const lastVal = isKpi
                ? (chart.opts.value ?? '')
                : (Array.isArray(series) ? (series.filter(v => v != null).slice(-1)[0] ?? '') : '');
            const lastVal2 = hasInput2
                ? (series2.filter(v => v != null).slice(-1)[0] ?? '') : '';

            if (hasInput2) {
                const lbl1 = chart.opts.inputLabel  || 'Series 1';
                const lbl2 = chart.opts.input2Label || 'Series 2';
                html += '<div class="admin-metric-row admin-metric-row--multi" data-chart-entry-id="' + chart.id + '">' +
                    '<label class="admin-metric-label">' + chart.title + '</label>' +
                    '<div class="admin-metric-controls admin-metric-controls--multi">' +
                        '<div class="admin-metric-series">' +
                            '<div class="admin-metric-sub">' +
                                '<span class="admin-metric-sublabel">' + lbl1 + '</span>' +
                                '<input type="number" class="admin-metric-input" data-series="input" placeholder="Last: ' + lastVal + '" step="any">' +
                            '</div>' +
                            '<div class="admin-metric-sub">' +
                                '<span class="admin-metric-sublabel">' + lbl2 + '</span>' +
                                '<input type="number" class="admin-metric-input" data-series="input2" placeholder="Last: ' + lastVal2 + '" step="any">' +
                            '</div>' +
                            periodLine +
                        '</div>' +
                        '<button class="admin-metric-btn" data-action="append-multi">Append</button>' +
                    '</div>' +
                '</div>';
            } else {
                html += '<div class="admin-metric-row" data-chart-entry-id="' + chart.id + '">' +
                    '<label class="admin-metric-label">' + chart.title + '</label>' +
                    '<div class="admin-metric-controls">' +
                        '<div class="admin-metric-input-wrap">' +
                            '<input type="number" class="admin-metric-input" placeholder="Last: ' + lastVal + '" step="any">' +
                            periodLine +
                        '</div>' +
                        '<button class="admin-metric-btn" data-action="' + (isKpi ? 'set' : 'append') + '">' +
                            (isKpi ? 'Set' : 'Append') +
                        '</button>' +
                    '</div>' +
                '</div>';
            }
        });

        html += '</div>';

        container.innerHTML = html;

        // Wire buttons
        container.querySelectorAll('.admin-metric-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const row     = btn.closest('.admin-metric-row');
                const chartId = row.dataset.chartEntryId;
                const action  = btn.dataset.action;
                if (action === 'append-multi') {
                    const inp1 = row.querySelector('[data-series="input"]');
                    const inp2 = row.querySelector('[data-series="input2"]');
                    _submitMultiSeriesValue(chartId, inp1, inp2);
                } else {
                    const input = row.querySelector('.admin-metric-input');
                    _submitChartValue(chartId, input, action);
                }
            });
        });

        // Allow Enter key to submit
        container.querySelectorAll('.admin-metric-input').forEach(inp => {
            inp.addEventListener('keydown', e => {
                if (e.key !== 'Enter') return;
                const row     = inp.closest('.admin-metric-row');
                const btn     = row.querySelector('.admin-metric-btn');
                const chartId = row.dataset.chartEntryId;
                if (btn.dataset.action === 'append-multi') {
                    const inp1 = row.querySelector('[data-series="input"]');
                    const inp2 = row.querySelector('[data-series="input2"]');
                    _submitMultiSeriesValue(chartId, inp1, inp2);
                } else {
                    _submitChartValue(chartId, inp, btn.dataset.action);
                }
            });
        });
    }

    function _submitChartValue(chartId, input, action) {
        const rawVal = input.value.trim();
        if (rawVal === '') { _showToast('Enter a value first', true); return; }
        const value = parseFloat(rawVal);
        if (isNaN(value)) { _showToast('Value must be a number', true); return; }

        const chart = VPMDataStore.getChartById(chartId);
        if (!chart || !chart.opts) { _showToast('Chart not found', true); return; }

        if (action === 'set') {
            // KPI / statBlock — set the value directly
            chart.opts.value = value;
        } else {
            // Append to the main input series
            if (!Array.isArray(chart.opts.input)) chart.opts.input = [];
            chart.opts.input.push(value);

            // Auto-fill next label if labels exist
            if (Array.isArray(chart.opts.labels)) {
                const nextLabel = _guessNextLabel(chart.opts.labels);
                chart.opts.labels.push(nextLabel);
            }
        }

        VPMDataStore.saveCustomChart(chart);

        input.value = '';
        const newLabel = (action !== 'set' && Array.isArray(chart.opts.labels) && chart.opts.labels.length)
            ? chart.opts.labels[chart.opts.labels.length - 1] : null;
        input.placeholder = 'Last: ' + value + (newLabel ? ' (' + newLabel + ')' : '');
        _showToast(action === 'set' ? 'Set: ' + chart.title : 'Appended to: ' + chart.title);

        document.dispatchEvent(new CustomEvent('vpm:requestRender'));
    }

    function _submitMultiSeriesValue(chartId, inp1, inp2) {
        const raw1 = inp1.value.trim();
        const raw2 = inp2.value.trim();
        if (raw1 === '' && raw2 === '') { _showToast('Enter at least one value', true); return; }

        const val1 = raw1 !== '' ? parseFloat(raw1) : null;
        const val2 = raw2 !== '' ? parseFloat(raw2) : null;
        if (raw1 !== '' && isNaN(val1)) { _showToast('First value must be a number', true); return; }
        if (raw2 !== '' && isNaN(val2)) { _showToast('Second value must be a number', true); return; }

        const chart = VPMDataStore.getChartById(chartId);
        if (!chart || !chart.opts) { _showToast('Chart not found', true); return; }

        if (!Array.isArray(chart.opts.input))  chart.opts.input  = [];
        if (!Array.isArray(chart.opts.input2)) chart.opts.input2 = [];

        chart.opts.input.push(val1 !== null ? val1 : null);
        chart.opts.input2.push(val2 !== null ? val2 : null);

        let newLabel = null;
        if (Array.isArray(chart.opts.labels)) {
            newLabel = _guessNextLabel(chart.opts.labels);
            chart.opts.labels.push(newLabel);
        }

        VPMDataStore.saveCustomChart(chart);

        inp1.value = '';
        inp2.value = '';
        const hint = newLabel ? ' (' + newLabel + ')' : '';
        if (val1 !== null) inp1.placeholder = 'Last: ' + val1 + hint;
        if (val2 !== null) inp2.placeholder = 'Last: ' + val2 + hint;
        _showToast('Appended to: ' + chart.title);

        document.dispatchEvent(new CustomEvent('vpm:requestRender'));
    }

    /** Guess the next label based on existing pattern */
    function _guessNextLabel(labels) {
        if (!labels.length) return '';
        const last = labels[labels.length - 1];

        // Numeric sequence: 1,2,3 → 4
        const num = parseInt(last);
        if (!isNaN(num) && String(num) === String(last).trim()) {
            return String(num + 1);
        }

        // Month short names: Jan,Feb,Mar → Apr
        const MONTHS_S = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const mi = MONTHS_S.findIndex(m => m.toLowerCase() === String(last).trim().toLowerCase());
        if (mi >= 0) return MONTHS_S[(mi + 1) % 12];

        // Month full names
        const MONTHS_F = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const mf = MONTHS_F.findIndex(m => m.toLowerCase() === String(last).trim().toLowerCase());
        if (mf >= 0) return MONTHS_F[(mf + 1) % 12];

        // Day short names
        const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
        const di = DAYS.findIndex(d => d.toLowerCase() === String(last).trim().toLowerCase());
        if (di >= 0) return DAYS[(di + 1) % 7];

        // Fallback: just use the next number
        return String(labels.length + 1);
    }

    // Legacy submitMetric kept for backward compat (old manifest-based paths)
    function submitMetric(id, path, type) {
        const row = document.querySelector('[data-metric-id="' + id + '"]');
        if (!row) return;
        const input = row.querySelector('.admin-metric-input');
        const rawVal = input.value.trim();
        if (rawVal === '') { _showToast('Enter a value first', true); return; }
        const value = parseFloat(rawVal);
        if (isNaN(value)) { _showToast('Value must be a number', true); return; }

        if (type === 'append') {
            VPMDataStore.appendToSeries(path, value);
        } else {
            VPMDataStore.set(path, value);
        }

        input.value = '';
        input.placeholder = 'Last: ' + value;
        _showToast('Saved');
        document.dispatchEvent(new CustomEvent('vpm:requestRender'));
    }

    // ====================================================
    // TAB: METRIC TABLES
    // ====================================================

    function _renderMetricsPanel() {
        const container = document.getElementById('admin-panel-metrics');
        if (!container) return;

        const currentTier   = parseInt(localStorage.getItem('vpm-current-tier') || '1');
        const activeDashTab = _currentDashboardTab();
        const tabOpts       = getTabOptions();
        const tabLabel      = tabOpts.find(t => t.value === activeDashTab)?.label || activeDashTab || 'current tab';
        const allCharts     = VPMDataStore.getCustomCharts();

        // Charts on this tier + current tab with numeric input arrays
        const editableCharts = allCharts.filter(c => {
            if (c.linkedTo) return false;
            if (c.tier && c.tier !== currentTier) return false;
            if (!c.opts) return false;
            const t = c.opts.type;
            if (t === 'table' || t === 'calendar') return false;
            // Filter to active dashboard tab only
            if (activeDashTab && c.tab !== activeDashTab) return false;
            return Array.isArray(c.opts.input);
        });

        // Flat dropdown — all from same tab, no optgroup needed
        let options = '<option value="">-- Select a ' + tabLabel + ' chart to edit --</option>';
        editableCharts.forEach(c => {
            options += '<option value="' + c.id + '">' + c.title + '</option>';
        });

        let html = '<div class="admin-metrics-selector">' +
            '<select id="adminMetricSelect" onchange="VPMAdmin.loadMetricTable(this.value)">' +
                options +
            '</select>' +
        '</div>' +
        '<div id="adminMetricTableArea" class="admin-metric-table-area"></div>';

        container.innerHTML = html;
    }

    function loadMetricTable(chartId) {
        const area = document.getElementById('adminMetricTableArea');
        if (!area || !chartId) { if (area) area.innerHTML = ''; return; }

        const chart = VPMDataStore.getChartById(chartId);
        if (!chart || !chart.opts || !Array.isArray(chart.opts.input)) {
            area.innerHTML = '<p class="admin-note">No series data found for this chart.</p>';
            return;
        }

        const values = chart.opts.input;
        const labels = chart.opts.labels || [];
        const unit   = chart.opts.unit || '';

        let html = '<div class="admin-table-actions">' +
            '<span class="admin-note">' + values.length + ' data points' +
            (unit ? ' (' + unit + ')' : '') +
            ' &mdash; ' + chart.title + '</span>' +
        '</div>' +
        '<div class="admin-series-table-wrap">' +
        '<table class="admin-series-table">' +
            '<thead><tr><th>#</th>' +
            (labels.length ? '<th>Label</th>' : '') +
            '<th>Value</th><th>Action</th></tr></thead>' +
            '<tbody>';

        values.forEach((v, i) => {
            html += '<tr>' +
                '<td>' + (i + 1) + '</td>' +
                (labels.length ? '<td style="font-size:11px;color:var(--text-muted)">' + (labels[i] || '') + '</td>' : '') +
                '<td><input type="number" value="' + (v ?? '') + '" step="any" ' +
                    'onchange="VPMAdmin.updateSeriesValue(\'' + chartId + '\', ' + i + ', this.value)"></td>' +
                '<td><button class="admin-del-btn" onclick="VPMAdmin.deleteSeriesValue(\'' + chartId + '\', ' + i + ')">x</button></td>' +
            '</tr>';
        });

        html += '</tbody></table></div>' +
        '<div class="admin-table-footer">' +
            '<input type="number" id="adminAppendInput" placeholder="Append new value..." step="any">' +
            '<button class="admin-metric-btn" onclick="VPMAdmin.appendFromTable(\'' + chartId + '\')">+ Append</button>' +
        '</div>';

        area.innerHTML = html;
    }

    function updateSeriesValue(chartId, index, rawVal) {
        const chart = VPMDataStore.getChartById(chartId);
        if (!chart || !Array.isArray(chart.opts?.input)) return;
        chart.opts.input[index] = rawVal === '' ? null : parseFloat(rawVal);
        VPMDataStore.saveCustomChart(chart);
        _showToast('Updated index ' + (index + 1));
        document.dispatchEvent(new CustomEvent('vpm:requestRender'));
    }

    function deleteSeriesValue(chartId, index) {
        const chart = VPMDataStore.getChartById(chartId);
        if (!chart || !Array.isArray(chart.opts?.input)) return;
        chart.opts.input.splice(index, 1);
        // Also remove label at same index if labels exist
        if (Array.isArray(chart.opts.labels) && chart.opts.labels.length > index) {
            chart.opts.labels.splice(index, 1);
        }
        VPMDataStore.saveCustomChart(chart);
        loadMetricTable(chartId); // refresh table
        _showToast('Deleted index ' + (index + 1));
        document.dispatchEvent(new CustomEvent('vpm:requestRender'));
    }

    function appendFromTable(chartId) {
        const input = document.getElementById('adminAppendInput');
        const rawVal = input?.value.trim();
        if (!rawVal) return;
        const value = parseFloat(rawVal);
        if (isNaN(value)) { _showToast('Value must be a number', true); return; }

        const chart = VPMDataStore.getChartById(chartId);
        if (!chart || !chart.opts) return;
        if (!Array.isArray(chart.opts.input)) chart.opts.input = [];
        chart.opts.input.push(value);

        // Auto-fill next label
        if (Array.isArray(chart.opts.labels)) {
            chart.opts.labels.push(_guessNextLabel(chart.opts.labels));
        }

        VPMDataStore.saveCustomChart(chart);

        input.value = '';
        loadMetricTable(chartId); // refresh table
        _showToast('Appended ' + value);
        document.dispatchEvent(new CustomEvent('vpm:requestRender'));
    }

    // ====================================================
    // TAB: CHART BUILDER - STEP 1 (pick template)
    // ====================================================

    function _renderBuilderStep1() {
        _builderStep = 1;
        _selectedTemplate = null;
        _editingChartId = null;

        const container = document.getElementById('admin-panel-builder');
        if (!container) return;

        let html = `<div class="builder-header">
            <h3 class="builder-step-title">Step 1 — Choose a Chart Template</h3>
            <p class="builder-step-desc">Pick the chart style that matches what you want to display.</p>
        </div>
        <div class="builder-saved-charts">${_renderSavedChartsList()}</div>
        <div class="builder-template-grid">`;

        TEMPLATES.forEach(tpl => {
            html += `<div class="builder-template-card" data-tpl-id="${tpl.id}" onclick="VPMAdmin.selectTemplate('${tpl.id}')">
                <div class="builder-tpl-icon">${tpl.icon}</div>
                <div class="builder-tpl-label">${tpl.label}</div>
                <div class="builder-tpl-desc">${tpl.description}</div>
            </div>`;
        });

        html += '</div>';
        html += _renderImportFromLowerTier();
        container.innerHTML = html;

        // Wire up import checkboxes + button after DOM is ready
        setTimeout(_wireImportPicker, 0);
    }

    // ── Import from Lower Tier ──────────────────────────────────────────────

    function _renderImportFromLowerTier() {
        const currentTier = parseInt(localStorage.getItem('vpm-current-tier') || '1');
        if (currentTier <= 1) return ''; // T1 has no lower tiers

        const tiers = (typeof VPMTierManager !== 'undefined')
            ? VPMTierManager.getTiers() : [];
        const lowerTiers = tiers.filter(t => t.id < currentTier);
        if (!lowerTiers.length) return '';

        // Find which source chart IDs are already linked at this tier
        const allCharts = VPMDataStore.getCustomCharts();
        const alreadyLinked = new Set(
            allCharts
                .filter(c => c.tier === currentTier && c.linkedTo)
                .map(c => c.linkedTo.sourceChartId)
        );

        let html = '<div class="builder-import-section">';
        html += '<div class="builder-import-header">Import from Lower Tier</div>';
        html += '<p class="builder-import-desc">' +
            '1. Check the charts you want to bring into this tier<br>' +
            '2. Use the dropdown to choose which tab to place each chart on<br>' +
            '3. Click <strong>Import Selected</strong> — data will auto-update from the source tier' +
            '</p>';

        let hasAny = false;
        for (const tier of lowerTiers) {
            const tierCharts = VPMDataStore.getChartsForTier(tier.id)
                .filter(c => !c.linkedTo); // only source charts, not linked ones
            if (!tierCharts.length) continue;
            hasAny = true;

            html += '<details class="builder-import-tier">';
            html += '<summary class="builder-import-tier-label">';
            html += '<span class="builder-import-tier-pill" style="background:' + (tier.accent || '#6366f1') + '">T' + tier.id + '</span> ';
            html += (tier.label || 'Tier ' + tier.id);
            html += ' <span class="builder-import-count">(' + tierCharts.length + ' charts)</span>';
            html += '</summary>';
            html += '<div class="builder-import-list">';

            const tabOpts = getTabOptions();
            tierCharts.forEach(c => {
                const linked = alreadyLinked.has(c.id);
                html += '<div class="builder-import-item' + (linked ? ' already-linked' : '') + '">';
                html += '<input type="checkbox" class="import-chart-cb" data-chart-id="' + c.id + '" data-source-tier="' + tier.id + '"';
                if (linked) html += ' disabled checked';
                html += '>';
                html += '<span class="import-chart-title">' + (c.title || c.id) + '</span>';
                // Tab dropdown — defaults to source chart's tab
                html += '<select class="import-tab-select" data-chart-id="' + c.id + '" title="Choose which tab this chart will appear on"' + (linked ? ' disabled' : '') + '>';
                tabOpts.forEach(t => {
                    html += '<option value="' + t.value + '"' + (t.value === c.tab ? ' selected' : '') + '>' + t.label + '</option>';
                });
                html += '</select>';
                if (linked) html += '<span class="import-linked-badge">Linked</span>';
                html += '</div>';
            });

            html += '</div></details>';
        }

        if (!hasAny) {
            html += '<p class="builder-import-empty">No charts found in lower tiers. Create charts at T1 first.</p>';
        }

        html += '<button class="admin-btn builder-import-btn" id="importSelectedBtn" disabled>Import Selected</button>';
        html += '</div>';
        return html;
    }

    function _wireImportPicker() {
        const btn = document.getElementById('importSelectedBtn');
        if (!btn) return;

        const checkboxes = document.querySelectorAll('.import-chart-cb:not([disabled])');
        checkboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                const anyChecked = [...document.querySelectorAll('.import-chart-cb:not([disabled]):checked')].length > 0;
                btn.disabled = !anyChecked;
            });
        });

        btn.addEventListener('click', _importSelectedCharts);
    }

    function _importSelectedCharts() {
        const currentTier = parseInt(localStorage.getItem('vpm-current-tier') || '1');
        const checked = document.querySelectorAll('.import-chart-cb:not([disabled]):checked');
        let count = 0;

        checked.forEach(cb => {
            const sourceId   = cb.dataset.chartId;
            const sourceTier = parseInt(cb.dataset.sourceTier);
            const source     = VPMDataStore.getChartById(sourceId);
            if (!source) return;

            // Read the target tab from the dropdown next to this checkbox
            const tabSelect = document.querySelector('.import-tab-select[data-chart-id="' + sourceId + '"]');
            const targetTab = tabSelect ? tabSelect.value : source.tab;

            const linkId   = 'linked-' + Date.now() + '-' + count;
            const linkedDef = {
                id:           linkId,
                tier:         currentTier,
                tab:          targetTab,
                title:        source.title,
                templateType: source.templateType,
                canvasId:     'custom-' + linkId,
                linkedTo: {
                    sourceChartId: sourceId,
                    sourceTier:    sourceTier
                },
                opts: null  // reads from source
            };

            VPMDataStore.saveCustomChart(linkedDef);
            injectChart(linkedDef);
            count++;
        });

        if (count > 0) {
            _showToast(count + ' chart' + (count > 1 ? 's' : '') + ' linked — navigate to the target tab to see ' + (count > 1 ? 'them' : 'it'));
            document.dispatchEvent(new CustomEvent('vpm:requestRender'));
            _renderBuilderStep1(); // refresh the import list (linked items greyed out)
        } else {
            _showToast('No charts imported — check if source exists', true);
        }
    }

    function _renderSavedChartsList() {
        const charts = VPMDataStore.getCustomCharts();
        if (!charts.length) return '';

        let html = `<details class="builder-saved-section">
            <summary>Saved Custom Charts (${charts.length})</summary>
            <div class="builder-saved-list">`;

        charts.forEach(c => {
            html += `<div class="builder-saved-item">
                <span class="builder-saved-title">${c.title}</span>
                <span class="builder-saved-tab">[${c.tab}]</span>
                <button class="admin-sm-btn" onclick="VPMAdmin.editChart('${c.id}')">Edit</button>
                <button class="admin-sm-btn danger" onclick="VPMAdmin.removeChart('${c.id}')">Delete</button>
            </div>`;
        });

        html += '</div></details>';
        return html;
    }

    function selectTemplate(id) {
        _selectedTemplate = TEMPLATES.find(t => t.id === id);
        if (!_selectedTemplate) return;
        _renderBuilderStep2();
    }

    // ====================================================
    // CHART BUILDER - STEP 2 (configure)
    // ====================================================

    function _renderBuilderStep2(existingDef) {
        _builderStep = 2;
        const tpl = _selectedTemplate;
        const container = document.getElementById('admin-panel-builder');
        if (!container) return;

        const def = existingDef || {};

        let html = `<div class="builder-header">
            <button class="admin-back-btn" onclick="VPMAdmin._renderBuilderStep1()">← Back</button>
            <h3 class="builder-step-title">Step 2 — Configure: ${tpl.label}</h3>
        </div>
        <div class="builder-form">

            <div class="form-group">
                <label>Chart Title</label>
                <input type="text" id="bf-title" placeholder="e.g. Daily OEE%" value="${def.title || ''}">
            </div>

            <div class="form-group">
                <label>Dashboard Tab</label>
                <select id="bf-tab">
                    ${getTabOptions().map(t => `<option value="${t.value}" ${(def.tab || 'safety') === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
                </select>
            </div>

            ${tpl.type === 'calendar' ? `
            <div class="form-group">
                <small style="color:var(--text-secondary)">Days are coloured by clicking directly on the calendar in the dashboard. No data entry needed here.</small>
            </div>` : tpl.type === 'imageBoard' ? `
            <div class="form-group">
                <small style="color:var(--text-secondary)">Paste images directly on the card using <kbd>Ctrl+V</kbd> or drag & drop. Max 5 images per board.</small>
            </div>` : tpl.type === 'table' ? `
            <div class="form-group">
                <label>Column Names</label>
                <div id="bf-col-list" class="tbl-col-list">${
                    (def.opts?.columns && def.opts.columns.length
                        ? def.opts.columns
                        : [{label:'Date'},{label:'Description'},{label:'Responsible'}]
                    ).map((c, i) =>
                        `<div class="tbl-col-row">
                            <span class="tbl-col-drag">&#8942;</span>
                            <input type="text" class="tbl-col-input" placeholder="Column name" value="${c.label || ''}">
                            <div class="tbl-col-width-wrap"><input type="number" class="tbl-col-width" placeholder="auto" min="1" max="99" value="${c.width || ''}"><span class="tbl-col-width-pct">%</span></div>
                            <button class="tbl-col-del" title="Remove column">&times;</button>
                        </div>`
                    ).join('')
                }</div>
                <button class="admin-btn secondary" id="bf-col-add-btn" style="margin-top:6px">+ Add Column</button>
                <small style="display:block;margin-top:6px;color:var(--text-muted)">Rows are added directly on the dashboard card — no data entry needed here.</small>
            </div>` : `
            <div class="form-group">
                <label>X-Axis Labels</label>
                <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">
                    <input type="text" id="bf-labels" placeholder="Jan,Feb,Mar or 1,2,3…31"
                           value="${(def.opts?.labels || []).join(',')}" style="flex:1">
                    <select id="bf-labels-preset" style="width:auto;min-width:100px" title="Pick a preset to fill labels quickly">
                        <option value="">Presets</option>
                        <option value="months-short">Jan — Dec</option>
                        <option value="months-full">January — December</option>
                        <option value="nums-12">1 — 12</option>
                        <option value="nums-31">1 — 31</option>
                        <option value="days-short">Mon — Sun</option>
                    </select>
                </div>
                <small>Type your own or pick a preset. Leave blank to auto-number from data length.</small>
            </div>

            <div class="form-group">
                <label>Main Data Series (comma-separated numbers)</label>
                <textarea id="bf-input" rows="3" placeholder="85.2, 87.0, 90.1, …">${(def.opts?.input || []).join(', ')}</textarea>
            </div>`}`;

        if (tpl.showInput2) {
            const isStatBlock = tpl.type === 'statBlock';
            html += `<div class="form-group">
                <label>${isStatBlock ? 'Previous Best (single number)' : 'Second Data Series (comma-separated)'}</label>
                <textarea id="bf-input2" rows="${isStatBlock ? 1 : 3}" placeholder="${isStatBlock ? 'e.g. 567' : '72.1, 73.4, 75.0, …'}">${(def.opts?.input2 || []).join(', ')}</textarea>
                <label style="margin-top:6px">${isStatBlock ? 'Previous Best Label' : 'Second Series Label'}</label>
                <input type="text" id="bf-input2label" placeholder="${isStatBlock ? 'e.g. Previous Best' : 'e.g. CC'}" value="${def.opts?.input2Label || (isStatBlock ? 'Previous Best' : '')}">
                ${!isStatBlock ? `<label style="margin-top:6px">Second Series Color</label>
                <input type="color" id="bf-input2color" value="${def.opts?.input2Color || '#22c55e'}">` : ''}
            </div>`;
        }

        if (tpl.showInput3) {
            const isStatBlock = tpl.type === 'statBlock';
            html += `<div class="form-group">
                <label>${isStatBlock ? 'Milestone / Target (single number)' : 'Third Data Series (comma-separated)'}</label>
                <textarea id="bf-input3" rows="${isStatBlock ? 1 : 3}" placeholder="${isStatBlock ? 'e.g. 180' : '65.0, 67.2, 70.0, …'}">${(def.opts?.input3 || []).join(', ')}</textarea>
                <label style="margin-top:6px">${isStatBlock ? 'Milestone Label' : 'Third Series Label'}</label>
                <input type="text" id="bf-input3label" placeholder="${isStatBlock ? 'e.g. Milestone' : 'e.g. Target Line'}" value="${def.opts?.input3Label || (isStatBlock ? 'Milestone' : '')}">
                ${!isStatBlock ? `<label style="margin-top:6px">Third Series Color</label>
                <input type="color" id="bf-input3color" value="${def.opts?.input3Color || '#f59e0b'}">` : ''}
            </div>`;
        }

        if (tpl.showTarget) {
            // Target line is stored in opts.red (red dashed line). Fall back to opts.aop for
            // charts created by older builder versions that incorrectly wrote to opts.aop.
            const _toFlat = v => {
                if (v == null) return '';
                if (Array.isArray(v)) {
                    const vals = [...new Set(v.filter(x => x != null))];
                    return vals.length === 1 ? String(vals[0]) : vals.join(',');
                }
                return String(v);
            };
            const targetDisplay = _toFlat(def.opts?.red) || _toFlat(def.opts?.aop);
            html += `<div class="form-group">
                <label>Target Line (single number or comma-separated)</label>
                <input type="text" id="bf-target" placeholder="e.g. 90 or 90,90,90,…"
                       value="${targetDisplay}">
            </div>`;

        }

        if (tpl.showGreen || tpl.showRed) {
            // Band thresholds may be stored as flat arrays — show the representative scalar.
            const _bandScalar = v => Array.isArray(v) ? (v.find(x => x != null) ?? '') : (v ?? '');
            html += `<div class="form-group form-group-row">`;
            if (tpl.showGreen) html += `<div><label>Upper / Green target</label>
                <input type="number" id="bf-green" step="any" value="${_bandScalar(def.opts?.green)}"></div>`;
            if (tpl.showRed) html += `<div><label>Lower / Red threshold</label>
                <input type="number" id="bf-red" step="any" value="${_bandScalar(def.opts?.red)}"></div>`;
            html += `</div>`;
        }

        // Trigger fields — show for all data-series chart types
        const _noTriggerTypes = ['donut', 'scatter', 'radar', 'statBlock', 'table', 'calendar', 'kpi'];
        if (!_noTriggerTypes.includes(tpl.type)) {
            const trg = def.opts?.trigger || {};
            const hasTarget = tpl.showTarget || tpl.showRed;
            html += `<div class="form-group trigger-config">
                <label>Consecutive-Days Trigger</label>
                <div class="form-group-row" style="gap:8px;align-items:end">
                    <div>
                        <label style="font-size:11px">Direction</label>
                        <select id="bf-trigger-dir" class="admin-input">
                            <option value="">(no trigger)</option>
                            <option value="below" ${trg.dir === 'below' ? 'selected' : ''}>Below threshold</option>
                            <option value="above" ${trg.dir === 'above' ? 'selected' : ''}>Above threshold</option>
                        </select>
                    </div>
                    <div>
                        <label style="font-size:11px">Days in a row</label>
                        <input type="number" id="bf-trigger-days" min="1" max="30"
                               placeholder="3" value="${trg.days || ''}" style="width:60px">
                    </div>
                    <div>
                        <label style="font-size:11px">Threshold value</label>
                        <input type="number" id="bf-trigger-value" step="any"
                               placeholder="${hasTarget ? 'uses target line' : 'required'}"
                               value="${trg.value ?? ''}" style="width:100px">
                    </div>
                </div>
            </div>`;
        }

        if (tpl.type !== 'calendar' && tpl.type !== 'table') {
            html += `<div class="form-group form-group-row">
            <div>
                <label>Y-Axis Min</label>
                <input type="number" id="bf-ymin" step="any" value="${def.opts?.yMin ?? ''}">
            </div>
            <div>
                <label>Y-Axis Max</label>
                <input type="number" id="bf-ymax" step="any" value="${def.opts?.yMax ?? ''}">
            </div>
            <div>
                <label>Unit (e.g. %, h, pcs)</label>
                <input type="text" id="bf-unit" value="${def.opts?.unit || ''}">
            </div>
        </div>

        <div class="form-group">
            <label>Series Label</label>
            <input type="text" id="bf-inputlabel" placeholder="e.g. Actual" value="${def.opts?.inputLabel || ''}">
        </div>

        <div class="form-group">
            <label>Accent Color (hex)</label>
            <input type="color" id="bf-color" value="${def.opts?.color || '#3b82f6'}">
        </div>`;
        }

        html += `
        <div class="builder-form-actions">
            <button class="admin-btn primary" onclick="VPMAdmin._previewChart()">${tpl.type === 'calendar' ? 'Preview Calendar' : 'Preview Chart'}</button>
        </div>
        </div>
        <div id="bf-preview-area" class="bf-preview-area"></div>`;

        container.innerHTML = html;

        // Wire column builder for Data Table type
        if (tpl.type === 'table') _initColumnBuilder(container);

        // Wire label preset dropdown
        _initLabelPresets();
    }

    function _initLabelPresets() {
        const preset = document.getElementById('bf-labels-preset');
        const input  = document.getElementById('bf-labels');
        if (!preset || !input) return;

        const PRESETS = {
            'months-short': ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
            'months-full':  ['January','February','March','April','May','June','July','August','September','October','November','December'],
            'nums-12':      Array.from({length:12}, (_,i) => String(i+1)),
            'nums-31':      Array.from({length:31}, (_,i) => String(i+1)),
            'days-short':   ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
        };

        preset.addEventListener('change', () => {
            const val = preset.value;
            if (!val) return;
            const labels = PRESETS[val];
            if (labels) input.value = labels.join(', ');
            preset.value = ''; // reset dropdown so user can pick again
            input.focus();
        });
    }

    function _initColumnBuilder(container) {
        const colList = container.querySelector('#bf-col-list');
        const addBtn  = container.querySelector('#bf-col-add-btn');
        if (!colList || !addBtn) return;

        function _wireDelBtn(btn) {
            btn.addEventListener('click', () => {
                if (colList.querySelectorAll('.tbl-col-row').length > 1) btn.closest('.tbl-col-row').remove();
            });
        }

        colList.querySelectorAll('.tbl-col-del').forEach(_wireDelBtn);

        addBtn.addEventListener('click', () => {
            const row = document.createElement('div');
            row.className = 'tbl-col-row';
            row.innerHTML = '<span class="tbl-col-drag">&#8942;</span>' +
                '<input type="text" class="tbl-col-input" placeholder="Column name">' +
                '<div class="tbl-col-width-wrap"><input type="number" class="tbl-col-width" placeholder="auto" min="1" max="99"><span class="tbl-col-width-pct">%</span></div>' +
                '<button class="tbl-col-del" title="Remove column">&times;</button>';
            _wireDelBtn(row.querySelector('.tbl-col-del'));
            colList.appendChild(row);
            row.querySelector('.tbl-col-input').focus();
        });

        if (typeof Sortable !== 'undefined') {
            Sortable.create(colList, { handle: '.tbl-col-drag', animation: 120 });
        }
    }

    // ====================================================
    // CHART BUILDER - STEP 3 (preview + save)
    // ====================================================

    function _previewChart() {
        const tpl = _selectedTemplate;
        const def = _collectFormDef(tpl);
        if (!def) return;

        const area = document.getElementById('bf-preview-area');
        if (!area) return;

        area.innerHTML = `<h4 class="preview-title">${def.title}</h4>
            <div class="preview-canvas-wrap"><canvas id="bf-preview-canvas" height="260"></canvas></div>
            <div class="builder-form-actions" style="margin-top:12px">
                <button class="admin-btn primary" onclick="VPMAdmin._saveChart()">Save & Inject into Dashboard</button>
            </div>`;

        if (tpl.type === 'statBlock') {
            _renderStatBlockPreview(area, def);
        } else if (tpl.type === 'kpi') {
            _renderKpiPreview('bf-preview-canvas', def.opts);
        } else if (tpl.type === 'table') {
            _renderTablePreview(area, def.opts);
        } else if (tpl.type === 'calendar') {
            _renderCalendarPreview(area, def);
        } else {
            VPMCharts.buildMetricChart('bf-preview-canvas', def.opts);
        }
    }

    function _renderKpiPreview(canvasId, opts) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const val = Array.isArray(opts.input) && opts.input.length ? opts.input[opts.input.length - 1] : '—';
        const target = Array.isArray(opts.aop) && opts.aop.length ? opts.aop[0] : opts.aop;
        canvas.style.display = 'none';
        const wrap = canvas.parentElement;
        wrap.innerHTML = `<div class="kpi-preview-card">
            <div class="kpi-preview-value">${val}${opts.unit || ''}</div>
            ${target != null ? `<div class="kpi-preview-target">Target: ${target}${opts.unit || ''}</div>` : ''}
        </div>`;
    }

    function _renderStatBlockPreview(area, def) {
        area.querySelector('#bf-preview-canvas')?.remove();
        const wrap = area.querySelector('.preview-canvas-wrap') || area;
        wrap.innerHTML = _buildStatBlockHTML(def.opts);
    }

    function _buildStatBlockHTML(opts) {
        const val = Array.isArray(opts.input) && opts.input.length ? opts.input[opts.input.length - 1] : '—';
        const prevBest = Array.isArray(opts.input2) && opts.input2.length ? opts.input2[0] : null;
        const milestone = Array.isArray(opts.input3) && opts.input3.length ? opts.input3[0] : null;
        const prevBestLabel = opts.input2Label || 'Previous Best';
        const milestoneLabel = opts.input3Label || 'Milestone';
        const unit = opts.unit || '';
        return `<div class="stat-block-card">
            <div class="stat-block-value">${val}${unit}</div>
            <div class="stat-block-label">${opts.inputLabel || ''}</div>
            <div class="stat-block-comparisons">
                ${prevBest != null ? `<span class="stat-block-comp">${prevBestLabel}: <strong>${prevBest}${unit}</strong></span>` : ''}
                ${milestone != null ? `<span class="stat-block-comp">${milestoneLabel}: <strong>${milestone}${unit}</strong></span>` : ''}
            </div>
        </div>`;
    }

    function _renderTablePreview(area, opts) {
        area.querySelector('#bf-preview-canvas')?.remove();
        const wrap = area.querySelector('.preview-canvas-wrap') || area;

        // Multi-column table — show column headers, note that rows are added on the card
        if (opts.columns && opts.columns.length) {
            const colHeaders = opts.columns.map(c => `<th>${c.label}</th>`).join('');
            wrap.innerHTML = `<div class="preview-table-wrap"><table class="admin-series-table">
                <thead><tr>${colHeaders}<th></th></tr></thead>
                <tbody><tr><td colspan="${opts.columns.length + 1}" style="color:var(--text-muted);font-style:italic;padding:12px;text-align:center">
                    Rows are added directly on the dashboard card
                </td></tr></tbody>
            </table></div>`;
            return;
        }

        // Legacy 2-column preview
        const rows = opts.input || [];
        const labels = opts.labels && opts.labels.length === rows.length
            ? opts.labels
            : rows.map((_, i) => i + 1);
        wrap.innerHTML = `<div class="preview-table-wrap"><table class="admin-series-table">
            <thead><tr><th>#</th><th>${opts.inputLabel || 'Value'}</th></tr></thead>
            <tbody>${rows.map((v, i) => `<tr><td>${labels[i]}</td><td>${v ?? '—'}</td></tr>`).join('')}</tbody>
        </table></div>`;
    }

    function _renderCalendarPreview(area, def) {
        area.querySelector('#bf-preview-canvas')?.remove();
        const wrap = area.querySelector('.preview-canvas-wrap') || area;
        const previewId = 'bf-cal-preview';
        wrap.innerHTML = `<div id="${previewId}" class="chart-cross-grid-wrap" style="max-width:420px;margin:0 auto"></div>`;
        const month = parseInt(document.getElementById('monthSelect')?.value ?? new Date().getMonth());
        const year  = parseInt(document.getElementById('yearSelect')?.value  ?? new Date().getFullYear());
        VPMCharts.renderEditableCalendar(previewId, month, year, {
            storageKey: 'custom-' + def.id,
            noAutoGreen: true
        });
    }

    function _collectFormDef(tpl) {
        const title = document.getElementById('bf-title')?.value.trim();
        if (!title) { _showToast('Please enter a chart title', true); return null; }

        const tab = document.getElementById('bf-tab')?.value;

        // Calendar has no data series — just title + tab + type
        if (tpl.type === 'calendar') {
            const id = _editingChartId || ('chart-' + Date.now());
            return { id, title, tab, templateType: tpl.id, canvasId: 'custom-' + id, opts: { type: 'calendar' } };
        }

        // Custom multi-column table — columns defined in builder, rows added on dashboard
        if (tpl.type === 'table') {
            const colRows   = document.querySelectorAll('#bf-col-list .tbl-col-row');
            const columns   = Array.from(colRows).map((row, i) => {
                const label = row.querySelector('.tbl-col-input')?.value.trim() || '';
                const wVal  = parseInt(row.querySelector('.tbl-col-width')?.value || '');
                return { key: 'c' + i, label, width: isNaN(wVal) ? null : Math.min(99, Math.max(1, wVal)) };
            }).filter(c => c.label);
            if (!columns.length) { _showToast('Add at least one column name', true); return null; }
            // Preserve existing rows when editing
            let tableRows = [];
            if (_editingChartId) {
                const existing = VPMDataStore.getCustomCharts().find(c => c.id === _editingChartId);
                if (existing?.opts?.tableRows) tableRows = existing.opts.tableRows;
            }
            const id = _editingChartId || ('chart-' + Date.now());
            return { id, title, tab, templateType: tpl.id, canvasId: 'custom-' + id,
                     opts: { type: 'table', columns, tableRows } };
        }

        const labelsRaw = document.getElementById('bf-labels')?.value.trim();
        const labels = labelsRaw ? labelsRaw.split(',').map(s => s.trim()) : null;

        const parseNums = (str) => str ? str.split(',').map(s => {
            const n = parseFloat(s.trim());
            return isNaN(n) ? null : n;
        }) : [];

        const inputRaw = document.getElementById('bf-input')?.value.trim();
        const input = parseNums(inputRaw);
        // If user provided fewer labels than data points, pad with auto-numbers
        const baseLabels = labels && labels.length ? labels : [];
        const finalLabels = baseLabels.length >= input.length
            ? baseLabels.slice(0, input.length)
            : [...baseLabels, ...input.slice(baseLabels.length).map((_, i) => String(baseLabels.length + i + 1))];

        const opts = {
            input,
            labels: finalLabels,
            type: tpl.type,
            unit: document.getElementById('bf-unit')?.value || '',
            inputLabel: document.getElementById('bf-inputlabel')?.value || 'Actual',
            color: document.getElementById('bf-color')?.value || '#3b82f6'
        };

        const yMinVal = document.getElementById('bf-ymin')?.value;
        const yMaxVal = document.getElementById('bf-ymax')?.value;
        if (yMinVal !== '' && yMinVal != null) opts.yMin = parseFloat(yMinVal);
        if (yMaxVal !== '' && yMaxVal != null) opts.yMax = parseFloat(yMaxVal);

        if (tpl.showTarget) {
            const targetRaw = document.getElementById('bf-target')?.value.trim();
            // Save to opts.red (red dashed reference line). Clear opts.aop so old
            // incorrectly-saved values don't create a duplicate amber line.
            delete opts.aop;
            if (targetRaw) {
                opts.red = parseNums(targetRaw); // always array — charts.js uses .some()
            }

        }

        // Collect trigger config (available on all data-series types)
        const trigDir = document.getElementById('bf-trigger-dir')?.value;
        if (trigDir) {
            const trigDays = parseInt(document.getElementById('bf-trigger-days')?.value) || 3;
            const trigVal = parseFloat(document.getElementById('bf-trigger-value')?.value);
            opts.trigger = {
                dir: trigDir,
                days: trigDays,
                value: isNaN(trigVal) ? null : trigVal
            };
        } else {
            delete opts.trigger;
        }

        if (tpl.showGreen) {
            const gv = document.getElementById('bf-green')?.value;
            if (gv !== '' && gv != null) opts.green = parseFloat(gv);
        }
        if (tpl.showRed) {
            const rv = document.getElementById('bf-red')?.value;
            if (rv !== '' && rv != null) opts.red = parseFloat(rv);
        }

        if (tpl.showInput2) {
            const input2Raw = document.getElementById('bf-input2')?.value.trim();
            opts.input2 = parseNums(input2Raw);
            opts.input2Label = document.getElementById('bf-input2label')?.value || 'Series 2';
            const c2 = document.getElementById('bf-input2color')?.value;
            if (c2) opts.input2Color = c2;
        }

        if (tpl.showInput3) {
            const input3Raw = document.getElementById('bf-input3')?.value.trim();
            opts.input3 = parseNums(input3Raw);
            opts.input3Label = document.getElementById('bf-input3label')?.value || 'Series 3';
            const c3 = document.getElementById('bf-input3color')?.value;
            if (c3) opts.input3Color = c3;
        }

        const id = _editingChartId || ('chart-' + Date.now());
        const canvasId = 'custom-' + id;

        return { id, title, tab, templateType: tpl.id, canvasId, opts };
    }

    function _saveChart() {
        const tpl = _selectedTemplate;
        const def = _collectFormDef(tpl);
        if (!def) return;

        VPMDataStore.saveCustomChart(def);
        _showToast('Chart saved: ' + def.title);

        // Inject into the DOM now
        injectChart(def);

        // Trigger re-render for the target tab
        document.dispatchEvent(new CustomEvent('vpm:requestRender'));

        // Return to step 1
        _renderBuilderStep1();
    }

    // ====================================================
    // CHART INJECTION
    // ====================================================

    /**
     * Inject a custom chart card into its target tab panel.
     * Creates: panel-{tab} > .charts-row > .chart-card.wide > canvas#canvasId
     */
    function injectChart(def) {
        // Resolve opts for linked charts
        const opts = VPMDataStore.resolveChartOpts(def);
        const isLinked = !!def.linkedTo;

        // Source removed — show warning card instead
        if (isLinked && !opts) {
            _injectSourceRemovedCard(def);
            return;
        }

        if (!opts) return; // no data at all

        // For linked charts, sub-injectors need opts on def.
        // Create a working copy with resolved opts so they can read def.opts.
        const workDef = isLinked ? Object.assign({}, def, { opts }) : def;

        if (opts.type === 'statBlock') {
            _injectStatBlockCard(workDef);
            return;
        }
        if (opts.type === 'kpi') {
            _injectKpiCard(workDef);
            return;
        }
        if (opts.type === 'table') {
            _injectTableCard(workDef);
            return;
        }
        if (opts.type === 'calendar') {
            _injectCalendarCard(workDef);
            return;
        }
        if (opts.type === 'imageBoard') {
            _injectImageBoardCard(workDef);
            return;
        }

        const panel = document.getElementById('panel-' + workDef.tab);
        if (!panel) {
            console.warn('[injectChart] Panel not found: panel-' + workDef.tab);
            return;
        }

        // Fallback row if no layout-grid exists
        let row = panel.querySelector('.custom-charts-row');
        if (!row) {
            row = document.createElement('div');
            row.className = 'charts-row custom-charts-row';
            panel.appendChild(row);
        }

        // Remove old card if editing
        const old = document.getElementById(workDef.canvasId);
        if (old) old.closest('.chart-card')?.remove();

        // Linked badge HTML
        const linkedBadge = isLinked
            ? '<span class="linked-chart-badge" title="Data managed at T' + def.linkedTo.sourceTier + ' — updates automatically">\u2191 T' + def.linkedTo.sourceTier + '</span>'
            : '';

        const card = document.createElement('div');
        card.className = 'chart-card wide' + (isLinked ? ' linked-chart-card' : '');
        card.setAttribute('data-custom-chart-id', workDef.id);
        card.innerHTML = '<div class="chart-header">' +
            '<h3 class="chart-title">' + workDef.title + '</h3>' +
            linkedBadge +
        '</div>' +
        '<canvas id="' + workDef.canvasId + '" height="260"></canvas>';

        // Place into layout-grid (gets width-toggle, drag, quarter-split controls)
        _placeInGrid(card, workDef, row);

        VPMCharts.buildMetricChart(workDef.canvasId, opts);
    }

    // Attach the note/escalation box to any card that has no <canvas>.
    // Plants a hidden anchor element so VPMCharts.attachNoteBox can find the card.
    function _attachNoteBox(card, def) {
        if (typeof VPMCharts === 'undefined' || !card || !def) return;
        const anchorId = 'note-anchor-' + def.id;
        if (document.getElementById(anchorId)) return; // already attached
        const anchor = document.createElement('span');
        anchor.id = anchorId;
        anchor.hidden = true;
        card.appendChild(anchor);
        VPMCharts.attachNoteBox(anchorId, def.title);
    }

    // Place a custom card into the layout-grid (so chart-layout.js attaches
    // width-toggle + drag-handle), then fire initTab + attachAll.
    function _placeInGrid(card, def, fallbackRow) {
        const panel = document.getElementById('panel-' + def.tab);
        const grid  = panel && panel.querySelector('.layout-grid');
        if (grid) {
            grid.appendChild(card);
        } else if (fallbackRow) {
            fallbackRow.appendChild(card);
        }
        _attachNoteBox(card, def);
        if (typeof VPMChartVisibility !== 'undefined') VPMChartVisibility.attachAll();
        if (typeof VPMLayout !== 'undefined') VPMLayout.initTab('panel-' + def.tab);
    }

    function _injectStatBlockCard(def) {
        const panel = document.getElementById('panel-' + def.tab);
        if (!panel) return;

        // Stat blocks get their own 3-column row, separate from regular custom charts
        let row = panel.querySelector('.stat-blocks-row');
        if (!row) {
            row = document.createElement('div');
            row.className = 'stat-blocks-row';
            // Insert before any custom-charts-row, or append
            const customRow = panel.querySelector('.custom-charts-row');
            customRow ? panel.insertBefore(row, customRow) : panel.appendChild(row);
        }

        const old = document.querySelector(`[data-custom-chart-id="${def.id}"]`);
        if (old) old.remove();

        const card = document.createElement('div');
        card.className = 'chart-card stat-block-card-wrap';
        card.setAttribute('data-custom-chart-id', def.id);
        card.innerHTML = `<div class="chart-header"><h3 class="chart-title">${def.title}</h3></div>
            ${_buildStatBlockHTML(def.opts)}`;
        _placeInGrid(card, def, row);
    }

    function _injectKpiCard(def) {
        const panel = document.getElementById('panel-' + def.tab);
        if (!panel) return;

        let row = panel.querySelector('.custom-charts-row');
        if (!row) {
            row = document.createElement('div');
            row.className = 'charts-row custom-charts-row';
            panel.appendChild(row);
        }

        const old = document.querySelector(`[data-custom-chart-id="${def.id}"]`);
        if (old) old.remove();

        const val = Array.isArray(def.opts.input) && def.opts.input.length
            ? def.opts.input[def.opts.input.length - 1]
            : '—';
        const target = Array.isArray(def.opts.aop) && def.opts.aop.length
            ? def.opts.aop[0]
            : def.opts.aop;

        const card = document.createElement('div');
        card.className = 'chart-card kpi-inject-card';
        card.setAttribute('data-custom-chart-id', def.id);
        card.innerHTML = `<div class="chart-header">
            <h3 class="chart-title">${def.title}</h3>
        </div>
        <div class="kpi-inject-value">${val}${def.opts.unit || ''}</div>
        ${target != null ? `<div class="kpi-inject-target">Target: ${target}${def.opts.unit || ''}</div>` : ''}`;
        _placeInGrid(card, def, row);
    }

    function _injectTableCard(def) {
        const panel = document.getElementById('panel-' + def.tab);
        if (!panel) return;

        let row = panel.querySelector('.custom-charts-row');
        if (!row) {
            row = document.createElement('div');
            row.className = 'charts-row custom-charts-row';
            panel.appendChild(row);
        }

        const old = document.querySelector(`[data-custom-chart-id="${def.id}"]`);
        if (old) old.remove();

        // ── New multi-column CRUD table ──────────────────────────────────────
        if (def.opts.columns && def.opts.columns.length) {
            _injectCustomTableCard(def, row);
            return;
        }

        // ── Legacy 2-column read-only table (backward compat) ────────────────
        const rows   = def.opts.input || [];
        const labels = def.opts.labels && def.opts.labels.length === rows.length
            ? def.opts.labels
            : rows.map((_, i) => i + 1);
        const card = document.createElement('div');
        card.className = 'chart-card wide';
        card.setAttribute('data-custom-chart-id', def.id);
        card.innerHTML = `<div class="chart-header"><h3 class="chart-title">${def.title}</h3></div>
        <div class="custom-table-wrap"><table class="admin-series-table">
            <thead><tr><th>#</th><th>${def.opts.inputLabel || 'Value'}</th></tr></thead>
            <tbody>${rows.map((v, i) => `<tr><td>${labels[i]}</td><td>${v ?? '—'}</td></tr>`).join('')}</tbody>
        </table></div>`;
        _placeInGrid(card, def, row);
    }

    function _injectCustomTableCard(def, row) {
        const _esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const columns   = def.opts.columns;
        const tableRows = def.opts.tableRows || [];

        const card = document.createElement('div');
        card.className = 'chart-card wide';
        card.setAttribute('data-custom-chart-id', def.id);

        function buildTableHTML() {
            const hasWidths = columns.some(c => c.width);
            // <colgroup> is the reliable way to set column widths —
            // mixing % on <th> with a px action column causes browsers to recalculate.
            const colgroup = `<colgroup>${
                columns.map(c => c.width ? `<col style="width:${c.width}%">` : '<col>').join('')
            }<col style="width:36px"></colgroup>`;

            const thead = columns.map(c => `<th>${_esc(c.label)}</th>`).join('') +
                          '<th class="ctbl-act-col"></th>';
            const tbody = tableRows.length
                ? tableRows.map((r, ri) =>
                    `<tr>${columns.map(c =>
                        `<td class="ctbl-cell" data-key="${c.key}" data-ri="${ri}">${_esc(r[c.key] || '')}</td>`
                    ).join('')}<td class="ctbl-act-col"><button class="ctbl-del-row" data-ri="${ri}" title="Delete">&times;</button></td></tr>`
                ).join('')
                : `<tr><td colspan="${columns.length + 1}" class="ctbl-empty">No rows yet — click <strong>+ Add Row</strong></td></tr>`;
            const tableStyle = hasWidths ? ' style="table-layout:fixed;width:100%"' : '';
            return `<table class="custom-table"${tableStyle}>${colgroup}<thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
        }

        function buildAddForm() {
            return `<div class="ctbl-add-form" style="display:none">
                <div class="ctbl-form-inputs">${columns.map(c =>
                    `<input class="ctbl-form-input" data-key="${c.key}" placeholder="${_esc(c.label)}" type="text">`
                ).join('')}</div>
                <div class="ctbl-form-btns">
                    <button class="ctbl-confirm-add admin-btn primary">+ Add</button>
                    <button class="ctbl-cancel-add admin-btn secondary">Cancel</button>
                </div>
            </div>`;
        }

        card.innerHTML = `<div class="chart-header">
            <h3 class="chart-title">${_esc(def.title)}</h3>
            <button class="ctbl-toggle-add admin-btn secondary">+ Add Row</button>
        </div>
        <div class="ctbl-table-wrap">${buildTableHTML()}</div>
        ${buildAddForm()}`;

        // Place into layout-grid (for controls) or fall back to custom-charts-row
        _placeInGrid(card, def, row);

        function persist() { def.opts.tableRows = tableRows; VPMDataStore.saveCustomChart(def); }

        function refresh() {
            card.querySelector('.ctbl-table-wrap').innerHTML = buildTableHTML();
            bindRowEvents();
        }

        function bindRowEvents() {
            card.querySelectorAll('.ctbl-del-row').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (!confirm('Delete this row?')) return;
                    tableRows.splice(parseInt(btn.dataset.ri), 1);
                    persist(); refresh();
                });
            });
            card.querySelectorAll('.ctbl-cell').forEach(td => {
                td.addEventListener('dblclick', () => {
                    if (td.querySelector('input')) return;
                    const orig = td.textContent;
                    td.innerHTML = `<input class="ctbl-inline-input" value="${_esc(orig)}" type="text">`;
                    const inp = td.querySelector('input');
                    inp.focus(); inp.select();
                    const commit = () => { tableRows[parseInt(td.dataset.ri)][td.dataset.key] = inp.value; persist(); refresh(); };
                    inp.addEventListener('blur', commit);
                    inp.addEventListener('keydown', e => {
                        if (e.key === 'Enter') { e.preventDefault(); commit(); }
                        if (e.key === 'Escape') { td.textContent = orig; }
                    });
                });
            });
        }

        const addForm = card.querySelector('.ctbl-add-form');
        card.querySelector('.ctbl-toggle-add').addEventListener('click', () => {
            addForm.style.display = addForm.style.display === 'none' ? '' : 'none';
            if (addForm.style.display !== 'none') addForm.querySelector('.ctbl-form-input')?.focus();
        });
        card.querySelector('.ctbl-confirm-add').addEventListener('click', () => {
            const inputs = addForm.querySelectorAll('.ctbl-form-input');
            const newRow = {};
            inputs.forEach(i => { newRow[i.dataset.key] = i.value.trim(); });
            if (Object.values(newRow).every(v => !v)) return;
            tableRows.push(newRow);
            persist();
            inputs.forEach(i => { i.value = ''; });
            addForm.querySelector('.ctbl-form-input')?.focus();
            refresh();
        });
        card.querySelector('.ctbl-cancel-add').addEventListener('click', () => { addForm.style.display = 'none'; });

        bindRowEvents();
    }

    function _injectSourceRemovedCard(def) {
        const panel = document.getElementById('panel-' + def.tab);
        if (!panel) return;
        let row = panel.querySelector('.custom-charts-row');
        if (!row) {
            row = document.createElement('div');
            row.className = 'charts-row custom-charts-row';
            panel.appendChild(row);
        }
        const old = document.getElementById(def.canvasId);
        if (old) old.closest('.chart-card')?.remove();

        const card = document.createElement('div');
        card.className = 'chart-card wide linked-chart-card linked-source-removed';
        card.setAttribute('data-custom-chart-id', def.id);
        card.innerHTML =
            '<div class="chart-header">' +
                '<h3 class="chart-title">' + def.title + '</h3>' +
                '<span class="linked-chart-badge linked-badge-warn">↑ T' + (def.linkedTo?.sourceTier || '?') + ' removed</span>' +
            '</div>' +
            '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px">' +
                'Source chart was deleted at T' + (def.linkedTo?.sourceTier || '?') + '. Remove this linked chart or re-import.' +
            '</div>';
        row.appendChild(card);

        if (typeof VPMChartVisibility !== 'undefined') VPMChartVisibility.attachAll();
        if (typeof VPMLayout !== 'undefined') VPMLayout.initTab('panel-' + def.tab);
    }

    // ====================================================
    // IMAGE BOARD CARD
    // ====================================================

    function _injectImageBoardCard(def) {
        const panel = document.getElementById('panel-' + def.tab);
        if (!panel) return;

        let row = panel.querySelector('.custom-charts-row');
        if (!row) {
            row = document.createElement('div');
            row.className = 'charts-row custom-charts-row layout-grid';
            row.dataset.panelId = 'panel-' + def.tab;
            panel.appendChild(row);
        }

        const old = document.querySelector('[data-custom-chart-id="' + def.id + '"]');
        if (old) old.remove();

        const opts = def.opts || {};
        const images = opts.images || [];
        const maxImg = opts.maxImages || 5;
        const defaultExpiry = opts.defaultExpiry || 0;
        const tier = (typeof VPMEscalation !== 'undefined') ? VPMEscalation.getCurrentTier() : 1;
        const hasTM = typeof VPMTierManager !== 'undefined';
        const parentId = hasTM ? VPMTierManager.getParentId(tier) : null;
        const childIds = hasTM ? VPMTierManager.getChildIds(tier) : [];
        const canEscUp = parentId != null;
        const canCasDown = childIds.length > 0;

        const card = document.createElement('div');
        card.className = 'chart-card img-board-card';
        card.setAttribute('data-custom-chart-id', def.id);

        function _save() {
            def.opts.images = images;
            VPMDataStore.saveCustomChart(def);
        }

        function _compressImage(file, callback) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX = 1920; // preserve detail for modern screens
                    let w = img.width, h = img.height;
                    if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
                    if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
                    canvas.width = w;
                    canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    canvas.toBlob((blob) => {
                        const fr = new FileReader();
                        fr.onload = () => callback(fr.result, blob, w, h);
                        fr.readAsDataURL(blob);
                    }, 'image/jpeg', 0.75);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }

        function _addImage(dataUrl, blob, w, h) {
            if (images.length >= maxImg) { alert('Max ' + maxImg + ' images'); return; }
            const id = 'img-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5);
            const filename = id + '.jpg';
            const now = new Date();
            const expiresAt = defaultExpiry > 0
                ? new Date(now.getTime() + defaultExpiry * 3600000).toISOString() : null;

            const entry = {
                id, filename,
                caption: '',
                timestamp: now.toISOString(),
                addedBy: '',
                expiresAt,
                dataUrl,
                escalatedTo: [],
                cascadedTo: [],
                sourceBoard: null,
                sourceTab: null,
                width: w, height: h
            };
            images.push(entry);

            // Save to file system if available
            if (blob && typeof VPMFileStore !== 'undefined' && VPMFileStore.isReady()) {
                VPMFileStore.writeImage('t' + tier, filename, blob).catch(() => {});
            }

            _save();
            _render();
        }

        function _deleteImage(imgId) {
            const idx = images.findIndex(i => i.id === imgId);
            if (idx < 0) return;
            const img = images[idx];
            images.splice(idx, 1);
            // Delete file
            if (img.filename && typeof VPMFileStore !== 'undefined' && VPMFileStore.isReady()) {
                VPMFileStore.deleteImage('t' + tier, img.filename).catch(() => {});
            }
            _save();
            _render();
        }

        function _escalateImage(imgId) {
            if (!hasTM) return;
            const parentId = VPMTierManager.getParentId(tier);
            if (!parentId) return;
            const img = images.find(i => i.id === imgId);
            if (!img) return;
            _sendImageToBoard(img, parentId, def.tab);
            if (!img.escalatedTo.includes(parentId)) img.escalatedTo.push(parentId);
            _save();
            _render();
        }

        function _cascadeImage(imgId) {
            if (!hasTM) return;
            const childIds = VPMTierManager.getChildIds(tier);
            if (!childIds.length) return;
            const img = images.find(i => i.id === imgId);
            if (!img) return;
            childIds.forEach(cid => {
                _sendImageToBoard(img, cid, def.tab);
                if (!img.cascadedTo.includes(cid)) img.cascadedTo.push(cid);
            });
            _save();
            _render();
        }

        function _sendImageToBoard(img, targetBoardId, sourceTab) {
            // Find or create an image board on the target board's matching tab
            const allCharts = VPMDataStore.getCustomCharts();
            const targetTab = _tabExistsOnBoard(targetBoardId, sourceTab) ? sourceTab : 'overview';

            let targetBoard = allCharts.find(c =>
                c.tier === targetBoardId && c.tab === targetTab &&
                c.opts?.type === 'imageBoard'
            );

            if (!targetBoard) {
                // Auto-create image board on target
                targetBoard = {
                    id: 'imgboard-' + targetBoardId + '-' + targetTab + '-' + Date.now(),
                    tab: targetTab,
                    title: 'Visual Board',
                    canvasId: 'img-' + Date.now(),
                    templateType: 'image-board',
                    tier: targetBoardId,
                    opts: { type: 'imageBoard', maxImages: 5, defaultExpiry: 0, images: [] }
                };
                VPMDataStore.saveCustomChart(targetBoard);
            }

            // Copy image metadata (not file — reference same file)
            const copy = {
                ...img,
                id: 'img-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
                sourceBoard: tier,
                sourceTab: sourceTab,
                escalatedTo: [],
                cascadedTo: []
            };

            if (!targetBoard.opts.images) targetBoard.opts.images = [];
            if (targetBoard.opts.images.length < (targetBoard.opts.maxImages || 5)) {
                targetBoard.opts.images.push(copy);
                VPMDataStore.saveCustomChart(targetBoard);
            }
        }

        function _tabExistsOnBoard(boardId, tabName) {
            if (!hasTM) return true;
            const tabs = VPMTierManager.getTabsForTier(boardId);
            return tabs.some(t => t.id === tabName || t === tabName);
        }

        function _showLightbox(img) {
            const existing = document.getElementById('imgLightbox');
            if (existing) existing.remove();

            const lb = document.createElement('div');
            lb.id = 'imgLightbox';
            lb.className = 'img-lightbox';
            lb.innerHTML =
                '<button class="img-lightbox-close">&times;</button>' +
                '<img src="' + (img.dataUrl || '') + '">' +
                '<div class="img-lightbox-caption">' +
                    (img.caption ? '<strong>' + _esc(img.caption) + '</strong> — ' : '') +
                    new Date(img.timestamp).toLocaleString() +
                    (img.sourceBoard ? ' — From T' + img.sourceBoard + '/' + (img.sourceTab || 'Overview') : '') +
                '</div>';
            document.body.appendChild(lb);
            lb.querySelector('.img-lightbox-close').addEventListener('click', () => lb.remove());
            lb.addEventListener('click', (e) => { if (e.target === lb) lb.remove(); });
            document.addEventListener('keydown', function _esc(e) {
                if (e.key === 'Escape') { lb.remove(); document.removeEventListener('keydown', _esc); }
            });
        }

        function _esc(str) {
            const d = document.createElement('div');
            d.textContent = str || '';
            return d.innerHTML;
        }

        function _render() {
            // Clean expired images
            const now = new Date();
            for (let i = images.length - 1; i >= 0; i--) {
                if (images[i].expiresAt && new Date(images[i].expiresAt) < now) {
                    const img = images[i];
                    images.splice(i, 1);
                    if (img.filename && typeof VPMFileStore !== 'undefined' && VPMFileStore.isReady()) {
                        VPMFileStore.deleteImage('t' + tier, img.filename).catch(() => {});
                    }
                }
            }

            const count = images.length;
            card.innerHTML =
                '<div class="chart-header img-board-header">' +
                    '<h3 class="chart-title">' + _esc(def.title || 'Visual Board') +
                        '<span class="img-board-count">' + count + '/' + maxImg + '</span>' +
                    '</h3>' +
                '</div>' +
                '<div class="img-strip">' +
                    images.map(img => {
                        const escBadges = img.escalatedTo?.length
                            ? '<span class="img-esc-badge">\u2191T' + img.escalatedTo.join(',T') + '</span>' : '';
                        const casBadges = img.cascadedTo?.length
                            ? '<span class="img-cas-badge">\u2193T' + img.cascadedTo.join(',T') + '</span>' : '';
                        const fromBadge = img.sourceBoard
                            ? '<span class="img-from-badge">From T' + img.sourceBoard + '</span>' : '';

                        return '<div class="img-slot" data-img-id="' + img.id + '">' +
                            '<img src="' + (img.dataUrl || '') + '" alt="" loading="lazy">' +
                            '<div class="img-slot-badges">' + fromBadge + escBadges + casBadges + '</div>' +
                            '<div class="img-slot-actions">' +
                                (canEscUp ? '<button class="img-esc-btn" title="Escalate to T' + parentId + '">\u2191</button>' : '') +
                                (canCasDown ? '<button class="img-cas-btn" title="Cascade down">\u2193</button>' : '') +
                                '<button class="img-del-btn" title="Delete">\u00d7</button>' +
                            '</div>' +
                            '<div class="img-slot-meta">' +
                                (img.caption ? '<div class="img-slot-caption">' + _esc(img.caption) + '</div>' : '') +
                                '<div class="img-slot-time">' + new Date(img.timestamp).toLocaleDateString() + '</div>' +
                            '</div>' +
                        '</div>';
                    }).join('') +
                    // Empty slots
                    (count < maxImg
                        ? '<div class="img-slot img-slot-empty"><span class="img-paste-icon">\ud83d\udccb</span><span>Paste or drop</span></div>'
                        : '') +
                '</div>' +
                '<div class="img-board-footer">' +
                    '<span class="img-board-hint"><kbd>Ctrl</kbd>+<kbd>V</kbd> to paste</span>' +
                    '<span class="img-board-expiry">Expire: <select class="img-expiry-sel">' +
                        '<option value="0"' + (defaultExpiry === 0 ? ' selected' : '') + '>Never</option>' +
                        '<option value="24"' + (defaultExpiry === 24 ? ' selected' : '') + '>24 hrs</option>' +
                        '<option value="72"' + (defaultExpiry === 72 ? ' selected' : '') + '>3 days</option>' +
                        '<option value="120"' + (defaultExpiry === 120 ? ' selected' : '') + '>5 days</option>' +
                        '<option value="168"' + (defaultExpiry === 168 ? ' selected' : '') + '>7 days</option>' +
                        '<option value="336"' + (defaultExpiry === 336 ? ' selected' : '') + '>14 days</option>' +
                        '<option value="720"' + (defaultExpiry === 720 ? ' selected' : '') + '>30 days</option>' +
                    '</select></span>' +
                '</div>';

            // Wire events
            card.querySelectorAll('.img-slot[data-img-id]').forEach(slot => {
                const imgId = slot.dataset.imgId;
                slot.addEventListener('dblclick', () => {
                    const img = images.find(i => i.id === imgId);
                    if (img) _showLightbox(img);
                });
                // Caption edit on click
                const captionEl = slot.querySelector('.img-slot-caption');
                if (captionEl) {
                    captionEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const img = images.find(i => i.id === imgId);
                        if (!img) return;
                        const newCap = prompt('Caption:', img.caption || '');
                        if (newCap !== null) { img.caption = newCap; _save(); _render(); }
                    });
                }
                const escBtn = slot.querySelector('.img-esc-btn');
                if (escBtn) escBtn.addEventListener('click', (e) => { e.stopPropagation(); _escalateImage(imgId); });
                const casBtn = slot.querySelector('.img-cas-btn');
                if (casBtn) casBtn.addEventListener('click', (e) => { e.stopPropagation(); _cascadeImage(imgId); });
                const delBtn = slot.querySelector('.img-del-btn');
                if (delBtn) delBtn.addEventListener('click', (e) => { e.stopPropagation(); _deleteImage(imgId); });
            });

            // Empty slot click
            card.querySelector('.img-slot-empty')?.addEventListener('click', () => _triggerPaste());

            // Expiry dropdown
            const expSel = card.querySelector('.img-expiry-sel');
            if (expSel) {
                expSel.addEventListener('change', () => {
                    def.opts.defaultExpiry = parseInt(expSel.value) || 0;
                    _save();
                });
            }
        }

        function _triggerPaste() {
            // Focus card so paste events work
            card.focus();
        }

        // Paste handler
        card.setAttribute('tabindex', '0');
        card.addEventListener('paste', (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (file) _compressImage(file, _addImage);
                    return;
                }
            }
        });

        // Drag and drop
        card.addEventListener('dragover', (e) => { e.preventDefault(); card.classList.add('img-dragover'); });
        card.addEventListener('dragleave', () => card.classList.remove('img-dragover'));
        card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.classList.remove('img-dragover');
            const file = e.dataTransfer?.files?.[0];
            if (file && file.type.startsWith('image/')) {
                _compressImage(file, _addImage);
            }
        });

        _render();
        _placeInGrid(card, def, row);
    }

    function _injectCalendarCard(def) {
        const panel = document.getElementById('panel-' + def.tab);
        if (!panel) return;

        let row = panel.querySelector('.custom-charts-row');
        if (!row) {
            row = document.createElement('div');
            row.className = 'charts-row custom-charts-row';
            panel.appendChild(row);
        }

        const old = document.querySelector(`[data-custom-chart-id="${def.id}"]`);
        if (old) old.remove();

        const gridId = 'cal-' + def.id;
        const card = document.createElement('div');
        card.className = 'chart-card';
        card.setAttribute('data-custom-chart-id', def.id);
        card.innerHTML = `<div class="chart-header">
            <h3 class="chart-title">${def.title}</h3>
        </div>
        <div id="${gridId}" class="chart-cross-grid-wrap"></div>`;
        _placeInGrid(card, def, row);

        const month = parseInt(document.getElementById('monthSelect')?.value ?? new Date().getMonth());
        const year  = parseInt(document.getElementById('yearSelect')?.value  ?? new Date().getFullYear());
        VPMCharts.renderEditableCalendar(gridId, month, year, {
            storageKey: def.opts?.storageKey || ('custom-' + def.id),
            noAutoGreen: !def.opts?.storageKey  // built-in calendars keep auto-green
        });
    }

    /** Called on init to re-inject all persisted custom charts */
    function _reinjectAllCharts() {
        VPMDataStore.getCustomCharts().forEach(def => injectChart(def));
    }

    /** Called from app.js renderCurrentTab to ensure custom charts for a tab are present */
    function renderCustomChartsForTab(tab) {
        const month = parseInt(document.getElementById('monthSelect')?.value ?? new Date().getMonth());
        const year  = parseInt(document.getElementById('yearSelect')?.value  ?? new Date().getFullYear());

        VPMDataStore.getChartsForTab(tab).forEach(def => {
            // Resolve opts (follows linkedTo if present)
            const opts = VPMDataStore.resolveChartOpts(def);

            // Linked chart with deleted source — show warning
            if (def.linkedTo && !opts) {
                const existing = document.querySelector('[data-custom-chart-id="' + def.id + '"]');
                if (!existing) _injectSourceRemovedCard(def);
                return;
            }

            if (!opts) return;

            if (opts.type === 'calendar') {
                const gridId = 'cal-' + def.id;
                const grid = document.getElementById(gridId);
                if (grid) {
                    VPMCharts.renderEditableCalendar(gridId, month, year, {
                        storageKey: opts.storageKey || ('custom-' + def.id),
                        noAutoGreen: !opts.storageKey
                    });
                } else {
                    _injectCalendarCard(def);
                }
                return;
            }

            const canvas = document.getElementById(def.canvasId);
            if (!canvas) {
                injectChart(def);
                return;
            }
            // Canvas exists — redraw with resolved opts
            if (opts.type !== 'kpi' && opts.type !== 'table') {
                VPMCharts.buildMetricChart(def.canvasId, opts);
            }
        });
    }

    // ====================================================
    // EDIT / DELETE CHART
    // ====================================================

    function editChart(id) {
        const def = VPMDataStore.getCustomCharts().find(c => c.id === id);
        if (!def) return;

        // Call open() FIRST — _renderBuilderStep1() inside it resets _selectedTemplate
        // and _editingChartId to null, so we must set them AFTER open() returns.
        open();

        _editingChartId = id;
        _selectedTemplate = TEMPLATES.find(t => t.id === def.templateType) || TEMPLATES[0];

        // Manually switch to builder tab without re-calling _renderBuilderStep1
        _activeAdminTab = 'builder';
        document.querySelectorAll('[data-admin-tab]').forEach(b =>
            b.classList.toggle('active', b.dataset.adminTab === 'builder'));
        document.querySelectorAll('.admin-panel-body').forEach(p => {
            p.style.display = (p.id === 'admin-panel-builder') ? '' : 'none';
        });
        _renderBuilderStep2(def);
    }

    function removeChart(id) {
        if (!confirm('Delete this custom chart?')) return;
        if (!confirm('Are you sure? This cannot be undone.')) return;
        removeChartNoConfirm(id);
    }

    function removeChartNoConfirm(id) {
        const el = document.querySelector(`[data-custom-chart-id="${id}"]`);
        if (el) el.remove();
        VPMDataStore.deleteCustomChart(id);
        _showToast('Chart deleted');
        _renderBuilderStep1();
    }

    function removeAllChartsForTab(tabId) {
        const charts = VPMDataStore.getChartsForTab(tabId);
        charts.forEach(c => {
            const el = document.querySelector(`[data-custom-chart-id="${c.id}"]`);
            if (el) el.remove();
            VPMDataStore.deleteCustomChart(c.id);
        });
    }

    // ====================================================
    // EDIT BUILT-IN CHART (configure display overrides)
    // ====================================================

    function editBuiltinChart(canvasId, titleFallback) {
        if (typeof VPMChartOverrides === 'undefined') return;
        const ov  = VPMChartOverrides.get(canvasId) || {};
        const cur = VPMCharts.instances[canvasId];

        // Get current title from card header
        const canvas = document.getElementById(canvasId);
        const card   = canvas?.closest('.chart-card');
        const currentTitle = card?.querySelector('.chart-header h3')?.textContent?.trim() || card?.querySelector('.chart-title')?.textContent?.trim() || titleFallback || canvasId;

        // Build a floating config panel
        let panel = document.getElementById('builtin-edit-panel');
        if (panel) panel.remove();

        panel = document.createElement('div');
        panel.id        = 'builtin-edit-panel';
        panel.className = 'builtin-edit-panel';
        panel.innerHTML = `
            <div class="builtin-edit-header">
                <span class="builtin-edit-title">Configure Chart</span>
                <button class="builtin-edit-close" onclick="document.getElementById('builtin-edit-panel').remove()">×</button>
            </div>
            <div class="builtin-edit-body">
                <label class="builtin-edit-label">Title
                    <input type="text" id="be-title" class="builtin-edit-input" value="${VPMCharts.escapeHtml(ov.title || currentTitle)}">
                </label>
                <label class="builtin-edit-label">Primary Colour
                    <input type="color" id="be-color" class="builtin-edit-color" value="${ov.color || '#3b82f6'}">
                </label>
                <label class="builtin-edit-label">Red / Lower Target
                    <input type="number" id="be-red" class="builtin-edit-input" placeholder="e.g. 80" step="any" value="${ov.red ?? ''}">
                </label>
                <label class="builtin-edit-label">Green / Upper Target
                    <input type="number" id="be-green" class="builtin-edit-input" placeholder="e.g. 95" step="any" value="${ov.green ?? ''}">
                </label>
                <label class="builtin-edit-label">AOP Target
                    <input type="number" id="be-aop" class="builtin-edit-input" placeholder="e.g. 90" step="any" value="${ov.aop ?? ''}">
                </label>
                <div class="builtin-edit-row">
                    <label class="builtin-edit-label" style="flex:1">Y-Axis Min
                        <input type="number" id="be-ymin" class="builtin-edit-input" placeholder="auto" step="any" value="${ov.yMin ?? ''}">
                    </label>
                    <label class="builtin-edit-label" style="flex:1">Y-Axis Max
                        <input type="number" id="be-ymax" class="builtin-edit-input" placeholder="auto" step="any" value="${ov.yMax ?? ''}">
                    </label>
                </div>
                <label class="builtin-edit-label">Unit
                    <select id="be-unit" class="builtin-edit-input">
                        <option value="">None</option>
                        <option value="pct" ${(ov.unit||'')==='pct'?'selected':''}>% (percent)</option>
                        <option value="%" ${(ov.unit||'')==='%'?'selected':''}>% (0–1 decimal)</option>
                        <option value="k" ${(ov.unit||'')==='k'?'selected':''}>k (thousands)</option>
                        <option value="M" ${(ov.unit||'')==='M'?'selected':''}>M (millions)</option>
                        <option value="EUR" ${(ov.unit||'')==='EUR'?'selected':''}>EUR (k€)</option>
                    </select>
                </label>
                <div class="builtin-edit-actions">
                    <button class="admin-sm-btn danger" onclick="VPMAdmin.resetBuiltinChart('${canvasId}')">Reset to default</button>
                    <button class="admin-sm-btn" style="margin-left:auto" onclick="document.getElementById('builtin-edit-panel').remove()">Cancel</button>
                    <button class="admin-btn primary" onclick="VPMAdmin.saveBuiltinChart('${canvasId}')">Save</button>
                </div>
            </div>
        `;

        // Position near the card
        document.body.appendChild(panel);
        if (card) {
            const rect = card.getBoundingClientRect();
            panel.style.top  = Math.min(rect.top + window.scrollY, window.innerHeight - 520) + 'px';
            panel.style.left = Math.min(rect.right + 12 + window.scrollX, window.innerWidth - 320) + 'px';
        }
    }

    function saveBuiltinChart(canvasId) {
        if (typeof VPMChartOverrides === 'undefined') return;
        const num = id => { const v = document.getElementById(id)?.value; return v !== '' && v != null ? parseFloat(v) : null; };
        const str = id => document.getElementById(id)?.value || null;

        const overrides = {};
        const title = document.getElementById('be-title')?.value?.trim();
        if (title) overrides.title = title;
        const color = str('be-color'); if (color) overrides.color = color;
        const red   = num('be-red');   if (red   != null) overrides.red   = red;
        const green = num('be-green'); if (green != null) overrides.green = green;
        const aop   = num('be-aop');   if (aop   != null) overrides.aop   = aop;
        const yMin  = num('be-ymin');  if (yMin  != null) overrides.yMin  = yMin;
        const yMax  = num('be-ymax');  if (yMax  != null) overrides.yMax  = yMax;
        const unit  = str('be-unit');  if (unit)          overrides.unit  = unit;

        VPMChartOverrides.set(canvasId, overrides);

        // Update title in card
        if (overrides.title) {
            const canvas = document.getElementById(canvasId);
            const h3 = canvas?.closest('.chart-card')?.querySelector('.chart-header h3') || canvas?.closest('.chart-card')?.querySelector('.chart-title');
            if (h3) h3.textContent = overrides.title;
        }

        // Re-trigger a full render
        document.dispatchEvent(new CustomEvent('vpm:requestRender'));
        document.getElementById('builtin-edit-panel')?.remove();
        _showToast('Chart updated');
    }

    function resetBuiltinChart(canvasId) {
        if (typeof VPMChartOverrides === 'undefined') return;
        VPMChartOverrides.remove(canvasId);
        // Restore original title from card slug (re-render will fix data)
        document.dispatchEvent(new CustomEvent('vpm:requestRender'));
        document.getElementById('builtin-edit-panel')?.remove();
        _showToast('Reset to default');
    }

    // ====================================================
    // TOAST
    // ====================================================

    function _showToast(msg, isError) {
        let toast = document.getElementById('adminToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'adminToast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.className = 'admin-toast' + (isError ? ' error' : '');
        toast.classList.add('visible');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => toast.classList.remove('visible'), 3000);
    }

    // (Sharing tab removed — replaced by "Import from Lower Tier" in Chart Builder)


    // ====================================================
    // PUBLIC EXPOSE (some methods called inline via onclick)
    // ====================================================

    return {
        init,
        open,
        openForMetric,
        openForTab,
        close,
        submitMetric,
        loadMetricTable,
        updateSeriesValue,
        deleteSeriesValue,
        appendFromTable,
        selectTemplate,
        _renderBuilderStep1,
        _previewChart,
        _saveChart,
        injectChart,
        renderCustomChartsForTab,
        editChart,
        removeChart,
        removeChartNoConfirm,
        removeAllChartsForTab,
        editBuiltinChart,
        saveBuiltinChart,
        resetBuiltinChart
    };
})();