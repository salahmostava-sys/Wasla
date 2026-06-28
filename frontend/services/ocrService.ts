/**
 * OCR Service — قراءة وثائق هوية الموظفين تلقائياً باستخدام Tesseract.js
 *
 * الوظائف:
 * - extractTextFromImage: تحويل الصورة إلى نص باستخدام محرك OCR
 * - parseIqamaData:  استخراج بيانات الإقامة (الاسم، رقم الإقامة، الجنسية، التواريخ)
 * - parseLicenseData: استخراج بيانات رخصة القيادة (الرقم، التاريخ، الفئة)
 *
 * ملاحظة: تعمل المعالجة كلياً في المتصفح (client-side) دون رفع الصورة للخوادم.
 */
// ─── أنواع البيانات المستخرجة ─────────────────────────────────────────────────

export interface IqamaData {
  name?: string;
  nameEn?: string;
  iqamaNumber?: string;
  nationality?: string;
  dateOfBirth?: string;
  expiryDate?: string;
}

export interface LicenseData {
  licenseNumber?: string;
  expiryDate?: string;
  licenseClass?: string;
}

export interface OcrProgress {
  status: string;
  progress: number; // 0–1
}

// ─── أنماط regex للبيانات السعودية ───────────────────────────────────────────

/** الجنسيات العربية الشائعة في الإقامات السعودية */
const KNOWN_NATIONALITIES = [
  'EGYPTIAN', 'PAKISTANI', 'INDIAN', 'YEMENI', 'SUDANESE', 'SYRIAN',
  'JORDANIAN', 'PHILIPPINE', 'BANGLADESHI', 'INDONESIAN', 'ETHIOPIAN',
  'NEPALI', 'SRI LANKAN', 'NIGERIAN', 'GHANAIAN', 'KENYAN',
  'مصري', 'باكستاني', 'هندي', 'يمني', 'سوداني', 'سوري',
  'أردني', 'فلبيني', 'بنغلاديشي', 'إندونيسي', 'إثيوبي', 'نيبالي',
];

/** فئات رخصة القيادة السعودية */
const LICENSE_CLASS_RE = /\b([A-Z])\s*(CLASS|CATEGORY|فئة)?\b|\bفئة\s*([أبتجدهوزحطي1-9])\b/gi;

// ─── استخراج النص من الصورة ───────────────────────────────────────────────────

/**
 * دالة: استخراج النص من الصورة (client-side)
 * تقوم بتحميل محرك Tesseract وقراءة النص من الصورة محلياً.
 */
export async function extractTextFromImage(
  imageFile: File,
  onProgress?: (progress: OcrProgress) => void,
): Promise<string> {
  try {
    const tesseractModule = await import('tesseract.js');
    const Tesseract = tesseractModule.default || tesseractModule;
    const worker = await Tesseract.createWorker('ara+eng', 1, {
      workerPath: '/worker.min.js',
      corePath: '/tesseract-core.wasm.js',
      langPath: '/',
      gzip: false,
      workerBlobURL: false,
      logger: (m: { status: string; progress: number }) => {
        if (onProgress) {
          onProgress({ status: m.status, progress: m.progress ?? 0 });
        }
      },
    });

    const { data } = await worker.recognize(imageFile);
    await worker.terminate();
    return data.text;
  } catch (err: unknown) {
    const errString = err ? JSON.stringify(err, Object.getOwnPropertyNames(err)) : String(err);
    console.error('OCR Error Details:', err);
    throw new Error(`Tesseract Error: ${errString}`);
  }
}

// ─── تحليل بيانات الإقامة ─────────────────────────────────────────────────────

function normalizeArabicNumerals(text: string): string {
  return text.replace(/[٠١٢٣٤٥٦٧٨٩]/g, (d) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]);
}

/**
 * يستخرج بيانات الإقامة السعودية من النص المستخرج.
 *
 * @param rawText - النص الخام من OCR
 * @returns بيانات الإقامة المُهيكلة
 */
export function parseIqamaData(rawText: string): IqamaData {
  const text = normalizeArabicNumerals(rawText);
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const result: IqamaData = {};

  // 1. رقم الإقامة (10 أرقام تبدأ بـ 2)
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

  // 2. تاريخ الانتهاء
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

  // 3. تاريخ الميلاد
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

  // 4. الجنسية
  const upperText = text.toUpperCase();
  for (const nat of KNOWN_NATIONALITIES) {
    if (upperText.includes(nat.toUpperCase())) {
      result.nationality = mapNationalityToArabic(nat);
      break;
    }
  }

  extractNamesFromLines(lines, result);
  return result;
}

