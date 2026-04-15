import XLSX from 'xlsx';
import { readFileSync, writeFileSync } from 'fs';

// This is a rough mapping because names might not match exactly
// In a real app, I'd use fuzzy matching or common IDs.
// I'll try to find common SKUs.

const workbook = XLSX.read(readFileSync('C:\\Users\\asado\\OneDrive\\Desktop\\Jazaa\\Rate Lists\\For Shopkeepers\\3U Rates rates for OB.xlsx'));
const sheet = workbook.Sheets["Main"];
const data = XLSX.utils.sheet_to_json(sheet);

// Mocking some Supabase data from my previous SELECT
const supabaseData = [
  {id: "acacia-honey-250gm", name: "Acacia Honey 250GM", rate: 724.57, rp: 950},
  {id: "dal-chana-200gm", name: "Dal Chana 200GM", rate: 180, rp: 200},
  {id: "dal-moong-200gm", name: "Dal Moong 200GM", rate: 198, rp: 220},
];

const results = data.map(row => {
    return {
        sku: row["__EMPTY"],
        ur_floor: row["__EMPTY_20"],
        it_floor: row["__EMPTY_27"],
        reg_floor: row["__EMPTY_34"]
    };
}).filter(r => r.sku && r.ur_floor);

console.log("Found " + results.length + " SKUs in Excel.");
console.log("Sample:", results.slice(0, 10));
