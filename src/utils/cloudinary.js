
// utils/cloudinary.js
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET 
});

const uploadToCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;
        
        // Upload file to cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
            folder: "recharge_app"
        });
        
        // File uploaded successfully
        fs.unlinkSync(localFilePath); // Remove local file
        return response;

    } catch (error) {
        fs.unlinkSync(localFilePath); // Remove local file even if upload failed
        return null;
    }
};

module.exports = { uploadToCloudinary };
