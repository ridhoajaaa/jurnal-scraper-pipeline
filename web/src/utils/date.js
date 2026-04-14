/**
 * Shared date utility — single source of truth for WIB (UTC+7) date calculation.
 * Previously duplicated in server.js, auth.js, and profile.js.
 */

function getTodayWIB() {
    return new Date(Date.now() + 7 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
}

module.exports = { getTodayWIB };
