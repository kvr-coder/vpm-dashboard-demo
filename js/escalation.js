/**
 * VPM Escalation System
 * Manages tier switching and message escalation T1 -> T2 -> T3
 */
const VPMEscalation = (function () {
    'use strict';

    const MSG_KEY  = 'vpm-escalation-messages';
    const TIER_KEY = 'vpm-current-tier';

    let currentTier   = 1;
    let messages      = [];
    let inboxVisible  = false;

    // Tabs visible per tier
    const TIER_TABS = {
        1: ['overview','safety','people','quality','production','supplychain','cost','maintenance','engineering','ci','actions'],
        2: ['overview','safety','people','quality','supplychain','cost','maintenance','ci','actions'],
        3: ['overview','safety','people','quality','supplychain','cost','maintenance','ci','actions'],
        4: ['overview','safety','people','quality','supplychain','cost','maintenance','ci','actions']
    };

    const TIER_META = {
        1: { accent: '#3b82f6', accentHover: '#2563eb', label: 'T1 — Shop Floor',  role: 'Team' },
        2: { accent: '#f59e0b', accentHover: '#d97706', label: 'T2 — Department',  role: 'Manager' },
        3: { accent: '#a855f7', accentHover: '#9333ea', label: 'T3 — Management',  role: 'Management', reportsTo: 4 },
        4: { accent: '#ec4899', accentHover: '#db2777', label: 'T4 — Executive',   role: 'Executive' }
    };

    // =========================================================
    // INIT
    // =========================================================
    function init() {
        currentTier = parseInt(localStorage.getItem(TIER_KEY) || '1');
        loadMessages();
        buildTierSwitcher();
        applyTier(currentTier, false);
        setupInboxToggle();
        renderInbox();   // also calls renderMessageBoards() internally

        // Re-apply tier visibility when tabs are added/removed
        document.addEventListener('vpm:tabsChanged', () => applyTier(currentTier, false));
        // Rebuild switcher when tier list changes
        document.addEventListener('vpm:tiersChanged', () => rebuildTierSwitcher());
    }

    // =========================================================
    // TIER SWITCHING
    // =========================================================
    function buildTierSwitcher() {
        const container = document.getElementById('tierSwitcher');
        if (!container) return;
        const tiers = (typeof VPMTierManager !== 'undefined')
            ? VPMTierManager.getTiers()
            : [1,2,3,4].map(id => TIER_META[id] ? Object.assign({ id }, TIER_META[id]) : { id, label: 'T'+id });

        // Group boards by level, sort levels descending (highest first)
        const byLevel = {};
        tiers.forEach(t => {
            const lvl = t.level || t.id;
            if (!byLevel[lvl]) byLevel[lvl] = [];
            byLevel[lvl].push(t);
        });
        const levels = Object.keys(byLevel).map(Number).sort((a, b) => b - a);

        levels.forEach(lvl => {
            const boards = byLevel[lvl];
            if (boards.length === 1) {
                // Single board at this level - simple button
                const t = boards[0];
                const btn = document.createElement('button');
                btn.className = 'tier-btn' + (t.id === currentTier ? ' active' : '');
                btn.textContent = 'T' + lvl;
                btn.dataset.tier = t.id;
                btn.title = t.label || ('T' + lvl);
                btn.addEventListener('click', () => switchTier(t.id));
                container.appendChild(btn);
            } else {
                // Multiple boards - dropdown group
                const group = document.createElement('div');
                group.className = 'tier-btn-group';
                const activeBoard = boards.find(b => b.id === currentTier);
                const isGroupActive = !!activeBoard;

                const mainBtn = document.createElement('button');
                mainBtn.className = 'tier-btn tier-btn-dropdown-trigger' + (isGroupActive ? ' active' : '');
                mainBtn.textContent = 'T' + lvl + ' \u25BE';
                mainBtn.title = isGroupActive ? activeBoard.label : ('T' + lvl + ' boards');
                mainBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Toggle dropdown
                    const dd = group.querySelector('.tier-dropdown');
                    const wasOpen = dd && dd.classList.contains('open');
                    document.querySelectorAll('.tier-dropdown.open').forEach(d => d.classList.remove('open'));
                    if (!wasOpen && dd) dd.classList.add('open');
                });
                group.appendChild(mainBtn);

                const dropdown = document.createElement('div');
                dropdown.className = 'tier-dropdown';
                boards.forEach(b => {
                    const item = document.createElement('button');
                    item.className = 'tier-dropdown-item' + (b.id === currentTier ? ' active' : '');
                    item.textContent = b.label || ('T' + lvl);
                    item.dataset.tier = b.id;
                    item.addEventListener('click', (e) => {
                        e.stopPropagation();
                        dropdown.classList.remove('open');
                        switchTier(b.id);
                    });
                    dropdown.appendChild(item);
                });
                group.appendChild(dropdown);
                container.appendChild(group);
            }
        });

        // Close dropdowns on outside click
        document.addEventListener('click', () => {
            document.querySelectorAll('.tier-dropdown.open').forEach(d => d.classList.remove('open'));
        }, { once: true });
    }

    /** Rebuild the tier switcher buttons (called by VPMTierManager after tier changes). */
    function rebuildTierSwitcher() {
        const container = document.getElementById('tierSwitcher');
        if (!container) return;
        container.innerHTML = '';
        // Ensure currentTier still exists; if not, fall back to first tier
        if (typeof VPMTierManager !== 'undefined') {
            const tiers = VPMTierManager.getTiers();
            if (!tiers.find(t => t.id === currentTier) && tiers.length > 0) {
                currentTier = tiers[0].id;
                localStorage.setItem(TIER_KEY, String(currentTier));
            }
        }
        buildTierSwitcher();
        applyTier(currentTier, false);
        renderInbox();
    }

    function switchTier(tier) {
        // Gate locked boards — prompt PIN before switching
        if (typeof VPMBoardLock !== 'undefined' && !VPMBoardLock.isBoardUnlocked(tier)) {
            VPMBoardLock.requireBoardAccess(tier, () => switchTier(tier));
            return;
        }
        currentTier = tier;
        localStorage.setItem(TIER_KEY, String(tier));
        applyTier(tier, true);
        renderInbox();
        // Update active state on simple buttons
        document.querySelectorAll('.tier-btn[data-tier]').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.tier) === tier);
        });
        // Update active state on dropdown groups
        document.querySelectorAll('.tier-btn-group').forEach(group => {
            const items = group.querySelectorAll('.tier-dropdown-item');
            let groupActive = false;
            items.forEach(item => {
                const isActive = parseInt(item.dataset.tier) === tier;
                item.classList.toggle('active', isActive);
                if (isActive) groupActive = true;
            });
            const trigger = group.querySelector('.tier-btn-dropdown-trigger');
            if (trigger) trigger.classList.toggle('active', groupActive);
        });
        // Remove stale note boxes so attachNoteBox re-creates them with the new tier's storage key
        document.querySelectorAll('.chart-note-wrap').forEach(w => w.remove());
        // Force chart re-render so note boxes rebuild with the correct tier's stored notes
        document.dispatchEvent(new CustomEvent('vpm:requestRender'));
    }

    function applyTier(tier, triggerNav) {
        const meta = (typeof VPMTierManager !== 'undefined')
            ? VPMTierManager.getTierMeta(tier)
            : (TIER_META[tier] || null);
        if (!meta) return;

        // Body class — strip any previous tier-N class, add new one
        document.body.className = document.body.className.replace(/\btier-\d+\b/g, '').trim();
        document.body.classList.add('tier-' + tier);

        // CSS vars
        document.documentElement.style.setProperty('--accent', meta.accent);
        document.documentElement.style.setProperty('--accent-hover', meta.accentHover);
        document.documentElement.style.setProperty('--accent-dim', hexToRgba(meta.accent, 0.15));

        // Tier label in header
        const label = document.getElementById('tierLabel');
        if (label) label.textContent = meta.label;

        // Sidebar tab visibility — use VPMTabManager if available for live custom/hidden tabs
        const allowed = (typeof VPMTabManager !== 'undefined')
            ? VPMTabManager.getTabsForTier(tier)
            : (TIER_TABS[tier] || TIER_TABS[1]);
        document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
            item.style.display = allowed.includes(item.dataset.tab) ? '' : 'none';
        });

        // Restore per-tier drag order so the user's custom sequence is preserved
        if (typeof VPMTabManager !== 'undefined' && typeof VPMTabManager.reorderNav === 'function') {
            VPMTabManager.reorderNav(VPMTabManager.getOrderedTabsForTier(tier));
        }

        // If current tab hidden in this tier, navigate to overview
        if (triggerNav) {
            const activeTab = document.querySelector('.nav-item.active');
            if (activeTab && !allowed.includes(activeTab.dataset.tab)) {
                const overviewItem = document.querySelector('.nav-item[data-tab="overview"]');
                if (overviewItem) overviewItem.click();
            }
        }

        // Notify other modules (e.g. zoom controls) that the active tier changed
        document.dispatchEvent(new CustomEvent('vpm:tierChanged', { detail: { tier } }));
    }

    // =========================================================
    // MESSAGE STORAGE
    // =========================================================
    const EXT_MSG_KEY = 'vpm-ext-messages';

    function loadMessages() {
        try {
            messages = JSON.parse(localStorage.getItem(MSG_KEY) || '[]');
        } catch (e) {
            messages = [];
        }
        // Load persisted external (cross-tier) messages and merge by ID
        try {
            const ext = JSON.parse(localStorage.getItem(EXT_MSG_KEY) || '[]');
            ext.forEach(em => { if (!messages.find(m => m.id === em.id)) messages.push(em); });
        } catch (e) { /* ignore */ }
        // Migrate: backfill new fields on existing messages
        let dirty = false;
        messages.forEach(m => {
            if (!Array.isArray(m.dismissedBy))      { m.dismissedBy = [];      dirty = true; }
            if (!Array.isArray(m.escalatedThrough)) { m.escalatedThrough = []; dirty = true; }
            if (m.targetTab === undefined)           { m.targetTab = null;      dirty = true; }
            if (m.boardType === undefined) {
                if (m.cascade) m.boardType = 'cascade';
                else if (m.status === 'escalated' && m.escalatedToTier) m.boardType = 'escalation';
                else m.boardType = null;
                dirty = true;
            }
        });
        if (dirty) saveMessages();
    }

    function saveMessages() {
        // Own messages only — external ones stay in their own key
        const own = messages.filter(m => !m._external);
        const ext = messages.filter(m =>  m._external);
        localStorage.setItem(MSG_KEY,     JSON.stringify(own));
        localStorage.setItem(EXT_MSG_KEY, JSON.stringify(ext));
        // Notify overview strip to refresh pending counts
        document.dispatchEvent(new CustomEvent('vpm:messagesUpdated'));
        // Trigger cross-tier publish (debounced)
        if (typeof VPMSharedStore !== 'undefined') VPMSharedStore.schedulePublish();
    }

    function genId() {
        return 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    }

    // cascade=true → message broadcasts DOWN to all tiers below the sender
    function addMessage(text, metric, severity, cascade) {
        if (!text || !text.trim()) return;
        const meta = (typeof VPMTierManager !== 'undefined')
            ? (VPMTierManager.getTierMeta(currentTier) || {})
            : (TIER_META[currentTier] || {});
        const nextTierId = (!cascade && typeof VPMTierManager !== 'undefined')
            ? VPMTierManager.getNextTierId(currentTier)
            : null;
        const msg = {
            id:           genId(),
            tier:         currentTier,
            reportsTo:    cascade ? null : (nextTierId ?? meta.reportsTo ?? null),
            cascade:      !!cascade,                 // broadcast flag
            text:         text.trim(),
            metric:       metric || 'general',
            severity:     severity || 'INFO',
            author:       (currentTier <= 3 ? 'T' + currentTier + ' ' : '') + (meta.role || 'Custom'),
            timestamp:    new Date().toISOString(),
            status:       cascade ? 'broadcast' : 'submitted',
            t2commentary: '',
            escalatedAt:  null,
            dismissedBy:  [],
            targetTab:    null,
            boardType:    cascade ? 'cascade' : null
        };
        messages.unshift(msg);
        saveMessages();
        renderInbox();
        return msg.id;
    }

    function escalateMessage(id, commentary, targetTier, targetTab) {
        const msg = messages.find(m => m.id === id);
        if (!msg) return;
        msg.status          = 'escalated';
        msg.escalatedAt     = new Date().toISOString();
        msg.escalatedToTier = targetTier || 3;
        msg.boardType       = 'escalation';
        msg.targetTab       = targetTab || metricToTab(msg.metric) || 'overview';
        // Append commentary with tier prefix
        const cmtText = (commentary || '').trim();
        if (cmtText) {
            const prefix = '[T' + currentTier + '] ';
            msg.t2commentary = msg.t2commentary
                ? msg.t2commentary + ' | ' + prefix + cmtText
                : prefix + cmtText;
        }
        saveMessages();
        renderInbox();
    }

    function acknowledgeMessage(id) {
        const msg = messages.find(m => m.id === id);
        if (!msg) return;
        msg.status = 'acknowledged';
        saveMessages();
        renderInbox();
    }

    function deleteMessage(id) {
        messages = messages.filter(m => m.id !== id);
        saveMessages();
        renderInbox();
    }

    /** Soft-delete: hide message for this tier only. */
    function dismissForTier(msgId, tierId) {
        const msg = messages.find(m => m.id === msgId);
        if (!msg) return;
        if (!Array.isArray(msg.dismissedBy)) msg.dismissedBy = [];
        if (!msg.dismissedBy.includes(tierId)) msg.dismissedBy.push(tierId);
        saveMessages();
        renderMessageBoards();
    }

    /** Escalate a message from an on-tab escalation board to the next tier. */
    function escalateBoardMessage(msgId, targetTab, commentary) {
        const msg = messages.find(m => m.id === msgId);
        if (!msg) return;
        const nextTierId = (typeof VPMTierManager !== 'undefined')
            ? VPMTierManager.getNextTierId(currentTier)
            : currentTier + 1;
        if (!nextTierId) return;
        // Track all tiers this message passed through
        if (!Array.isArray(msg.escalatedThrough)) msg.escalatedThrough = [];
        if (msg.escalatedToTier && !msg.escalatedThrough.includes(msg.escalatedToTier)) {
            msg.escalatedThrough.push(msg.escalatedToTier);
        }
        msg.escalatedToTier = nextTierId;
        msg.targetTab       = targetTab || 'overview';
        msg.status          = 'escalated';
        msg.boardType       = 'escalation';
        msg.escalatedAt     = new Date().toISOString();
        const cmtText = (commentary || '').trim();
        if (cmtText) {
            const prefix = '[T' + currentTier + '] ';
            msg.t2commentary = msg.t2commentary
                ? msg.t2commentary + ' | ' + prefix + cmtText
                : prefix + cmtText;
        }
        saveMessages();
        renderMessageBoards();
    }

    /** Acknowledge a message on the escalation board. */
    function acknowledgeBoardMessage(msgId) {
        const msg = messages.find(m => m.id === msgId);
        if (!msg) return;
        msg.status = 'acknowledged';
        saveMessages();
        renderMessageBoards();
    }

    // =========================================================
    // INBOX TOGGLE
    // =========================================================
    function setupInboxToggle() {
        const toggleBtn   = document.getElementById('inboxToggleBtn');
        const closeBtn    = document.getElementById('inboxCloseBtn');
        const clearAllBtn = document.getElementById('inboxClearAllBtn');
        if (toggleBtn)   toggleBtn.addEventListener('click', toggleInbox);
        if (closeBtn)    closeBtn.addEventListener('click', hideInbox);
        if (clearAllBtn) clearAllBtn.addEventListener('click', () => {
            let toRemove = [];
            if (typeof VPMTierManager !== 'undefined') {
                const childIds = VPMTierManager.getChildIds(currentTier);
                if (VPMTierManager.isBottom(currentTier)) {
                    toRemove = messages.filter(m => m.tier === currentTier).map(m => m.id);
                } else if (VPMTierManager.isTop(currentTier)) {
                    toRemove = messages.filter(m =>
                        m.escalatedToTier === currentTier || m.tier === currentTier
                    ).map(m => m.id);
                } else {
                    toRemove = messages.filter(m =>
                        m.tier === currentTier ||
                        m.reportsTo === currentTier ||
                        childIds.includes(m.tier) ||
                        (m.status === 'escalated' && m.escalatedToTier === currentTier)
                    ).map(m => m.id);
                }
            } else {
                if (currentTier === 1) {
                    toRemove = messages.filter(m => m.tier === 1).map(m => m.id);
                } else if (currentTier === 2) {
                    toRemove = messages.filter(m => m.tier === 2 || m.tier === 1 || m.reportsTo === 2).map(m => m.id);
                } else if (currentTier === 3) {
                    toRemove = messages.filter(m =>
                        (m.status === 'escalated' && (m.escalatedToTier === 3 || !m.escalatedToTier)) ||
                        m.tier === 3 || m.reportsTo === 3
                    ).map(m => m.id);
                } else if (currentTier === 4) {
                    toRemove = messages.filter(m => m.escalatedToTier === 4 || m.tier === 4).map(m => m.id);
                } else {
                    toRemove = messages.filter(m => m.tier === currentTier || m.reportsTo === currentTier).map(m => m.id);
                }
            }
            if (toRemove.length === 0) return;
            const confirmed = window.confirm('Clear ' + toRemove.length + ' message(s) from inbox? This cannot be undone.');
            if (!confirmed) return;
            messages = messages.filter(m => !toRemove.includes(m.id));
            saveMessages();
            renderInbox();
            showToast('Inbox cleared');
        });
    }

    function toggleInbox() { inboxVisible ? hideInbox() : showInbox(); }

    function showInbox() {
        inboxVisible = true;
        const panel = document.getElementById('escalationInbox');
        if (panel) panel.classList.add('open');
    }

    function hideInbox() {
        inboxVisible = false;
        const panel = document.getElementById('escalationInbox');
        if (panel) panel.classList.remove('open');
    }

    // =========================================================
    // INBOX RENDER
    // =========================================================
    function renderInbox() {
        updateBadge();
        const body = document.getElementById('inboxBody');
        if (!body) return;
        body.innerHTML = '';

        if (typeof VPMTierManager !== 'undefined') {
            const meta = VPMTierManager.getTierMeta(currentTier);
            if (!meta)                                    renderCustomTier(body);
            else if (VPMTierManager.isBottom(currentTier)) _renderBottomInbox(body);
            else if (VPMTierManager.isTop(currentTier))    _renderTopInbox(body);
            else                                           _renderMiddleInbox(body);
        } else {
            if      (currentTier === 1) renderT1(body);
            else if (currentTier === 2) renderT2(body);
            else if (currentTier === 3) renderT3(body);
            else if (currentTier === 4) renderT4(body);
            else                        renderCustomTier(body);
        }

        renderMessageBoards();
    }

    // =========================================================
    // MESSAGE BOARDS (inline per-tab "Escalation Messages" boxes)
    // =========================================================
    // Tab label shown in the write-form routing hint
    const METRIC_TAB_LABEL = {
        'safety':       'Safety',
        'people':       'People',   'headcount': 'People',  'sick': 'People',
        'quality':      'Quality',  'fpy': 'Quality',       'ncmr': 'Quality', 'hold': 'Quality',
        'oee':          'Production','production': 'Production', 'volume': 'Production', 'output': 'Production',
        'service':      'Supply Chain', 'dioh': 'Supply Chain', 'supply': 'Supply Chain', 'inventory': 'Supply Chain',
        'cost':         'Cost',     'idl': 'Cost',
        'maintenance':  'Maintenance',
    };
    function metricToTabName(metric) {
        const m = (metric || '').toLowerCase();
        for (const [key, tab] of Object.entries(METRIC_TAB_LABEL)) {
            if (m.includes(key)) return tab;
        }
        return 'Overview';   // catch-all for "general"
    }

    // Ordered most-specific first so 'service rate' beats 'rate' alone
    const METRIC_BOARD_MAP = [
        { keys: ['safety', 'observation', 'near miss', 'osha', 'incident', 'injury'],
                                                                 board: 'safety-messages' },
        { keys: ['people', 'headcount', 'sick', 'leave', 'turnover', 'vacancy', 'absence', 'hourly employee'],
                                                                 board: 'people-messages' },
        { keys: ['quality', 'fpy', 'pass yield', 'ncmr', 'hold', 'complaint', 'defect'],
                                                                 board: 'quality-messages' },
        { keys: ['oee', 'production', 'volume', 'daily output', 'output', 'availability', 'performance'],
                                                                 board: 'prod-messages' },
        { keys: ['service', 'supply', 'dioh', 'back order', 'inventory', 'row %', 'service rate', 'service level'],
                                                                 board: 'sc-messages' },
        { keys: ['cost', 'idl', 'eur', 'variance', 'waste', 'efficiency'],
                                                                 board: 'cost-messages' },
        { keys: ['maintenance', 'mtbf', 'downtime', 'machine availability'],
                                                                 board: 'maint-messages' },
    ];

    function metricToBoard(metric) {
        const m = (metric || '').toLowerCase();
        for (const entry of METRIC_BOARD_MAP) {
            if (entry.keys.some(k => m.includes(k))) return entry.board;
        }
        return 'general-messages';   // catch-all — no message silently dropped
    }

    // Map from old board IDs to tab IDs
    const BOARD_TO_TAB = {
        'safety-messages': 'safety', 'people-messages': 'people',
        'quality-messages': 'quality', 'prod-messages': 'production',
        'sc-messages': 'supplychain', 'cost-messages': 'cost',
        'maint-messages': 'maintenance', 'general-messages': 'overview'
    };

    /** Resolve a metric keyword to a tab ID (e.g., 'safety', 'overview'). */
    function metricToTab(metric) {
        const boardId = metricToBoard(metric);
        return BOARD_TO_TAB[boardId] || 'overview';
    }

    // Dual-board system: each tab has an escalation board + cascade board
    const TAB_BOARD_MAP = {
        overview:    { escalation: 'general-escalation-board',  cascade: 'general-cascade-board' },
        safety:      { escalation: 'safety-escalation-board',   cascade: 'safety-cascade-board' },
        people:      { escalation: 'people-escalation-board',   cascade: 'people-cascade-board' },
        quality:     { escalation: 'quality-escalation-board',  cascade: 'quality-cascade-board' },
        production:  { escalation: 'prod-escalation-board',     cascade: 'prod-cascade-board' },
        supplychain: { escalation: 'sc-escalation-board',       cascade: 'sc-cascade-board' },
        cost:        { escalation: 'cost-escalation-board',     cascade: 'cost-cascade-board' },
        maintenance: { escalation: 'maint-escalation-board',    cascade: 'maint-cascade-board' },
    };

    const TAB_LABELS = {
        overview: 'Overview', safety: 'Safety', people: 'People',
        quality: 'Quality', production: 'Production', supplychain: 'Supply Chain',
        cost: 'Cost', maintenance: 'Maintenance'
    };

    function renderMessageBoards() {
        const hasTM     = typeof VPMTierManager !== 'undefined';
        const isTopTier = hasTM ? VPMTierManager.isTop(currentTier) : currentTier === 4;
        const ancestorIds = hasTM ? VPMTierManager.getAncestorIds(currentTier) : [];
        const canEscUp  = !isTopTier;

        // Clear all dual boards
        document.querySelectorAll('.escalation-board, .cascade-board').forEach(b => { b.innerHTML = ''; });

        // --- Escalation board: messages escalated TO this tier ---
        const escalationMsgs = messages.filter(m =>
            m.boardType === 'escalation' &&
            (m.escalatedToTier === currentTier ||
             (Array.isArray(m.escalatedThrough) && m.escalatedThrough.includes(currentTier))) &&
            (m.status === 'escalated' || m.status === 'acknowledged') &&
            !(m.dismissedBy || []).includes(currentTier)
        );
        escalationMsgs.forEach(msg => {
            const tabId = msg.targetTab || 'overview';
            const mapping = TAB_BOARD_MAP[tabId];
            if (!mapping) return;
            const board = document.getElementById(mapping.escalation);
            if (!board) return;
            board.appendChild(buildEscalationBoardItem(msg, canEscUp));
        });

        // --- Cascade board: broadcasts from ancestors → Overview cascade board ---
        const cascadeMsgs = messages.filter(m =>
            (m.cascade || m.boardType === 'cascade') &&
            (ancestorIds.includes(m.tier) || (!hasTM && m.tier > currentTier)) &&
            !(m.dismissedBy || []).includes(currentTier)
        );
        const overviewCascade = document.getElementById(
            TAB_BOARD_MAP.overview ? TAB_BOARD_MAP.overview.cascade : null
        );
        if (overviewCascade) {
            cascadeMsgs.forEach(msg => {
                overviewCascade.appendChild(buildCascadeBoardItem(msg));
            });
        }

        // Empty-state for boards with no content
        document.querySelectorAll('.escalation-board, .cascade-board').forEach(b => {
            if (!b.children.length) {
                const empty = document.createElement('p');
                empty.className = 'board-empty';
                empty.textContent = 'No messages';
                b.appendChild(empty);
            }
        });

        // Scroll hints: fade + "↓ N more" counter
        _initBoardScrollHints();
    }

    function _initBoardScrollHints() {
        document.querySelectorAll('.escalation-board, .cascade-board').forEach(board => {
            const card = board.closest('.dual-board-card');
            if (!card) return;

            // Inject or find the counter badge in the header
            let badge = card.querySelector('.board-more-badge');
            if (!badge) {
                const hdr = card.querySelector('.chart-header');
                if (hdr) {
                    badge = document.createElement('span');
                    badge.className = 'board-more-badge hidden';
                    hdr.appendChild(badge);
                }
            }

            function _update() {
                const overflowing  = board.scrollHeight > board.clientHeight + 2;
                const atBottom     = board.scrollTop + board.clientHeight >= board.scrollHeight - 4;
                const msgEls       = board.querySelectorAll('.board-msg');

                card.classList.toggle('board-no-overflow', !overflowing);
                card.classList.toggle('board-at-bottom',   overflowing && atBottom);

                if (badge) {
                    if (overflowing && !atBottom && msgEls.length > 0) {
                        // Estimate how many messages are below the fold
                        let below = 0;
                        msgEls.forEach(m => {
                            if (m.offsetTop + m.offsetHeight > board.scrollTop + board.clientHeight + 4) below++;
                        });
                        badge.textContent = '\u2193 ' + below + ' more';
                        badge.classList.remove('hidden');
                    } else {
                        badge.classList.add('hidden');
                    }
                }
            }

            // Remove old listener to avoid stacking on re-render
            board._scrollHint && board.removeEventListener('scroll', board._scrollHint);
            board._scrollHint = _update;
            board.addEventListener('scroll', _update);
            // Run immediately after paint so clientHeight is accurate
            requestAnimationFrame(_update);
        });
    }

    /** Build an action item for the INBOX view (not the on-tab board). */
    function _buildInboxActionItem(msg) {
        const item = document.createElement('div');
        item.className = 'inbox-item inbox-item-action';

        let actionStatus = '';
        let actionDue = '';
        let assignee = msg.assignedTo || '';
        if (msg.actionItemId && typeof VPMActions !== 'undefined') {
            const act = VPMActions.getById(msg.actionItemId);
            if (act) {
                const isOverdue = act.status !== 'done' && new Date(act.dueDate) < new Date();
                actionStatus = isOverdue ? 'Overdue' : { 'new':'New','in-progress':'In Progress','blocked':'Blocked','done':'Done' }[act.status] || act.status;
                actionDue = act.dueDate || '';
                assignee = act.assignedTo || assignee;
            }
        }
        const statusCls = actionStatus === 'Done' ? 'status-done' : actionStatus === 'Overdue' ? 'status-overdue' : actionStatus === 'Blocked' ? 'status-blocked' : 'status-in-progress';

        item.innerHTML =
            '<div class="inbox-item-header">' +
                '<span class="board-action-tag">ACTION</span> ' +
                '<span class="inbox-item-metric">' + esc(msg.metric || 'General') + '</span> ' +
                (assignee ? '<span class="board-action-person">@' + esc(assignee) + '</span> ' : '') +
                '<span class="inbox-item-time">' + fmtTime(msg.timestamp) + '</span>' +
            '</div>' +
            '<div class="inbox-item-text">' + esc(msg.text) + '</div>' +
            '<div class="inbox-item-footer" style="margin-top:4px;font-size:11px">' +
                '<code>' + esc(msg.actionItemId || '') + '</code> ' +
                '<span class="status-badge ' + statusCls + '">' + (actionStatus || 'New') + '</span> ' +
                (actionDue ? 'Due: ' + actionDue + ' ' : '') +
                '<a href="#" class="board-action-view">View in Action Items</a>' +
            '</div>';

        const viewLink = item.querySelector('.board-action-view');
        if (viewLink) {
            viewLink.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof VPMActions !== 'undefined' && msg.actionItemId) {
                    VPMActions.navigateTo(msg.actionItemId);
                }
            });
        }

        return item;
    }

    /** Build an action-linked board item with status and View link. */
    function _buildActionBoardItem(msg) {
        const item = document.createElement('div');
        item.className = 'board-msg board-msg-action';

        // Get linked action item status
        let actionStatus = '?';
        let actionDue = '';
        if (msg.actionItemId && typeof VPMActions !== 'undefined') {
            const act = VPMActions.getById(msg.actionItemId);
            if (act) {
                const isOverdue = act.status !== 'done' && new Date(act.dueDate) < new Date();
                actionStatus = isOverdue ? 'Overdue' : { 'new':'New', 'in-progress':'In Progress', 'blocked':'Blocked', 'done':'Done' }[act.status] || act.status;
                actionDue = act.dueDate || '';
            }
        }

        const statusCls = actionStatus === 'Done' ? 'status-done' : actionStatus === 'Overdue' ? 'status-overdue' : 'status-in-progress';

        item.innerHTML =
            '<div class="board-msg-header">' +
                '<span class="board-action-tag">ACTION</span> ' +
                (msg.assignedTo ? '<span class="board-action-person">@' + esc(msg.assignedTo) + '</span> ' : '') +
                '<span class="board-msg-metric">' + esc(msg.metric) + '</span>' +
                '<span class="board-msg-time">' + fmtTime(msg.timestamp) + '</span>' +
                '<button class="board-msg-dismiss" title="Remove from board">&times;</button>' +
            '</div>' +
            '<div class="board-msg-text">' + esc(msg.text) + '</div>' +
            '<div class="board-action-status">' +
                'Action: <code>' + esc(msg.actionItemId || '') + '</code> ' +
                '<span class="status-badge ' + statusCls + '">' + actionStatus + '</span>' +
                (actionDue ? ' Due: ' + actionDue : '') +
                ' <a href="#" class="board-action-view">View</a>' +
            '</div>';

        item.querySelector('.board-msg-dismiss').addEventListener('click', () => {
            if (!msg.dismissedBy) msg.dismissedBy = [];
            msg.dismissedBy.push(currentTier);
            saveMessages();
            renderMessageBoards();
        });

        const viewLink = item.querySelector('.board-action-view');
        if (viewLink) {
            viewLink.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof VPMActions !== 'undefined' && msg.actionItemId) {
                    VPMActions.navigateTo(msg.actionItemId);
                }
            });
        }

        return item;
    }

    /** Build an escalation board item with Escalate Up / Acknowledge / X actions. */
    function buildEscalationBoardItem(msg, canEscalateUp) {
        const item = document.createElement('div');
        item.className = 'board-msg sev-border-' + (msg.severity || 'info').toLowerCase();
        item.dataset.msgId = msg.id;

        const timeStr = msg.escalatedAt ? fmtTime(msg.escalatedAt) : fmtTime(msg.timestamp);
        const nextTierId = (typeof VPMTierManager !== 'undefined')
            ? VPMTierManager.getNextTierId(currentTier) : null;

        // Tab dropdown for escalation target
        let tabDropdownHtml = '';
        if (canEscalateUp && nextTierId) {
            const tabOpts = Object.entries(TAB_BOARD_MAP).map(([tabId, _]) =>
                '<option value="' + tabId + '"' +
                (tabId === (msg.targetTab || 'overview') ? ' selected' : '') +
                '>' + (TAB_LABELS[tabId] || tabId) + '</option>'
            ).join('');
            tabDropdownHtml =
                '<select class="escalation-tab-select" title="Target tab on next tier">' +
                    tabOpts +
                '</select>';
        }

        const escalateBtnHtml = (canEscalateUp && nextTierId)
            ? '<button class="board-escalate-btn" title="Escalate to T' + nextTierId + '">' +
              'Escalate to T' + nextTierId + ' \u2191</button>'
            : '';

        // Build escalation trail: origin tier → current tier
        const originMeta = (typeof VPMTierManager !== 'undefined')
            ? VPMTierManager.getTierMeta(msg.tier) : null;
        const originLabel = originMeta ? originMeta.label : ('T' + msg.tier);
        // Show "via" if the message passed through intermediate tiers (visible in commentary)
        let viaHtml = '';
        if (msg.t2commentary) {
            const tierRefs = msg.t2commentary.match(/\[T\d+\]/g) || [];
            if (tierRefs.length > 0) {
                viaHtml = '<span class="board-via-label">via ' +
                    tierRefs.join(' \u2192 ') + '</span>';
            }
        }

        item.innerHTML =
            '<div class="board-msg-header">' +
                sevBadge(msg.severity) +
                '<span class="board-from-label">&#8593; T' + msg.tier + '</span>' +
                '<span class="inbox-metric">' + esc(msg.metric) + '</span>' +
                '<span class="board-msg-author">' + esc(msg.author) + '</span>' +
                viaHtml +
                '<span class="board-msg-time">' + timeStr + '</span>' +
                '<button class="board-dismiss-btn" title="Dismiss">\u00d7</button>' +
            '</div>' +
            '<div class="board-msg-text">' + esc(msg.text) + '</div>' +
            (msg.t2commentary
                ? '<div class="board-msg-commentary">' + esc(msg.t2commentary) + '</div>'
                : '') +
            (msg.escalatedToTier !== currentTier
                ? '<div class="board-action-row"><span class="board-forwarded-badge">Escalated to T' + msg.escalatedToTier + ' \u2191</span>' +
                  (msg.status === 'acknowledged' ? '<span class="board-ack-badge">Acknowledged</span>' : '') +
                  '</div>'
                : msg.status === 'acknowledged'
                    ? '<div class="board-action-row"><span class="board-ack-badge">Acknowledged</span></div>'
                    : '<div class="board-action-row">' +
                        tabDropdownHtml +
                        escalateBtnHtml +
                        '<button class="board-ack-btn">Acknowledge</button>' +
                      '</div>');

        // Wire actions
        item.querySelector('.board-dismiss-btn').addEventListener('click', () =>
            dismissForTier(msg.id, currentTier));
        const ackBtn = item.querySelector('.board-ack-btn');
        if (ackBtn) {
            ackBtn.addEventListener('click', () => acknowledgeBoardMessage(msg.id));
        }
        const escBtn = item.querySelector('.board-escalate-btn');
        if (escBtn) {
            escBtn.addEventListener('click', () => {
                const sel = item.querySelector('.escalation-tab-select');
                const targetTab = sel ? sel.value : 'overview';
                escalateBoardMessage(msg.id, targetTab, '');
            });
        }
        return item;
    }

    /** Build a cascade board item with X dismiss only. */
    function buildCascadeBoardItem(msg) {
        const item = document.createElement('div');
        item.className = 'board-msg broadcast-msg sev-border-' + (msg.severity || 'info').toLowerCase();
        item.dataset.msgId = msg.id;

        item.innerHTML =
            '<div class="board-msg-header">' +
                sevBadge(msg.severity) +
                '<span class="board-from-label">\u25bc T' + msg.tier + '</span>' +
                '<span class="inbox-metric">' + esc(msg.metric) + '</span>' +
                '<span class="board-broadcast-label">cascade</span>' +
                '<span class="board-msg-author">' + esc(msg.author) + '</span>' +
                '<span class="board-msg-time">' + fmtTime(msg.timestamp) + '</span>' +
                '<button class="board-dismiss-btn" title="Dismiss">\u00d7</button>' +
            '</div>' +
            '<div class="board-msg-text">' + esc(msg.text) + '</div>';

        item.querySelector('.board-dismiss-btn').addEventListener('click', () =>
            dismissForTier(msg.id, currentTier));
        return item;
    }

    function updateBadge() {
        const badge = document.getElementById('inboxBadge');
        if (!badge) return;
        let count = 0;

        if (typeof VPMTierManager !== 'undefined') {
            const ancestorIds = VPMTierManager.getAncestorIds(currentTier);
            const childIds    = VPMTierManager.getChildIds(currentTier);
            const isBtm       = VPMTierManager.isBottom(currentTier);
            const isTp         = VPMTierManager.isTop(currentTier);

            if (isBtm) {
                // Leaf: count broadcasts from ancestors
                count = messages.filter(m => m.cascade && ancestorIds.includes(m.tier)).length;
            } else if (isTp) {
                // Root: escalated to this tier
                count = messages.filter(m => m.escalatedToTier === currentTier).length;
            } else if (isBtm === false && childIds.length > 0) {
                // Middle: submitted from children + escalated to here + broadcasts from ancestors
                count = messages.filter(m =>
                    (m.status === 'submitted' && !m.cascade && (childIds.includes(m.tier) || m.reportsTo === currentTier)) ||
                    (m.status === 'escalated' && m.escalatedToTier === currentTier) ||
                    (m.cascade && ancestorIds.includes(m.tier))
                ).length;
            }
        } else {
            // Fallback: hardcoded
            if (currentTier === 1) {
                count = messages.filter(m => m.cascade && m.tier > 1).length;
            } else if (currentTier === 2) {
                count = messages.filter(m =>
                    (m.status === 'submitted' && !m.cascade && (m.tier === 1 || m.reportsTo === 2)) ||
                    (m.cascade && m.tier > 2)
                ).length;
            } else if (currentTier === 3) {
                count = messages.filter(m =>
                    (m.status === 'escalated' && (m.escalatedToTier === 3 || !m.escalatedToTier)) ||
                    (m.reportsTo === 3 && m.status === 'submitted')
                ).length;
            } else if (currentTier === 4) {
                count = messages.filter(m => m.escalatedToTier === 4).length;
            }
        }

        badge.textContent   = count > 0 ? count : '';
        badge.style.display = count > 0 ? 'flex' : 'none';
    }

    // =========================================================
    // GENERIC POSITION-BASED INBOX RENDERERS
    // Used when VPMTierManager is available; replace the T1/T2/T3/T4 renderers.
    // =========================================================

    /** Bottom tier (leaf node): submit up, no cascade down. */
    function _renderBottomInbox(body) {
        const ancestorIds = VPMTierManager.getAncestorIds(currentTier);

        const broadcasts = messages.filter(m => m.cascade && ancestorIds.includes(m.tier));
        if (broadcasts.length > 0) _renderBroadcastSection(body, broadcasts);

        body.appendChild(buildWriteForm({ canSubmitUp: true, canCascadeDown: false }));

        const mine = messages.filter(m => m.tier === currentTier && !m.cascade);
        const mineActions = mine.filter(m => m.boardType === 'action');
        const mineRegular = mine.filter(m => m.boardType !== 'action');
        if (mineRegular.length === 0 && mineActions.length === 0) {
            body.insertAdjacentHTML('beforeend', '<p class="inbox-empty">No messages submitted yet.</p>');
            return;
        }
        const nextTierId = VPMTierManager.getNextTierId(currentTier);

        // Show action-assigned items first
        if (mineActions.length > 0) {
            const hdr = document.createElement('div');
            hdr.className = 'inbox-section-title';
            hdr.textContent = 'ACTION ITEMS (' + mineActions.length + ')';
            body.appendChild(hdr);
            const list = document.createElement('div');
            list.className = 'inbox-list';
            mineActions.forEach(msg => list.appendChild(_buildInboxActionItem(msg)));
            body.appendChild(list);
        }

        const minePending = mineRegular.filter(m => m.status === 'submitted');
        const mineHandled = mineRegular.filter(m => m.status !== 'submitted');

        if (minePending.length > 0) {
            const hdr = document.createElement('div');
            hdr.className = 'inbox-section-title inbox-section-alert';
            hdr.textContent = 'Awaiting Approval (' + minePending.length + ')';
            body.appendChild(hdr);
            const list = document.createElement('div');
            list.className = 'inbox-list';
            minePending.forEach(msg => list.appendChild(buildCurationItem(msg, nextTierId)));
            body.appendChild(list);
        }
        if (mineHandled.length > 0) {
            const hdr2 = document.createElement('div');
            hdr2.className = 'inbox-section-title';
            hdr2.textContent = 'Handled (' + mineHandled.length + ')';
            body.appendChild(hdr2);
            const list2 = document.createElement('div');
            list2.className = 'inbox-list';
            mineHandled.forEach(msg => {
                const item = document.createElement('div');
                item.className = 'inbox-item inbox-item-handled sev-border-' + msg.severity.toLowerCase();
                item.innerHTML =
                    '<div class="inbox-item-header">' +
                        sevIcon(msg.severity) +
                        '<span class="inbox-metric">' + esc(msg.metric) + '</span>' +
                        '<span class="inbox-status-badge status-' + msg.status + '">' + statusLabel(msg.status, msg) + '</span>' +
                        '<button class="inbox-del" title="Delete">\u00d7</button>' +
                    '</div>' +
                    '<div class="inbox-text">' + esc(msg.text) + '</div>' +
                    '<div class="inbox-meta">' + fmtTime(msg.timestamp) + '</div>';
                item.querySelector('.inbox-del').addEventListener('click', () => deleteMessage(msg.id));
                list2.appendChild(item);
            });
            body.appendChild(list2);
        }
    }

    /** Middle tier: receives from children, can escalate up, can cascade down. */
    function _renderMiddleInbox(body) {
        const childIds    = VPMTierManager.getChildIds(currentTier);
        const descendantIds = VPMTierManager.getDescendantIds(currentTier);
        const nextTierId  = VPMTierManager.getParentId(currentTier);
        const ancestorIds = VPMTierManager.getAncestorIds(currentTier);
        const meta        = VPMTierManager.getTierMeta(currentTier) || {};

        const broadcasts = messages.filter(m => m.cascade && ancestorIds.includes(m.tier));
        if (broadcasts.length > 0) _renderBroadcastSection(body, broadcasts);

        // Children boards: check if they are leaf nodes (submitted) or middle nodes (escalated)
        const allChildDescIds = [...childIds, ...descendantIds];
        // Pending from children: submitted to us or escalated to us
        const pending = messages.filter(m =>
            !m.cascade && m.boardType !== 'escalation' &&
            ((m.status === 'submitted' && (childIds.includes(m.tier) || m.reportsTo === currentTier)) ||
             (m.status === 'escalated' && m.escalatedToTier === currentTier))
        );
        const handled = messages.filter(m =>
            !m.cascade && m.boardType !== 'escalation' &&
            m.status !== 'submitted' && m.status !== 'escalated' &&
            (childIds.includes(m.tier) || m.reportsTo === currentTier)
        );
        const directPending = messages.filter(m =>
            m.reportsTo === currentTier && m.status === 'submitted' &&
            !childIds.includes(m.tier)
        );
        const ownMsgs = messages.filter(m => m.tier === currentTier && !m.cascade);

        // Build label for child boards
        const childLabels = childIds.map(cid => {
            const cm = VPMTierManager.getTierMeta(cid);
            return cm ? cm.label : ('T' + cid);
        });
        const childLabel = childLabels.length <= 2 ? childLabels.join(' & ') : childLabels.length + ' boards';

        if (pending.length > 0) {
            const hdr = document.createElement('div');
            hdr.className = 'inbox-section-title inbox-section-alert';
            hdr.textContent = 'Pending from ' + esc(childLabel) + ' (' + pending.length + ')';
            body.appendChild(hdr);
            const list = document.createElement('div');
            list.className = 'inbox-list';
            pending.forEach(msg => list.appendChild(buildCurationItem(msg, nextTierId)));
            body.appendChild(list);
        }

        if (directPending.length > 0) {
            const hdrD = document.createElement('div');
            hdrD.className = 'inbox-section-title inbox-section-alert';
            hdrD.textContent = 'Direct from sub-tiers (' + directPending.length + ')';
            body.appendChild(hdrD);
            const listD = document.createElement('div');
            listD.className = 'inbox-list';
            directPending.forEach(msg => listD.appendChild(buildCurationItem(msg, nextTierId)));
            body.appendChild(listD);
        }

        body.appendChild(buildWriteForm({ canSubmitUp: true, canCascadeDown: true }));

        // Own messages: separate actions from regular, then split pending/handled
        const ownActions = ownMsgs.filter(m => m.boardType === 'action');
        const ownRegular = ownMsgs.filter(m => m.boardType !== 'action');

        if (ownActions.length > 0) {
            const hdrA = document.createElement('div');
            hdrA.className = 'inbox-section-title';
            hdrA.textContent = 'ACTION ITEMS (' + ownActions.length + ')';
            body.appendChild(hdrA);
            const listA = document.createElement('div');
            listA.className = 'inbox-list';
            ownActions.forEach(msg => listA.appendChild(_buildInboxActionItem(msg)));
            body.appendChild(listA);
        }

        const ownPending = ownRegular.filter(m => m.status === 'submitted');
        const ownHandled = ownRegular.filter(m => m.status !== 'submitted');

        if (ownPending.length > 0) {
            const hdr2 = document.createElement('div');
            hdr2.className = 'inbox-section-title inbox-section-alert';
            hdr2.textContent = 'Your ' + esc(meta.label || ('T' + currentTier)) +
                ' — Awaiting Approval (' + ownPending.length + ')';
            body.appendChild(hdr2);
            const list2 = document.createElement('div');
            list2.className = 'inbox-list';
            ownPending.forEach(msg => list2.appendChild(buildCurationItem(msg, nextTierId)));
            body.appendChild(list2);
        }

        if (ownHandled.length > 0) {
            const hdr2b = document.createElement('div');
            hdr2b.className = 'inbox-section-title';
            hdr2b.textContent = 'Your ' + esc(meta.label || ('T' + currentTier)) +
                ' — Handled (' + ownHandled.length + ')';
            body.appendChild(hdr2b);
            const list2b = document.createElement('div');
            list2b.className = 'inbox-list';
            ownHandled.forEach(msg => {
                const item = document.createElement('div');
                item.className = 'inbox-item inbox-item-handled sev-border-' + msg.severity.toLowerCase();
                item.innerHTML =
                    '<div class="inbox-item-header">' +
                        sevIcon(msg.severity) +
                        '<span class="inbox-metric">' + esc(msg.metric) + '</span>' +
                        '<span class="inbox-status-badge status-' + msg.status + '">' + statusLabel(msg.status, msg) + '</span>' +
                        '<button class="inbox-del" title="Delete">\u00d7</button>' +
                    '</div>' +
                    '<div class="inbox-text">' + esc(msg.text) + '</div>' +
                    (msg.t2commentary ? '<div class="inbox-commentary">' + esc(msg.t2commentary) + '</div>' : '') +
                    '<div class="inbox-meta">' + fmtTime(msg.timestamp) + '</div>';
                item.querySelector('.inbox-del').addEventListener('click', () => deleteMessage(msg.id));
                list2b.appendChild(item);
            });
            body.appendChild(list2b);
        }

        if (handled.length > 0) {
            const hdr3 = document.createElement('div');
            hdr3.className = 'inbox-section-title';
            hdr3.textContent = 'Handled Messages (' + handled.length + ')';
            body.appendChild(hdr3);
            const list3 = document.createElement('div');
            list3.className = 'inbox-list';
            handled.forEach(msg => {
                const item = document.createElement('div');
                item.className = 'inbox-item inbox-item-handled';
                item.innerHTML =
                    '<div class="inbox-item-header">' +
                        sevIcon(msg.severity) +
                        '<span class="inbox-metric">' + esc(msg.metric) + '</span>' +
                        '<span class="inbox-status-badge status-' + msg.status + '">' + statusLabel(msg.status, msg) + '</span>' +
                    '</div>' +
                    '<div class="inbox-text">' + esc(msg.text) + '</div>' +
                    (msg.t2commentary ? '<div class="inbox-commentary">' + esc(msg.t2commentary) + '</div>' : '') +
                    '<div class="inbox-meta">' + fmtTime(msg.timestamp) + '</div>';
                list3.appendChild(item);
            });
            body.appendChild(list3);
        }

        if (pending.length === 0 && directPending.length === 0 && ownMsgs.length === 0 &&
            broadcasts.length === 0 && handled.length === 0) {
            body.insertAdjacentHTML('beforeend', '<p class="inbox-empty">No messages yet.</p>');
        }
    }

    /** Top tier (root): cascade down only, receive escalated from below. */
    function _renderTopInbox(body) {

        body.appendChild(buildWriteForm({ canSubmitUp: false, canCascadeDown: true }));

        // Exclude boardType==='escalation' — those go to tab-level boards, not inbox
        const escalated     = messages.filter(m => m.escalatedToTier === currentTier && m.boardType !== 'escalation');
        const directPending = messages.filter(m => m.reportsTo === currentTier && m.status === 'submitted');

        if (directPending.length > 0) {
            const hdr = document.createElement('div');
            hdr.className = 'inbox-section-title inbox-section-alert';
            hdr.textContent = 'Direct from sub-tiers (' + directPending.length + ')';
            body.appendChild(hdr);
            const list = document.createElement('div');
            list.className = 'inbox-list';
            directPending.forEach(msg => list.appendChild(buildCurationItem(msg)));
            body.appendChild(list);
        }

        if (escalated.length === 0 && directPending.length === 0) {
            body.insertAdjacentHTML('beforeend', '<p class="inbox-empty">No messages escalated here yet.</p>');
            return;
        }

        if (escalated.length > 0) {
            const sevOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 };
            escalated.sort((a, b) =>
                (sevOrder[a.severity] - sevOrder[b.severity]) ||
                (new Date(b.escalatedAt) - new Date(a.escalatedAt)));

            const hdr = document.createElement('div');
            hdr.className = 'inbox-section-title';
            hdr.textContent = 'Escalated from ' + esc(prevTier ? prevTier.label : 'below') +
                ' (' + escalated.length + ')';
            body.appendChild(hdr);

            const list = document.createElement('div');
            list.className = 'inbox-list';
            escalated.forEach(msg => {
                const item = document.createElement('div');
                item.className = 'inbox-item inbox-item-t3 sev-border-' + msg.severity.toLowerCase();
                item.innerHTML =
                    '<div class="inbox-item-header">' +
                        sevIcon(msg.severity) +
                        '<span class="inbox-severity-label sev-' + msg.severity.toLowerCase() + '">' + msg.severity + '</span>' +
                        '<span class="inbox-metric">' + esc(msg.metric) + '</span>' +
                        '<span class="inbox-author">' + esc(msg.author) + '</span>' +
                    '</div>' +
                    '<div class="inbox-text">' + esc(msg.text) + '</div>' +
                    (msg.t2commentary ? '<div class="inbox-commentary"><strong>Note:</strong> ' + esc(msg.t2commentary) + '</div>' : '') +
                    '<div class="inbox-meta">Escalated ' + fmtTime(msg.escalatedAt) + '</div>';
                list.appendChild(item);
            });
            body.appendChild(list);
        }
    }

    // --- T1 view: write + own messages + broadcasts received from T2/T3 ---
    function renderT1(body) {
        // Broadcasts from higher tiers displayed first
        const broadcasts = messages.filter(m => m.cascade && m.tier > 1);
        if (broadcasts.length > 0) {
            _renderBroadcastSection(body, broadcasts);
        }

        // T1 is the bottom tier — can only submit UP, not cascade down
        body.appendChild(buildWriteForm({ canSubmitUp: true, canCascadeDown: false }));

        const mine = messages.filter(m => m.tier === 1 && !m.cascade);
        if (mine.length === 0) {
            body.insertAdjacentHTML('beforeend', '<p class="inbox-empty">No messages submitted yet.</p>');
            return;
        }

        const hdr = document.createElement('div');
        hdr.className = 'inbox-section-title';
        hdr.textContent = 'Your Submitted Messages (' + mine.length + ')';
        body.appendChild(hdr);

        const list = document.createElement('div');
        list.className = 'inbox-list';
        mine.forEach(msg => {
            const item = document.createElement('div');
            item.className = 'inbox-item sev-border-' + msg.severity.toLowerCase();
            item.innerHTML =
                '<div class="inbox-item-header">' +
                    sevIcon(msg.severity) +
                    '<span class="inbox-metric">' + esc(msg.metric) + '</span>' +
                    '<span class="inbox-status-badge status-' + msg.status + '">' + statusLabel(msg.status, msg) + '</span>' +
                    '<button class="inbox-del" title="Delete">\u00d7</button>' +
                '</div>' +
                '<div class="inbox-text">' + esc(msg.text) + '</div>' +
                (msg.t2commentary ? '<div class="inbox-commentary"><strong>T2 note:</strong> ' + esc(msg.t2commentary) + '</div>' : '') +
                '<div class="inbox-meta">' + fmtTime(msg.timestamp) + '</div>';
            item.querySelector('.inbox-del').addEventListener('click', () => deleteMessage(msg.id));
            list.appendChild(item);
        });
        body.appendChild(list);
    }

    // --- T2 view: broadcasts from T3 + curate T1 messages + write own ---
    function renderT2(body) {
        // Broadcasts sent down from T3
        const broadcasts = messages.filter(m => m.cascade && m.tier > 2);
        if (broadcasts.length > 0) {
            _renderBroadcastSection(body, broadcasts);
        }

        // Pending: T1 messages + messages from any custom tier that reports to T2
        const pending  = messages.filter(m =>
            m.status === 'submitted' && !m.cascade && (m.tier === 1 || m.reportsTo === 2)
        );
        const handled  = messages.filter(m =>
            m.status !== 'submitted' && !m.cascade && (m.tier === 1 || m.reportsTo === 2)
        );
        const ownMsgs  = messages.filter(m => m.tier === 2 && !m.cascade);

        if (pending.length > 0) {
            const hdr = document.createElement('div');
            hdr.className = 'inbox-section-title inbox-section-alert';
            hdr.textContent = 'Pending from T1 — select what to escalate (' + pending.length + ')';
            body.appendChild(hdr);
            const list = document.createElement('div');
            list.className = 'inbox-list';
            pending.forEach(msg => list.appendChild(buildCurationItem(msg)));
            body.appendChild(list);
        }

        body.appendChild(buildWriteForm());

        if (ownMsgs.length > 0) {
            const hdr2 = document.createElement('div');
            hdr2.className = 'inbox-section-title';
            hdr2.textContent = 'Your T2 Messages (' + ownMsgs.length + ')';
            body.appendChild(hdr2);
            const list2 = document.createElement('div');
            list2.className = 'inbox-list';
            ownMsgs.forEach(msg => {
                const item = document.createElement('div');
                item.className = 'inbox-item sev-border-' + msg.severity.toLowerCase();
                item.innerHTML =
                    '<div class="inbox-item-header">' +
                        sevIcon(msg.severity) +
                        '<span class="inbox-metric">' + esc(msg.metric) + '</span>' +
                        '<span class="inbox-status-badge status-' + msg.status + '">' + statusLabel(msg.status, msg) + '</span>' +
                        '<button class="inbox-del" title="Delete">\u00d7</button>' +
                    '</div>' +
                    '<div class="inbox-text">' + esc(msg.text) + '</div>' +
                    '<div class="inbox-meta">' + fmtTime(msg.timestamp) + '</div>';
                item.querySelector('.inbox-del').addEventListener('click', () => deleteMessage(msg.id));
                list2.appendChild(item);
            });
            body.appendChild(list2);
        }

        if (handled.length > 0) {
            const hdr3 = document.createElement('div');
            hdr3.className = 'inbox-section-title';
            hdr3.textContent = 'Handled T1 Messages (' + handled.length + ')';
            body.appendChild(hdr3);
            const list3 = document.createElement('div');
            list3.className = 'inbox-list';
            handled.forEach(msg => {
                const item = document.createElement('div');
                item.className = 'inbox-item inbox-item-handled';
                item.innerHTML =
                    '<div class="inbox-item-header">' +
                        sevIcon(msg.severity) +
                        '<span class="inbox-metric">' + esc(msg.metric) + '</span>' +
                        '<span class="inbox-status-badge status-' + msg.status + '">' + statusLabel(msg.status, msg) + '</span>' +
                        '<button class="inbox-del" title="Delete">\u00d7</button>' +
                    '</div>' +
                    '<div class="inbox-text">' + esc(msg.text) + '</div>' +
                    (msg.t2commentary ? '<div class="inbox-commentary">' + esc(msg.t2commentary) + '</div>' : '') +
                    '<div class="inbox-meta">' + fmtTime(msg.timestamp) + '</div>';
                item.querySelector('.inbox-del').addEventListener('click', () => deleteMessage(msg.id));
                list3.appendChild(item);
            });
            body.appendChild(list3);
        }

        if (pending.length === 0 && ownMsgs.length === 0 && handled.length === 0) {
            body.insertAdjacentHTML('beforeend', '<p class="inbox-empty">No messages yet.</p>');
        }
    }

    function buildCurationItem(msg, targetTier) {
        // Determine which tier to escalate to.
        let toTier;
        if (targetTier !== undefined) {
            toTier = targetTier;
        } else if (typeof VPMTierManager !== 'undefined') {
            toTier = VPMTierManager.getNextTierId(currentTier);
        } else {
            toTier = currentTier + 1;
        }

        const item = document.createElement('div');
        item.className = 'inbox-item inbox-item-curation sev-border-' + msg.severity.toLowerCase();

        // Severity dropdown
        let sevDropdownHtml = '';
        if (toTier !== null) {
            sevDropdownHtml =
                '<select class="inbox-sev-select">' +
                    '<option value="INFO"' + (msg.severity === 'INFO' ? ' selected' : '') + '>INFO</option>' +
                    '<option value="WARNING"' + (msg.severity === 'WARNING' ? ' selected' : '') + '>WARNING</option>' +
                    '<option value="CRITICAL"' + (msg.severity === 'CRITICAL' ? ' selected' : '') + '>CRITICAL</option>' +
                    '<option value="RECORD"' + (msg.severity === 'RECORD' ? ' selected' : '') + '>RECORD</option>' +
                '</select>';
        }

        // Tab target dropdown for escalation
        let tabDropdownHtml = '';
        if (toTier !== null) {
            const defaultTab = metricToTab(msg.metric);
            const tabOpts = Object.entries(TAB_BOARD_MAP).map(([tabId, _]) =>
                '<option value="' + tabId + '"' +
                (tabId === defaultTab ? ' selected' : '') +
                '>' + (TAB_LABELS[tabId] || tabId) + '</option>'
            ).join('');
            tabDropdownHtml =
                '<label class="inbox-tab-target-label">Target tab: ' +
                '<select class="escalation-tab-select">' + tabOpts + '</select></label>';
        }

        const escalateBtn = toTier !== null
            ? '<button class="inbox-btn btn-escalate">Escalate to T' + toTier + ' \u2191</button>'
            : '';

        item.innerHTML =
            '<div class="inbox-item-header">' +
                sevIcon(msg.severity) +
                '<span class="inbox-metric">' + esc(msg.metric) + '</span>' +
                sevDropdownHtml +
                '<span class="inbox-author">' + esc(msg.author) + '</span>' +
                '<span class="inbox-meta-inline">' + fmtTime(msg.timestamp) + '</span>' +
            '</div>' +
            '<div class="inbox-text">' + esc(msg.text) + '</div>' +
            (toTier !== null
                ? '<textarea class="inbox-commentary-input" placeholder="Add commentary before escalating (optional)..." rows="2"></textarea>'
                : '') +
            '<div class="inbox-curation-actions">' +
                tabDropdownHtml +
                escalateBtn +
                '<button class="inbox-btn btn-ack">Acknowledge only</button>' +
                '<button class="inbox-btn btn-assign-action">\u2713 Assign Action</button>' +
            '</div>';

        if (toTier !== null) {
            // Update severity when dropdown changes
            const sevSel = item.querySelector('.inbox-sev-select');
            if (sevSel) {
                sevSel.addEventListener('change', () => {
                    const m = messages.find(x => x.id === msg.id);
                    if (m) { m.severity = sevSel.value; saveMessages(); }
                    item.className = 'inbox-item inbox-item-curation sev-border-' + sevSel.value.toLowerCase();
                });
            }
            item.querySelector('.btn-escalate').addEventListener('click', () => {
                const commentary = item.querySelector('.inbox-commentary-input').value;
                const sel = item.querySelector('.escalation-tab-select');
                const targetTab = sel ? sel.value : 'overview';
                // Apply severity before escalating
                if (sevSel) {
                    const m = messages.find(x => x.id === msg.id);
                    if (m) m.severity = sevSel.value;
                }
                escalateMessage(msg.id, commentary, toTier, targetTab);
            });
        }
        item.querySelector('.btn-ack').addEventListener('click', () => acknowledgeMessage(msg.id));

        // Assign Action — inline form
        item.querySelector('.btn-assign-action').addEventListener('click', () => {
            const existing = item.querySelector('.inbox-action-inline');
            if (existing) { existing.remove(); return; } // toggle

            const people = typeof VPMActions !== 'undefined' ? VPMActions.getPeople() : [];
            const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
            const inlineForm = document.createElement('div');
            inlineForm.className = 'inbox-action-inline';
            inlineForm.innerHTML =
                '<div class="inbox-action-form-row" style="margin-top:6px">' +
                    '<input type="text" class="inbox-select ia-person" placeholder="Assign to..." list="ia-people-' + msg.id + '">' +
                    '<datalist id="ia-people-' + msg.id + '">' + people.map(p => '<option value="' + esc(p) + '">').join('') + '</datalist>' +
                    '<input type="date" class="inbox-select ia-due" value="' + nextWeek.toISOString().split('T')[0] + '">' +
                    '<button class="inbox-action-create-btn">Create</button>' +
                '</div>';
            item.appendChild(inlineForm);

            inlineForm.querySelector('.inbox-action-create-btn').addEventListener('click', () => {
                const person = inlineForm.querySelector('.ia-person').value.trim();
                const due    = inlineForm.querySelector('.ia-due').value;
                if (!person) { showToast('Select who to assign to', true); return; }

                if (typeof VPMActions !== 'undefined') {
                    const tierMeta = (typeof VPMTierManager !== 'undefined')
                        ? VPMTierManager.getTierMeta(msg.tier) : null;
                    const tierLabel = tierMeta ? tierMeta.label : ('T' + msg.tier);

                    VPMActions.add({
                        title:           msg.text.substring(0, 80),
                        description:     msg.text,
                        assignedTo:      person,
                        createdBy:       msg.author || '',
                        category:        msg.metric || 'General',
                        status:          'new',
                        priority:        msg.severity === 'CRITICAL' ? 'critical' : msg.severity === 'WARNING' ? 'high' : 'normal',
                        dueDate:         due,
                        sourceTier:      msg.tier,
                        sourceTierLabel: tierLabel,
                        sourceMetric:    msg.metric || 'General'
                    });

                    // Acknowledge the message since it's been actioned
                    acknowledgeMessage(msg.id);
                    showToast('Action assigned to ' + person);
                }
            });
        });

        return item;
    }

    // --- T3 view: middle tier — receives from T2, can escalate to T4, can cascade down ---
    function renderT3(body) {
        // Broadcasts from T4 shown first
        const broadcasts = messages.filter(m => m.cascade && m.tier > 3);
        if (broadcasts.length > 0) _renderBroadcastSection(body, broadcasts);

        // Pending: messages escalated to T3 by T2 (awaiting T3 review/escalate to T4)
        const pending = messages.filter(m =>
            m.status === 'escalated' && (m.escalatedToTier === 3 || !m.escalatedToTier)
        );
        // Custom tiers that report directly to T3
        const directPending = messages.filter(m => m.reportsTo === 3 && m.tier >= 10 && m.status === 'submitted');
        const ownMsgs = messages.filter(m => m.tier === 3 && !m.cascade);

        if (pending.length > 0 || directPending.length > 0) {
            const hdr = document.createElement('div');
            hdr.className = 'inbox-section-title inbox-section-alert';
            hdr.textContent = 'Escalated from T2 — pending (' + (pending.length + directPending.length) + ')';
            body.appendChild(hdr);
            const list = document.createElement('div');
            list.className = 'inbox-list';
            pending.forEach(msg => list.appendChild(buildCurationItem(msg, 4)));
            directPending.forEach(msg => list.appendChild(buildCurationItem(msg, 4)));
            body.appendChild(list);
        }

        // T3 can write its own messages (submit up to T4 or cascade down)
        body.appendChild(buildWriteForm({ canSubmitUp: true, canCascadeDown: true }));

        if (ownMsgs.length > 0) {
            const hdr2 = document.createElement('div');
            hdr2.className = 'inbox-section-title';
            hdr2.textContent = 'Your T3 Messages (' + ownMsgs.length + ')';
            body.appendChild(hdr2);
            const list2 = document.createElement('div');
            list2.className = 'inbox-list';
            ownMsgs.forEach(msg => {
                const item = document.createElement('div');
                item.className = 'inbox-item sev-border-' + msg.severity.toLowerCase();
                item.innerHTML =
                    '<div class="inbox-item-header">' +
                        sevIcon(msg.severity) +
                        '<span class="inbox-metric">' + esc(msg.metric) + '</span>' +
                        '<span class="inbox-status-badge status-' + msg.status + '">' + statusLabel(msg.status, msg) + '</span>' +
                        '<button class="inbox-del" title="Delete">\u00d7</button>' +
                    '</div>' +
                    '<div class="inbox-text">' + esc(msg.text) + '</div>' +
                    '<div class="inbox-meta">' + fmtTime(msg.timestamp) + '</div>';
                item.querySelector('.inbox-del').addEventListener('click', () => deleteMessage(msg.id));
                list2.appendChild(item);
            });
            body.appendChild(list2);
        }

        if (pending.length === 0 && directPending.length === 0 && ownMsgs.length === 0 && broadcasts.length === 0) {
            body.insertAdjacentHTML('beforeend', '<p class="inbox-empty">No messages yet.</p>');
            return;
        }

        // Keep old escalated section logic below for compat — replaced by pending block above
        const escalated = []; // consumed above

        if (escalated.length > 0) {
            // Sort by severity then time
            const sevOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 };
            escalated.sort((a, b) => (sevOrder[a.severity] - sevOrder[b.severity]) || (new Date(b.escalatedAt) - new Date(a.escalatedAt)));

            const hdr = document.createElement('div');
            hdr.className = 'inbox-section-title';
            hdr.textContent = 'Escalated from T2 (' + escalated.length + ')';
            body.appendChild(hdr);

            const list = document.createElement('div');
            list.className = 'inbox-list';
            escalated.forEach(msg => {
                const item = document.createElement('div');
                item.className = 'inbox-item inbox-item-t3 sev-border-' + msg.severity.toLowerCase();
                item.innerHTML =
                    '<div class="inbox-item-header">' +
                        sevIcon(msg.severity) +
                        '<span class="inbox-severity-label sev-' + msg.severity.toLowerCase() + '">' + msg.severity + '</span>' +
                        '<span class="inbox-metric">' + esc(msg.metric) + '</span>' +
                        '<span class="inbox-author">' + esc(msg.author) + '</span>' +
                    '</div>' +
                    '<div class="inbox-text">' + esc(msg.text) + '</div>' +
                    (msg.t2commentary ? '<div class="inbox-commentary"><strong>T2:</strong> ' + esc(msg.t2commentary) + '</div>' : '') +
                    '<div class="inbox-meta">Escalated ' + fmtTime(msg.escalatedAt) + '</div>';
                list.appendChild(item);
            });
            body.appendChild(list);
        }
    }

    // --- T4 view: top tier — receives escalated from T3, can cascade down only ---
    function renderT4(body) {
        // T4 is the top tier — no broadcasts from above; can only cascade DOWN
        body.appendChild(buildWriteForm({ canSubmitUp: false, canCascadeDown: true }));

        const escalated = messages.filter(m => m.escalatedToTier === 4);
        const directPending = messages.filter(m => m.reportsTo === 4 && m.status === 'submitted');

        if (directPending.length > 0) {
            const hdr = document.createElement('div');
            hdr.className = 'inbox-section-title inbox-section-alert';
            hdr.textContent = 'Direct from sub-tiers — pending (' + directPending.length + ')';
            body.appendChild(hdr);
            const list = document.createElement('div');
            list.className = 'inbox-list';
            directPending.forEach(msg => list.appendChild(buildCurationItem(msg)));
            body.appendChild(list);
        }

        if (escalated.length === 0 && directPending.length === 0) {
            body.insertAdjacentHTML('beforeend', '<p class="inbox-empty">No messages escalated from T3 yet.</p>');
            return;
        }

        if (escalated.length > 0) {
            const sevOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 };
            escalated.sort((a, b) => (sevOrder[a.severity] - sevOrder[b.severity]) || (new Date(b.escalatedAt) - new Date(a.escalatedAt)));

            const hdr = document.createElement('div');
            hdr.className = 'inbox-section-title';
            hdr.textContent = 'Escalated from T3 (' + escalated.length + ')';
            body.appendChild(hdr);

            const list = document.createElement('div');
            list.className = 'inbox-list';
            escalated.forEach(msg => {
                const item = document.createElement('div');
                item.className = 'inbox-item inbox-item-t3 sev-border-' + msg.severity.toLowerCase();
                item.innerHTML =
                    '<div class="inbox-item-header">' +
                        sevIcon(msg.severity) +
                        '<span class="inbox-severity-label sev-' + msg.severity.toLowerCase() + '">' + msg.severity + '</span>' +
                        '<span class="inbox-metric">' + esc(msg.metric) + '</span>' +
                        '<span class="inbox-author">' + esc(msg.author) + '</span>' +
                    '</div>' +
                    '<div class="inbox-text">' + esc(msg.text) + '</div>' +
                    (msg.t2commentary ? '<div class="inbox-commentary"><strong>T3:</strong> ' + esc(msg.t2commentary) + '</div>' : '') +
                    '<div class="inbox-meta">Escalated ' + fmtTime(msg.escalatedAt) + '</div>';
                list.appendChild(item);
            });
            body.appendChild(list);
        }
    }

    // --- Custom tier view: broadcasts + write + own messages + incoming ---
    function renderCustomTier(body) {
        const meta       = TIER_META[currentTier] || {};
        const reportsTo  = meta.reportsTo;
        const tierLabel  = meta.role || ('T' + currentTier);

        // Broadcasts from built-in tiers shown first
        const broadcasts = messages.filter(m => m.cascade && m.tier <= 3);
        if (broadcasts.length > 0) {
            _renderBroadcastSection(body, broadcasts);
        }

        // Hint about escalation routing
        if (reportsTo) {
            const routeMeta = TIER_META[reportsTo];
            const routeName = routeMeta ? (routeMeta.label || routeMeta.role || ('T' + reportsTo)) : ('T' + reportsTo);
            const hint = document.createElement('p');
            hint.className = 'inbox-route-hint';
            hint.innerHTML = 'Messages submitted here are routed to <strong>' + esc(routeName) + '</strong> inbox for review.';
            body.appendChild(hint);
        } else {
            const hint = document.createElement('p');
            hint.className = 'inbox-route-hint inbox-route-standalone';
            hint.textContent = 'Standalone board — messages are not escalated to any tier.';
            body.appendChild(hint);
        }

        // Determine which buttons to show based on routing config
        const hasReporters = messages.some(m => m.reportsTo === currentTier) ||
                             (typeof VPMBoards !== 'undefined' && VPMBoards.getBoardsReportingTo(currentTier).length > 0);
        body.appendChild(buildWriteForm({
            canSubmitUp:    !!reportsTo,   // can submit up only if this board reports to a parent tier
            canCascadeDown: hasReporters,  // can cascade only if sub-tiers report here
        }));

        // Incoming from tiers that report to this custom tier (if any sub-tiers exist)
        const incoming = messages.filter(m => m.reportsTo === currentTier && m.status === 'submitted');
        if (incoming.length > 0) {
            const hdr = document.createElement('div');
            hdr.className = 'inbox-section-title inbox-section-alert';
            hdr.textContent = 'Incoming from sub-tiers (' + incoming.length + ')';
            body.appendChild(hdr);
            const list = document.createElement('div');
            list.className = 'inbox-list';
            incoming.forEach(msg => list.appendChild(buildCurationItem(msg)));
            body.appendChild(list);
        }

        // Own submitted messages (exclude cascade broadcasts — they show in the broadcasts section)
        const mine = messages.filter(m => m.tier === currentTier && !m.cascade);
        if (mine.length > 0) {
            const hdr = document.createElement('div');
            hdr.className = 'inbox-section-title';
            hdr.textContent = tierLabel + ' — Your Messages (' + mine.length + ')';
            body.appendChild(hdr);
            const list = document.createElement('div');
            list.className = 'inbox-list';
            mine.forEach(msg => {
                const item = document.createElement('div');
                item.className = 'inbox-item sev-border-' + msg.severity.toLowerCase();
                item.innerHTML =
                    '<div class="inbox-item-header">' +
                        sevIcon(msg.severity) +
                        '<span class="inbox-metric">' + esc(msg.metric) + '</span>' +
                        '<span class="inbox-status-badge status-' + msg.status + '">' + statusLabel(msg.status, msg) + '</span>' +
                        '<button class="inbox-del" title="Delete">\u00d7</button>' +
                    '</div>' +
                    '<div class="inbox-text">' + esc(msg.text) + '</div>' +
                    (msg.t2commentary ? '<div class="inbox-commentary"><strong>Note:</strong> ' + esc(msg.t2commentary) + '</div>' : '') +
                    '<div class="inbox-meta">' + fmtTime(msg.timestamp) + '</div>';
                item.querySelector('.inbox-del').addEventListener('click', () => deleteMessage(msg.id));
                list.appendChild(item);
            });
            body.appendChild(list);
        }

        if (mine.length === 0 && incoming.length === 0) {
            body.insertAdjacentHTML('beforeend', '<p class="inbox-empty">No messages yet.</p>');
        }
    }

    // --- Broadcasts section helper (renders a collapsed "from above" strip) ---
    function _renderBroadcastSection(body, broadcasts) {
        const wrap = document.createElement('div');
        wrap.className = 'inbox-broadcast-section';

        const title = document.createElement('div');
        title.className = 'inbox-broadcast-section-title';
        title.textContent = '\u25bc Broadcasts from above (' + broadcasts.length + ')';
        wrap.appendChild(title);

        broadcasts.forEach(msg => {
            const item = document.createElement('div');
            item.className = 'inbox-broadcast-item';
            const tierMeta   = (typeof VPMTierManager !== 'undefined')
                ? (VPMTierManager.getTierMeta(msg.tier) || {})
                : (TIER_META[msg.tier] || {});
            const tierRole   = tierMeta.role || ('T' + msg.tier);
            item.innerHTML =
                '<div class="inbox-broadcast-item-header">' +
                    '<span class="inbox-broadcast-from">T' + msg.tier + ' ' + esc(tierRole) + '</span>' +
                    '<span class="inbox-broadcast-metric">' + esc(msg.metric) + '</span>' +
                    '<span class="inbox-broadcast-time">' + fmtTime(msg.timestamp) + '</span>' +
                '</div>' +
                '<div class="inbox-broadcast-text">' + esc(msg.text) + '</div>';
            wrap.appendChild(item);
        });

        body.appendChild(wrap);
    }

    // --- Write form ---
    // opts.canSubmitUp   (default true)  — show "Submit ↑ Up" button
    // opts.canCascadeDown (default true) — show "▼ Cascade Down" button
    function buildWriteForm(opts) {
        const canUp   = !opts || opts.canSubmitUp   !== false;
        const canDown = !opts || opts.canCascadeDown !== false;

        const wrap = document.createElement('div');
        wrap.className = 'inbox-write-form';

        const metricOptions =
            '<option value="general">General</option>' +
            '<option value="Safety">Safety</option>' +
            '<option value="People">People</option>' +
            '<option value="Quality">Quality</option>' +
            '<option value="Production">Production</option>' +
            '<option value="OEE">OEE</option>' +
            '<option value="Service Level">Service Level</option>' +
            '<option value="Supply Chain">Supply Chain</option>' +
            '<option value="Cost">Cost</option>' +
            '<option value="IDL">IDL</option>' +
            '<option value="DIOH">DIOH</option>' +
            '<option value="Maintenance">Maintenance</option>';

        // Route hint: only meaningful for upward submission
        const routeHintHtml = canUp
            ? '<div class="inbox-route-hint-inline" id="msgRouteHint">\u2192 appears on <strong>Overview</strong> tab of parent tier</div>'
            : '<div class="inbox-route-hint-inline inbox-route-hint-cascade">\u25bc broadcasts immediately to ALL tiers below this one</div>';

        // Button row — show only the applicable buttons
        let btnHtml = '<div class="inbox-submit-row">';
        if (canUp) {
            btnHtml += '<button class="inbox-submit-btn">Submit \u2191 Up</button>';
        }
        if (canDown) {
            btnHtml += '<button class="inbox-broadcast-btn" title="Broadcast to ALL tiers below — appears immediately on their boards">\u25bc Cascade Down to all tiers</button>';
        }
        btnHtml += '<button class="inbox-action-btn" title="Create an Action Item from this message">\u2713 Assign Action</button>';
        btnHtml += '</div>';
        // Action assignment inline form (hidden by default)
        const people = typeof VPMActions !== 'undefined' ? VPMActions.getPeople() : [];
        const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
        btnHtml += '<div class="inbox-action-form" style="display:none">' +
            '<div class="inbox-action-form-row">' +
                '<select class="inbox-select inbox-action-person">' +
                    '<option value="">Assign to...</option>' +
                    people.map(p => '<option>' + esc(p) + '</option>').join('') +
                '</select>' +
                '<select class="inbox-select inbox-action-createdby">' +
                    '<option value="">Raised by...</option>' +
                    people.map(p => '<option>' + esc(p) + '</option>').join('') +
                '</select>' +
                '<input type="date" class="inbox-select inbox-action-due" value="' + nextWeek.toISOString().split('T')[0] + '">' +
                '<button class="inbox-action-create-btn">Create Action</button>' +
            '</div>' +
        '</div>';

        wrap.innerHTML =
            '<div class="inbox-write-title">+ New Message</div>' +
            '<div class="inbox-write-row">' +
                '<select class="inbox-select" id="newMsgMetric">' + metricOptions + '</select>' +
                '<select class="inbox-select" id="newMsgSeverity">' +
                    '<option value="INFO">INFO</option>' +
                    '<option value="WARNING">WARNING</option>' +
                    '<option value="CRITICAL">CRITICAL</option>' +
                    '<option value="RECORD">RECORD</option>' +
                '</select>' +
            '</div>' +
            routeHintHtml +
            '<textarea class="inbox-textarea" id="newMsgText" placeholder="Describe the situation, risk, or action needed..." rows="3"></textarea>' +
            btnHtml;

        // Live routing hint update (only for upward submissions)
        if (canUp) {
            const metricSel = wrap.querySelector('#newMsgMetric');
            const routeHint = wrap.querySelector('#msgRouteHint');
            metricSel.addEventListener('change', () => {
                const tab = metricToTabName(metricSel.value);
                routeHint.innerHTML = '\u2192 appears on <strong>' + tab + '</strong> tab of parent tier';
            });
        }

        const _doSubmit = (cascade) => {
            const text     = wrap.querySelector('#newMsgText').value;
            const metric   = wrap.querySelector('#newMsgMetric').value;
            const severity = wrap.querySelector('#newMsgSeverity').value;
            if (!text.trim()) return;
            addMessage(text, metric, severity, cascade);
            wrap.querySelector('#newMsgText').value = '';
            showToast(cascade ? 'Broadcast sent to all tiers below' : 'Message submitted \u2191');
        };

        if (canUp)   wrap.querySelector('.inbox-submit-btn')    .addEventListener('click', () => _doSubmit(false));
        if (canDown) wrap.querySelector('.inbox-broadcast-btn') .addEventListener('click', () => _doSubmit(true));

        // Assign Action toggle + create
        const actionBtn  = wrap.querySelector('.inbox-action-btn');
        const actionForm = wrap.querySelector('.inbox-action-form');
        if (actionBtn && actionForm) {
            actionBtn.addEventListener('click', () => {
                actionForm.style.display = actionForm.style.display === 'none' ? '' : 'none';
            });
            const createBtn = wrap.querySelector('.inbox-action-create-btn');
            if (createBtn) {
                createBtn.addEventListener('click', () => {
                    const text     = wrap.querySelector('#newMsgText').value.trim();
                    const metric   = wrap.querySelector('#newMsgMetric').value;
                    const severity = wrap.querySelector('#newMsgSeverity').value;
                    const person   = actionForm.querySelector('.inbox-action-person').value;
                    const raisedBy = actionForm.querySelector('.inbox-action-createdby').value;
                    const due      = actionForm.querySelector('.inbox-action-due').value;

                    if (!text)   { showToast('Enter a message first', true); return; }
                    if (!person) { showToast('Select who to assign to', true); return; }

                    // Create the action item
                    if (typeof VPMActions !== 'undefined') {
                        const tierMeta = (typeof VPMTierManager !== 'undefined')
                            ? VPMTierManager.getTierMeta(currentTier) : null;
                        const tierLabel = tierMeta ? tierMeta.label : ('T' + currentTier);

                        const actionItem = VPMActions.add({
                            title:           text.substring(0, 80),
                            description:     text,
                            assignedTo:      person,
                            createdBy:       raisedBy || '',
                            category:        metric || 'General',
                            status:          'new',
                            priority:        severity === 'CRITICAL' ? 'critical' : severity === 'WARNING' ? 'high' : 'normal',
                            dueDate:         due,
                            sourceMessageId: null,
                            sourceTier:      currentTier,
                            sourceTierLabel: tierLabel,
                            sourceMetric:    metric || 'General'
                        });

                        wrap.querySelector('#newMsgText').value = '';
                        actionForm.style.display = 'none';
                        showToast('Action ' + actionItem.id + ' assigned to ' + person);
                    }
                });
            }
        }

        return wrap;
    }

    // =========================================================
    // HELPERS
    // =========================================================
    // Human-readable status labels (avoids confusing raw internal status names)
    function statusLabel(status, msg) {
        // Action items get their own label regardless of status
        if (msg && msg.boardType === 'action') {
            if (msg.actionItemId && typeof VPMActions !== 'undefined') {
                const act = VPMActions.getById(msg.actionItemId);
                if (act) {
                    const isOverdue = act.status !== 'done' && new Date(act.dueDate) < new Date();
                    const actStatus = isOverdue ? 'overdue' : act.status;
                    const labels = { 'new':'Action: New', 'in-progress':'Action: In Progress', 'blocked':'Action: Blocked', 'done':'Action: Done', 'overdue':'Action: Overdue' };
                    return labels[actStatus] || 'Action';
                }
            }
            return 'Action \u2713';
        }
        switch (status) {
            case 'submitted':    return 'pending';
            case 'escalated':
                const toTier = (msg && msg.escalatedToTier) ? msg.escalatedToTier : '?';
                return 'sent to T' + toTier + ' \u2191';
            case 'acknowledged':
                if (msg && msg.escalatedToTier) {
                    return 'acknowledged at T' + msg.escalatedToTier + ' \u2713';
                }
                return 'acknowledged \u2713';
            case 'broadcast':    return 'broadcast \u25bc';
            default:             return status;
        }
    }

    // Small icon used in inbox list items
    function sevIcon(s) {
        if (s === 'CRITICAL') return '<span class="sev-icon sev-critical">\u25cf</span>';
        if (s === 'WARNING')  return '<span class="sev-icon sev-warning">\u25b2</span>';
        if (s === 'RECORD')   return '<span class="sev-icon" style="color:#16a34a">\u2605</span>';
        return '<span class="sev-icon sev-info">\u24d8</span>';
    }

    // Prominent labeled badge used on tab board cards — must be readable at a glance
    function sevBadge(s) {
        if (s === 'CRITICAL') return '<span class="sev-badge sev-badge-critical">\u26a0 CRITICAL</span>';
        if (s === 'WARNING')  return '<span class="sev-badge sev-badge-warning">\u25b2 WARNING</span>';
        if (s === 'RECORD')   return '<span class="sev-badge sev-badge-record">\u2605 RECORD</span>';
        return '<span class="sev-badge sev-badge-info">\u24d8 INFO</span>';
    }

    function fmtTime(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
               ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function esc(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function hexToRgba(hex, alpha) {
        const n = parseInt(hex.replace('#', ''), 16);
        return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 0xff) + ',' + (n & 0xff) + ',' + alpha + ')';
    }

    // =========================================================
    // TOAST
    // =========================================================
    function showToast(msg, isError) {
        let el = document.getElementById('escalationToast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'escalationToast';
            el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(16px);background:#22c55e;color:#fff;font-size:13px;font-weight:600;padding:8px 18px;border-radius:6px;z-index:9999;opacity:0;transition:opacity 0.2s,transform 0.2s;pointer-events:none;font-family:inherit;';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.style.background = isError ? '#ef4444' : '#22c55e';
        el.style.opacity = '1';
        el.style.transform = 'translateX(-50%) translateY(0)';
        clearTimeout(el._t);
        el._t = setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translateX(-50%) translateY(16px)';
        }, 2500);
    }

    // =========================================================
    // PUBLIC API
    // =========================================================
    return {
        init,
        switchTier,
        rebuildTierSwitcher,
        getCurrentTier: () => currentTier,
        addMessage: function(text, metric, severity) {
            const msgId = addMessage(text, metric, severity);
            showToast('Message submitted');
            return msgId;
        },
        getMessageStatus: function(msgId) {
            if (!msgId) return null;
            const msg = messages.find(m => m.id === msgId);
            if (!msg) return null;
            return {
                status: msg.boardType === 'action' ? 'action' : msg.status,
                escalatedToTier: msg.escalatedToTier,
                boardType: msg.boardType,
                actionItemId: msg.actionItemId,
                label: statusLabel(msg.status, msg)
            };
        },
        renderInbox,
        renderMessageBoards,
        showToast,

        /**
         * Register a custom tier so applyTier / switchTier work for it.
         * Call this BEFORE switchTier for any tier number not in built-in 1/2/3.
         * tierNum  — integer ≥ 10 (avoids clash with built-in 1/2/3)
         * name     — display name shown in header label (e.g. "T0 — Planning")
         * accent   — hex colour (optional, defaults to indigo)
         */
        // Returns submitted (unreviewed) messages that came FROM a specific tier
        getSubtierMessages: (fromTierNum) =>
            messages.filter(m => m.tier === fromTierNum && m.status === 'submitted'),

        /** Return all messages (own + external) — used by SharedStore for publishing own messages */
        getMessages: () => messages.slice(),

        /**
         * Merge messages received from another tier into the local messages array.
         * Messages are flagged _external:true so they don't get re-published.
         * Silently ignored if the message ID already exists locally.
         */
        mergeExternalMessages(incomingMsgs, sourceTier) {
            if (!Array.isArray(incomingMsgs) || incomingMsgs.length === 0) return;
            let changed = false;
            incomingMsgs.forEach(msg => {
                if (!messages.find(m => m.id === msg.id)) {
                    messages.unshift(Object.assign({}, msg, { _external: true, _sourceTier: sourceTier }));
                    changed = true;
                }
            });
            if (changed) {
                saveMessages();
                renderInbox();
            }
        },

        registerTier(tierNum, name, accent, reportsTo) {
            const col  = accent || '#6366f1';
            TIER_META[tierNum] = {
                accent:      col,
                accentHover: col,
                label:       '',    // blank — name already shows on the tier button; avoids duplicate in #tierLabel
                role:        name || 'Custom',
                reportsTo:   reportsTo ?? null,   // null = standalone
            };
            // Custom tiers get full tab access (same as T1)
            TIER_TABS[tierNum] = [...TIER_TABS[1]];
        },
    };
})();
