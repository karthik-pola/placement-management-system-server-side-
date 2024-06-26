import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import { Admin } from "../models/admin.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";


const generateAccessAndRefereshTokens = async(adminId) =>{
    try {
        const admin = await Admin.findById(adminId)
        const accessToken = admin.generateAccessToken()
        const refreshToken = admin.generateRefreshToken()

        admin.refreshToken = refreshToken
        await admin.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}


    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}

const registerAdmin = asyncHandler( async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res


    const {fullName, email, username, password ,employId,gender} = req.body
    //console.log("email: ", email);

    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    const existedAdmin = await Admin.findOne({
        $or: [{ username }, { email }]
    })

    if (existedAdmin) {
        throw new ApiError(409, "User with email or username already exists")
    }
    //console.log(req.files);

    const avatarLocalPath = req.files?.avatar[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }
    

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }
   

    const admin = await Admin.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase(),
        employId,
        gender
    })

    const createdAdmin = await Admin.findById(admin._id).select(
        "-password -refreshToken"
    )
        
    if (!createdAdmin) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdAdmin, "User registered Successfully")
    )

} )

const loginAdmin = asyncHandler(async (req, res) =>{
    // req body -> data
    // username or email
    //find the user
    //password check
    //access and referesh token
    //send cookie

    const {email, username, password} = req.body
    console.log(email);

    if (!username && !email) {
        throw new ApiError(400, "username or email is required")
    }
    
    // Here is an alternative of above code based on logic discussed in video:
    // if (!(username || email)) {
    //     throw new ApiError(400, "username or email is required")
        
    // }

    const admin = await Admin.findOne({
        $or: [{username}, {email}]
    })

    if (!admin) {
        throw new ApiError(404, "User does not exist")
    }

   const isPasswordValid = await admin.isPasswordCorrect(password)

   if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials")
    }

   const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(admin._id)

    const loggedInAdmin = await Admin.findById(admin._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: loggedInAdmin, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )

})


const logoutAdmin = asyncHandler(async(req, res) => {
    await Admin.findByIdAndUpdate(
        req.user?._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const admin = await Admin.findById(decodedToken?._id)
    
        if (!admin) {
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if (incomingRefreshToken !== admin?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
            
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefereshTokens(admin._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200, 
                {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }

})


const changeCurrentPassword = asyncHandler(async(req, res) => {
    const {oldPassword, newPassword} = req.body

    

    const admin = await Admin.findById(req.admin?._id)
    const isPasswordCorrect = await admin.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password")
    }

    admin.password = newPassword
    await admin.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))
})


const getCurrentAdmin = asyncHandler(async(req, res) => {

    console.log("retails");
    return res
    .status(200)
    .json(new ApiResponse(
        200,
        req.user,
        "User fetched successfully"
    ))
})

const updateAccountDetails = asyncHandler(async(req, res) => {
    const {department ,username, email , gender , phoneNumber , employId} = req.body

    // if (!fullName || !email) {
    //     throw new ApiError(400, "All fields are required")
    // }

    console.log("sa dnd f" ,department, email)

    const admin = await Admin.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                department : department || req.user.department,
                email : email || req.user.email,
                gender : gender || req.user.gender,
                employId : employId || req.user.EmployId,
                phoneNumber : phoneNumber || req.user.phoneNumber,
                // placed : placed || req.user.placed,
                // personalEmail : personalEmail || req.user.personalEmail,
                // course : course || req.user.course,
                // address : address || req.user.address,
                username : username || req.user.username,
            }
        },
        {new: true}
        
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, admin, "Account details updated successfully"))
});

const updateAdminAvatar = asyncHandler(async(req, res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }

    //TODO: delete old image - assignment

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar")
        
    }

    const admin = await Admin.findByIdAndUpdate(
        req.admin?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, admin, "Avatar image updated successfully")
    )
})

const updateAdminCoverImage = asyncHandler(async(req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file is missing")
    }



    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading on avatar")
        
    }

    const admin = await Admin.findByIdAndUpdate(
        req.admin?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, admin, "Cover image updated successfully")
    )
})


const getAdminDetails = asyncHandler(async(req,res)=>{
    // console.log("hiii");
    const data = await Admin.find();
    return res.status(200).json(data)
})


const deleteAdmin = asyncHandler(async(req,res) => {
    const admin_id = req.params.admin_id;
    const deletedUser = await Admin.findByIdAndDelete(admin_id);
    if(!deletedUser){
        return res.status(404).json(new ApiError(400,"admin not found"));
    }

    res.status(200).json(new ApiResponse(200,deletedUser));
});




export {
    registerAdmin,
    loginAdmin,
    logoutAdmin,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentAdmin,
    updateAccountDetails,
    updateAdminAvatar,
    updateAdminCoverImage,
    getAdminDetails,
    deleteAdmin
}