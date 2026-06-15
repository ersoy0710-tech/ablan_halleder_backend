const db = require("../db/db.js")

const path = require("path");
const fs = require("fs");

const { verifyAuthToken } = require("../common/jwt.js")

const anaSayfa = async (req, res, next) => {
    const userId = req.userId;

    try {
        const userQuery = await db.pool.query('SELECT role FROM users WHERE id = $1', [userId]);
        
        if (userQuery.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
        }

        const userRole = userQuery.rows[0].role;

        if (userRole === 'customer') {
            const sorgu1 = `
                SELECT 
                    COUNT(*) FILTER (WHERE status IN ('published', 'assigned', 'in_progress')) AS aktif_talep_adet,
                    COUNT(*) FILTER (WHERE status IN ('awaiting_approval')) onay_bekleyen_talep_adet
                FROM service_requests 
                WHERE customer_id = $1
            `;

            const sorgu2 = `
                SELECT id, title AS baslik, status AS is_durumu, (scheduled_start AT TIME ZONE 'Europe/Istanbul') AS planlanan_tarih
                FROM service_requests 
                WHERE customer_id = $1 AND status IN ('assigned', 'in_progress')
                ORDER BY scheduled_start ASC 
                LIMIT 1
            `;

            const sorgu3 = `
                SELECT 
                    sr.id, sr.title AS baslik,
                    CASE 
                        WHEN sr.status = 'canceled' THEN 'canceled'
                        ELSE COALESCE(a.status::text, sr.status::text)
                    END AS is_durumu, 
                    (sr.scheduled_start AT TIME ZONE 'Europe/Istanbul') AS planlanan_tarih
                FROM service_requests sr
                LEFT JOIN jobs j ON sr.id = j.request_id
                LEFT JOIN approvals a ON j.id = a.job_id
                WHERE sr.customer_id = $1 AND sr.status IN ('completed', 'canceled')
                ORDER BY sr.scheduled_start DESC 
                LIMIT 3
            `;

            const [sorgu1Res, sorgu2Res, sorgu3Res] = await Promise.all([
                db.pool.query(sorgu1, [userId]),
                db.pool.query(sorgu2, [userId]),
                db.pool.query(sorgu3, [userId])
            ]);

            return res.status(200).json({
                success: true,
                data: {
                    rol: 'customer',
                    ozet: {
                        aktif_talep_adet: parseInt(sorgu1Res.rows[0].aktif_talep_adet) || 0,
                        onay_bekleyen_talep_adet: parseInt(sorgu1Res.rows[0].onay_bekleyen_talep_adet) || 0
                    },
                    aktif_talep: sorgu2Res.rows.length > 0 ? sorgu2Res.rows[0] : null,
                    son_talepler: sorgu3Res.rows
                }
            });
        } 
        else if (userRole === 'cleaner') {
            const sorgu1 = `
                SELECT 
                    (SELECT COUNT(*) FROM jobs WHERE cleaner_id = $1 AND status IN ('assigned', 'in_progress', 'awaiting_approval')) AS aktif_is_adet,
                    (SELECT COUNT(*) FROM service_requests WHERE status = 'published') AS uygun_is_adet
            `;

            const sorgu2 = `
                SELECT 
                    j.id, sr.title AS baslik,
                    CASE 
                        WHEN sr.status = 'canceled' THEN 'canceled'
                        ELSE COALESCE(a.status::text, j.status::text)
                    END AS is_durumu, 
                    (sr.scheduled_start AT TIME ZONE 'Europe/Istanbul') AS planlanan_tarih
                FROM jobs j
                JOIN service_requests sr ON j.request_id = sr.id
                LEFT JOIN approvals a ON j.id = a.job_id
                WHERE j.cleaner_id = $1 AND j.status IN ('assigned', 'in_progress', 'awaiting_approval')
                ORDER BY sr.scheduled_start ASC 
                LIMIT 1
            `;

            const sorgu3 = `
                SELECT 
                    j.id, sr.title AS baslik,
                    CASE 
                        WHEN sr.status = 'canceled' THEN 'canceled'
                        ELSE COALESCE(a.status::text, j.status::text)
                    END AS is_durumu,
                    (sr.scheduled_start AT TIME ZONE 'Europe/Istanbul') AS planlanan_tarih
                FROM jobs j
                JOIN service_requests sr ON j.request_id = sr.id
                LEFT JOIN approvals a ON j.id = a.job_id
                WHERE j.cleaner_id = $1 AND j.status = 'completed'
                ORDER BY sr.scheduled_start DESC 
                LIMIT 3
            `;

            const [sorgu1Res, sorgu2Res, sorgu3Res] = await Promise.all([
                db.pool.query(sorgu1, [userId]),
                db.pool.query(sorgu2, [userId]),
                db.pool.query(sorgu3, [userId])
            ]);

            return res.status(200).json({
                success: true,
                data: {
                    rol: 'cleaner',
                    ozet: {
                        aktif_is_adet: parseInt(sorgu1Res.rows[0].aktif_is_adet) || 0,
                        uygun_is_adet: parseInt(sorgu1Res.rows[0].uygun_is_adet) || 0
                    },
                    aktif_is: sorgu2Res.rows.length > 0 ? sorgu2Res.rows[0] : null,
                    son_isler: sorgu3Res.rows
                }
            });
        } 
        else {
            return res.status(403).json({ success: false, message: 'Bu işlem için yetkiniz yok.' });
        }
    }
    catch (err) {
        console.error("Ana sayfa verileri çekilirken hata:", err);
        return res.status(500).json({ success: false, message: 'Ana sayfa verileri alınamadı!' });
    }
}

