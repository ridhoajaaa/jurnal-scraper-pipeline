'use strict';

require('./setup');
const { getApp, loginAs } = require('./setup');
const request  = require('supertest');
const mongoose = require('mongoose');

async function seedUser({ username, email, role = 'user', password = 'password123' } = {}) {
    const User   = mongoose.model('User');
    const bcrypt = require('bcryptjs');
    return User.create({
        username, email, role,
        passwordHash:    await bcrypt.hash(password, 10),
        isEmailVerified: true,
        quotaUsed: 0, quotaLimit: 10, dailyLimit: 2,
    });
}

describe('GET /api/admin/users', () => {
    it('returns all users for admin', async () => {
        await seedUser({ username: 'admin', email: 'admin@ex.com', role: 'admin' });
        await seedUser({ username: 'reg',   email: 'reg@ex.com' });
        const agent = await loginAs({ username: 'admin', email: 'admin@ex.com' });
        const res = await agent.get('/api/admin/users');
        expect(res.status).toBe(200);
        expect(res.body.length).toBeGreaterThanOrEqual(2);
        expect(res.body[0].passwordHash).toBeUndefined();
    });

    it('blocks non-admin users', async () => {
        const agent = await loginAs({ username: 'notadmin', email: 'notadmin@ex.com' });
        const res = await agent.get('/api/admin/users');
        expect(res.status).toBe(403);
    });

    it('blocks unauthenticated requests', async () => {
        const res = await request(getApp()).get('/api/admin/users');
        expect(res.status).toBe(401);
    });
});

describe('POST /api/admin/users/:id/generate-token', () => {
    it('generates a formatted token', async () => {
        await seedUser({ username: 'admin2', email: 'admin2@ex.com', role: 'admin' });
        const target = await seedUser({ username: 'target', email: 'target@ex.com' });
        const agent  = await loginAs({ username: 'admin2', email: 'admin2@ex.com' });
        const res = await agent.post(`/api/admin/users/${target._id}/generate-token`);
        expect(res.status).toBe(200);
        expect(res.body.token).toMatch(/^[A-Z0-9_-]{4}-[A-Z0-9_-]{4}-[A-Z0-9_-]{4}$/);
    });

    it('blocks generating token for admin accounts', async () => {
        await seedUser({ username: 'admA', email: 'admA@ex.com', role: 'admin' });
        const admB = await seedUser({ username: 'admB', email: 'admB@ex.com', role: 'admin' });
        const agent = await loginAs({ username: 'admA', email: 'admA@ex.com' });
        const res = await agent.post(`/api/admin/users/${admB._id}/generate-token`);
        expect(res.status).toBe(400);
    });
});

describe('POST /api/activate-premium', () => {
    it('upgrades user to premium with valid token', async () => {
        const User = mongoose.model('User');
        await seedUser({ username: 'admin3', email: 'admin3@ex.com', role: 'admin' });
        const target = await seedUser({ username: 'tokenuser', email: 'tokenuser@ex.com' });

        const admin     = await loginAs({ username: 'admin3', email: 'admin3@ex.com' });
        const tokenRes  = await admin.post(`/api/admin/users/${target._id}/generate-token`);
        const { token } = tokenRes.body;

        const userAgent = await loginAs({ username: 'tokenuser', email: 'tokenuser@ex.com' });
        const res = await userAgent.post('/api/activate-premium').send({ token });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const updated = await User.findOne({ email: 'tokenuser@ex.com' });
        expect(updated.role).toBe('premium');
    });

    it('rejects invalid token', async () => {
        const agent = await loginAs({ username: 'badtoken', email: 'badtoken@ex.com' });
        const res = await agent.post('/api/activate-premium').send({ token: 'XXXX-XXXX-XXXX' });
        expect(res.status).toBe(400);
    });
});

describe('DELETE /api/admin/users/:id', () => {
    it('deletes a user and their journals', async () => {
        const User    = mongoose.model('User');
        const Journal = mongoose.model('Journal');
        await seedUser({ username: 'admin4', email: 'admin4@ex.com', role: 'admin' });
        const victim = await seedUser({ username: 'victim', email: 'victim@ex.com' });
        await Journal.create({ userId: victim._id, judul: 'Paper', keyword: 'test', source: 'Scholar' });

        const agent = await loginAs({ username: 'admin4', email: 'admin4@ex.com' });
        const res = await agent.delete(`/api/admin/users/${victim._id}`);
        expect(res.status).toBe(200);

        expect(await User.findById(victim._id)).toBeNull();
        expect(await Journal.find({ userId: victim._id })).toHaveLength(0);
    });

    it('cannot delete own account', async () => {
        const me = await seedUser({ username: 'selfdel', email: 'selfdel@ex.com', role: 'admin' });
        const agent = await loginAs({ username: 'selfdel', email: 'selfdel@ex.com' });
        const res = await agent.delete(`/api/admin/users/${me._id}`);
        expect(res.status).toBe(400);
    });
});

describe('PATCH /api/admin/users/:id/promote', () => {
    it('promotes user to admin', async () => {
        const User = mongoose.model('User');
        await seedUser({ username: 'admin5', email: 'admin5@ex.com', role: 'admin' });
        const user = await seedUser({ username: 'promoted', email: 'promoted@ex.com' });
        const agent = await loginAs({ username: 'admin5', email: 'admin5@ex.com' });
        const res = await agent.patch(`/api/admin/users/${user._id}/promote`);
        expect(res.status).toBe(200);
        const updated = await User.findById(user._id);
        expect(updated.role).toBe('admin');
    });
});