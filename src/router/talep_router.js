const router = require("express").Router();

const talepController = require("../controller/talep_controller");
const { taleplerimValidationRules, talepOlusturValidationRules, validate } = require("../validation/validation");

const jwtMd = require("../middleware/jwt_md.js");

router.get(
    "/taleplerim",
    taleplerimValidationRules,
    validate,
    jwtMd.verifyAuthToken,
    talepController.taleplerim
)

router.post(
    "/talep_olustur",
    talepOlusturValidationRules,
    validate,
    jwtMd.verifyAuthToken,
    talepController.talepOlustur
);

module.exports = router;