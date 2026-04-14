function requireAuth(req, res, next) {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized. Please login.' });
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized.' });
    if (req.session.role !== 'admin') return res.status(403).json({ error: 'Forbidden. Admins only.' });
    next();
}

module.exports = { requireAuth, requireAdmin };
