const jwt = require("../common/jwt.js")

const verifyAuthToken = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization']; 
        const token = authHeader && authHeader.split(' ')[1];
    
        if (!token) {
            throw new Error("");
        }

        const verifiedAuthToken = jwt.verifyAuthToken(token)
        if (verifiedAuthToken === null) {
            throw new Error("");
        }

        req.userId = verifiedAuthToken;
        next();
    }
    catch (_) {
        res.status(500).json({
            success: false,
            message: 'Hata oluştu!'
        });
    }
}

module.exports = {
    verifyAuthToken
}