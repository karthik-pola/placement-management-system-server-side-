import { Alert } from "../models/alerts.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createAlert = asyncHandler(async (req,res) =>{
    const {message , createdBy} = req.body;

    const alert = await Alert.create ({
        message,
        createdBy
    });

    if(!alert){
        throw new ApiError(500 , "something went wrong while creating alert")
    }

    console.log(alert);

    return res
    .status(201)
    .json(200,alert , "alert creates successfully")
})


const getAlerts = asyncHandler(async (req,res) =>{
    const alerts = await Alert.find();
    if(!alerts.length){
        throw new ApiError(404 , "no alerts found");
    }
    return res
    .status(200)
    .json(new ApiResponse(200, alerts));
});


const deleteAlert = asyncHandler(async (req, res) => {
    const alert_id = req.params.alert_id;
    console.log(typeof alert_id);

    // Use await to execute the query and get the deleted resource
    const deletedAlert = await Alert.findByIdAndDelete(alert_id);

    // Check if the resource was found and deleted
    if (!deletedAlert) {
        return res.status(404).json(new ApiError(400, "Alert not found"));
    }

    // Send the deleted resource in the response
    res.status(200).json(new ApiResponse(200, deletedAlert));
});


export {
    createAlert,
    getAlerts,
    deleteAlert
}