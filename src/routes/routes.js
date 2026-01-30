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
  reverifyPatient,
  logBarcodePrint
} = require("../controllers/handleReception");
const {
  kpis,
  getOrderToCollectionTAT,
  getCollectionToDispatchTAT,
  getDispatchToReceiptTAT,
  backlog,
  avgCollectionTime,
  avgDispatchDelay,
  getMyPerformance,
  recollectionSummary,
  tubeWiseErrors,
  getBarcodeSummary,
  getTopReprintReasons,
  getStatSummary,
  getDelayedStatCases,
  getDispatchSummary,
  getDispatchThresholdInfo,
  getHourlyCollectionLoad,
  getRecollectionRateTrend,
  getDelayTrend,
  getFilterData,
  getKPIThresholdConfig,
} = require("../controllers/misHandle");
const router = Router();

// 1. Get all Tests from a center
router.route("/get-center-sample").get(getTestData);
// 2. Verify the Patient
router.route("/verify-patient/:pid").put(verifyPatient);
// 3. Re-verify the Patient (for pending collection)
router.route("/reverify-patient/:pid").put(reverifyPatient);
// 4. Get Verified Patient Test Data
router.route("/get-verified-patient").get(getVerifiedTestData);
// 5. Get test data by id
router.route("/get-test-data-byid/:pid").get(getTestDataById);
// 6. Update to Collect Test (Supports action: collect | collect_later)
router.route("/collect-test/:pid/tests/:testid").put(collectSample);
// 7. Pending Collection Page
router.route("/pending-collection").get(getPendingCollection);
// 8. Show collected sample
router.route("/show-collected-sample").get(showCollectedSample);
// 9. Send Sample to Nodal
router.route("/send-sample-nodal").put(sendToNodal);
// 9. Log Barcode Print
router.route("/log-barcode-print").post(logBarcodePrint);

// 8. MIS KPIs
router.route("/mis/kpis").get(kpis);
// 9. Order to Collection Time Based KPIs
router.route("/mis/tat/order-to-collection").get(getOrderToCollectionTAT);
// 10. Collection to Dispatch Time Based KPIs
router.route("/mis/tat/collection-to-dispatch").get(getCollectionToDispatchTAT);
// 11. Dispatch to Receipt Time Based KPIs
router.route("/mis/tat/dispatch-to-receipt").get(getDispatchToReceiptTAT);
// 12. Backlog
router.route("/mis/backlog").get(backlog);
// 13. Average Collection Time
router.route("/mis/avg-collection-time").get(avgCollectionTime);
// 14. Average Dispatch Delay
router.route("/mis/avg-dispatch-delay").get(avgDispatchDelay);
// 15. Phlebotomist Performance
router.route("/mis/phlebotomist-performance").get(getMyPerformance);
// 16. Recollection Summary
router.route("/mis/recollection-summary").get(recollectionSummary);
// 17. Tube Wise Errors
router.route("/mis/tube-wise-errors").get(tubeWiseErrors);

// 18. Barcode Summary
router.route("/mis/barcode-summary").get(getBarcodeSummary);
// 19. Top Reprint Reasons
router.route("/mis/top-reprint-reasons").get(getTopReprintReasons);
// 20. STAT Summary
router.route("/mis/stat-summary").get(getStatSummary);
// 21. Delayed STAT Cases List
router.route("/mis/delayed-stat-cases").get(getDelayedStatCases);
// 22. Dispatch Summary
router.route("/mis/dispatch-summary").get(getDispatchSummary);
// 23. Dispatch Threshold Info
router.route("/mis/dispatch-threshold-info").get(getDispatchThresholdInfo);
// 24. Hourly Collection Load
router.route("/mis/hourly-collection-load").get(getHourlyCollectionLoad);
// 25. Recollection Rate Trend
router.route("/mis/recollection-rate-trend").get(getRecollectionRateTrend);
// 26. Delay Trend
router.route("/mis/delay-trend").get(getDelayTrend);
// 27. Filter Data API
router.route("/mis/filter-data").get(getFilterData);
// 28. KPI Threshold Config
router.route("/mis/kpi-threshold-config").get(getKPIThresholdConfig);

module.exports = router;
