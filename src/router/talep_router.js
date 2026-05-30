const router = require("express").Router();

const talepController = require("../controller/talep_controller");
const { taleplerimValidationRules, talepDetayValidationRules, talepOlusturValidationRules, talepIptalValidationRules, talebiKapatValidationRules, validate } = require("../validation/validation");

const jwtMd = require("../middleware/jwt_md.js");

const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, "../uploads");
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

router.get(
    "/taleplerim",
    taleplerimValidationRules,
    validate,
    jwtMd.verifyAuthToken,
    talepController.taleplerim
);

router.get(
    "/talep_detay",
    talepDetayValidationRules,
    validate,
    jwtMd.verifyAuthToken,
    talepController.talepDetay
);

router.post(
    "/talep_olustur",
    upload.array("fotolar", 5),
    talepOlusturValidationRules,
    validate,
    jwtMd.verifyAuthToken,
    talepController.talepOlustur
);

router.post(
    "/talep_iptal",
    talepIptalValidationRules,
    validate,
    jwtMd.verifyAuthToken,
    talepController.talepIptal
);

router.post(
    "/talebi_kapat",
    talebiKapatValidationRules,
    validate,
    jwtMd.verifyAuthToken,
    talepController.talebiKapat
);

module.exports = router;