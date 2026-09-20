/**
 * VPM Meeting Score Card (Feedback)
 * Monthly view: all days in the selected month, newest first.
 * Ratings cycle: empty → green (OK) → red (Not OK) → empty.
 * Future dates are shown but locked (greyed, not clickable).
 * Weekends subtly dimmed — teams typically have no meeting.
 * localStorage key: vpm-feedback
 */
const VPMFeedback = (function () {
    'use strict';

    const STORE_PREFIX = 'vpm-feedback';
    let   _tierId     = 1; // set at render() time — isolates data per tier
    function _storeKey() { return `${STORE_PREFIX}-${_tierId}`; }

    const MONTH_NAMES = [
        'January','February','March','April','May','June',
        'July','August','September','October','November','December'
    ];

    const COLUMNS = [
        {
            key:   'comm',
            short: 'Comm. & Respect',
            full:  'Communication & Respect – We spoke and listened consciously, one at a time, ensuring everyone\'s voice was heard and respected'
        },
        {
            key:   'decision',
            short: 'Decision Clarity',
            full:  'Decision Clarity & Shared Responsibility – Our decisions were based on company values, with clear ownership & shared accountability'
        },
        {
            key:   'trust',
            short: 'Trust & Collaboration',
            full:  'Trust & Constructive Collaboration – We expressed ourselves openly, respected each other\'s competence, and supported team members'
        },
        {
            key:   'time',
            short: 'On Time',
            full:  'Meeting starts and finished on time (10:30–10:55)'
        },
        {
            key:   'focus',
            short: 'Focus & Efficiency',
            full:  'Focus & Efficiency – Our discussions were well structured, purposeful, & kept us moving toward our short-term goals'
        },
        {
            key:   'issues',
            short: 'Unsolved Issues',
            full:  'Unsolved issues recorded – point person identified – more than 2 accountability actions in red'
        }
    ];

    // ── Storage ───────────────────────────────────────────────────────────

    function _loadAll() {
        try {
            const raw = localStorage.getItem(_storeKey());
            if (raw) {
                const arr = JSON.parse(raw);
                if (Array.isArray(arr)) return arr;
            }
        } catch (e) {}
        return [];
    }

    function _saveAll(entries) {
        try { localStorage.setItem(_storeKey(), JSON.stringify(entries)); }
        catch (e) { console.warn('[Feedback] Save failed:', e); }
    }

    function _blankEntry(dateStr) {
        const ratings = {};
        COLUMNS.forEach(c => { ratings[c.key] = null; });
        return { date: dateStr, ratings, didWell: '', couldDoBetter: '' };
    }

    function _upsert(entry) {
        const all = _loadAll();
        const idx = all.findIndex(e => e.date === entry.date);
        if (idx >= 0) all[idx] = entry;
        else all.push(entry);
        _saveAll(all);
    }

    // ── Date helpers ──────────────────────────────────────────────────────

    function _todayStr() {
        const n = new Date();
        return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
    }

    /** All days in given year/month (0-indexed month), oldest first (day 1 → last day). */
    function _getMonthDates(year, month) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const dates = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const mm = String(month + 1).padStart(2, '0');
            const dd = String(d).padStart(2, '0');
            dates.push(`${year}-${mm}-${dd}`);
        }
        return dates;
    }

    function _isWeekend(dateStr) {
        const day = new Date(dateStr + 'T12:00:00').getDay();
        return day === 0 || day === 6; // Sun = 0, Sat = 6
    }

    function _formatDate(dateStr) {
        const d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    }

    // ── Period selector helpers ───────────────────────────────────────────

    function _buildPeriodSelectors(wrap) {
        const now  = new Date();
        const curY = now.getFullYear();
        const curM = now.getMonth();

        // Month select
        const selMonth = document.createElement('select');
        selMonth.id = 'fbMonthSelect';
        selMonth.className = 'fb-period-select';
        MONTH_NAMES.forEach((name, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = name;
            if (i === curM) opt.selected = true;
            selMonth.appendChild(opt);
        });

        // Year select — 2020 through current year + 5
        const selYear = document.createElement('select');
        selYear.id = 'fbYearSelect';
        selYear.className = 'fb-period-select';
        for (let y = 2020; y <= curY + 5; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            if (y === curY) opt.selected = true;
            selYear.appendChild(opt);
        }

        const row = document.createElement('div');
        row.className = 'fb-period-row';
        row.appendChild(selMonth);
        row.appendChild(selYear);
        wrap.appendChild(row);

        // Re-render table on change
        selMonth.addEventListener('change', () => _renderTable(wrap));
        selYear.addEventListener('change',  () => _renderTable(wrap));
    }

    function _getSelectedPeriod() {
        const selMonth = document.getElementById('fbMonthSelect');
        const selYear  = document.getElementById('fbYearSelect');
        const now = new Date();
        return {
            month: selMonth ? parseInt(selMonth.value) : now.getMonth(),
            year:  selYear  ? parseInt(selYear.value)  : now.getFullYear()
        };
    }

    // ── Render ────────────────────────────────────────────────────────────

    function render(tierId) {
        _tierId = tierId || 1; // set tier context before any storage access
        const wrap = document.getElementById('feedback-table-wrap');
        if (!wrap) return;
        wrap.innerHTML = '';

        _buildPeriodSelectors(wrap);
        _renderTable(wrap);
    }

    function _renderTable(wrap) {
        // Remove old table + alert (keep period selectors)
        wrap.querySelectorAll('.fb-table-section, .fb-alert').forEach(el => el.remove());

        const { year, month } = _getSelectedPeriod();
        const today  = _todayStr();
        const dates  = _getMonthDates(year, month);
        const all    = _loadAll();
        const entryMap = {};
        all.forEach(e => { entryMap[e.date] = e; });

        // Check consecutive red days (only for current month)
        const now = new Date();
        const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
        let redDays = 0;
        if (isCurrentMonth) {
            // Only check past + today dates, newest first
            const pastDates = dates.filter(d => d <= today);
            redDays = _countConsecutiveRedDays(pastDates, entryMap);
        }

        const section = document.createElement('div');
        section.className = 'fb-table-section';

        // Alert banner
        if (redDays >= 3) {
            const alertEl = document.createElement('div');
            alertEl.className = 'fb-alert';
            alertEl.innerHTML = `<strong>3 consecutive days with red scores</strong> — team should discuss how to improve. Consider opening a 3C.`;
            section.appendChild(alertEl);
        }

        // Outer wrapper handles vertical scroll → makes thead sticky work correctly
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'fb-table-wrapper';

        const scroller = document.createElement('div');
        scroller.className = 'fb-scroll-wrap';

        const table = document.createElement('table');
        table.className = 'feedback-table';

        // ── Header ──────────────────────────────────────────────────────
        const thead = document.createElement('thead');
        const htr   = document.createElement('tr');

        const thDate = document.createElement('th');
        thDate.className = 'fb-th-date';
        thDate.textContent = 'Date';
        htr.appendChild(thDate);

        COLUMNS.forEach(col => {
            const th = document.createElement('th');
            th.className = 'fb-th-rating';
            th.title     = col.full;
            th.textContent = col.short;
            htr.appendChild(th);
        });

        const thDid = document.createElement('th');
        thDid.className = 'fb-th-text';
        thDid.textContent = 'Did Well';
        htr.appendChild(thDid);

        const thBetter = document.createElement('th');
        thBetter.className = 'fb-th-text';
        thBetter.textContent = 'Could Do Better';
        htr.appendChild(thBetter);

        thead.appendChild(htr);
        table.appendChild(thead);

        // ── Body ─────────────────────────────────────────────────────────
        const tbody = document.createElement('tbody');

        dates.forEach(dateStr => {
            const entry   = entryMap[dateStr] || _blankEntry(dateStr);
            const isToday   = dateStr === today;
            const isFuture  = dateStr > today;
            const isWeekend = _isWeekend(dateStr);

            const tr = document.createElement('tr');
            tr.className = [
                'fb-row',
                isToday   ? 'fb-row-today'   : '',
                isFuture  ? 'fb-row-future'  : '',
                isWeekend ? 'fb-row-weekend' : ''
            ].filter(Boolean).join(' ');

            // Date cell
            const tdDate = document.createElement('td');
            tdDate.className = 'fb-td-date';
            let dateHtml = _formatDate(dateStr);
            if (isToday) dateHtml += ' <span class="fb-today-badge">Today</span>';
            // Weekend: indicated by row styling only — no text badge (avoids overflow)
            tdDate.innerHTML = dateHtml;
            tr.appendChild(tdDate);

            // Rating cells
            COLUMNS.forEach(col => {
                const td = document.createElement('td');
                td.className = 'fb-td-rating';
                const val = entry.ratings[col.key] || '';
                td.dataset.val = val;

                if (isFuture) {
                    td.classList.add('fb-td-locked');
                    td.title = 'Future date';
                } else {
                    td.title = val === 'green'  ? 'No incident — click to change'
                             : val === 'red'    ? 'OSHA — click to change'
                             : val === 'blue'   ? 'Near miss / PSIF — click to change'
                             : val === 'orange' ? 'First Aid — click to change'
                             : 'Click to rate';

                    td.addEventListener('click', () => {
                        const cur  = td.dataset.val;
                        const next = cur === ''       ? 'green'
                                   : cur === 'green'  ? 'red'
                                   : cur === 'red'    ? 'blue'
                                   : cur === 'blue'   ? 'orange'
                                   : '';
                        td.dataset.val = next;
                        td.title = next === 'green'  ? 'No incident — click to change'
                                 : next === 'red'    ? 'OSHA — click to change'
                                 : next === 'blue'   ? 'Near miss / PSIF — click to change'
                                 : next === 'orange' ? 'First Aid — click to change'
                                 : 'Click to rate';
                        const fresh = entryMap[dateStr] || _blankEntry(dateStr);
                        fresh.ratings[col.key] = next !== '' ? next : null;
                        entryMap[dateStr] = fresh;
                        _upsert(fresh);
                    });
                }

                tr.appendChild(td);
            });

            // Text cells
            ['didWell', 'couldDoBetter'].forEach(field => {
                const td = document.createElement('td');
                td.className = 'fb-td-text';

                const ta = document.createElement('textarea');
                ta.className   = 'fb-textarea';
                ta.value       = entry[field] || '';
                ta.placeholder = field === 'didWell' ? 'What went well…' : 'What to improve…';
                ta.disabled    = isFuture;

                // Auto-resize: grow with content, never shrink below one line
                function _resize() {
                    ta.style.height = 'auto';
                    ta.style.height = ta.scrollHeight + 'px';
                }
                ta.addEventListener('input', _resize);
                // Set initial height after paint so scrollHeight is accurate
                requestAnimationFrame(_resize);

                ta.addEventListener('change', () => {
                    const fresh = entryMap[dateStr] || _blankEntry(dateStr);
                    fresh[field] = ta.value.trim();
                    entryMap[dateStr] = fresh;
                    _upsert(fresh);
                });

                td.appendChild(ta);
                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        scroller.appendChild(table);
        tableWrapper.appendChild(scroller);
        section.appendChild(tableWrapper);

        // Legend
        const legend = document.createElement('div');
        legend.className = 'fb-legend';
        legend.innerHTML = `
            <span class="fb-legend-item"><span class="fb-legend-swatch fb-swatch-green"></span>Green = No Incident / No Trigger Met</span>
            <span class="fb-legend-item"><span class="fb-legend-swatch fb-swatch-red"></span>Red = OSHA / Trigger Reached</span>
            <span class="fb-legend-item"><span class="fb-legend-swatch fb-swatch-blue"></span>Blue = Near miss / PSIF</span>
            <span class="fb-legend-item"><span class="fb-legend-swatch fb-swatch-orange"></span>Orange = First Aid</span>
            <span class="fb-legend-sep">·</span>
            <span class="fb-legend-hint">Click cell to cycle colour · If 3 days are red, discuss how to improve — consider opening a 3C</span>`;
        section.appendChild(legend);

        wrap.appendChild(section);
    }

    function _countConsecutiveRedDays(dates, entryMap) {
        let count = 0;
        for (const dateStr of dates) {
            if (_isWeekend(dateStr)) continue; // skip weekends in streak count
            const entry    = entryMap[dateStr];
            if (!entry) break;
            const hasRated = COLUMNS.some(c => entry.ratings[c.key] !== null);
            const hasRed   = COLUMNS.some(c => entry.ratings[c.key] === 'red');
            if (!hasRated) break;
            if (hasRed) count++;
            else break;
        }
        return count;
    }

    return { render, load: _loadAll };

})();
