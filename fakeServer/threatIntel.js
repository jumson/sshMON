// Threat Intelligence Integration Module
// Enriches attacker IPs with geolocation and reputation data

const axios = require('axios');
const geoip = require('geoip-lite');
const { RateLimiterMemory } = require('rate-limiter-flexible');

require('dotenv').config();

// Configuration
const ENABLE_THREAT_INTEL = process.env.ENABLE_THREAT_INTEL === 'true';
const ENABLE_ABUSEIPDB = process.env.ENABLE_ABUSEIPDB === 'true';
const ENABLE_SHODAN = process.env.ENABLE_SHODAN === 'true';
const ENABLE_IPAPI = process.env.ENABLE_IPAPI === 'true';

const ABUSEIPDB_API_KEY = process.env.ABUSEIPDB_API_KEY;
const SHODAN_API_KEY = process.env.SHODAN_API_KEY;

// Rate limiters
const abuseIPDBLimiter = new RateLimiterMemory({
    points: parseInt(process.env.ABUSEIPDB_RATE_LIMIT) || 1000,
    duration: 86400 // Per day
});

const shodanLimiter = new RateLimiterMemory({
    points: parseInt(process.env.SHODAN_RATE_LIMIT) || 1,
    duration: 1 // Per second
});

const ipApiLimiter = new RateLimiterMemory({
    points: 45, // 45 per minute free tier
    duration: 60
});

// In-memory cache with TTL
class IntelCache {
    constructor() {
        this.cache = new Map();
        this.ttls = {
            geoip: parseInt(process.env.CACHE_GEOIP_TTL) || 604800000, // 7 days
            abuseipdb: parseInt(process.env.CACHE_ABUSEIPDB_TTL) || 86400000, // 24 hours
            shodan: parseInt(process.env.CACHE_SHODAN_TTL) || 2592000000 // 30 days
        };
    }

    get(key, type = 'geoip') {
        const cached = this.cache.get(key);
        if (!cached) return null;

        const age = Date.now() - cached.timestamp;
        const ttl = this.ttls[type] || this.ttls.geoip;

        if (age > ttl) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    set(key, data, type = 'geoip') {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            type
        });
    }

    has(key) {
        return this.cache.has(key);
    }
}

const cache = new IntelCache();

/**
 * Get geolocation data for IP using geoip-lite (offline)
 * @param {string} ip - IP address
 * @returns {object} Geolocation data
 */
function getGeoIPLite(ip) {
    try {
        const geo = geoip.lookup(ip);
        if (!geo) return null;

        return {
            country: geo.country,
            region: geo.region,
            city: geo.city || 'Unknown',
            ll: geo.ll, // [latitude, longitude]
            timezone: geo.timezone,
            asn: 'Unknown' // geoip-lite doesn't provide ASN
        };
    } catch (err) {
        console.error('GeoIP-Lite lookup error:', err.message);
        return null;
    }
}

/**
 * Get geolocation data from IP-API.com (fallback/enhancement)
 * @param {string} ip - IP address
 * @returns {object} Geolocation data
 */
async function getIPAPI(ip) {
    if (!ENABLE_IPAPI) return null;

    try {
        // Check rate limit
        await ipApiLimiter.consume(ip, 1);

        const response = await axios.get(`http://ip-api.com/json/${ip}`, {
            params: {
                fields: 'status,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as'
            },
            timeout: 5000
        });

        if (response.data.status === 'success') {
            return {
                country: response.data.countryCode,
                region: response.data.regionName,
                city: response.data.city,
                ll: [response.data.lat, response.data.lon],
                timezone: response.data.timezone,
                isp: response.data.isp,
                org: response.data.org,
                asn: response.data.as
            };
        }

        return null;
    } catch (err) {
        if (err.remainingPoints !== undefined) {
            console.warn('IP-API rate limit exceeded');
        } else {
            console.error('IP-API error:', err.message);
        }
        return null;
    }
}

/**
 * Check IP reputation with AbuseIPDB
 * @param {string} ip - IP address
 * @returns {object} Reputation data
 */
