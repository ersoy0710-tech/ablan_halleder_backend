const jwt = require("jsonwebtoken");

const fs = require("fs");
const path = require('path');

const privateKeyPath = path.join(__dirname, '..', 'key', 'private.pem');
const publicKeyPath = path.join(__dirname, '..', 'key', 'public.pem');

const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
const publicKey = fs.readFileSync(publicKeyPath, 'utf8');

const jwtExpires = process.env.JWT_EXPIRES;

function generateAuthToken(id) {
    try {
        const payload = { id };
        const signOptions = { expiresIn: jwtExpires, algorithm: 'RS256' };

        const authToken = jwt.sign(payload, privateKey, signOptions);
        return authToken;
    } catch (_) {
        return null;
    }
}

function verifyAuthToken(authToken) {
    try {
        const result = jwt.verify(authToken, publicKey, { algorithm: "RS256" });
        return result["id"];
    } catch (error) {
        console.error(`VERIFY JWT ERROR: \n${error}`);
        return null;
    }
}

module.exports = {
        generateAuthToken,
        verifyAuthToken
    }
    /* */