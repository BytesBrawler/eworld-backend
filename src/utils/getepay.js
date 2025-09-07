const crypto = require('crypto');
const axios = require('axios');
const db = require('../db');

class Getepay {
    constructor() {
        this.defaultConfig = {
            iv: "LHPaBO5CtLWc8H2dtXaGgQ==",
            key: "gqd/0xqwKy2VX0BGMzwXnxL371ihOZU4trOWI9w13w0=",
            mid: "1232623",
            terminalId: "getepay.merchant130805@icici",
            url: "https://portal.getepay.in:8443/getepayPortal/pg/generateInvoice"
        };
    }

    /**
     * Load configuration from database
     * @returns {Promise<Object>} - Database configuration or default config
     */
    async loadConfig() {
        try {
            const result = await db.query(
                "SELECT * FROM getepay_config WHERE is_active = TRUE ORDER BY id DESC LIMIT 1"
            );
            
            if (result && result.length > 0) {
                const config = result[0];
                return {
                    mid: config.mid,
                    terminalId: config.terminal_id,
                    key: config.encryption_key,
                    iv: config.encryption_iv,
                    url: config.base_url
                };
            }
        } catch (error) {
            console.warn('Failed to load Getepay config from database, using default:', error.message);
        }
        
        return this.defaultConfig;
    }

