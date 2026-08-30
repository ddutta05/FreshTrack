const express = require("express");
const {
  listRequests,
  createDonationRequest,
  getMyRequests,
  getRequestById,
  acceptRequest,
  rejectRequest,
  completeRequest
} = require("../controllers/request.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validation.middleware");
const { requestIdParamValidator, createRequestValidator, requestListValidator } = require("../validators/request.validator");

const router = express.Router();

router.use(requireAuth);
router.get("/", requestListValidator, validate, listRequests);
router.post("/", createRequestValidator, validate, createDonationRequest);
router.get("/mine", requestListValidator, validate, getMyRequests);
router.get("/:id", requestIdParamValidator, validate, getRequestById);

router.put("/:id/accept", requestIdParamValidator, validate, acceptRequest);
router.post("/:id/accept", requestIdParamValidator, validate, acceptRequest);
router.put("/:id/reject", requestIdParamValidator, validate, rejectRequest);
router.post("/:id/reject", requestIdParamValidator, validate, rejectRequest);
router.put("/:id/complete", requestIdParamValidator, validate, completeRequest);
router.post("/:id/complete", requestIdParamValidator, validate, completeRequest);

module.exports = router;
