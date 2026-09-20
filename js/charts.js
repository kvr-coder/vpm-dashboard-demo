/**
 * VPM Charts V3 - Universal chart builder + Editable calendar + All render functions
 */
const VPMCharts = {
    instances: {},

    applyDefaults() {
        const light = document.body.classList.contains('light-theme');
        Chart.defaults.color         = light ? '#4a3d6e' : '#94a3b8';
        Chart.defaults.borderColor   = light ? 'rgba(139,111,164,0.22)' : 'rgba(42,45,58,0.5)';
        Chart.defaults.font.family   = "'Inter', sans-serif";
        Chart.defaults.font.size     = 11;
        Chart.defaults.plugins.legend.labels.usePointStyle    = true;
        Chart.defaults.plugins.legend.labels.pointStyleWidth  = 10;
        Chart.defaults.plugins.legend.labels.padding          = 12;
        Chart.defaults.plugins.tooltip.backgroundColor = light ? '#ffffff' : '#1a1d27';
        Chart.defaults.plugins.tooltip.titleColor      = light ? '#1c1535' : '#e2e8f0';
        Chart.defaults.plugins.tooltip.bodyColor       = light ? '#4a3d6e' : '#94a3b8';
        Chart.defaults.plugins.tooltip.borderColor     = light ? '#d9d1ec' : '#2a2d3a';
        Chart.defaults.plugins.tooltip.borderWidth     = 1;
        Chart.defaults.plugins.tooltip.padding         = 8;
        Chart.defaults.plugins.tooltip.cornerRadius    = 6;
        Chart.defaults.elements.point.radius           = light ? 3 : 2;
        Chart.defaults.elements.point.hoverRadius      = light ? 5 : 4;
        Chart.defaults.elements.line.tension           = 0.2;
        Chart.defaults.elements.line.borderWidth       = light ? 2.5 : 2;

        // Register CSS-zoom correction plugin (idempotent — skip if already registered).
        // When the page is zoomed via document.documentElement.style.zoom, mouse event
        // clientX/Y are in the zoomed viewport coordinate space, but Chart.js compares them
        // against scale pixels in the unzoomed CSS layout space.  Dividing the chart-event
        // x/y by the current zoom factor corrects the mismatch so tooltips fire at the
        // right position.
        if (!Chart.registry.plugins.get('vpmZoomFix')) {
            Chart.register({
                id: 'vpmZoomFix',
                beforeEvent(_chart, args) {
                    const zoom = window._vpmZoom || 1;
                    if (zoom === 1) return;
                    const e = args.event;
                    if (e.x != null) e.x = e.x / zoom;
                    if (e.y != null) e.y = e.y / zoom;
                }
            });
        }
    },

    destroy(id) {
        if (this.instances[id]) { this.instances[id].destroy(); delete this.instances[id]; }
    },

    create(canvasId, config) {
        this.destroy(canvasId);
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        this.instances[canvasId] = new Chart(canvas, config);
        // Capture serialisable series snapshot for cross-tier sharing
        this._seriesData = this._seriesData || {};
        try {
            this._seriesData[canvasId] = {
                labels: config.data?.labels ? [...config.data.labels] : [],
                datasets: (config.data?.datasets || []).map(ds => ({
                    label:           ds.label || '',
                    data:            Array.isArray(ds.data) ? [...ds.data] : [],
                    borderColor:     typeof ds.borderColor === 'string' ? ds.borderColor : '#3b82f6',
                    backgroundColor: typeof ds.backgroundColor === 'string' ? ds.backgroundColor : 'transparent',
                    borderWidth:     ds.borderWidth || 2,
                    fill:            !!ds.fill,
                    tension:         ds.tension || 0.2,
                    borderDash:      Array.isArray(ds.borderDash) ? ds.borderDash : undefined,
                    pointRadius:     ds.pointRadius
                }))
            };
        } catch (_) { /* non-critical */ }
        return this.instances[canvasId];
    },

    escapeHtml(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; },

    // Filter null values from the end
    trimNulls(arr) {
        if (!arr) return [];
        const a = [...arr];
        while (a.length && a[a.length - 1] === null) a.pop();
        return a;
    },

    // Extend a short array to len by repeating its last value (flat horizontal line)
    fillToLength(arr, len) {
        if (!arr || !arr.length) return arr;
        if (arr.length >= len) return arr.slice(0, len);
        const last = arr[arr.length - 1];
        return [...arr, ...Array(len - arr.length).fill(last)];
    },

    // Build cumulative sum from daily array
    toCumulative(arr) {
        if (!arr) return [];
        let sum = 0;
        return arr.map(v => { if (v !== null && v !== undefined) sum += v; return sum; });
    },

    // ========================================
    // UNIVERSAL CHART BUILDER
    // ========================================

    buildMetricChart(canvasId, opts) {
        // Apply any user overrides saved via the chart config panel
        if (typeof VPMChartOverrides !== 'undefined') {
            opts = VPMChartOverrides.apply(canvasId, opts);
        }

        // Apply title override immediately (before any type-delegation)
        if (opts.title) {
            const cvs = document.getElementById(canvasId);
            const card = cvs?.closest('.chart-card');
            const h3 = card?.querySelector('.chart-header h3') || card?.querySelector('.chart-title');
            if (h3) h3.textContent = opts.title;
        }

        // Delegate special types that need a different Chart.js config
        if (opts.type === 'donut')         return this._buildDonutChart(canvasId, opts);
        if (opts.type === 'radar')         return this._buildRadarChart(canvasId, opts);
        if (opts.type === 'scatter')       return this._buildScatterChart(canvasId, opts);
        if (opts.type === 'horizontalBar') return this._buildHorizontalBarChart(canvasId, opts);
        if (opts.type === 'stackedBar')    return this._buildStackedBarChart(canvasId, opts);
        if (opts.type === 'multiLine')     return this._buildMultiLineChart(canvasId, opts);

        const input = this.trimNulls(opts.input || []);
        if (!input.length && !opts.forceEmpty) return null;

        // 'area' type renders like 'line' but with fill
        const isArea = opts.type === 'area';
        const chartType = (opts.type === 'bar') ? 'bar' : 'line';

        const labels = opts.labels ? opts.labels.slice(0, input.length) : input.map((_, i) => i + 1);

        const datasets = [];

        // Normalize scalar → array (handles old localStorage data saved before the array fix)
        const toArr = v => v == null ? null : Array.isArray(v) ? v : [v];
        const redArr   = toArr(opts.red);
        const greenArr = toArr(opts.green);
        const aopArr   = toArr(opts.aop);

        if (redArr && redArr.some(v => v !== null)) {
            datasets.push({
                label: opts.redLabel || 'Target',
                data: this.fillToLength(this.trimNulls(redArr), labels.length),
                borderColor: '#ef4444', borderDash: [8, 4], borderWidth: 2.5,
                fill: false, pointRadius: 0, type: 'line', order: 2
            });
        }

        if (greenArr && greenArr.some(v => v !== null)) {
            datasets.push({
                label: opts.greenLabel || 'Green Zone',
                data: this.fillToLength(this.trimNulls(greenArr), labels.length),
                borderColor: '#22c55e', borderDash: [6, 3], borderWidth: 2.5,
                fill: false, pointRadius: 0, type: 'line', order: 2
            });
        }

        if (aopArr && aopArr.some(v => v !== null)) {
            datasets.push({
                label: opts.aopLabel || 'AOP Target',
                data: this.fillToLength(this.trimNulls(aopArr), labels.length),
                borderColor: '#f59e0b', borderDash: [6, 3], borderWidth: 2.5,
                fill: false, pointRadius: 0, type: 'line', order: 2
            });
        }

        if (opts.input2 && opts.input2.some(v => v !== null)) {
            const c2 = opts.input2Color || '#8b5cf6';
            datasets.push({
                label: opts.input2Label || 'Series 2',
                data: this.trimNulls(opts.input2).slice(0, labels.length),
                borderColor: c2,
                backgroundColor: opts.type === 'bar' ? c2 + '90' : c2 + '15',
                fill: opts.type !== 'bar',
                pointRadius: opts.type === 'bar' ? undefined : 2,
                borderWidth: 2,
                type: opts.type === 'bar' ? 'bar' : 'line',
                borderRadius: opts.type === 'bar' ? 2 : undefined,
                order: 1,
            });
        }

        const primaryColor = opts.color || '#3b82f6';
        const isBar = opts.type === 'bar';
        datasets.push({
            label: opts.inputLabel || 'Actual',
            data: input.slice(0, labels.length),
            borderColor: primaryColor,
            backgroundColor: isBar ? primaryColor + '90' : isArea ? primaryColor + '30' : primaryColor + '15',
            fill: isBar ? false : (isArea ? true : (opts.fill !== false ? (opts.fill ?? false) : false)),
            pointRadius: isBar ? undefined : 3,
            borderWidth: 2,
            type: isBar ? 'bar' : 'line',
            borderRadius: isBar ? 2 : undefined,
            order: 0,
        });

        const yConfig = { beginAtZero: opts.yMin === 0 || opts.yMin === undefined };
        if (opts.yMin !== undefined) yConfig.min = opts.yMin;
        if (opts.yMax !== undefined) yConfig.max = opts.yMax;
        if (opts.unit === '%') yConfig.ticks = { callback: v => (v * 100).toFixed(0) + '%' };
        else if (opts.unit === 'pct') yConfig.ticks = { callback: v => v.toFixed(0) + '%' };
        else if (opts.unit === 'k') yConfig.ticks = { callback: v => (v / 1000).toFixed(0) + 'k' };
        else if (opts.unit === 'M') yConfig.ticks = { callback: v => (v / 1000000).toFixed(2) + 'M' };
        else if (opts.unit === 'EUR') yConfig.ticks = { callback: v => (v / 1000).toFixed(0) + 'k€' };

        const chart = this.create(canvasId, {
            type: chartType,
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { font: { size: 10 } } },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                let v = ctx.parsed.y;
                                if (v === null || v === undefined) return ctx.dataset.label + ': N/A';
                                if (opts.unit === '%') return ctx.dataset.label + ': ' + (v * 100).toFixed(1) + '%';
                                if (opts.unit === 'pct') return ctx.dataset.label + ': ' + v.toFixed(1) + '%';
                                if (opts.unit === 'k') return ctx.dataset.label + ': ' + (v / 1000).toFixed(0) + 'k';
                                if (opts.unit === 'EUR') return ctx.dataset.label + ': ' + (v / 1000).toFixed(1) + 'k€';
                                return ctx.dataset.label + ': ' + v.toLocaleString();
                            }
                        }
                    }
                },
                scales: { y: yConfig }
            }
        });
        this.attachNoteBox(canvasId, opts.noteMetric || opts.inputLabel || 'Metric');
        this._checkTriggerAfterBuild(canvasId, opts);
        return chart;
    },

    // ── Specialty chart builders ─────────────────────────────────────────────

    _buildDonutChart(canvasId, opts) {
        const input  = this.trimNulls(opts.input || []);
        if (!input.length && !opts.forceEmpty) return null;
        const labels = opts.labels || input.map((_, i) => 'Slice ' + (i + 1));
        const PALETTE = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899'];
        const chart = this.create(canvasId, {
            type: 'doughnut',
            data: { labels, datasets: [{ data: input, backgroundColor: PALETTE.slice(0, input.length), borderWidth: 1, hoverOffset: 6 }] },
            options: { responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { font: { size: 10 } } } } }
        });
        this.attachNoteBox(canvasId, opts.inputLabel || 'Value');
        return chart;
    },

    _buildRadarChart(canvasId, opts) {
        const input  = this.trimNulls(opts.input || []);
        if (!input.length && !opts.forceEmpty) return null;
        const labels = opts.labels || input.map((_, i) => 'Cat ' + (i + 1));
        const color  = opts.color || '#3b82f6';
        const chart = this.create(canvasId, {
            type: 'radar',
            data: { labels, datasets: [{ label: opts.inputLabel || 'Score', data: input,
                borderColor: color, backgroundColor: color + '25', pointBackgroundColor: color, borderWidth: 2 }] },
            options: { responsive: true, maintainAspectRatio: false,
                scales: { r: { beginAtZero: true, ticks: { font: { size: 9 } } } },
                plugins: { legend: { position: 'top', labels: { font: { size: 10 } } } } }
        });
        this.attachNoteBox(canvasId, opts.inputLabel || 'Score');
        return chart;
    },

    _buildScatterChart(canvasId, opts) {
        const xArr = this.trimNulls(opts.input  || []);
        const yArr = this.trimNulls(opts.input2 || []);
        if (!xArr.length && !opts.forceEmpty) return null;
        const len  = Math.min(xArr.length, yArr.length);
        const data = Array.from({ length: len }, (_, i) => ({ x: xArr[i], y: yArr[i] }));
        const color = opts.color || '#3b82f6';
        const chart = this.create(canvasId, {
            type: 'scatter',
            data: { datasets: [{ label: opts.inputLabel || 'Data', data,
                backgroundColor: color + '90', borderColor: color, pointRadius: 5 }] },
            options: { responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'top', labels: { font: { size: 10 } } } },
                scales: { x: { title: { display: !!opts.inputLabel, text: opts.inputLabel || 'X' } },
                          y: { title: { display: !!opts.input2Label, text: opts.input2Label || 'Y' } } } }
        });
        this.attachNoteBox(canvasId, 'Scatter');
        return chart;
    },

    _buildHorizontalBarChart(canvasId, opts) {
        const input  = this.trimNulls(opts.input || []);
        if (!input.length && !opts.forceEmpty) return null;
        const labels = opts.labels || input.map((_, i) => 'Item ' + (i + 1));
        const color  = opts.color || '#3b82f6';
        const toArr  = v => v == null ? null : Array.isArray(v) ? v : [v];
        const redArr = toArr(opts.red);
        const datasets = [{ label: opts.inputLabel || 'Value', data: input,
            backgroundColor: color + '90', borderColor: color, borderWidth: 1, borderRadius: 2 }];
        if (redArr && redArr.some(v => v !== null)) {
            datasets.push({ label: opts.redLabel || 'Target', data: this.fillToLength(this.trimNulls(redArr), labels.length),
                type: 'line', borderColor: '#ef4444', borderDash: [8, 4], borderWidth: 2.5, pointRadius: 0 });
        }
        const chart = this.create(canvasId, {
            type: 'bar',
            data: { labels, datasets },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'top', labels: { font: { size: 10 } } } },
                scales: { x: { beginAtZero: true } } }
        });
        this.attachNoteBox(canvasId, opts.inputLabel || 'Value');
        this._checkTriggerAfterBuild(canvasId, opts);
        return chart;
    },

    _buildStackedBarChart(canvasId, opts) {
        const input  = this.trimNulls(opts.input  || []);
        const input2 = this.trimNulls(opts.input2 || []);
        if (!input.length && !opts.forceEmpty) return null;
        const labels = opts.labels || input.map((_, i) => i + 1);
        const c1 = opts.color        || '#3b82f6';
        const c2 = opts.input2Color  || '#8b5cf6';
        const chart = this.create(canvasId, {
            type: 'bar',
            data: { labels, datasets: [
                { label: opts.inputLabel  || 'Series 1', data: input,  backgroundColor: c1 + '90', borderColor: c1, borderWidth: 1, borderRadius: 2, stack: 'stack' },
                { label: opts.input2Label || 'Series 2', data: input2, backgroundColor: c2 + '90', borderColor: c2, borderWidth: 1, borderRadius: 2, stack: 'stack' },
            ]},
            options: { responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'top', labels: { font: { size: 10 } } } },
                scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } }
        });
        this.attachNoteBox(canvasId, opts.inputLabel || 'Value');
        this._checkTriggerAfterBuild(canvasId, opts);
        return chart;
    },

    _buildMultiLineChart(canvasId, opts) {
        const input  = this.trimNulls(opts.input  || []);
        if (!input.length && !opts.forceEmpty) return null;
        const len    = input.length;
        const labels = opts.labels ? opts.labels.slice(0, len) : input.map((_, i) => i + 1);
        const input2 = opts.input2 ? this.trimNulls(opts.input2).slice(0, len) : [];
        const input3 = opts.input3 ? this.trimNulls(opts.input3).slice(0, len) : [];
        const c1 = opts.color       || '#3b82f6';
        const c2 = opts.input2Color || '#22c55e';
        const c3 = opts.input3Color || '#f59e0b';
        const datasets = [
            { label: opts.inputLabel  || 'Series 1', data: input,  borderColor: c1, backgroundColor: c1 + '15', fill: false, borderWidth: 2, pointRadius: 2 },
            ...(input2.length ? [{ label: opts.input2Label || 'Series 2', data: input2, borderColor: c2, backgroundColor: c2 + '15', fill: false, borderWidth: 2, pointRadius: 2 }] : []),
            ...(input3.length ? [{ label: opts.input3Label || 'Series 3', data: input3, borderColor: c3, backgroundColor: c3 + '15', fill: false, borderWidth: 2, pointRadius: 2 }] : []),
        ];
        const chart = this.create(canvasId, {
            type: 'line',
            data: { labels, datasets },
            options: { responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'top', labels: { font: { size: 10 } } } },
                scales: { y: { beginAtZero: false } } }
        });
        this.attachNoteBox(canvasId, opts.inputLabel || 'Value');
        this._checkTriggerAfterBuild(canvasId, opts);
        return chart;
    },

    /**
     * Run trigger evaluation after any chart build.
     * Called by attachNoteBox (which all builders call) to avoid duplicating the call.
     */
    _checkTriggerAfterBuild(canvasId, opts) {
        if (!opts?.trigger) return;
        const data = opts.input || [];
        const redTarget = opts.red;
        const result = this.evaluateTrigger(data, opts.trigger, redTarget);
        if (result) this._applyTriggerVisuals(canvasId, result);
    },

    // Attach a persistent multi-note list below a chart card
    attachNoteBox(canvasId, metric) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const card = canvas.closest('.chart-card');
        if (!card || card.querySelector('.chart-note-wrap')) return;
        // Get chart title from header
        const chartHeaderEl = card.querySelector('.chart-header h3');
        const chartTitle = chartHeaderEl ? chartHeaderEl.textContent.trim() : metric;

        const NOTES_KEY = 'vpm-chart-notes';
        // Notes are stored per tier so each tier has its own note set
        const tier = (typeof VPMEscalation !== 'undefined') ? VPMEscalation.getCurrentTier() : 1;
        const tierCanvasId = canvasId + '_t' + tier;

        function loadNotes() {
            let all = {};
            try { all = JSON.parse(localStorage.getItem(NOTES_KEY) || '{}'); } catch (e) { all = {}; }
            // Migrate old single-object format { text, escalated } → array
            Object.keys(all).forEach(key => {
                if (all[key] && !Array.isArray(all[key])) {
                    const old = all[key];
                    all[key] = old.text ? [{ id: 'migrated', text: old.text, escalated: !!old.escalated }] : [];
                }
            });
            return all;
        }
        function saveNotes(all) {
            localStorage.setItem(NOTES_KEY, JSON.stringify(all));
        }
        function genId() {
            return 'n-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
        }

        const wrap = document.createElement('div');
        wrap.className = 'chart-note-wrap';

        // Input row
        const inputRow = document.createElement('div');
        inputRow.className = 'chart-note-input-row';

        const ta = document.createElement('textarea');
        ta.className = 'chart-note-input';
        ta.placeholder = 'Write a note for this chart...';
        ta.rows = 1;

        const addBtn = document.createElement('button');
        addBtn.className = 'chart-note-add-btn';
        addBtn.textContent = '+ Add';
        addBtn.title = 'Add note to list';

        inputRow.appendChild(ta);
        inputRow.appendChild(addBtn);

        // Notes list
        const list = document.createElement('div');
        list.className = 'chart-note-list';

        function renderList() {
            list.innerHTML = '';
            const all = loadNotes();
            const items = Array.isArray(all[tierCanvasId]) ? all[tierCanvasId] : [];
            items.forEach((note) => {
                const row = document.createElement('div');
                row.className = 'chart-note-item' + (note.escalated ? ' note-escalated' : '');

                const chk = document.createElement('input');
                chk.type = 'checkbox';
                chk.className = 'chart-note-check';
                chk.checked = !!note.escalated;
                chk.title = note.msgId ? 'Already escalated' : (note.escalated ? 'Escalated to Inbox' : 'Tick to escalate');
                if (note.msgId) chk.disabled = true;

                const textEl = document.createElement('span');
                textEl.className = 'chart-note-text';
                textEl.textContent = note.text;
                textEl.title = 'Click to edit';
                textEl.contentEditable = 'true';
                textEl.spellcheck = false;

                // Show live status from escalation system if linked
                let statusText = '\u2191 Send';
                let isSent = !!note.escalated;
                let statusKey = '';
                let linkedActionId = note.actionItemId || null;
                if (linkedActionId) {
                    statusKey = 'action';
                    if (typeof VPMActions !== 'undefined') {
                        const act = VPMActions.getById(linkedActionId);
                        if (act) {
                            const isOverdue = act.status !== 'done' && new Date(act.dueDate) < new Date();
                            const labels = { 'new':'Action: New', 'in-progress':'Action: In Progress', 'blocked':'Action: Blocked', 'done':'Action: Done' };
                            statusText = isOverdue ? 'Action: Overdue' : (labels[act.status] || 'Action');
                        } else {
                            statusText = 'Action';
                        }
                    } else {
                        statusText = 'Action';
                    }
                    isSent = true;
                } else if (isSent && note.msgId && typeof VPMEscalation !== 'undefined' && VPMEscalation.getMessageStatus) {
                    const info = VPMEscalation.getMessageStatus(note.msgId);
                    if (info) {
                        statusText = info.label;
                        statusKey = info.status;
                        if (info.actionItemId) linkedActionId = info.actionItemId;
                    } else {
                        statusText = 'Sent';
                        statusKey = 'sent';
                    }
                } else if (isSent) {
                    statusText = 'Sent';
                    statusKey = 'sent';
                }

                const sendBtn = document.createElement('button');
                sendBtn.className = 'chart-note-send-btn';
                sendBtn.textContent = statusText;
                sendBtn.title = statusKey === 'action' ? 'Click to view in Action Items' : 'Send to Escalation Inbox';
                if (isSent) {
                    sendBtn.disabled = statusKey !== 'action'; // action links are clickable
                    if (statusKey === 'pending') sendBtn.dataset.status = 'pending';
                    if (statusKey === 'action')  sendBtn.dataset.status = 'action';
                }

                const delBtn = document.createElement('button');
                delBtn.className = 'chart-note-del-btn';
                delBtn.textContent = '\u00d7';
                delBtn.title = 'Delete note';

                // Edit inline
                textEl.addEventListener('blur', () => {
                    const newText = textEl.textContent.trim();
                    if (!newText) { delNote(note.id); return; }
                    const a2 = loadNotes();
                    const it = (a2[tierCanvasId] || []).find(n => n.id === note.id);
                    if (it) { it.text = newText; saveNotes(a2); }
                });
                textEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') { e.preventDefault(); textEl.blur(); }
                });

                // Checkbox → escalate (only if not already sent)
                chk.addEventListener('change', () => {
                    const a2 = loadNotes();
                    const it = (a2[tierCanvasId] || []).find(n => n.id === note.id);
                    if (!it) return;
                    if (it.msgId) {
                        // Already escalated — prevent untick/retick from duplicating
                        chk.checked = true;
                        return;
                    }
                    it.escalated = chk.checked;
                    if (chk.checked && typeof VPMEscalation !== 'undefined') {
                        const msgId = VPMEscalation.addMessage(it.text, chartTitle, 'INFO');
                        if (msgId) it.msgId = msgId;
                    }
                    saveNotes(a2);
                    renderList();
                });

                // Send button — navigate if action, otherwise escalate
                sendBtn.addEventListener('click', () => {
                    if (linkedActionId && typeof VPMActions !== 'undefined') {
                        VPMActions.navigateTo(linkedActionId);
                        return;
                    }
                    let msgId;
                    if (typeof VPMEscalation !== 'undefined') {
                        msgId = VPMEscalation.addMessage(note.text, chartTitle, 'INFO');
                    }
                    const a2 = loadNotes();
                    const it = (a2[tierCanvasId] || []).find(n => n.id === note.id);
                    if (it) { it.escalated = true; if (msgId) it.msgId = msgId; saveNotes(a2); }
                    renderList();
                });

                // Assign Action button
                const assignBtn = document.createElement('button');
                assignBtn.className = 'chart-note-assign-btn';
                if (linkedActionId) {
                    assignBtn.textContent = 'View';
                    assignBtn.title = 'View in Action Items';
                    assignBtn.dataset.status = 'linked';
                    assignBtn.addEventListener('click', () => {
                        if (typeof VPMActions !== 'undefined') VPMActions.navigateTo(linkedActionId);
                    });
                } else {
                    assignBtn.textContent = 'Action';
                    assignBtn.title = 'Assign as Action Item';
                    assignBtn.addEventListener('click', () => {
                        // Toggle inline assign form
                        const existing = row.querySelector('.chart-note-assign-form');
                        if (existing) { existing.remove(); return; }

                        const people = (typeof VPMActions !== 'undefined') ? VPMActions.getPeople() : [];
                        const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
                        const form = document.createElement('div');
                        form.className = 'chart-note-assign-form';
                        form.innerHTML =
                            '<input type="text" class="cna-person" placeholder="Assign to..." list="cna-dl-' + note.id + '">' +
                            '<datalist id="cna-dl-' + note.id + '">' + people.map(p => '<option value="' + (typeof VPMActions !== 'undefined' ? VPMActions.escapeHtml(p) : p) + '">').join('') + '</datalist>' +
                            '<input type="date" class="cna-due" value="' + nextWeek.toISOString().split('T')[0] + '">' +
                            '<button class="cna-create">Create</button>';
                        row.appendChild(form);

                        form.querySelector('.cna-create').addEventListener('click', () => {
                            const person = form.querySelector('.cna-person').value.trim();
                            const due    = form.querySelector('.cna-due').value;
                            if (!person) return;

                            if (typeof VPMActions !== 'undefined') {
                                const tierLabel = (typeof VPMTierManager !== 'undefined')
                                    ? (VPMTierManager.getTierMeta(tier)?.label || 'T' + tier) : 'T' + tier;
                                const actionItem = VPMActions.add({
                                    title:           note.text.substring(0, 80),
                                    description:     note.text,
                                    assignedTo:      person,
                                    createdBy:       '',
                                    category:        chartTitle || 'General',
                                    status:          'new',
                                    priority:        'normal',
                                    dueDate:         due,
                                    sourceTier:      tier,
                                    sourceTierLabel: tierLabel,
                                    sourceMetric:    chartTitle || metric
                                });

                                // Link the note to the action via the escalation message
                                if (note.msgId && typeof VPMEscalation !== 'undefined') {
                                    const msgs = VPMEscalation.getMessages();
                                    const m = msgs.find(x => x.id === note.msgId);
                                    if (m) {
                                        m.boardType = 'action';
                                        m.actionItemId = actionItem.id;
                                    }
                                }
                                // Store actionItemId directly on the note
                                const a2 = loadNotes();
                                const it = (a2[tierCanvasId] || []).find(n => n.id === note.id);
                                if (it) { it.actionItemId = actionItem.id; saveNotes(a2); }

                                renderList();
                            }
                        });
                    });
                }

                // Delete
                delBtn.addEventListener('click', () => delNote(note.id));

                row.appendChild(chk);
                row.appendChild(textEl);
                row.appendChild(sendBtn);
                row.appendChild(assignBtn);
                row.appendChild(delBtn);
                list.appendChild(row);
            });
        }

        function delNote(id) {
            const all = loadNotes();
            if (Array.isArray(all[tierCanvasId])) {
                all[tierCanvasId] = all[tierCanvasId].filter(n => n.id !== id);
                saveNotes(all);
            }
            renderList();
        }

        // Auto-expand textarea
        ta.addEventListener('input', () => {
            ta.style.height = 'auto';
            ta.style.height = Math.min(ta.scrollHeight, 80) + 'px';
        });

        // Add new note
        function addNote() {
            const text = ta.value.trim();
            if (!text) { ta.focus(); ta.style.borderColor = 'var(--danger)'; setTimeout(() => { ta.style.borderColor = ''; }, 1500); return; }
            const all = loadNotes();
            if (!Array.isArray(all[tierCanvasId])) all[tierCanvasId] = [];
            all[tierCanvasId].push({ id: genId(), text, escalated: false });
            saveNotes(all);
            ta.value = '';
            ta.style.height = '';
            renderList();
        }

        addBtn.addEventListener('click', addNote);
        ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(); } });

        wrap.appendChild(inputRow);
        wrap.appendChild(list);
        card.appendChild(wrap);
        renderList();
    },

    buildSparkline(canvasId, data, color, target = null) {
        // Cap to today so Excel pre-filled future values don't stretch line to full width
        const now = new Date();
        const today        = now.getDate();                                               // 1–31
        const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); // 28–31

        const raw = (data || []).slice(0, today).map(v => (v === undefined ? null : v));
        const hasData = raw.some(v => v !== null);
        if (!hasData) return null;

        // Pad to full month so x-axis proportion = day / daysInMonth
        const padded = raw.slice();
        while (padded.length < daysInMonth) padded.push(null);

        const datasets = [{
            data: padded,
            borderColor: color,
            backgroundColor: color + '20',
            fill: true,
            pointRadius: 0,
            borderWidth: 1.5,
            spanGaps: false
        }];

        // Optional target line — dashed, spans full month
        if (target !== null && target !== undefined) {
            datasets.push({
                data: Array(daysInMonth).fill(target),
                borderColor: '#ef4444',
                backgroundColor: 'transparent',
                fill: false,
                pointRadius: 0,
                borderWidth: 2,
                borderDash: [6, 3],
                spanGaps: true
            });
        }

        return this.create(canvasId, {
            type: 'line',
            data: {
                labels: padded.map((_, i) => i + 1),
                datasets
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: { x: { display: false }, y: { display: false } },
                animation: { duration: 600 }
            }
        });
    },

    // ========================================
    // EDITABLE CALENDAR CROSS GRID
    // ========================================

    renderEditableCalendar(containerId, month, year, opts = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const storageKey = opts.storageKey || containerId;
        const saved = this.loadCalendarState(storageKey);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        const startOffset = (firstDay + 6) % 7;
        const today = new Date();
        const currentDay = (today.getFullYear() === year && today.getMonth() === month) ? today.getDate() : -1;

        const dayColors = {};
        if (opts.greenDays) opts.greenDays.forEach(d => { if (d >= 1 && d <= 31) dayColors[d] = 'green'; });
        if (opts.yellowDays) opts.yellowDays.forEach(d => { if (d >= 1 && d <= 31) dayColors[d] = 'yellow'; });
        if (opts.redDays) opts.redDays.forEach(d => { if (d >= 1 && d <= 31) dayColors[d] = 'red'; });
        if (!opts.noAutoGreen) {
            const upTo = currentDay > 0 ? currentDay - 1 : daysInMonth;
            for (let d = 1; d <= upTo; d++) { if (!dayColors[d]) dayColors[d] = 'green'; }
        }
        if (saved) Object.assign(dayColors, saved);

        const locked = container.dataset.locked !== 'false';
        const headers = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
        let html = `<div class="cal-toolbar">
            <button class="cal-lock-btn ${locked ? 'locked' : 'unlocked'}" data-container="${containerId}" title="${locked ? 'Click to edit' : 'Click to lock'}">
                ${locked ? '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="6" width="10" height="7" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="currentColor" stroke-width="1.2"/></svg>' :
                    '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="6" width="10" height="7" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M4.5 6V4.5a2.5 2.5 0 015 0" stroke="currentColor" stroke-width="1.2"/></svg>'}
                <span>${locked ? 'Locked' : 'Editing'}</span>
            </button>
        </div>`;
        html += '<div class="cal-grid">';
        html += headers.map(h => `<div class="cross-day-header">${h}</div>`).join('');
        for (let i = 0; i < startOffset; i++) html += '<div class="cross-day empty"></div>';
        for (let d = 1; d <= daysInMonth; d++) {
            const isFuture = currentDay > 0 && d > currentDay;
            const isToday = d === currentDay;
            const color = dayColors[d] || '';
            let cls = 'cross-day';
            if (color) cls += ' ' + color;
            if (isFuture && !color) cls += ' future';
            if (isToday) cls += ' today';
            if (!locked) cls += ' editable';
            html += `<div class="${cls}" data-day="${d}" data-container="${containerId}" data-storage="${storageKey}">${d}</div>`;
        }
        html += '</div>';
        html += `<div class="cal-legend">
            <span class="cal-legend-item"><span class="cal-dot green"></span>No Incident / No Trigger Met</span>
            <span class="cal-legend-item"><span class="cal-dot red"></span>OSHA / Trigger Reached</span>
            <span class="cal-legend-item"><span class="cal-dot blue"></span>Near miss / PSIF</span>
            <span class="cal-legend-item"><span class="cal-dot orange"></span>First Aid</span>
        </div>`;
        container.innerHTML = html;

        container.querySelector('.cal-lock-btn').addEventListener('click', () => {
            container.dataset.locked = container.dataset.locked !== 'false' ? 'false' : 'true';
            this.renderEditableCalendar(containerId, month, year, opts);
        });

        if (!locked) {
            container.querySelectorAll('.cross-day.editable').forEach(el => {
                el.addEventListener('click', () => {
                    const day = parseInt(el.dataset.day);
                    const colors = ['', 'green', 'red', 'blue', 'orange'];
                    const next = (colors.indexOf(dayColors[day] || '') + 1) % colors.length;
                    dayColors[day] = colors[next];
                    this.saveCalendarState(storageKey, dayColors);
                    this.renderEditableCalendar(containerId, month, year, opts);
                });
            });
        }
    },

    loadCalendarState(key) {
        try { const s = localStorage.getItem('vpm-cal-' + key); return s ? JSON.parse(s) : null; } catch { return null; }
    },

    saveCalendarState(key, state) {
        try {
            const clean = {};
            for (const [k, v] of Object.entries(state)) { if (v) clean[k] = v; }
            localStorage.setItem('vpm-cal-' + key, JSON.stringify(clean));
        } catch {}
    },

    // ========================================
    // GENERIC TABLE RENDERERS
    // ========================================

    renderTable(containerId, rows, columns, emptyMsg) {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (!rows || !rows.length) {
            container.innerHTML = `<p style="color:var(--text-muted);padding:12px;">${emptyMsg || 'No data'}</p>`;
            return;
        }
        let html = '<table class="data-table"><thead><tr>' + columns.map(c => `<th>${this.escapeHtml(c.label)}</th>`).join('') + '</tr></thead><tbody>';
        rows.forEach(row => {
            html += '<tr>' + columns.map(c => `<td>${this.escapeHtml(String(row[c.key] || ''))}</td>`).join('') + '</tr>';
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    },

    renderIncidentTable(containerId, incidents) {
        this.renderTable(containerId, incidents,
            [{label:'Date',key:'date'}, {label:'Description',key:'description'}, {label:'Responsible',key:'responsible'}],
            'No incidents logged');
    },

    renderProjectTable(containerId, projects) {
        this.renderTable(containerId, projects,
            [{label:'Project',key:'name'}, {label:'Status',key:'status'}, {label:'Owner',key:'owner'}, {label:'Due',key:'due'}],
            'No project data');
    },

    renderOverdueTable(containerId, rows) {
        this.renderTable(containerId, rows,
            [{label:'Department',key:'dept'}, {label:'Open Overdue',key:'openOverdue'}, {label:'Prev Week',key:'openOverduePrev'},
             {label:'Not Overdue',key:'openNotOverdue'}, {label:'Prev Week',key:'openNotOverduePrev'}],
            'No overdue data');
    },

    // ========================================
    // OVERVIEW TAB
    // ========================================

    // ========================================
    // CONSECUTIVE-DAYS TRIGGER EVALUATION
    // ========================================

    /**
     * Evaluate whether a chart's data triggers a consecutive-days breach.
     * @param {number[]} data   - The main data series (opts.input)
     * @param {object}   trigger - { dir:'below'|'above', days:3, value:null }
     * @param {*}        redTarget - opts.red (scalar or array) — fallback threshold
     * @returns {object|null}  { triggered, count, required, threshold, dir }
     */
    evaluateTrigger(data, trigger, redTarget) {
        if (!trigger || !data?.length) return null;
        const threshold = trigger.value ??
            (Array.isArray(redTarget) ? redTarget.find(v => v != null) : redTarget);
        if (threshold == null) return null;

        const n = trigger.days || 3;
        const isBelow = trigger.dir !== 'above';

        // Count consecutive breaches from the END of data
        let count = 0;
        for (let i = data.length - 1; i >= 0; i--) {
            if (data[i] == null) continue;
            if (isBelow ? data[i] < threshold : data[i] > threshold) count++;
            else break;
        }

        return {
            triggered: count >= n,
            count,
            required: n,
            threshold,
            dir: trigger.dir || 'below'
        };
    },

    /**
     * Apply trigger result visuals to a chart card.
     * Injects a full-width status bar at the top of the card.
     */
    _applyTriggerVisuals(canvasId, result) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const card = canvas.closest('.chart-card');
        if (!card) return;

        // Store result for KPI badge reading
        canvas.dataset.triggerResult = JSON.stringify(result);

        // Toggle card classes
        card.classList.toggle('trigger-active', result.triggered);
        card.classList.toggle('trigger-ok', !result.triggered);

        // Find or create the full-width status bar
        let bar = card.querySelector('.trigger-status-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.className = 'trigger-status-bar';
            card.prepend(bar);
        }

        if (result.triggered) {
            bar.className = 'trigger-status-bar trigger-bar-red';
            bar.textContent = result.count + '/' + result.required + ' TRIGGERED';
        } else {
            bar.className = 'trigger-status-bar trigger-bar-green';
            bar.textContent = result.count + '/' + result.required + ' OK';
        }
    },

    // Badge helper: show OK/ALERT based on last vs target, hide if no target.
    // dir='asc'  → higher is better (service level, FPY) → ALERT when last < target
    // dir='desc' → lower  is better (sick leave, IDL)    → ALERT when last > target
    _kpiBadge(el, last, target, dir) {
        if (!el) return;
        if (target == null || last == null) { el.style.visibility = 'hidden'; return; }
        el.style.visibility = '';
        const ok = dir === 'asc' ? last >= target : last <= target;
        el.textContent = ok ? 'OK' : 'ALERT';
        el.className   = 'kpi-badge ' + (ok ? 'badge-green' : 'badge-red');
    },

    renderOverview(data) {
        if (!data) return;

        // KPI card values + sparklines are now handled entirely by
        // VPMLayout.applyKpiMetricSelections() — which reads dynamically
        // from whichever chart the user selected in the Configure panel.
        // No hardcoded KPI defaults here.

        const s  = data.safety;
        const p  = data.people;
        const pr = data.production;
        const sc = data.supplychain;

        // Overview charts
        if (pr && pr.ccVolume && pr.ccVolume.actual.length) {
            this.buildMetricChart('overview-production-chart', {
                labels: pr.ccVolume.dates,
                input: pr.ccVolume.actual, inputLabel: 'CC Daily Output',
                input2: pr.ostVolume ? pr.ostVolume.actual : [], input2Label: 'OST Daily Output', input2Color: '#22c55e',
                type: 'bar', unit: 'k', color: '#3b82f6'
            });
        }

        if (s && s.observations) {
            this.buildMetricChart('overview-safety-chart', {
                input: this.trimNulls(s.observations.cumulative),
                inputLabel: 'Observations (Cumulative)',
                red: this.trimNulls(s.observations.red), redLabel: 'Target',
                type: 'bar', color: '#3b82f6'
            });
        }

        if (pr && pr.idlOst && pr.idlCC) {
            const ostDly = this.trimNulls(pr.idlOst.daily || []).map(v => v ? v * 100 : null);
            const ccDly = this.trimNulls(pr.idlCC.daily || []).map(v => v ? v * 100 : null);
            this.buildMetricChart('overview-cost-chart', {
                input: ostDly, inputLabel: 'Assembly IDL %',
                input2: ccDly, input2Label: 'CC IDL %', input2Color: '#22c55e',
                type: 'bar', unit: 'pct'
            });
        }

        if (p && p.sickLeave) {
            this.buildMetricChart('overview-people-chart', {
                input: this.trimNulls(p.sickLeave.actual),
                inputLabel: 'Sick Leave',
                red: this.trimNulls(p.sickLeave.target), redLabel: 'Target Max',
                color: '#8b5cf6'
            });
        }
    },

    // ========================================
    // SAFETY TAB
    // ========================================

    renderSafetyTab(data, month, year) {
        if (!data || !data.safety) return;
        const s = data.safety;

        // OSHA counters
        const days = s.oshaDays || 0;
        const el = document.getElementById('safety-osha-days');
        if (el) el.textContent = days;
        const startEl = document.getElementById('safety-osha-start');
        if (startEl) startEl.textContent = 'Since: ' + (s.oshaStart || '--');
        const milEl = document.getElementById('safety-milestone');
        if (milEl) milEl.textContent = s.milestone || 180;
        const prevEl = document.getElementById('safety-prev-best');
        if (prevEl) prevEl.textContent = s.prevBest || 567;
        const faEl = document.getElementById('safety-fa-milestone');
        if (faEl) faEl.textContent = s.firstAidCount || '--';
        const faPEl = document.getElementById('safety-fa-best');
        if (faPEl) faPEl.textContent = s.oshaRecordableCount || '--';

        // Calendars
        this.renderEditableCalendar('safetyCrossGrid', month, year, { storageKey: 'safety-cross', noAutoGreen: false });
        this.renderEditableCalendar('envCrossGrid', month, year, { storageKey: 'env-cross', noAutoGreen: false });

        // Observations cumulative
        const obs = s.observations || {};
        this.buildMetricChart('safety-observations-chart', {
            labels: obs.dayLabels,
            input: this.trimNulls(obs.cumulative), inputLabel: 'Cumulative Observations',
            red: this.trimNulls(obs.red), redLabel: 'Target',
            color: '#3b82f6'
        });

        // Daily by area (Assembly vs CC)
        const obsOst = this.trimNulls(obs.assembly || []);
        const obsCC = this.trimNulls(obs.cc || []);
        if (obsOst.length || obsCC.length) {
            this.buildMetricChart('safety-nearmiss-chart', {
                labels: obs.dayLabels,
                input: obsOst, inputLabel: 'Assembly',
                input2: obsCC, input2Label: 'CC', input2Color: '#06b6d4',
                type: 'bar', color: '#f59e0b'
            });
        }

        // Overdue actions bar chart
        if (s.overdueTable && s.overdueTable.length) {
            const depts = s.overdueTable.map(r => (r.dept || '').substring(0, 12));
            const overdueVals = s.overdueTable.map(r => r.openOverdue || 0);
            const notOverdueVals = s.overdueTable.map(r => r.openNotOverdue || 0);
            this.buildMetricChart('safety-overdue-chart', {
                labels: depts,
                input: overdueVals, inputLabel: 'Open Overdue',
                input2: notOverdueVals, input2Label: 'Open (Not Overdue)', input2Color: '#22c55e',
                type: 'bar', color: '#ef4444'
            });
            this.renderOverdueTable('safety-overdue-table', s.overdueTable);
        }

        // Obs without action plan
        if (s.obsWithoutActionPlan && s.obsWithoutActionPlan.length) {
            const depts2 = s.obsWithoutActionPlan.map(r => (r.dept || '').substring(0, 12));
            const obs7d = s.obsWithoutActionPlan.map(r => r.over7dCurrent || 0);
            this.buildMetricChart('safety-obs-noplan-chart', {
                labels: depts2,
                input: obs7d, inputLabel: 'Obs >7d Without Action Plan',
                type: 'bar', color: '#f59e0b'
            });
        }

        // Incident log
        this.renderIncidentTable('safety-incident-log', s.incidents);
    },

    // ========================================
    // PEOPLE TAB
    // ========================================

    renderPeopleTab(data, month, year) {
        if (!data || !data.people) return;
        const p = data.people;

        this.renderEditableCalendar('peopleCrossGrid', month, year, { storageKey: 'people-cross' });

        const labels = p.dayLabels || p.sickLeave.actual.map((_, i) => i + 1);

        // Sick leave
        this.buildMetricChart('people-sickleave-chart', {
            labels,
            input: this.trimNulls(p.sickLeave.actual), inputLabel: 'Sick Leave (Hourly)',
            red: this.trimNulls(p.sickLeave.target), redLabel: 'Target Max',
            color: '#8b5cf6', yMin: 0
        });

        // Turnover salaried
        this.buildMetricChart('people-turnover-sal-chart', {
            labels,
            input: this.trimNulls(p.turnoverSalaried.actual), inputLabel: 'Salaried Turnover',
            red: this.trimNulls(p.turnoverSalaried.target), redLabel: 'Target Max',
            type: 'bar', color: '#3b82f6', yMin: 0
        });

        // Turnover hourly
        this.buildMetricChart('people-turnover-hr-chart', {
            labels,
            input: this.trimNulls(p.turnoverHourly.actual), inputLabel: 'Hourly Turnover',
            red: this.trimNulls(p.turnoverHourly.target), redLabel: 'Target Max',
            type: 'bar', color: '#f59e0b', yMin: 0
        });

        // Headcount
        const hc = p.headcount;
        if (hc && hc.actual && hc.actual.some(v => v !== null)) {
            this.buildMetricChart('people-headcount-chart', {
                labels,
                input: this.trimNulls(hc.actual), inputLabel: 'Operator Headcount',
                red: this.trimNulls(hc.red), redLabel: 'Min Target',
                green: this.trimNulls(hc.green), greenLabel: 'Target',
                color: '#06b6d4'
            });
        }

        // Open positions salaried
        const opSal = p.openPositionsSalaried;
        if (opSal && opSal.actual && opSal.actual.some(v => v !== null)) {
            this.buildMetricChart('people-open-sal-chart', {
                input: this.trimNulls(opSal.actual), inputLabel: 'Open Salaried Positions',
                red: this.trimNulls(opSal.red), redLabel: 'Trigger',
                input2: this.trimNulls(opSal.late || []), input2Label: 'Late', input2Color: '#ef4444',
                type: 'bar', color: '#3b82f6', yMin: 0
            });
        }

        // Open positions hourly
        const opHr = p.openPositionsHourly;
        if (opHr && opHr.actual && opHr.actual.some(v => v !== null)) {
            this.buildMetricChart('people-open-hr-chart', {
                input: this.trimNulls(opHr.actual), inputLabel: 'Open Hourly Positions',
                red: this.trimNulls(opHr.red), redLabel: 'Trigger',
                input2: this.trimNulls(opHr.late || []), input2Label: 'Late', input2Color: '#ef4444',
                type: 'bar', color: '#22c55e', yMin: 0
            });
        }

        // LMS Training
        const lms = p.lmsTraining;
        if (lms && lms.actual && lms.actual.some(v => v !== null)) {
            this.buildMetricChart('people-lms-chart', {
                labels: lms.weekLabels,
                input: this.trimNulls(lms.actual), inputLabel: 'Late LMS Training',
                red: this.trimNulls(lms.red), redLabel: 'Trigger',
                green: this.trimNulls(lms.green), greenLabel: 'Green',
                type: 'bar', color: '#3b82f6', yMin: 0
            });
        }
    },

    // ========================================
    // QUALITY TAB
    // ========================================

    renderQualityTab(data, month, year) {
        if (!data || !data.quality) return;
        const q = data.quality;

        this.renderEditableCalendar('qualityCrossGrid', month, year, { storageKey: 'quality-cross' });

        // FPY CAM3
        this.buildMetricChart('quality-fpy-chart', {
            labels: q.fpyCam3.dayLabels,
            input: this.trimNulls(q.fpyCam3.actual), inputLabel: 'FPY CAM3',
            red: this.trimNulls(q.fpyCam3.red), redLabel: 'Target (75%)',
            green: this.trimNulls(q.fpyCam3.green), greenLabel: 'Lower Bound',
            unit: '%', color: '#3b82f6', yMin: 0, yMax: 1
        });

        // NCMR Assembly
        this.buildMetricChart('quality-ncmr-ost-chart', {
            labels: q.ncmrAssembly.dayLabels,
            input: this.trimNulls(q.ncmrAssembly.actual), inputLabel: 'NCMR Assembly',
            red: this.trimNulls(q.ncmrAssembly.redTrigger), redLabel: 'Trigger (3)',
            type: 'bar', color: '#ef4444', yMin: 0
        });

        // NCMR CC
        this.buildMetricChart('quality-ncmr-cc-chart', {
            labels: q.ncmrCC.dayLabels,
            input: this.trimNulls(q.ncmrCC.actual), inputLabel: 'NCMR Packaging',
            red: this.trimNulls(q.ncmrCC.redTrigger), redLabel: 'Trigger (3)',
            type: 'bar', color: '#f59e0b', yMin: 0
        });

        // Complaints Assembly
        const comp = q.complaintsAssembly;
        if (comp && comp.familyA && comp.familyA.some(v => v !== null)) {
            this.buildMetricChart('quality-complaints-chart', {
                labels: comp.monthLabels,
                input: this.trimNulls(comp.familyA), inputLabel: 'Product Family A',
                input2: this.trimNulls(comp.familyB), input2Label: 'Product Family B', input2Color: '#8b5cf6',
                red: this.trimNulls(comp.red), redLabel: 'Trigger',
                green: this.trimNulls(comp.green), greenLabel: 'Target',
                type: 'bar', color: '#3b82f6', yMin: 0
            });
        }

        // HOLDs Assembly Count
        const holdsOst = q.holdsAssemblyCount;
        if (holdsOst && holdsOst.holdInKA && holdsOst.holdInKA.some(v => v !== null)) {
            this.buildMetricChart('quality-holds-ost-chart', {
                labels: holdsOst.monthLabels,
                input: this.trimNulls(holdsOst.holdInKA), inputLabel: 'Hold KA',
                input2: this.trimNulls(holdsOst.holdInDC), input2Label: 'Hold DC', input2Color: '#f59e0b',
                red: this.trimNulls(holdsOst.red), redLabel: 'Trigger',
                type: 'bar', color: '#ef4444', yMin: 0
            });
        }

        // HOLDs Assembly EUR
        const holdsOstEur = q.holdsAssemblyEUR;
        if (holdsOstEur && holdsOstEur.eurKA && holdsOstEur.eurKA.some(v => v !== null)) {
            this.buildMetricChart('quality-holds-ost-eur-chart', {
                labels: holdsOstEur.monthLabels || holdsOst.monthLabels,
                input: this.trimNulls(holdsOstEur.eurKA), inputLabel: 'EUR KA',
                input2: this.trimNulls(holdsOstEur.eurDC), input2Label: 'EUR DC', input2Color: '#f59e0b',
                type: 'bar', color: '#ef4444', unit: 'EUR'
            });
        }

        // HOLDs CC Count
        const holdsCC = q.holdsCCCount;
        if (holdsCC && holdsCC.holdInKA && holdsCC.holdInKA.some(v => v !== null)) {
            this.buildMetricChart('quality-holds-cc-chart', {
                labels: holdsCC.monthLabels,
                input: this.trimNulls(holdsCC.holdInKA), inputLabel: 'Hold KA (CC)',
                input2: this.trimNulls(holdsCC.holdInDC), input2Label: 'Hold DC (CC)', input2Color: '#f59e0b',
                red: this.trimNulls(holdsCC.red), redLabel: 'Trigger',
                type: 'bar', color: '#8b5cf6', yMin: 0
            });
        }
    },

    // ========================================
    // PRODUCTION TAB
    // ========================================

    renderProductionTab(data, month, year) {
        if (!data || !data.production) return;
        const p = data.production;

        this.renderEditableCalendar('prodCCCrossGrid', month, year, { storageKey: 'prod-cc-cross' });
        this.renderEditableCalendar('prodOSTCrossGrid', month, year, { storageKey: 'prod-ost-cross' });

        // CC Volume daily
        if (p.ccVolume && p.ccVolume.actual.length) {
            this.buildMetricChart('prod-cc-daily-chart', {
                labels: p.ccVolume.dates,
                input: this.trimNulls(p.ccVolume.actual), inputLabel: 'CC Daily Output',
                red: this.trimNulls(p.ccVolume.plan), redLabel: 'Supply Plan',
                type: 'bar', unit: 'k', color: '#3b82f6'
            });
            // CC Volume cumulative
            const ccCum = this.toCumulative(p.ccVolume.actual);
            const ccPlanCum = this.toCumulative(p.ccVolume.plan);
            this.buildMetricChart('prod-cc-volume-chart', {
                labels: p.ccVolume.dates,
                input: ccCum, inputLabel: 'CC MTD Actual',
                red: ccPlanCum, redLabel: 'MTD Plan',
                unit: 'k', color: '#3b82f6'
            });
        }

        // OST Volume daily
        if (p.ostVolume && p.ostVolume.actual.length) {
            this.buildMetricChart('prod-ost-daily-chart', {
                labels: p.ostVolume.dates,
                input: this.trimNulls(p.ostVolume.actual), inputLabel: 'OST Daily Output',
                red: this.trimNulls(p.ostVolume.plan || []), redLabel: 'Supply Plan',
                type: 'bar', unit: 'k', color: '#22c55e'
            });
            const ostCum = this.toCumulative(p.ostVolume.actual);
            const ostPlanCum = this.toCumulative(p.ostVolume.plan || []);
            this.buildMetricChart('prod-ost-volume-chart', {
                labels: p.ostVolume.dates,
                input: ostCum, inputLabel: 'OST MTD Actual',
                red: ostPlanCum, redLabel: 'MTD Plan',
                unit: 'k', color: '#22c55e'
            });
        }

        // OEE selector
        this.renderOEESelector(data);

        // IDL Assembly
        if (p.idlOst) {
            const daily = this.trimNulls(p.idlOst.daily || []).map(v => v !== null ? v * 100 : null);
            const mtd = this.trimNulls(p.idlOst.mtd || []).map(v => v !== null ? v * 100 : null);
            const target = (p.idlOst.target || 0.199) * 100;
            this.buildMetricChart('prod-idl-ost-chart', {
                labels: p.idlOst.dates,
                input: daily, inputLabel: 'OST IDL % Daily',
                input2: mtd, input2Label: 'MTD', input2Color: '#f59e0b',
                red: daily.map(() => target), redLabel: 'Target',
                unit: 'pct', color: '#3b82f6'
            });
        }

        // IDL CC
        if (p.idlCC) {
            const daily = this.trimNulls(p.idlCC.daily || []).map(v => v !== null ? v * 100 : null);
            const mtd = this.trimNulls(p.idlCC.mtd || []).map(v => v !== null ? v * 100 : null);
            const target = (p.idlCC.target || 0.178) * 100;
            this.buildMetricChart('prod-idl-cc-chart', {
                labels: p.idlCC.dates,
                input: daily, inputLabel: 'CC IDL % Daily',
                input2: mtd, input2Label: 'MTD', input2Color: '#f59e0b',
                red: daily.map(() => target), redLabel: 'Target',
                unit: 'pct', color: '#22c55e'
            });
        }
    },

    renderOEESelector(data) {
        const select = document.getElementById('oeeSelect');
        const p = data.production;
        if (!select || !p.oee || Object.keys(p.oee).length === 0) return;
        const machines = Object.keys(p.oee);

        if (select.options.length <= 1) {
            machines.forEach((name, i) => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                select.appendChild(opt);
            });
            select.value = machines[0];
            select.addEventListener('change', () => this.renderOEEChart(data));
        }
        this.renderOEEChart(data);
    },

    renderOEEChart(data) {
        const select = document.getElementById('oeeSelect');
        const name = select ? select.value : null;
        if (!name || !data.production.oee[name]) return;
        const m = data.production.oee[name];

        const actual = this.trimNulls(m.actual || []).map(v => v !== null ? v * 100 : null);
        const target = m.target ? m.target * 100 : null;
        const redLine = actual.map(() => target || 60);
        const greenLine = actual.map(() => (target ? target - 5 : 55));

        this.buildMetricChart('prod-oee-chart', {
            labels: m.dates,
            input: actual, inputLabel: name + ' OEE %',
            red: redLine, redLabel: 'Target (' + (target || 60).toFixed(0) + '%)',
            type: 'bar', unit: 'pct', color: '#3b82f6', yMin: 0, yMax: 100
        });
    },

    // ========================================
    // SUPPLY CHAIN TAB
    // ========================================

    renderSupplyChainTab(data, month, year) {
        if (!data || !data.supplychain) return;
        const sc = data.supplychain;

        this.renderEditableCalendar('scCCCrossGrid', month, year, { storageKey: 'sc-cc-cross' });
        this.renderEditableCalendar('scOSTCrossGrid', month, year, { storageKey: 'sc-ost-cross' });

        // Service Rate JP
        if (sc.serviceRateJP && sc.serviceRateJP.actual && sc.serviceRateJP.actual.some(v => v !== null)) {
            const jp = this.trimNulls(sc.serviceRateJP.actual).map(v => v !== null ? v * 100 : null);
            this.buildMetricChart('sc-service-jp-chart', {
                input: jp, inputLabel: 'Service Rate JP %',
                red: jp.map(() => (sc.serviceRateJP.target || 0.998) * 100), redLabel: 'Target',
                unit: 'pct', color: '#3b82f6', yMin: 90, yMax: 101
            });
        }

        // Service Rate ROW
        if (sc.serviceRateROW && sc.serviceRateROW.actual && sc.serviceRateROW.actual.some(v => v !== null)) {
            const row = this.trimNulls(sc.serviceRateROW.actual).map(v => v !== null ? v * 100 : null);
            this.buildMetricChart('sc-service-row-chart', {
                input: row, inputLabel: 'Service Rate ROW %',
                red: row.map(() => (sc.serviceRateROW.target || 0.95) * 100), redLabel: 'Target (95%)',
                unit: 'pct', color: '#22c55e', yMin: 80, yMax: 101
            });
        }

        // DIOH
        if (sc.dioh && sc.dioh.actual && sc.dioh.actual.some(v => v !== null)) {
            this.buildMetricChart('sc-dioh-chart', {
                input: this.trimNulls(sc.dioh.actual), inputLabel: 'DIOH',
                red: this.trimNulls(sc.dioh.red), redLabel: 'Max',
                green: this.trimNulls(sc.dioh.green), greenLabel: 'Min',
                type: 'bar', color: '#3b82f6'
            });
        }

        // Back orders
        if (sc.backOrdersOst && sc.backOrdersOst.length) {
            const container = document.getElementById('bo-table-container');
            if (container) {
                let html = '<table class="data-table"><thead><tr><th>Reason</th><th>Qty</th></tr></thead><tbody>';
                sc.backOrdersOst.forEach(r => {
                    html += `<tr><td>${this.escapeHtml(r.reason)}</td><td>${r.qty || 0}</td></tr>`;
                });
                html += '</tbody></table>';
                container.innerHTML = html;
            }
        }
    },

    // ========================================
    // COST TAB
    // ========================================

    renderCostTab(data) {
        if (!data) return;
        const c = data.cost;
        const p = data.production;

        // IDL from Production
        if (p && p.idlOst) {
            const daily = this.trimNulls(p.idlOst.daily || []).map(v => v !== null ? v * 100 : null);
            const mtd = this.trimNulls(p.idlOst.mtd || []).map(v => v !== null ? v * 100 : null);
            const target = (p.idlOst.target || 0.199) * 100;
            this.buildMetricChart('cost-idl-ost-chart', {
                labels: p.idlOst.dates,
                input: mtd, inputLabel: 'OST IDL % MTD',
                input2: daily, input2Label: 'Daily', input2Color: '#94a3b8',
                red: daily.map(() => target), redLabel: 'Target',
                unit: 'pct', color: '#3b82f6'
            });
        }

        if (p && p.idlCC) {
            const daily = this.trimNulls(p.idlCC.daily || []).map(v => v !== null ? v * 100 : null);
            const mtd = this.trimNulls(p.idlCC.mtd || []).map(v => v !== null ? v * 100 : null);
            const target = (p.idlCC.target || 0.178) * 100;
            this.buildMetricChart('cost-idl-cc-chart', {
                labels: p.idlCC.dates,
                input: mtd, inputLabel: 'CC IDL % MTD',
                input2: daily, input2Label: 'Daily', input2Color: '#94a3b8',
                red: daily.map(() => target), redLabel: 'Target',
                unit: 'pct', color: '#22c55e'
            });
        }

        if (!c) return;
        const labels = c.dayLabels;

        // Efficiency Assembly
        if (c.efficiencyAssembly && c.efficiencyAssembly.actual.some(v => v !== null)) {
            this.buildMetricChart('cost-eff-ost-chart', {
                labels,
                input: this.trimNulls(c.efficiencyAssembly.actual), inputLabel: 'Efficiency OST (EUR)',
                red: this.trimNulls(c.efficiencyAssembly.trigger), redLabel: 'Trigger (<6k€)',
                green: this.trimNulls(c.efficiencyAssembly.green), greenLabel: 'Green',
                type: 'bar', color: '#3b82f6', unit: 'EUR'
            });
        }

        // Efficiency CC
        if (c.efficiencyCC && c.efficiencyCC.actual.some(v => v !== null)) {
            this.buildMetricChart('cost-eff-cc-chart', {
                labels,
                input: this.trimNulls(c.efficiencyCC.actual), inputLabel: 'Efficiency CC (EUR)',
                red: this.trimNulls(c.efficiencyCC.trigger), redLabel: 'Trigger (<1k€)',
                green: this.trimNulls(c.efficiencyCC.green), greenLabel: 'Green',
                type: 'bar', color: '#06b6d4', unit: 'EUR'
            });
        }

        // Waste Assembly
        if (c.wasteAssembly && c.wasteAssembly.actual.some(v => v !== null)) {
            this.buildMetricChart('cost-waste-ost-chart', {
                labels,
                input: this.trimNulls(c.wasteAssembly.actual), inputLabel: 'Waste OST (EUR)',
                red: this.trimNulls(c.wasteAssembly.trigger), redLabel: 'Trigger (<2k€)',
                type: 'bar', color: '#ef4444', unit: 'EUR'
            });
        }

        // Waste CC
        if (c.wasteCC && c.wasteCC.actual.some(v => v !== null)) {
            this.buildMetricChart('cost-waste-cc-chart', {
                labels,
                input: this.trimNulls(c.wasteCC.actual), inputLabel: 'Waste CC (EUR)',
                red: this.trimNulls(c.wasteCC.trigger), redLabel: 'Trigger (<0€)',
                type: 'bar', color: '#f97316', unit: 'EUR'
            });
        }

        // EUR Variances
        if (c.eurVariances && c.eurVariances.actual.some(v => v !== null)) {
            this.buildMetricChart('cost-eur-variances-chart', {
                labels,
                input: this.trimNulls(c.eurVariances.actual), inputLabel: 'EUR Variances',
                red: this.trimNulls(c.eurVariances.red), redLabel: 'Max',
                green: this.trimNulls(c.eurVariances.green), greenLabel: 'Min',
                type: 'bar', color: '#8b5cf6', unit: 'EUR'
            });
        }
    },

    // ========================================
    // MAINTENANCE TAB
    // ========================================

    renderMaintenanceTab(data) {
        if (!data || !data.maintenance) return;
        const avail = data.maintenance.availability;
        if (!avail) return;

        const machines = Object.entries(avail);
        machines.forEach(([name, m], i) => {
            const canvasId = 'maint-machine-' + i;
            if (!document.getElementById(canvasId)) return;
            const actual = this.trimNulls(m.actual || []);
            if (!actual.length) return;
            // Find red threshold
            const redVal = this.trimNulls(m.red || []);
            const redConst = redVal.length ? redVal[0] : 80;
            const greenConst = this.trimNulls(m.green || [])[0] || 40;

            this.buildMetricChart(canvasId, {
                labels: m.weekLabels && m.weekLabels.length ? m.weekLabels.slice(0, actual.length) : actual.map((_, i) => 'W' + (i + 1)),
                input: actual, inputLabel: name + ' Availability %',
                red: actual.map(() => redConst), redLabel: 'Target (' + redConst + '%)',
                green: actual.map(() => greenConst), greenLabel: 'Min (' + greenConst + '%)',
                type: 'bar', color: '#3b82f6', yMin: 0, yMax: 105
            });

            // Update canvas title
            const header = document.getElementById('maint-title-' + i);
            if (header) header.textContent = name + ' - Availability %';
        });
    },

    // ========================================
    // ENGINEERING TAB
    // ========================================

    renderEngineeringTab(data) {
        if (!data || !data.engineering) return;
        const eng = data.engineering;
        this.renderProjectTable('eng-projects-table', eng.projects);

        // Issues table
        if (eng.issues && eng.issues.length) {
            this.renderTable('eng-issues-table', eng.issues,
                [{label:'Description', key:'description'}, {label:'Status', key:'status'}, {label:'Owner', key:'owner'}],
                'No issues');
        }
    },

    // ========================================
    // CI TAB
    // ========================================

    renderCITab(data) {
        if (!data || !data.ci) return;
        const ci = data.ci;

        if (ci.actions3C && ci.actions3C.length) {
            this.renderTable('ci-3c-table', ci.actions3C,
                [{label:'ID',key:'id'},{label:'Description',key:'description'},{label:'Status',key:'status'},{label:'Owner',key:'owner'},{label:'Due',key:'due'}],
                'No 3C actions');
        }

        if (ci.ideas && ci.ideas.length) {
            this.renderTable('ci-ideas-table', ci.ideas,
                [{label:'Description',key:'description'},{label:'Status',key:'status'},{label:'Submitter',key:'submitter'}],
                'No ideas');
        }

        if (ci.recognitions && ci.recognitions.length) {
            this.renderTable('ci-recognitions-table', ci.recognitions,
                [{label:'Name',key:'name'},{label:'Reason',key:'reason'},{label:'Date',key:'date'}],
                'No recognitions');
        }
    }
};