const router = require("express").Router();

const adresController = require("../controller/adres_controller");
const { adresEkleValidationRules, adreslerimValidationRules, adresSilValidationRules, validate } = require("../validation/validation");

router.post(
    "/adres_ekle",
    adresEkleValidationRules,
    validate,
    adresController.adresEkle
);

router.post(
    "/adreslerim",
    adreslerimValidationRules,
    validate,
    adresController.adreslerim
);

router.delete(
    "/adres_sil",
    adresSilValidationRules,
    validate,
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