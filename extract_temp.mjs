import XLSX from 'xlsx';
import { readFileSync, writeFileSync } from 'fs';

try {
    const workbook = XLSX.read(readFileSync('C:\\Users\\asado\\OneDrive\\Desktop\\Jazaa\\Rate Lists\\For Shopkeepers\\3U Rates rates for OB.xlsx'));
    const results = {};
    
    workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        results[sheetName] = XLSX.utils.sheet_to_json(worksheet);
    });
    
    writeFileSync('extracted_rates.json', JSON.stringify(results, null, 2));
    console.log("Successfully extracted data to extracted_rates.json");
} catch (err) {
    console.error("Extraction failed:", err);
}
