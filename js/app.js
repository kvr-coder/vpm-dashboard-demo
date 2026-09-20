/**
 * VPM Dashboard - Main Application Controller
 */
(function () {
    'use strict';

    let currentData = null;
    let currentTab = 'overview';

    // ========================================
    // INITIALIZATION
    // ========================================

    async function init() {
        // State sync FIRST — fetch state file and populate localStorage
        // before any module reads from it
        if (typeof VPMStateSync !== 'undefined') await VPMStateSync.init();
        if (typeof VPMBoardLock !== 'undefined') VPMBoardLock.init();

        VPMCharts.applyDefaults();
        if (typeof VPMTierManager !== 'undefined') VPMTierManager.init();
        if (typeof VPMTabManager  !== 'undefined') VPMTabManager.init();
        setupTabNavigation();
        setupSidebar();
        setupPeriodSelectors();
        setupThemeToggle();

        setupZoomControls();
        VPMActions.init();
        VPMDataStore.init();
        VPMAdmin.init();
        VPMEscalation.init();
        // VPMSharedStore disabled — cross-tier live data not needed yet
        // if (typeof VPMSharedStore !== 'undefined') VPMSharedStore.init();
        setupSaveLayoutBtn();
        if (typeof VPMBoards !== 'undefined') VPMBoards.init();
        if (typeof VPMChartVisibility !== 'undefined') VPMChartVisibility.init();

        // Restore file system folder handle (Chrome/Edge File System Access API)
        if (typeof VPMFileStore !== 'undefined') {
            VPMFileStore.restoreFolder().then(async (ok) => {
                if (ok) {
                    console.log('[VPMFileStore] Folder restored:', VPMFileStore.folderName());
                    _onFolderConnected();
                } else {
                    const hasHandle = await VPMFileStore.hasStoredHandle();
                    const dataLoaded = typeof VPMStateSync !== 'undefined' && VPMStateSync.hasStateFile();
                    _updateFolderIndicator(false);
                    if (hasHandle || dataLoaded) {
                        // Data already loaded via fetch OR returning user — non-blocking banner
                        _showReconnectBanner();
                    } else {
                        // True first time, no state file — blocking modal
                        _showFolderSetupModal();
                    }
                }
            });
        }

        if (typeof VPMPeriodStore !== 'undefined') setupPeriodStore();

        // Flush state to file on page close
        window.addEventListener('beforeunload', () => {
            if (typeof VPMStateSync !== 'undefined') VPMStateSync.flush();
        });

        // Re-init modules if state was imported from file on a new browser
        document.addEventListener('vpm:stateImported', () => {
            // Prevent infinite reload: only reload once per session
            if (sessionStorage.getItem('vpm-state-reloaded')) return;
            sessionStorage.setItem('vpm-state-reloaded', '1');
            console.log('[App] State imported from file — full reload to apply all data...');
            window.location.reload();
        });

        // Re-render when admin appends / updates metrics
        document.addEventListener('vpm:requestRender', () => {
            // Refresh currentData from the live store so edits are reflected
            if (typeof VPMDataStore !== 'undefined') {
                const fresh = VPMDataStore.getData();
                if (fresh) currentData = fresh;
            }
            renderCurrentTab();
            // Ensure new tier also gets today's daily snapshot
            _autoSaveDailySnapshot();
        });

        // Re-apply KPI metric selections when user changes picker in configure panel
        document.addEventListener('vpm:applyKpiMetrics', () => {
            if (currentTab === 'overview' && currentData && typeof VPMLayout !== 'undefined') {
                VPMLayout.applyKpiMetricSelections(currentData);
            }
        });

        // Refresh sub-tier reporting strip whenever a message is submitted/escalated
        document.addEventListener('vpm:messagesUpdated', () => {
            if (currentTab === 'overview') renderSubtierStatus();
        });

        // Check for a snapshot restore triggered by the History panel load button
        if (typeof VPMPeriodStore !== 'undefined' && typeof VPMPeriodStore.consumePendingRestore === 'function') {
            const restore = VPMPeriodStore.consumePendingRestore();
            if (restore) {
                currentData = restore.data;
                updateDataStatus(true, restore.label, true);
                renderCurrentTab();
                return; // skip default data load — snapshot state is fully in place
            }
        }

        // All chart data lives in localStorage custom charts — no default data loading needed

        // Re-render on page focus — ensures linked charts pick up data changes
        // from other tiers (same-browser: instant via localStorage read)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') renderCurrentTab();
        });

        // Always render — custom charts live in localStorage and don't need Excel data
        renderCurrentTab();

        // Auto daily snapshot on open
        _autoSaveDailySnapshot();

        // Save snapshot on page close/refresh so we always capture the last state
        window.addEventListener('beforeunload', () => {
            if (currentData) _autoSaveDailySnapshot();
        });

        // Feedback tab: prominent "Save Today's Snapshot" button
        const fbSnapBtn = document.getElementById('feedbackSaveSnapshotBtn');
        if (fbSnapBtn) {
            fbSnapBtn.addEventListener('click', () => {
                _autoSaveDailySnapshot();
                fbSnapBtn.textContent = 'Snapshot Saved!';
                fbSnapBtn.disabled = true;
                setTimeout(() => {
                    fbSnapBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 2h8l3 3v8H2V2z" stroke="currentColor" stroke-width="1.4"/><path d="M5 2v4h5V2M5 13v-4h5v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg> Save Today's Snapshot`;
                    fbSnapBtn.disabled = false;
                }, 2000);
            });
        }
    }

    function _autoSaveDailySnapshot() {
        if (typeof VPMDailySnapshots === 'undefined') return;
        const tierId = getCurrentTierId();
        const meta   = VPMTierManager.getTierMeta(tierId);
        // Always append — key includes timestamp so multiple teams never overwrite each other
        VPMDailySnapshots.save(tierId, meta?.label || 'T' + tierId, currentData)
            .catch(e => console.warn('[DailySnap] auto-save failed:', e));
    }

    // ========================================
    // TAB NAVIGATION
    // ========================================

    function setupTabNavigation() {
        // Event delegation handles both static and dynamically added nav items
        const navList = document.getElementById('navTabs');
        if (navList) {
            navList.addEventListener('click', (e) => {
                const item = e.target.closest('.nav-item[data-tab]');
                if (item) switchTab(item.dataset.tab);
            });
        }
        // Expose switchTab so tab-manager and other modules can call it
        window._vpmSwitchTab = switchTab;
    }

    function switchTab(tab) {
        currentTab = tab;

        // Update nav (built-in tabs; board items have no data-tab so they deactivate automatically)
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.tab === tab);
        });

        // Update panels (board panel deactivates since its id !== 'panel-' + tab)
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === 'panel-' + tab);
        });

        // Update title — check VPMTabManager for all tabs (includes custom)
        let title = tab;
        if (typeof VPMTabManager !== 'undefined') {
            const def = VPMTabManager.getTabs().find(t => t.id === tab);
            if (def) title = def.label;
        }
        document.getElementById('pageTitle').textContent = title;

        // Render charts for active tab
        renderCurrentTab();

        // Refresh inline escalation boards for the newly visible tab
        if (typeof VPMEscalation !== 'undefined') VPMEscalation.renderMessageBoards();

        // Re-attach day-pickers to any new chart cards and apply visibility
        if (typeof VPMChartVisibility !== 'undefined') {
            setTimeout(() => VPMChartVisibility.attachAll(), 150);
        }
    }

    function renderCurrentTab() {
        // All tabs now render from localStorage-backed custom charts.
        // currentData is only used for overview KPI sparklines and is optional.

        const month = parseInt(document.getElementById('monthSelect').value);
        const year = parseInt(document.getElementById('yearSelect').value);

        // Tab-specific non-chart rendering (localStorage-based modules)
        switch (currentTab) {
            case 'overview':
                if (typeof VPMCharts !== 'undefined') VPMCharts.renderOverview(currentData);
                renderSubtierStatus();
                break;
            case 'ci':
                if (typeof VPMIdeasTracker !== 'undefined') VPMIdeasTracker.render(getCurrentTierId());
                break;
            case 'recognitions':
                if (typeof VPMRecognitions !== 'undefined') { VPMRecognitions.render(getCurrentTierId()); _renderRecogStats(); }
                break;
            case 'actions':
                VPMActions.render(); VPMActions.renderStats();
                break;
            case 'feedback':
                if (typeof VPMFeedback !== 'undefined') VPMFeedback.render(getCurrentTierId());
                break;
        }

        // Render any custom charts saved for this tab
        if (currentTab !== 'actions') {
            VPMAdmin.renderCustomChartsForTab(currentTab);
        }

        // Apply drag-and-drop layout grid to the current tab panel
        if (currentTab !== 'actions' && typeof VPMLayout !== 'undefined') {
            VPMLayout.initTab('panel-' + currentTab);
            // KPI grid only exists on the overview tab
            if (currentTab === 'overview') {
                VPMLayout.buildKpiCards();
                VPMLayout.initKpiGrid('kpiGridMain');
                // Apply any saved metric selections to KPI cards
                VPMLayout.applyKpiMetricSelections(currentData);
            }
        }
    }

    // ========================================
    // RECOGNITIONS STATS BAR
    // ========================================
    function _renderRecogStats() {
        const bar = document.getElementById('recog-stats');
        if (!bar || typeof VPMRecognitions === 'undefined') return;
        const entries = VPMRecognitions.load();
        const total = entries.length;
        const thisMonth = entries.filter(e => {
            if (!e.date) return false;
            const d = new Date(e.date);
            return d.getFullYear() === new Date().getFullYear() && d.getMonth() === new Date().getMonth();
        }).length;
        const beliefs = {};
        entries.forEach(e => { if (e.culturalBelief) beliefs[e.culturalBelief] = (beliefs[e.culturalBelief] || 0) + 1; });
        const topBelief = Object.entries(beliefs).sort((a,b) => b[1]-a[1])[0];
        bar.innerHTML = `
            <div class="recog-stat-chip"><span class="recog-stat-num">${total}</span><span class="recog-stat-lbl">Total</span></div>
            <div class="recog-stat-chip"><span class="recog-stat-num">${thisMonth}</span><span class="recog-stat-lbl">This Month</span></div>
            ${topBelief ? `<div class="recog-stat-chip"><span class="recog-stat-num" style="font-size:11px">${topBelief[0]}</span><span class="recog-stat-lbl">Top Belief</span></div>` : ''}`;
    }

    // ========================================
    // SUB-TIER REPORTING BOARD SUMMARY
    // Renders "Reporting Boards" strip on Overview when custom boards escalate to this tier
    // ========================================
    function renderSubtierStatus() {
        const section   = document.getElementById('subtierStatusSection');
        const container = document.getElementById('subtierCards');
        const genRow    = document.getElementById('generalMsgRow');
        if (!section || !container) return;

        // Show/hide the general-messages row based on whether boards have content
        if (genRow) {
            const escBoard = document.getElementById('general-escalation-board');
            const casBoard = document.getElementById('general-cascade-board');
            const hasEsc = escBoard && escBoard.querySelector('.board-msg');
            const hasCas = casBoard && casBoard.querySelector('.board-msg');
            genRow.style.display = (hasEsc || hasCas) ? '' : 'none';
        }

        if (typeof VPMBoards === 'undefined' || typeof VPMEscalation === 'undefined') {
            section.style.display = 'none';
            return;
        }

        const tier      = VPMEscalation.getCurrentTier();
        const reporters = VPMBoards.getBoardsReportingTo(tier);

        if (!reporters.length) {
            section.style.display = 'none';
            return;
        }

        section.style.display = '';
        container.innerHTML   = '';

        const SEV_ORDER = { CRITICAL: 2, WARNING: 1, INFO: 0, RECORD: 0 };

        reporters.forEach(board => {
            const pending  = VPMEscalation.getSubtierMessages(board.tierNum);
            const maxSev   = pending.reduce((top, m) =>
                (SEV_ORDER[m.severity] || 0) > (SEV_ORDER[top] || 0) ? m.severity : top, 'INFO');
            const lastMsg  = pending[0] || null;
            const accent   = board.tierAccent || '#6366f1';
            const hasPend  = pending.length > 0;

            const card = document.createElement('div');
            card.className = 'subtier-card' + (hasPend ? ' subtier-has-pending' : '');
            card.style.setProperty('--board-accent', accent);

            const badgeHtml = hasPend
                ? `<span class="subtier-pending-badge sev-bg-${maxSev.toLowerCase()}">${pending.length} pending</span>`
                : `<span class="subtier-ok-badge">All clear</span>`;

            const msgHtml = lastMsg
                ? `<div class="subtier-last-msg">
                       <span class="subtier-sev-dot sev-dot-${maxSev.toLowerCase()}"></span>
                       ${lastMsg.text.length > 90 ? lastMsg.text.substring(0, 90) + '…' : lastMsg.text}
                   </div>`
                : `<div class="subtier-no-msg">No pending messages</div>`;

            card.innerHTML = `
                <div class="subtier-card-header">
                    <span class="subtier-board-name">${board.name}</span>
                    ${badgeHtml}
                </div>
                ${msgHtml}
                <div class="subtier-card-footer">
                    <span class="subtier-reports-label">Reports to T${tier}</span>
                    <button class="subtier-goto-btn">Open board \u2192</button>
                </div>`;

            card.querySelector('.subtier-goto-btn').addEventListener('click', () => {
                VPMBoards.navigateTo(board.id);
            });
            container.appendChild(card);
        });
    }

    // ========================================
    // THEME TOGGLE
    // ========================================

    // ========================================
    // FOLDER SETUP MODAL (first-time only)
    // ========================================

    async function _showFolderSetupModal() {
        // Build blocking overlay — no X, no escape, only OK
        const overlay = document.createElement('div');
        overlay.id = 'folderSetupOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.6);';

        const box = document.createElement('div');
        box.style.cssText = 'background:var(--card-bg,#fff);border-radius:12px;padding:32px 36px;max-width:460px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,.3);text-align:center;font-family:inherit;';

        box.innerHTML =
            '<div style="font-size:40px;margin-bottom:12px;">&#128193;</div>' +
            '<h2 style="margin:0 0 8px;font-size:20px;color:var(--text,#1e293b);">Connect Storage Folder</h2>' +
            '<p style="margin:0 0 20px;font-size:14px;color:var(--text-secondary,#64748b);line-height:1.5;">' +
                'VPM needs a folder to store your data (charts, layouts, messages, snapshots).<br>' +
                'Select the <strong>VPM root folder</strong> so your data syncs across browsers and PCs.' +
            '</p>' +
            '<button id="folderSetupOkBtn" style="' +
                'padding:10px 36px;font-size:15px;font-weight:600;border:none;border-radius:8px;' +
                'background:var(--primary,#6366f1);color:#fff;cursor:pointer;transition:opacity .2s;' +
            '">OK &mdash; Select Folder</button>';

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        // Block Escape key
        function blockEsc(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); } }
        document.addEventListener('keydown', blockEsc, true);

        // Loop until folder is selected
        const okBtn = document.getElementById('folderSetupOkBtn');
        let connected = false;
        while (!connected) {
            await new Promise(resolve => {
                okBtn.onclick = resolve;
            });
            connected = await VPMFileStore.requestFolder();
            if (!connected) {
                // User cancelled the picker — keep modal open
                okBtn.textContent = 'Please select a folder to continue';
                okBtn.style.background = 'var(--warning-color,#f59e0b)';
                await new Promise(r => setTimeout(r, 1500));
                okBtn.textContent = 'OK \u2014 Select Folder';
                okBtn.style.background = 'var(--primary,#6366f1)';
            }
        }

        // Success — tear down
        document.removeEventListener('keydown', blockEsc, true);
        overlay.remove();
        _onFolderConnected();
    }

    // ========================================
    // RECONNECT BANNER (returning user, needs re-permission)
    // ========================================

    function _showReconnectBanner() {
        // Non-blocking banner at top of page
        const banner = document.createElement('div');
        banner.id = 'folderReconnectBanner';
        banner.style.cssText =
            'position:fixed;top:0;left:0;right:0;z-index:9000;display:flex;align-items:center;' +
            'justify-content:center;gap:12px;padding:10px 16px;' +
            'background:var(--warning-color,#f59e0b);color:#fff;font-size:14px;font-weight:600;' +
            'cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2);';
        banner.innerHTML =
            '<span style="font-size:18px;">&#128193;</span> ' +
            'Click here to reconnect VPM storage folder';

        banner.addEventListener('click', async () => {
            banner.textContent = 'Reconnecting...';
            // Try re-granting permission on the stored handle (user gesture = click)
            let ok = await VPMFileStore.tryRestore();
            if (!ok) {
                // Handle stale — fall back to folder picker
                ok = await VPMFileStore.requestFolder();
            }
            if (ok) {
                banner.remove();
                _onFolderConnected();
            } else {
                banner.innerHTML =
                    '<span style="font-size:18px;">&#128193;</span> ' +
                    'Click here to reconnect VPM storage folder';
            }
        });

        document.body.appendChild(banner);
    }

    // ========================================
    // SHARED: after folder is connected
    // ========================================

    function _onFolderConnected() {
        _updateFolderIndicator(true);
        if (typeof VPMDailySnapshots !== 'undefined') VPMDailySnapshots.migrate();
        document.dispatchEvent(new CustomEvent('vpm:fsFolderReady'));
        if (typeof VPMPeriodStore !== 'undefined') VPMPeriodStore.migrate();
    }

    // ========================================
    // FOLDER CONNECTION INDICATOR
    // ========================================

    function _updateFolderIndicator(connected) {
        const btn   = document.getElementById('folderConnectBtn');
        const label = document.getElementById('folderConnectLabel');
        if (!btn) return;

        if (connected) {
            btn.classList.add('connected');
            btn.title = 'Storage synced to: ' + (VPMFileStore.folderName() || 'folder');
            if (label) label.textContent = VPMFileStore.folderName() || 'Connected';
        } else {
            btn.classList.remove('connected');
            btn.title = 'Click to connect VPM folder for data sync across PCs';
            if (label) label.textContent = 'Connect Folder';
        }
    }

    (function _wireFolderBtn() {
        document.addEventListener('DOMContentLoaded', () => {
            const btn = document.getElementById('folderConnectBtn');
            if (!btn || typeof VPMFileStore === 'undefined') return;

            btn.addEventListener('click', async () => {
                // Try re-granting stored handle first (user gesture available)
                let ok = await VPMFileStore.tryRestore();
                if (!ok) ok = await VPMFileStore.requestFolder();
                if (!ok) return;
                // Remove reconnect banner if present
                const banner = document.getElementById('folderReconnectBanner');
                if (banner) banner.remove();
                _onFolderConnected();
            });
        });
    })();

    // ZOOM / FONT-SIZE CONTROLS
    // ========================================

    function setupZoomControls() {
        const outBtn  = document.getElementById('zoomOutBtn');
        const inBtn   = document.getElementById('zoomInBtn');
        const levelEl = document.getElementById('zoomLevel');
        if (!outBtn || !inBtn) return;

        const STEPS     = [70, 80, 90, 100, 110, 120, 130, 150];
        const STORE_KEY = 'vpm-zoom-t';

        function currentTierId() {
            return parseInt(localStorage.getItem('vpm-current-tier') || '1');
        }

        function getStoredZoom(tier) {
            return parseInt(localStorage.getItem(STORE_KEY + tier) || '100');
        }

        function applyZoom(pct) {
            const factor = pct / 100;
            document.documentElement.style.zoom = pct + '%';
            // Expose to Chart.js zoom-fix plugin so it can correct tooltip hit detection
            window._vpmZoom = factor;
            if (levelEl) levelEl.textContent = pct + '%';
            // Disable buttons at limits
            if (outBtn) outBtn.disabled = pct <= STEPS[0];
            if (inBtn)  inBtn.disabled  = pct >= STEPS[STEPS.length - 1];
            // Resize all live Chart.js instances so they recalculate their
            // internal pixel dimensions to match the new visual size
            try {
                Object.values(Chart.instances || {}).forEach(c => c.resize());
            } catch (_) { /* ignore if Chart not loaded yet */ }
        }

        function setZoom(pct) {
            const tier = currentTierId();
            localStorage.setItem(STORE_KEY + tier, String(pct));
            applyZoom(pct);
        }

        outBtn.addEventListener('click', () => {
            const cur = getStoredZoom(currentTierId());
            const idx = STEPS.indexOf(cur);
            const prev = idx > 0 ? STEPS[idx - 1] : (STEPS.find(s => s < cur) || STEPS[0]);
            setZoom(prev !== undefined ? prev : STEPS[0]);
        });

        inBtn.addEventListener('click', () => {
            const cur = getStoredZoom(currentTierId());
            const idx = STEPS.indexOf(cur);
            const next = idx >= 0 && idx < STEPS.length - 1 ? STEPS[idx + 1]
                       : (STEPS.slice().reverse().find(s => s > cur) || STEPS[STEPS.length - 1]);
            setZoom(next !== undefined ? next : STEPS[STEPS.length - 1]);
        });

        // Apply current tier's zoom on load
        applyZoom(getStoredZoom(currentTierId()));

        // Apply the new tier's zoom whenever the active tier switches
        document.addEventListener('vpm:tierChanged', (e) => {
            const tier = e.detail?.tier ?? currentTierId();
            applyZoom(getStoredZoom(tier));
        });
    }

    function setupThemeToggle() {
        const btn      = document.getElementById('themeToggleBtn');
        const iconMoon = document.getElementById('themeIconMoon');
        const iconSun  = document.getElementById('themeIconSun');
        if (!btn) return;

        const saved = localStorage.getItem('vpm-theme');
        if (saved === 'light') applyTheme('light');

        btn.addEventListener('click', () => {
            const isLight = document.body.classList.contains('light-theme');
            applyTheme(isLight ? 'dark' : 'light');
        });

        function applyTheme(theme) {
            const light = theme === 'light';
            document.body.classList.toggle('light-theme', light);
            iconMoon.style.display = light  ? 'none'  : '';
            iconSun.style.display  = light  ? ''      : 'none';
            btn.title = light ? 'Switch to dark theme' : 'Switch to light theme';
            localStorage.setItem('vpm-theme', theme);
            // Refresh Chart.js global defaults then re-render all visible charts
            VPMCharts.applyDefaults();
            document.dispatchEvent(new CustomEvent('vpm:requestRender'));
        }
    }

    // ========================================
    // SAVE LAYOUT BUTTON
    // ========================================

    function setupSaveLayoutBtn() {
        if (typeof VPMLayout === 'undefined') return;

        const saveBtn  = document.getElementById('saveLayoutBtn');
        const resetBtn = document.getElementById('resetLayoutBtn');
        const label    = document.getElementById('saveLayoutLabel');

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                VPMLayout.saveCurrentLayout();
                const tierNum = (typeof VPMEscalation !== 'undefined') ? VPMEscalation.getCurrentTier() : 1;
                const orig = label.textContent;
                label.textContent = `Saved T${tierNum}!`;
                saveBtn.classList.add('save-layout-saved');
                setTimeout(() => {
                    label.textContent = orig;
                    saveBtn.classList.remove('save-layout-saved');
                }, 2000);
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                VPMLayout.resetLayout();
                // Restore any permanently-hidden built-in chart cards
                if (typeof VPMChartVisibility !== 'undefined') {
                    VPMChartVisibility.restoreAllHidden();
                }
                resetBtn.classList.add('reset-layout-flash');
                setTimeout(() => resetBtn.classList.remove('reset-layout-flash'), 500);
            });
        }
    }

    // ========================================
    // SIDEBAR
    // ========================================

    function setupSidebar() {
        const toggle = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('sidebar');

        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }

    // ========================================
    // FILE UPLOAD
    // ========================================

    function setupFileUpload() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');

        uploadArea.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            await handleFileUpload(file);
            fileInput.value = '';
        });
    }

    async function handleFileUpload(file) {
        try {
            updateDataStatus(false, 'Loading...');
            const data = await VPMDataParser.parseExcelFile(file);
            currentData = data;
            // Excel upload seeds charts via VPMDataSeeder below
            // Seed all built-in charts as Data Studio custom chart definitions
            if (typeof VPMDataSeeder !== 'undefined') {
                VPMDataSeeder.seedFromData(data);
            }
            updateDataStatus(true, file.name, false);
            renderCurrentTab();
        } catch (err) {
            console.error('Failed to parse Excel file:', err);
            updateDataStatus(false, 'Error loading file');
        }
    }

    // ========================================
    // DRAG & DROP
    // ========================================

    function setupDragDrop() {
        const overlay = document.getElementById('dropOverlay');
        let dragCounter = 0;

        document.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dragCounter++;
            if (dragCounter === 1) overlay.classList.add('active');
        });

        document.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter === 0) overlay.classList.remove('active');
        });

        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        document.addEventListener('drop', async (e) => {
            e.preventDefault();
            dragCounter = 0;
            overlay.classList.remove('active');

            const file = e.dataTransfer.files[0];
            if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
                await handleFileUpload(file);
            }
        });
    }

    // ========================================
    // PERIOD SELECTORS
    // ========================================

    function setupPeriodSelectors() {
        document.getElementById('monthSelect').addEventListener('change', () => renderCurrentTab());
        document.getElementById('yearSelect').addEventListener('change', () => renderCurrentTab());
    }

    // ========================================
    // DATA STATUS
    // ========================================

    function updateDataStatus(loaded, name, fromSnapshot) {
        const el = document.getElementById('dataStatus');
        el.classList.toggle('from-snapshot', !!fromSnapshot);
        if (loaded) {
            el.classList.add('loaded');
            const snapBadge = fromSnapshot
                ? `<span class="snapshot-loaded-badge">snapshot</span>`
                : '';
            el.innerHTML = `<span class="status-dot"></span><span>Data loaded${name ? ': ' + name : ''}${snapBadge}</span>`;
        } else {
            el.classList.remove('loaded');
            el.innerHTML = `<span class="status-dot"></span><span>${name || 'No data loaded'}</span>`;
        }
        // Keep save-snapshot button enabled only when data is present
        const saveBtn = document.getElementById('saveSnapshotBtn');
        if (saveBtn) saveBtn.disabled = !loaded;
    }

    // ========================================
    // PERIOD STORE (snapshot save / history)
    // ========================================

    /**
     * Returns a stable lowercase slug for the current tier.
     * Standard tiers (1-3) use "t1" / "t2" / "t3".
     * Custom boards use a slugified version of their display label.
     */
    function getCurrentTierId() {
        if (typeof VPMEscalation === 'undefined') return 't1';
        const num   = VPMEscalation.getCurrentTier();
        const label = document.getElementById('tierLabel');
        const text  = label ? label.textContent.trim() : '';
        if (num <= 3) return `t${num}`;
        // Custom board — slugify the label
        return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `tier-${num}`;
    }

    function getCurrentTierLabel() {
        const label = document.getElementById('tierLabel');
        return label ? label.textContent.trim() : 'Unknown tier';
    }

    function setupPeriodStore() {
        const saveBtn     = document.getElementById('saveSnapshotBtn');
        const saveLabel   = document.getElementById('saveSnapshotLabel');
        const histBtn     = document.getElementById('snapshotHistoryBtn');
        const histPanel   = document.getElementById('snapshotHistoryPanel');
        const histList    = document.getElementById('snapshotHistoryList');
        const countBadge  = document.getElementById('snapshotCountBadge');
        const tierLblEl   = document.getElementById('snapshotHistoryTierLabel');

        if (!saveBtn || !histBtn || !histPanel) return;

        // Move panel to body so it's in the root stacking context — avoids any
        // z-index issues with positioned ancestors inside the header
        document.body.appendChild(histPanel);

        // Backdrop shield: sits just below the panel, above all page content.
        const backdrop = document.createElement('div');
        backdrop.id = 'histPanelBackdrop';
        backdrop.style.cssText = [
            'position:fixed', 'inset:0', 'z-index:10009',
            'background:transparent', 'display:none'
        ].join(';');
        document.body.appendChild(backdrop);

        function _openPanel() {
            histPanel.hidden = false;
            backdrop.style.display = 'block';
            histBtn.classList.add('panel-open');
            // Hide reconnect banner so it doesn't overlap the panel
            const banner = document.getElementById('folderReconnectBanner');
            if (banner) banner.style.display = 'none';
            refreshPanel();
        }
        function _closePanel() {
            histPanel.hidden = true;
            backdrop.style.display = 'none';
            histBtn.classList.remove('panel-open');
            // Restore reconnect banner
            const banner = document.getElementById('folderReconnectBanner');
            if (banner) banner.style.display = '';
        }

        // Close on backdrop click
        backdrop.addEventListener('click', _closePanel);

        // Refresh badge count whenever anything changes
        async function refreshBadge() {
            const monthly = await VPMPeriodStore.list(getCurrentTierId());
            let daily = [];
            if (typeof VPMDailySnapshots !== 'undefined') {
                daily = await VPMDailySnapshots.list(getCurrentTierId());
            }
            const total = monthly.length + daily.length;
            if (total > 0) {
                countBadge.textContent = total;
                countBadge.style.display = '';
            } else {
                countBadge.style.display = 'none';
            }
        }

        // Rebuild the list inside the dropdown panel
        async function refreshPanel() {
            const tierId  = getCurrentTierId();
            const monthly = await VPMPeriodStore.list(tierId);
            const year    = parseInt(document.getElementById('yearSelect').value);
            const month   = parseInt(document.getElementById('monthSelect').value);

            if (tierLblEl) tierLblEl.textContent = getCurrentTierLabel();

            histList.innerHTML = '';

            // ── File storage setup banner / info bar ─────────────────────
            const fsReady = typeof VPMFileStore !== 'undefined' && VPMFileStore.isReady();

            if (!fsReady) {
                // Not configured — show setup prompt
                const setupBar = document.createElement('div');
                setupBar.className = 'snapshot-storage-bar snap-fs-setup';
                setupBar.style.cssText = 'flex-direction:column;align-items:flex-start;gap:6px';
                setupBar.innerHTML =
                    '<div style="display:flex;align-items:center;gap:8px;width:100%">' +
                        '<span class="snap-stor-item" style="color:var(--warning)">Snapshots stored in browser only</span>' +
                        '<button class="snapshot-load-btn snap-fs-btn" id="snapSelectFolderBtn" style="margin-left:auto">Select VPM Folder</button>' +
                    '</div>' +
                    '<div style="font-size:11px;color:var(--text-muted);line-height:1.5;padding:4px 6px;background:var(--bg-primary);border-radius:4px;width:100%;box-sizing:border-box">' +
                        'When the folder picker opens, navigate to and select your <strong>VPM folder</strong> ' +
                        '(the same folder that contains <code style="font-size:10px;background:var(--border);padding:1px 4px;border-radius:3px">index.html</code>). ' +
                        'Snapshots will be saved inside it at <code style="font-size:10px;background:var(--border);padding:1px 4px;border-radius:3px">VPM\\snapshots\\</code> ' +
                        'so they stay with your project files and transfer with them.' +
                    '</div>';
                histList.appendChild(setupBar);

                setupBar.querySelector('#snapSelectFolderBtn').addEventListener('click', async () => {
                    const ok = await VPMFileStore.requestFolder();
                    if (!ok) return;
                    // Migrate existing data then refresh panel
                    if (typeof VPMDailySnapshots !== 'undefined') await VPMDailySnapshots.migrate();
                    await VPMPeriodStore.migrate();
                    await refreshPanel();
                    await refreshBadge();
                });
            } else if (typeof VPMDailySnapshots !== 'undefined') {
                const info    = await VPMDailySnapshots.getStorageInfo();
                const infoBar = document.createElement('div');
                infoBar.className = 'snapshot-storage-bar';
                infoBar.innerHTML =
                    '<span class="snap-stor-item" style="color:var(--success)">Folder: <strong>' + VPMFileStore.folderName() + '/snapshots</strong></span>' +
                    '<span class="snap-stor-sep">·</span>' +
                    '<span class="snap-stor-item">Monthly: <strong>' + monthly.length + '</strong></span>' +
                    '<span class="snap-stor-sep">·</span>' +
                    '<span class="snap-stor-item">Daily: <strong>' + info.count + '</strong></span>' +
                    '<button class="snapshot-delete-btn snap-fs-forget" title="Change folder" style="margin-left:auto">Change</button>';
                histList.appendChild(infoBar);

                infoBar.querySelector('.snap-fs-forget').addEventListener('click', async () => {
                    if (!window.confirm('Change the snapshot folder? Existing files will not be deleted.')) return;
                    const ok = await VPMFileStore.requestFolder();
                    if (ok) {
                        if (typeof VPMDailySnapshots !== 'undefined') await VPMDailySnapshots.migrate();
                        await VPMPeriodStore.migrate();
                        await refreshPanel();
                    }
                });
            }

            // ── Monthly snapshots ─────────────────────────────────────────
            if (monthly.length > 0) {
                const sec = document.createElement('div');
                sec.className = 'snapshot-section-label';
                sec.textContent = 'Monthly Snapshots (manual)';
                histList.appendChild(sec);

                monthly.forEach(meta => {
                    const isActive = meta.year === year && meta.month === month;
                    const row = document.createElement('div');
                    row.className = 'snapshot-item' + (isActive ? ' snapshot-active-period' : '');
                    const savedDate = new Date(meta.savedAt);
                    const savedStr  = savedDate.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
                                    + ' ' + savedDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                    row.innerHTML = `
                        <div class="snapshot-item-left">
                            <span class="snapshot-item-period">${VPMPeriodStore.formatPeriodFull(meta.year, meta.month)}</span>
                            <span class="snapshot-item-meta">Saved ${savedStr}</span>
                        </div>
                        <div class="snapshot-item-actions">
                            <button class="snapshot-load-btn">Load</button>
                            <button class="snapshot-delete-btn" title="Delete">&times;</button>
                        </div>`;
                    row.querySelector('.snapshot-load-btn').addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const snap = await VPMPeriodStore.load(meta.year, meta.month, tierId);
                        if (!snap || !snap.data) return;
                        VPMPeriodStore.applyAndReload(snap);
                    });
                    row.querySelector('.snapshot-delete-btn').addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const label = VPMPeriodStore.formatPeriodFull(meta.year, meta.month);
                        if (!window.confirm(`Delete the "${label}" snapshot for ${getCurrentTierLabel()}?`)) return;
                        await VPMPeriodStore.remove(meta.year, meta.month, tierId);
                        refreshBadge();
                        refreshPanel();
                    });
                    histList.appendChild(row);
                });
            }

            // ── Daily auto-snapshots — Year → Month → Day drill-down ──────
            if (typeof VPMDailySnapshots !== 'undefined') {
                const info  = await VPMDailySnapshots.getStorageInfo();
                const years = await VPMDailySnapshots.getYears(tierId);

                if (years.length > 0) {
                    const sec = document.createElement('div');
                    sec.className = 'snapshot-section-label';
                    sec.textContent = `Auto Snapshots — ${info.count} total · ${info.totalMB} MB`;
                    histList.appendChild(sec);

                    for (const yr of years) {
                        // Year row (collapsible)
                        const yrRow = document.createElement('div');
                        yrRow.className = 'snap-tree-year';
                        yrRow.innerHTML = `<span class="snap-tree-arrow">▶</span><span>${yr}</span>`;
                        histList.appendChild(yrRow);

                        const yrBody = document.createElement('div');
                        yrBody.className = 'snap-tree-body snap-tree-body-hidden';
                        histList.appendChild(yrBody);

                        yrRow.addEventListener('click', async () => {
                            const open = !yrBody.classList.contains('snap-tree-body-hidden');
                            if (open) {
                                yrBody.classList.add('snap-tree-body-hidden');
                                yrRow.querySelector('.snap-tree-arrow').textContent = '▶';
                                return;
                            }
                            yrBody.innerHTML = '<div class="snap-tree-loading">Loading…</div>';
                            yrBody.classList.remove('snap-tree-body-hidden');
                            yrRow.querySelector('.snap-tree-arrow').textContent = '▼';

                            const months = await VPMDailySnapshots.getMonths(tierId, yr);
                            yrBody.innerHTML = '';

                            for (const mo of months) {
                                const moLabel = new Date(mo + '-02').toLocaleDateString(undefined, { month: 'long' });
                                const moRow = document.createElement('div');
                                moRow.className = 'snap-tree-month';
                                moRow.innerHTML = `<span class="snap-tree-arrow">▶</span><span>${moLabel}</span>`;
                                yrBody.appendChild(moRow);

                                const moBody = document.createElement('div');
                                moBody.className = 'snap-tree-body snap-tree-body-hidden';
                                yrBody.appendChild(moBody);

                                moRow.addEventListener('click', async (e) => {
                                    e.stopPropagation();
                                    const mOpen = !moBody.classList.contains('snap-tree-body-hidden');
                                    if (mOpen) {
                                        moBody.classList.add('snap-tree-body-hidden');
                                        moRow.querySelector('.snap-tree-arrow').textContent = '▶';
                                        return;
                                    }
                                    moBody.innerHTML = '<div class="snap-tree-loading">Loading…</div>';
                                    moBody.classList.remove('snap-tree-body-hidden');
                                    moRow.querySelector('.snap-tree-arrow').textContent = '▼';

                                    const days = await VPMDailySnapshots.getDays(tierId, mo);
                                    moBody.innerHTML = '';

                                    for (const day of days) {
                                        const dayLabel = new Date(day + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
                                        const dayRow = document.createElement('div');
                                        dayRow.className = 'snap-tree-day';
                                        dayRow.innerHTML = `<span class="snap-tree-arrow">▶</span><span>${dayLabel}</span>`;
                                        moBody.appendChild(dayRow);

                                        const dayBody = document.createElement('div');
                                        dayBody.className = 'snap-tree-body snap-tree-body-hidden';
                                        moBody.appendChild(dayBody);

                                        dayRow.addEventListener('click', async (e) => {
                                            e.stopPropagation();
                                            const dOpen = !dayBody.classList.contains('snap-tree-body-hidden');
                                            if (dOpen) {
                                                dayBody.classList.add('snap-tree-body-hidden');
                                                dayRow.querySelector('.snap-tree-arrow').textContent = '▶';
                                                return;
                                            }
                                            dayBody.innerHTML = '<div class="snap-tree-loading">Loading…</div>';
                                            dayBody.classList.remove('snap-tree-body-hidden');
                                            dayRow.querySelector('.snap-tree-arrow').textContent = '▼';

                                            const snaps = await VPMDailySnapshots.getSnapsForDay(tierId, day);
                                            dayBody.innerHTML = '';

                                            snaps.forEach(snap => {
                                                const t = new Date(snap.savedAt);
                                                const timeStr = t.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                                const entry = document.createElement('div');
                                                entry.className = 'snapshot-item snapshot-daily';
                                                entry.innerHTML = `
                                                    <div class="snapshot-item-left">
                                                        <span class="snapshot-item-period">${timeStr}</span>
                                                        <span class="snapshot-item-meta">${snap.tierLabel || ''}</span>
                                                    </div>
                                                    <div class="snapshot-item-actions">
                                                        <button class="snapshot-load-btn">Load</button>
                                                        <button class="snapshot-delete-btn" title="Delete">&times;</button>
                                                    </div>`;
                                                entry.querySelector('.snapshot-load-btn').addEventListener('click', async (e) => {
                                                    e.stopPropagation();
                                                    const full = await VPMDailySnapshots.load(snap.key);
                                                    if (!full?.data) return;
                                                    if (full.lsState) Object.entries(full.lsState).forEach(([k, v]) => localStorage.setItem(k, v));
                                                    VPMPeriodStore.setPendingRestore(full.data, day, snap.tierLabel);
                                                    location.reload();
                                                });
                                                entry.querySelector('.snapshot-delete-btn').addEventListener('click', async (e) => {
                                                    e.stopPropagation();
                                                    if (!window.confirm(`Delete snapshot from ${day} ${timeStr}?`)) return;
                                                    await VPMDailySnapshots.remove(snap.key);
                                                    refreshBadge();
                                                    refreshPanel();
                                                });
                                                dayBody.appendChild(entry);
                                            });
                                        });
                                    }
                                });
                            }
                        });
                    }
                }
            }

            if (monthly.length === 0 && typeof VPMDailySnapshots === 'undefined') {
                histList.innerHTML = '<div class="snapshot-empty">No snapshots saved yet for this tier</div>';
            }
        }

        // ── Save button ───────────────────────────────────────────────────────
        saveBtn.addEventListener('click', async () => {
            if (!currentData) return;
            const year    = parseInt(document.getElementById('yearSelect').value);
            const month   = parseInt(document.getElementById('monthSelect').value);
            const tierId  = getCurrentTierId();
            const label   = getCurrentTierLabel();

            // Warn if overwriting
            if (await VPMPeriodStore.exists(year, month, tierId)) {
                const periodStr = VPMPeriodStore.formatPeriodFull(year, month);
                if (!window.confirm(`Overwrite the existing "${periodStr}" snapshot for ${label}?`)) return;
            }

            const result = await VPMPeriodStore.save(year, month, tierId, label, currentData);
            if (!result.ok) {
                if (result.reason === 'quota') {
                    alert('Storage quota exceeded. Please delete some older snapshots first.');
                } else {
                    alert('Could not save snapshot: ' + result.reason);
                }
                return;
            }

            // Flash confirmation on the button
            const originalText = saveLabel.textContent;
            saveLabel.textContent = 'Saved!';
            saveBtn.classList.add('snapshot-saved');
            setTimeout(() => {
                saveLabel.textContent = originalText;
                saveBtn.classList.remove('snapshot-saved');
            }, 1800);

            refreshBadge();
        });

        // ── History toggle ─────────────────────────────────────────────────────
        histBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (histPanel.hidden) _openPanel(); else _closePanel();
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            const wrap = document.getElementById('snapshotHistoryWrap');
            if (!histPanel.hidden && !wrap.contains(e.target) && !histPanel.contains(e.target)) {
                _closePanel();
            }
        });

        // Refresh badge when period selectors change
        document.getElementById('monthSelect').addEventListener('change', refreshBadge);
        document.getElementById('yearSelect').addEventListener('change', refreshBadge);
        // Refresh badge on tier switch (vpm:requestRender fires after every switchTier)
        document.addEventListener('vpm:requestRender', () => {
            refreshBadge();
            // Close history panel when the tier may have changed (panel is tier-specific)
            if (!histPanel.hidden) _closePanel();
        });

        // Initial badge
        refreshBadge();
    }

    // ========================================
    // START
    // ========================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
