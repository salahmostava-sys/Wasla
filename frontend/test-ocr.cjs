const Tesseract = require('tesseract.js');

function normalizeArabicNumerals(text) {
  return text.replace(/[٠١٢٣٤٥٦٧٨٩]/g, (d) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]);
}

function normalizeDateStr(dateStr) {
  if (!dateStr) return '';
  const clean = dateStr.replace(/[\s/\\. -]/g, '');
  if (clean.length === 8) {
    if (clean.startsWith('14') || clean.startsWith('20')) {
      return `${clean.slice(0,4)}/${clean.slice(4,6)}/${clean.slice(6,8)}`;
    }
    return `${clean.slice(4,8)}/${clean.slice(2,4)}/${clean.slice(0,2)}`;
  }
  return dateStr;
}

function parseIqamaData(rawText) {
  const text = normalizeArabicNumerals(rawText);
  const result = {};

  const textNoSpaces = text.replace(/\s+/g, '');
  const possibleNumberText = textNoSpaces
    .replace(/[Oo]/g, '0')
    .replace(/[lI|]/g, '1')
    .replace(/[Zz]/g, '2')
    .replace(/[Ss]/g, '5')
    .replace(/[Bb]/g, '8');

  const iqamaMatch = possibleNumberText.match(/2\d{9}/);
  if (iqamaMatch) {
    result.iqamaNumber = iqamaMatch[0];
  }

  const dateRegex = /(\d{2}[/.-]\d{2}[/.-]\d{4}|\d{4}[/.-]\d{2}[/.-]\d{2}|\d{4}[/.-]\d{2})/g;
  const dateMatches = [...possibleNumberText.matchAll(dateRegex)].map(m => m[1]);
  if (dateMatches.length >= 1) {
    result.dateOfBirth = normalizeDateStr(dateMatches[0]);
  }
  if (dateMatches.length >= 2) {
    result.expiryDate = normalizeDateStr(dateMatches[dateMatches.length - 1]);
  }

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  const EXCLUDED_AR_WORDS = [
    'المملكة', 'العربية', 'السعودية', 'وزارة', 'الداخلية', 'المرور', 
    'بطاقة', 'مقيم', 'هوية', 'رخصة', 'سياقة', 'رقم', 'تاريخ', 'فئة', 'قيادة',
    'الاصدار', 'الانتهاء', 'الاسم', 'الجنسية', 'الديانة', 'المهنة', 'صاحب', 'العمل', 'يجب', 'التحقق', 'الرمز', 'السريع', 'قبل', 'اعتماد', 'التعامل'
  ];
  
  const EXCLUDED_EN_WORDS = [
    'KINGDOM', 'SAUDI', 'ARABIA', 'MINISTRY', 'INTERIOR', 'TRAFFIC', 
    'LICENSE', 'DRIVING', 'IQAMA', 'ID', 'NUMBER', 'NAME', 'DATE', 'EXPIRY', 'BLOOD', 'TYPE'
  ];

  const KNOWN_NATIONALITIES = [
    'EGYPTIAN', 'PAKISTANI', 'INDIAN', 'YEMENI', 'SUDANESE', 'SYRIAN',
    'JORDANIAN', 'PHILIPPINE', 'BANGLADESHI', 'INDONESIAN', 'ETHIOPIAN',
    'NEPALI', 'SRI LANKAN', 'NIGERIAN', 'GHANAIAN', 'KENYAN',
    'مصري', 'باكستاني', 'هندي', 'يمني', 'سوداني', 'سوري',
    'أردني', 'فلبيني', 'بنغلاديشي', 'إندونيسي', 'إثيوبي', 'نيبالي',
  ];

  const englishNameIdx = lines.findIndex(line =>
    /^[A-Za-z0-9\s.,-]{5,}$/.test(line) &&
    /[A-Za-z]{3,}/.test(line) &&
    line.split(/\s+/).length >= 2 &&
    !KNOWN_NATIONALITIES.some(n => line.toUpperCase().includes(n.toUpperCase())) &&
    !EXCLUDED_EN_WORDS.some(w => line.toUpperCase().includes(w))
  );

  if (englishNameIdx !== -1) {
    result.nameEn = lines[englishNameIdx].replace(/\s+/g, ' ').trim();
    if (englishNameIdx > 0) {
      const possibleArName = lines[englishNameIdx - 1];
      if (!EXCLUDED_AR_WORDS.some(w => possibleArName.includes(w))) {
        result.name = possibleArName.replace(/[A-Za-z0-9=_-]/g, '').replace(/\s+/g, ' ').trim();
      }
    }
  }

  if (!result.name) {
    const arabicNameLine = lines.find(line =>
      /^[\u0600-\u06FF\s]{5,}$/.test(line.replace(/[^\u0600-\u06FF\s]/g, '')) &&
      line.split(/\s+/).length >= 2 &&
      !EXCLUDED_AR_WORDS.some(w => line.includes(w))
    );
    if (arabicNameLine) {
      result.name = arabicNameLine.replace(/[A-Za-z0-9=_-]/g, '').replace(/\s+/g, ' ').trim();
    }
  }

  return result;
}

