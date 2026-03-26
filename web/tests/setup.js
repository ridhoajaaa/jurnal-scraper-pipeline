'use strict';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose  = require('mongoose');
const request   = require('supertest');

let mongod;
let app;
let httpServer;

beforeAll(async () => {
    if (!mongod) {
        mongod = await MongoMemoryServer.create();
    }

    process.env.MONGO_URI      = mongod.getUri();
    process.env.SESSION_SECRET = 'test-secret';
    process.env.NODE_ENV       = 'test';
    process.env.GEMINI_API_KEY = '';
    process.env.RESEND_API_KEY = '';
    process.env.APP_URL        = 'http://localhost:3000';

    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }

    // Close previous HTTP server if any (prevents EADDRINUSE)
    if (httpServer) {
        await new Promise(r => httpServer.close(r));
        httpServer = null;
    }

    delete require.cache[require.resolve('../server')];
    const mod = require('../server');
    app        = mod;
    httpServer = mod.server;

    await new Promise((resolve, reject) => {
        if (mongoose.connection.readyState === 1) return resolve();
        mongoose.connection.once('connected', resolve);
        mongoose.connection.once('error', reject);
        setTimeout(() => reject(new Error('MongoDB connect timeout')), 10000);
    });
}, 30000);

afterAll(async () => {
    // Close HTTP server + Socket.IO to release handles
    if (httpServer) {
        await new Promise(r => httpServer.close(r)).catch(() => {});
        httpServer = null;
    }
    await mongoose.disconnect();
    if (mongod) { await mongod.stop(); mongod = null; }
});

afterEach(async () => {
    const cols = mongoose.connection.collections;
    for (const key in cols) {
        await cols[key].drop().catch(() => {});
    }
});

function getApp() { return app; }
function createAgent() { return request.agent(app); }

async function loginAs({ username, email, password, role = 'user' } = {}) {
    const User   = mongoose.model('User');
    const bcrypt = require('bcryptjs');
    const _email = email    || 'test@example.com';
    const _pass  = password || 'password123';

    const existing = await User.findOne({ email: _email });
    if (!existing) {
        const hash = await bcrypt.hash(_pass, 10);
        await User.create({
            username:        username || 'testuser',
            email:           _email,
            passwordHash:    hash,
            role,
            isEmailVerified: true,
            quotaUsed:       0,
            quotaLimit:      10,
            dailyLimit:      2,
        });
    }

    const agent = createAgent();
    await agent.post('/api/auth/login').send({ email: _email, password: _pass });
    return agent;
}

module.exports = { getApp, createAgent, loginAs };