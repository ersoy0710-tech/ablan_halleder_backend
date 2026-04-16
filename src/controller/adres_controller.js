const db = require("../db/db.js")

const adresEkle = async (req, res, next) => {
    const { musteriId, baslik, adres, ilId, ilceId } = req.body;
    
    try {
        const sorgu = `INSERT INTO addresses (user_id, label, address_line, city_id, district_id, created_at)
                       VALUES ($1, $2, $3, $4, $5, NOW())
                       RETURNING *`;

        const degerler = [musteriId, baslik, adres, ilId, ilceId];
        const sonuc = await db.query(sorgu, degerler);

        if (sonuc.rows.length > 0) {
            return res.status(200).json({
                success: true,
                message: 'ADRES EKLENDİ.',
            });
        }
        else {
            throw new Error('Adres eklenemedi!');
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

const adreslerim = async (req, res, next) => {
    const { musteriId } = req.body;
    
    try {
        const sorgu = `SELECT * FROM addresses WHERE user_id = $1`;

        const degerler = [musteriId];
        const sonuc = await db.query(sorgu, degerler);

        const adresler = sonuc.rows.map(item => ({
            id: item.id,
            baslik: item.label,
            adres: item.address_line
        }));

        return res.status(200).json({
            success: true,
            message: '',
            data: adresler
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

const adresSil = async (req, res, next) => {
    const { musteriId, adresId } = req.body;
    
    try {
        const sorgu = `DELETE FROM addresses WHERE user_id = $1 AND id = $2
                       RETURNING *`;

        const degerler = [musteriId, adresId];
        const sonuc = await db.query(sorgu, degerler);

        if (sonuc.rows.length > 0) {
            return res.status(200).json({
                success: true,
                message: 'ADRES SİLİNDİ.',
            });
        }
        else {
            throw new Error('Adres silinemedi!');
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

const iller = async (req, res, next) => {
    try {
        const sorgu = `SELECT * FROM cities`;
        const sonuc = await db.query(sorgu);

        const iller = sonuc.rows.map(item => ({
            id: item.id,
            il: item.name
        }));

        return res.status(200).json({
            success: true,
            message: '',
            data: iller
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

const ilceler = async (req, res, next) => {
    const { ilId } = req.body;

    try {
        const sorgu = `SELECT id, name FROM districts WHERE city_id = $1`;
        const degerler = [ilId];
        const sonuc = await db.query(sorgu, degerler);

        const iller = sonuc.rows.map(item => ({
            id: item.id,
            ilce: item.name
        }));

        return res.status(200).json({
            success: true,
            message: '',
            data: iller
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
    adresEkle,
    adreslerim,
    adresSil,
    iller,
    ilceler
}