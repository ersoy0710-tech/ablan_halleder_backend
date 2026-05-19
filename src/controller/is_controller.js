const db = require("../db/db.js")

const { verifyAuthToken } = require("../common/jwt.js")

const isler = async (req, res, next) => {
    try {
        const userId = req.userId;

        const sorgu = `SELECT S.id, S.title, S.description, S.area_sqm, S.has_pets, (S.scheduled_start AT TIME ZONE 'Europe/Istanbul') scheduled_start, S.status
                       FROM service_requests S
                       WHERE S.customer_id = $1`;

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

module.exports = {
    isler
}