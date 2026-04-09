const router = require("express").Router();

const talepOlusturcontroller = require("../controller/talep_olustur_controller");
const { talepOlusturValidationRules, validate } = require("../validation/validation");

router.post(
    "/talep_olustur",
    talepOlusturValidationRules,
    validate,
    talepOlusturcontroller.talepOlustur
);



module.exports = router;