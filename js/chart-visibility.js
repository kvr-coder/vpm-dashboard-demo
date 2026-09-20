/**
 * VPM Chart Day-of-Week Visibility
 * Each chart card can be assigned specific days to show on.
 * If today is not in the card's assigned days, the card is hidden.
 * A "Show all" toggle in the header overrides all day filters.
 */
const VPMChartVisibility = (function () {
    'use strict';

    const STORAGE_PREFIX   = 'vpm-chart-days-v1-';
    const HIDDEN_KEY       = 'vpm-hidden-cards-v1';

    // Maps canvas ID → metric manifest ID for data-entry button routing
    const CANVAS_METRIC_MAP = {
        'safety-observations-chart':  'saf_obs_act',
        'safety-nearmiss-chart':      'saf_obs_ost',
        'people-sickleave-chart':     'ppl_sick_act',
        'people-turnover-sal-chart':  'ppl_turnover_sal',
        'people-turnover-hr-chart':   'ppl_turnover_hr',
        'quality-fpy-chart':          'qly_fpy_cam3',
        'quality-ncmr-ost-chart':     'qly_ncmr_ost',
        'quality-ncmr-cc-chart':      'qly_ncmr_cc',
        'prod-cc-daily-chart':        'prd_vol_cc',
        'prod-cc-volume-chart':       'prd_vol_cc',
        'prod-ost-daily-chart':       'prd_vol_ost',
        'prod-ost-volume-chart':      'prd_vol_ost',
        'prod-idl-ost-chart':         'cst_idl_ost',
        'prod-idl-cc-chart':          'cst_idl_cc',
        'sc-service-jp-chart':        'sc_sr_jp',
        'sc-service-row-chart':       'sc_sr_row',
        'sc-dioh-chart':              'sc_dioh',
        'cost-idl-ost-chart':         'cst_idl_ost',
        'cost-idl-cc-chart':          'cst_idl_cc',
        'overview-production-chart':  'prd_vol_cc',
        'overview-safety-chart':      'saf_obs_act',
        'overview-cost-chart':        'cst_idl_ost',
        'overview-people-chart':      'ppl_sick_act',
        // People
        'people-headcount-chart':     'ppl_headcount',
        'people-open-sal-chart':      'ppl_open_sal',
        'people-open-hr-chart':       'ppl_open_hr',
        // Cost
        'cost-eff-ost-chart':         'cst_eff_ost',
        'cost-eff-cc-chart':          'cst_eff_cc',
        'cost-waste-ost-chart':       'cst_waste_ost',
        'cost-waste-cc-chart':        'cst_waste_cc',
        'cost-eur-variances-chart':   'cst_eur_var',
    };
    const DAYS             = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    // JS: 0=Sun, 1=Mon…6=Sat  →  our 0=Mon…6=Sun
    const TODAY_IDX        = (new Date().getDay() + 6) % 7;

    let showAllOverride = false;

    // ── Permanent hide helpers (built-in cards only; custom cards are fully deleted) ──

    function loadHidden() {
        try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]')); }
        catch (e) { return new Set(); }
    }

    function saveHidden(set) {
        localStorage.setItem(HIDDEN_KEY, JSON.stringify([...set]));
    }

    function permanentlyHideCard(cardId) {
        const set = loadHidden();
        set.add(cardId);
        saveHidden(set);
    }

    function restoreAllHidden() {
        localStorage.removeItem(HIDDEN_KEY);
        document.querySelectorAll('.chart-card-hidden').forEach(c => c.classList.remove('chart-card-hidden'));
    }

    function applyHidden() {
        const set = loadHidden();
        document.querySelectorAll('.chart-card').forEach(card => {
            const id = getCardId(card);
            if (id && set.has(id)) card.classList.add('chart-card-hidden');
        });
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    function slugify(str) {
        return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }

    function getCardId(card) {
        const h3 = card.querySelector('.chart-header h3');
        return h3 ? slugify(h3.textContent.trim()) : null;
    }

    function loadDays(cardId) {
        try {
            const raw = localStorage.getItem(STORAGE_PREFIX + cardId);
            if (raw) {
                const arr = JSON.parse(raw);
                if (Array.isArray(arr) && arr.length === 7) return arr;
            }
        } catch (e) { /* ignore */ }
        return [true, true, true, true, true, true, true]; // all days by default
    }

    function saveDays(cardId, days) {
        localStorage.setItem(STORAGE_PREFIX + cardId, JSON.stringify(days));
    }

    function isAllDays(days) {
        return days.every(Boolean);
    }

    // ── Visibility ────────────────────────────────────────────────────────────

    function applyVisibility() {
        document.querySelectorAll('.chart-card').forEach(card => {
            if (showAllOverride) {
                card.classList.remove('chart-day-hidden');
                return;
            }
            const id = getCardId(card);
            if (!id) return;
            const days    = loadDays(id);
            const visible = isAllDays(days) || days[TODAY_IDX];
            card.classList.toggle('chart-day-hidden', !visible);
        });
    }

    // ── Inline rename for calendar/grid cards ─────────────────────────────────

    function _inlineRename(card) {
        const h3 = card.querySelector('.chart-header h3');
        if (!h3 || h3.querySelector('input')) return; // already editing

        const original = h3.textContent.trim();
        h3.textContent = '';

        const input = document.createElement('input');
        input.type      = 'text';
        input.value     = original;
        input.className = 'chart-rename-input';
        input.style.cssText = 'width:100%;background:transparent;border:none;border-bottom:1px solid var(--accent);' +
            'color:inherit;font:inherit;font-size:inherit;font-weight:inherit;outline:none;padding:0;';
        h3.appendChild(input);
        input.focus();
        input.select();

        const commit = () => {
            const val = input.value.trim() || original;
            h3.textContent = val;
            // Persist via localStorage
            const cardId = card.dataset.cardId || card.querySelector('[id]')?.id;
            if (cardId) {
                try { localStorage.setItem('vpm-card-title-' + cardId, val); } catch (_) {}
            }
        };

        input.addEventListener('blur', commit);
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
            if (e.key === 'Escape') { input.value = original; input.blur(); }
        });
    }

    // ── Day-picker injection ──────────────────────────────────────────────────

    function buildDayPicker(card) {
        const id = getCardId(card);
        if (!id) return;

        const header = card.querySelector('.chart-header');
        if (!header) return;

        const canvas    = card.querySelector('canvas');
        const metricId  = canvas && CANVAS_METRIC_MAP[canvas.id];
        const hasCanvas = !!canvas;
        const isCalendar = !hasCanvas && !card.dataset.customChartId;

        // +Data button — ONLY when there is a known metric mapping for this canvas
        if (metricId && !card.querySelector('.chart-data-btn')) {
            const dataBtn = document.createElement('button');
            dataBtn.className = 'chart-data-btn';
            dataBtn.title     = 'Add or edit data for this chart';
            dataBtn.textContent = '+Data';
            dataBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof VPMAdmin !== 'undefined') VPMAdmin.openForMetric(metricId);
            });
            const firstBtn = header.querySelector('button');
            firstBtn ? header.insertBefore(dataBtn, firstBtn) : header.appendChild(dataBtn);
        }

        if (card.querySelector('.chart-day-toggle-btn')) return; // rest already built

        // ✏ edit button
        if (!card.querySelector('.chart-edit-icon-btn')) {
            const editBtn = document.createElement('button');
            editBtn.className   = 'chart-edit-icon-btn';
            editBtn.title       = isCalendar ? 'Rename' : 'Edit / configure this chart';
            editBtn.textContent = '✏';
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const customId = card.dataset.customChartId;
                if (customId && typeof VPMAdmin !== 'undefined') {
                    VPMAdmin.editChart(customId);
                } else if (isCalendar) {
                    // Calendars: inline rename only
                    _inlineRename(card);
                } else if (canvas?.id && typeof VPMAdmin !== 'undefined') {
                    const title = card.querySelector('.chart-header h3')?.textContent?.trim();
                    VPMAdmin.editBuiltinChart(canvas.id, title);
                } else {
                    // No canvas ID and not a known card type — inline rename only
                    _inlineRename(card);
                }
            });
            header.appendChild(editBtn);
        }

        // ⊖  hide button (temporary — "Show all charts" restores)
        if (!card.querySelector('.chart-hide-btn')) {
            const hideBtn = document.createElement('button');
            hideBtn.className   = 'chart-hide-btn';
            hideBtn.title       = 'Hide temporarily (restore with "Show all charts")';
            hideBtn.textContent = '⊖';
            hideBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                permanentlyHideCard(id);   // stored so it survives reload until Show All
                card.classList.add('chart-card-hidden');
            });
            header.appendChild(hideBtn);
        }

        // ×  permanent delete button
        if (!card.querySelector('.chart-dismiss-btn')) {
            const xBtn = document.createElement('button');
            xBtn.className   = 'chart-dismiss-btn';
            xBtn.title       = 'Delete permanently from layout';
            xBtn.textContent = '×';
            xBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!confirm('Permanently remove this chart from the layout?')) return;
                if (!confirm('Are you sure? This cannot be undone.')) return;
                const customId = card.dataset.customChartId;
                if (customId && typeof VPMAdmin !== 'undefined') {
                    VPMAdmin.removeChartNoConfirm(customId);
                } else {
                    permanentlyHideCard(id);
                    card.remove();
                }
            });
            header.appendChild(xBtn);
        }

        // Toggle button (small calendar icon, top-right of header)
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'chart-day-toggle-btn';
        toggleBtn.title     = 'Configure which days this chart is shown';
        toggleBtn.innerHTML = '&#x1F4C5;'; // 📅
        header.appendChild(toggleBtn);

        // Picker panel
        const picker = document.createElement('div');
        picker.className = 'chart-day-picker';
        picker.hidden    = true;

        const pickerInner = document.createElement('div');
        pickerInner.className = 'chart-day-picker-inner';

        const label = document.createElement('p');
        label.className   = 'chart-day-picker-label';
        label.textContent = 'Show on days:';
        pickerInner.appendChild(label);

        const dayRow = document.createElement('div');
        dayRow.className = 'chart-day-row';

        DAYS.forEach((day, i) => {
            const lbl = document.createElement('label');
            lbl.className = 'chart-day-label' + (i === TODAY_IDX ? ' chart-day-today' : '');

            const cb = document.createElement('input');
            cb.type    = 'checkbox';
            cb.checked = loadDays(id)[i];

            cb.addEventListener('change', () => {
                const current = loadDays(id);
                current[i]    = cb.checked;
                saveDays(id, current);
                // Update dot indicator
                updatePickerDot(toggleBtn, current);
                applyVisibility();
            });

            lbl.appendChild(cb);
            lbl.appendChild(document.createTextNode(day));
            dayRow.appendChild(lbl);
        });

        pickerInner.appendChild(dayRow);

        // "Reset to all days" link
        const resetLink = document.createElement('button');
        resetLink.className   = 'chart-day-reset-btn';
        resetLink.textContent = 'Show every day';
        resetLink.addEventListener('click', () => {
            const allTrue = [true, true, true, true, true, true, true];
            saveDays(id, allTrue);
            picker.querySelectorAll('input[type=checkbox]').forEach(cb => { cb.checked = true; });
            updatePickerDot(toggleBtn, allTrue);
            applyVisibility();
        });
        pickerInner.appendChild(resetLink);

        picker.appendChild(pickerInner);
        // Attach to the header so the picker drops directly below the title row,
        // not at the bottom of the (potentially very tall) chart card.
        header.appendChild(picker);

        // Dot indicator on toggle button when days are restricted
        updatePickerDot(toggleBtn, loadDays(id));

        // Toggle picker open/close
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close all other open pickers first
            document.querySelectorAll('.chart-day-picker:not([hidden])').forEach(p => {
                if (p !== picker) p.hidden = true;
            });
            picker.hidden = !picker.hidden;
        });

        // Close picker when clicking outside the header
        document.addEventListener('click', (e) => {
            if (!header.contains(e.target)) picker.hidden = true;
        });
    }

    function updatePickerDot(btn, days) {
        btn.classList.toggle('chart-day-restricted', !isAllDays(days));
        btn.title = isAllDays(days)
            ? 'Configure which days this chart is shown'
            : 'Days restricted — click to change';
    }

    // ── Public init ───────────────────────────────────────────────────────────

    // Maps KPI card CSS class → metric manifest ID
    const KPI_METRIC_MAP = {
        'kpi-safety':     'saf_obs_act',
        'kpi-people':     'ppl_sick_act',
        'kpi-quality':    'qly_fpy_cam3',
        'kpi-production': 'prd_vol_cc',
        'kpi-supply':     'sc_sr_jp',
        'kpi-cost':       'cst_idl_ost',
    };

    function attachKPIDataButtons() {
        document.querySelectorAll('.kpi-card').forEach(card => {
            if (card.querySelector('.kpi-data-btn')) return; // already attached
            const metricId = Object.entries(KPI_METRIC_MAP)
                .find(([cls]) => card.classList.contains(cls))?.[1];
            if (!metricId) return;
            const btn = document.createElement('button');
            btn.className = 'kpi-data-btn';
            btn.title     = 'Edit metric data';
            btn.textContent = '+Data';
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof VPMAdmin !== 'undefined') VPMAdmin.openForMetric(metricId);
            });
            const header = card.querySelector('.kpi-header');
            if (header) header.appendChild(btn);
        });
    }

    function _restoreCalendarTitles() {
        document.querySelectorAll('.chart-card').forEach(card => {
            if (card.querySelector('canvas') || card.dataset.customChartId) return;
            const inner = card.querySelector('[id]');
            const cardId = card.dataset.cardId || inner?.id;
            if (!cardId) return;
            try {
                const saved = localStorage.getItem('vpm-card-title-' + cardId);
                if (saved) {
                    const h3 = card.querySelector('.chart-header h3');
                    if (h3) h3.textContent = saved;
                }
            } catch (_) {}
        });
    }

    function attachAll() {
        document.querySelectorAll('.chart-card').forEach(buildDayPicker);
        _restoreCalendarTitles();
        attachKPIDataButtons();
        applyVisibility();
        applyHidden();
    }

    function init() {
        attachAll();

        // "Show all charts" — restores day-filter override AND temporarily hidden cards
        const btn = document.getElementById('showAllChartsBtn');
        if (btn) {
            btn.addEventListener('click', () => {
                showAllOverride = !showAllOverride;
                btn.classList.toggle('active', showAllOverride);
                btn.textContent = showAllOverride ? 'Restore filters' : 'Show all charts';
                if (showAllOverride) {
                    restoreAllHidden();
                } else {
                    applyHidden();
                }
                applyVisibility();
            });
        }

        // Re-attach after chart re-renders (new cards may appear)
        document.addEventListener('vpm:requestRender', () => {
            setTimeout(attachAll, 250);
        });
    }

    return { init, applyVisibility, attachAll, restoreAllHidden };
})();
