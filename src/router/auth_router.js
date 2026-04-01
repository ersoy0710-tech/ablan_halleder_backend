const router = require("express").Router();

const authController = require("../controller/auth_controller");
const { kayitOlValidationRules, validate, girisYapValidationRules } = require("../validation/validation");

router.post(
    "/kayit_ol",
    kayitOlValidationRules,
    validate,
    authController.kayitOl
);

router.post(
    "/giris_yap",
    girisYapValidationRules,
    validate,
    authController.girisYap
);

module.exports = router;