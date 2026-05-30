const db = require("../db/db.js")

const path = require("path");
const fs = require("fs");

const { verifyAuthToken } = require("../common/jwt.js")

const taleplerim = async (req, res, next) => {
    try {
        const userId = req.userId;

        const sorgu = `SELECT 
                            S.id, 
                            S.title, 
                            S.description, 
                            S.area_sqm, 
                            S.has_pets, 
                            (S.scheduled_start AT TIME ZONE 'Europe/Istanbul') AS scheduled_start,
                            COALESCE(A.status::text, S.status::text) AS status
                        FROM service_requests S
                        LEFT JOIN jobs J ON J.request_id = S.id 
                        LEFT JOIN approvals A ON A.job_id = J.id
                        WHERE S.customer_id = $1;`;

        const degerler = [userId];
        const sonuc = await db.query(sorgu, degerler);
        
        const taleplerim = sonuc.rows.map(item => ({
            talepId: item.id,
            baslik: item.title,
            aciklama: item.description,
            alan: item.area_sqm,
            hayvanVarMi: item.has_pets,
            planlananTarih: item.scheduled_start,
            durum: item.status
        }));

        return res.status(200).json({
            success: true,
            message: '',
            data: taleplerim
        });
    }
    catch (err) {
        console.log(err);
        
        res.status(500).json({
            success: false,
            message: 'Hata oluştu!'
        });
    }
}

const talepOlustur = async (req, res, next) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, message: 'En az 1 fotoğraf eklemelisiniz!' });
    }

    const { adresId, baslik, aciklama, alan, fiyat, petVarMi, planlananTarih } = req.body;
    const musteriId = req.userId;

    const client = await db.pool.connect();
    let talepId = null;

    try {
        await client.query('BEGIN');

        const sorgu = `INSERT INTO service_requests (customer_id, address_id, title, description, area_sqm, price, has_pets, scheduled_start, status, created_at, updated_at) 
                       VALUES ($1, $2, $3, $4, $5, $6, $7, ($8 AT TIME ZONE 'Europe/Istanbul'), $9, timezone('Europe/Istanbul', NOW()), timezone('Europe/Istanbul', NOW())) 
                       RETURNING id`;

        const degerler = [musteriId, adresId, baslik, aciklama, alan, fiyat, petVarMi, planlananTarih, "draft"];
        const sonuc = await client.query(sorgu, degerler);
        talepId = sonuc.rows[0].id;

        const targetDir = path.join(__dirname, `../uploads/${talepId}/request_photos`);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        let sortOrder = 0;
        for (const file of req.files) {
            const uuidSonuc = await client.query(`SELECT gen_random_uuid() AS yeni_id`);
            const photoId = uuidSonuc.rows[0].yeni_id;

            const extension = path.extname(file.originalname);
            const newFileName = `${photoId}${extension}`;
            const finalPath = path.join(targetDir, newFileName);

            fs.renameSync(file.path, finalPath);

            const relativeUrl = `/uploads/${talepId}/request_photos/${newFileName}`;

            const insertFotoSorgu = `
                INSERT INTO service_request_photos (id, request_id, url, sort_order, created_at)
                VALUES ($1, $2, $3, $4, NOW())
            `;
            await client.query(insertFotoSorgu, [photoId, talepId, relativeUrl, sortOrder]);
            sortOrder++;
        }

        await client.query('COMMIT');

        return res.status(200).json({
            success: true,
            message: 'TALEP BAŞARIYLA OLUŞTURULDU.',
        });
    }
    catch (err) {
        await client.query('ROLLBACK');
        console.log(err);
        
        if (req.files) {
            for (const file of req.files) {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            }
        }

        if (talepId) {
            const talepKlasoru = path.join(__dirname, `../uploads/${talepId}`);
            if (fs.existsSync(talepKlasoru)) {
                fs.rmSync(talepKlasoru, { recursive: true, force: true });
            }
        }

        return res.status(500).json({
            success: false,
            message: 'Hata oluştu!'
        });
    }
    finally {
        client.release();
    }
}

