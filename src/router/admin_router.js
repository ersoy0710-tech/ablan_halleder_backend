const router = require("express").Router();

const adminController = require("../controller/admin_controller")
const { adminGirisYapValidationRules, sikayetOnayValidationRules, validate } = require("../validation/validation");
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
    "/logout",
    adminController.logout
)

router.get(
    "/home",
    authSessionCheck,
    adminController.homeView
)

router.get(
    "/profile",
    authSessionCheck,
    adminController.profileView
)

router.post(
    "/profile/change-password",
    authSessionCheck,
    adminController.changePassword
)

router.get(
    "/users",
    authSessionCheck,
    adminController.usersView
)

router.get(
    "/user/:id",
    authSessionCheck,
    adminController.userDetailView
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
    "/request/:id",
    authSessionCheck,
    adminController.requestDetailView
)

router.post(
    "/request/:requestId/approve",
    authSessionCheck,
    adminController.approveRequest
)

router.post(
    "/request/:requestId/reject",
    authSessionCheck,
    adminController.rejectRequest
)

router.get(
    "/complaints",
    authSessionCheck,
    adminController.complaintsView
)

router.post(
    "/resolve-dispute",
    sikayetOnayValidationRules,
    validate,
    authSessionCheck,
    adminController.resolveDispute
)

module.exports = router;