    /**
     * Generate payment request
     * @param {Object} config - Getepay configuration
     * @param {Object} request - Payment request data
     * @returns {Promise<Object>} - Payment response
     */
    async generateRequest(config, request) {
        try {
            const requestWrapper = {
                mid: config.mid,
                terminalId: config.terminalId,
                req: this.encryptRequest(JSON.stringify(request), config)
            };

            const response = await axios.post(config.url, requestWrapper, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 30000
            });

            if (response.status === 200 && response.data) {
                const responseWrapper = response.data;
                if (responseWrapper && responseWrapper.response) {
                    const decryptedResponse = this.decryptRequest(responseWrapper.response, config);
                    return JSON.parse(decryptedResponse);
                } else {
                    return { error: "Invalid response format" };
                }
            } else {
                return { error: `HTTP Error: ${response.status} - ${response.statusText}` };
            }
        } catch (error) {
            console.error('Getepay generateRequest error:', error);
            if (error.message.includes('Invalid Config')) {
                return { error: "Invalid Config, Provided Key or IV is wrong" };
            }
            return { error: error.message || "Unable to generate request" };
        }
    }

    /**
     * Decrypt response from Getepay
     * @param {string} responseString - Encrypted response string
     * @param {Object} config - Getepay configuration
     * @returns {Object} - Decrypted response
     */
    getepayResponse(config, responseString) {
        try {
            const decryptedString = this.decryptRequest(responseString, config);
            console.log('Decrypted response:', decryptedString);
            return JSON.parse(decryptedString);
        } catch (error) {
            console.error('Error decrypting response:', error);
            throw error;
        }
    }

    /**
     * Requery transaction status
     * @param {Object} config - Getepay configuration
     * @param {Object} request - Requery request data
     * @returns {Promise<Object>} - Requery response
     */
    async requeryRequest(config, request) {
        try {
            const requestWrapper = {
                mid: config.mid,
                terminalId: config.terminalId,
                req: this.encryptRequest(JSON.stringify(request), config)
            };

            const response = await axios.post(config.url, requestWrapper, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 30000
            });

            if (response.status === 200 && response.data) {
                const responseWrapper = response.data;
                if (responseWrapper && responseWrapper.response) {
                    const decryptedResponse = this.decryptRequest(responseWrapper.response, config);
                    return JSON.parse(decryptedResponse);
                }
            }
            return null;
        } catch (error) {
            console.error('Getepay requeryRequest error:', error);
            return null;
        }
    }

    /**
     * Refund transaction
     * @param {Object} config - Getepay configuration
     * @param {Object} request - Refund request data
     * @returns {Promise<Object>} - Refund response
     */
    async refundRequest(config, request) {
        try {
            const requestWrapper = {
                mid: config.mid,
                terminalId: config.terminalId,
                req: this.encryptRequest(JSON.stringify(request), config)
            };

            const response = await axios.post(config.url, requestWrapper, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 30000
            });

            if (response.status === 200 && response.data) {
                const responseWrapper = response.data;
                if (responseWrapper && responseWrapper.response) {
                    const decryptedResponse = this.decryptRequest(responseWrapper.response, config);
                    return JSON.parse(decryptedResponse);
                }
            }
            return null;
        } catch (error) {
            console.error('Getepay refundRequest error:', error);
            return null;
        }
    }

    /**
     * Decrypt request string
     * @param {string} requestString - Encrypted request string (hex)
     * @param {Object} config - Getepay configuration
     * @returns {string} - Decrypted string
     */
    decryptRequest(requestString, config) {
        try {
            const key = Buffer.from(config.key, 'base64');
            const iv = Buffer.from(config.iv, 'base64');
            const encryptedData = this.stringToByteArray(requestString);
            
            return this.aesDecrypt(encryptedData, key, iv);
        } catch (error) {
            console.error('Error in decryptRequest:', error);
            throw error;
        }
    }

    /**
     * Encrypt request string
     * @param {string} requestString - Plain text request
     * @param {Object} config - Getepay configuration
     * @returns {string} - Encrypted hex string
     */
    encryptRequest(requestString, config) {
        try {
            const key = Buffer.from(config.key, 'base64');
            const iv = Buffer.from(config.iv, 'base64');
            const encryptedData = this.aesEncrypt(Buffer.from(requestString, 'utf8'), key, iv);
            
            console.log('enc-1->', encryptedData.length);
            return this.byteArrayToString(encryptedData);
        } catch (error) {
            console.error('Error in encryptRequest:', error);
            throw error;
        }
    }

    /**
     * AES encryption
     * @param {Buffer} data - Data to encrypt
     * @param {Buffer} key - Encryption key
     * @param {Buffer} iv - Initialization vector
     * @returns {Buffer} - Encrypted data
     */
    aesEncrypt(data, key, iv) {
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(data);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return encrypted;
    }

    /**
     * AES decryption
     * @param {Buffer} encryptedData - Data to decrypt
     * @param {Buffer} key - Decryption key
     * @param {Buffer} iv - Initialization vector
     * @returns {string} - Decrypted string
     */
    aesDecrypt(encryptedData, key, iv) {
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedData);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString('utf8');
    }

    /**
     * Convert byte array to hex string
     * @param {Buffer} byteArray - Byte array to convert
     * @returns {string} - Hex string
     */
    byteArrayToString(byteArray) {
        return byteArray.toString('hex').toUpperCase();
    }

    /**
     * Convert hex string to byte array
     * @param {string} hex - Hex string to convert
     * @returns {Buffer} - Byte array
     */
    stringToByteArray(hex) {
        return Buffer.from(hex, 'hex');
    }

    /**
     * Create payment request object
     * @param {Object} params - Payment parameters
     * @returns {Object} - Formatted payment request
     */
    createPaymentRequest(params) {
        const {
            mid,
            terminalId,
            amount,
            merchantTransactionId,
            mobileNo,
            emailId,
            companyName,
            callbackUrl
        } = params;

        return {
            mid: mid,
            amount: `${amount}.00`,
            merchantTransactionId: merchantTransactionId,
            transactionDate: new Date().toISOString(),
            terminalId: terminalId,
            udf1: mobileNo || "",
            udf2: emailId || "",
            udf3: companyName || "",
            udf4: "",
            udf5: "",
            udf6: "",
            udf7: "",
            udf8: "",
            udf9: "",
            udf10: "",
            ru: "",
            callbackUrl: callbackUrl,
            currency: "INR",
            paymentMode: "UPI",
            bankId: "",
            txnType: "",
            productType: "",
            txnNote: `${mobileNo}_${merchantTransactionId}`,
            vpa: ""
        };
    }

    /**
     * Get default configuration
     * @returns {Object} - Default Getepay configuration
     */
    getDefaultConfig() {
        return { ...this.defaultConfig };
    }

    /**
     * Get active configuration (from database or default)
     * @returns {Promise<Object>} - Active Getepay configuration
     */
    async getConfig() {
        return await this.loadConfig();
    }
}

module.exports = new Getepay();
