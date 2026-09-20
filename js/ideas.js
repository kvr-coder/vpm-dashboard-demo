/**
 * VPM Ideas Tracker
 * Per-tier standalone CRUD module for the CI & Ideas tab.
 * Stages: 0=Declined | 1=Generated | 2=Prioritized | 3=Implementation | 4=Validated
 * localStorage key: vpm-ideas-{tierId}
 */
const VPMIdeasTracker = (function () {
    'use strict';

    const STORE_PREFIX = 'vpm-ideas';
    const CTR_PREFIX   = 'vpm-ideas-ctr';  // monotonic idea number per tier
    let   _tierId      = 1;

    function _storeKey()  { return `${STORE_PREFIX}-${_tierId}`; }
    function _ctrKey()    { return `${CTR_PREFIX}-${_tierId}`; }

    // ── Stage definitions ──────────────────────────────────────────────────
    const STAGES = [
        { value: 0, label: 'Declined / Abandoned',   short: '0 – Declined',     cls: 'idea-stage-0' },
        { value: 1, label: '1 – Idea Generated',     short: '1 – Generated',    cls: 'idea-stage-1' },
        { value: 2, label: '2 – Idea Prioritized',   short: '2 – Prioritized',  cls: 'idea-stage-2' },
        { value: 3, label: '3 – Implementation',     short: '3 – In Progress',  cls: 'idea-stage-3' },
        { value: 4, label: '4 – Implemented / Validated', short: '4 – Done',    cls: 'idea-stage-4' },
    ];

    const CATEGORIES = ['Safety', 'Cost', 'Quality', 'Efficiency', 'Environment'];
    const TYPES      = ['JDI', 'Project', 'Abandon'];

    // ── Storage ───────────────────────────────────────────────────────────

    function _load() {
        try {
            const raw = JSON.parse(localStorage.getItem(_storeKey()) || '[]');
            return raw.map(_migrateActivities);
        }
        catch (e) { return []; }
    }

    function _save(ideas) {
        try { localStorage.setItem(_storeKey(), JSON.stringify(ideas)); }
        catch (e) { console.warn('[Ideas] Save failed:', e); }
    }

    function _nextId() {
        let n = parseInt(localStorage.getItem(_ctrKey()) || '0') + 1;
        localStorage.setItem(_ctrKey(), String(n));
        return n;
    }

    function _addIdea(idea) {
        const ideas = _load();
        idea.id = _nextId();
        ideas.push(idea);
        _save(ideas);
        return idea;
    }

    function _deleteIdea(id) {
        _save(_load().filter(i => i.id !== id));
    }

    function _updateIdea(id, changes) {
        const ideas = _load();
        const idx   = ideas.findIndex(i => i.id === id);
        if (idx < 0) return;
        Object.assign(ideas[idx], changes);
        _save(ideas);
    }

    function _blankIdea() {
        return {
            id: null,
            date: new Date().toISOString().slice(0, 10),
            title: '',
            originator: '',
            description: '',
            benefits: '',
            categories: [],
            type: 'JDI',
            assignedTo: '',
            implementationPlan: '',
            activities: [],          // [{ label, when, done }]
            signOff: '',
            stage: 1,
            reportBenefits: ''
        };
    }

    // Migrate legacy implementationDate / done strings → activities array
    function _migrateActivities(idea) {
        if (!Array.isArray(idea.activities)) {
            const when = idea.implementationDate || '';
            const done = idea.done || '';
            idea.activities = (when || done) ? [{ label: '', when, done }] : [];
        }
        return idea;
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    function _autoResize(ta) {
        ta.style.height = 'auto';
        ta.style.height = ta.scrollHeight + 'px';
    }

    function _esc(s) {
        return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function _stageHtml(stage) {
        const s = STAGES[stage] || STAGES[1];
        return `<span class="idea-stage-badge ${s.cls}">${_esc(s.short)}</span>`;
    }

    function _catHtml(cats) {
        if (!cats || !cats.length) return '<span class="idea-none">—</span>';
        return cats.map(c => `<span class="idea-cat-tag">${_esc(c)}</span>`).join(' ');
    }

    // ── Add form ───────────────────────────────────────────────────────────

    function _buildAddForm(wrap) {
        const form = document.createElement('div');
        form.className = 'ideas-add-form';
        form.innerHTML = `
            <div class="ideas-add-grid">
                <div class="ideas-field">
                    <label>Date</label>
                    <input type="date" id="idea-new-date" value="${new Date().toISOString().slice(0,10)}">
                </div>
                <div class="ideas-field">
                    <label>Title</label>
                    <input type="text" id="idea-new-title" placeholder="Idea title">
                </div>
                <div class="ideas-field">
                    <label>Originator</label>
                    <input type="text" id="idea-new-originator" placeholder="Name">
                </div>
                <div class="ideas-field ideas-field-wide">
                    <label>Description</label>
                    <textarea id="idea-new-desc" rows="2" placeholder="Describe the idea…"></textarea>
                </div>
                <div class="ideas-field ideas-field-wide">
                    <label>Benefits</label>
                    <input type="text" id="idea-new-benefits" placeholder="Expected benefits…">
                </div>
                <div class="ideas-field">
                    <label>Categories</label>
                    <div class="ideas-cat-checks">
                        ${CATEGORIES.map(c => `<label class="ideas-check-lbl"><input type="checkbox" class="idea-cat-cb" value="${c}"> ${c}</label>`).join('')}
                    </div>
                </div>
                <div class="ideas-field">
                    <label>Type</label>
                    <select id="idea-new-type">
                        ${TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
                    </select>
                </div>
                <div class="ideas-field">
                    <label>Stage</label>
                    <select id="idea-new-stage">
                        ${STAGES.map(s => `<option value="${s.value}"${s.value===1?' selected':''}>${s.label}</option>`).join('')}
                    </select>
                </div>
                <div class="ideas-field">
                    <label>Assigned To</label>
                    <input type="text" id="idea-new-assigned" placeholder="Name">
                </div>
            </div>
            <div class="ideas-add-actions">
                <button class="ideas-submit-btn" id="idea-submit-btn">+ Add Idea</button>
            </div>`;

        // Auto-resize add form textarea
        const _descTa = form.querySelector('#idea-new-desc');
        _descTa.addEventListener('input', () => _autoResize(_descTa));

        form.querySelector('#idea-submit-btn').addEventListener('click', () => {
            const title = form.querySelector('#idea-new-title').value.trim();
            if (!title) {
                _flash(form.querySelector('#idea-submit-btn'), 'Title is required');
                return;
            }
            const cats = Array.from(form.querySelectorAll('.idea-cat-cb:checked')).map(cb => cb.value);
            _addIdea({
                date:               form.querySelector('#idea-new-date').value,
                title:              title,
                originator:         form.querySelector('#idea-new-originator').value.trim(),
                description:        form.querySelector('#idea-new-desc').value.trim(),
                benefits:           form.querySelector('#idea-new-benefits').value.trim(),
                categories:         cats,
                type:               form.querySelector('#idea-new-type').value,
                assignedTo:         form.querySelector('#idea-new-assigned').value.trim(),
                implementationPlan: '',
                activities:         [],
                signOff:            '',
                stage:              parseInt(form.querySelector('#idea-new-stage').value),
                reportBenefits:     ''
            });
            render(_tierId); // re-render
        });

        wrap.appendChild(form);
    }

    // ── Table ──────────────────────────────────────────────────────────────

    function _buildTable(wrap) {
        const ideas = _load();

        // tbody is declared early so filter closures can reference it
        let tbody;

        // ── Filter bar ────────────────────────────────────────────────────
        const filterBar = document.createElement('div');
        filterBar.className = 'ideas-filter-bar';

        const filterLabel = document.createElement('span');
        filterLabel.className = 'ideas-filter-label';
        filterLabel.textContent = 'Filter:';
        filterBar.appendChild(filterLabel);

        let _activeFilter = null; // null = All

        const _applyFilter = (val) => {
            _activeFilter = val;
            filterBar.querySelectorAll('.ideas-filter-btn').forEach(b => {
                b.classList.toggle('ideas-filter-active', b.dataset.fv === String(val ?? ''));
            });
            if (!tbody) return;
            tbody.querySelectorAll('.ideas-row').forEach(row => {
                const show = _activeFilter === null || row.classList.contains(`ideas-row-stage-${_activeFilter}`);
                row.style.display = show ? '' : 'none';
            });
        };

        // Build All + one button per stage
        [{ label: 'All', value: null, cls: 'ideas-filter-btn-all' },
         ...STAGES.map(s => ({ label: s.short, value: s.value, cls: s.cls }))
        ].forEach(item => {
            const count = item.value === null
                ? ideas.length
                : ideas.filter(i => i.stage === item.value).length;

            const btn = document.createElement('button');
            btn.className = `ideas-filter-btn ${item.cls}${item.value === null ? ' ideas-filter-active' : ''}`;
            btn.dataset.fv = String(item.value ?? '');
            btn.innerHTML = `${_esc(item.label)} <span class="ideas-filter-count">${count}</span>`;
            btn.addEventListener('click', () => _applyFilter(item.value));
            filterBar.appendChild(btn);
        });

        wrap.appendChild(filterBar);

        // ── Table ──────────────────────────────────────────────────────────
        const tableWrap = document.createElement('div');
        tableWrap.className = 'ideas-table-wrap';

        const table = document.createElement('table');
        table.className = 'ideas-table';
        table.innerHTML = `<thead>
            <tr>
                <th class="idea-col-id">#</th>
                <th class="idea-col-date">Date</th>
                <th class="idea-col-title">Idea Title</th>
                <th class="idea-col-orig">Originator</th>
                <th class="idea-col-desc">Description</th>
                <th class="idea-col-ben">Benefits</th>
                <th class="idea-col-cat">Category</th>
                <th class="idea-col-type">Type</th>
                <th class="idea-col-assign">Assigned To</th>
                <th class="idea-col-plan">Implementation Plan</th>
                <th class="idea-col-when">When</th>
                <th class="idea-col-done">Done</th>
                <th class="idea-col-sign">Sign Off</th>
                <th class="idea-col-stage">Stage</th>
                <th class="idea-col-rep">Report Benefits?</th>
                <th class="idea-col-act"></th>
            </tr>
        </thead>`;

        tbody = document.createElement('tbody');

        if (!ideas.length) {
            tbody.innerHTML = `<tr><td colspan="16" class="ideas-empty">No ideas yet — add the first one above.</td></tr>`;
        } else {
            // Sort: stage ascending, then date
            const sorted = [...ideas].sort((a, b) => {
                if (a.stage !== b.stage) return a.stage - b.stage;
                return (a.date || '').localeCompare(b.date || '');
            });
            sorted.forEach(idea => tbody.appendChild(_buildRow(idea)));
        }

        table.appendChild(tbody);
        tableWrap.appendChild(table);
        wrap.appendChild(tableWrap);
    }

    function _buildRow(idea) {
        const tr = document.createElement('tr');
        tr.className = `ideas-row ideas-row-stage-${idea.stage}`;
        tr.dataset.id = idea.id;

        tr.innerHTML = `
            <td class="idea-col-id idea-id-cell">${idea.id}</td>
            <td class="idea-col-date">${_esc(idea.date || '')}</td>
            <td class="idea-col-title idea-editable" data-field="title">${_esc(idea.title || '')}</td>
            <td class="idea-col-orig idea-editable" data-field="originator">${_esc(idea.originator || '')}</td>
            <td class="idea-col-desc idea-editable idea-cell-long" data-field="description">${_esc(idea.description || '')}</td>
            <td class="idea-col-ben idea-editable" data-field="benefits">${_esc(idea.benefits || '')}</td>
            <td class="idea-col-cat">${_catHtml(idea.categories)}</td>
            <td class="idea-col-type">
                <select class="idea-inline-sel" data-field="type">
                    ${TYPES.map(t => `<option${t===idea.type?' selected':''}>${t}</option>`).join('')}
                </select>
            </td>
            <td class="idea-col-assign idea-editable" data-field="assignedTo">${_esc(idea.assignedTo || '')}</td>
            <td class="idea-col-plan idea-editable idea-cell-long" data-field="implementationPlan">${_esc(idea.implementationPlan || '')}</td>
            <td class="idea-col-when idea-acts-cell"></td>
            <td class="idea-col-done idea-acts-cell"></td>
            <td class="idea-col-sign idea-editable" data-field="signOff">${_esc(idea.signOff || '')}</td>
            <td class="idea-col-stage">
                <select class="idea-inline-sel idea-stage-sel" data-field="stage">
                    ${STAGES.map(s => `<option value="${s.value}"${s.value===idea.stage?' selected':''}>${s.label}</option>`).join('')}
                </select>
            </td>
            <td class="idea-col-rep">
                <select class="idea-inline-sel" data-field="reportBenefits">
                    <option value="">—</option>
                    <option value="Yes"${idea.reportBenefits==='Yes'?' selected':''}>Yes</option>
                    <option value="No"${idea.reportBenefits==='No'?' selected':''}>No</option>
                </select>
            </td>
            <td class="idea-col-act">
                <button class="idea-del-btn" title="Delete idea">&times;</button>
            </td>`;

        // Delete
        tr.querySelector('.idea-del-btn').addEventListener('click', () => {
            if (confirm(`Delete idea #${idea.id} "${idea.title}"?`)) {
                _deleteIdea(idea.id);
                tr.remove();
                // Show empty message if no rows left
                const tbody = tr.closest('tbody');
                if (tbody && !tbody.querySelector('.ideas-row')) {
                    tbody.innerHTML = `<tr><td colspan="16" class="ideas-empty">No ideas yet — add the first one above.</td></tr>`;
                }
            }
        });

        // Inline selects (type, stage, reportBenefits)
        tr.querySelectorAll('.idea-inline-sel').forEach(sel => {
            sel.addEventListener('change', () => {
                const field = sel.dataset.field;
                const val   = field === 'stage' ? parseInt(sel.value) : sel.value;
                _updateIdea(idea.id, { [field]: val });
                idea[field] = val;
                // Re-colour row on stage change
                if (field === 'stage') {
                    tr.className = `ideas-row ideas-row-stage-${val}`;
                }
            });
        });

        // Inline text edit: click any .idea-editable cell to edit
        tr.querySelectorAll('.idea-editable').forEach(td => {
            td.addEventListener('click', () => {
                if (td.querySelector('input, textarea')) return;
                const field   = td.dataset.field;
                const isLong  = ['description','implementationPlan'].includes(field);
                const orig    = td.textContent;
                if (isLong) {
                    td.innerHTML = `<textarea class="idea-inline-input idea-inline-ta">${_esc(orig)}</textarea>`;
                } else {
                    td.innerHTML = `<input class="idea-inline-input" value="${_esc(orig)}" type="text">`;
                }
                const inp = td.querySelector('input, textarea');
                inp.focus(); inp.select();
                if (isLong) {
                    requestAnimationFrame(() => _autoResize(inp));
                    inp.addEventListener('input', () => _autoResize(inp));
                }
                const commit = () => {
                    const newVal = inp.value;
                    _updateIdea(idea.id, { [field]: newVal });
                    idea[field] = newVal;
                    td.textContent = newVal;   // sets raw text; CSS pre-wrap keeps line breaks
                    if (isLong) td.classList.add('idea-cell-long');
                };
                inp.addEventListener('blur', commit);
                inp.addEventListener('keydown', e => {
                    if (!isLong && e.key === 'Enter') { e.preventDefault(); inp.blur(); }
                    if (e.key === 'Escape') { td.textContent = orig; }
                });
            });
        });

        // Build the multi-activity When / Done cells
        _buildActivitiesCells(idea, tr);

        return tr;
    }

    // ── Activities (When / Done) multi-date cells ──────────────────────────

    function _buildActivitiesCells(idea, tr) {
        const whenTd = tr.querySelector('.idea-col-when.idea-acts-cell');
        const doneTd = tr.querySelector('.idea-col-done.idea-acts-cell');
        if (!whenTd || !doneTd) return;

        function _refresh() {
            _renderWhenTd();
            _renderDoneTd();
        }

        function _renderWhenTd() {
            whenTd.innerHTML = '';
            const list = document.createElement('div');
            list.className = 'idea-acts-list';

            (idea.activities || []).forEach((act, idx) => {
                const row = document.createElement('div');
                row.className = 'idea-act-row';

                const dateInp = document.createElement('input');
                dateInp.type = 'date';
                dateInp.className = 'idea-act-date-inp';
                dateInp.value = act.when || '';
                dateInp.title = 'Target date';
                dateInp.addEventListener('change', () => {
                    idea.activities[idx].when = dateInp.value;
                    _updateIdea(idea.id, { activities: idea.activities });
                });

                const delBtn = document.createElement('button');
                delBtn.className = 'idea-act-del';
                delBtn.innerHTML = '&times;';
                delBtn.title = 'Remove activity';
                delBtn.addEventListener('click', () => {
                    idea.activities.splice(idx, 1);
                    _updateIdea(idea.id, { activities: idea.activities });
                    _refresh();
                });

                row.appendChild(dateInp);
                row.appendChild(delBtn);
                list.appendChild(row);
            });

            const addBtn = document.createElement('button');
            addBtn.className = 'idea-act-add';
            addBtn.textContent = '+ Add date';
            addBtn.addEventListener('click', () => {
                if (!idea.activities) idea.activities = [];
                idea.activities.push({ label: '', when: '', done: '' });
                _updateIdea(idea.id, { activities: idea.activities });
                _refresh();
            });

            whenTd.appendChild(list);
            whenTd.appendChild(addBtn);
        }

        function _renderDoneTd() {
            doneTd.innerHTML = '';
            const list = document.createElement('div');
            list.className = 'idea-acts-list';

            (idea.activities || []).forEach((act, idx) => {
                const row = document.createElement('div');
                row.className = 'idea-act-row';

                const dateInp = document.createElement('input');
                dateInp.type = 'date';
                dateInp.className = `idea-act-date-inp idea-act-done-inp${act.done ? ' idea-act-done-filled' : ''}`;
                dateInp.value = act.done || '';
                dateInp.title = 'Completion date';
                dateInp.addEventListener('change', () => {
                    idea.activities[idx].done = dateInp.value;
                    dateInp.classList.toggle('idea-act-done-filled', !!dateInp.value);
                    _updateIdea(idea.id, { activities: idea.activities });
                });

                const delBtn = document.createElement('button');
                delBtn.className = 'idea-act-del';
                delBtn.innerHTML = '&times;';
                delBtn.title = 'Remove';
                delBtn.addEventListener('click', () => {
                    idea.activities.splice(idx, 1);
                    _updateIdea(idea.id, { activities: idea.activities });
                    _refresh();
                });

                row.appendChild(dateInp);
                row.appendChild(delBtn);
                list.appendChild(row);
            });

            const addBtn = document.createElement('button');
            addBtn.className = 'idea-act-add';
            addBtn.textContent = '+ Add date';
            addBtn.addEventListener('click', () => {
                if (!idea.activities) idea.activities = [];
                idea.activities.push({ label: '', when: '', done: '' });
                _updateIdea(idea.id, { activities: idea.activities });
                _refresh();
            });

            doneTd.appendChild(list);
            doneTd.appendChild(addBtn);
        }

        _refresh();
    }

    // ── Legend / stage summary ─────────────────────────────────────────────

    function _buildStageSummary(wrap) {
        const ideas = _load();
        const counts = [0, 0, 0, 0, 0];
        ideas.forEach(i => { if (counts[i.stage] !== undefined) counts[i.stage]++; });

        const bar = document.createElement('div');
        bar.className = 'ideas-stage-bar';
        bar.innerHTML = STAGES.map((s, i) =>
            `<span class="ideas-stage-pill ${s.cls}">${_esc(s.short)} <strong>${counts[i]}</strong></span>`
        ).join('');
        wrap.appendChild(bar);
    }

    // ── Flash helper ───────────────────────────────────────────────────────

    function _flash(btn, msg) {
        const orig = btn.textContent;
        btn.textContent = msg;
        btn.style.background = 'var(--danger-dim)';
        btn.style.color      = 'var(--danger)';
        setTimeout(() => { btn.textContent = orig; btn.style.background = ''; btn.style.color = ''; }, 2000);
    }

    // ── Public API ─────────────────────────────────────────────────────────

    function render(tierId) {
        _tierId = tierId || 1;
        const wrap = document.getElementById('ideas-tracker-wrap');
        if (!wrap) return;
        wrap.innerHTML = '';

        _buildAddForm(wrap);
        _buildTable(wrap);   // filter bar with counts is built inside _buildTable
    }

    return { render, load: _load, addIdea: _addIdea, deleteIdea: _deleteIdea, updateIdea: _updateIdea };

})();
