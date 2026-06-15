const router = require("express").Router();

const anaController = require("../controller/ana_controller");
const { anaValidationRules, temizlikciProfilValidationRules, validate } = require("../validation/validation");

const jwtMd = require("../middleware/jwt_md.js");

router.get(
    "/ana_sayfa",
    anaValidationRules,
    validate,
    jwtMd.verifyAuthToken,
    anaController.anaSayfa
);

router.post(
    "/temizlikci_profil",
    temizlikciProfilValidationRules,
    validate,
    jwtMd.verifyAuthToken,
    anaController.temizlikciProfil
);

module.exports = router;