/**
 * VPM Shared Store  (v1)
 * Cross-tier data sharing via File System Access API.
 *
 * Requires VPMFileStore to have a folder selected (same shared network folder
 * for all users).  No web server required — pure browser File System Access API.
 *
 * Each tier writes:   <shared-folder>/shared/t{N}-data.json
 * Share config lives: <shared-folder>/shared/share-config.json
 *
 * Polling reads the other tiers' files on an interval and injects read-only
 * chart cards + escalation messages into the current view.
 */
const VPMSharedStore = (function () {
    'use strict';

    const DEFAULT_POLL_MS    = 30000;   // 30 s
    const PUBLISH_DEBOUNCE   = 2000;    // 2 s debounce after data change

    let _shareConfig    = null;         // loaded from share-config.json
    let _currentTier    = 1;
    let _publishTimer   = null;
    let _pollTimer      = null;
    let _lastSeen       = {};           // { sourceTier: publishedAt ISO string }
    let _lastPublishedAt = null;
    let _cachedCharts   = {};           // { 'tN-tabId': domSectionRef }

    // ── Init ──────────────────────────────────────────────────────────────────

    async function init() {
        _currentTier = _readCurrentTier();

        // Watch for tier switches
        document.addEventListener('vpm:requestRender', () => {
            const t = _readCurrentTier();
            if (t !== _currentTier) {
                _currentTier = t;
                _onTierChanged();
            }
        });

        // Re-poll when tab becomes visible again
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') _pollAll();
        });

        if (!VPMFileStore.isReady()) {
            // Folder not yet selected — listen for when it becomes ready
            document.addEventListener('vpm:fsFolderReady', _onFolderReady);
            return;
        }
        await _onFolderReady();
    }

    async function _onFolderReady() {
        await _loadShareConfig();
        schedulePublish();
        _startPolling();
    }

    function _readCurrentTier() {
        return parseInt(localStorage.getItem('vpm-current-tier') || '1');
    }

    // ── Share Config ──────────────────────────────────────────────────────────

    async function _loadShareConfig() {
        try {
            const cfg = await VPMFileStore.readShared('share-config');
            _shareConfig = cfg || _emptyConfig();
        } catch (e) {
            _shareConfig = _emptyConfig();
        }
    }

    function _emptyConfig() {
        return { version: 1, shares: [], pollIntervalMs: DEFAULT_POLL_MS };
    }

    function getShareConfig() { return _shareConfig; }

    async function saveShareConfig(cfg) {
        if (!VPMFileStore.isReady()) {
            return { ok: false, error: 'No shared folder selected' };
        }
        try {
            await VPMFileStore.writeShared('share-config', cfg);
            _shareConfig = cfg;
            _startPolling();  // apply new poll interval
            schedulePublish();
            return { ok: true };
        } catch (e) {
            return { ok: false, error: e.message };
        }
    }

    // ── Publish ───────────────────────────────────────────────────────────────

    function schedulePublish() {
        if (!VPMFileStore.isReady()) return;
        clearTimeout(_publishTimer);
        _publishTimer = setTimeout(publishMyData, PUBLISH_DEBOUNCE);
    }

    async function publishMyData() {
        if (!VPMFileStore.isReady()) return;
        if (!_shareConfig) await _loadShareConfig();
        if (!_shareConfig) return;

        // Auto-include all charts for this tier (any higher tier with a linkedTo can consume)
        const myCharts = (typeof VPMDataStore !== 'undefined')
            ? VPMDataStore.getChartsForTier(_currentTier).filter(c => !c.linkedTo)
            : [];

        // Also include manually configured shares from share-config
        const manualShares = (_shareConfig.shares || []).filter(s => s.sourceTier === _currentTier);

        const sharedCharts = [];

        // Add all tier-owned charts
        for (const chart of myCharts) {
            const seriesData = VPMCharts._seriesData?.[chart.canvasId];
            sharedCharts.push({
                canvasId:  chart.canvasId,
                chartId:   chart.id,
                label:     chart.title || _formatCanvasLabel(chart.canvasId),
                tab:       chart.tab || 'overview',
                visibleTo: [],   // any tier can pull (filtering done on consumer side)
                chartData: seriesData || null,
                opts:      chart.opts || null   // full opts for cross-PC linked chart resolution
            });
        }

        // Add manually configured shares that aren't already in the auto list
        const autoIds = new Set(sharedCharts.map(c => c.canvasId));
        for (const share of manualShares) {
            if (autoIds.has(share.canvasId)) continue;
            const seriesData = VPMCharts._seriesData?.[share.canvasId];
            sharedCharts.push({
                canvasId:  share.canvasId,
                label:     share.label || _formatCanvasLabel(share.canvasId),
                tab:       share.tab || 'overview',
                visibleTo: share.visibleTo || [],
                chartData: seriesData || null
            });
        }

        // Own messages only (not external/merged ones from other tiers)
        const messages = (typeof VPMEscalation !== 'undefined' && typeof VPMEscalation.getMessages === 'function')
            ? VPMEscalation.getMessages().filter(m => !m._external)
            : [];

        const payload = {
            tier:               _currentTier,
            publishedAt:        new Date().toISOString(),
            sharedCharts,
            escalationMessages: messages
        };

        try {
            await VPMFileStore.writeShared('t' + _currentTier + '-data', payload);
            _lastPublishedAt = payload.publishedAt;
            document.dispatchEvent(new CustomEvent('vpm:sharedPublished', {
                detail: { tier: _currentTier, publishedAt: _lastPublishedAt }
            }));
        } catch (e) {
            console.warn('[SharedStore] Publish failed:', e.message);
        }
    }

    // ── Polling ───────────────────────────────────────────────────────────────

    function _startPolling() {
        clearInterval(_pollTimer);
        const interval = (_shareConfig?.pollIntervalMs) || DEFAULT_POLL_MS;
        _pollAll();
        _pollTimer = setInterval(_pollAll, interval);
    }

    async function _pollAll() {
        if (!VPMFileStore.isReady() || !_shareConfig) return;

        // Which source tiers publish charts visible to me?
        const sourceTiers = new Set();
        for (const share of (_shareConfig.shares || [])) {
            if (share.sourceTier !== _currentTier && (share.visibleTo || []).includes(_currentTier)) {
                sourceTiers.add(share.sourceTier);
            }
        }

        for (const st of sourceTiers) {
            await _pollOneTier(st);
        }
    }

    async function _pollOneTier(sourceTier) {
        try {
            const data = await VPMFileStore.readShared('t' + sourceTier + '-data');
            if (!data) return;

            // Only process if newer than last seen
            if (_lastSeen[sourceTier] === data.publishedAt) return;
            _lastSeen[sourceTier] = data.publishedAt;

            _injectSharedCharts(data);

            if (Array.isArray(data.escalationMessages) && data.escalationMessages.length > 0) {
                if (typeof VPMEscalation !== 'undefined' && typeof VPMEscalation.mergeExternalMessages === 'function') {
                    VPMEscalation.mergeExternalMessages(data.escalationMessages, sourceTier);
                }
            }
        } catch (e) {
            // Source tier hasn't published yet, or file unreadable — silently skip
        }
    }

    // ── Chart Injection ───────────────────────────────────────────────────────

    function _injectSharedCharts(tierData) {
        const sourceTier = tierData.tier;
        const charts = (tierData.sharedCharts || []).filter(c =>
            (c.visibleTo || []).includes(_currentTier)
        );
        if (!charts.length) return;

        for (const chart of charts) {
            const tabId  = chart.tab || 'overview';
            const panel  = document.getElementById('panel-' + tabId)
                        || document.getElementById('panel-overview');
            if (!panel) continue;

            // Ensure the shared-charts section exists for this source tier in this tab
            const sectionId = 'shared-section-t' + sourceTier + '-' + tabId;
            let section = document.getElementById(sectionId);
            if (!section) {
                section = document.createElement('div');
                section.id        = sectionId;
                section.className = 'shared-charts-section';
                section.innerHTML =
                    '<div class="shared-section-header">' +
                        '<span class="shared-tier-pill">T' + sourceTier + ' LIVE</span>' +
                        '<span class="shared-section-label">Data from ' + _tierLabel(sourceTier) + '</span>' +
                        '<span class="shared-section-ts" id="shared-ts-t' + sourceTier + '-' + tabId + '"></span>' +
                    '</div>' +
                    '<div class="shared-charts-grid" id="shared-grid-t' + sourceTier + '-' + tabId + '"></div>';
                // Insert before the first native element in the panel
                panel.insertBefore(section, panel.firstChild);
            }

            // Update timestamp
            const tsEl = document.getElementById('shared-ts-t' + sourceTier + '-' + tabId);
            if (tsEl && tierData.publishedAt) {
                tsEl.textContent = 'Updated ' + _timeAgo(tierData.publishedAt);
            }

            const grid = document.getElementById('shared-grid-t' + sourceTier + '-' + tabId);
            if (!grid) continue;

            // Find or create the chart card
            const cardId   = 'shared-card-t' + sourceTier + '-' + chart.canvasId;
            const canvasId = 'cvs-' + cardId;
            let card = document.getElementById(cardId);

            if (!card) {
                card = document.createElement('div');
                card.id        = cardId;
                card.className = 'chart-card shared-chart-card';
                card.innerHTML =
                    '<div class="chart-header">' +
                        '<h3 class="chart-title">' + _esc(chart.label) + '</h3>' +
                        '<span class="shared-live-badge">T' + sourceTier + ' LIVE</span>' +
                    '</div>' +
                    '<div class="chart-wrap shared-chart-wrap">' +
                        '<canvas id="' + canvasId + '"></canvas>' +
                    '</div>';
                grid.appendChild(card);
            }

            // Render / update the chart
            if (chart.chartData && chart.chartData.datasets && chart.chartData.datasets.length > 0) {
                VPMCharts.destroy(canvasId);
                VPMCharts.create(canvasId, {
                    type: 'line',
                    data: {
                        labels:   chart.chartData.labels || [],
                        datasets: chart.chartData.datasets
                    },
                    options: {
                        responsive:          true,
                        maintainAspectRatio: false,
                        interaction:  { mode: 'index', intersect: false },
                        plugins: {
                            legend: { display: chart.chartData.datasets.length > 1 }
                        },
                        scales: {
                            x: { display: true, ticks: { maxTicksLimit: 8, maxRotation: 0 } },
                            y: { display: true }
                        }
                    }
                });
                // Remove the data-unavailable notice if present
                const notice = card.querySelector('.shared-no-data');
                if (notice) notice.remove();
            } else if (!chart.chartData) {
                // Chart not rendered on source yet
                let notice = card.querySelector('.shared-no-data');
                if (!notice) {
                    notice = document.createElement('p');
                    notice.className = 'shared-no-data';
                    notice.textContent = 'Waiting for T' + sourceTier + ' to visit this chart…';
                    card.querySelector('.chart-wrap')?.appendChild(notice);
                }
            }
        }
    }

    // ── Tier change ───────────────────────────────────────────────────────────

    function _onTierChanged() {
        // Re-poll for the new tier's relevant source tiers
        clearInterval(_pollTimer);
        _lastSeen = {};
        _cachedCharts = {};
        // Remove all injected shared sections so they rebuild fresh
        document.querySelectorAll('.shared-charts-section').forEach(el => el.remove());
        schedulePublish();
        _startPolling();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function _tierLabel(tierId) {
        if (typeof VPMTierManager !== 'undefined') {
            const meta = VPMTierManager.getTierMeta(tierId);
            if (meta?.label) return meta.label;
        }
        return 'T' + tierId;
    }

    function _formatCanvasLabel(canvasId) {
        return (canvasId || '')
            .replace(/-chart$/, '')
            .split('-')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
    }

    function _timeAgo(isoStr) {
        const diff = Date.now() - new Date(isoStr).getTime();
        if (diff < 60000)    return 'just now';
        if (diff < 3600000)  return Math.floor(diff / 60000) + 'm ago';
        return Math.floor(diff / 3600000) + 'h ago';
    }

    function _esc(s) {
        const d = document.createElement('div');
        d.textContent = s || '';
        return d.innerHTML;
    }

    // ── Status ────────────────────────────────────────────────────────────────

    function getStatus() {
        return {
            folderReady:     VPMFileStore.isReady(),
            folderName:      VPMFileStore.folderName(),
            currentTier:     _currentTier,
            lastPublishedAt: _lastPublishedAt,
            shareConfig:     _shareConfig
        };
    }

    // ── Public ────────────────────────────────────────────────────────────────

    return {
        init,
        schedulePublish,
        publishMyData,
        saveShareConfig,
        getShareConfig,
        getStatus
    };
})();
