const db = require("../db/db.js")

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



module.exports = {
   adreslerim
}