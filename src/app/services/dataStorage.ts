
/**
 * Service to handle online data storage (specifically for Google Sheets/Excel integration).
 *
 * To use this:
 * 1. Create a Google Sheet.
 * 2. Go to Extensions -> Apps Script.
 * 3. Paste the following code into the script editor:
 *
 * ```javascript
 * function doPost(e) {
 *   var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
 *   var data = JSON.parse(e.postData.contents);
 *   sheet.appendRow([
 *     new Date(),
 *     data.ssid,
 *     data.score,
 *     data.latency,
 *     data.signal,
 *     data.packetLoss,
 *     data.deviceId || 'Unknown'
 *   ]);
 *   return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
 * }
 * ```
 * 4. Click 'Deploy' -> 'New Deployment'. Select 'Web App'.
 * 5. Set 'Execute as' to 'Me' and 'Who has access' to 'Anyone'.
 * 6. Copy the Web App URL and paste it below in GOOGLE_SHEET_URL.
 */

// Replace this with your actual Google Apps Script Web App URL
const GOOGLE_SHEET_URL = '';

export interface NetworkLog {
  ssid: string;
  score: number;
  latency: number;
  signal: number;
  packetLoss: number;
  deviceId?: string;
}

export async function saveLogToOnlineExcel(log: NetworkLog): Promise<boolean> {
  if (!GOOGLE_SHEET_URL) {
    console.warn('Online storage URL not configured. Data not saved online.');
    return false;
  }

  try {
    const response = await fetch(GOOGLE_SHEET_URL, {
      method: 'POST',
      mode: 'no-cors', // Apps Script requires no-cors if not handling preflight
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(log),
    });

    // Note: with no-cors, we can't actually read the response body,
    // but the data will be sent to the script.
    return true;
  } catch (error) {
    console.error('Failed to save log online:', error);
    return false;
  }
}
