const request = require('supertest');

// Global mocks for DB and JWT used across integration/system tests
jest.mock('./src/db/db', () => ({
    query: jest.fn(),
    testConnection: jest.fn(() => Promise.resolve('Bağlantı başarılı (Mock)')),
    pool: { query: jest.fn() }
}));

jest.mock('./src/common/jwt', () => ({
    generateAuthToken: jest.fn(() => 'dummy-token'),
    verifyAuthToken: jest.fn((token) => token === 'dummy-token' ? 'user-uuid' : null)
}));

const app = require('./index');
const db = require('./src/db/db');

describe('Ablan Halleder - Tests (unit / integration / system)', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Unit: validation and jwt helpers', () => {
        function chainable() {
            const obj = {};
            const methods = ['trim', 'notEmpty', 'withMessage', 'isLength', 'isInt', 'isUUID', 'optional', 'isBoolean', 'isISO8601', 'toDate', 'custom', 'isEmail', 'normalizeEmail', 'isMobilePhone', 'isIn'];
            methods.forEach(m => { obj[m] = () => obj; });
            return obj;
        }

        test('VALIDATE: calls next when no validation errors', () => {
            jest.resetModules();
            jest.doMock('express-validator', () => ({
                validationResult: () => ({ isEmpty: () => true }),
                body: () => chainable()
            }));

            const { validate } = require('./src/validation/validation');

            const req = {};
            const res = {};
            const next = jest.fn();

            validate(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        test('VALIDATE: returns 400 when validation errors exist', () => {
            jest.resetModules();
            jest.doMock('express-validator', () => ({
                validationResult: () => ({ isEmpty: () => false }),
                body: () => chainable()
            }));

            const { validate } = require('./src/validation/validation');

            const req = {};
            const status = jest.fn(() => ({ json: jest.fn() }));
            const res = { status };
            const next = jest.fn();

            validate(req, res, next);

            expect(status).toHaveBeenCalledWith(400);
            expect(next).not.toHaveBeenCalled();
        });

        test('JWT helper: generate and verify (mocked jsonwebtoken + fs)', () => {
            jest.resetModules();

            // Ensure we load the real module implementation for unit test
            jest.unmock('./src/common/jwt');

            jest.doMock('fs', () => ({
                readFileSync: (p) => p.includes('private') ? 'private-key' : 'public-key'
            }));

            jest.doMock('jsonwebtoken', () => ({
                sign: jest.fn(() => 'signed-token'),
                verify: jest.fn(() => ({ id: 'unit-user' }))
            }));

            const jwtHelper = require('./src/common/jwt');

            const token = jwtHelper.generateAuthToken('unit-user');
            expect(token).toBe('signed-token');

            const id = jwtHelper.verifyAuthToken('signed-token');
            expect(id).toBe('unit-user');
        });
    });

    /**
     * Integration tests for auth routes
     */
    describe('System: auth routes flow', () => {
        test('POST /kayit_ol - successful registration returns 200', async() => {
            db.query.mockResolvedValueOnce({ rows: [{ id: 'new-id' }] });

            const res = await request(app)
                .post('/api/kayit_ol')
                .send({ rol: 'customer', adSoyad: 'Test', email: 't@test.com', telefon: '05551234567', sifre: 'password123' });

            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
            expect(res.body.success).toBe(true);
        });

        test('POST /giris_yap - successful login returns token and user data', async() => {
            db.query.mockResolvedValueOnce({ rows: [{ id: 'u-1', role: 'customer', full_name: 'U', email: 'u@test.com', phone: '55' }] });

            const res = await request(app)
                .post('/api/giris_yap')
                .send({ email: 'u@test.com', sifre: 'password123' });

            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.authToken).toBe('dummy-token');
        });
    });

    /**
     * System test: full protected flow for `/ana_sayfa`
     */
    describe('System: protected route flow', () => {
        test('GET /ana_sayfa with valid token returns dashboard data', async() => {
            // 1) userQuery -> role customer
            db.pool.query
                .mockResolvedValueOnce({ rows: [{ role: 'customer' }] })
                // sorgu1Res
                .mockResolvedValueOnce({ rows: [{ aktif_talep_adet: '2', onay_bekleyen_talep_adet: '1' }] })
                // sorgu2Res
                .mockResolvedValueOnce({ rows: [{ id: 'r1', baslik: 'B', is_durumu: 'assigned' }] })
                // sorgu3Res
                .mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .get('/api/ana_sayfa')
                .set('Authorization', 'Bearer dummy-token');

            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
            expect(res.body.data.rol).toBe('customer');
        });
    });

    describe('Integration: adres and talep routes', () => {
        test('POST /adres_ekle - adds address', async() => {
            db.query.mockResolvedValueOnce({ rows: [{ id: 'a1' }] });

            const res = await request(app)
                .post('/api/adres_ekle')
                .set('Authorization', 'Bearer dummy-token')
                .send({ baslik: 'Ev', adres: 'Uzun adres', ilId: 1, ilceId: 2 });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        test('GET /adreslerim - returns mapped addresses', async() => {
            db.query.mockResolvedValueOnce({ rows: [{ id: 'a1', label: 'Ev', address_line: 'adres' }] });

            const res = await request(app)
                .get('/api/adreslerim')
                .set('Authorization', 'Bearer dummy-token');

            expect(res.status).toBe(200);
            expect(res.body.data).toBeInstanceOf(Array);
            expect(res.body.data[0].baslik).toBe('Ev');
        });

        test('DELETE /adres_sil - deletes address', async() => {
            db.query.mockResolvedValueOnce({ rows: [{ id: 'a1' }] });

            const res = await request(app)
                .delete('/api/adres_sil')
                .set('Authorization', 'Bearer dummy-token')
                .send({ adresId: '00000000-0000-0000-0000-000000000000' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        test('POST /iller and /ilceler - returns lists', async() => {
            db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Istanbul' }] });
            let res = await request(app).post('/api/iller');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);

            db.query.mockResolvedValueOnce({ rows: [{ id: 10, name: 'Kadikoy' }] });
            res = await request(app).post('/api/ilceler').send({ ilId: 1 });
            expect(res.status).toBe(200);
            expect(res.body.data[0].ilce).toBe('Kadikoy');
        });

        test('GET /taleplerim - returns requests list', async() => {
            db.query.mockResolvedValueOnce({ rows: [{ id: 't1', title: 'B', description: 'd', area_sqm: 50, has_pets: false, scheduled_start: '2026-01-01', status: 'draft' }] });

            const res = await request(app)
                .get('/api/taleplerim')
                .set('Authorization', 'Bearer dummy-token');

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        test('GET /talep_detay - returns detail', async() => {
            db.query.mockResolvedValueOnce({ rows: [{ talep_id: 't1' }] });

            const res = await request(app)
                .get('/api/talep_detay')
                .set('Authorization', 'Bearer dummy-token')
                .send({ talepId: '00000000-0000-0000-0000-000000000000' });

            expect(res.status).toBe(200);
            expect(res.body.data).toBeDefined();
        });

        test('POST /talep_olustur - without files returns 400', async() => {
            const res = await request(app)
                .post('/api/talep_olustur')
                .set('Authorization', 'Bearer dummy-token')
                .send({ adresId: 'a1', baslik: 'B', alan: 20, fiyat: 100, petVarMi: false, planlananTarih: '2026-07-01' });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        test('POST /talep_iptal - not found returns 404 and cancel ok returns 200', async() => {
            // not found
            db.query.mockResolvedValueOnce({ rows: [] });
            let res = await request(app)
                .post('/api/talep_iptal')
                .set('Authorization', 'Bearer dummy-token')
                .send({ talepId: '00000000-0000-0000-0000-000000000000' });
            expect(res.status).toBe(404);

            // found and draft -> cancel
            db.query.mockResolvedValueOnce({ rows: [{ status: 'draft' }] });
            db.query.mockResolvedValueOnce({ rows: [{ affected: 1 }] });

            res = await request(app)
                .post('/api/talep_iptal')
                .set('Authorization', 'Bearer dummy-token')
                .send({ talepId: '00000000-0000-0000-0000-000000000000' });

            expect(res.status).toBe(200);
        });

    });

    describe('Unit: is_controller functions', () => {
        const isController = require('./src/controller/is_controller');
        const fs = require('fs');

        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('isler returns data from db.query', async() => {
            db.query.mockResolvedValueOnce({ rows: [{ talep_id: 't1' }] });

            const json = jest.fn();
            const status = jest.fn(() => ({ json }));
            const res = { status };

            await isController.isler({}, res);

            expect(status).toHaveBeenCalledWith(200);
            expect(json).toHaveBeenCalled();
        });

        test('aktifIs returns data for cleaner', async() => {
            db.query.mockResolvedValueOnce({ rows: [{ job_id: 'j1' }] });

            const req = { userId: 'c1' };
            const json = jest.fn();
            const status = jest.fn(() => ({ json }));
            const res = { status };

            await isController.aktifIs(req, res);

            expect(status).toHaveBeenCalledWith(200);
            expect(json).toHaveBeenCalled();
        });

        test('isiAl returns 200 on successful take', async() => {
            const client = { query: jest.fn(), release: jest.fn() };
            // kontrolSorgusu -> published
            client.query
                // BEGIN
                .mockResolvedValueOnce({})
                // kontrolSorgusu -> published
                .mockResolvedValueOnce({ rows: [{ status: 'published' }] })
                // aktifIsSorgusu -> empty
                .mockResolvedValueOnce({ rows: [] })
                // insert
                .mockResolvedValueOnce({})
                // update
                .mockResolvedValueOnce({})
                // commit
                .mockResolvedValueOnce({});

            db.pool.connect = jest.fn().mockResolvedValue(client);

            const req = { userId: 'u1', body: { talepId: 't1' } };
            const json = jest.fn();
            const status = jest.fn(() => ({ json }));
            const res = { status };

            await isController.isiAl(req, res);

            expect(status).toHaveBeenCalledWith(200);
            expect(json).toHaveBeenCalled();
            expect(client.release).toHaveBeenCalled();
        });

        test('isiAl returns 400 when not available', async() => {
            const client = { query: jest.fn(), release: jest.fn() };
            client.query
                // BEGIN
                .mockResolvedValueOnce({})
                // kontrolSonuc empty
                .mockResolvedValueOnce({ rows: [] }); // kontrolSonuc empty

            db.pool.connect = jest.fn().mockResolvedValue(client);

            const req = { userId: 'u1', body: { talepId: 't1' } };
            const json = jest.fn();
            const status = jest.fn(() => ({ json }));
            const res = { status };

            await isController.isiAl(req, res);

            expect(status).toHaveBeenCalledWith(400);
            expect(client.release).toHaveBeenCalled();
        });

        test('isiIptalEt cancels active job when exists', async() => {
            const client = { query: jest.fn(), release: jest.fn() };
            client.query
                // BEGIN
                .mockResolvedValueOnce({})
                .mockResolvedValueOnce({ rows: [{ id: 'j1', request_id: 'r1' }] })
                .mockResolvedValueOnce({})
                .mockResolvedValueOnce({});

            db.pool.connect = jest.fn().mockResolvedValue(client);

            const req = { userId: 'u1' };
            const json = jest.fn();
            const status = jest.fn(() => ({ json }));
            const res = { status };

            await isController.isiIptalEt(req, res);

            expect(status).toHaveBeenCalledWith(200);
            expect(json).toHaveBeenCalled();
            expect(client.release).toHaveBeenCalled();
        });

        test('temizligeBasla returns 400 when no active job and cleans up files', async() => {
            const client = { query: jest.fn(), release: jest.fn() };
            client.query
                // BEGIN
                .mockResolvedValueOnce({})
                .mockResolvedValueOnce({ rows: [] });

            db.pool.connect = jest.fn().mockResolvedValue(client);

            // mock fs methods
            jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});

            const req = { userId: 'u1', files: [{ path: 'tmp1' }] };
            const json = jest.fn();
            const status = jest.fn(() => ({ json }));
            const res = { status };

            await isController.temizligeBasla(req, res);

            expect(status).toHaveBeenCalledWith(400);
            expect(fs.unlinkSync).toHaveBeenCalled();
            expect(client.release).toHaveBeenCalled();
        });

    });

    describe('Unit: admin_controller', () => {
        const adminController = require('./src/controller/admin_controller');

        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('login returns 200 on success', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ id: 1, email: 'a@a.com', full_name: 'Admin', phone: '123', role: 'admin' }] });
            const req = { body: { email: 'a@a.com', password: '123' }, session: {} };
            const json = jest.fn();
            const status = jest.fn(() => ({ json }));
            const res = { status };
            await adminController.login(req, res);
            expect(status).toHaveBeenCalledWith(200);
            expect(req.session.user.role).toBe('admin');
        });

        test('login returns 500 on not found/error', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });
            const req = { body: { email: 'a@a.com', password: '123' } };
            const json = jest.fn();
            const status = jest.fn(() => ({ json }));
            const res = { status };
            await adminController.login(req, res);
            expect(status).toHaveBeenCalledWith(500);
        });

        test('logout destroys session and redirects', async () => {
            const req = { session: { destroy: jest.fn((cb) => cb(null)) } };
            const res = { redirect: jest.fn() };
            await adminController.logout(req, res);
            expect(req.session.destroy).toHaveBeenCalled();
            expect(res.redirect).toHaveBeenCalledWith('/login');
        });

        test('homeView renders stats', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ role: 'customer', count: '10' }, { role: 'cleaner', count: '5' }] })
                .mockResolvedValueOnce({ rows: [{ status: 'published', count: '2' }, { status: 'completed', count: '3' }] })
                .mockResolvedValueOnce({ rows: [{ count: '1' }] });
            
            const req = { session: { user: { id: 1 } } };
            const res = { render: jest.fn() };
            await adminController.homeView(req, res);
            expect(res.render).toHaveBeenCalledWith('web/home', expect.any(Object));
            const renderArgs = res.render.mock.calls[0][1];
            expect(renderArgs.stats.customers).toBe(10);
            expect(renderArgs.stats.activeRequests).toBe(2);
        });

        test('changePassword returns 400 on wrong password', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });
            const req = { session: { user: { id: 1 } }, body: { currentPassword: 'old', newPassword: 'new' } };
            const json = jest.fn();
            const status = jest.fn(() => ({ json }));
            const res = { status, json };
            await adminController.changePassword(req, res);
            expect(status).toHaveBeenCalledWith(400);
        });

        test('changePassword returns 200 on success', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ id: 1 }] })
                .mockResolvedValueOnce({});
            const req = { session: { user: { id: 1 } }, body: { currentPassword: 'old', newPassword: 'new' } };
            const json = jest.fn();
            const status = jest.fn(() => ({ json }));
            const res = { status, json };
            await adminController.changePassword(req, res);
            expect(status).toHaveBeenCalledWith(200);
        });

        test('toggleUserStatus returns 200', async () => {
            db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ status: 'suspended' }] });
            const req = { params: { id: 1 } };
            const json = jest.fn();
            const res = { json };
            await adminController.toggleUserStatus(req, res);
            expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: true, status: 'suspended' }));
        });

        test('approveRequest returns 200', async () => {
            db.query.mockResolvedValueOnce({});
            const req = { params: { requestId: 1 } };
            const json = jest.fn();
            const status = jest.fn(() => ({ json }));
            const res = { status };
            await adminController.approveRequest(req, res);
            expect(status).toHaveBeenCalledWith(200);
        });

        test('rejectRequest returns 200', async () => {
            db.query.mockResolvedValueOnce({});
            const req = { params: { requestId: 1 } };
            const json = jest.fn();
            const status = jest.fn(() => ({ json }));
            const res = { status };
            await adminController.rejectRequest(req, res);
            expect(status).toHaveBeenCalledWith(200);
        });

        test('resolveDispute returns 200 on approve', async () => {
            const client = { query: jest.fn(), release: jest.fn() };
            client.query
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({ rows: [{ cleaner_id: 2 }] }) // jobResult
                .mockResolvedValueOnce({}) // update requests
                .mockResolvedValueOnce({}) // update jobs
                .mockResolvedValueOnce({}) // update approvals
                .mockResolvedValueOnce({}); // COMMIT
            db.pool.connect = jest.fn().mockResolvedValue(client);

            const req = { body: { jobId: 1, requestId: 2, decision: 'approve' } };
            const json = jest.fn();
            const status = jest.fn(() => ({ json }));
            const res = { status };
            await adminController.resolveDispute(req, res);
            expect(status).toHaveBeenCalledWith(200);
            expect(client.release).toHaveBeenCalled();
        });

        test('resolveDispute returns 200 on cancel', async () => {
            const client = { query: jest.fn(), release: jest.fn() };
            client.query
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({ rows: [{ cleaner_id: 2 }] }) // jobResult
                .mockResolvedValueOnce({}) // update requests
                .mockResolvedValueOnce({}) // update jobs
                .mockResolvedValueOnce({}); // COMMIT
            db.pool.connect = jest.fn().mockResolvedValue(client);

            const req = { body: { jobId: 1, requestId: 2, decision: 'cancel' } };
            const json = jest.fn();
            const status = jest.fn(() => ({ json }));
            const res = { status };
            await adminController.resolveDispute(req, res);
            expect(status).toHaveBeenCalledWith(200);
            expect(client.release).toHaveBeenCalled();
        });
        
        test('views render properly', async () => {
            db.query.mockResolvedValue({ rows: [] });
            const req = { session: {}, params: { id: 1 } };
            const res = { render: jest.fn(), status: jest.fn(() => ({ send: jest.fn() })) };
            
            await adminController.loginView(req, res);
            expect(res.render).toHaveBeenCalledWith('web/login', expect.any(Object));
            
            await adminController.profileView(req, res);
            expect(res.render).toHaveBeenCalledWith('web/profile', expect.any(Object));
            
            await adminController.usersView(req, res);
            expect(res.render).toHaveBeenCalledWith('web/users', expect.any(Object));
            
            await adminController.requestsView(req, res);
            expect(res.render).toHaveBeenCalledWith('web/requests', expect.any(Object));
            
            await adminController.complaintsView(req, res);
            expect(res.render).toHaveBeenCalledWith('web/complaints', expect.any(Object));
        });
        
        test('requestDetailView renders request if found', async () => {
            db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1, photos: [{ type: 'before', url: 'x' }] }] });
            const req = { session: {}, params: { id: 1 } };
            const res = { render: jest.fn() };
            await adminController.requestDetailView(req, res);
            expect(res.render).toHaveBeenCalledWith('web/request-detail', expect.any(Object));
        });
        
        test('userDetailView renders properly for cleaner', async () => {
            db.query
                .mockResolvedValueOnce({ rowCount: 1, rows: [{ role: 'cleaner', id: 1 }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [{ avg_rating: '4.5', rating_count: '10' }] });
            const req = { session: {}, params: { id: 1 } };
            const res = { render: jest.fn() };
            await adminController.userDetailView(req, res);
            expect(res.render).toHaveBeenCalledWith('web/user-detail', expect.any(Object));
        });

    });

    describe('Unit: ana_controller', () => {
        const anaController = require('./src/controller/ana_controller');

        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('anaSayfa for customer returns data', async () => {
            db.pool.query
                .mockResolvedValueOnce({ rows: [{ role: 'customer' }] })
                .mockResolvedValueOnce({ rows: [{ aktif_talep_adet: '2', onay_bekleyen_talep_adet: '1' }] })
                .mockResolvedValueOnce({ rows: [{ id: 1 }] })
                .mockResolvedValueOnce({ rows: [{ id: 2 }] });

            const req = { userId: 1 };
            const json = jest.fn();
            const status = jest.fn(() => ({ json }));
            const res = { status };
            await anaController.anaSayfa(req, res);
            expect(status).toHaveBeenCalledWith(200);
            expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        });

        test('anaSayfa for cleaner returns data', async () => {
            db.pool.query
                .mockResolvedValueOnce({ rows: [{ role: 'cleaner' }] })
                .mockResolvedValueOnce({ rows: [{ aktif_is_adet: '1', uygun_is_adet: '5' }] })
                .mockResolvedValueOnce({ rows: [{ id: 1 }] })
                .mockResolvedValueOnce({ rows: [{ id: 2 }] });

            const req = { userId: 2 };
            const json = jest.fn();
            const status = jest.fn(() => ({ json }));
            const res = { status };
            await anaController.anaSayfa(req, res);
            expect(status).toHaveBeenCalledWith(200);
            expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        });

        test('temizlikciProfil returns data', async () => {
            db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 1, role: 'cleaner' }] });
            const req = { userId: 1 };
            const json = jest.fn();
            const status = jest.fn(() => ({ json }));
            const res = { status };
            await anaController.temizlikciProfil(req, res);
            expect(status).toHaveBeenCalledWith(200);
        });
    });

    describe('Unit: is_controller (additional)', () => {
        const isController = require('./src/controller/is_controller');
        const fsExtra = require('fs');

        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('gecmisIsler returns data for cleaner', async () => {
            db.pool.query
                .mockResolvedValueOnce({ rows: [{ role: 'cleaner' }] })
                .mockResolvedValueOnce({ rows: [{ is_id: 1 }] });

            const req = { userId: 1 };
            const json = jest.fn();
            const status = jest.fn(() => ({ json }));
            const res = { status };
            await isController.gecmisIsler(req, res);
            expect(status).toHaveBeenCalledWith(200);
        });

        test('temizligeBasla returns 200 on success', async () => {
            const client = { query: jest.fn(), release: jest.fn() };
            client.query
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({ rows: [{ id: 1, request_id: 2, scheduled_start: new Date().toISOString() }] }) // job
                .mockResolvedValueOnce({ rows: [{ yeni_id: 'uuid' }] }) // uuid
                .mockResolvedValueOnce({}) // insert photo
                .mockResolvedValueOnce({}) // update job
                .mockResolvedValueOnce({}) // update request
                .mockResolvedValueOnce({}); // COMMIT
            db.pool.connect = jest.fn().mockResolvedValue(client);

            jest.spyOn(fsExtra, 'existsSync').mockReturnValue(false);
            jest.spyOn(fsExtra, 'mkdirSync').mockImplementation(() => {});
            jest.spyOn(fsExtra, 'renameSync').mockImplementation(() => {});

            const req = { userId: 1, files: [{ originalname: 'a.jpg', path: 'tmp1' }] };
            const json = jest.fn();
            const status = jest.fn(() => ({ json }));
            const res = { status };

            await isController.temizligeBasla(req, res);
            expect(status).toHaveBeenCalledWith(200);
        });

        test('temizligeBasla returns 400 when not on scheduled day', async () => {
            const client = { query: jest.fn(), release: jest.fn() };
            
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 1);

            client.query
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({ rows: [{ id: 1, request_id: 2, scheduled_start: pastDate.toISOString() }] }); // job
            db.pool.connect = jest.fn().mockResolvedValue(client);

            jest.spyOn(fsExtra, 'existsSync').mockReturnValue(true);
            jest.spyOn(fsExtra, 'unlinkSync').mockImplementation(() => {});

            const req = { userId: 1, files: [{ originalname: 'a.jpg', path: 'tmp1' }] };
            const json = jest.fn();
            const status = jest.fn(() => ({ json }));
            const res = { status };

            await isController.temizligeBasla(req, res);
            expect(status).toHaveBeenCalledWith(400);
            expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
            expect(client.release).toHaveBeenCalled();
        });

        test('temizligiBitir returns 200 on success', async () => {
            const client = { query: jest.fn(), release: jest.fn() };
            client.query
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({ rows: [{ id: 1, request_id: 2 }] }) // job
                .mockResolvedValueOnce({ rows: [{ yeni_id: 'uuid' }] }) // uuid
                .mockResolvedValueOnce({}) // insert photo
                .mockResolvedValueOnce({}) // update job
                .mockResolvedValueOnce({}) // update request
                .mockResolvedValueOnce({}); // COMMIT
            db.pool.connect = jest.fn().mockResolvedValue(client);

            jest.spyOn(fsExtra, 'existsSync').mockReturnValue(false);
            jest.spyOn(fsExtra, 'mkdirSync').mockImplementation(() => {});
            jest.spyOn(fsExtra, 'renameSync').mockImplementation(() => {});

            const req = { userId: 1, files: [{ originalname: 'b.jpg', path: 'tmp2' }], body: { temizlikciNotu: 'ok' } };
            const json = jest.fn();
            const status = jest.fn(() => ({ json }));
            const res = { status };

            await isController.temizligiBitir(req, res);
            expect(status).toHaveBeenCalledWith(200);
        });
        
        test('temizligiBitir returns 400 when no job', async () => {
            const client = { query: jest.fn(), release: jest.fn() };
            client.query
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({ rows: [] }); // no job
            db.pool.connect = jest.fn().mockResolvedValue(client);

            jest.spyOn(fsExtra, 'existsSync').mockReturnValue(true);
            jest.spyOn(fsExtra, 'unlinkSync').mockImplementation(() => {});

            const req = { userId: 1, files: [{ originalname: 'b.jpg', path: 'tmp2' }], body: {} };
            const json = jest.fn();
            const status = jest.fn(() => ({ json }));
            const res = { status };

            await isController.temizligiBitir(req, res);
            expect(status).toHaveBeenCalledWith(400);
        });
    });

    describe('Unit: talep_controller', () => {
        const talepController = require('./src/controller/talep_controller');
        const fsExtra = require('fs');

        beforeEach(() => {
            jest.clearAllMocks();
        });

        test('taleplerim returns data', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ id: 1, title: 't1' }] });
            const req = { userId: 1 };
            const json = jest.fn();
            const status = jest.fn(() => ({ json }));
            const res = { status };
            await talepController.taleplerim(req, res);
            expect(status).toHaveBeenCalledWith(200);
            expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        });
        
        test('talepDetay returns data', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ talep_id: 1 }] });
            const req = { userId: 1, body: { talepId: 1 } };
            const json = jest.fn();
            const status = jest.fn(() => ({ json }));
            const res = { status };
            await talepController.talepDetay(req, res);
            expect(status).toHaveBeenCalledWith(200);
        });

        test('talepOlustur returns 200 on success', async () => {
            const client = { query: jest.fn(), release: jest.fn() };
            client.query
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // insert request
                .mockResolvedValueOnce({ rows: [{ yeni_id: 'uuid' }] }) // uuid
                .mockResolvedValueOnce({}) // insert photo
                .mockResolvedValueOnce({}); // COMMIT
            db.pool.connect = jest.fn().mockResolvedValue(client);

            jest.spyOn(fsExtra, 'existsSync').mockReturnValue(false);
            jest.spyOn(fsExtra, 'mkdirSync').mockImplementation(() => {});
            jest.spyOn(fsExtra, 'renameSync').mockImplementation(() => {});

            const req = { 
                userId: 1, 
                files: [{ originalname: 'a.jpg', path: 'tmp1' }],
                body: { adresId: 1, baslik: 'B', aciklama: 'A', alan: 50, fiyat: 100, petVarMi: false, planlananTarih: '2026-01-01' }
            };
            const json = jest.fn();
            const status = jest.fn(() => ({ json }));
            const res = { status };

            await talepController.talepOlustur(req, res);
            expect(status).toHaveBeenCalledWith(200);
        });

        test('talepIptal returns 200 on success', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ status: 'draft' }] })
                .mockResolvedValueOnce({});
            const req = { userId: 1, body: { talepId: 1 } };
            const json = jest.fn();
            const status = jest.fn(() => ({ json }));
            const res = { status };
            await talepController.talepIptal(req, res);
            expect(status).toHaveBeenCalledWith(200);
        });

        test('talebiKapat returns 200 on approve', async () => {
            const client = { query: jest.fn(), release: jest.fn() };
            client.query
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({ rows: [{ req_status: 'awaiting_approval', job_id: 1, cleaner_id: 2 }] }) // request check
                .mockResolvedValueOnce({}) // update request
                .mockResolvedValueOnce({}) // update job
                .mockResolvedValueOnce({}) // insert approval
                .mockResolvedValueOnce({}); // COMMIT
            db.pool.connect = jest.fn().mockResolvedValue(client);
            
            const req = { userId: 1, body: { talepId: 1, isApproved: true, rating: 5, comment: 'good' } };
            const json = jest.fn();
            const status = jest.fn(() => ({ json }));
            const res = { status };
            await talepController.talebiKapat(req, res);
            expect(status).toHaveBeenCalledWith(200);
        });
        
        test('talebiKapat returns 200 on reject', async () => {
            const client = { query: jest.fn(), release: jest.fn() };
            client.query
                .mockResolvedValueOnce({}) // BEGIN
                .mockResolvedValueOnce({ rows: [{ req_status: 'awaiting_approval', job_id: 1, cleaner_id: 2 }] }) // request check
                .mockResolvedValueOnce({}) // update request
                .mockResolvedValueOnce({}) // insert approval
                .mockResolvedValueOnce({}); // COMMIT
            db.pool.connect = jest.fn().mockResolvedValue(client);
            
            const req = { userId: 1, body: { talepId: 1, isApproved: false, rating: 1, disputeReason: 'bad' } };
            const json = jest.fn();
            const status = jest.fn(() => ({ json }));
            const res = { status };
            await talepController.talebiKapat(req, res);
            expect(status).toHaveBeenCalledWith(200);
        });
    });

});