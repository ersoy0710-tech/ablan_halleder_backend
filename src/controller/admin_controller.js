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

const logout = async (req, res, next) => {
    if (req.session) {
        req.session.destroy((err) => {
            if (err) {
                console.error("Oturum kapatılırken hata oluştu:", err);
                return next(err);
            }
            res.redirect('/login');
        });
    }
    else {
        res.redirect('/login');
    }
};

const homeView = async (req, res, next) => {
    try {
        const user = req.session && req.session.user ? req.session.user : null;

        const [usersRes, requestsRes, complaintsRes] = await Promise.all([
            db.query(`SELECT role, COUNT(*) as count FROM users GROUP BY role`),
            
            db.query(`SELECT status, COUNT(*) as count FROM service_requests GROUP BY status`),
            
            db.query(`
                SELECT COUNT(*) as count 
                FROM approvals a 
                JOIN jobs j ON a.job_id = j.id 
                JOIN service_requests sr ON j.request_id = sr.id 
                WHERE a.status = 'disputed' AND sr.status != 'canceled'
            `)
        ]);

        const stats = {
            customers: 0,
            cleaners: 0,
            activeRequests: 0,
            completedRequests: 0,
            pendingComplaints: parseInt(complaintsRes.rows[0]?.count || 0, 10)
        };

        usersRes.rows.forEach(row => {
            if (row.role === 'customer') stats.customers = parseInt(row.count, 10);
            if (row.role === 'cleaner') stats.cleaners = parseInt(row.count, 10);
        });

        requestsRes.rows.forEach(row => {
            const count = parseInt(row.count, 10);
            if (['published', 'assigned', 'in_progress'].includes(row.status)) {
                stats.activeRequests += count;
            } else if (row.status === 'completed') {
                stats.completedRequests += count;
            }
        });

        res.render('web/home', {
            user: user,
            stats: stats,
            layout: "layouts/default"
        });
    }
    catch (err) {
        console.error("Dashboard istatistikleri çekilirken hata oluştu:", err);
        next(err);
    }
};

const profileView = async (req, res, next) => {
    const user = req.session && req.session.user ? req.session.user : null;
    res.render('web/profile', 
    {
        user: user,
        layout: "layouts/default"
    });
}

const changePassword = async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;
    
    const userId = req.session && req.session.user ? req.session.user.id : null;

    try {
        const kontrolSorgu = `SELECT id FROM users WHERE id = $1 AND password = $2`;
        const kontrolSonuc = await db.query(kontrolSorgu, [userId, currentPassword]);

        if (kontrolSonuc.rows.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Mevcut şifrenizi yanlış girdiniz!' 
            });
        }

        const guncelleSorgu = `UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2`;
        await db.query(guncelleSorgu, [newPassword, userId]);

        return res.status(200).json({
            success: true,
            message: 'Şifreniz başarıyla güncellendi.'
        });

    }
    catch (err) {
        console.error("Şifre Değiştirme Hatası:", err);
        return res.status(500).json({
            success: false,
            message: 'İşlem sırasında sistemsel bir hata oluştu!'
        });
    }
};

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

