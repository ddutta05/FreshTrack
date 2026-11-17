const express = require("express");
const {
  listOffers,
  getMyOffers,
  getReceivedOffers,
  getOfferById,
  createDonationOffer,
  acceptOffer,
  rejectOffer,
  completeOffer
} = require("../controllers/offer.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validation.middleware");
const { requestIdParamValidator } = require("../validators/request.validator");
const { structuredQuantityValidator } = require("../validators/quantity.validator");

const router = express.Router();

router.use(requireAuth);
router.get("/", listOffers);
router.get("/mine", getMyOffers);
router.get("/received", getReceivedOffers);
router.post("/", structuredQuantityValidator({ required: true }), validate, createDonationOffer);
router.get("/:id", requestIdParamValidator, validate, getOfferById);
router.put("/:id/accept", requestIdParamValidator, validate, acceptOffer);
router.post("/:id/accept", requestIdParamValidator, validate, acceptOffer);
router.put("/:id/reject", requestIdParamValidator, validate, rejectOffer);
router.post("/:id/reject", requestIdParamValidator, validate, rejectOffer);
router.put("/:id/complete", requestIdParamValidator, validate, completeOffer);
router.post("/:id/complete", requestIdParamValidator, validate, completeOffer);

module.exports = router;
