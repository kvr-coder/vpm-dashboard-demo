/**
 * VPM Data Parser - Handles Excel file parsing and JSON data loading
 */
const VPMDataParser = {
    rawData: null,
    parsedData: null,

    /**
     * Parse uploaded Excel file
     */
    async parseExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                    this.rawData = workbook;
                    this.parsedData = this.extractAllData(workbook);
                    resolve(this.parsedData);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    },

    /**
     * Load default JSON data.
     * Uses inline window.VPM_DEFAULT_DATA (works without a web server),
     * falls back to fetch for environments that support it.
     */
    async loadDefaultData() {
        if (typeof window.VPM_DEFAULT_DATA !== 'undefined') {
            this.parsedData = window.VPM_DEFAULT_DATA;
            return this.parsedData;
        }
        try {
            const response = await fetch('data/default-data.json');
            if (!response.ok) return null;
            this.parsedData = await response.json();
            return this.parsedData;
        } catch {
            return null;
        }
    },

    /**
     * Extract all relevant data from workbook
     */
    extractAllData(workbook) {
        const data = {
            dataDaily: this.parseDataDaily(workbook),
            safety: this.parseSafety(workbook),
            people: this.parsePeople(workbook),
            quality: this.parseQuality(workbook),
            qualityTue: this.parseQualityTue(workbook),
            production: this.parseProduction(workbook),
            supplyChain: this.parseSupplyChain(workbook),
            cost: this.parseCost(workbook),
            backOrders: this.parseBackOrders(workbook),
            agenda: this.parseAgenda(workbook),
            messages: this.parseMessages(workbook),
        };
        return data;
    },

    /**
     * Helper: get sheet as JSON array
     */
    getSheet(workbook, name) {
        const sheet = workbook.Sheets[name];
        if (!sheet) return null;
        return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
    },

    /**
     * Helper: get cell value from sheet
     */
    getCellValue(workbook, sheetName, cellRef) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) return null;
        const cell = sheet[cellRef];
        return cell ? cell.v : null;
    },

    /**
     * Parse DataDaily sheet - Cost IDL metrics
     */
    parseDataDaily(workbook) {
        const rows = this.getSheet(workbook, 'DataDaily');
        if (!rows) return null;

        const result = {
            daily: { dates: [], assemblyIDLDaily: [], assemblyIDLMTD: [], ccIDLDaily: [], ccIDLMTD: [] },
            monthly: { months: [], assemblyIDLMTD: [], ccIDLMTD: [], assemblyTarget: [], ccTarget: [] }
        };

        // Row 0: dates (columns C onwards)
        if (rows[0]) {
            for (let i = 2; i < rows[0].length; i++) {
                const val = rows[0][i];
                if (val) {
                    result.daily.dates.push(val instanceof Date ? val.toISOString().split('T')[0] : String(val));
                }
            }
        }

        // Row 1: Assembly IDL daily (index 1)
        if (rows[1]) {
            for (let i = 2; i < rows[1].length; i++) {
                const v = rows[1][i];
                result.daily.assemblyIDLDaily.push(v !== null && v !== undefined ? Number(v) : null);
            }
        }
        // Row 2: Assembly IDL MTD
        if (rows[2]) {
            for (let i = 2; i < rows[2].length; i++) {
                const v = rows[2][i];
                result.daily.assemblyIDLMTD.push(v !== null && v !== undefined ? Number(v) : null);
            }
        }
        // Row 3: CC IDL daily
        if (rows[3]) {
            for (let i = 2; i < rows[3].length; i++) {
                const v = rows[3][i];
                result.daily.ccIDLDaily.push(v !== null && v !== undefined ? Number(v) : null);
            }
        }
        // Row 4: CC IDL MTD
        if (rows[4]) {
            for (let i = 2; i < rows[4].length; i++) {
                const v = rows[4][i];
                result.daily.ccIDLMTD.push(v !== null && v !== undefined ? Number(v) : null);
            }
        }

        // Monthly data starts at row 6 (index 6)
        if (rows[6]) {
            for (let i = 2; i < rows[6].length; i++) {
                const m = rows[6][i];
                if (m) result.monthly.months.push(String(m));
            }
        }
        if (rows[7]) {
            for (let i = 2; i < Math.min(rows[7].length, 14); i++) {
                result.monthly.assemblyIDLMTD.push(rows[7][i] !== null ? Number(rows[7][i]) : null);
            }
        }
        if (rows[8]) {
            for (let i = 2; i < Math.min(rows[8].length, 14); i++) {
                result.monthly.ccIDLMTD.push(rows[8][i] !== null ? Number(rows[8][i]) : null);
            }
        }
        if (rows[9]) {
            for (let i = 2; i < Math.min(rows[9].length, 14); i++) {
                result.monthly.assemblyTarget.push(rows[9][i] !== null ? Number(rows[9][i]) : null);
            }
        }
        if (rows[10]) {
            for (let i = 2; i < Math.min(rows[10].length, 14); i++) {
                result.monthly.ccTarget.push(rows[10][i] !== null ? Number(rows[10][i]) : null);
            }
        }

        return result;
    },

    /**
     * Parse Safety sheet
     */
    parseSafety(workbook) {
        const result = {
            oshaStartDate: null,
            oshaDaysSince: null,
            milestone: null,
            faMilestone: null,
            observations: { days: [], input: [], target: [], green: [], assembly: [] },
            safetyCross: [],
            envCross: [],
        };

        // OSHA start date from cell CV4
        const oshaStart = this.getCellValue(workbook, '3. Safety TUE', 'CV4');
        if (oshaStart) {
            result.oshaStartDate = oshaStart;
            const start = new Date(oshaStart);
            const today = new Date();
            result.oshaDaysSince = Math.floor((today - start) / (1000 * 60 * 60 * 24));
        }

        // Milestones from safety sheet
        const rows = this.getSheet(workbook, '3. Safety TUE');
        if (!rows) return result;

        // Find milestones
        for (let r = 20; r < Math.min(rows.length, 40); r++) {
            const row = rows[r];
            if (!row) continue;
            for (let c = 0; c < row.length; c++) {
                if (row[c] === 'Milestone' || row[c] === 'Previous Best') {
                    // Look for number in nearby cells
                }
            }
        }

        // OSHA milestone from AA24 area
        result.milestone = this.getCellValue(workbook, '3. Safety TUE', 'AA24') || 180;
        result.faMilestone = this.getCellValue(workbook, '3. Safety TUE', 'AA28') || 30;

        // Safety Observations data
        // Row 41 (index 41): days 1-31
        // Row 42 (index 42): observation input values
        // Row 43: red target
        // Row 44: green target
        // Row 45: assembly values
        for (let r = 40; r < Math.min(rows.length, 50); r++) {
            const row = rows[r];
            if (!row) continue;
            const label = row[1]; // Column B

            if (label === 'Observation number') {
                // Extract from AY onwards (index ~50)
                for (let c = 50; c < Math.min(row.length, 82); c++) {
                    const v = row[c];
                    if (v !== null && v !== undefined) {
                        result.observations.input.push(Number(v));
                    }
                }
            }
        }

        // Parse observation data from specific cells
        const sheet = workbook.Sheets['3. Safety TUE'];
        if (sheet) {
            // Input row (cumulative observations)
            const obsLabels = ['AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ',
                'BK', 'BL', 'BM', 'BN', 'BO', 'BP', 'BQ', 'BR', 'BS', 'BT', 'BU', 'BV',
                'BW', 'BX', 'BY', 'BZ', 'CA', 'CB', 'CC'];
            result.observations.input = [];
            result.observations.target = [];
            result.observations.assembly = [];

            for (const col of obsLabels) {
                const inputCell = sheet[col + '42'];
                const targetCell = sheet[col + '43'];
                const ostCell = sheet[col + '45'];
                if (inputCell) result.observations.input.push(Number(inputCell.v));
                if (targetCell) result.observations.target.push(Number(targetCell.v));
                if (ostCell) result.observations.assembly.push(Number(ostCell.v));
            }

            for (let d = 1; d <= 31; d++) {
                result.observations.days.push(d);
            }
        }

        return result;
    },

    /**
     * Parse People sheet
     */
    parsePeople(workbook) {
        const result = {
            sickLeave: { days: [], count: [], target: [] },
            crossData: [],
        };

        const sheet = workbook.Sheets['4. People WED'];
        if (!sheet) return result;

        // Sick leave data from row 43-45 area
        const cols = ['AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW', 'AX',
            'AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ',
            'BK', 'BL', 'BM', 'BN', 'BO', 'BP', 'BQ'];

        let dayNum = 1;
        for (const col of cols) {
            const countCell = sheet[col + '44'];
            const targetCell = sheet[col + '45'];
            if (countCell) {
                result.sickLeave.days.push(dayNum);
                result.sickLeave.count.push(Number(countCell.v));
                result.sickLeave.target.push(targetCell ? Number(targetCell.v) : 46);
            }
            dayNum++;
        }

        return result;
    },

    /**
     * Parse Quality Thursday sheet
     */
    parseQuality(workbook) {
        const result = {
            fpy: { cam3: { days: [], values: [], greenTarget: 0.75, redTarget: 0.25 } },
            ncmr: { days: [], assembly: [], cc: [] },
        };

        const sheet = workbook.Sheets['5.Q.THU'];
        if (!sheet) return result;

        const cols = ['AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW', 'AX',
            'AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ',
            'BK', 'BL', 'BM', 'BN', 'BO', 'BP', 'BQ'];

        let dayNum = 1;
        for (const col of cols) {
            const fpyCell = sheet[col + '39'];
            if (fpyCell && fpyCell.v !== null) {
                result.fpy.cam3.days.push(dayNum);
                result.fpy.cam3.values.push(Number(fpyCell.v));
            }
            dayNum++;
        }

        return result;
    },

    /**
     * Parse Quality Tuesday sheet (HOLDs)
     */
    parseQualityTue(workbook) {
        const result = {
            holds: { weeks: [], ka: [], dc: [] },
        };

        const sheet = workbook.Sheets['6.Q_TUE'];
        if (!sheet) return result;

        const cols = ['AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT'];
        let weekNum = 36;
        for (const col of cols) {
            const kaCell = sheet[col + '43'];
            const dcCell = sheet[col + '44'];
            if (kaCell) {
                result.holds.weeks.push('W' + weekNum);
                result.holds.ka.push(Number(kaCell.v));
                result.holds.dc.push(dcCell ? Number(dcCell.v) : 0);
            }
            weekNum++;
        }

        return result;
    },

    /**
     * Parse Production sheet (latest active one)
     */
    parseProduction(workbook) {
        const result = {
            cc: { days: [], dailyOutput: [], mtdFact: [], mtdTarget: [], supplyTarget: [], aopTarget: [] },
            ost: { days: [], dailyOutput: [], mtdFact: [], mtdTarget: [], supplyTarget: [], aopTarget: [] },
            calendarData: [],
        };

        // Try newest production sheet first
        const sheetNames = ['8.Prod', '8.Prod (Feb-26)', '9.Prod (JAN)', '9.Prod_Oct '];
        let sheet = null;
        let usedName = null;

        for (const name of sheetNames) {
            if (workbook.Sheets[name]) {
                sheet = workbook.Sheets[name];
                usedName = name;
                break;
            }
        }
        if (!sheet) return result;

        // CC and OST volume data columns
        const cols = ['AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW', 'AX',
            'AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ',
            'BK', 'BL', 'BM', 'BN', 'BO', 'BP', 'BQ'];

        // Determine row offsets based on sheet format
        let dailyOutputRow, mtdFactRow, mtdTargetRow, aopTargetRow, supplyTargetRow;

        if (usedName === '8.Prod' || usedName === '9.Prod (JAN)') {
            // Newer format
            dailyOutputRow = '39';
            mtdFactRow = '40';
            mtdTargetRow = '37'; // red line (supply plan)
            supplyTargetRow = '38';
            aopTargetRow = '44';
        } else {
            dailyOutputRow = '37';
            mtdFactRow = '38';
            mtdTargetRow = '39';
            supplyTargetRow = '38';
            aopTargetRow = '45';
        }

        let dayNum = 1;
        for (const col of cols) {
            const outputCell = sheet[col + dailyOutputRow];
            const mtdCell = sheet[col + mtdFactRow];
            const targetCell = sheet[col + mtdTargetRow];
            const aopCell = sheet[col + aopTargetRow];

            if (outputCell && outputCell.v !== null && outputCell.v !== undefined) {
                result.cc.days.push(dayNum);
                result.cc.dailyOutput.push(Number(outputCell.v));
                result.cc.mtdFact.push(mtdCell ? Number(mtdCell.v) : null);
                result.cc.mtdTarget.push(targetCell ? Number(targetCell.v) : null);
                result.cc.aopTarget.push(aopCell ? Number(aopCell.v) : null);
            }
            dayNum++;
        }

        return result;
    },

    /**
     * Parse Supply Chain sheet
     */
    parseSupplyChain(workbook) {
        const result = {
            serviceLevelCC: [],
            serviceLevelOST: [],
            messages: [],
        };

        // Supply chain data is mainly calendar-based from 6.SC.WED
        return result;
    },

    /**
     * Parse Cost data (uses DataDaily)
     */
    parseCost(workbook) {
        // Already handled in parseDataDaily
        return this.parseDataDaily(workbook);
    },

    /**
     * Parse Back Orders sheet
     */
    parseBackOrders(workbook) {
        const result = { machines: [] };
        const rows = this.getSheet(workbook, '7.BO.FRI');
        if (!rows) return result;

        // Parse machine priority table (rows 3 onwards)
        for (let r = 2; r < Math.min(rows.length, 25); r++) {
            const row = rows[r];
            if (!row) continue;
            const business = row[0];
            const machine = row[1];
            if (machine && typeof machine === 'string' && machine.length > 1) {
                const weekData = [];
                for (let c = 2; c <= 9; c++) {
                    weekData.push(row[c] || '');
                }
                result.machines.push({
                    business: business || '',
                    machine: machine,
                    weeks: weekData
                });
            }
        }

        return result;
    },

    /**
     * Parse Agenda sheet
     */
    parseAgenda(workbook) {
        const result = { items: [] };
        const rows = this.getSheet(workbook, 'Agd');
        if (!rows) return result;

        for (let r = 2; r < rows.length; r++) {
            const row = rows[r];
            if (!row || !row[1]) continue;
            result.items.push({
                category: row[0] || '',
                topic: row[1],
                mon: row[2] || '',
                tue: row[3] || '',
                wed: row[4] || '',
                thu: row[5] || '',
                fri: row[6] || '',
                frequency: row[7] || '',
            });
        }

        return result;
    },

    /**
     * Parse escalation messages from multiple sheets
     */
    parseMessages(workbook) {
        const result = {};
        const sheetMap = {
            safety: '3. Safety TUE',
            people: '4. People WED',
            quality: '5.Q.THU',
            production: '8.Prod',
            supplychain: '6.SC.WED',
        };

        for (const [key, sheetName] of Object.entries(sheetMap)) {
            result[key] = [];
            const rows = this.getSheet(workbook, sheetName);
            if (!rows) continue;

            // Messages are typically in rows 7-16, column C (index 2)
            const departments = ['EHS', 'HR', 'Quality', 'Manufacturing', 'Maintenance', 'Engineering', 'SC', 'Finance', 'General'];
            const startRow = sheetName === '8.Prod' ? 3 : 6;

            for (let r = startRow; r < startRow + 12 && r < rows.length; r++) {
                const row = rows[r];
                if (!row) continue;
                const dept = row[1] || row[2]; // Column B or C depending on sheet
                const msgCol = sheetName === '8.Prod' ? 7 : 2; // Column H or C
                const msg = row[msgCol];
                if (msg && typeof msg === 'string' && msg.trim().length > 2) {
                    result[key].push({
                        department: dept || 'General',
                        message: msg.trim().substring(0, 200),
                        type: dept === 'EHS' ? 'escalation' : 'info',
                    });
                }
            }
        }

        return result;
    },

    /**
     * Get current data
     */
    getData() {
        return this.parsedData;
    }
};