const express = require("express");
const {
  getProfile,
  updateProfile,
  listUsers,
  getUserById,
  updateUser,
  disableUser,
  enableUser
} = require("../controllers/user.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");
const { validate } = require("../middleware/validation.middleware");
const { profileUpdateValidator, userListValidator, userIdParamValidator, adminUserUpdateValidator } = require("../validators/user.validator");
const { USER_ROLES } = require("../utils/constants");

const router = express.Router();

router.use(requireAuth);

router.get("/me", getProfile);
router.put("/me", profileUpdateValidator, validate, updateProfile);

router.get("/", requireRole(USER_ROLES.ADMIN), userListValidator, validate, listUsers);
router.get("/:id", requireRole(USER_ROLES.ADMIN), userIdParamValidator, validate, getUserById);
router.put("/:id", adminUserUpdateValidator, validate, updateUser);
router.put("/:id/disable", requireRole(USER_ROLES.ADMIN), userIdParamValidator, validate, disableUser);
router.post("/:id/disable", requireRole(USER_ROLES.ADMIN), userIdParamValidator, validate, disableUser);
router.put("/:id/enable", requireRole(USER_ROLES.ADMIN), userIdParamValidator, validate, enableUser);
router.post("/:id/enable", requireRole(USER_ROLES.ADMIN), userIdParamValidator, validate, enableUser);

module.exports = router;
