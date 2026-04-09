const router = require("express").Router();

const adresController = require("../controller/adres_controller");
const { adreslerimValidationRules, validate } = require("../validation/validation");

router.post(
    "/adreslerim",
    adreslerimValidationRules,
    validate,
    adresController.adreslerim
);

module.exports = router;