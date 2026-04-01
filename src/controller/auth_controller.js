const db = require("../db/db.js")

const kayitOl = async (req, res, next) => {
    const { rol, adSoyad, email, telefon, sifre } = req.body;
    
    // dışarıdan rol admin bilgisi gelmez validationda engellendi
    try {
        const sorgu = `INSERT INTO users (role, full_name, email, phone, password, status, created_at, updated_at) 
                       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) 
                       RETURNING *`;

        const degerler = [rol, adSoyad, email, telefon, sifre, 'active'];
        const sonuc = await db.query(sorgu, degerler);

        if (sonuc.rows.length > 0) {
            return res.status(200).json({
                success: true,
                message: 'Kullanıcı başarıyla oluşturuldu.',
                data: {
                    "id": sonuc.rows[0]["id"],
                    "rol": sonuc.rows[0]["role"],
                    "adSoyad": sonuc.rows[0]["full_name"],
                    "email": sonuc.rows[0]["email"],
                    "phone": sonuc.rows[0]["phone"]
                }
            });
        }
        else {
            throw new Error('Kayıt yapılamadı!');
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

const girisYap = async (req, res, next) => {
    const { email, sifre } = req.body;
    
    try {
        const sorgu = `SELECT id, role, full_name, email, phone 
                       FROM users 
                       WHERE email = $1 AND password = $2 AND status = 'active'`;

        const degerler = [email, sifre];
        const sonuc = await db.query(sorgu, degerler);

        if (sonuc.rows.length > 0) {
            return res.status(200).json({
                success: true,
                message: '',
                data: {
                    "id": sonuc.rows[0]["id"],
                    "rol": sonuc.rows[0]["role"],
                    "adSoyad": sonuc.rows[0]["full_name"],
                    "email": sonuc.rows[0]["email"],
                    "phone": sonuc.rows[0]["phone"]
                }
            });
        }
        else {
            throw new Error('Kayıt bulunamadı!');
        }
    }
    catch (err) {
        res.status(500).json({
            success: false,
            message: 'Kayıt bulunamadı!'
        });
    }
}

module.exports = {
    kayitOl,
    girisYap
}