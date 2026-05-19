const router = require("express").Router();

const adresController = require("../controller/adres_controller");
const { adresEkleValidationRules, adreslerimValidationRules, adresSilValidationRules, validate } = require("../validation/validation");

const jwtMd = require("../middleware/jwt_md.js");

router.post(
    "/adres_ekle",
    adresEkleValidationRules,
    validate,
    jwtMd.verifyAuthToken,
    adresController.adresEkle
);

router.get(
    "/adreslerim",
    adreslerimValidationRules,
    validate,
    jwtMd.verifyAuthToken,
    adresController.adreslerim
);

router.delete(
    "/adres_sil",
    adresSilValidationRules,
    validate,
    jwtMd.verifyAuthToken,
    adresController.adresSil
);

router.post(
    "/iller",
    adresController.iller
)

router.post(
    "/ilceler",
    adresController.ilceler
)

module.exports = router;