// CSV to HTML converter module
// Converts honeypot CSV logs to HTML table format for easy viewing

const fs = require('fs');
const path = require('path');

/**
 * Convert CSV file to HTML table
 * @param {string} csvFilePath - Path to CSV file
 * @param {function} callback - Callback(err, htmlFilePath)
 */
function processCSV(csvFilePath, callback) {
    try {
        // Check if CSV file exists
        if (!fs.existsSync(csvFilePath)) {
            return callback(new Error(`CSV file not found: ${csvFilePath}`));
        }

        // Read CSV file
        const csvContent = fs.readFileSync(csvFilePath, 'utf8');
        const lines = csvContent.split('\n').filter(line => line.trim());

        if (lines.length === 0) {
            return callback(new Error('CSV file is empty'));
        }

        // Generate HTML
        const html = generateHTML(lines, csvFilePath);

        // Write HTML file
        const htmlFilePath = csvFilePath.replace(/\.csv$/i, '.html');
        fs.writeFileSync(htmlFilePath, html, 'utf8');

        callback(null, htmlFilePath);
    } catch (err) {
        callback(err);
    }
}

/**
 * Generate HTML from CSV lines
 * @param {array} lines - CSV lines
 * @param {string} sourcePath - Original CSV file path
 * @returns {string} HTML content
 */
function generateHTML(lines, sourcePath) {
    const header = lines[0];
    const rows = lines.slice(1);

    const headerCells = parseCSVLine(header);
    const dataRows = rows.map(parseCSVLine);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>sshMON Log Viewer</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #f5f5f5;
            padding: 20px;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }

        header {
            background: #2c3e50;
            color: white;
            padding: 20px;
        }

        header h1 {
            font-size: 24px;
            margin-bottom: 5px;
        }

        header p {
            opacity: 0.8;
            font-size: 14px;
        }

        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            padding: 20px;
            background: #ecf0f1;
            border-bottom: 1px solid #ddd;
        }

        .stat-card {
            background: white;
            padding: 15px;
            border-radius: 5px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .stat-card .label {
            font-size: 12px;
            color: #7f8c8d;
            text-transform: uppercase;
            margin-bottom: 5px;
        }

        .stat-card .value {
            font-size: 24px;
            font-weight: bold;
            color: #2c3e50;
        }

        .table-container {
            overflow-x: auto;
            padding: 20px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        th {
            background: #34495e;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            font-size: 13px;
            position: sticky;
            top: 0;
            z-index: 10;
        }

        td {
            padding: 10px 12px;
            border-bottom: 1px solid #ecf0f1;
            font-size: 13px;
        }

        tr:hover {
            background: #f8f9fa;
        }

        .ip {
            font-family: 'Courier New', monospace;
            color: #e74c3c;
            font-weight: 600;
        }

        .username, .password {
            font-family: 'Courier New', monospace;
            background: #f8f9fa;
            padding: 3px 6px;
            border-radius: 3px;
        }

        .high-risk {
            color: #e74c3c;
            font-weight: bold;
        }

        .medium-risk {
            color: #f39c12;
        }

        .low-risk {
            color: #27ae60;
        }

        footer {
            padding: 15px 20px;
            background: #ecf0f1;
            text-align: center;
            font-size: 12px;
            color: #7f8c8d;
        }

        .search-box {
            padding: 20px;
            background: #f8f9fa;
            border-bottom: 1px solid #ddd;
        }

        .search-box input {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 14px;
        }

        .highlight {
            background: yellow;
            padding: 2px 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🍯 sshMON Attack Log Viewer</h1>
            <p>Source: ${path.basename(sourcePath)} | Generated: ${new Date().toISOString()}</p>
        </header>

        <div class="stats">
            <div class="stat-card">
                <div class="label">Total Events</div>
                <div class="value">${dataRows.length}</div>
            </div>
            <div class="stat-card">
                <div class="label">Unique IPs</div>
                <div class="value">${countUniqueIPs(dataRows)}</div>
            </div>
            <div class="stat-card">
                <div class="label">Password Attempts</div>
                <div class="value">${countPasswordAttempts(dataRows)}</div>
            </div>
            <div class="stat-card">
                <div class="label">Commands Logged</div>
                <div class="value">${countCommands(dataRows)}</div>
            </div>
        </div>

        <div class="search-box">
            <input type="text" id="searchBox" placeholder="Search logs (IP, username, password, command...)">
        </div>

        <div class="table-container">
            <table id="logTable">
                <thead>
                    <tr>
${headerCells.map(cell => `                        <th>${escapeHtml(cell)}</th>`).join('\n')}
                    </tr>
                </thead>
                <tbody>
${dataRows.map(row => `                    <tr>
${row.map((cell, idx) => `                        <td class="${getCellClass(headerCells[idx], cell)}">${formatCell(headerCells[idx], cell)}</td>`).join('\n')}
                    </tr>`).join('\n')}
                </tbody>
            </table>
        </div>

        <footer>
            Generated by sshMON - SSH Honeypot with Threat Intelligence
        </footer>
    </div>

    <script>
        // Simple search functionality
        document.getElementById('searchBox').addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#logTable tbody tr');

            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(searchTerm) ? '' : 'none';
            });
        });

        // Click to copy IP addresses
        document.querySelectorAll('.ip').forEach(el => {
            el.style.cursor = 'pointer';
            el.title = 'Click to copy';
            el.addEventListener('click', function() {
                navigator.clipboard.writeText(this.textContent);
                const original = this.textContent;
                this.textContent = '✓ Copied!';
                setTimeout(() => this.textContent = original, 1000);
            });
        });
    </script>
</body>
</html>`;
}

/**
 * Parse CSV line handling quoted fields
 * @param {string} line - CSV line
 * @returns {array} Parsed fields
 */
function parseCSVLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            fields.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    fields.push(current.trim());
    return fields;
}

/**
 * Escape HTML special characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(str).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Get CSS class for cell based on header and value
 * @param {string} header - Column header
 * @param {string} value - Cell value
 * @returns {string} CSS class
 */
function getCellClass(header, value) {
    const h = header.toLowerCase();

    if (h.includes('ip')) return 'ip';
    if (h.includes('username')) return 'username';
    if (h.includes('password')) return 'password';

    if (h.includes('score') || h.includes('abuse')) {
        const score = parseInt(value);
        if (score >= 80) return 'high-risk';
        if (score >= 40) return 'medium-risk';
        if (score > 0) return 'low-risk';
    }

    return '';
}

/**
 * Format cell value for display
 * @param {string} header - Column header
 * @param {string} value - Cell value
 * @returns {string} Formatted HTML
 */
function formatCell(header, value) {
    return escapeHtml(value);
}

/**
 * Count unique IP addresses in rows
 * @param {array} rows - Data rows
 * @returns {number} Unique IP count
 */
function countUniqueIPs(rows) {
    const ips = new Set();
    rows.forEach(row => {
        if (row[2]) ips.add(row[2]); // Assuming IP is 3rd column
    });
    return ips.size;
}

/**
 * Count password attempts
 * @param {array} rows - Data rows
 * @returns {number} Password attempt count
 */
function countPasswordAttempts(rows) {
    return rows.filter(row => row[4] && row[4].toLowerCase() === 'password').length;
}

/**
 * Count command executions
 * @param {array} rows - Data rows
 * @returns {number} Command count
 */
function countCommands(rows) {
    return rows.filter(row => row[4] && row[4].toLowerCase() === 'command').length;
}

module.exports = {
    processCSV
};