const imagePath = 'C:/Users/MUHIMMAT/.gemini/antigravity-ide/brain/d762b12b-dbc5-4bdb-97db-b3023005a6b2/media__1782642225201.jpg';

async function test() {
  console.log('Starting OCR on:', imagePath);
  try {
    const result = await Tesseract.recognize(imagePath, 'ara+eng', {
      logger: m => console.log(m.status, Math.round(m.progress * 100) + '%')
    });
    console.log('--- RAW TEXT ---');
    console.log(result.data.text);
    console.log('----------------');
    
    const parsed = parseIqamaData(result.data.text);
    console.log('--- PARSED IQAMA ---');
    console.log(JSON.stringify(parsed, null, 2));

    const parsedLicense = parseLicenseData(result.data.text);
    console.log('--- PARSED LICENSE ---');
    console.log(JSON.stringify(parsedLicense, null, 2));
  } catch (err) {
    console.error('Error running OCR:', err);
  }
}

function parseLicenseData(rawText) {
  const text = normalizeArabicNumerals(rawText);
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const result = {};

  // 1. ID Number (licenseNumber)
  const idLine = lines.find(line => 
    /(رقم|الهوية|القوبة|الاقامة|الإقامة|Number|ID)/gi.test(line) && /\d/.test(line)
  );
  if (idLine) {
    const clean = idLine.replace(/\s+/g, '')
      .replace(/[Oo]/g, '0')
      .replace(/[lI|]/g, '1')
      .replace(/[Zz]/g, '2')
      .replace(/[Ss]/g, '5')
      .replace(/[Bb]/g, '8');
    const match = clean.match(/[12]\d{9}/) || clean.match(/\d{10}/);
    if (match) result.licenseNumber = match[0];
  }

  // 2. Expiry Date
  const expiryLine = lines.find(line => 
    /(الانتهاء|انتهاء|النتهاء|الانتها|Expiry|End|Valid)/gi.test(line) && /\d/.test(line)
  );
  if (expiryLine) {
    const clean = expiryLine.replace(/\s+/g, '')
      .replace(/[Oo]/g, '0')
      .replace(/[lI|]/g, '1')
      .replace(/[Zz]/g, '2')
      .replace(/[Ss]/g, '5')
      .replace(/[Bb]/g, '8');
    const dateRegex = /(\d{1,2}[/.-]\d{1,2}[/.-]\d{4}|\d{4}[/.-]\d{1,2}[/.-]\d{1,2}|\d{4}[/.-]\d{1,2})/g;
    const dateMatches = [...clean.matchAll(dateRegex)].map(m => m[1]);
    if (dateMatches.length > 0) {
      result.expiryDate = normalizeDateStr(dateMatches[0]);
    }
  }

  // 3. DOB
  const dobLine = lines.find(line => 
    /(الميلاد|المبلاد|ميلاد|مبلاد|الولادة|Birth|Eith)/gi.test(line) && /\d/.test(line)
  );
  if (dobLine) {
    const clean = dobLine.replace(/\s+/g, '')
      .replace(/[Oo]/g, '0')
      .replace(/[lI|]/g, '1')
      .replace(/[Zz]/g, '2')
      .replace(/[Ss]/g, '5')
      .replace(/[Bb]/g, '8');
    const dateRegex = /(\d{1,2}[/.-]\d{1,2}[/.-]\d{4}|\d{4}[/.-]\d{1,2}[/.-]\d{1,2}|\d{4}[/.-]\d{1,2})/g;
    const dateMatches = [...clean.matchAll(dateRegex)].map(m => m[1]);
    if (dateMatches.length > 0) {
      result.dateOfBirth = normalizeDateStr(dateMatches[0]);
    }
  }

  // 4. Class
  const classMatch = [...text.matchAll(/\b([A-Z])\s*(CLASS|CATEGORY|فئة)?\b|\bفئة\s*([أبتجدهوزحطي1-9])\b/gi)];
  if (classMatch.length > 0) {
    const cls = classMatch[0][1] || classMatch[0][3];
    if (cls) result.licenseClass = cls.toUpperCase();
  }

  extractNamesFromLines(lines, result);
  return result;
}

