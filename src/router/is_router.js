const router = require("express").Router();

const isController = require("../controller/is_controller.js");
const { islerValidationRules, aktifIsValidationRules, isiAlValidationRules, isiIptalEtValidationRules, temizligeBaslaValidationRules, temizligiBitirValidationRules, validate } = require("../validation/validation");

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
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });
router.get(
    "/isler",
    islerValidationRules,
    validate,
    jwtMd.verifyAuthToken,
    isController.isler
)

router.get(
    "/aktif_is",
    aktifIsValidationRules,
    validate,
    jwtMd.verifyAuthToken,
    isController.aktifIs
)

router.post(
    "/isi_al",
    isiAlValidationRules,
    validate,
    jwtMd.verifyAuthToken,
    isController.isiAl
)

router.post(
    "/isi_iptal_et",
    isiIptalEtValidationRules,
    validate,
    jwtMd.verifyAuthToken,
    isController.isiIptalEt
)

router.post(
    "/temizlige_basla",
    upload.array("before_photos", 10),
    temizligeBaslaValidationRules,
    validate,
    jwtMd.verifyAuthToken,
    isController.temizligeBasla
)

router.post(
    "/temizligi_bitir",
    upload.array("after_photos", 10),
    temizligiBitirValidationRules,
    validate,
    jwtMd.verifyAuthToken,
    isController.temizligiBitir
)

module.exports = router;