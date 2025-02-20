function doGet(e) {
  if (e.parameter.action === "checkDuplicate") {
    const passportNumber = e.parameter.passportNumber;
    const isDuplicate = checkDuplicatePassport(passportNumber);
    return jsonResponse({ isDuplicate });
  }
  
  if (e.parameter.action === "searchCompanies") {
    const searchTerm = e.parameter.term;
    const searchResults = searchCompaniesOptimized(searchTerm);
    return jsonResponse(searchResults);
  }
  
  return handleResponse(e);
}

// Optimized search function with caching
let companyDataCache = null;
let lastCacheTime = null;
const CACHE_DURATION = 3600000; // 1 hour in milliseconds

function searchCompaniesOptimized(searchTerm) {
  // Check and refresh cache if needed
  if (!companyDataCache || !lastCacheTime || (Date.now() - lastCacheTime > CACHE_DURATION)) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("CompanyData");
    companyDataCache = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
    lastCacheTime = Date.now();
  }

  const searchTermLower = searchTerm.toLowerCase();
  return companyDataCache.filter(row => 
    row[0] && row[0].toString().toLowerCase().includes(searchTermLower)
  ).slice(0, 10); // Limit to 10 results for better performance
}

// Cache for passport numbers
let passportCache = null;
let passportCacheTime = null;

function checkDuplicatePassport(passportNumber) {
  // Refresh cache if needed
  if (!passportCache || !passportCacheTime || (Date.now() - passportCacheTime > CACHE_DURATION)) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet1");
    const lastRow = Math.max(sheet.getLastRow(), 1);
    
    if (lastRow <= 1) return false;
    
    passportCache = sheet.getRange(2, 14, lastRow - 1, 1)
      .getValues()
      .filter(row => row[0] !== "")
      .map(row => String(row[0]));
    passportCacheTime = Date.now();
  }

  return passportCache.includes(passportNumber);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function formatSriLankaDateTime() {
  const now = new Date();
  // Add 5 hours and 30 minutes for Sri Lanka time
  now.setHours(now.getHours() + 5);
  now.setMinutes(now.getMinutes() + 30);
  
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function formatDateTime() {
  // Get current time in UTC
  const now = new Date();
  
  // Convert to Sri Lanka time (UTC+5:30)
  const sriLankaTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  
  const year = sriLankaTime.getUTCFullYear();
  const month = String(sriLankaTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(sriLankaTime.getUTCDate()).padStart(2, '0');
  let hours = sriLankaTime.getUTCHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // Convert 0 to 12
  const minutes = String(sriLankaTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(sriLankaTime.getUTCSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
}

function handleResponse(e) {
  const sheetName = "Sheet1";
  const passportNumberColumn = 14; // Column N for Passport Number

  // Updated column order to match your sheet structure
  const columnOrder = [
    "timestamp",           // Column A - Timestamp
    "companySearch",       // Column B - Company Name
    "customerCode",        // Column C - Customer Code
    "town",               // Column D - Town
    "district",           // Column E - District
    "participantName",    // Column F - Participant Name
    "surname",            // Column G - Surname
    "otherNames",         // Column H - Other Names
    "gender",             // Column I - Gender
    "dateOfBirth",        // Column J - Date of Birth
    "age",                // Column K - Age
    "mobileNumber",       // Column L - Mobile Number
    "relationshipStatus", // Column M - Relationship Status
    "passportNumber",     // Column N - Passport Number
    "issueDate",          // Column O - Issue Date
    "expiryDate",         // Column P - Expiry Date
    "tshirtSize",         // Column Q - T-Shirt Size
    "mealPreference",     // Column R - Meal Preference
    "additionalParticipants" // Column S - Additional Participants
  ];

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  try {
    const formData = JSON.parse(e.parameter.data);
    const newPassportNumber = formData["passportNumber"];

    // Duplicate passport check
    const passportColumnValues = sheet.getRange(2, passportNumberColumn, sheet.getLastRow() - 1, 1).getValues();
    const allPassportNumbers = passportColumnValues.filter(value => value[0] !== "").map(value => String(value[0]));

    if (allPassportNumbers.includes(newPassportNumber)) {
      return ContentService
        .createTextOutput(JSON.stringify({
          "result": "error",
          "error": "This passport number is already registered (passportNumber)"
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Name validations
    const nameRegex = /^[A-Z\s]+$/;
    if (!formData.participantName || !nameRegex.test(formData.participantName)) {
      return ContentService.createTextOutput(JSON.stringify({
        "result": "error",
        "error": "Invalid characters in participant name (participantName)"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (!formData.surname || !nameRegex.test(formData.surname)) {
      return ContentService.createTextOutput(JSON.stringify({
        "result": "error",
        "error": "Invalid characters in surname (surname)"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (formData.otherNames && !nameRegex.test(formData.otherNames)) {
      return ContentService.createTextOutput(JSON.stringify({
        "result": "error",
        "error": "Invalid characters in other names (otherNames)"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Mobile Number Validation
    if (!formData.mobileNumber || !/^07[0-9]{8}$/.test(formData.mobileNumber)) {
      return ContentService.createTextOutput(JSON.stringify({
        "result": "error",
        "error": "Invalid mobile number format (07XXXXXXXX) (mobileNumber)"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Add current Sri Lanka timestamp
    const timestamp = formatDateTime();
    
    // Prepare row data with timestamp as first column
    const rowData = [timestamp];
    
    // Add the rest of the data following columnOrder (excluding timestamp)
    columnOrder.slice(1).forEach(field => {
      if (field === "age") {
        // Calculate age
        const dob = new Date(formData.dateOfBirth);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
          age--;
        }
        rowData.push(age);
      } else {
        rowData.push(formData[field] || "");
      }
    });

    sheet.appendRow(rowData);

    return ContentService
      .createTextOutput(JSON.stringify({
        "result": "success",
        "row": rowData,
        "submissionDateTime": timestamp
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        "result": "error",
        "error": error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Main data sheet
  const sheetName = "Sheet1";
  if (!ss.getSheetByName(sheetName)) {
    const mainSheet = ss.insertSheet(sheetName);
    
    // Add header row
    mainSheet.appendRow([
      "Timestamp",
      "Company Name",
      "Customer Code",
      "Town",
      "District",
      "Participant Name",
      "Surname",
      "Other Names",
      "Gender",
      "Date of Birth",
      "Age",
      "Mobile Number",
      "Relationship Status",
      "Passport Number",
      "Issue Date",
      "Expiry Date",
      "T-Shirt Size",
      "Meal Preference",
      "Additional Participants"
    ]);

    // Add a dummy row with minimal data to initialize the sheet
    mainSheet.appendRow([
      "INIT",  // Timestamp
      "",      // Company Name
      "",      // Customer Code
      "",      // Town
      "",      // District
      "",      // Participant Name
      "",      // Surname
      "",      // Other Names
      "",      // Gender
      "",      // Date of Birth
      "",      // Age
      "",      // Mobile Number
      "",      // Relationship Status
      "X0000000",  // Passport Number (dummy value)
      "",      // Issue Date
      "",      // Expiry Date
      "",      // T-Shirt Size
      "",      // Meal Preference
      ""       // Additional Participants
    ]);
  }
  
  // Company data sheet
  const companyDataSheetName = "CompanyData";
  if (!ss.getSheetByName(companyDataSheetName)) {
    const companySheet = ss.insertSheet(companyDataSheetName);
    companySheet.appendRow(["Company Name", "Customer Code", "Town", "District"]);
  }
}