const userDetailView = async (req, res, next) => {
    try {
        const currentUser = req.session && req.session.user ? req.session.user : null;
        const targetUserId = req.params.id;

        const userQuery = `
            SELECT id, full_name, email, phone, role, status, summary, 
                   TO_CHAR(created_at, 'DD.MM.YYYY HH24:MI') AS created_at 
            FROM users 
            WHERE id = $1
        `;
        const userResult = await db.query(userQuery, [targetUserId]);

        if (userResult.rowCount === 0) {
            return res.status(404).send("Kullanıcı bulunamadı.");
        }

        const targetUser = userResult.rows[0];

        let history = []; 
        let avgRating = 0;
        let ratingCount = 0;
        let summary = "";

        if (targetUser.role === 'customer') {
            const historyQuery = `
                SELECT 
                    sr.id AS request_id, 
                    sr.title, 
                    sr.description, 
                    CASE 
                        WHEN sr.status = 'canceled' THEN 'canceled'
                        ELSE COALESCE(a.status::text, sr.status::text) 
                    END AS status,
                    TO_CHAR(sr.created_at, 'DD.MM.YYYY HH24:MI') AS date,
                    a.status AS approval_status,
                    a.rating,
                    a.comment,
                    a.dispute_reason,
                    TO_CHAR(a.created_at, 'DD.MM.YYYY HH24:MI') AS approval_date
                FROM service_requests sr
                LEFT JOIN jobs j ON sr.id = j.request_id
                LEFT JOIN approvals a ON j.id = a.job_id
                WHERE sr.customer_id = $1 
                ORDER BY sr.created_at DESC
            `;
            const historyResult = await db.query(historyQuery, [targetUserId]);
            history = historyResult.rows;

        }
        else if (targetUser.role === 'cleaner') {
            const historyQuery = `
                SELECT 
                    sr.id AS request_id, 
                    sr.title, 
                    sr.description, 
                    CASE 
                        WHEN sr.status = 'canceled' THEN 'canceled'
                        ELSE COALESCE(a.status::text, sr.status::text) 
                    END AS status,
                    TO_CHAR(j.accepted_at, 'DD.MM.YYYY HH24:MI') AS date,
                    a.status AS approval_status,
                    a.rating,
                    a.comment,
                    a.dispute_reason,
                    TO_CHAR(a.created_at, 'DD.MM.YYYY HH24:MI') AS approval_date
                FROM jobs j
                JOIN service_requests sr ON j.request_id = sr.id
                LEFT JOIN approvals a ON j.id = a.job_id
                WHERE j.cleaner_id = $1 
                ORDER BY j.accepted_at DESC NULLS LAST
            `;
            const historyResult = await db.query(historyQuery, [targetUserId]);
            history = historyResult.rows;

            const ratingQuery = `
                SELECT ROUND(AVG(a.rating), 1) as avg_rating, COUNT(a.rating) as rating_count
                FROM approvals a
                JOIN jobs j ON a.job_id = j.id
                WHERE j.cleaner_id = $1 AND a.rating IS NOT NULL
            `;
            const ratingResult = await db.query(ratingQuery, [targetUserId]);
            
            if (ratingResult.rows[0] && parseInt(ratingResult.rows[0].rating_count) > 0) {
                avgRating = parseFloat(ratingResult.rows[0].avg_rating);
                ratingCount = parseInt(ratingResult.rows[0].rating_count);
                summary = targetUser.summary || "Henüz yapay zeka özeti oluşturulmadı.";
            }
        }

        res.render('web/user-detail', {
            user: currentUser,
            targetUser: targetUser,
            history: history,
            avgRating: avgRating,
            ratingCount: ratingCount,
            summary: summary,
            layout: "layouts/default"
        });

    } catch (error) {
        console.error("Kullanıcı detayları getirilirken hata oluştu:", error);
        next(error);
    }
};

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
    const sorgu = `SELECT 
                        SR.id, 
                        U.full_name AS customer, 
                        CONCAT(C.name, '/', D.name) AS address, 
                        SR.title, 
                        SR.description, 
                        SR.area_sqm, 
                        SR.has_pets, 
                        TO_CHAR((SR.scheduled_start AT TIME ZONE 'Europe/Istanbul'), 'DD.MM.YYYY HH24:MI') AS scheduled_start, 
                        CASE 
                            WHEN SR.status = 'canceled' THEN 'canceled'
                            ELSE COALESCE(APP.status::text, SR.status::text)
                        END AS status,
                        TO_CHAR((SR.created_at AT TIME ZONE 'Europe/Istanbul'), 'DD.MM.YYYY HH24:MI') AS created_at
                    FROM service_requests SR
                    JOIN users U ON SR.customer_id = U.id
                    JOIN addresses A ON SR.address_id = A.id
                    JOIN cities C ON A.city_id = C.id
                    JOIN districts D ON A.district_id = D.id
                    LEFT JOIN jobs J ON J.request_id = SR.id
                    LEFT JOIN approvals APP ON APP.job_id = J.id

                    ORDER BY SR.created_at DESC;`;

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
        const sorgu = `SELECT 
                        SR.id, 
                        U.full_name AS customer, 
                        U.phone AS customer_phone,
                        CONCAT(C.name, '/', D.name) AS address_summary, 
                        A.address_line AS full_address,
                        SR.title, 
                        SR.description, 
                        SR.area_sqm, 
                        SR.price, 
                        SR.has_pets, 
                        TO_CHAR((SR.scheduled_start AT TIME ZONE 'Europe/Istanbul'), 'DD.MM.YYYY HH24:MI') AS scheduled_start,
                        CASE 
                            WHEN SR.status = 'canceled' THEN 'canceled'
                            ELSE COALESCE(APP.status::text, SR.status::text) 
                        END AS status,
                        TO_CHAR((SR.created_at AT TIME ZONE 'Europe/Istanbul'), 'DD.MM.YYYY HH24:MI') AS created_at,
                        CLEANER.full_name AS cleaner_name,
                        CLEANER.phone AS cleaner_phone,
                        APP.rating,
                        APP.comment,
                        APP.dispute_reason,
                        J.id AS job_id,
                        (
                            SELECT json_agg(json_build_object('type', P.type, 'url', P.url) ORDER BY P.sort_order)
                            FROM job_evidence_photos P
                            WHERE P.job_id = J.id
                        ) AS photos
                    FROM service_requests SR
                    JOIN users U ON SR.customer_id = U.id
                    JOIN addresses A ON SR.address_id = A.id
                    JOIN cities C ON A.city_id = C.id
                    JOIN districts D ON A.district_id = D.id
                    LEFT JOIN jobs J ON J.request_id = SR.id
                    LEFT JOIN approvals APP ON APP.job_id = J.id
                    LEFT JOIN users CLEANER ON J.cleaner_id = CLEANER.id
                    WHERE SR.id = $1;`;

        const result = await db.query(sorgu, [requestId]);
        if (result.rowCount === 0) {
            throw new Error("");
        }

        const requestData = result.rows[0];

        const beforePhotos = [];
        const afterPhotos = [];
        if (requestData.photos) {
            requestData.photos.forEach(photo => {
                if (photo.type === 'before') beforePhotos.push(photo.url);
                if (photo.type === 'after') afterPhotos.push(photo.url);
            });
        }

        res.render('web/request-detail', {
            user,
            request: requestData,
            beforePhotos,
            afterPhotos,
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

const complaintsView = async (req, res, next) => {
    try {
        const user = req.session && req.session.user ? req.session.user : null;

        const sorgu = `
            SELECT 
                a.id AS approval_id,
                a.dispute_reason,
                TO_CHAR(a.created_at, 'DD.MM.YYYY HH24:MI') AS date,
                u_cust.full_name AS customer_name,
                u_clean.full_name AS cleaner_name,
                sr.id AS request_id,
                sr.title AS request_title
            FROM approvals a
            JOIN jobs j ON a.job_id = j.id
            JOIN service_requests sr ON j.request_id = sr.id
            JOIN users u_cust ON a.customer_id = u_cust.id
            JOIN users u_clean ON j.cleaner_id = u_clean.id
            WHERE a.status = 'disputed' AND sr.status != 'canceled'
            ORDER BY a.created_at DESC
        `;

        const sonuc = await db.query(sorgu);

        res.render('web/complaints', {
            user: user,
            complaints: sonuc.rows,
            layout: "layouts/default"
        });

    } catch (err) {
        console.error("Şikayetler listelenirken hata oluştu:", err);
        next(err);
    }
}

const resolveDispute = async (req, res, next) => {
    const { jobId, requestId, decision } = req.body;

    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        const jobResult = await client.query('SELECT cleaner_id FROM jobs WHERE id = $1', [jobId]);
        const cleanerId = jobResult.rows[0]?.cleaner_id;

        if (decision === 'approve') {
            
            await client.query(
                `UPDATE service_requests SET status = 'completed', updated_at = NOW() WHERE id = $1`, 
                [requestId]
            );
            
            await client.query(
                `UPDATE jobs SET status = 'completed', completed_at = NOW() WHERE id = $1`, 
                [jobId]
            );
            
            await client.query(
                `UPDATE approvals SET status = 'approved', approved_at = NOW() WHERE job_id = $1 AND status = 'disputed'`, 
                [jobId]
            );

        }
        else if (decision === 'cancel') {
            await client.query(
                `UPDATE service_requests SET status = 'canceled', updated_at = NOW() WHERE id = $1`, 
                [requestId]
            );
            
            await client.query(
                `UPDATE jobs SET status = 'completed', completed_at = NOW() WHERE id = $1`, 
                [jobId]
            );
            
        }
        else {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                success: false, 
                message: 'Geçersiz işlem türü!' 
            });
        }

        await client.query('COMMIT');

        if (cleanerId) {
            updateCleanerAISummary(cleanerId);
        }

        return res.status(200).json({
            success: true,
            message: decision === 'approve' 
                ? 'İtiraz reddedildi ve iş tamamlandı olarak işaretlendi.' 
                : 'İtiraz haklı bulundu ve müşteri talebi iptal edildi.'
        });

    }
    catch (err) {
        await client.query('ROLLBACK');
        console.error("İtiraz Çözümleme Hatası:", err);
        return res.status(500).json({ 
            success: false, 
            message: 'İşlemi tamamlarken sistemsel bir hata oluştu!' 
        });
    }
    finally {
        client.release();
    }
};

