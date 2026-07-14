let iconv = null;
try {
  iconv = require('iconv-lite');
} catch (error) {
  iconv = null;
}

const CJK_REGEX = /[\u3400-\u9fff]/g;
const MOJIBAKE_HINT_REGEX =
  /[\u0080-\u00ff\u0152\u0153\u0160\u0161\u0178\u0192\u02c6\u02dc\u2013\u2014\u2018\u2019\u201a\u201c\u201d\u201e\u2020\u2021\u2022\u2026\u2030\u2039\u203a\u20ac]/;

const countCjkCharacters = text => {
  if (typeof text !== 'string' || text.length === 0) {
    return 0;
  }
  const matches = text.match(CJK_REGEX);
  return Array.isArray(matches) ? matches.length : 0;
};

const encodeMojibakeCharToByte = char => {
  const codePoint = char.codePointAt(0);
  if (Number.isInteger(codePoint) && codePoint <= 0xff) {
    return codePoint;
  }

  if (!iconv) {
    return null;
  }

  try {
    const encoded = iconv.encode(char, 'win1252');
    if (!Buffer.isBuffer(encoded) || encoded.length !== 1) {
      return null;
    }
    // win1252 对不可编码字符会回退成 '?'
    if (encoded[0] === 0x3f && char !== '?') {
      return null;
    }
    return encoded[0];
  } catch (error) {
    return null;
  }
};

const tryDecodeMojibakeText = value => {
  if (typeof value !== 'string' || value.length === 0) {
    return value;
  }

  if (!MOJIBAKE_HINT_REGEX.test(value)) {
    return value;
  }

  const originalCjkCount = countCjkCharacters(value);
  const bytes = [];

  for (const char of value) {
    const byte = encodeMojibakeCharToByte(char);
    if (!Number.isInteger(byte)) {
      return value;
    }
    bytes.push(byte);
  }

  let decoded = '';
  try {
    decoded = Buffer.from(bytes).toString('utf8');
  } catch (error) {
    return value;
  }

  if (!decoded || decoded.includes('\uFFFD')) {
    return value;
  }

  const decodedCjkCount = countCjkCharacters(decoded);
  return decodedCjkCount > originalCjkCount ? decoded : value;
};

module.exports = {
  tryDecodeMojibakeText,
};
