'use strict';

require('./setup');
const { getApp } = require('./setup');
const request  = require('supertest');
const mongoose = require('mongoose');

describe('POST /api/auth/register', () => {
    it('registers first user as admin (auto-verified)', async () => {
        const res = await request(getApp()).post('/api/auth/register').send({
            username: 'adminuser',
            email:    'admin@example.com',
            password: 'password123',
        });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.role).toBe('admin');
        expect(res.body.verified).toBe(true);
    });

    it('registers subsequent users as unverified', async () => {
        await request(getApp()).post('/api/auth/register').send({
            username: 'admin', email: 'admin@example.com', password: 'pass123456',
        });
        const res = await request(getApp()).post('/api/auth/register').send({
            username: 'user2', email: 'user2@example.com', password: 'pass123456',
        });
        expect(res.status).toBe(200);
        expect(res.body.requiresVerification).toBe(true);
        expect(res.body.verified).toBe(false);
    });

    it('rejects duplicate email', async () => {
        await request(getApp()).post('/api/auth/register').send({
            username: 'user1', email: 'dup@example.com', password: 'pass123456',
        });
        const res = await request(getApp()).post('/api/auth/register').send({
            username: 'user2', email: 'dup@example.com', password: 'pass123456',
        });
        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/email/i);
    });

    it('rejects duplicate username', async () => {
        await request(getApp()).post('/api/auth/register').send({
            username: 'sameuser', email: 'a@example.com', password: 'pass123456',
        });
        const res = await request(getApp()).post('/api/auth/register').send({
            username: 'sameuser', email: 'b@example.com', password: 'pass123456',
        });
        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/username/i);
    });

    it('rejects short password', async () => {
        const res = await request(getApp()).post('/api/auth/register').send({
            username: 'shortpass', email: 'short@example.com', password: '123',
        });
        expect(res.status).toBe(400);
    });

    it('rejects missing fields', async () => {
        const res = await request(getApp()).post('/api/auth/register').send({ username: 'nopassword' });
        expect(res.status).toBe(400);
    });
});

describe('POST /api/auth/login', () => {
    beforeEach(async () => {
        const User   = mongoose.model('User');
        const bcrypt = require('bcryptjs');
        await User.create({
            username: 'loginuser', email: 'login@example.com',
            passwordHash: await bcrypt.hash('correctpass', 10),
            role: 'user', isEmailVerified: true,
        });
    });

    it('logs in with correct credentials', async () => {
        const res = await request(getApp()).post('/api/auth/login').send({
            email: 'login@example.com', password: 'correctpass',
        });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.username).toBe('loginuser');
    });

    it('rejects wrong password', async () => {
        const res = await request(getApp()).post('/api/auth/login').send({
            email: 'login@example.com', password: 'wrongpass',
        });
        expect(res.status).toBe(401);
    });

    it('rejects unverified user', async () => {
        const User   = mongoose.model('User');
        const bcrypt = require('bcryptjs');
        await User.create({
            username: 'unverified', email: 'unverified@example.com',
            passwordHash: await bcrypt.hash('pass123', 10), isEmailVerified: false,
        });
        const res = await request(getApp()).post('/api/auth/login').send({
            email: 'unverified@example.com', password: 'pass123',
        });
        expect(res.status).toBe(403);
        expect(res.body.notVerified).toBe(true);
    });

    it('rejects non-existent email', async () => {
        const res = await request(getApp()).post('/api/auth/login').send({
            email: 'ghost@example.com', password: 'somepass',
        });
        expect(res.status).toBe(401);
    });
});

describe('GET /api/auth/me', () => {
    it('returns loggedIn: false when unauthenticated', async () => {
        const res = await request(getApp()).get('/api/auth/me');
        expect(res.body.loggedIn).toBe(false);
    });

    it('returns loggedIn: true with valid session', async () => {
        const { loginAs } = require('./setup');
        const agent = await loginAs({ username: 'meuser', email: 'me@example.com' });
        const res = await agent.get('/api/auth/me');
        expect(res.body.loggedIn).toBe(true);
        expect(res.body.username).toBe('meuser');
    });
});

describe('POST /api/auth/logout', () => {
    it('destroys session', async () => {
        const { loginAs } = require('./setup');
        const agent = await loginAs({ username: 'logoutuser', email: 'logout@example.com' });
        const logoutRes = await agent.post('/api/auth/logout');
        expect(logoutRes.body.success).toBe(true);
        const meRes = await agent.get('/api/auth/me');
        expect(meRes.body.loggedIn).toBe(false);
    });
});