function parseIqamaData(rawText) {
  const text = normalizeArabicNumerals(rawText);
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const result = {};

  // 1. ID Number (iqamaNumber)
  const idLine = lines.find(line => 
    /(رقم|الهوية|القوبة|الاقامة|الإقامة|Number|ID)/gi.test(line) && /\d/.test(line)
  );
  if (idLine) {
    const clean = idLine.replace(/\s+/g, '')
      .replace(/[Oo]/g, '0')
      .replace(/[lI|]/g, '1')
      .replace(/[Zz]/g, '2')
      .replace(/[Ss]/g, '5')
      .replace(/[Bb]/g, '8');
    const match = clean.match(/2\d{9}/) || clean.match(/[12]\d{9}/) || clean.match(/\d{10}/);
    if (match) result.iqamaNumber = match[0];
  }

  // 2. Expiry Date
  const expiryLine = lines.find(line => 
    /(الانتهاء|انتهاء|النتهاء|الانتها|Expiry|End|Valid)/gi.test(line) && /\d/.test(line)
  );
  if (expiryLine) {
    const clean = expiryLine.replace(/\s+/g, '')
      .replace(/[Oo]/g, '0')
      .replace(/[lI|]/g, '1')
      .replace(/[Zz]/g, '2')
      .replace(/[Ss]/g, '5')
      .replace(/[Bb]/g, '8');
    const dateRegex = /(\d{1,2}[/.-]\d{1,2}[/.-]\d{4}|\d{4}[/.-]\d{1,2}[/.-]\d{1,2}|\d{4}[/.-]\d{1,2})/g;
    const dateMatches = [...clean.matchAll(dateRegex)].map(m => m[1]);
    if (dateMatches.length > 0) {
      result.expiryDate = normalizeDateStr(dateMatches[0]);
    }
  }

  // 3. DOB
  const dobLine = lines.find(line => 
    /(الميلاد|المبلاد|ميلاد|مبلاد|الولادة|Birth|Eith)/gi.test(line) && /\d/.test(line)
  );
  if (dobLine) {
    const clean = dobLine.replace(/\s+/g, '')
      .replace(/[Oo]/g, '0')
      .replace(/[lI|]/g, '1')
      .replace(/[Zz]/g, '2')
      .replace(/[Ss]/g, '5')
      .replace(/[Bb]/g, '8');
    const dateRegex = /(\d{1,2}[/.-]\d{1,2}[/.-]\d{4}|\d{4}[/.-]\d{1,2}[/.-]\d{1,2}|\d{4}[/.-]\d{1,2})/g;
    const dateMatches = [...clean.matchAll(dateRegex)].map(m => m[1]);
    if (dateMatches.length > 0) {
      result.dateOfBirth = normalizeDateStr(dateMatches[0]);
    }
  }

  extractNamesFromLines(lines, result);
  return result;
}