const temizlikciProfil = async (req, res, next) => {
    const cleanerId = req.userId

    try {
        const sorgu = `
            SELECT 
                u.id, 
                u.full_name, 
                u.email, 
                u.phone, 
                u.summary,
                COALESCE((
                    SELECT ROUND(AVG(a.rating), 1) 
                    FROM approvals a 
                    JOIN jobs j ON a.job_id = j.id 
                    WHERE j.cleaner_id = u.id AND a.rating IS NOT NULL
                ), 0) as avg_rating,
                COALESCE((
                    SELECT COUNT(a.rating) 
                    FROM approvals a 
                    JOIN jobs j ON a.job_id = j.id 
                    WHERE j.cleaner_id = u.id AND a.rating IS NOT NULL
                ), 0) as rating_count,
                COALESCE((
                    SELECT json_agg(job_data) 
                    FROM (
                        SELECT 
                            sr.title, 
                            sr.description,
                            CASE 
                                WHEN sr.status = 'canceled' THEN 'canceled'
                                ELSE COALESCE(a.status::text, sr.status::text) 
                            END AS status,
                            TO_CHAR(j.accepted_at, 'DD.MM.YYYY') as date 
                        FROM jobs j
                        JOIN service_requests sr ON j.request_id = sr.id
                        LEFT JOIN approvals a ON j.id = a.job_id
                        WHERE j.cleaner_id = u.id
                        ORDER BY j.accepted_at DESC
                    ) job_data
                ), '[]'::json) as history
            FROM users u
            WHERE u.id = $1 AND u.role = 'cleaner'
        `;

        const result = await db.query(sorgu, [cleanerId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Temizlikçi bulunamadı.' 
            });
        }

        res.status(200).json({
            success: true,
            data: result.rows[0]
        });

    } catch (err) {
        console.error("Temizlikçi profili getirilirken hata:", err);
        res.status(500).json({ 
            success: false, 
            message: 'Sunucu hatası.' 
        });
    }
};

/*
const temizlikciProfil = async (req, res, next) => {
    const { cleanerId } = req.body;

    try {
        const sorgu = `
            SELECT 
                u.id, 
                u.full_name, 
                u.email, 
                u.phone, 
                u.ai_summary,
                (SELECT ROUND(AVG(a.rating), 1) FROM approvals a 
                JOIN jobs j ON a.job_id = j.id 
                WHERE j.cleaner_id = u.id AND a.rating IS NOT NULL) as avg_rating,
                (SELECT COUNT(a.rating) FROM approvals a 
                JOIN jobs j ON a.job_id = j.id 
                WHERE j.cleaner_id = u.id AND a.rating IS NOT NULL) as rating_count,
                (SELECT json_agg(job_data) FROM (
                    SELECT 
                        sr.title, 
                        sr.description, 
                        j.status, 
                        TO_CHAR(j.accepted_at, 'DD.MM.YYYY') as date 
                    FROM jobs j
                    JOIN service_requests sr ON j.request_id = sr.id
                    WHERE j.cleaner_id = u.id
                    ORDER BY j.accepted_at DESC
                ) job_data) as history
            FROM users u
            WHERE u.id = $1 AND u.role = 'cleaner'
        `;

        const result = await db.query(sorgu, [cleanerId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Temizlikçi bulunamadı.' });
        }

        res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    }
    catch (err) {
        console.error("Temizlikçi profili getirilirken hata:", err);
        res.status(500).json({ success: false, message: 'Sunucu hatası.' });
    }
};
*/

module.exports = {
    anaSayfa,
    temizlikciProfil
}