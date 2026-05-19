const router = require("express").Router();

const adminController = require("../controller/admin_controller")
const { adminGirisYapValidationRules, validate } = require("../validation/validation");
const authSessionCheck = require("../middleware/auth_session_md");


router.get(
    "/login",
    adminController.loginView
)

router.post(
    "/login",
    adminGirisYapValidationRules,
    validate,
    adminController.login
)

router.get(
    "/home",
    authSessionCheck,
    adminController.homeView
)

router.get(
    "/users",
    authSessionCheck,
    adminController.usersView
)

router.post(
    "/users/:id/toggle-status",
    authSessionCheck,
    adminController.toggleUserStatus
)

router.get(
    "/requests",
    authSessionCheck,
    adminController.requestsView
)

router.get(
    "/requests/:id",
    authSessionCheck,
    adminController.requestDetailView
)

module.exports = router;