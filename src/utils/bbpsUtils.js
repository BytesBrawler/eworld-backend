const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// MD5 hash function
function md5(data) {
    return crypto.createHash('md5').update(data).digest('hex');
}

// Encrypt function using AES-128-CBC
function encrypt(plainText, key) {
    try {
        const keyBuffer = Buffer.from(md5(key), 'hex');
        const initVector = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
        const cipher = crypto.createCipheriv('aes-128-cbc', keyBuffer, initVector);
        
        let encryptedText = cipher.update(plainText, 'utf-8', 'hex');
        encryptedText += cipher.final('hex');
        
        return encryptedText;
    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Encryption failed');
    }
}

// Decrypt function using AES-128-CBC
function decrypt(encryptedText, key) {
    try {
        const keyBuffer = Buffer.from(md5(key), 'hex');
        const initVector = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
        const decipher = crypto.createDecipheriv('aes-128-cbc', keyBuffer, initVector);
        
        let decryptedText = decipher.update(encryptedText, 'hex', 'utf-8');
        decryptedText += decipher.final('utf-8');
        
        return decryptedText;
    } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Decryption failed');
    }
}

// Generate random characters
function generateRandomChars(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Get Julian date (day of year)
function getJulianDate(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    const oneDay = 1000 * 60 * 60 * 24;
    const julianDate = Math.floor(diff / oneDay);
    return julianDate.toString().padStart(3, '0');
}
// Generate random string with optional length
function generateRandomString(length) {
    try {
        // Default length is 35 if not provided or invalid
        const strLength = (typeof length === 'number' && length > 0) ? length : 35;

        // Generate random characters of required length minus prefix length
        const prefix = 'EWORLD';
        const randomChars = generateRandomChars(strLength - prefix.length);

        return prefix + randomChars;
    } catch (error) {
        console.error('Error generating random string:', error);
        // Fallback to simple random string with prefix
        const prefix = 'EWORLD';
        return prefix + Math.random().toString(36).substr(2, (length ? length : 35) - prefix.length);
    }
}

// Generate PDF receipt
function generatePDF(data) {
    try {
        // Ensure receipts directory exists
        const receiptsDir = path.join(__dirname, '..', 'public', 'receipts');
        if (!fs.existsSync(receiptsDir)) {
            fs.mkdirSync(receiptsDir, { recursive: true });
        }

        const doc = new PDFDocument();
        const fileName = path.join(receiptsDir, `${data.roboRefrenceId}.pdf`);
        
        // Create write stream
        const stream = fs.createWriteStream(fileName);
        doc.pipe(stream);

        // Set font
        doc.font('Helvetica');

        // Add header
        doc.fontSize(24).text('BBPS Payment Receipt', { align: 'center' });
        doc.moveDown();

        // Add transaction details
        doc.fontSize(16).text('Transaction Details', { underline: true });
        doc.moveDown();
        doc.fontSize(12)
           .text(`Date: ${data.datetime ? new Date(data.datetime).toLocaleString() : new Date().toLocaleString()}`)
           .text(`BBPS Transaction ID: ${data.txnRefId || 'N/A'}`)
           .text(`Reference ID: ${data.roboRefrenceId || 'N/A'}`)
           .text(`Biller ID: ${data.biller_id || 'N/A'}`)
           .text(`Retailer Number: ${data.retailerNumber || 'N/A'}`)
           .text(`Customer Number: ${data.customerNumber || 'N/A'}`)
           .text(`Response Status: ${data.responseStatus || 'N/A'}`);
        doc.moveDown();

        // Add customer information
        doc.fontSize(16).text('Customer Information', { underline: true });
        doc.moveDown();
        doc.fontSize(12).text(`Customer Name: ${data.resCustomerName || 'N/A'}`);
        doc.moveDown();

        // Add bill details
        doc.fontSize(16).text('Bill Details', { underline: true });
        doc.moveDown();
        doc.fontSize(12)
           .text(`Biller Name: ${data.billerName || 'N/A'}`)
           .text(`Bill Type: ${data.billType || 'N/A'}`);
        doc.moveDown();

        // Add payment information
        doc.fontSize(16).text('Payment Information', { underline: true });
        doc.moveDown();
        const amount = data.respAmount ? (parseInt(data.respAmount) / 100).toFixed(2) : '0.00';
        doc.fontSize(12)
           .text(`Bill Amount: Rs. ${amount}`)
           .text(`Customer Convenience Fees: Rs. ${data.custConvFee || '0.00'}`);
        doc.moveDown();

        // Add footer
        doc.fontSize(10).text('Thank you for using BBPS services', { align: 'center' });
        doc.text('This is a computer-generated receipt', { align: 'center' });

        // Finalize the PDF
        doc.end();

        console.log(`PDF receipt generated: ${fileName}`);
        return fileName;
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw new Error('PDF generation failed');
    }
}

// Validate BBPS request data
function validateBBPSRequest(data, requiredFields) {
    const errors = [];
    
    requiredFields.forEach(field => {
        if (!data[field] || data[field].toString().trim() === '') {
            errors.push(`${field} is required`);
        }
    });
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

// Format amount for BBPS (convert to paisa)
function formatAmountForBBPS(amount) {
    return Math.round(parseFloat(amount) * 100);
}

// Format amount for display (convert from paisa)
function formatAmountForDisplay(amount) {
    return (parseInt(amount) / 100).toFixed(2);
}

// Generate transaction reference
function generateTxnRef() {
    return 'TXN' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
}

// Generate complaint ID
function generateComplaintId() {
    return 'CMP' + Date.now() + Math.random().toString(36).substr(2, 3).toUpperCase();
}

// Parse XML response to JSON
function parseXMLToJSON(xmlString) {
    const xml2js = require('xml2js');
    return new Promise((resolve, reject) => {
        xml2js.parseString(xmlString, { explicitArray: false }, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

// Log BBPS transaction
async function logBBPSTransaction(db, transactionData) {
    try {
        const query = `
            INSERT INTO bbps_transaction_logs 
            (reference_id, retailer_id, biller_id, customer_number, amount, request_data, 
             response_data, status, transaction_type, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;
        
        await db.execute(query, [
            transactionData.referenceId,
            transactionData.retailerId,
            transactionData.billerId,
            transactionData.customerNumber,
            transactionData.amount,
            JSON.stringify(transactionData.requestData),
            JSON.stringify(transactionData.responseData),
            transactionData.status,
            transactionData.transactionType
        ]);
        
        console.log('BBPS transaction logged successfully');
    } catch (error) {
        console.error('Error logging BBPS transaction:', error);
    }
}

module.exports = {
    encrypt,
    decrypt,
    generateRandomString,
    generatePDF,
    validateBBPSRequest,
    formatAmountForBBPS,
    formatAmountForDisplay,
    generateTxnRef,
    generateComplaintId,
    parseXMLToJSON,
    logBBPSTransaction,
    md5
};
