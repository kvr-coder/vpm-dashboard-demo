/**
 * VPM Action Items v2 — Accountability System
 * CRUD, update trail, reschedule tracking, people tagging, filters, export/import
 */
const VPMActions = {
    items: [],
    STORAGE_KEY: 'vpm-action-items',
    PEOPLE_KEY:  'vpm-people-list',
    _expandedId: null,

    // ========================================
    // INIT & EVENTS
    // ========================================

    init() {
        this.load();
        this._migrate();
        this.bindEvents();
        this._populateFilterDropdowns();
        this.render();
        this.renderStats();
    },

    bindEvents() {
        const $ = id => document.getElementById(id);
        $('addActionBtn')?.addEventListener('click', () => this.openModal());
        $('exportActionsBtn')?.addEventListener('click', () => this.exportJSON());
        $('importActionsBtn')?.addEventListener('click', () => $('importActionsFile')?.click());
        $('importActionsFile')?.addEventListener('change', (e) => this.importJSON(e));
        $('managePeopleBtn')?.addEventListener('click', () => this._showManagePeople());

        $('modalClose')?.addEventListener('click', () => this.closeModal());
        $('modalCancel')?.addEventListener('click', () => this.closeModal());
        $('actionForm')?.addEventListener('submit', (e) => this.handleSubmit(e));

        // Filters — render on any change
        ['filterPerson', 'filterStatus', 'filterCategory', 'filterPriority', 'filterCreatedBy'].forEach(id => {
            $(id)?.addEventListener('change', () => this.render());
        });

        // Modal overlay click
        $('actionModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'actionModal') this.closeModal();
        });
    },

    // ========================================
    // PEOPLE LIST (shared, editable)
    // ========================================

    _currentBoardId() {
        return (typeof VPMEscalation !== 'undefined') ? VPMEscalation.getCurrentTier() : 1;
    },

    _currentBoardLabel() {
        const id = this._currentBoardId();
        if (typeof VPMTierManager !== 'undefined') {
            const meta = VPMTierManager.getTierMeta(id);
            return meta ? meta.label : 'T' + id;
        }
        return 'T' + id;
    },

    /** Get people for a specific board. Falls back to global list. */
    getPeopleForBoard(boardId) {
        try {
            const stored = localStorage.getItem(this.PEOPLE_KEY + '-t' + boardId);
            if (stored) return JSON.parse(stored);
        } catch (_) {}
        return this._getGlobalPeople();
    },

    /** Get people for the currently active board. */
    getPeople() {
        return this.getPeopleForBoard(this._currentBoardId());
    },

    /** Get ALL people across all boards (for filters). */
    getAllPeople() {
        const allSet = new Set();
        // Collect from all board-specific lists
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.PEOPLE_KEY + '-t')) {
                try {
                    JSON.parse(localStorage.getItem(key)).forEach(p => allSet.add(p));
                } catch (_) {}
            }
        }
        // Also from global
        this._getGlobalPeople().forEach(p => allSet.add(p));
        // Also from existing action items
        this.items.forEach(item => {
            if (item.assignedTo) allSet.add(item.assignedTo);
            if (item.createdBy) allSet.add(item.createdBy);
        });
        return [...allSet].sort();
    },

    _getGlobalPeople() {
        try {
            const stored = localStorage.getItem(this.PEOPLE_KEY);
            if (stored) return JSON.parse(stored);
        } catch (_) {}
        return ['Alex','Jordan','Sam','Taylor','Casey','Morgan','Riley','Quinn'];
    },

    savePeople(list) {
        localStorage.setItem(this.PEOPLE_KEY + '-t' + this._currentBoardId(), JSON.stringify(list));
        this._populateFilterDropdowns();
    },

    _populateFilterDropdowns() {
        const allPeople = this.getAllPeople();
        const _fillSelect = (id, addAll) => {
            const el = document.getElementById(id);
            if (!el || el.tagName !== 'SELECT') return;
            const current = el.value;
            el.innerHTML = (addAll ? '<option value="">All</option>' : '<option value="">Select</option>') +
                allPeople.map(p => '<option' + (p === current ? ' selected' : '') + '>' + this.escapeHtml(p) + '</option>').join('');
        };
        _fillSelect('filterPerson', true);
        _fillSelect('filterCreatedBy', true);
    },

    // Custom prefix-match autocomplete for people inputs
    _attachAutocomplete(input) {
        if (!input || input._acAttached) return;
        input._acAttached = true;

        const wrap = document.createElement('div');
        wrap.className = 'ac-wrap';
        input.parentNode.insertBefore(wrap, input);
        wrap.appendChild(input);

        const dropdown = document.createElement('div');
        dropdown.className = 'ac-dropdown';
        wrap.appendChild(dropdown);

        let selectedIdx = -1;

        const refresh = () => {
            const val = input.value.trim().toLowerCase();
            const people = this.getPeople();
            dropdown.innerHTML = '';
            selectedIdx = -1;

            if (!val) { dropdown.style.display = 'none'; return; }

            const matches = people.filter(p => p.toLowerCase().startsWith(val));

            if (matches.length === 0) {
                dropdown.style.display = 'none';
                return;
            }

            matches.slice(0, 6).forEach((name, i) => {
                const row = document.createElement('div');
                row.className = 'ac-item';
                // Bold the matched prefix
                const bold = name.substring(0, val.length);
                const rest = name.substring(val.length);
                row.innerHTML = '<span class="ac-name"><strong>' + this.escapeHtml(bold) + '</strong>' + this.escapeHtml(rest) + '</span>';
                row.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    input.value = name;
                    dropdown.style.display = 'none';
                });
                dropdown.appendChild(row);
            });
            dropdown.style.display = '';
        };

        input.addEventListener('input', refresh);
        input.addEventListener('focus', refresh);
        input.addEventListener('blur', () => {
            setTimeout(() => {
                dropdown.style.display = 'none';
                // If typed name is new, offer to save
                const val = input.value.trim();
                if (val && !this.getPeople().some(p => p.toLowerCase() === val.toLowerCase())) {
                    if (confirm('Add "' + val + '" to the people list?')) {
                        const arr = this.getPeople();
                        arr.push(val);
                        this.savePeople(arr);
                    }
                }
            }, 150);
        });

        input.addEventListener('keydown', (e) => {
            const items = dropdown.querySelectorAll('.ac-item');
            if (!items.length) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIdx = Math.min(selectedIdx + 1, items.length - 1);
                items.forEach((it, i) => it.classList.toggle('ac-active', i === selectedIdx));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIdx = Math.max(selectedIdx - 1, 0);
                items.forEach((it, i) => it.classList.toggle('ac-active', i === selectedIdx));
            } else if (e.key === 'Enter' && selectedIdx >= 0) {
                e.preventDefault();
                const name = items[selectedIdx]?.querySelector('.ac-name')?.textContent;
                if (name) { input.value = name; dropdown.style.display = 'none'; }
            } else if (e.key === 'Tab' && selectedIdx >= 0) {
                const name = items[selectedIdx]?.querySelector('.ac-name')?.textContent;
                if (name) input.value = name;
                dropdown.style.display = 'none';
            }
        });
    },

    _showManagePeople() {
        const existing = document.getElementById('managePeopleModal');
        if (existing) existing.remove();

        const people = this.getPeople();
        const boardLabel = this._currentBoardLabel();
        const modal = document.createElement('div');
        modal.id = 'managePeopleModal';
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
            <div class="modal" style="max-width:360px">
                <div class="modal-header">
                    <h3>Manage People — ${this.escapeHtml(boardLabel)}</h3>
                    <button class="modal-close" id="mpClose">&times;</button>
                </div>
                <div style="padding:12px 16px">
                    <div id="mpList" style="max-height:300px;overflow-y:auto"></div>
                    <div style="display:flex;gap:6px;margin-top:10px">
                        <input type="text" id="mpNewName" placeholder="Add person..." style="flex:1;padding:6px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg-secondary);color:var(--text-primary)">
                        <button class="btn btn-primary btn-sm" id="mpAddBtn">Add</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);

        const renderList = () => {
            const list = this.getPeople();
            document.getElementById('mpList').innerHTML = list.map((p, i) =>
                '<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border)">' +
                    '<span>' + this.escapeHtml(p) + '</span>' +
                    '<button class="btn btn-sm btn-danger mp-del" data-idx="' + i + '" style="padding:2px 6px;font-size:10px">&times;</button>' +
                '</div>'
            ).join('');
            document.querySelectorAll('.mp-del').forEach(btn => {
                btn.addEventListener('click', () => {
                    const arr = this.getPeople();
                    arr.splice(parseInt(btn.dataset.idx), 1);
                    this.savePeople(arr);
                    renderList();
                });
            });
        };
        renderList();

        document.getElementById('mpAddBtn').addEventListener('click', () => {
            const name = document.getElementById('mpNewName').value.trim();
            if (!name) return;
            const arr = this.getPeople();
            if (!arr.includes(name)) { arr.push(name); this.savePeople(arr); }
            document.getElementById('mpNewName').value = '';
            renderList();
        });
        document.getElementById('mpClose').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    },

    // ========================================
    // DATA MIGRATION (v1 → v2)
    // ========================================

    _migrate() {
        let dirty = false;
        this.items.forEach(item => {
            if (!item.createdBy)       { item.createdBy = '';            dirty = true; }
            if (!item.additionalPeople){ item.additionalPeople = [];     dirty = true; }
            if (!item.originalDueDate) { item.originalDueDate = item.dueDate || item.createdDate; dirty = true; }
            if (item.rescheduleCount === undefined) { item.rescheduleCount = 0;  dirty = true; }
            if (!item.priority)        { item.priority = 'normal';       dirty = true; }
            if (!item.updates)         { item.updates = [];              dirty = true; }
            if (!item.tier)            { item.tier = null;               dirty = true; }
            if (item.sourceMessageId === undefined) { item.sourceMessageId = null; dirty = true; }
            if (item.sourceTier === undefined)      { item.sourceTier = null;      dirty = true; }
        });
        if (dirty) this.save();
    },

    // ========================================
    // CRUD
    // ========================================

    generateId() {
        return 'ACT-' + Date.now().toString(36).toUpperCase();
    },

    add(item) {
        item.id = this.generateId();
        const today = new Date().toISOString().split('T')[0];
        item.createdDate     = today;
        item.originalDueDate = item.dueDate || today;
        item.rescheduleCount = 0;
        item.updates         = item.updates || [];
        item.additionalPeople = item.additionalPeople || [];
        item.priority        = item.priority || 'normal';
        item.sourceMessageId = item.sourceMessageId || null;
        item.sourceTier      = item.sourceTier || null;
        this.items.push(item);
        this.save();
        this.render();
        this.renderStats();
        return item;
    },

    update(id, updates) {
        const idx = this.items.findIndex(i => i.id === id);
        if (idx === -1) return;
        const item = this.items[idx];

        // Track reschedule
        if (updates.dueDate && updates.dueDate !== item.dueDate) {
            item.updates.unshift({
                date: new Date().toISOString(),
                by: updates._changedBy || '',
                type: 'reschedule',
                text: '',
                oldValue: item.dueDate,
                newValue: updates.dueDate
            });
            item.rescheduleCount = (item.rescheduleCount || 0) + 1;
        }

        // Track status change
        if (updates.status && updates.status !== item.status) {
            item.updates.unshift({
                date: new Date().toISOString(),
                by: updates._changedBy || '',
                type: 'status-change',
                text: '',
                oldValue: item.status,
                newValue: updates.status
            });
        }

        // Track reassignment
        if (updates.assignedTo && updates.assignedTo !== item.assignedTo) {
            item.updates.unshift({
                date: new Date().toISOString(),
                by: updates._changedBy || '',
                type: 'reassign',
                text: '',
                oldValue: item.assignedTo,
                newValue: updates.assignedTo
            });
        }

        delete updates._changedBy;
        Object.assign(item, updates);
        this.save();
        this.render();
        this.renderStats();
    },

    addComment(id, text, by) {
        const item = this.items.find(i => i.id === id);
        if (!item || !text.trim()) return;
        item.updates.unshift({
            date: new Date().toISOString(),
            by: by || '',
            type: 'comment',
            text: text.trim(),
            oldValue: null,
            newValue: null
        });
        this.save();
        this.render();
    },

    addPerson(id, personName) {
        const item = this.items.find(i => i.id === id);
        if (!item) return;
        if (!item.additionalPeople) item.additionalPeople = [];
        if (!item.additionalPeople.includes(personName)) {
            item.additionalPeople.push(personName);
            item.updates.unshift({
                date: new Date().toISOString(),
                by: '',
                type: 'tag-add',
                text: '',
                oldValue: null,
                newValue: personName
            });
            this.save();
            this.render();
        }
    },

    remove(id) {
        this.items = this.items.filter(i => i.id !== id);
        this.save();
        this.render();
        this.renderStats();
    },

    getById(id) {
        return this.items.find(i => i.id === id) || null;
    },

    // ========================================
    // PERSISTENCE
    // ========================================

    save() {
        try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.items)); }
        catch (e) { console.warn('Failed to save action items:', e); }
    },

    load() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) this.items = JSON.parse(stored);
        } catch (e) { this.items = []; }
    },

    exportJSON() {
        const blob = new Blob([JSON.stringify(this.items, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'vpm-actions-' + new Date().toISOString().split('T')[0] + '.json';
        a.click();
        URL.revokeObjectURL(url);
    },

    importJSON(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (!Array.isArray(imported)) return;
                const existingIds = new Set(this.items.map(i => i.id));
                let added = 0;
                for (const item of imported) {
                    if (!existingIds.has(item.id)) { this.items.push(item); added++; }
                }
                this._migrate();
                this.save();
                this.render();
                this.renderStats();
                alert('Imported ' + added + ' items (' + (imported.length - added) + ' duplicates skipped)');
            } catch (_) { alert('Invalid JSON file'); }
        };
        reader.readAsText(file);
        event.target.value = '';
    },

    // ========================================
    // MODAL
    // ========================================

    openModal(item) {
        const modal = document.getElementById('actionModal');
        const form  = document.getElementById('actionForm');
        const title = document.getElementById('modalTitle');
        const personEl     = document.getElementById('actionPerson');
        const createdByEl  = document.getElementById('actionCreatedBy');
        const priorityEl   = document.getElementById('actionPriority');
        const addPeopleEl  = document.getElementById('actionAdditionalPeople');

        this._populateFilterDropdowns();

        if (item) {
            title.textContent = 'Edit Action Item';
            document.getElementById('actionId').value = item.id;
            document.getElementById('actionTitleInput').value = item.title;
            document.getElementById('actionDesc').value = item.description || '';
            if (personEl)    personEl.value = item.assignedTo || '';
            document.getElementById('actionCategory').value = item.category;
            document.getElementById('actionStatus').value = item.status;
            document.getElementById('actionDue').value = item.dueDate;
            if (createdByEl) { createdByEl.value = item.createdBy || ''; createdByEl.readOnly = true; }
            if (priorityEl)  priorityEl.value = item.priority || 'normal';
            if (addPeopleEl) addPeopleEl.value = (item.additionalPeople || []).join(', ');
        } else {
            title.textContent = 'Add Action Item';
            form.reset();
            document.getElementById('actionId').value = '';
            const next = new Date();
            next.setDate(next.getDate() + 7);
            document.getElementById('actionDue').value = next.toISOString().split('T')[0];
            // Remember last scribe for speed
            const lastScribe = sessionStorage.getItem('vpm-last-scribe') || '';
            if (createdByEl) { createdByEl.value = lastScribe; createdByEl.readOnly = false; }
            if (priorityEl)  priorityEl.value = 'normal';
            if (addPeopleEl) addPeopleEl.value = '';
        }

        modal.classList.add('active');
        // Attach autocomplete to people inputs
        this._attachAutocomplete(document.getElementById('actionPerson'));
        this._attachAutocomplete(document.getElementById('actionCreatedBy'));
        document.getElementById('actionTitleInput').focus();
    },

    closeModal() {
        document.getElementById('actionModal')?.classList.remove('active');
    },

    handleSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('actionId').value;
        const addPeopleRaw = document.getElementById('actionAdditionalPeople')?.value || '';
        const additionalPeople = addPeopleRaw.split(',').map(s => s.trim()).filter(Boolean);

        const raisedBy = document.getElementById('actionCreatedBy')?.value?.trim() || '';
        // Remember scribe for next time
        if (raisedBy) sessionStorage.setItem('vpm-last-scribe', raisedBy);

        const itemData = {
            title:            document.getElementById('actionTitleInput').value.trim(),
            description:      document.getElementById('actionDesc').value.trim(),
            assignedTo:       document.getElementById('actionPerson')?.value?.trim() || '',
            category:         document.getElementById('actionCategory').value,
            status:           document.getElementById('actionStatus').value,
            dueDate:          document.getElementById('actionDue').value,
            createdBy:        raisedBy,
            priority:         document.getElementById('actionPriority')?.value || 'normal',
            additionalPeople: additionalPeople,
            _changedBy:       raisedBy
        };

        if (id) {
            this.update(id, itemData);
        } else {
            this.add(itemData);
        }
        this.closeModal();
    },

    // ========================================
    // FILTERING
    // ========================================

    getFilteredItems() {
        const person    = document.getElementById('filterPerson')?.value    || '';
        const status    = document.getElementById('filterStatus')?.value    || '';
        const category  = document.getElementById('filterCategory')?.value  || '';
        const priority  = document.getElementById('filterPriority')?.value  || '';
        const createdBy = document.getElementById('filterCreatedBy')?.value || '';

        return this.items.filter(item => {
            if (person && item.assignedTo !== person &&
                !(item.additionalPeople || []).includes(person)) return false;
            if (status === 'overdue') {
                if (item.status === 'done' || new Date(item.dueDate) >= new Date()) return false;
            } else if (status && item.status !== status) return false;
            if (category && item.category !== category) return false;
            if (priority && item.priority !== priority) return false;
            if (createdBy && item.createdBy !== createdBy) return false;
            return true;
        });
    },

    // ========================================
    // RENDERING
    // ========================================

    render() {
        const tbody = document.getElementById('actionsTableBody');
        if (!tbody) return;

        const filtered = this.getFilteredItems();

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted)">No action items found. Click "+ Add Action" to create one.</td></tr>';
            return;
        }

        const STATUS = { 'new':'New', 'in-progress':'In Progress', 'blocked':'Blocked', 'done':'Done', 'overdue':'Overdue' };
        const PRIORITY_CLS = { critical:'act-pri-critical', high:'act-pri-high', normal:'act-pri-normal', low:'act-pri-low' };

        tbody.innerHTML = filtered.map(item => {
            const isOverdue = item.status !== 'done' && item.status !== 'blocked' && new Date(item.dueDate) < new Date();
            const displayStatus = isOverdue ? 'overdue' : item.status;
            const priCls = PRIORITY_CLS[item.priority] || 'act-pri-normal';
            const addCount = (item.additionalPeople || []).length;
            const reschedNote = item.rescheduleCount > 0
                ? ' <span class="act-resched">(rescheduled x' + item.rescheduleCount + ')</span>' : '';
            const isExpanded = this._expandedId === item.id;
            const sourceLabel = item.sourceTierLabel || (item.sourceTier ? 'T' + item.sourceTier : '');
            const sourceMetric = item.sourceMetric ? ' / ' + this.escapeHtml(item.sourceMetric) : '';
            const sourceTag = item.sourceMessageId || item.sourceTier
                ? '<span class="act-source-tag" title="Created from escalation board">From: ' + this.escapeHtml(sourceLabel) + sourceMetric + '</span> ' : '';

            let html = '<tr class="act-row' + (isExpanded ? ' act-row-expanded' : '') + '" data-act-id="' + item.id + '">' +
                '<td><code class="act-id">' + this.escapeHtml(item.id) + '</code></td>' +
                '<td>' +
                    sourceTag +
                    '<span class="act-pri-pill ' + priCls + '">' + (item.priority || 'normal') + '</span> ' +
                    '<span class="act-title-text">' + this.escapeHtml(item.title) + '</span>' +
                    (item.description ? '<div class="act-desc-snip">' + this.escapeHtml(item.description).substring(0, 80) + '</div>' : '') +
                '</td>' +
                '<td>' + this.escapeHtml(item.assignedTo || '') +
                    (addCount > 0 ? ' <span class="act-plus-tag">+' + addCount + '</span>' : '') +
                '</td>' +
                '<td><span class="act-cat">' + this.escapeHtml(item.category || '') + '</span></td>' +
                '<td><span class="status-badge status-' + displayStatus + '">' + (STATUS[displayStatus] || displayStatus) + '</span></td>' +
                '<td>' + (item.dueDate || '') + reschedNote + '</td>' +
                '<td class="act-created-col">' + (item.createdDate || '') +
                    (item.createdBy ? '<div class="act-created-by">by ' + this.escapeHtml(item.createdBy) + '</div>' : '') +
                '</td>' +
                '<td class="act-actions-col">' +
                    '<button class="btn btn-sm btn-secondary act-edit-btn" title="Edit">Edit</button> ' +
                    '<button class="btn btn-sm act-comment-btn" title="Expand/Comment">...</button> ' +
                    '<button class="btn btn-sm btn-danger act-del-btn" title="Delete">Del</button>' +
                '</td>' +
            '</tr>';

            // Expanded detail row
            if (isExpanded) {
                html += '<tr class="act-detail-row" data-act-id="' + item.id + '">' +
                    '<td colspan="8">' + this._renderDetailPanel(item) + '</td></tr>';
            }

            return html;
        }).join('');

        // Wire events
        this._wireTableEvents(tbody);
    },

    _wireTableEvents(tbody) {
        tbody.querySelectorAll('.act-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.closest('tr').dataset.actId;
                this.openModal(this.getById(id));
            });
        });
        tbody.querySelectorAll('.act-del-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Delete this action item?')) {
                    this.remove(btn.closest('tr').dataset.actId);
                }
            });
        });
        tbody.querySelectorAll('.act-comment-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.closest('tr').dataset.actId;
                this._expandedId = this._expandedId === id ? null : id;
                this.render();
            });
        });
        tbody.querySelectorAll('.act-row').forEach(row => {
            row.addEventListener('click', () => {
                const id = row.dataset.actId;
                this._expandedId = this._expandedId === id ? null : id;
                this.render();
            });
        });
        // Comment submit buttons in expanded rows
        tbody.querySelectorAll('.act-comment-submit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const panel = btn.closest('.act-detail-panel');
                const id    = panel.dataset.actId;
                const text  = panel.querySelector('.act-comment-input')?.value;
                const by    = panel.querySelector('.act-comment-by')?.value || '';
                if (text?.trim()) {
                    this.addComment(id, text, by);
                }
            });
        });
        // Add person buttons
        tbody.querySelectorAll('.act-add-person-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const panel = btn.closest('.act-detail-panel');
                const id    = panel.dataset.actId;
                const sel   = panel.querySelector('.act-add-person-sel');
                if (sel?.value) this.addPerson(id, sel.value);
            });
        });
        // Reschedule buttons
        tbody.querySelectorAll('.act-reschedule-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const panel   = btn.closest('.act-detail-panel');
                const id      = panel.dataset.actId;
                const dateEl  = panel.querySelector('.act-reschedule-date');
                if (dateEl?.value) {
                    this.update(id, { dueDate: dateEl.value });
                }
            });
        });
    },

    _renderDetailPanel(item) {
        const people = this.getPeople();
        const tagged = (item.additionalPeople || []).map(p => '<span class="act-tag-chip">' + this.escapeHtml(p) + '</span>').join(' ');

        // Update trail
        const trail = (item.updates || []).map(u => {
            const date = u.date ? new Date(u.date).toLocaleString() : '';
            const by   = u.by ? '<strong>' + this.escapeHtml(u.by) + '</strong>' : '<em>System</em>';
            let content = '';
            switch (u.type) {
                case 'comment':
                    content = '<div class="act-trail-comment">' + this.escapeHtml(u.text) + '</div>';
                    break;
                case 'reschedule':
                    content = 'Rescheduled: ' + u.oldValue + ' &rarr; ' + u.newValue +
                        (u.text ? ' &mdash; ' + this.escapeHtml(u.text) : '');
                    break;
                case 'status-change':
                    content = 'Status: ' + u.oldValue + ' &rarr; ' + u.newValue;
                    break;
                case 'reassign':
                    content = 'Reassigned: ' + this.escapeHtml(u.oldValue || '') + ' &rarr; ' + this.escapeHtml(u.newValue || '');
                    break;
                case 'tag-add':
                    content = 'Tagged: <strong>' + this.escapeHtml(u.newValue || '') + '</strong>';
                    break;
                default:
                    content = this.escapeHtml(u.text || '');
            }
            return '<div class="act-trail-item">' +
                '<div class="act-trail-meta">' + by + ' &middot; ' + date + '</div>' +
                '<div class="act-trail-body">' + content + '</div>' +
            '</div>';
        }).join('');

        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);

        return '<div class="act-detail-panel" data-act-id="' + item.id + '">' +
            // Info section
            '<div class="act-detail-info">' +
                (item.description ? '<div class="act-detail-desc">' + this.escapeHtml(item.description) + '</div>' : '') +
                '<div class="act-detail-meta">' +
                    'Created: <strong>' + (item.createdDate || '') + '</strong>' +
                    (item.createdBy ? ' by <strong>' + this.escapeHtml(item.createdBy) + '</strong>' : '') +
                    ' &middot; Original due: <strong>' + (item.originalDueDate || '') + '</strong>' +
                    (item.rescheduleCount > 0 ? ' &middot; Rescheduled <strong>' + item.rescheduleCount + 'x</strong>' : '') +
                '</div>' +
                '<div class="act-detail-people">' +
                    'Owner: <strong>' + this.escapeHtml(item.assignedTo || '') + '</strong>' +
                    (tagged ? ' &middot; Also: ' + tagged : '') +
                '</div>' +
            '</div>' +
            // Quick actions
            '<div class="act-detail-actions">' +
                '<div class="act-quick-row">' +
                    '<select class="act-add-person-sel" style="font-size:12px">' +
                        '<option value="">Tag person...</option>' +
                        people.filter(p => p !== item.assignedTo && !(item.additionalPeople || []).includes(p))
                            .map(p => '<option>' + this.escapeHtml(p) + '</option>').join('') +
                    '</select>' +
                    '<button class="btn btn-sm act-add-person-btn">Tag</button>' +
                    '<input type="date" class="act-reschedule-date" value="' + nextWeek.toISOString().split('T')[0] + '" style="font-size:12px">' +
                    '<button class="btn btn-sm act-reschedule-btn">Reschedule</button>' +
                '</div>' +
            '</div>' +
            // Comment input
            '<div class="act-comment-box">' +
                '<textarea class="act-comment-input" placeholder="Add an update or comment..." rows="2"></textarea>' +
                '<div class="act-comment-row">' +
                    '<select class="act-comment-by" style="font-size:12px">' +
                        '<option value="">Your name...</option>' +
                        people.map(p => '<option>' + this.escapeHtml(p) + '</option>').join('') +
                    '</select>' +
                    '<button class="btn btn-sm btn-primary act-comment-submit">Post Update</button>' +
                '</div>' +
            '</div>' +
            // Trail
            '<div class="act-trail">' +
                (trail || '<div class="act-trail-empty">No updates yet</div>') +
            '</div>' +
        '</div>';
    },

    renderStats() {
        const container = document.getElementById('actionsStats');
        if (!container) return;

        const total      = this.items.length;
        const newCount   = this.items.filter(i => i.status === 'new').length;
        const inProgress = this.items.filter(i => i.status === 'in-progress').length;
        const blocked    = this.items.filter(i => i.status === 'blocked').length;
        const done       = this.items.filter(i => i.status === 'done').length;
        const overdue    = this.items.filter(i => i.status !== 'done' && i.status !== 'blocked' && new Date(i.dueDate) < new Date()).length;
        const rescheduled = this.items.filter(i => i.rescheduleCount > 0).length;

        container.innerHTML =
            '<div class="stat-item"><span class="stat-count" style="color:var(--text-primary)">' + total + '</span> Total</div>' +
            '<div class="stat-item"><span class="stat-count" style="color:var(--accent)">' + newCount + '</span> New</div>' +
            '<div class="stat-item"><span class="stat-count" style="color:var(--warning)">' + inProgress + '</span> In Progress</div>' +
            (blocked > 0 ? '<div class="stat-item"><span class="stat-count" style="color:#f59e0b">' + blocked + '</span> Blocked</div>' : '') +
            '<div class="stat-item"><span class="stat-count" style="color:var(--success)">' + done + '</span> Done</div>' +
            (overdue > 0 ? '<div class="stat-item"><span class="stat-count" style="color:var(--danger)">' + overdue + '</span> Overdue</div>' : '') +
            (rescheduled > 0 ? '<div class="stat-item"><span class="stat-count" style="color:#8b5cf6">' + rescheduled + '</span> Rescheduled</div>' : '');
    },

    // ========================================
    // NAVIGATION (for cross-linking)
    // ========================================

    /** Navigate to Action Items tab and highlight a specific item */
    navigateTo(actionId) {
        // Switch to actions tab
        const navItem = document.querySelector('[data-tab="actions"]');
        if (navItem) navItem.click();
        // Expand the item
        this._expandedId = actionId;
        this.render();
        this.renderStats();
        // Scroll to it
        requestAnimationFrame(() => {
            const row = document.querySelector('.act-row[data-act-id="' + actionId + '"]');
            if (row) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                row.style.outline = '2px solid var(--accent)';
                setTimeout(() => { row.style.outline = ''; }, 3000);
            }
        });
    },

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }
};
