const router = require("express").Router();

const authController = require("../controller/auth_controller");
const { kayitOlValidationRules, validate } = require("../validation/validation");

router.post(
    "/kayit_ol",
    kayitOlValidationRules,
    validate,
    authController.kayitOl
);

module.exports = router;