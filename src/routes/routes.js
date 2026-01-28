const Router = require("express");
const {
  getTestData,
  getTestDataById,
  collectSample,
  getPendingCollection,
  showCollectedSample,
  verifyPatient,
  getVerifiedTestData,
  sendToNodal,
} = require("../controllers/handleReception");
const router = Router();


// 1. Get all Tests from a center
router.route("/get-center-sample").get(getTestData);
// 2. Verify the Patient
router.route("/verify-patient/:pid").put(verifyPatient);
// 3. Get Verified Patient Test Data
router.route("/get-verified-patient").get(getVerifiedTestData);
// 4. Get test data by id
router.route("/get-test-data-byid/:pid").get(getTestDataById);
// 5. Update to Collect Test (Supports action: collect | collect_later)
router.route("/collect-test/:pid/tests/:testid").put(collectSample);
// 6. Pending Collection Page
router.route("/pending-collection").get(getPendingCollection);
// 7. Show collected sample
router.route("/show-collected-sample").get(showCollectedSample);
// 8. Send Sample to Nodal
router.route("/send-sample-nodal").put(sendToNodal);



module.exports = router;
