/**
 * VPM Data Store - Persistent metrics and custom charts via localStorage
 */
const VPMDataStore = (function () {
    'use strict';

    const METRICS_KEY = 'vpm-metrics';
    const CHARTS_KEY = 'vpm-custom-charts';

    let _metrics = null;   // full parsed-data shape, hydrated from storage or seed
    let _charts = [];      // array of ChartDef objects

    // ====================================================
    // PUBLIC API
    // ====================================================

    function init() {
        _charts = _loadCharts();
        // _metrics loaded lazily via getData()

        // Try to auto-load shared-data.json from the same directory
        _tryLoadSharedDataJson();
    }

    /**
     * On startup, try to fetch shared-data.json from the same folder.
     * If found and valid, use it as the data source (overrides localStorage).
     * This enables the shared drive workflow: everyone reads the same file.
     */
    async function _tryLoadSharedDataJson() {
        try {
            const response = await fetch('shared-data.json');
            if (!response.ok) return; // 404 = file not present, skip
            const text = await response.text();
            if (!text.trim()) return;
            const payload = JSON.parse(text);
            if (payload.metrics) {
                _metrics = payload.metrics;
                localStorage.setItem(METRICS_KEY, JSON.stringify(_metrics));
            }
            if (Array.isArray(payload.customCharts)) {
                _charts = payload.customCharts;
                localStorage.setItem(CHARTS_KEY, JSON.stringify(_charts));
            }
            document.dispatchEvent(new CustomEvent('vpm:storeReady', { detail: { metrics: _metrics } }));
            document.dispatchEvent(new CustomEvent('vpm:chartsChanged', {}));
            console.log('VPMDataStore: Loaded shared-data.json from same directory');
        } catch (e) {
            // Not found or parse error — no problem, continue normally
        }
    }

    /** Return the full metrics object (may be null if never seeded) */
    function getData() {
        if (!_metrics && localStorage.getItem(METRICS_KEY)) {
            _metrics = JSON.parse(localStorage.getItem(METRICS_KEY));
        }
        return _metrics;
    }

    /**
     * Get a value at a dot-path, e.g. 'safety.nearMiss.actual'
     * Returns undefined if path does not exist.
     */
    function get(path) {
        const data = getData();
        if (!data) return undefined;
        return _resolvePath(data, path);
    }

    /**
     * Set a value at a dot-path. Creates intermediate objects as needed.
     * Saves to localStorage and fires vpm:metricsChanged.
     */
    function set(path, value) {
        if (!_metrics) return;
        _setPath(_metrics, path, value);
        _save();
        document.dispatchEvent(new CustomEvent('vpm:metricsChanged', { detail: { path, value } }));
        // Re-render charts & KPIs so updated values are visible immediately
        document.dispatchEvent(new CustomEvent('vpm:requestRender'));
    }

    /**
     * Append a value to an array at the given dot-path.
     * Useful for daily entry (push today's reading onto a series).
     */
    function appendToSeries(path, value) {
        const current = get(path);
        if (Array.isArray(current)) {
            set(path, [...current, value]);
        }
    }

    /** Persist current _metrics to localStorage */
    function save() {
        _save();
    }

    // ====================================================
    // CUSTOM CHARTS
    // ====================================================

    // ── Tier helper ──────────────────────────────────────────────────────────

    function _currentTier() {
        return parseInt(localStorage.getItem('vpm-current-tier') || '1');
    }

    /** Return array of all saved ChartDef objects */
    function getCustomCharts() {
        return _charts.slice();
    }

    /**
     * Return custom charts for a specific tab, filtered by current tier.
     * Charts without a `tier` field (legacy / builtin-seeded) are visible to all tiers.
     */
    function getChartsForTab(tab) {
        const tier = _currentTier();
        return _charts.filter(c =>
            c.tab === tab && (!c.tier || c.tier === tier)
        );
    }

    /**
     * Return all charts belonging to a specific tier (for import picker).
     * Charts without a tier field (builtin/seeded) are treated as belonging
     * to the lowest tier (T1) since that's where data entry happens.
     */
    function getChartsForTier(tierId) {
        return _charts.filter(c =>
            c.tier === tierId || (!c.tier && tierId === 1)
        );
    }

    /** Return a single chart by id */
    function getChartById(id) {
        return _charts.find(c => c.id === id) || null;
    }

    /**
     * Resolve the opts for a chart definition.
     * If the chart has `linkedTo`, returns the source chart's opts.
     * Otherwise returns the chart's own opts.
     * Returns null if source is missing.
     */
    function resolveChartOpts(def) {
        if (!def) return null;
        if (!def.linkedTo) return def.opts;

        const source = _charts.find(c => c.id === def.linkedTo.sourceChartId);
        if (!source) return null; // source chart deleted
        return source.opts;
    }

    /**
     * Save or update a ChartDef.
     * If def.id already exists it will be replaced, otherwise appended.
     * Auto-sets `tier` to current tier if not already present.
     * @param {ChartDef} def - { id, tab, title, canvasId, templateType, opts, [tier], [linkedTo] }
     */
    function saveCustomChart(def) {
        // Auto-tag with current tier unless explicitly set.
        // Builtin/seeded charts pass tier: null to stay visible to all tiers.
        if (def.tier === undefined) {
            def.tier = _currentTier();
        }
        // tier: null means "visible to all tiers" (no filtering)
        if (def.tier === null) delete def.tier;
        const idx = _charts.findIndex(c => c.id === def.id);
        if (idx >= 0) {
            _charts[idx] = def;
        } else {
            _charts.push(def);
        }
        _saveCharts();
        document.dispatchEvent(new CustomEvent('vpm:chartsChanged', { detail: { chart: def } }));
    }

    /** Delete a custom chart by id */
    function deleteCustomChart(id) {
        _charts = _charts.filter(c => c.id !== id);
        _saveCharts();
        document.dispatchEvent(new CustomEvent('vpm:chartsChanged', { detail: { deleted: id } }));
    }

    // ====================================================
    // EXPORT / IMPORT
    // ====================================================

    /** Download the full store (metrics + charts) as a JSON file */
    function exportJSON() {
        const payload = {
            exportedAt: new Date().toISOString(),
            metrics: _metrics,
            customCharts: _charts
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'vpm-data-' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    /**
     * Import from a JSON file (previously exported by exportJSON).
     * Calls callback(null) on success or callback(errMsg) on failure.
     */
    function importJSON(file, callback) {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const payload = JSON.parse(e.target.result);
                if (payload.metrics) {
                    _metrics = payload.metrics;
                    _save();
                }
                if (Array.isArray(payload.customCharts)) {
                    _charts = payload.customCharts;
                    _saveCharts();
                }
                document.dispatchEvent(new CustomEvent('vpm:storeReady', { detail: { metrics: _metrics } }));
                document.dispatchEvent(new CustomEvent('vpm:chartsChanged', {}));
                if (callback) callback(null);
            } catch (err) {
                if (callback) callback('Invalid JSON: ' + err.message);
            }
        };
        reader.onerror = function () {
            if (callback) callback('File read error');
        };
        reader.readAsText(file);
    }


    // ====================================================
    // METRIC MANIFEST (for Daily Entry UI)
    // ====================================================


    // ====================================================
    // PRIVATE HELPERS
    // ====================================================

    function _save() {
        if (_metrics) {
            try {
                localStorage.setItem(METRICS_KEY, JSON.stringify(_metrics));
            } catch (e) {
                console.warn('VPMDataStore: localStorage quota exceeded, skipping save.', e);
            }
            if (typeof VPMSharedStore !== 'undefined') VPMSharedStore.schedulePublish();
        }
    }

    function _loadCharts() {
        try {
            return JSON.parse(localStorage.getItem(CHARTS_KEY)) || [];
        } catch (e) {
            return [];
        }
    }

    function _saveCharts() {
        try {
            localStorage.setItem(CHARTS_KEY, JSON.stringify(_charts));
        } catch (e) {
            console.warn('VPMDataStore: localStorage quota exceeded while saving charts.', e);
        }
    }

    function _resolvePath(obj, path) {
        return path.split('.').reduce((acc, key) => (acc != null ? acc[key] : undefined), obj);
    }

    function _setPath(obj, path, value) {
        const keys = path.split('.');
        let cur = obj;
        for (let i = 0; i < keys.length - 1; i++) {
            if (cur[keys[i]] == null || typeof cur[keys[i]] !== 'object') {
                cur[keys[i]] = {};
            }
            cur = cur[keys[i]];
        }
        cur[keys[keys.length - 1]] = value;
    }

    // ====================================================
    // EXPOSE
    // ====================================================

    return {
        init,
        getData,
        get,
        set,
        appendToSeries,
        save,
        getCustomCharts,
        getChartsForTab,
        getChartsForTier,
        getChartById,
        resolveChartOpts,
        saveCustomChart,
        deleteCustomChart,
        exportJSON,
        importJSON
    };
})();
