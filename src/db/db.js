const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: 'ablanhalleder',
    password: process.env.DB_PASSWORD,
    port: 5432,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
    console.error('Beklenmedik veritabanı hatası!', err);
    process.exit(-1);
});

const testConnection = async() => {
    try {
        const client = await pool.connect();
        console.log('Veritabanına bağlandı.');
        client.release();
    } catch (err) {
        console.error('Veritabanına bağlanılamadı!', err.message);
        process.exit(-1);
    }
};

module.exports = {
    query: (text, params) => pool.query(text, params),
    testConnection
};