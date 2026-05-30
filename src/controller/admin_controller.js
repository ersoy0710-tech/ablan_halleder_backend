const db = require("../db/db.js")

const loginView = async (req, res, next) => {
    res.render('web/login', 
    {
        layout: false,
        errors: [],
        old: {}
    });
}

const login = async (req, res, next) => {
    const { email, password } = req.body;

    try {
        const sorgu = `SELECT id, full_name, email, phone 
                       FROM users 
                       WHERE email = $1 AND password = $2 AND role = 'admin' AND status = 'active'`;

        const degerler = [email, password];
        const sonuc = await db.query(sorgu, degerler);

        if (sonuc.rows.length > 0) {
            const admin = sonuc.rows[0];
            req.session.user = {
                id: admin["id"],
                email: admin["email"],
                full_name: admin["full_name"],
                phone: admin["phone"],
                role: admin["role"]
            };

            return res.status(200).json({
                success: true,
                message: ''
            });
        }
        else {
            throw new Error('Kullanıcı bulunamadı!');
        }
    }
    catch (err) {
        console.log(err);
        
        res.status(500).json({
            success: false,
            message: 'Kullanıcı bulunamadı!'
        });
    }
}

const homeView = async (req, res, next) => {
    const user = req.session && req.session.user ? req.session.user : null;
    res.render('web/home', 
    {
        user: user,
        layout: "layouts/default"
    });
}

const usersView = async (req, res, next) => {
    const user = req.session && req.session.user ? req.session.user : null;
    const sorgu = `SELECT id, full_name, email, phone, role, status, TO_CHAR(created_at, 'DD.MM.YYYY HH24:MI') AS created_at 
                   FROM users`;

    const users = await db.query(sorgu);
    res.render('web/users', 
    {
        user: user,
        users: users.rows,
        layout: "layouts/default"
    });
}

const toggleUserStatus = async (req, res, next) => {
    const userId = req.params.id;

    try {
        const sorgu = `UPDATE users
                       SET status = (
                                    CASE
                                        WHEN status = 'active' THEN 'suspended'
                                        ELSE 'active'
                                    END
                                )::user_status,
                           updated_at = NOW()
                       WHERE id = $1
                       RETURNING status`;

        const sonuc = await db.query(sorgu, [userId]);

        if (sonuc.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Kullanıcı bulunamadı.'
            });
        }

        return res.json({
            success: true,
            status: sonuc.rows[0].status
        });
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({
            success: false,
            message: 'Durum güncellenirken hata oluştu.'
        });
    }
}

const requestsView = async (req, res, next) => {
    const user = req.session && req.session.user ? req.session.user : null;
    const sorgu = `SELECT SR.id, U.full_name customer, CONCAT(C.name, '/', D.name) AS address, SR.title, SR.description, SR.area_sqm, SR.has_pets, TO_CHAR(SR.scheduled_start, 'DD.MM.YYYY HH24:MI') AS scheduled_start, SR.status, TO_CHAR(SR.created_at, 'DD.MM.YYYY HH24:MI') AS created_at 
                   FROM service_requests SR, users U, addresses A, cities C, districts D
                   WHERE SR.customer_id = U.id AND SR.address_id = A.id AND A.city_id = C.id AND A.district_id = D.id`;

    const requests = await db.query(sorgu);
    res.render('web/requests', 
    {
        user: user,
        requests: requests.rows,
        layout: "layouts/default"
    });
}

const requestDetailView = async (req, res, next) => {
    const user = req.session && req.session.user ? req.session.user : null;
    const requestId = req.params.id;
    try {
        const sorgu = `SELECT SR.id, U.full_name customer, CONCAT(C.name, '/', D.name) AS address, SR.title, SR.description, SR.area_sqm, SR.price, SR.has_pets, TO_CHAR(SR.scheduled_start, 'DD.MM.YYYY HH24:MI') AS scheduled_start, SR.status, TO_CHAR(SR.created_at, 'DD.MM.YYYY HH24:MI') AS created_at 
                   FROM service_requests SR, users U, addresses A, cities C, districts D
                   WHERE SR.customer_id = U.id AND SR.address_id = A.id AND A.city_id = C.id AND A.district_id = D.id AND SR.id = $1`;

        const result = await db.query(sorgu, [requestId]);
        if (result.rowCount === 0) {
            throw new Error("");
        }

        res.render('web/request-detail', {
            user,
            request: result.rows[0],
            layout: 'layouts/default'
        });
    }
    catch (error) {
        return res.status(404).render('web/request-detail', {
            user,
            request: null,
            layout: 'layouts/default',
            message: 'Talep bulunamadı.'
        });
    }
}

const approveRequest = async (req, res, next) => {
    const { requestId } = req.params;
    
    try {
        const sorgu = `UPDATE service_requests SET status = 'published' WHERE id = $1`;
        await db.query(sorgu, [requestId]);

        return res.status(200).json({
            success: true,
            message: 'Talep başarıyla onaylandı ve yayınlandı.'
        });
    }
    catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Hata oluştu!'
        });
    }
}

const rejectRequest = async (req, res, next) => {
    const { requestId } = req.params;
    
    try {
        const sorgu = `UPDATE service_requests SET status = 'canceled' WHERE id = $1`;
        await db.query(sorgu, [requestId]);

        return res.status(200).json({
            success: true,
            message: 'Talep başarıyla reddedildi.'
        });
    }
    catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Hata oluştu!'
        });
    }
}

module.exports = {
    loginView,
    login,

    homeView,

    usersView,
    toggleUserStatus,

    requestsView,
    requestDetailView,
    approveRequest,
    rejectRequest
}