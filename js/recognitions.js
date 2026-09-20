/**
 * VPM Recognitions Module
 * Standalone recognition tracker with full CRUD.
 * Columns: Date | By | Cultural Belief | Detail of Success | To Whom | How | Newsletter | iConnect
 */
const VPMRecognitions = (function () {
    'use strict';

    const STORE_PREFIX = 'vpm-recognitions';
    let   _tierId     = 1; // set at render() time — isolates data per tier
    function _storeKey() { return `${STORE_PREFIX}-${_tierId}`; }

    const CULTURAL_BELIEFS = [
        'Be agile',
        'Be performance driven',
        'Be customer centric',
        'Be people focused',
        "Live the Schneiders' legacy, our Noble Purpose"
    ];

    const HOW_OPTIONS = ['E-card', 'Points', 'Certificate', 'Public Shoutout', 'Other'];

    // ── Storage ───────────────────────────────────────────────────────────

    function load() {
        try { return JSON.parse(localStorage.getItem(_storeKey()) || '[]'); }
        catch (e) { return []; }
    }

    function save(entries) {
        localStorage.setItem(_storeKey(), JSON.stringify(entries));
    }

    function addEntry(entry) {
        const entries = load();
        entry.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        entries.unshift(entry); // newest first
        save(entries);
        return entry;
    }

    function deleteEntry(id) {
        save(load().filter(e => e.id !== id));
    }

    function updateEntry(id, changes) {
        const entries = load();
        const idx = entries.findIndex(e => e.id === id);
        if (idx < 0) return;
        Object.assign(entries[idx], changes);
        save(entries);
    }

    // ── Rendering ─────────────────────────────────────────────────────────

    function render(tierId) {
        _tierId = tierId || 1; // set tier context before any storage access
        const wrap = document.getElementById('recognition-table-wrap');
        if (!wrap) return;

        const entries = load();
        wrap.innerHTML = '';

        // Add-new form row
        const addRow = _buildAddRow();
        wrap.appendChild(addRow);

        // Table
        const table = document.createElement('table');
        table.className = 'recog-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Date</th>
                    <th>By</th>
                    <th>Cultural Belief</th>
                    <th>Recognition — Detail of Success</th>
                    <th>To Whom</th>
                    <th>How</th>
                    <th>Newsletter?</th>
                    <th>iConnect?</th>
                    <th></th>
                </tr>
            </thead>
            <tbody id="recog-tbody"></tbody>`;
        wrap.appendChild(table);

        const tbody = table.querySelector('#recog-tbody');
        if (entries.length === 0) {
            tbody.innerHTML = `<tr class="recog-empty-row"><td colspan="9">No recognitions yet — add the first one above.</td></tr>`;
        } else {
            entries.forEach(e => tbody.appendChild(_buildRow(e)));
        }
    }

    function _buildAddRow() {
        const form = document.createElement('div');
        form.className = 'recog-add-form';
        form.innerHTML = `
            <div class="recog-add-grid">
                <div class="recog-field">
                    <label>Date</label>
                    <input type="date" id="recog-new-date" value="${new Date().toISOString().slice(0,10)}">
                </div>
                <div class="recog-field">
                    <label>By</label>
                    <input type="text" id="recog-new-by" placeholder="Your name">
                </div>
                <div class="recog-field">
                    <label>Cultural Belief</label>
                    <select id="recog-new-belief">
                        ${CULTURAL_BELIEFS.map(b => `<option value="${b}">${b}</option>`).join('')}
                    </select>
                </div>
                <div class="recog-field recog-field-wide">
                    <label>Recognition — Detail of Success</label>
                    <textarea id="recog-new-detail" rows="2" placeholder="Describe the achievement..."></textarea>
                </div>
                <div class="recog-field">
                    <label>To Whom</label>
                    <input type="text" id="recog-new-towhom" placeholder="Name(s)">
                </div>
                <div class="recog-field">
                    <label>How</label>
                    <select id="recog-new-how">
                        ${HOW_OPTIONS.map(h => `<option value="${h}">${h}</option>`).join('')}
                    </select>
                </div>
                <div class="recog-field">
                    <label>Newsletter?</label>
                    <select id="recog-new-newsletter">
                        <option value="">—</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                    </select>
                </div>
                <div class="recog-field">
                    <label>iConnect?</label>
                    <select id="recog-new-iconnect">
                        <option value="">—</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                    </select>
                </div>
            </div>
            <div class="recog-add-actions">
                <button class="recog-submit-btn" id="recog-submit-btn">+ Add Recognition</button>
            </div>`;

        form.querySelector('#recog-submit-btn').addEventListener('click', () => {
            const detail = form.querySelector('#recog-new-detail').value.trim();
            const by     = form.querySelector('#recog-new-by').value.trim();
            const toWhom = form.querySelector('#recog-new-towhom').value.trim();
            if (!detail || !by || !toWhom) {
                _flash(form.querySelector('#recog-submit-btn'), 'Fill in By, Detail, and To Whom');
                return;
            }
            addEntry({
                date:          form.querySelector('#recog-new-date').value,
                by:            by,
                culturalBelief: form.querySelector('#recog-new-belief').value,
                detail:        detail,
                toWhom:        toWhom,
                how:           form.querySelector('#recog-new-how').value,
                newsletter:    form.querySelector('#recog-new-newsletter').value,
                iconnect:      form.querySelector('#recog-new-iconnect').value,
            });
            render();
        });

        return form;
    }

    function _buildRow(e) {
        const tr = document.createElement('tr');
        tr.className = 'recog-row';
        tr.dataset.id = e.id;

        const howClass = e.how === 'E-card' ? 'recog-badge-ecard'
                       : e.how === 'Points' ? 'recog-badge-points'
                       : 'recog-badge-other';

        tr.innerHTML = `
            <td class="recog-date">${e.date || ''}</td>
            <td class="recog-by">${_esc(e.by || '')}</td>
            <td class="recog-belief">${_esc(e.culturalBelief || '')}</td>
            <td class="recog-detail">${_esc(e.detail || '')}</td>
            <td class="recog-towhom">${_esc(e.toWhom || '')}</td>
            <td class="recog-how"><span class="recog-badge ${howClass}">${_esc(e.how || '')}</span></td>
            <td class="recog-yn">${_yn(e.newsletter)}</td>
            <td class="recog-yn">${_yn(e.iconnect)}</td>
            <td class="recog-actions-cell">
                <button class="recog-del-btn" title="Delete">×</button>
            </td>`;

        tr.querySelector('.recog-del-btn').addEventListener('click', () => {
            if (confirm('Delete this recognition?')) { deleteEntry(e.id); render(); }
        });

        // Inline edit on click
        tr.querySelectorAll('td:not(.recog-actions-cell)').forEach((td, idx) => {
            td.addEventListener('dblclick', () => _startInlineEdit(e, tr));
        });

        return tr;
    }

    function _startInlineEdit(e, tr) {
        if (tr.classList.contains('recog-editing')) return;
        tr.classList.add('recog-editing');
        tr.innerHTML = `
            <td><input type="date" class="recog-edit-input" data-field="date" value="${e.date || ''}"></td>
            <td><input type="text" class="recog-edit-input" data-field="by" value="${_esc(e.by || '')}"></td>
            <td>
                <select class="recog-edit-input" data-field="culturalBelief">
                    ${CULTURAL_BELIEFS.map(b => `<option value="${b}"${e.culturalBelief===b?' selected':''}>${b}</option>`).join('')}
                </select>
            </td>
            <td><textarea class="recog-edit-input recog-edit-detail" data-field="detail" rows="2">${_esc(e.detail || '')}</textarea></td>
            <td><input type="text" class="recog-edit-input" data-field="toWhom" value="${_esc(e.toWhom || '')}"></td>
            <td>
                <select class="recog-edit-input" data-field="how">
                    ${HOW_OPTIONS.map(h => `<option value="${h}"${e.how===h?' selected':''}>${h}</option>`).join('')}
                </select>
            </td>
            <td>
                <select class="recog-edit-input" data-field="newsletter">
                    <option value="">—</option>
                    <option value="Yes"${e.newsletter==='Yes'?' selected':''}>Yes</option>
                    <option value="No"${e.newsletter==='No'?' selected':''}>No</option>
                </select>
            </td>
            <td>
                <select class="recog-edit-input" data-field="iconnect">
                    <option value="">—</option>
                    <option value="Yes"${e.iconnect==='Yes'?' selected':''}>Yes</option>
                    <option value="No"${e.iconnect==='No'?' selected':''}>No</option>
                </select>
            </td>
            <td class="recog-actions-cell">
                <button class="recog-save-edit-btn">Save</button>
                <button class="recog-cancel-edit-btn">Cancel</button>
            </td>`;

        tr.querySelector('.recog-save-edit-btn').addEventListener('click', () => {
            const changes = {};
            tr.querySelectorAll('[data-field]').forEach(el => { changes[el.dataset.field] = el.value; });
            updateEntry(e.id, changes);
            render();
        });
        tr.querySelector('.recog-cancel-edit-btn').addEventListener('click', () => render());
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    function _esc(str) {
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function _yn(val) {
        if (!val) return '<span class="recog-yn-dash">—</span>';
        return val === 'Yes'
            ? '<span class="recog-yn-yes">Yes</span>'
            : '<span class="recog-yn-no">No</span>';
    }

    function _flash(btn, msg) {
        const orig = btn.textContent;
        btn.textContent = msg;
        btn.style.background = 'var(--danger-dim)';
        btn.style.color = 'var(--danger)';
        setTimeout(() => { btn.textContent = orig; btn.style.background = ''; btn.style.color = ''; }, 2000);
    }

    // ── Public API ────────────────────────────────────────────────────────

    return { render, load, addEntry, deleteEntry, updateEntry };

})();
