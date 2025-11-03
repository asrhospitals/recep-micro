const Router=require('express');
const { getCenterSample, acceptCenterSample, allSamples, sendTest, getAllNodalHospitals } = require('../controller/handleReception');
const router=Router();

//Get all Tests from a center
router.route('/get-center-sample').get(getCenterSample);

// Accept all samples from center
router.route('/accept-sample').put(acceptCenterSample);

// Get All Samples that are accepetd by the Reception
router.route('/get-all-samples/:hospitalid').get(allSamples);

// Send all samples to the Technician
router.route('/send-sample').put(sendTest);

// Get Nodal Hospitals By Nodal ID
router.route('/get-nodal-hospitals').get(getAllNodalHospitals);


module.exports=router;