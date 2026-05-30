const db = require("../db/db.js")

const path = require('path');
const fsExtra = require('fs');

const { verifyAuthToken } = require("../common/jwt.js")


const isler = async (req, res, next) => {
    try {
        const sorgu = `SELECT S.id talep_id, S.title baslik, S.description aciklama, S.area_sqm alan, S.has_pets hayvan_var_mi, 
                        (S.scheduled_start AT TIME ZONE 'Europe/Istanbul') planlanan_tarih, (S.price)::INTEGER AS fiyat, C.name il, D.name ilce,
                        COALESCE(
                                json_agg(
                                    json_build_object(
                                        'foto_url', SP.url
                                    )
                                ) FILTER (WHERE SP.id IS NOT NULL), '[]'
                            ) AS talep_fotograflari
                        FROM service_requests S, service_request_photos SP, addresses A, cities C, districts D
                        WHERE S.status = 'published' AND S.id = SP.request_id AND S.address_id = A.id AND A.city_id = C.id AND A.district_id = D.id
                        GROUP BY 
                            S.id,
                            S.title,
                            S.description,
                            S.area_sqm,
                            S.has_pets,
                            S.scheduled_start,
                            S.price,
                            C.name,
                            D.name;`;

        const sonuc = await db.query(sorgu, []);

        return res.status(200).json({
            success: true,
            message: '',
            data: sonuc.rows
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

const aktifIs = async (req, res, next) => {
    try {
        const userId = req.userId;

        const sorgu = `SELECT 
                            J.id AS job_id,
                            S.id AS talep_id,
                            S.title AS baslik,
                            S.description AS musteri_notu,
                            S.area_sqm AS alan,
                            S.has_pets AS hayvan_var_mi,
                            COALESCE(APP.status::text, J.status::text) AS is_durumu,
                            J.cleaner_note AS temizlikci_notu,
                            (S.scheduled_start AT TIME ZONE 'Europe/Istanbul') AS planlanan_tarih,
                            C.name AS il,
                            D.name AS ilce,
                            A.address_line AS acik_adres,
                            U.full_name AS musteri_ad_soyad,
                            U.phone AS musteri_telefon,
                            APP.dispute_reason AS itiraz_sebebi,
                            (
                                SELECT COALESCE(
                                    json_agg(json_build_object('foto_url', P.url, 'foto_tip', P.type)), '[]'
                                )
                                FROM job_evidence_photos P
                                WHERE P.job_id = J.id
                            ) AS is_fotograflari
                        FROM jobs J
                        JOIN service_requests S ON J.request_id = S.id
                        JOIN addresses A ON S.address_id = A.id
                        JOIN cities C ON A.city_id = C.id
                        JOIN districts D ON A.district_id = D.id
                        JOIN users U ON S.customer_id = U.id
                        LEFT JOIN approvals APP ON APP.job_id = J.id
                        WHERE J.cleaner_id = $1
                        AND J.status IN ('assigned', 'in_progress', 'awaiting_approval');`;

        const degerler = [userId];
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

const isiAl = async (req, res, next) => {
    const { talepId } = req.body;

    const client = await db.pool.connect();

    try {
        const userId = req.userId;

        await client.query('BEGIN');

        const kontrolSorgusu = `SELECT status FROM service_requests WHERE id = $1 FOR UPDATE`;
        const kontrolSonuc = await client.query(kontrolSorgusu, [talepId]);

        if (kontrolSonuc.rows.length === 0 || kontrolSonuc.rows[0].status !== 'published') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: 'İş başka biri tarafından alındı veya bulunamadı!',
            });
        }

        const insertSorgu = `INSERT INTO jobs (request_id, cleaner_id, status, accepted_at)
                             VALUES ($1, $2, 'assigned', NOW())`;
        await client.query(insertSorgu, [talepId, userId]);

        const updateSorgu = `UPDATE service_requests SET status = 'assigned' WHERE id = $1`;
        await client.query(updateSorgu, [talepId]);

        await client.query('COMMIT');

        return res.status(200).json({
            success: true,
            message: 'İŞ ALINDI',
        });
    }
    catch (err) {
        await client.query('ROLLBACK');
        console.log(err);
        
        res.status(500).json({
            success: false,
            message: 'Hata oluştu!'
        });
    }
    finally {
        client.release();
    }
}

const isiIptalEt = async (req, res, next) => {
    const client = await db.pool.connect();

    try {
        const userId = req.userId;

        await client.query('BEGIN');

        const aktifIsSorgusu = `SELECT id, request_id FROM jobs WHERE cleaner_id = $1 AND status = 'assigned' FOR UPDATE`;
        const aktifIsSonuc = await client.query(aktifIsSorgusu, [userId]);

        if (aktifIsSonuc.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                message: 'Üzerinize atanmış, iptal edilebilir aktif bir iş bulunamadı!',
            });
        }

        const jobId = aktifIsSonuc.rows[0].id;
        const talepId = aktifIsSonuc.rows[0].request_id;

        const deleteSorgu = `DELETE FROM jobs WHERE id = $1`;
        await client.query(deleteSorgu, [jobId]);

        const updateSorgu = `UPDATE service_requests SET status = 'published' WHERE id = $1`;
        await client.query(updateSorgu, [talepId]);

        await client.query('COMMIT');

        return res.status(200).json({
            success: true,
            message: 'İŞ İPTAL EDİLDİ',
        });
    }
    catch (err) {
        await client.query('ROLLBACK');
        console.log(err);
        
        res.status(500).json({
            success: false,
            message: 'Hata oluştu!'
        });
    }
    finally {
        client.release();
    }
}

const temizligeBasla = async (req, res, next) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, message: 'Temizliğe başlamak için temizlik öncesi (before) fotoğrafları zorunludur!' });
    }

    const client = await db.pool.connect();

    try {
        const userId = req.userId;

        await client.query('BEGIN');

        const aktifIsSorgusu = `SELECT id, request_id FROM jobs WHERE cleaner_id = $1 AND status = 'assigned' FOR UPDATE`;
        const aktifIsSonuc = await client.query(aktifIsSorgusu, [userId]);

        if (aktifIsSonuc.rows.length === 0) {
            await client.query('ROLLBACK');
            
            for (const file of req.files) {
                if (fsExtra.existsSync(file.path)) fsExtra.unlinkSync(file.path);
            }
            
            return res.status(400).json({
                success: false,
                message: 'Süreci başlatılabilecek aktif bir işiniz bulunamadı!',
            });
        }

        const jobId = aktifIsSonuc.rows[0].id;
        const talepId = aktifIsSonuc.rows[0].request_id;

        // YENİ KLASÖR YAPISI: uploads/{talepId}/jobs/{jobId}/before
        const targetDir = path.join(__dirname, `../uploads/${talepId}/jobs/${jobId}/before`);
        if (!fsExtra.existsSync(targetDir)) {
            fsExtra.mkdirSync(targetDir, { recursive: true });
        }

        let sortOrder = 0;
        for (const file of req.files) {
            const uuidSorgu = `SELECT gen_random_uuid() AS yeni_id`;
            const uuidSonuc = await client.query(uuidSorgu);
            const photoId = uuidSonuc.rows[0].yeni_id;

            const extension = path.extname(file.originalname);
            const newFileName = `${photoId}${extension}`;
            const finalPath = path.join(targetDir, newFileName);

            // Geçici klasörden (../uploads) hedef klasöre taşıma
            fsExtra.renameSync(file.path, finalPath);

            // Veritabanına kaydedilecek relative URL
            const relativeUrl = `/uploads/${talepId}/jobs/${jobId}/before/${newFileName}`;

            const insertFotoSorgu = `
                INSERT INTO job_evidence_photos (id, job_id, type, url, sort_order)
                VALUES ($1, $2, 'before', $3, $4)
            `;
            await client.query(insertFotoSorgu, [photoId, jobId, relativeUrl, sortOrder]);
            sortOrder++;
        }

        const updateJobSorgu = `UPDATE jobs SET status = 'in_progress', started_at = NOW() WHERE id = $1`;
        await client.query(updateJobSorgu, [jobId]);

        const updateRequestSorgu = `UPDATE service_requests SET status = 'in_progress' WHERE id = $1`;
        await client.query(updateRequestSorgu, [talepId]);

        await client.query('COMMIT');

        return res.status(200).json({
            success: true,
            message: 'TEMİZLİK SÜRECİ BAŞLADI',
        });
    }
    catch (err) {
        await client.query('ROLLBACK');
        console.log(err);

        // Hata durumunda geçici (temp) dosyaları sil
        if (req.files) {
            for (const file of req.files) {
                if (fsExtra.existsSync(file.path)) fsExtra.unlinkSync(file.path);
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
};

const temizligiBitir = async (req, res, next) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ 
            success: false, 
            message: 'Temizliği bitirmek için temizlik sonras fotoğrafları zorunludur!' 
        });
    }

    const { temizlikciNotu } = req.body;
    const userId = req.userId;
    const client = await db.pool.connect();

    try {
        await client.query('BEGIN');

        const aktifIsSorgusu = `SELECT id, request_id FROM jobs WHERE cleaner_id = $1 AND status = 'in_progress' FOR UPDATE`;
        const aktifIsSonuc = await client.query(aktifIsSorgusu, [userId]);

        if (aktifIsSonuc.rows.length === 0) {
            await client.query('ROLLBACK');
            
            for (const file of req.files) {
                if (fsExtra.existsSync(file.path)) fsExtra.unlinkSync(file.path);
            }
            
            return res.status(400).json({
                success: false,
                message: 'Bitirilecek aktif bir işiniz bulunamadı!'
            });
        }

        const jobId = aktifIsSonuc.rows[0].id;
        const talepId = aktifIsSonuc.rows[0].request_id;

        const targetDir = path.join(__dirname, `../uploads/${talepId}/jobs/${jobId}/after`);
        if (!fsExtra.existsSync(targetDir)) {
            fsExtra.mkdirSync(targetDir, { recursive: true });
        }

        let sortOrder = 0;
        for (const file of req.files) {
            const uuidSorgu = `SELECT gen_random_uuid() AS yeni_id`;
            const uuidSonuc = await client.query(uuidSorgu);
            const photoId = uuidSonuc.rows[0].yeni_id;

            const extension = path.extname(file.originalname);
            const newFileName = `${photoId}${extension}`;
            const finalPath = path.join(targetDir, newFileName);

            fsExtra.renameSync(file.path, finalPath);

            const relativeUrl = `/uploads/${talepId}/jobs/${jobId}/after/${newFileName}`;

            const insertFotoSorgu = `
                INSERT INTO job_evidence_photos (id, job_id, type, url, sort_order, created_at)
                VALUES ($1, $2, 'after', $3, $4, NOW())
            `;
            await client.query(insertFotoSorgu, [photoId, jobId, relativeUrl, sortOrder]);
            sortOrder++;
        }

        const updateJobSorgu = `
            UPDATE jobs 
            SET status = 'awaiting_approval', submitted_at = NOW(), cleaner_note = $1 
            WHERE id = $2
        `;
        await client.query(updateJobSorgu, [temizlikciNotu || null, jobId]);

        const updateRequestSorgu = `UPDATE service_requests SET status = 'awaiting_approval' WHERE id = $1`;
        await client.query(updateRequestSorgu, [talepId]);

        await client.query('COMMIT');

        return res.status(200).json({
            success: true,
            message: 'TEMİZLİK BAŞARIYLA BİTİRİLDİ',
        });
    }
    catch (err) {
        await client.query('ROLLBACK');
        console.log("Temizliği Bitir Hatası:", err);

        if (req.files) {
            for (const file of req.files) {
                if (fsExtra.existsSync(file.path)) fsExtra.unlinkSync(file.path);
            }
        }

        return res.status(500).json({
            success: false,
            message: 'İşlemi tamamlarken bir hata oluştu!'
        });
    }
    finally {
        client.release();
    }
};

module.exports = {
    isler,
    aktifIs,
    isiAl,
    isiIptalEt,
    temizligeBasla,
    temizligiBitir
}