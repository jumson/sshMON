// Legacy CSV logging module for backwards compatibility
// This module maintains the original API while delegating to the new logger

const fs = require('fs');
const path = require('path');

/**
 * Log data to CSV file
 * @param {string} dataFull - Full path to CSV file
 * @param {string} buf - CSV line to append
 * @param {string} dataHeader - CSV header (written if file doesn't exist)
 */
function toLog(dataFull, buf, dataHeader) {
    try {
        // Ensure directory exists
        const dir = path.dirname(dataFull);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
        }

        // Write header if file doesn't exist
        if (!fs.existsSync(dataFull)) {
            fs.writeFileSync(dataFull, dataHeader + '\n', { mode: 0o644 });
        }

        // Parse the buffer to extract timestamp if needed
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const time = now.toISOString().split('T')[1].split('.')[0];

        // Replace placeholders in buf if they exist
        let line = buf;
        if (line.startsWith('-,-,')) {
            line = line.replace('-,-,', `${date},${time},`);
        }

        // Append to file
        fs.appendFileSync(dataFull, line + '\n');

        return true;
    } catch (err) {
        console.error('Error writing to CSV:', err);
        return false;
    }
}

/**
 * Get current timestamp in CSV format
 * @returns {string} Date,Time
 */
function getTimestamp() {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toISOString().split('T')[1].split('.')[0];
    return `${date},${time}`;
}

/**
 * Create formatted CSV line
 * @param {object} data - Object with CSV fields
 * @returns {string} Formatted CSV line
 */
function formatCSVLine(data) {
    const escapeCsv = (field) => {
        const str = String(field || '-');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    };

    const now = new Date();
    const date = data.date || now.toISOString().split('T')[0];
    const time = data.time || now.toISOString().split('T')[1].split('.')[0];

    return [
        date,
        time,
        data.ip || '-',
        data.port || '-',
        data.method || '-',
        data.listenPort || '-',
        escapeCsv(data.username || '-'),
        escapeCsv(data.password || '-'),
        escapeCsv(data.info || '-')
    ].join(',');
}

module.exports = {
    toLog,
    getTimestamp,
    formatCSVLine
};