const talepDetay = async (req, res, next) => {
    const { talepId } = req.body;

    try {
        const userId = req.userId;

        const sorgu = `SELECT 
                            S.id AS talep_id, 
                            S.title AS baslik, 
                            S.description AS aciklama, 
                            S.area_sqm AS alan, 
                            S.has_pets AS hayvan_var_mi, 
                            COALESCE(APP.status::text, S.status::text) AS talep_durumu,
                            (S.scheduled_start AT TIME ZONE 'Europe/Istanbul') AS planlanan_tarih,
                            (S.price)::INTEGER AS fiyat,
                            C.name AS il, 
                            D.name AS ilce,
                            A.address_line AS acik_adres,
                            J.status AS is_durumu,
                            J.cleaner_note AS temizlikci_notu,
                            U.full_name AS temizlikci_ad_soyad,
                            U.phone AS temizlikci_telefon,
                            APP.rating AS degerlendirme_puani,
                            APP.comment AS musteri_yorumu,
                            APP.dispute_reason AS itiraz_sebebi,
                            (
                                SELECT COALESCE(
                                    json_agg(json_build_object('foto_url', SP.url)), '[]'
                                )
                                FROM service_request_photos SP
                                WHERE SP.request_id = S.id
                            ) AS talep_fotograflari,
                            (
                                SELECT COALESCE(
                                    json_agg(json_build_object('foto_url', P.url, 'foto_tip', P.type)), '[]'
                                )
                                FROM job_evidence_photos P
                                WHERE P.job_id = J.id
                            ) AS is_fotograflari
                        FROM service_requests S
                        JOIN addresses A ON S.address_id = A.id
                        JOIN cities C ON A.city_id = C.id
                        JOIN districts D ON A.district_id = D.id
                        LEFT JOIN jobs J ON J.request_id = S.id
                        LEFT JOIN users U ON J.cleaner_id = U.id
                        LEFT JOIN approvals APP ON APP.job_id = J.id
                        WHERE S.id = $1 AND S.customer_id = $2;`;

        const degerler = [talepId, userId];
        const sonuc = await db.query(sorgu, degerler);

        return res.status(200).json({
            success: true,
            message: '',
            data: sonuc.rows
        });
    }
    catch (error) {
        console.log(err);
        
        res.status(500).json({
            success: false,
            message: 'Hata oluştu!'
        });
    }
}

const talepIptal = async (req, res, next) => {
    const { talepId } = req.body; 

    try {
        const musteriId = req.userId;

        const kontrolSorgu = `SELECT status FROM service_requests WHERE id = $1 AND customer_id = $2`;
        const kontrolSonuc = await db.query(kontrolSorgu, [talepId, musteriId]);

        if (kontrolSonuc.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Talep bulunamadı veya bu talebi iptal etme yetkiniz yok.' 
            });
        }

        const talepDurumu = kontrolSonuc.rows[0].status;

        if (talepDurumu !== 'draft' && talepDurumu !== 'published') {
            return res.status(400).json({ 
                success: false, 
                message: 'Bu talep şu anda işlemde veya tamamlanmış olduğu için iptal edilemez!' 
            });
        }

        const guncelleSorgu = `
            UPDATE service_requests 
            SET status = 'canceled', updated_at = timezone('Europe/Istanbul', NOW()) 
            WHERE id = $1
        `;
        await db.query(guncelleSorgu, [talepId]);

        return res.status(200).json({
            success: true,
            message: 'Talebin başarıyla iptal edildi.'
        });

    } catch (err) {
        console.log("Talep iptal hatası:", err);
        return res.status(500).json({
            success: false,
            message: 'İptal işlemi sırasında bir hata oluştu.'
        });
    }
};

const talebiKapat = async (req, res, next) => {
    const { talepId, isApproved, rating, comment, disputeReason } = req.body;
    const musteriId = req.userId;

    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        const kontrolSorgu = `
            SELECT r.status AS req_status, j.id AS job_id 
            FROM service_requests r
            JOIN jobs j ON r.id = j.request_id
            WHERE r.id = $1 AND r.customer_id = $2
            FOR UPDATE
        `;
        const kontrolSonuc = await client.query(kontrolSorgu, [talepId, musteriId]);

        if (kontrolSonuc.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ 
                success: false, 
                message: 'Talep bulunamadı veya bu işlemi yapmak için yetkiniz yok.' 
            });
        }

        const isData = kontrolSonuc.rows[0];

        if (isData.req_status !== 'awaiting_approval') {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                success: false, 
                message: 'Bu talep şu anda onay/itiraz aşamasında değil!' 
            });
        }

        const jobId = isData.job_id;

        if (isApproved) {
            await client.query(
                `UPDATE service_requests SET status = 'completed', updated_at = NOW() WHERE id = $1`, 
                [talepId]
            );
            
            await client.query(
                `UPDATE jobs SET status = 'completed', completed_at = NOW() WHERE id = $1`, 
                [jobId]
            );
            
            const insertApproval = `
                INSERT INTO approvals (job_id, customer_id, status, approved_at, rating, comment)
                VALUES ($1, $2, 'approved', NOW(), $3, $4)
            `;
            await client.query(insertApproval, [jobId, musteriId, rating, comment || null]);

        }
        else {
            await client.query(
                `UPDATE service_requests SET updated_at = NOW() WHERE id = $1`, 
                [talepId]
            );
            
            const insertApproval = `
                INSERT INTO approvals (job_id, customer_id, status, dispute_reason)
                VALUES ($1, $2, 'disputed', $3)
            `;
            await client.query(insertApproval, [jobId, musteriId, disputeReason]);
        }

        await client.query('COMMIT');

        return res.status(200).json({
            success: true,
            message: isApproved 
                ? 'Temizlik başarıyla onaylandı ve iş kapatıldı.' 
                : 'Temizlik reddedildi. İtirazınız incelemeye alındı.'
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Talebi Kapat Hatası:", err);
        return res.status(500).json({ 
            success: false, 
            message: 'İşlemi tamamlarken bir hata oluştu!' 
        });
    } finally {
        client.release();
    }
};

module.exports = {
    taleplerim,
    talepDetay,
    talepOlustur,
    talepIptal,
    talebiKapat
}