function extractNamesFromLines(lines, result) {
  const EXCLUDED_AR_WORDS = [
    'المملكة', 'العربية', 'السعودية', 'وزارة', 'الداخلية', 'المرور', 
    'بطاقة', 'مقيم', 'هوية', 'رخصة', 'سياقة', 'رقم', 'تاريخ', 'فئة', 'قيادة',
    'الاصدار', 'الانتهاء', 'الاسم', 'الجنسية', 'الديانة', 'المهنة', 'صاحب', 'العمل', 'يجب', 'التحقق', 'الرمز', 'السريع', 'قبل', 'اعتماد', 'التعامل'
  ];
  
  const EXCLUDED_EN_WORDS = [
    'KINGDOM', 'SAUDI', 'ARABIA', 'MINISTRY', 'INTERIOR', 'TRAFFIC', 
    'LICENSE', 'DRIVING', 'IQAMA', 'ID', 'NUMBER', 'NAME', 'DATE', 'EXPIRY', 'BLOOD', 'TYPE'
  ];

  const KNOWN_NATIONALITIES = [
    'EGYPTIAN', 'PAKISTANI', 'INDIAN', 'YEMENI', 'SUDANESE', 'SYRIAN',
    'JORDANIAN', 'PHILIPPINE', 'BANGLADESHI', 'INDONESIAN', 'ETHIOPIAN',
    'NEPALI', 'SRI LANKAN', 'NIGERIAN', 'GHANAIAN', 'KENYAN',
    'مصري', 'باكستاني', 'هندي', 'يمني', 'سوداني', 'سوري',
    'أردني', 'فلبيني', 'بنغلاديشي', 'إندونيسي', 'إثيوبي', 'نيبالي',
  ];

  // Allow colon ':' and optional punctuation in English name match
  const englishNameIdx = lines.findIndex(line =>
    /^[A-Za-z0-9\s.,:-]{5,}$/.test(line) &&
    /[A-Za-z]{3,}/.test(line) &&
    line.split(/\s+/).length >= 2 &&
    !KNOWN_NATIONALITIES.some(n => line.toUpperCase().includes(n.toUpperCase())) &&
    !EXCLUDED_EN_WORDS.some(w => line.toUpperCase().includes(w))
  );

  if (englishNameIdx !== -1) {
    // Clean up colon and optional leading spaces from En Name
    result.nameEn = lines[englishNameIdx].replace(/^[:\s]+/, '').replace(/\s+/g, ' ').trim();
    if (englishNameIdx > 0) {
      const possibleArName = lines[englishNameIdx - 1];
      if (!EXCLUDED_AR_WORDS.some(w => possibleArName.includes(w))) {
        result.name = possibleArName.replace(/[A-Za-z0-9=_-]/g, '').replace(/\s+/g, ' ').trim();
      }
    }
  }

  if (!result.name) {
    const arabicNameLine = lines.find(line =>
      /^[\u0600-\u06FF\s]{5,}$/.test(line.replace(/[^\u0600-\u06FF\s]/g, '')) &&
      line.split(/\s+/).length >= 2 &&
      !EXCLUDED_AR_WORDS.some(w => line.includes(w))
    );
    if (arabicNameLine) {
      result.name = arabicNameLine.replace(/[A-Za-z0-9=_-]/g, '').replace(/\s+/g, ' ').trim();
    }
  }
}


test();
