const XLSX = require('xlsx');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

/**
 * Read biller data from Excel or CSV file
 * @param {string} filePath - Path to the Excel/CSV file
 * @param {string} fileType - Type of file ('xlsx' or 'csv')
 * @returns {Promise<Array>} Array of biller objects with blr_id and blr_category_name
 */
const readBillerFile = async (filePath, fileType = 'xlsx') => {
    try {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        let billerData = [];

        if (fileType === 'xlsx' || fileType === 'xls') {
            // Read Excel file
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0]; // Use first sheet
            const worksheet = workbook.Sheets[sheetName];
            
            // Convert to JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            billerData = jsonData.map(row => ({
                blr_id: row.blr_id || row.BLR_ID || row['blr_id'] || '',
                blr_category_name: row.blr_category_name || row.BLR_CATEGORY_NAME || row['blr_category_name'] || ''
            }));

        } else if (fileType === 'csv') {
            // Read CSV file
            billerData = await new Promise((resolve, reject) => {
                const results = [];
                fs.createReadStream(filePath)
                    .pipe(csv())
                    .on('data', (row) => {
                        results.push({
                            blr_id: row.blr_id || row.BLR_ID || row['blr_id'] || '',
                            blr_category_name: row.blr_category_name || row.BLR_CATEGORY_NAME || row['blr_category_name'] || ''
                        });
                    })
                    .on('end', () => {
                        resolve(results);
                    })
                    .on('error', reject);
            });
        } else {
            throw new Error(`Unsupported file type: ${fileType}`);
        }

        // Filter out rows with empty biller IDs and exclude education category
        const filteredData = billerData.filter(biller => 
            biller.blr_id && 
            biller.blr_id.trim() !== '' && 
            biller.blr_category_name && 
            biller.blr_category_name.toLowerCase() !== 'education fees'
        );

        console.log(`Read ${filteredData.length} billers from ${filePath} (excluding education category)`);
        
        return filteredData;

    } catch (error) {
        console.error('Error reading biller file:', error);
        throw error;
    }
};

/**
 * Get biller IDs from file with pagination
 * @param {string} filePath - Path to the biller file
 * @param {number} start - Starting index for pagination
 * @param {number} limit - Number of records to return
 * @returns {Promise<Array>} Array of biller IDs
 */
const getBillerIdsFromFile = async (filePath, start = 0, limit = 2000) => {
    try {
        // Determine file type from extension
        const fileExtension = path.extname(filePath).toLowerCase();
        let fileType = 'xlsx';
        
        if (fileExtension === '.csv') {
            fileType = 'csv';
        } else if (fileExtension === '.xls') {
            fileType = 'xls';
        }

        // Read all biller data
        const allBillers = await readBillerFile(filePath, fileType);
        
        // Apply pagination
        const paginatedBillers = allBillers.slice(start, start + limit);
        
        // Extract just the biller IDs
        const billerIds = paginatedBillers.map(biller => biller.blr_id);
        
        console.log(`Returning ${billerIds.length} biller IDs (start: ${start}, limit: ${limit})`);
        
        return billerIds;

    } catch (error) {
        console.error('Error getting biller IDs from file:', error);
        throw error;
    }
};

/**
 * Get full biller data from file with category filtering
 * @param {string} filePath - Path to the biller file
 * @param {Array} excludeCategories - Categories to exclude (default: ['education'])
 * @returns {Promise<Array>} Array of biller objects
 */
const getBillerDataFromFile = async (filePath, excludeCategories = ['education']) => {
    try {
        // Determine file type from extension
        const fileExtension = path.extname(filePath).toLowerCase();
        let fileType = 'xlsx';
        
        if (fileExtension === '.csv') {
            fileType = 'csv';
        } else if (fileExtension === '.xls') {
            fileType = 'xls';
        }

        // Read all biller data
        const allBillers = await readBillerFile(filePath, fileType);
        
        // Filter out excluded categories (case-insensitive)
        const filteredBillers = allBillers.filter(biller => {
            const category = biller.blr_category_name.toLowerCase();
            return !excludeCategories.map(cat => cat.toLowerCase()).includes(category);
        });
        
        console.log(`Filtered billers: ${filteredBillers.length} (excluded categories: ${excludeCategories.join(', ')})`);
        
        return filteredBillers;

    } catch (error) {
        console.error('Error getting biller data from file:', error);
        throw error;
    }
};

/**
 * Validate biller file format
 * @param {string} filePath - Path to the biller file
 * @returns {Promise<Object>} Validation result with required columns check
 */
const validateBillerFile = async (filePath) => {
    try {
        if (!fs.existsSync(filePath)) {
            return {
                isValid: false,
                error: `File not found: ${filePath}`
            };
        }

        const fileExtension = path.extname(filePath).toLowerCase();
        let fileType = 'xlsx';
        
        if (fileExtension === '.csv') {
            fileType = 'csv';
        } else if (fileExtension === '.xls') {
            fileType = 'xls';
        } else if (fileExtension !== '.xlsx') {
            return {
                isValid: false,
                error: `Unsupported file type: ${fileExtension}. Supported: .xlsx, .xls, .csv`
            };
        }

        // Read first few rows to check format
        const sampleData = await readBillerFile(filePath, fileType);
        
        if (sampleData.length === 0) {
            return {
                isValid: false,
                error: 'File is empty or contains no valid data'
            };
        }

        // Check if required columns exist
        const firstRow = sampleData[0];
        const hasBlrId = firstRow.blr_id && firstRow.blr_id.trim() !== '';
        const hasCategory = firstRow.blr_category_name && firstRow.blr_category_name.trim() !== '';

        if (!hasBlrId) {
            return {
                isValid: false,
                error: 'Required column "blr_id" not found or empty'
            };
        }

        if (!hasCategory) {
            return {
                isValid: false,
                error: 'Required column "blr_category_name" not found or empty'
            };
        }

        return {
            isValid: true,
            totalRecords: sampleData.length,
            sampleData: sampleData.slice(0, 5), // Return first 5 records as sample
            message: 'File format is valid'
        };

    } catch (error) {
        return {
            isValid: false,
            error: error.message
        };
    }
};

module.exports = {
    readBillerFile,
    getBillerIdsFromFile,
    getBillerDataFromFile,
    validateBillerFile
};