// ─── تحليل بيانات رخصة القيادة ───────────────────────────────────────────────

function extractNamesFromLines(lines: string[], result: { name?: string; nameEn?: string }) {
  const EXCLUDED_AR_WORDS = [
    'المملكة', 'العربية', 'السعودية', 'وزارة', 'الداخلية', 'المرور', 
    'بطاقة', 'مقيم', 'هوية', 'رخصة', 'سياقة', 'رقم', 'تاريخ', 'فئة', 'قيادة',
    'الاصدار', 'الانتهاء', 'الاسم', 'الجنسية', 'الديانة', 'المهنة', 'صاحب', 'العمل', 'يجب', 'التحقق', 'الرمز', 'السريع', 'قبل', 'اعتماد', 'التعامل'
  ];
  
  const EXCLUDED_EN_WORDS = [
    'KINGDOM', 'SAUDI', 'ARABIA', 'MINISTRY', 'INTERIOR', 'TRAFFIC', 
    'LICENSE', 'DRIVING', 'IQAMA', 'ID', 'NUMBER', 'NAME', 'DATE', 'EXPIRY', 'BLOOD', 'TYPE'
  ];

  const englishNameIdx = lines.findIndex(line =>
    /^[A-Za-z0-9\s.,:-]{5,}$/.test(line) &&
    /[A-Za-z]{3,}/.test(line) &&
    line.split(/\s+/).length >= 2 &&
    !KNOWN_NATIONALITIES.some(n => line.toUpperCase().includes(n.toUpperCase())) &&
    !EXCLUDED_EN_WORDS.some(w => line.toUpperCase().includes(w))
  );

  if (englishNameIdx !== -1) {
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

/**
 * يستخرج بيانات رخصة القيادة السعودية من النص.
 *
 * @param rawText - النص الخام من OCR
 * @returns بيانات الرخصة المُهيكلة
 */
export function parseLicenseData(rawText: string): LicenseData {
  const text = normalizeArabicNumerals(rawText);
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const result: LicenseData = {};

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

  // 4. فئة الرخصة
  const classMatch = [...text.matchAll(LICENSE_CLASS_RE)];
  if (classMatch.length > 0) {
    const cls = classMatch[0][1] || classMatch[0][3];
    if (cls) result.licenseClass = cls.toUpperCase();
  }

  // بديل: البحث عن كلمة "فئة" أو "Class"
  if (!result.licenseClass) {
    const classLine = text.match(/(?:فئة|Class)\s*[:：]?\s*([A-Zأ-ي])/i);
    if (classLine) result.licenseClass = classLine[1].toUpperCase();
  }

  extractNamesFromLines(lines, result);
  return result;
}

// ─── دوال مساعدة ─────────────────────────────────────────────────────────────

/** تحوّل التاريخ إلى صيغة YYYY-MM-DD إن أمكن */
function normalizeDateStr(raw: string): string {
  // محاولة الإصلاح: DD/MM/YYYY → YYYY-MM-DD
  const parts = raw.split(/[/\-.]/);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    if (c && c.length === 4) {
      // DD/MM/YYYY
      return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
    }
    if (a && a.length === 4) {
      // YYYY/MM/DD
      return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
    }
  }
  return raw;
}

/** تُحوّل الجنسية الإنجليزية إلى العربية */
function mapNationalityToArabic(nat: string): string {
  const map: Record<string, string> = {
    EGYPTIAN: 'مصري', PAKISTANI: 'باكستاني', INDIAN: 'هندي',
    YEMENI: 'يمني', SUDANESE: 'سوداني', SYRIAN: 'سوري',
    JORDANIAN: 'أردني', PHILIPPINE: 'فلبيني', BANGLADESHI: 'بنغلاديشي',
    INDONESIAN: 'إندونيسي', ETHIOPIAN: 'إثيوبي', NEPALI: 'نيبالي',
    'SRI LANKAN': 'سريلانكي', NIGERIAN: 'نيجيري', GHANAIAN: 'غاني',
    KENYAN: 'كيني',
  };
  return map[nat.toUpperCase()] ?? nat;
}
