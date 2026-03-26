'use strict';

require('./setup');
const { getApp, loginAs } = require('./setup');
const request  = require('supertest');
const mongoose = require('mongoose');

async function seedUser(data) {
    const User   = mongoose.model('User');
    const bcrypt = require('bcryptjs');
    return User.create({
        passwordHash:    await bcrypt.hash(data.password || 'password123', 10),
        isEmailVerified: true,
        quotaUsed:       0,
        quotaLimit:      10,
        dailyLimit:      2,
        ...data,
    });
}

describe('Scrape quota enforcement', () => {
    it('blocks scrape when lifetime quota exhausted', async () => {
        await seedUser({ username: 'quotauser', email: 'quota@example.com', quotaUsed: 10 });
        const agent = await loginAs({ username: 'quotauser', email: 'quota@example.com' });
        const res = await agent.post('/api/scrape').send({
            keyword: 'machine learning', source: 'semantic', yearFrom: 2020, yearTo: 2026,
        });
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('quotaExhausted');
    });

    it('blocks scrape when daily limit reached', async () => {
        const todayWIB = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
        await seedUser({
            username: 'dailyuser', email: 'daily@example.com',
            quotaUsed: 2, dailyScrapedToday: 2, lastScrapeDate: todayWIB,
        });
        const agent = await loginAs({ username: 'dailyuser', email: 'daily@example.com' });
        const res = await agent.post('/api/scrape').send({
            keyword: 'deep learning', source: 'semantic', yearFrom: 2020, yearTo: 2026,
        });
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('dailyLimitReached');
    });

    it('allows scrape when user has remaining quota', async () => {
        await seedUser({
            username: 'okuser', email: 'ok@example.com',
            quotaUsed: 3, lastScrapeDate: '2000-01-01',
        });
        const agent = await loginAs({ username: 'okuser', email: 'ok@example.com' });
        const res = await agent.post('/api/scrape').send({
            keyword: 'neural networks', source: 'semantic', yearFrom: 2020, yearTo: 2026,
        });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('queued');
        expect(res.body.jobId).toBeDefined();
    });

    it('premium users bypass quota check', async () => {
        await seedUser({ username: 'premuser', email: 'prem@example.com', role: 'premium', quotaUsed: 9999 });
        const agent = await loginAs({ username: 'premuser', email: 'prem@example.com' });
        const res = await agent.post('/api/scrape').send({
            keyword: 'transformers', source: 'semantic', yearFrom: 2020, yearTo: 2026,
        });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('queued');
    });

    it('rejects duplicate active job from same user', async () => {
        const agent = await loginAs({ username: 'dupjob', email: 'dupjob@example.com' });
        const res1 = await agent.post('/api/scrape').send({
            keyword: 'topic one', source: 'semantic', yearFrom: 2020, yearTo: 2026,
        });
        expect(res1.status).toBe(200);
        const res2 = await agent.post('/api/scrape').send({
            keyword: 'topic two', source: 'semantic', yearFrom: 2020, yearTo: 2026,
        });
        expect(res2.status).toBe(429);
    });
});

describe('GET /api/scrape/my-active-job', () => {
    it('returns null when no active job', async () => {
        const agent = await loginAs({ username: 'idleuser', email: 'idle@example.com' });
        const res = await agent.get('/api/scrape/my-active-job');
        expect(res.status).toBe(200);
        expect(res.body.jobId).toBeNull();
    });

    it('requires authentication', async () => {
        const res = await request(getApp()).get('/api/scrape/my-active-job');
        expect(res.status).toBe(401);
    });
});