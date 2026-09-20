/**
 * VPM Data Seeder
 * Converts Excel-loaded data into Data Studio custom chart definitions.
 * Once seeded, charts persist in localStorage and no longer need Excel.
 */
const VPMDataSeeder = (function () {
    'use strict';

    // Trim trailing nulls (same logic as VPMCharts.trimNulls)
    function tn(arr) { if (!arr) return []; const a = [...arr]; while (a.length && a[a.length-1] === null) a.pop(); return a; }
    function pct(arr) { return tn(arr).map(v => v != null ? v * 100 : null); }
    function cum(arr) { const r = []; tn(arr).forEach((v, i) => r.push((r[i-1]||0) + (v||0))); return r; }

    // ── Chart seeds ─────────────────────────────────────────────────────

    const CHARTS = [
        // ═══ OVERVIEW ═══
        { id: 'builtin-ov-production', title: 'Daily Production Output', tab: 'overview', tpl: 'grouped-bar',
          ex: d => { const pr = d.production; if (!pr?.ccVolume) return null;
              return { type:'bar', labels: pr.ccVolume.dates, input: tn(pr.ccVolume.actual), inputLabel:'CC Daily Output',
                  input2: tn(pr.ostVolume?.actual || []), input2Label:'OST Daily Output', input2Color:'#22c55e', unit:'k', color:'#3b82f6' }; }},
        { id: 'builtin-ov-safety', title: 'Safety Observations (Cumulative)', tab: 'overview', tpl: 'bar-target',
          ex: d => { const s = d.safety; if (!s?.observations) return null;
              return { type:'bar', input: tn(s.observations.cumulative), inputLabel:'Observations (Cumulative)',
                  red: tn(s.observations.red), redLabel:'Target', color:'#3b82f6' }; }},
        { id: 'builtin-ov-cost', title: 'IDL % Overview', tab: 'overview', tpl: 'grouped-bar',
          ex: d => { const pr = d.production; if (!pr?.idlOst) return null;
              return { type:'bar', input: pct(pr.idlOst.daily), inputLabel:'Assembly IDL %',
                  input2: pct(pr.idlCC?.daily || []), input2Label:'CC IDL %', input2Color:'#22c55e', unit:'pct' }; }},
        { id: 'builtin-ov-people', title: 'Sick Leave Overview', tab: 'overview', tpl: 'line-target',
          ex: d => { const p = d.people; if (!p?.sickLeave) return null;
              return { input: tn(p.sickLeave.actual), inputLabel:'Sick Leave',
                  red: tn(p.sickLeave.target), redLabel:'Target Max', color:'#8b5cf6' }; }},

        // ═══ SAFETY ═══
        { id: 'builtin-safety-obs', title: 'Safety Observations - Cumulative vs Target', tab: 'safety', tpl: 'bar-target',
          ex: d => { const o = d.safety?.observations; if (!o) return null;
              return { type:'bar', labels: o.dayLabels, input: tn(o.cumulative), inputLabel:'Cumulative Observations',
                  red: tn(o.red), redLabel:'Target', color:'#3b82f6' }; }},
        { id: 'builtin-safety-nearmiss', title: 'Near Miss by Area (Assembly / CC)', tab: 'safety', tpl: 'grouped-bar',
          ex: d => { const o = d.safety?.observations; if (!o) return null;
              return { type:'bar', labels: o.dayLabels, input: tn(o.assembly), inputLabel:'Assembly',
                  input2: tn(o.cc), input2Label:'CC', input2Color:'#06b6d4', color:'#f59e0b' }; }},
        { id: 'builtin-safety-overdue', title: 'Overdue Safety Actions', tab: 'safety', tpl: 'horizontal-bar',
          ex: d => { const t = d.safety?.overdueTable; if (!t?.length) return null;
              return { type:'bar', labels: t.map(r=>r.dept), input: t.map(r=>r.openOverdue||0), inputLabel:'Open Overdue',
                  input2: t.map(r=>r.openNotOverdue||0), input2Label:'Open (Not Overdue)', input2Color:'#22c55e', color:'#ef4444' }; }},
        { id: 'builtin-safety-noplan', title: 'Observations Without Action Plan', tab: 'safety', tpl: 'simple-bar',
          ex: d => { const a = d.safety?.obsWithoutActionPlan; if (!a?.length) return null;
              return { type:'bar', labels: a.map(r=>r.dept), input: a.map(r=>r.over7dCurrent||0), inputLabel:'Obs >7d Without Action Plan', color:'#f59e0b' }; }},

        // ═══ PEOPLE ═══
        { id: 'builtin-people-sick', title: 'Sick Leave - All Hourly (Daily)', tab: 'people', tpl: 'line-target',
          ex: d => { const p = d.people; if (!p?.sickLeave) return null;
              return { labels: p.dayLabels, input: tn(p.sickLeave.actual), inputLabel:'Sick Leave (Hourly)',
                  red: tn(p.sickLeave.target), redLabel:'Target Max', color:'#8b5cf6', yMin:0 }; }},
        { id: 'builtin-people-turn-sal', title: 'Turnover - Salaried', tab: 'people', tpl: 'bar-target',
          ex: d => { const p = d.people; if (!p?.turnoverSalaried) return null;
              return { type:'bar', labels: p.dayLabels, input: tn(p.turnoverSalaried.actual), inputLabel:'Salaried Turnover',
                  red: tn(p.turnoverSalaried.target), redLabel:'Target Max', color:'#3b82f6', yMin:0 }; }},
        { id: 'builtin-people-turn-hr', title: 'Turnover - Hourly', tab: 'people', tpl: 'bar-target',
          ex: d => { const p = d.people; if (!p?.turnoverHourly) return null;
              return { type:'bar', labels: p.dayLabels, input: tn(p.turnoverHourly.actual), inputLabel:'Hourly Turnover',
                  red: tn(p.turnoverHourly.target), redLabel:'Target Max', color:'#f59e0b', yMin:0 }; }},
        { id: 'builtin-people-headcount', title: 'Operator Headcount', tab: 'people', tpl: 'line-band',
          ex: d => { const hc = d.people?.headcount; if (!hc) return null;
              return { labels: d.people.dayLabels, input: tn(hc.actual), inputLabel:'Operator Headcount',
                  red: tn(hc.red), redLabel:'Min Target', green: tn(hc.green), greenLabel:'Target', color:'#06b6d4' }; }},
        { id: 'builtin-people-open-sal', title: 'Open Positions - Salaried', tab: 'people', tpl: 'bar-target',
          ex: d => { const s = d.people?.openPositionsSalaried; if (!s) return null;
              return { type:'bar', input: tn(s.actual), inputLabel:'Open Salaried Positions',
                  red: tn(s.red), redLabel:'Trigger', input2: tn(s.late||[]), input2Label:'Late', input2Color:'#ef4444', color:'#3b82f6', yMin:0 }; }},
        { id: 'builtin-people-open-hr', title: 'Open Positions - Hourly', tab: 'people', tpl: 'bar-target',
          ex: d => { const h = d.people?.openPositionsHourly; if (!h) return null;
              return { type:'bar', input: tn(h.actual), inputLabel:'Open Hourly Positions',
                  red: tn(h.red), redLabel:'Trigger', input2: tn(h.late||[]), input2Label:'Late', input2Color:'#ef4444', color:'#22c55e', yMin:0 }; }},
        { id: 'builtin-people-lms', title: 'LMS Late Training %', tab: 'people', tpl: 'bar-band',
          ex: d => { const l = d.people?.lmsTraining; if (!l) return null;
              return { type:'bar', labels: l.weekLabels, input: tn(l.actual), inputLabel:'Late LMS Training',
                  red: tn(l.red), redLabel:'Trigger', green: tn(l.green), greenLabel:'Green', color:'#3b82f6', yMin:0 }; }},

        // ═══ QUALITY ═══
        { id: 'builtin-quality-fpy', title: 'FPY (First Pass Yield)', tab: 'quality', tpl: 'line-band',
          ex: d => { const f = d.quality?.fpyCam3; if (!f) return null;
              return { labels: f.dayLabels, input: tn(f.actual), inputLabel:'FPY CAM3',
                  red: tn(f.red), redLabel:'Target', green: tn(f.green), greenLabel:'Lower Bound', unit:'%', color:'#3b82f6', yMin:0, yMax:1 }; }},
        { id: 'builtin-quality-ncmr-ost', title: 'NCMR - Assembly', tab: 'quality', tpl: 'bar-target',
          ex: d => { const n = d.quality?.ncmrAssembly; if (!n) return null;
              return { type:'bar', labels: n.dayLabels, input: tn(n.actual), inputLabel:'NCMR Assembly',
                  red: tn(n.redTrigger), redLabel:'Trigger (3)', color:'#ef4444', yMin:0 }; }},
        { id: 'builtin-quality-ncmr-cc', title: 'NCMR - CC', tab: 'quality', tpl: 'bar-target',
          ex: d => { const n = d.quality?.ncmrCC; if (!n) return null;
              return { type:'bar', labels: n.dayLabels, input: tn(n.actual), inputLabel:'NCMR Packaging',
                  red: tn(n.redTrigger), redLabel:'Trigger (3)', color:'#f59e0b', yMin:0 }; }},
        { id: 'builtin-quality-complaints', title: 'Customer Complaints (Assembly)', tab: 'quality', tpl: 'grouped-bar',
          ex: d => { const c = d.quality?.complaintsAssembly; if (!c) return null;
              return { type:'bar', labels: c.monthLabels, input: tn(c.familyA), inputLabel:'Product Family A',
                  input2: tn(c.familyB), input2Label:'Product Family B', input2Color:'#8b5cf6',
                  red: tn(c.red), redLabel:'Trigger', green: tn(c.green), greenLabel:'Target', color:'#3b82f6', yMin:0 }; }},
        { id: 'builtin-quality-holds-ost', title: 'Holds - Assembly (Count)', tab: 'quality', tpl: 'stacked-bar',
          ex: d => { const h = d.quality?.holdsAssemblyCount; if (!h) return null;
              return { type:'bar', labels: h.monthLabels, input: tn(h.holdInKA), inputLabel:'Hold KA',
                  input2: tn(h.holdInDC), input2Label:'Hold DC', input2Color:'#f59e0b',
                  red: tn(h.red), redLabel:'Trigger', color:'#ef4444', yMin:0 }; }},
        { id: 'builtin-quality-holds-eur', title: 'Holds - Assembly (EUR)', tab: 'quality', tpl: 'stacked-bar',
          ex: d => { const h = d.quality?.holdsAssemblyEUR; if (!h) return null;
              return { type:'bar', labels: h.monthLabels || d.quality?.holdsAssemblyCount?.monthLabels,
                  input: tn(h.eurKA), inputLabel:'EUR KA', input2: tn(h.eurDC), input2Label:'EUR DC', input2Color:'#f59e0b',
                  color:'#ef4444', unit:'EUR' }; }},
        { id: 'builtin-quality-holds-cc', title: 'Holds - CC (Count)', tab: 'quality', tpl: 'stacked-bar',
          ex: d => { const h = d.quality?.holdsCCCount; if (!h) return null;
              return { type:'bar', labels: h.monthLabels, input: tn(h.holdInKA), inputLabel:'Hold KA (CC)',
                  input2: tn(h.holdInDC), input2Label:'Hold DC (CC)', input2Color:'#f59e0b',
                  red: tn(h.red), redLabel:'Trigger', color:'#8b5cf6', yMin:0 }; }},

        // ═══ PRODUCTION ═══
        { id: 'builtin-prod-cc-daily', title: 'CC Daily Output', tab: 'production', tpl: 'bar-target',
          ex: d => { const v = d.production?.ccVolume; if (!v) return null;
              return { type:'bar', labels: v.dates, input: tn(v.actual), inputLabel:'CC Daily Output',
                  red: tn(v.plan), redLabel:'Supply Plan', unit:'k', color:'#3b82f6' }; }},
        { id: 'builtin-prod-cc-cum', title: 'CC Volume MTD (Cumulative)', tab: 'production', tpl: 'line-target',
          ex: d => { const v = d.production?.ccVolume; if (!v) return null;
              return { labels: v.dates, input: cum(v.actual), inputLabel:'CC MTD Actual',
                  red: cum(v.plan), redLabel:'MTD Plan', unit:'k', color:'#3b82f6' }; }},
        { id: 'builtin-prod-ost-daily', title: 'OST Daily Output', tab: 'production', tpl: 'bar-target',
          ex: d => { const v = d.production?.ostVolume; if (!v) return null;
              return { type:'bar', labels: v.dates, input: tn(v.actual), inputLabel:'OST Daily Output',
                  red: tn(v.plan||[]), redLabel:'Supply Plan', unit:'k', color:'#22c55e' }; }},
        { id: 'builtin-prod-ost-cum', title: 'OST Volume MTD (Cumulative)', tab: 'production', tpl: 'line-target',
          ex: d => { const v = d.production?.ostVolume; if (!v) return null;
              return { labels: v.dates, input: cum(v.actual), inputLabel:'OST MTD Actual',
                  red: cum(v.plan||[]), redLabel:'MTD Plan', unit:'k', color:'#22c55e' }; }},
        { id: 'builtin-prod-idl-ost', title: 'IDL % - Assembly (Daily & MTD)', tab: 'production', tpl: 'dual-line-target',
          ex: d => { const i = d.production?.idlOst; if (!i) return null; const t = i.target||0;
              return { labels: i.dates, input: pct(i.daily), inputLabel:'OST IDL % Daily',
                  input2: pct(i.mtd), input2Label:'MTD', input2Color:'#f59e0b',
                  red: pct(i.daily).map(()=>t*100), redLabel:'Target', unit:'pct', color:'#3b82f6' }; }},
        { id: 'builtin-prod-idl-cc', title: 'IDL % - CC (Daily & MTD)', tab: 'production', tpl: 'dual-line-target',
          ex: d => { const i = d.production?.idlCC; if (!i) return null; const t = i.target||0;
              return { labels: i.dates, input: pct(i.daily), inputLabel:'CC IDL % Daily',
                  input2: pct(i.mtd), input2Label:'MTD', input2Color:'#f59e0b',
                  red: pct(i.daily).map(()=>t*100), redLabel:'Target', unit:'pct', color:'#22c55e' }; }},

        // ═══ SUPPLY CHAIN ═══
        { id: 'builtin-sc-jp', title: 'Service Rate - Japan (Monthly)', tab: 'supplychain', tpl: 'line-target',
          ex: d => { const s = d.supplychain || d.supplyChain; const jp = s?.serviceRateJP; if (!jp) return null;
              return { input: pct(jp.actual), inputLabel:'Service Rate JP %',
                  red: pct(jp.actual).map(()=>(jp.target||0.998)*100), redLabel:'Target', unit:'pct', color:'#3b82f6', yMin:90, yMax:101 }; }},
        { id: 'builtin-sc-row', title: 'Service Rate - ROW (Monthly)', tab: 'supplychain', tpl: 'line-target',
          ex: d => { const s = d.supplychain || d.supplyChain; const r = s?.serviceRateROW; if (!r) return null;
              return { input: pct(r.actual), inputLabel:'Service Rate ROW %',
                  red: pct(r.actual).map(()=>(r.target||0.95)*100), redLabel:'Target (95%)', unit:'pct', color:'#22c55e', yMin:80, yMax:101 }; }},
        { id: 'builtin-sc-dioh', title: 'DIOH - Days Inventory on Hand', tab: 'supplychain', tpl: 'line-band',
          ex: d => { const s = d.supplychain || d.supplyChain; const di = s?.dioh; if (!di) return null;
              return { type:'bar', input: tn(di.actual), inputLabel:'DIOH',
                  red: tn(di.red), redLabel:'Max', green: tn(di.green), greenLabel:'Min', color:'#3b82f6' }; }},

        // ═══ COST ═══
        { id: 'builtin-cost-idl-ost', title: 'IDL % - Assembly (Cost)', tab: 'cost', tpl: 'dual-line-target',
          ex: d => { const i = d.production?.idlOst; if (!i) return null; const t = i.target||0;
              return { labels: i.dates, input: pct(i.mtd), inputLabel:'OST IDL % MTD',
                  input2: pct(i.daily), input2Label:'Daily', input2Color:'#94a3b8',
                  red: pct(i.daily).map(()=>t*100), redLabel:'Target', unit:'pct', color:'#3b82f6' }; }},
        { id: 'builtin-cost-idl-cc', title: 'IDL % - Packaging (Daily & MTD)', tab: 'cost', tpl: 'dual-line-target',
          ex: d => { const i = d.production?.idlCC; if (!i) return null; const t = i.target||0;
              return { labels: i.dates, input: pct(i.mtd), inputLabel:'CC IDL % MTD',
                  input2: pct(i.daily), input2Label:'Daily', input2Color:'#94a3b8',
                  red: pct(i.daily).map(()=>t*100), redLabel:'Target', unit:'pct', color:'#22c55e' }; }},
        { id: 'builtin-cost-eff-ost', title: 'Efficiency Assembly (EUR)', tab: 'cost', tpl: 'line-band',
          ex: d => { const c = d.cost; if (!c?.efficiencyAssembly) return null;
              return { type:'bar', labels: c.dayLabels, input: tn(c.efficiencyAssembly.actual), inputLabel:'Efficiency OST (EUR)',
                  red: tn(c.efficiencyAssembly.trigger), redLabel:'Trigger', green: tn(c.efficiencyAssembly.green), greenLabel:'Green',
                  color:'#3b82f6', unit:'EUR' }; }},
        { id: 'builtin-cost-eff-cc', title: 'Efficiency CC (EUR)', tab: 'cost', tpl: 'line-band',
          ex: d => { const c = d.cost; if (!c?.efficiencyCC) return null;
              return { type:'bar', labels: c.dayLabels, input: tn(c.efficiencyCC.actual), inputLabel:'Efficiency CC (EUR)',
                  red: tn(c.efficiencyCC.trigger), redLabel:'Trigger', green: tn(c.efficiencyCC.green), greenLabel:'Green',
                  color:'#06b6d4', unit:'EUR' }; }},
        { id: 'builtin-cost-waste-ost', title: 'Waste Assembly (EUR)', tab: 'cost', tpl: 'bar-target',
          ex: d => { const c = d.cost; if (!c?.wasteAssembly) return null;
              return { type:'bar', labels: c.dayLabels, input: tn(c.wasteAssembly.actual), inputLabel:'Waste OST (EUR)',
                  red: tn(c.wasteAssembly.trigger), redLabel:'Trigger', color:'#ef4444', unit:'EUR' }; }},
        { id: 'builtin-cost-waste-cc', title: 'Waste CC (EUR)', tab: 'cost', tpl: 'bar-target',
          ex: d => { const c = d.cost; if (!c?.wasteCC) return null;
              return { type:'bar', labels: c.dayLabels, input: tn(c.wasteCC.actual), inputLabel:'Waste CC (EUR)',
                  red: tn(c.wasteCC.trigger), redLabel:'Trigger', color:'#f97316', unit:'EUR' }; }},
        { id: 'builtin-cost-variances', title: 'EUR Variances', tab: 'cost', tpl: 'line-band',
          ex: d => { const c = d.cost; if (!c?.eurVariances) return null;
              return { type:'bar', labels: c.dayLabels, input: tn(c.eurVariances.actual), inputLabel:'EUR Variances',
                  red: tn(c.eurVariances.red), redLabel:'Max', green: tn(c.eurVariances.green), greenLabel:'Min',
                  color:'#8b5cf6', unit:'EUR' }; }},
    ];

    // ── Table seeds ─────────────────────────────────────────────────────

    const TABLES = [
        { id: 'builtin-safety-overdue-tbl', title: 'Overdue Actions by Department', tab: 'safety',
          cols: ['Department', 'Open Overdue', 'Prev Week', 'Not Overdue', 'Prev Week'],
          ex: d => (d.safety?.overdueTable || []).map(r => ({
              c0: r.dept||'', c1: String(r.openOverdue||''), c2: String(r.prevWeek||''),
              c3: String(r.openNotOverdue||''), c4: String(r.prevWeekNotOverdue||'') })) },
        { id: 'builtin-safety-incident-tbl', title: 'Incident Log', tab: 'safety',
          cols: ['Date', 'Description', 'Responsible'],
          ex: d => (d.safety?.incidents || []).map(r => ({
              c0: r.date||'', c1: r.description||'', c2: r.responsible||'' })) },
        { id: 'builtin-sc-backorders-tbl', title: 'Back Orders by Machine', tab: 'supplychain',
          cols: ['Reason', 'Qty'],
          ex: d => { const bo = (d.supplychain||d.supplyChain)?.backOrdersOst || d.backOrders || [];
              return bo.map(r => ({ c0: r.reason||r.machine||'', c1: String(r.qty||r.count||'') })); } },
        { id: 'builtin-eng-projects-tbl', title: 'Engineering Projects', tab: 'engineering',
          cols: ['Project', 'Status', 'Owner', 'Due'],
          ex: d => (d.engineering?.projects || []).map(r => ({
              c0: r.description||r.project||'', c1: r.status||'', c2: r.owner||'', c3: r.due||'' })) },
        { id: 'builtin-eng-issues-tbl', title: 'Issue Log', tab: 'engineering',
          cols: ['Description', 'Status', 'Owner'],
          ex: d => (d.engineering?.issues || []).map(r => ({
              c0: r.description||'', c1: r.status||'', c2: r.owner||'' })) },
    ];

    // ── Calendar seeds ──────────────────────────────────────────────────
    // Calendars are already localStorage-based — just create card definitions
    // so they render via the Data Studio pipeline.

    const CALENDARS = [
        { id: 'builtin-safety-cross',  title: 'Safety Cross - Calendar',       tab: 'safety',     key: 'safety-cross' },
        { id: 'builtin-env-cross',     title: 'Environmental Cross - Calendar', tab: 'safety',     key: 'env-cross' },
        { id: 'builtin-people-cross',  title: 'People Calendar',               tab: 'people',     key: 'people-cross' },
        { id: 'builtin-quality-cross', title: 'Quality Calendar',              tab: 'quality',    key: 'quality-cross' },
        { id: 'builtin-prod-cc-cross', title: 'CC Production Calendar',        tab: 'production', key: 'prod-cc-cross' },
        { id: 'builtin-prod-ost-cross',title: 'OST Production Calendar',       tab: 'production', key: 'prod-ost-cross' },
        { id: 'builtin-sc-cc-cross',   title: 'Service Level Calendar - CC',   tab: 'supplychain',key: 'sc-cc-cross' },
        { id: 'builtin-sc-ost-cross',  title: 'Service Level Calendar - OST',  tab: 'supplychain',key: 'sc-ost-cross' },
    ];

    // ── Dynamic seeds (OEE, Maintenance) ────────────────────────────────

    function _seedDynamic(data) {
        const defs = [];

        // OEE per machine
        if (data.production?.oee) {
            Object.entries(data.production.oee).forEach(([name, m], i) => {
                const actual = pct(m.actual || []);
                if (!actual.length) return;
                const target = (m.target || 60);
                const labels = m.dates || actual.map((_, j) => String(j + 1));
                defs.push({
                    id: 'builtin-prod-oee-' + i,
                    title: name + ' OEE %',
                    tab: 'production',
                    templateType: 'bar-target',
                    canvasId: 'custom-builtin-prod-oee-' + i,
                    opts: { type: 'bar', labels, input: actual, inputLabel: name + ' OEE %',
                        red: actual.map(() => target), redLabel: 'Target (' + target.toFixed(0) + '%)',
                        color: '#3b82f6', unit: 'pct', yMin: 0, yMax: 100 }
                });
            });
        }

        // Maintenance availability per machine
        if (data.maintenance?.availability) {
            Object.entries(data.maintenance.availability).forEach(([name, m], i) => {
                const actual = pct(m.actual || []);
                if (!actual.length) return;
                const redConst  = (m.red  && m.red[0])  ? m.red[0] * 100  : 85;
                const greenConst = (m.green && m.green[0]) ? m.green[0] * 100 : 95;
                const labels = m.weekLabels?.length ? m.weekLabels.slice(0, actual.length) : actual.map((_, j) => 'W' + (j + 1));
                defs.push({
                    id: 'builtin-maint-' + i,
                    title: name + ' Availability %',
                    tab: 'maintenance',
                    templateType: 'bar-band',
                    canvasId: 'custom-builtin-maint-' + i,
                    opts: { type: 'bar', labels, input: actual, inputLabel: name + ' Availability %',
                        red: actual.map(() => redConst), redLabel: 'Target (' + redConst + '%)',
                        green: actual.map(() => greenConst), greenLabel: 'Min (' + greenConst + '%)',
                        color: '#3b82f6', unit: 'pct', yMin: 0, yMax: 105 }
                });
            });
        }

        return defs;
    }

    // ── Main seed function ──────────────────────────────────────────────

    function seedFromData(data) {
        if (!data || typeof VPMDataStore === 'undefined') {
            console.warn('[Seeder] No data or VPMDataStore unavailable');
            return { seeded: 0, skipped: 0 };
        }

        const existing = VPMDataStore.getCustomCharts().map(c => c.id);
        let seeded = 0, skipped = 0;

        // Static charts
        CHARTS.forEach(seed => {
            if (existing.includes(seed.id)) { skipped++; return; }
            const opts = seed.ex(data);
            if (!opts || (!opts.input?.length && !opts.labels?.length)) { skipped++; return; }
            VPMDataStore.saveCustomChart({
                id: seed.id,
                tier: null,  // visible to all tiers
                title: seed.title,
                tab: seed.tab,
                templateType: seed.tpl,
                canvasId: 'custom-' + seed.id,
                opts
            });
            seeded++;
        });

        // Tables
        TABLES.forEach(seed => {
            if (existing.includes(seed.id)) { skipped++; return; }
            const rows = seed.ex(data);
            VPMDataStore.saveCustomChart({
                id: seed.id,
                tier: null,  // visible to all tiers
                title: seed.title,
                tab: seed.tab,
                templateType: 'data-table',
                canvasId: 'custom-' + seed.id,
                opts: {
                    type: 'table',
                    columns: seed.cols.map((label, i) => ({ key: 'c' + i, label })),
                    tableRows: rows
                }
            });
            seeded++;
        });

        // Calendars
        CALENDARS.forEach(seed => {
            if (existing.includes(seed.id)) { skipped++; return; }
            VPMDataStore.saveCustomChart({
                id: seed.id,
                tier: null,  // visible to all tiers
                title: seed.title,
                tab: seed.tab,
                templateType: 'calendar',
                canvasId: 'cal-' + seed.id,
                opts: { type: 'calendar', storageKey: seed.key }
            });
            seeded++;
        });

        // Dynamic (OEE + Maintenance)
        _seedDynamic(data).forEach(def => {
            if (existing.includes(def.id)) { skipped++; return; }
            def.tier = null; // visible to all tiers
            VPMDataStore.saveCustomChart(def);
            seeded++;
        });

        console.log(`[Seeder] Done: ${seeded} seeded, ${skipped} skipped (already exist)`);
        return { seeded, skipped };
    }

    return { seedFromData, CHARTS, TABLES, CALENDARS };

})();