const updateCleanerAISummary = async (cleanerId) => {
    try {
        const commentsQuery = `
            SELECT a.comment, a.dispute_reason 
            FROM approvals a
            JOIN jobs j ON a.job_id = j.id
            WHERE j.cleaner_id = $1 
            AND (a.comment IS NOT NULL OR a.dispute_reason IS NOT NULL)
        `;

        const commentsResult = await db.pool.query(commentsQuery, [cleanerId]);
        if (commentsResult.rows.length === 0) return;

        const allComments = commentsResult.rows.map(row => {
            return row.comment ? row.comment : row.dispute_reason;
        }).join(" | ");

        const promptText = `Aşağıdaki müşteri yorumlarını inceleyerek bu personel için genel performansını yansıtan kurumsal bir özet oluştur:\n\n${allComments}`;

        const ollamaResponse = await fetch(`${process.env.OLLAMA_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'ik_asistani',
                prompt: promptText,
                stream: false
            })
        });

        const ollamaData = await ollamaResponse.json();
        
        if (ollamaData && ollamaData.response) {
            const aiSummary = ollamaData.response.trim();

            const updateQuery = `UPDATE users SET summary = $1 WHERE id = $2`;
            await db.pool.query(updateQuery, [aiSummary, cleanerId]);
        }

    } catch (error) {
        console.error("❌ AI Özet Güncelleme Hatası:", error.message);
    }
};

module.exports = {
    loginView,
    login,
    logout,

    homeView,
    profileView,
    changePassword,

    usersView,
    userDetailView,
    toggleUserStatus,

    requestsView,
    requestDetailView,
    approveRequest,
    rejectRequest,

    complaintsView,
    resolveDispute
}