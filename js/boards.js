/**
 * VPMBoards — User-created custom boards in the sidebar.
 * Each board has a name, a type, and type-specific content stored in localStorage.
 *
 * Board types: chart-grid | news-feed | web-entry | exec-summary
 */
const VPMBoards = (function () {
    'use strict';

    const STORAGE_KEY    = 'vpm-boards-v1';
    const CONTENT_PREFIX = 'vpm-board-content-';

    let _boards         = [];
    let _currentBoardId = null;

    // ── Icons ─────────────────────────────────────────────────────────────────

    const ICONS = {
        'chart-grid':   `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="7" width="4" height="8" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="6" y="4" width="4" height="11" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="11" y="1" width="4" height="14" rx="1" stroke="currentColor" stroke-width="1.4"/></svg>`,
        'news-feed':    `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M5 6h6M5 9h6M5 12h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
        'web-entry':    `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M5 8h2M9 8h2M5 11h6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M5 5h1.5v1.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
        'exec-summary': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4"/><path d="M8 5v3l2 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
        'tier':         `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2l1.8 3.6L14 6.4l-3 2.9.7 4.1L8 11.4l-3.7 2L5 9.3 2 6.4l4.2-.8z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`,
    };

    const BOARD_TYPES = {
        'chart-grid':   { label: 'Chart Grid',        desc: 'Drag-and-drop custom charts from any stream' },
        'news-feed':    { label: 'News / Updates',     desc: 'Team announcements, shift notes, updates' },
        'web-entry':    { label: 'Data Entry',         desc: 'Enter KPI values directly in the browser' },
        'exec-summary': { label: 'Executive Summary',  desc: 'Auto-generated KPI snapshot for leadership' },
        'tier':         { label: 'Tier Board',         desc: 'Full VPM dashboard — inherits all T1/T2/T3 features' },
    };

    // Accent colours cycled for custom tiers
    const TIER_ACCENT_CYCLE = ['#6366f1','#10b981','#f43f5e','#f97316','#06b6d4','#ec4899'];

    // ── Storage ───────────────────────────────────────────────────────────────

    function _load() {
        try { _boards = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
        catch { _boards = []; }
    }

    function _save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(_boards));
    }

    function _getContent(id) {
        try { return JSON.parse(localStorage.getItem(CONTENT_PREFIX + id)) || {}; }
        catch { return {}; }
    }

    function _saveContent(id, data) {
        localStorage.setItem(CONTENT_PREFIX + id, JSON.stringify(data));
    }

    function _uid() {
        return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    function _esc(str) {
        return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // ── Sidebar rendering ─────────────────────────────────────────────────────

    function renderSidebarItems() {
        const list = document.getElementById('navBoardsList');
        if (!list) return;
        list.innerHTML = '';

        _boards.forEach(board => {
            const li = document.createElement('li');
            li.className = 'nav-item board-nav-item';
            if (board.id === _currentBoardId) li.classList.add('active');
            li.dataset.boardId = board.id;

            li.innerHTML = `
                <span class="board-icon">${ICONS[board.type] || ICONS['chart-grid']}</span>
                <span class="board-item-name">${_esc(board.name)}</span>
                <button class="board-item-menu" title="Options">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="2.5" r="1.2" fill="currentColor"/>
                        <circle cx="7" cy="7"   r="1.2" fill="currentColor"/>
                        <circle cx="7" cy="11.5" r="1.2" fill="currentColor"/>
                    </svg>
                </button>
            `;

            li.addEventListener('click', e => {
                if (e.target.closest('.board-item-menu')) return;
                navigateTo(board.id);
            });

            li.querySelector('.board-item-menu').addEventListener('click', e => {
                e.stopPropagation();
                _openBoardMenu(board.id, e.currentTarget);
            });

            list.appendChild(li);
        });
    }

    // ── Navigation ────────────────────────────────────────────────────────────

    function navigateTo(id) {
        const board = _boards.find(b => b.id === id);
        if (!board) return;
        _currentBoardId = id;

        // Tier boards — just switch the tier; the normal VPM dashboard stays visible
        if (board.type === 'tier') {
            _ensureTierRegistered(board);
            if (typeof VPMEscalation !== 'undefined') {
                VPMEscalation.switchTier(board.tierNum);
            }
            // Highlight the sidebar item as "current tier" without disturbing active tab
            document.querySelectorAll('.board-nav-item').forEach(el => el.classList.remove('board-tier-active'));
            const li = document.querySelector(`.board-nav-item[data-board-id="${id}"]`);
            if (li) li.classList.add('board-tier-active');
            return;
        }

        // Standard boards — show #panel-boards with custom content
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(el => el.classList.remove('active'));

        const li = document.querySelector(`.board-nav-item[data-board-id="${id}"]`);
        if (li) li.classList.add('active');

        const panel = document.getElementById('panel-boards');
        if (panel) {
            panel.classList.add('active');
            _renderBoardContent(panel, board);
        }

        // Update page title
        const titleEl = document.getElementById('pageTitle');
        if (titleEl) titleEl.textContent = board.name;
    }

    // Register a tier board's meta with VPMEscalation (idempotent — safe to call multiple times)
    function _ensureTierRegistered(board) {
        if (typeof VPMEscalation === 'undefined') return;
        VPMEscalation.registerTier(board.tierNum, board.name, board.tierAccent || null, board.reportsTo ?? null);
    }

    // Inject a tier button into the header tier switcher
    function _addTierButton(board) {
        const container = document.getElementById('tierSwitcher');
        if (!container) return;
        if (container.querySelector(`[data-tier="${board.tierNum}"]`)) return; // already added
        const btn = document.createElement('button');
        btn.className   = 'tier-btn tier-btn-custom';
        btn.dataset.tier = board.tierNum;
        btn.title       = board.name + ' (custom tier)';

        const label = document.createElement('span');
        label.textContent = board.name;
        label.addEventListener('click', () => navigateTo(board.id));

        const del = document.createElement('span');
        del.className   = 'tier-btn-del';
        del.textContent = '×';
        del.title       = 'Delete ' + board.name;
        del.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!confirm(`Delete board "${board.name}"?`)) return;
            if (!confirm(`Are you sure? "${board.name}" will be permanently removed.`)) return;
            deleteBoard(board.id);
        });

        btn.appendChild(label);
        btn.appendChild(del);
        btn.addEventListener('click', () => navigateTo(board.id));
        container.appendChild(btn);
    }

    // ── Board content rendering ───────────────────────────────────────────────

    function _renderBoardContent(panel, board) {
        const typeInfo = BOARD_TYPES[board.type] || BOARD_TYPES['chart-grid'];
        panel.innerHTML = `
            <div class="board-page-header">
                <div class="board-page-title-row">
                    <h2 class="board-page-title">${_esc(board.name)}</h2>
                    <span class="board-page-type-tag">${typeInfo.label}</span>
                </div>
            </div>
            <div class="board-page-content" id="boardContent-${board.id}"></div>
        `;
        const content = panel.querySelector('.board-page-content');

        switch (board.type) {
            case 'chart-grid':   _renderChartGrid(content, board);   break;
            case 'news-feed':    _renderNewsFeed(content, board);     break;
            case 'web-entry':    _renderWebEntry(content, board);     break;
            case 'exec-summary': _renderExecSummary(content, board);  break;
        }
    }

    // ── Chart Grid ────────────────────────────────────────────────────────────

    function _renderChartGrid(el, board) {
        el.innerHTML = `
            <div class="board-toolbar">
                <button class="board-action-btn board-add-chart-trigger">+ Add Chart</button>
            </div>
            <div class="board-chart-grid" id="boardChartGrid-${board.id}">
                <div class="board-empty-state">
                    ${ICONS['chart-grid'].replace('16', '40').replace('16', '40')}
                    <p>No charts yet — click <strong>+ Add Chart</strong> to begin</p>
                </div>
            </div>
        `;
        // Placeholder: future implementation will allow picking charts from each stream
        el.querySelector('.board-add-chart-trigger').addEventListener('click', () => {
            _showChartPicker(board, el);
        });
        _loadChartCards(board, el);
    }

    function _showChartPicker(board, el) {
        // Simple stream picker for now
        const streams = ['Safety', 'People', 'Quality', 'Production', 'Supply Chain', 'Cost', 'Maintenance', 'Engineering'];
        const existing = document.getElementById('boardChartPickerPopover');
        if (existing) { existing.remove(); return; }

        const popover = document.createElement('div');
        popover.id = 'boardChartPickerPopover';
        popover.className = 'board-chart-picker-popover';
        popover.innerHTML = `
            <p class="picker-title">Add a chart from:</p>
            ${streams.map(s => `<button class="picker-stream-btn" data-stream="${s}">${s}</button>`).join('')}
            <button class="picker-cancel">Cancel</button>
        `;
        el.querySelector('.board-toolbar').appendChild(popover);

        popover.querySelectorAll('.picker-stream-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                _addChartCard(board, el, btn.dataset.stream);
                popover.remove();
            });
        });
        popover.querySelector('.picker-cancel').addEventListener('click', () => popover.remove());
        setTimeout(() => document.addEventListener('click', e => {
            if (!popover.contains(e.target)) popover.remove();
        }, { once: true }), 50);
    }

    function _addChartCard(board, el, stream) {
        const content = _getContent(board.id);
        content.charts = content.charts || [];
        const card = { id: _uid(), stream };
        content.charts.push(card);
        _saveContent(board.id, content);
        _loadChartCards(board, el);
    }

    function _loadChartCards(board, el) {
        const content = _getContent(board.id);
        const charts  = content.charts || [];
        const grid    = el.querySelector('.board-chart-grid');
        if (!grid) return;

        if (!charts.length) {
            grid.innerHTML = `<div class="board-empty-state">${ICONS['chart-grid']}<p>No charts yet — click <strong>+ Add Chart</strong> to begin</p></div>`;
            return;
        }

        grid.innerHTML = charts.map(c => `
            <div class="board-chart-card" data-card-id="${c.id}">
                <div class="board-chart-card-header">
                    <span class="board-chart-card-label">${_esc(c.stream)}</span>
                    <button class="board-chart-card-remove" data-card-id="${c.id}" title="Remove">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                    </button>
                </div>
                <div class="board-chart-card-body">
                    <p class="board-chart-placeholder">${_esc(c.stream)} chart — coming soon</p>
                </div>
            </div>
        `).join('');

        grid.querySelectorAll('.board-chart-card-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const content = _getContent(board.id);
                content.charts = (content.charts || []).filter(c => c.id !== btn.dataset.cardId);
                _saveContent(board.id, content);
                _loadChartCards(board, el);
            });
        });
    }

    // ── News / Updates feed ───────────────────────────────────────────────────

    function _renderNewsFeed(el, board) {
        const content = _getContent(board.id);
        const posts   = content.posts || [];

        el.innerHTML = `
            <div class="board-toolbar">
                <button class="board-action-btn" id="newPostBtn-${board.id}">+ New Post</button>
            </div>
            <div class="board-compose" id="compose-${board.id}" hidden>
                <textarea class="board-compose-text" placeholder="What's the update?"></textarea>
                <div class="board-compose-row">
                    <select class="board-compose-category">
                        <option value="">No category</option>
                        <option value="info">Info</option>
                        <option value="action">Action Needed</option>
                        <option value="alert">Alert</option>
                    </select>
                    <div class="board-compose-btns">
                        <button class="board-action-btn compose-submit">Post</button>
                        <button class="board-action-btn board-action-btn-ghost compose-cancel">Cancel</button>
                    </div>
                </div>
            </div>
            <div class="board-feed" id="feed-${board.id}">
                ${posts.length
                    ? posts.map(p => _buildPostHTML(p)).join('')
                    : `<div class="board-empty-state">${ICONS['news-feed']}<p>No posts yet — add the first update</p></div>`
                }
            </div>
        `;

        el.querySelector(`#newPostBtn-${board.id}`).addEventListener('click', () => {
            el.querySelector(`#compose-${board.id}`).hidden = false;
            el.querySelector('.board-compose-text').focus();
        });

        el.querySelector('.compose-cancel').addEventListener('click', () => {
            el.querySelector(`#compose-${board.id}`).hidden = true;
            el.querySelector('.board-compose-text').value = '';
        });

        el.querySelector('.compose-submit').addEventListener('click', () => {
            const text = el.querySelector('.board-compose-text').value.trim();
            if (!text) return;
            const cat  = el.querySelector('.board-compose-category').value;
            const content = _getContent(board.id);
            content.posts = content.posts || [];
            content.posts.unshift({ id: _uid(), text, cat, at: new Date().toISOString() });
            _saveContent(board.id, content);
            _renderBoardContent(document.getElementById('panel-boards'), board);
        });

        el.querySelectorAll('.post-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const c = _getContent(board.id);
                c.posts = (c.posts || []).filter(p => p.id !== btn.dataset.postId);
                _saveContent(board.id, c);
                _renderBoardContent(document.getElementById('panel-boards'), board);
            });
        });
    }

    function _buildPostHTML(post) {
        const d    = new Date(post.at);
        const fmt  = d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) +
                     ' · ' + d.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });
        const catClass = post.cat ? `post-cat-${post.cat}` : '';
        const catLabel = post.cat ? `<span class="post-cat ${catClass}">${post.cat}</span>` : '';
        return `
            <div class="board-post">
                <div class="post-meta">
                    ${catLabel}
                    <span class="post-time">${fmt}</span>
                    <button class="post-delete" data-post-id="${post.id}" title="Delete">
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                    </button>
                </div>
                <p class="post-body">${_esc(post.text)}</p>
            </div>
        `;
    }

    // ── Web Data Entry ────────────────────────────────────────────────────────

    function _renderWebEntry(el, board) {
        const streams = [
            { id: 'safety',      label: 'Safety',       color: '#22c55e', metrics: [
                { key: 'osha_days',    label: 'OSHA Free Days',         unit: 'days' },
                { key: 'observations', label: 'Safety Observations',     unit: '' },
                { key: 'near_miss',    label: 'Near Miss Count',         unit: '' },
            ]},
            { id: 'people',      label: 'People',       color: '#8b5cf6', metrics: [
                { key: 'sick_leave',   label: 'Sick Leave (hrs)',         unit: 'hrs' },
                { key: 'headcount',    label: 'Operator Headcount',       unit: '' },
                { key: 'turnover_hr',  label: 'Turnover – Hourly (%)',    unit: '%' },
                { key: 'turnover_sal', label: 'Turnover – Salaried (%)',  unit: '%' },
            ]},
            { id: 'quality',     label: 'Quality',      color: '#06b6d4', metrics: [
                { key: 'fpy',          label: 'FPY (%)',                  unit: '%' },
                { key: 'ncmr_ost',     label: 'NCMR – Assembly',           unit: '' },
                { key: 'ncmr_cc',      label: 'NCMR – CC',               unit: '' },
            ]},
            { id: 'production',  label: 'Production',   color: '#f59e0b', metrics: [
                { key: 'cc_volume',    label: 'CC Volume',                unit: 'units' },
                { key: 'ost_volume',   label: 'OST Volume',               unit: 'units' },
                { key: 'idl_ost',      label: 'IDL % – Assembly',           unit: '%' },
            ]},
            { id: 'supplychain', label: 'Supply Chain', color: '#22c55e', metrics: [
                { key: 'svc_jp',       label: 'Service Level JP (%)',     unit: '%' },
                { key: 'dioh',         label: 'DIOH (days)',              unit: 'days' },
            ]},
            { id: 'cost',        label: 'Cost',         color: '#f97316', metrics: [
                { key: 'idl_ost_cost', label: 'IDL % – Assembly',          unit: '%' },
                { key: 'idl_cc',       label: 'IDL % – CC',              unit: '%' },
            ]},
        ];

        const content = _getContent(board.id);
        const vals    = content.entries || {};
        const today   = new Date().toISOString().slice(0, 10);
        const entryDate = content.entryDate || today;

        el.innerHTML = `
            <div class="web-entry-toolbar">
                <label class="web-entry-date-label">Entry date:
                    <input type="date" class="web-entry-date" id="entryDate-${board.id}" value="${entryDate}">
                </label>
                <button class="board-action-btn web-entry-save" id="webEntrySave-${board.id}">Save All</button>
            </div>
            <div class="web-entry-grid">
                ${streams.map(s => `
                    <div class="web-entry-stream" style="--stream-color:${s.color}">
                        <h3 class="web-entry-stream-title">${s.label}</h3>
                        ${s.metrics.map(m => {
                            const fk = s.id + '_' + m.key;
                            return `
                                <div class="web-entry-row">
                                    <label class="web-entry-label">${m.label}</label>
                                    <div class="web-entry-input-wrap">
                                        <input class="web-entry-input" type="number" step="any"
                                               data-field="${fk}" value="${vals[fk] !== undefined ? vals[fk] : ''}"
                                               placeholder="--">
                                        ${m.unit ? `<span class="web-entry-unit">${m.unit}</span>` : ''}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `).join('')}
            </div>
        `;

        el.querySelector(`#webEntrySave-${board.id}`).addEventListener('click', () => {
            const entries = {};
            el.querySelectorAll('.web-entry-input').forEach(inp => {
                if (inp.value !== '') entries[inp.dataset.field] = parseFloat(inp.value);
            });
            const entryDateVal = el.querySelector(`#entryDate-${board.id}`).value;
            _saveContent(board.id, { ...content, entries, entryDate: entryDateVal });

            const btn = el.querySelector(`#webEntrySave-${board.id}`);
            const orig = btn.textContent;
            btn.textContent = 'Saved!';
            btn.classList.add('btn-saved');
            setTimeout(() => { btn.textContent = orig; btn.classList.remove('btn-saved'); }, 2000);
        });
    }

    // ── Executive Summary ─────────────────────────────────────────────────────
    // Layout: KPI sparklines row (no labels) + comments section + actions space

    function _renderExecSummary(el, board) {
        const content  = _getContent(board.id);
        const posts    = content.posts || [];

        // 6 KPI sparklines — mirrors from Overview; no text labels, just colour dots + canvas
        const kpiMirrors = [
            { canvas: 'sparkline-safety',     color: '#22c55e' },
            { canvas: 'sparkline-people',     color: '#8b5cf6' },
            { canvas: 'sparkline-quality',    color: '#06b6d4' },
            { canvas: 'sparkline-production', color: '#f59e0b' },
            { canvas: 'sparkline-supply',     color: '#22c55e' },
            { canvas: 'sparkline-cost',       color: '#f97316' },
        ];

        el.innerHTML = `
            <!-- ① Graphs strip — 6 KPI sparklines, no labels -->
            <div class="exec-graphs-strip">
                ${kpiMirrors.map(k => `
                    <div class="exec-spark-cell">
                        <canvas class="exec-spark-canvas" id="exec-${board.id}-${k.canvas}"
                                data-source="${k.canvas}" data-color="${k.color}"></canvas>
                    </div>
                `).join('')}
            </div>

            <!-- ② Comments / notes area -->
            <div class="exec-section">
                <div class="exec-section-title">Comments &amp; Notes</div>
                <div class="board-toolbar" style="margin-bottom:10px">
                    <button class="board-action-btn" id="execNewPost-${board.id}">+ Add Comment</button>
                </div>
                <div class="board-compose" id="execCompose-${board.id}" hidden>
                    <textarea class="board-compose-text" placeholder="Add a note or comment..."></textarea>
                    <div class="board-compose-row">
                        <div></div>
                        <div class="board-compose-btns">
                            <button class="board-action-btn exec-compose-submit">Post</button>
                            <button class="board-action-btn board-action-btn-ghost exec-compose-cancel">Cancel</button>
                        </div>
                    </div>
                </div>
                <div class="board-feed" id="execFeed-${board.id}">
                    ${posts.length
                        ? posts.map(p => _buildPostHTML(p)).join('')
                        : `<div class="board-empty-state" style="padding:30px">${ICONS['news-feed']}<p>No comments yet</p></div>`
                    }
                </div>
            </div>

            <!-- ③ Actions space -->
            <div class="exec-section">
                <div class="exec-section-title">Actions Space</div>
                <div class="exec-actions-space">
                    <div class="exec-actions-prompt">
                        <p>Action items are managed on the <strong>Action Items</strong> tab.</p>
                        <button class="board-action-btn exec-goto-actions">Go to Action Items</button>
                    </div>
                </div>
            </div>
        `;

        // Wire comments
        el.querySelector(`#execNewPost-${board.id}`).addEventListener('click', () => {
            el.querySelector(`#execCompose-${board.id}`).hidden = false;
            el.querySelector('.board-compose-text').focus();
        });
        el.querySelector('.exec-compose-cancel').addEventListener('click', () => {
            el.querySelector(`#execCompose-${board.id}`).hidden = true;
            el.querySelector('.board-compose-text').value = '';
        });
        el.querySelector('.exec-compose-submit').addEventListener('click', () => {
            const text = el.querySelector('.board-compose-text').value.trim();
            if (!text) return;
            const c = _getContent(board.id);
            c.posts = c.posts || [];
            c.posts.unshift({ id: _uid(), text, at: new Date().toISOString() });
            _saveContent(board.id, c);
            _renderBoardContent(document.getElementById('panel-boards'), board);
        });
        el.querySelectorAll('.post-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const c = _getContent(board.id);
                c.posts = (c.posts || []).filter(p => p.id !== btn.dataset.postId);
                _saveContent(board.id, c);
                _renderBoardContent(document.getElementById('panel-boards'), board);
            });
        });

        // Go to Action Items
        el.querySelector('.exec-goto-actions').addEventListener('click', () => {
            document.querySelector('.nav-item[data-tab="actions"]')?.click();
        });

        // Mirror sparklines from Overview canvases (copy pixel data)
        kpiMirrors.forEach(k => {
            const src  = document.getElementById(k.canvas);
            const dest = document.getElementById(`exec-${board.id}-${k.canvas}`);
            if (!src || !dest) return;
            try {
                const ctx = dest.getContext('2d');
                dest.width  = src.width;
                dest.height = src.height;
                ctx.drawImage(src, 0, 0);
            } catch { /* cross-origin guard */ }
        });
    }

    // ── Board context menu ────────────────────────────────────────────────────

    function _openBoardMenu(id, btn) {
        document.querySelectorAll('.board-dropdown').forEach(d => d.remove());

        const dropdown = document.createElement('div');
        dropdown.className = 'board-dropdown';
        dropdown.innerHTML = `
            <button data-action="rename">Rename</button>
            <button data-action="delete" class="board-dropdown-delete">Delete</button>
        `;

        dropdown.querySelector('[data-action="rename"]').addEventListener('click', e => {
            e.stopPropagation();
            document.querySelectorAll('.board-dropdown').forEach(d => d.remove());
            const board = _boards.find(b => b.id === id);
            if (!board) return;
            _openRenameModal(id, board.name);
        });

        dropdown.querySelector('[data-action="delete"]').addEventListener('click', e => {
            e.stopPropagation();
            document.querySelectorAll('.board-dropdown').forEach(d => d.remove());
            const board = _boards.find(b => b.id === id);
            if (!board) return;
            if (!confirm(`Delete board "${board.name}"?`)) return;
            if (!confirm(`Are you sure? "${board.name}" will be permanently removed.`)) return;
            deleteBoard(id);
        });

        btn.parentElement.style.position = 'relative';
        btn.parentElement.appendChild(dropdown);

        setTimeout(() => {
            document.addEventListener('click', () => document.querySelectorAll('.board-dropdown').forEach(d => d.remove()), { once: true });
        }, 0);
    }

    // ── Create / Rename modals ────────────────────────────────────────────────

    function _refreshReportsToRow(modal) {
        const row = modal.querySelector('#boardReportsToRow');
        const sel = modal.querySelector('#boardReportsTo');
        const selectedType = modal.querySelector('.board-type-card.selected')?.dataset.type;
        if (!row) return;
        row.style.display = (selectedType === 'tier') ? '' : 'none';
        if (!sel) return;
        // Rebuild options: built-ins + any existing tier boards (so one tier can report to another)
        const builtIns = [
            '<option value="none">None — standalone, no escalation</option>',
            '<option value="1">T1 — Shop Floor</option>',
            '<option value="2">T2 — Department</option>',
            '<option value="3">T3 — Executive</option>',
        ];
        const customOpts = _boards
            .filter(b => b.type === 'tier')
            .map(b => `<option value="${b.tierNum}">${b.name}</option>`);
        sel.innerHTML = [...builtIns, ...customOpts].join('');
        // Default to T2 (most common parent for a new sub-tier)
        sel.value = '2';
    }

    function openAddModal() {
        const modal = document.getElementById('boardsModal');
        if (!modal) return;
        modal.querySelector('#boardModalTitle').textContent    = 'New Board';
        modal.querySelector('#boardNameInput').value           = '';
        modal.querySelector('#boardCreateBtn').textContent     = 'Create';
        modal.querySelector('#boardCreateBtn').dataset.mode    = 'create';
        delete modal.querySelector('#boardCreateBtn').dataset.boardId;

        modal.querySelectorAll('.board-type-card').forEach(c => c.classList.remove('selected'));
        modal.querySelector('.board-type-card[data-type="tier"]')?.classList.add('selected');

        modal.querySelector('.board-type-row').style.display = '';
        _refreshReportsToRow(modal);
        modal.hidden = false;
        setTimeout(() => modal.querySelector('#boardNameInput').focus(), 50);
    }

    function _openRenameModal(id, currentName) {
        const modal = document.getElementById('boardsModal');
        if (!modal) return;
        modal.querySelector('#boardModalTitle').textContent    = 'Rename Board';
        modal.querySelector('#boardNameInput').value           = currentName;
        modal.querySelector('#boardCreateBtn').textContent     = 'Rename';
        modal.querySelector('#boardCreateBtn').dataset.mode    = 'rename';
        modal.querySelector('#boardCreateBtn').dataset.boardId = id;
        modal.querySelector('.board-type-row').style.display  = 'none';
        const rtRow = modal.querySelector('#boardReportsToRow');
        if (rtRow) rtRow.style.display = 'none';
        modal.hidden = false;
        setTimeout(() => {
            const inp = modal.querySelector('#boardNameInput');
            inp.focus(); inp.select();
        }, 50);
    }

    function _closeModal() {
        const modal = document.getElementById('boardsModal');
        if (modal) modal.hidden = true;
    }

    // ── CRUD ──────────────────────────────────────────────────────────────────

    function _nextTierNum() {
        const used = _boards.filter(b => b.type === 'tier').map(b => b.tierNum);
        let n = 10;
        while (used.includes(n)) n++;
        return n;
    }

    function createBoard(name, type, reportsTo) {
        const board = {
            id:        _uid(),
            name:      name.trim() || 'New Board',
            type:      type || 'news-feed',
            createdAt: new Date().toISOString(),
        };
        if (type === 'tier') {
            board.tierNum    = _nextTierNum();
            board.tierAccent = TIER_ACCENT_CYCLE[(board.tierNum - 10) % TIER_ACCENT_CYCLE.length];
            board.reportsTo  = reportsTo ?? null;  // null = standalone (no escalation)
            _ensureTierRegistered(board);
        }
        _boards.push(board);
        _save();
        renderSidebarItems();
        if (type === 'tier') {
            _addTierButton(board);
            navigateTo(board.id);   // switches to this tier immediately
        } else {
            navigateTo(board.id);
        }
    }

    function renameBoard(id, name) {
        const board = _boards.find(b => b.id === id);
        if (!board || !name.trim()) return;
        board.name = name.trim();
        _save();
        renderSidebarItems();
        if (_currentBoardId === id) {
            const t = document.querySelector('.board-page-title');
            if (t) t.textContent = board.name;
            const titleEl = document.getElementById('pageTitle');
            if (titleEl) titleEl.textContent = board.name;
        }
    }

    function deleteBoard(id) {
        const board = _boards.find(b => b.id === id);
        _boards = _boards.filter(b => b.id !== id);
        localStorage.removeItem(CONTENT_PREFIX + id);
        _save();

        // Remove tier button from header if it was a tier board
        if (board?.type === 'tier') {
            document.querySelector(`#tierSwitcher [data-tier="${board.tierNum}"]`)?.remove();
            // If this tier was active, fall back to T1
            if (typeof VPMEscalation !== 'undefined' && VPMEscalation.getCurrentTier() === board.tierNum) {
                VPMEscalation.switchTier(1);
            }
        }

        if (_currentBoardId === id) {
            _currentBoardId = null;
            document.getElementById('panel-boards')?.classList.remove('active');
            document.querySelector('.nav-item[data-tab="overview"]')?.click();
        }
        renderSidebarItems();
    }

    // ── Init ──────────────────────────────────────────────────────────────────

    function init() {
        _load();

        // Restore custom tiers — must register before VPMEscalation might switchTier to them
        _boards.filter(b => b.type === 'tier').forEach(board => {
            _ensureTierRegistered(board);
            _addTierButton(board);
        });

        // Also clear any board-tier-active highlight when a built-in tier button is clicked
        document.querySelectorAll('.tier-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.board-nav-item').forEach(el => el.classList.remove('board-tier-active'));
            });
        });

        renderSidebarItems();

        // Add board button
        document.getElementById('addBoardBtn')?.addEventListener('click', openAddModal);

        // Modal wiring
        const modal = document.getElementById('boardsModal');
        if (!modal) return;

        // Type card selection — refresh reports-to row visibility on each change
        modal.querySelectorAll('.board-type-card').forEach(card => {
            card.addEventListener('click', () => {
                modal.querySelectorAll('.board-type-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                _refreshReportsToRow(modal);
            });
        });

        // Create / Rename submit
        modal.querySelector('#boardCreateBtn').addEventListener('click', () => {
            const name = modal.querySelector('#boardNameInput').value.trim();
            const btn  = modal.querySelector('#boardCreateBtn');
            if (btn.dataset.mode === 'rename') {
                renameBoard(btn.dataset.boardId, name);
            } else {
                const type      = modal.querySelector('.board-type-card.selected')?.dataset.type || 'news-feed';
                const rtVal     = modal.querySelector('#boardReportsTo')?.value || 'none';
                const reportsTo = (type === 'tier' && rtVal !== 'none') ? parseInt(rtVal) : null;
                createBoard(name, type, reportsTo);
            }
            _closeModal();
        });

        modal.querySelector('#boardCancelBtn')?.addEventListener('click', _closeModal);
        modal.querySelector('#boardModalClose')?.addEventListener('click', _closeModal);
        modal.addEventListener('click', e => { if (e.target === modal) _closeModal(); });
        modal.querySelector('#boardNameInput').addEventListener('keydown', e => {
            if (e.key === 'Enter') modal.querySelector('#boardCreateBtn').click();
        });
    }

    return {
        init, createBoard, renameBoard, deleteBoard, navigateTo,
        // Returns all tier-type boards that escalate messages to a given tier number
        getBoardsReportingTo: (tierNum) => _boards.filter(b => b.type === 'tier' && b.reportsTo === tierNum),
    };
})();