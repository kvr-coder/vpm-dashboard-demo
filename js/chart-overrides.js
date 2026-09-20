/**
 * VPM Chart Overrides
 * Stores user customisations (title, targets, colours, y-axis) per canvas ID.
 * Applied on top of the default data-driven opts in buildMetricChart().
 */
const VPMChartOverrides = (function () {
    'use strict';

    const PREFIX = 'vpm-chart-override-v1-';

    function get(canvasId) {
        try {
            const raw = localStorage.getItem(PREFIX + canvasId);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    function set(canvasId, overrides) {
        localStorage.setItem(PREFIX + canvasId, JSON.stringify(overrides));
    }

    function remove(canvasId) {
        localStorage.removeItem(PREFIX + canvasId);
    }

    /**
     * Merge saved overrides into opts before rendering.
     * Returns a (possibly new) opts object with overrides applied.
     */
    function apply(canvasId, opts) {
        const ov = get(canvasId);
        if (!ov) return opts;
        const merged = { ...opts };

        if (ov.red   != null) merged.red   = [ov.red];
        if (ov.green != null) merged.green = [ov.green];
        if (ov.aop   != null) merged.aop   = [ov.aop];
        if (ov.color != null) merged.color = ov.color;
        if (ov.yMin  != null) merged.yMin  = ov.yMin;
        if (ov.yMax  != null) merged.yMax  = ov.yMax;
        if (ov.unit)          merged.unit  = ov.unit;
        if (ov.title)         merged.title = ov.title;
        if (ov.trigger)       merged.trigger = { ...(merged.trigger || {}), ...ov.trigger };

        return merged;
    }

    /**
     * Apply saved title override to the card's h3, if any.
     */
    function applyTitle(canvasId) {
        const ov = get(canvasId);
        if (!ov || !ov.title) return;
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const card = canvas.closest('.chart-card');
        const h3 = card?.querySelector('.chart-header h3') || card?.querySelector('.chart-title');
        if (h3) h3.textContent = ov.title;
    }

    /**
     * Apply all saved title overrides across the page.
     */
    function applyAllTitles() {
        document.querySelectorAll('canvas[id]').forEach(c => applyTitle(c.id));
    }

    return { get, set, remove, apply, applyTitle, applyAllTitles };
})();
