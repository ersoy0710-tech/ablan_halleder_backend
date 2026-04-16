const router = require("express").Router();

const talepController = require("../controller/talep_controller");
const { taleplerimValidationRules, talepOlusturValidationRules, validate } = require("../validation/validation");

router.post(
    "/taleplerim",
    taleplerimValidationRules,
    validate,
    talepController.taleplerim
)

router.post(
    "/talep_olustur",
    talepOlusturValidationRules,
    validate,
    talepController.talepOlustur
);

module.exports = router;