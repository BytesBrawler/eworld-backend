const mysql2 = require('mysql2');
const ApiError = require('../utils/apiError');

const errorHandler = (err, req, res, next) => {
    console.log(err);

    let error = err;
    let statusCode = 500;
    let message = "Something went wrong";
    const isMysqlError = err && err.constructor && err.constructor.name === 'SqlError';

    if (!(error instanceof ApiError)) {
        console.log("❗ Not an instance of ApiError");    
        statusCode = error.statusCode || (isMysqlError ? 400 : 500);
        message = error.message || message;
        error = new ApiError(statusCode, message, error?.errors || [], err.stack);
    }

    const response = {
        success: false,
        statusCode: error.statusCode,
        message: error.message,
        errors: error.errors,
        data: error.data,
        ...(process.env.NODE_ENV === "development" ? { stack: error.stack } : {}),
    };

    return res.status(error.statusCode).json(response);
};

module.exports = errorHandler;




// const mysql2 = require('mysql2');
// const ApiError = require('../utils/apiError');

// const errorHandler = (err, req, res, next) => {
//     console.log(err);

//     let error = err;
//     let statusCode = 500;
//     let message = "Something went wrong";

//     if (!(error instanceof ApiError)) {
//         console.log("❗ Not an instance of ApiError");    
//         statusCode = error.statusCode || (error?.code ? 400 : 500); // optional mysql2 logic
//         message = error.message || message;
//         error = new ApiError(statusCode, message, error?.errors || [], err.stack);
//     }

//     const response = {
//         success: false,
//         statusCode: error.statusCode,
//         message: error.message,
//         errors: error.errors,
//         data: error.data,
//         ...(process.env.NODE_ENV === "development" ? { stack: error.stack } : {}),
//     };

//     return res.status(error.statusCode).json(response);
// };

// module.exports = errorHandler;

// const errorHandler = (err, req, res, next) => {
//     console.log(err);
//     let error = err;
//     let statusCode = 500;
//     const message = "Something went wrong";
   
//     if(!error instanceof ApiError){
//         console.log("is part of api error");    
//         statusCode = error.statusCode || error instanceof mysql2.Error ? 400 : 500;
//         message = error.message || "Something went wrong";
//         error = new ApiError(statusCode, message ,error?.errors || [] , err.stack)
//     }

//     const response = {
//         ...error,
//         message: error.message,
//         ...process.env.NODE_ENV === "development" ? {stack: error.stack} : {},
//     }

//     return res.status(statusCode).json(response);
// }

// module.exports = errorHandler;