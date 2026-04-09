const db = require("../db/db.js")

const talepOlustur = async (req, res, next) => {
    const { musteriId, adresId, baslik, aciklama, alan, petVarMi, planlananTarih } = req.body;
    
    // dışarıdan rol admin bilgisi gelmez validationda engellendi
    try {
        const sorgu = `INSERT INTO service_requests (customer_id, address_id, title, description, area_sqm, has_pets, scheduled_start, status, created_at,updated_at) 
                       VALUES ($1, $2, $3, $4, $5, $6, ($7 AT TIME ZONE 'Europe/Istanbul'), $8, timezone('Europe/Istanbul', NOW()), timezone('Europe/Istanbul', NOW())) 
                       RETURNING *`;

        const degerler = [musteriId, adresId, baslik, aciklama, alan, petVarMi, planlananTarih, "draft"];
        const sonuc = await db.query(sorgu, degerler);

        if (sonuc.rows.length > 0) {
            return res.status(200).json({
                success: true,
                message: 'TALEP EKLENDİ.',
            });
        }
        else {
            throw new Error('Talep eklenemedi!');
        }
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
   talepOlustur,
    
}