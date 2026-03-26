'use strict';

require('./setup');
const { getApp, loginAs } = require('./setup');
const request = require('supertest');

const SAMPLE = {
    judul: 'Deep Learning for NLP: A Survey', author_info: 'Smith, J.',
    tahun: '2023', abstrak_lengkap: 'This paper surveys...', Kategori: 'ML',
    Relevansi: 85, citationCount: 42, source: 'Semantic Scholar',
    link: 'https://example.com/paper', Akses: 'Open Access',
};

describe('POST /api/saved', () => {
    it('saves a journal', async () => {
        const agent = await loginAs({ username: 'saver', email: 'saver@example.com' });
        const res = await agent.post('/api/saved').send(SAMPLE);
        expect(res.status).toBe(200);
        expect(res.body.judul).toBe(SAMPLE.judul);
        expect(res.body._id).toBeDefined();
    });

    it('rejects duplicate bookmark', async () => {
        const agent = await loginAs({ username: 'dupbm', email: 'dupbm@example.com' });
        await agent.post('/api/saved').send(SAMPLE);
        const res = await agent.post('/api/saved').send(SAMPLE);
        expect(res.status).toBe(409);
    });

    it('requires authentication', async () => {
        const res = await request(getApp()).post('/api/saved').send(SAMPLE);
        expect(res.status).toBe(401);
    });

    it('rejects missing judul', async () => {
        const agent = await loginAs({ username: 'nojudul', email: 'nojudul@example.com' });
        const { judul, ...noJudul } = SAMPLE;
        const res = await agent.post('/api/saved').send(noJudul);
        expect(res.status).toBe(400);
    });
});

describe('GET /api/saved', () => {
    it('returns empty array when no bookmarks', async () => {
        const agent = await loginAs({ username: 'empty', email: 'empty@example.com' });
        const res = await agent.get('/api/saved');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('returns only current user bookmarks', async () => {
        const agent1 = await loginAs({ username: 'u1', email: 'u1@example.com' });
        const agent2 = await loginAs({ username: 'u2', email: 'u2@example.com' });
        await agent1.post('/api/saved').send(SAMPLE);
        await agent2.post('/api/saved').send({ ...SAMPLE, judul: 'Different Paper' });
        const res1 = await agent1.get('/api/saved');
        const res2 = await agent2.get('/api/saved');
        expect(res1.body).toHaveLength(1);
        expect(res1.body[0].judul).toBe(SAMPLE.judul);
        expect(res2.body).toHaveLength(1);
        expect(res2.body[0].judul).toBe('Different Paper');
    });
});

describe('DELETE /api/saved/:id', () => {
    it('deletes own bookmark', async () => {
        const agent = await loginAs({ username: 'deluser', email: 'del@example.com' });
        const saved = await agent.post('/api/saved').send(SAMPLE);
        const delRes = await agent.delete(`/api/saved/${saved.body._id}`);
        expect(delRes.status).toBe(200);
        const list = await agent.get('/api/saved');
        expect(list.body).toHaveLength(0);
    });

    it('cannot delete another user bookmark', async () => {
        const agent1 = await loginAs({ username: 'owner',   email: 'owner@example.com' });
        const agent2 = await loginAs({ username: 'stealer', email: 'steal@example.com' });
        const saved = await agent1.post('/api/saved').send(SAMPLE);
        await agent2.delete(`/api/saved/${saved.body._id}`);
        const list = await agent1.get('/api/saved');
        expect(list.body).toHaveLength(1);
    });
});

describe('PATCH /api/saved/:id/note', () => {
    it('updates note', async () => {
        const agent = await loginAs({ username: 'noter', email: 'note@example.com' });
        const saved = await agent.post('/api/saved').send(SAMPLE);
        const res = await agent.patch(`/api/saved/${saved.body._id}/note`).send({ note: 'Important' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

describe('GET /api/saved/stats', () => {
    it('returns correct stats', async () => {
        const agent = await loginAs({ username: 'statsuser', email: 'stats@example.com' });
        await agent.post('/api/saved').send(SAMPLE);
        await agent.post('/api/saved').send({ ...SAMPLE, judul: 'Paper 2', tahun: '2022', source: 'CrossRef', Kategori: 'NLP' });
        const res = await agent.get('/api/saved/stats');
        expect(res.status).toBe(200);
        expect(res.body.total).toBe(2);
        expect(res.body.byYear).toBeInstanceOf(Array);
    });
});