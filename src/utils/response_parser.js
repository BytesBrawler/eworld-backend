const xml2js = require("xml2js");

// Function to parse API responses
async function parseApiResponse(apiDetails, responseBody) {
    let parsedResponse;
    let status = "unknown";
    let extractedData = {};

    // Detect response type
    switch (apiDetails.response_format_type) {
        case "JSON{}":
            try {
                parsedResponse = JSON.parse(responseBody);
            } catch (error) {
                return { status: "error", message: "Invalid JSON Response" };
            }
            break;

        case "JSON[]":
            try {
                parsedResponse = JSON.parse(responseBody);
                if (!Array.isArray(parsedResponse)) {
                    return { status: "error", message: "Expected JSON Array, got Object" };
                }
                parsedResponse = parsedResponse[0] || {}; // Extract first object if it's an array
            } catch (error) {
                return { status: "error", message: "Invalid JSON Array Response" };
            }
            break;

        case "XML":
            try {
                parsedResponse = await xml2js.parseStringPromise(responseBody, { explicitArray: false });
            } catch (error) {
                return { status: "error", message: "Invalid XML Response" };
            }
            break;

        case "text":
            parsedResponse = responseBody;
            break;

        default:
            return { status: "error", message: "Unsupported Response Format" };
    }

    // Extract response values dynamically
    if (typeof parsedResponse === "object") {
        extractedData = {
            transactionId: parsedResponse[apiDetails.tid_filter] || "N/A",
            balance: parsedResponse[apiDetails.bal_filter] || "N/A",
            amount: parsedResponse[apiDetails.amt_filter] || "N/A",
            requestId: parsedResponse[apiDetails.reqId_filter] || "N/A"
        };
    } else if (typeof parsedResponse === "string") {
        // Handle text responses by searching for known keywords
        if (parsedResponse.includes(apiDetails.respone_keyword_1)) {
            status = "success";
        } else if (parsedResponse.includes(apiDetails.respone_keyword_2)) {
            status = "failed";
        }

        extractedData = {
            transactionId: extractBetween(parsedResponse, apiDetails.tid_filter),
            balance: extractBetween(parsedResponse, apiDetails.bal_filter),
            amount: extractBetween(parsedResponse, apiDetails.amt_filter),
            requestId: extractBetween(parsedResponse, apiDetails.reqId_filter)
        };
    }

    // Determine overall success or failure
    if (parsedResponse[apiDetails.response_filter] === apiDetails.response_success_format) {
        status = "success";
    } else if (parsedResponse[apiDetails.response_filter] === apiDetails.response_failure_format) {
        status = "failed";
    }

    return { status, ...extractedData };
}

// Helper function to extract data from text responses
function extractBetween(text, keyword) {
    if (!keyword || !text.includes(keyword)) return "N/A";
    const parts = text.split(keyword);
    return parts.length > 1 ? parts[1].split("|")[0].trim() : "N/A";
}

module.exports = { parseApiResponse };
