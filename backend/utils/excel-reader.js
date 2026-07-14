const path = require('path');
const ExcelJS = require('exceljs');

function normalizeCellValue(value) {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) {
    const isoValue = value.toISOString();
    if (
      value.getUTCHours() ||
      value.getUTCMinutes() ||
      value.getUTCSeconds() ||
      value.getUTCMilliseconds()
    ) {
      return isoValue.slice(0, 19).replace('T', ' ');
    }
    return isoValue.slice(0, 10);
  }
  if (typeof value === 'object') {
    if (Object.prototype.hasOwnProperty.call(value, 'result')) {
      return normalizeCellValue(value.result);
    }
    if (Object.prototype.hasOwnProperty.call(value, 'text')) {
      return normalizeCellValue(value.text);
    }
    if (Array.isArray(value.richText)) {
      return value.richText.map(item => item.text || '').join('');
    }
    if (Object.prototype.hasOwnProperty.call(value, 'hyperlink')) {
      return normalizeCellValue(value.text || value.hyperlink);
    }
    return String(value);
  }
  return value;
}

function worksheetToRows(worksheet) {
  const rows = [];
  const columnCount = Math.max(worksheet.columnCount, 1);

  worksheet.eachRow({ includeEmpty: true }, row => {
    const values = [];
    for (let columnIndex = 1; columnIndex <= columnCount; columnIndex++) {
      values.push(normalizeCellValue(row.getCell(columnIndex).value));
    }
    rows.push(values);
  });

  return rows;
}

function rowsToObjects(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const headers = (rows[0] || []).map(item => String(item || '').trim());
  return rows.slice(1)
    .map(row => {
      const item = {};
      let hasValue = false;
      headers.forEach((header, index) => {
        if (!header) return;
        const value = row[index] ?? null;
        item[header] = value;
        if (value !== null && value !== '') {
          hasValue = true;
        }
      });
      return hasValue ? item : null;
    })
    .filter(Boolean);
}

async function loadWorkbookFromFile(filePath) {
  const workbook = new ExcelJS.Workbook();
  if (path.extname(filePath).toLowerCase() === '.csv') {
    await workbook.csv.readFile(filePath);
  } else {
    await workbook.xlsx.readFile(filePath);
  }
  return workbook;
}

async function loadWorkbookFromBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

function getFirstWorksheet(workbook) {
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Excel文件格式不正确，没有工作表');
  }
  return worksheet;
}

async function readFirstWorksheetRowsFromFile(filePath) {
  const workbook = await loadWorkbookFromFile(filePath);
  return worksheetToRows(getFirstWorksheet(workbook));
}

async function readFirstWorksheetRowsFromBuffer(buffer) {
  const workbook = await loadWorkbookFromBuffer(buffer);
  return worksheetToRows(getFirstWorksheet(workbook));
}

async function readFirstWorksheetObjects(filePath) {
  const rows = await readFirstWorksheetRowsFromFile(filePath);
  return rowsToObjects(rows);
}

async function readWorksheetObjectsFromFile(filePath) {
  const workbook = await loadWorkbookFromFile(filePath);
  return workbook.worksheets.map(worksheet => ({
    name: worksheet.name,
    rows: rowsToObjects(worksheetToRows(worksheet)),
  }));
}

module.exports = {
  readFirstWorksheetObjects,
  readFirstWorksheetRowsFromBuffer,
  readFirstWorksheetRowsFromFile,
  readWorksheetObjectsFromFile,
  rowsToObjects,
  worksheetToRows,
};