async function checkAbuseIPDB(ip) {
    if (!ENABLE_ABUSEIPDB || !ABUSEIPDB_API_KEY) return null;

    try {
        // Check rate limit
        await abuseIPDBLimiter.consume('global', 1);

        const response = await axios.get('https://api.abuseipdb.com/api/v2/check', {
            headers: {
                'Key': ABUSEIPDB_API_KEY,
                'Accept': 'application/json'
            },
            params: {
                ipAddress: ip,
                maxAgeInDays: 90,
                verbose: true
            },
            timeout: 10000
        });

        const data = response.data.data;
        return {
            abuseConfidenceScore: data.abuseConfidenceScore,
            totalReports: data.totalReports,
            numDistinctUsers: data.numDistinctUsers,
            lastReportedAt: data.lastReportedAt,
            isWhitelisted: data.isWhitelisted,
            isTor: data.isTor,
            countryCode: data.countryCode,
            usageType: data.usageType,
            domain: data.domain
        };
    } catch (err) {
        if (err.remainingPoints !== undefined) {
            console.warn('AbuseIPDB rate limit exceeded');
        } else if (err.response && err.response.status === 429) {
            console.warn('AbuseIPDB quota exceeded');
        } else {
            console.error('AbuseIPDB error:', err.message);
        }
        return null;
    }
}

/**
 * Query Shodan for host intelligence
 * @param {string} ip - IP address
 * @returns {object} Shodan data
 */
async function queryShodan(ip) {
    if (!ENABLE_SHODAN || !SHODAN_API_KEY) return null;

    try {
        // Check rate limit
        await shodanLimiter.consume('global', 1);

        const response = await axios.get(`https://api.shodan.io/shodan/host/${ip}`, {
            params: {
                key: SHODAN_API_KEY
            },
            timeout: 10000
        });

        const data = response.data;
        return {
            ports: data.ports || [],
            vulns: data.vulns || [],
            tags: data.tags || [],
            org: data.org,
            asn: data.asn,
            isp: data.isp,
            hostnames: data.hostnames || [],
            domains: data.domains || [],
            last_update: data.last_update
        };
    } catch (err) {
        if (err.remainingPoints !== undefined) {
            console.warn('Shodan rate limit exceeded');
        } else if (err.response && err.response.status === 404) {
            // IP not in Shodan database (not an error)
            return { ports: [], vulns: [], tags: [], note: 'Not in Shodan database' };
        } else {
            console.error('Shodan error:', err.message);
        }
        return null;
    }
}

/**
 * Enrich IP address with all available threat intelligence
 * @param {string} ip - IP address
 * @returns {object} Enriched data
 */
async function enrichIP(ip) {
    if (!ENABLE_THREAT_INTEL) {
        return { ip, enriched: false };
    }

    // Skip localhost and private IPs
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
        return { ip, enriched: false, reason: 'private_ip' };
    }

    // Check cache
    const cacheKey = `intel:${ip}`;
    const cached = cache.get(cacheKey, 'abuseipdb');
    if (cached) {
        return { ...cached, cached: true };
    }

    // Gather intelligence from all sources
    const enriched = {
        ip,
        enriched: true,
        timestamp: new Date().toISOString(),
        geo: null,
        reputation: null,
        shodan: null
    };

    try {
        // Geolocation (try IP-API first, fallback to geoip-lite)
        enriched.geo = await getIPAPI(ip) || getGeoIPLite(ip);

        // IP Reputation
        enriched.reputation = await checkAbuseIPDB(ip);

        // Shodan (optional, rate-limited)
        enriched.shodan = await queryShodan(ip);

        // Cache the results
        cache.set(cacheKey, enriched, 'abuseipdb');

        return enriched;
    } catch (err) {
        console.error(`Error enriching IP ${ip}:`, err.message);
        return { ...enriched, error: err.message };
    }
}

/**
 * Batch enrich multiple IPs (useful for log analysis)
 * @param {array} ips - Array of IP addresses
 * @param {number} delay - Delay between requests (ms)
 * @returns {array} Array of enriched data
 */
async function enrichIPBatch(ips, delay = 1000) {
    const results = [];

    for (const ip of ips) {
        const enriched = await enrichIP(ip);
        results.push(enriched);

        // Delay to respect rate limits
        if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    return results;
}

/**
 * Get cache statistics
 * @returns {object} Cache stats
 */
function getCacheStats() {
    return {
        size: cache.cache.size,
        entries: Array.from(cache.cache.keys()).length
    };
}

/**
 * Clear cache (for testing/maintenance)
 */
function clearCache() {
    cache.cache.clear();
}

module.exports = {
    enrichIP,
    enrichIPBatch,
    getGeoIPLite,
    getIPAPI,
    checkAbuseIPDB,
    queryShodan,
    getCacheStats,
    clearCache
};
