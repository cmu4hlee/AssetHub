class AssetCreateValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AssetCreateValidationError';
  }
}

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_REGEX = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/;

const normalizeOptionalString = value => {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized || null;
};

const normalizeRequiredString = (value, message) => {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    throw new AssetCreateValidationError(message);
  }
  return normalized;
};

const isValidDateOnly = value => {
  const match = String(value).match(DATE_ONLY_REGEX);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
};

const isValidDateTime = value => {
  const match = String(value).match(DATE_TIME_REGEX);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second
  );
};

const normalizeRequiredPositiveInteger = (value, message) => {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    throw new AssetCreateValidationError(message);
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AssetCreateValidationError(message);
  }

  return parsed;
};

const normalizeOptionalPositiveInteger = (value, message) => {
  const normalized = normalizeOptionalString(value);
  if (normalized === null) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AssetCreateValidationError(message);
  }

  return parsed;
};

const normalizeOptionalNonNegativeNumber = (value, message, { integer = false } = {}) => {
  const normalized = normalizeOptionalString(value);
  if (normalized === null) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new AssetCreateValidationError(message);
  }
  if (parsed < 0) {
    throw new AssetCreateValidationError(message);
  }
  if (integer && !Number.isInteger(parsed)) {
    throw new AssetCreateValidationError(message);
  }

  return parsed;
};

const normalizeOptionalDateOnly = (value, message) => {
  const normalized = normalizeOptionalString(value);
  if (normalized === null) {
    return null;
  }
  if (!isValidDateOnly(normalized)) {
    throw new AssetCreateValidationError(message);
  }
  return normalized;
};

const normalizeOptionalDateTime = (value, message) => {
  const normalized = normalizeOptionalString(value);
  if (normalized === null) {
    return null;
  }

  if (isValidDateOnly(normalized)) {
    return `${normalized} 00:00:00`;
  }

  const dateTimeValue = normalized.replace('T', ' ');
  if (!isValidDateTime(dateTimeValue)) {
    throw new AssetCreateValidationError(message);
  }

  return dateTimeValue;
};

const compareDateOnly = value => new Date(`${value}T00:00:00.000Z`).getTime();

const normalizeAssetCreatePayload = payload => {
  const rawPayload = payload || {};

  const normalized = {
    asset_code: normalizeRequiredString(rawPayload.asset_code, '资产编号不能为空'),
    code: normalizeOptionalString(rawPayload.code),
    code2: normalizeOptionalString(rawPayload.code2),
    code3: normalizeOptionalString(rawPayload.code3),
    asset_name: normalizeRequiredString(rawPayload.asset_name, '资产名称不能为空'),
    category_id: normalizeRequiredPositiveInteger(rawPayload.category_id, '资产分类不能为空'),
    category_secondary_id: normalizeOptionalPositiveInteger(
      rawPayload.category_secondary_id,
      '二级分类格式无效',
    ),
    brand: normalizeOptionalString(rawPayload.brand),
    model: normalizeOptionalString(rawPayload.model),
    serial_number: normalizeOptionalString(rawPayload.serial_number),
    specification: normalizeOptionalString(rawPayload.specification),
    storage_location: normalizeOptionalString(rawPayload.storage_location),
    purchase_date: normalizeOptionalDateOnly(rawPayload.purchase_date, '购置日期格式无效'),
    purchase_price: normalizeOptionalNonNegativeNumber(
      rawPayload.purchase_price,
      '购置价格必须是大于等于0的数字',
    ),
    current_value: normalizeOptionalNonNegativeNumber(
      rawPayload.current_value,
      '当前价值必须是大于等于0的数字',
    ),
    depreciation_method: normalizeOptionalString(rawPayload.depreciation_method),
    depreciation_years: normalizeOptionalNonNegativeNumber(
      rawPayload.depreciation_years,
      '折旧年限必须是大于等于0的整数',
      { integer: true },
    ),
    location: normalizeOptionalString(rawPayload.location),
    department: normalizeOptionalString(rawPayload.department),
    department_new: normalizeOptionalString(rawPayload.department_new),
    unit: normalizeOptionalString(rawPayload.unit),
    responsible_person: normalizeOptionalString(rawPayload.responsible_person),
    status: normalizeOptionalString(rawPayload.status),
    supplier: normalizeOptionalString(rawPayload.supplier),
    data_id: normalizeOptionalString(rawPayload.data_id),
    original_created_at: normalizeOptionalDateTime(
      rawPayload.original_created_at,
      '原始创建时间格式无效',
    ),
    warranty_period: normalizeOptionalNonNegativeNumber(
      rawPayload.warranty_period,
      '保修期必须是大于等于0的整数',
      { integer: true },
    ),
    warranty_end_date: normalizeOptionalDateOnly(rawPayload.warranty_end_date, '保修到期日格式无效'),
    remark: normalizeOptionalString(rawPayload.remark),
    created_by: normalizeOptionalString(rawPayload.created_by),
    license_plate: normalizeOptionalString(rawPayload.license_plate),
    vehicle_type: normalizeOptionalString(rawPayload.vehicle_type),
    engine_number: normalizeOptionalString(rawPayload.engine_number),
    vin_number: normalizeOptionalString(rawPayload.vin_number),
    property_certificate: normalizeOptionalString(rawPayload.property_certificate),
    property_address: normalizeOptionalString(rawPayload.property_address),
    land_area: normalizeOptionalNonNegativeNumber(
      rawPayload.land_area,
      '土地面积必须是大于等于0的数字',
    ),
    building_area: normalizeOptionalNonNegativeNumber(
      rawPayload.building_area,
      '建筑面积必须是大于等于0的数字',
    ),
    land_use_right: normalizeOptionalString(rawPayload.land_use_right),
    building_structure: normalizeOptionalString(rawPayload.building_structure),
  };

  if (
    normalized.current_value !== null &&
    normalized.purchase_price !== null &&
    normalized.current_value > normalized.purchase_price
  ) {
    throw new AssetCreateValidationError('当前价值不能大于购置价格');
  }

  if (normalized.purchase_date && normalized.warranty_end_date) {
    const purchaseTime = compareDateOnly(normalized.purchase_date);
    const warrantyTime = compareDateOnly(normalized.warranty_end_date);
    if (warrantyTime < purchaseTime) {
      throw new AssetCreateValidationError('保修到期日不能早于购置日期');
    }
  }

  return normalized;
};

module.exports = {
  AssetCreateValidationError,
  normalizeAssetCreatePayload,
};

