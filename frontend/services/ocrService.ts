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
import Tesseract from 'tesseract.js';

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

/** رقم الإقامة: 10 أرقام تبدأ بـ 2 */
const IQAMA_NUMBER_RE = /(?:^|\D)(2\d{9})(?:\D|$)/g;

/** تاريخ هجري أو ميلادي بأشكاله الشائعة (مع تسامح مع المسافات) */
const DATE_RE = new RegExp('\\b(\\d{2}\\s*[/\\-.]\\s*\\d{2}\\s*[/\\-.]\\s*\\d{4}|\\d{4}\\s*[/\\-.]\\s*\\d{2}\\s*[/\\-.]\\s*\\d{2}|\\d{4}\\s*[/\\-.]\\s*\\d{2})\\b', 'g');

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
  const result: IqamaData = {};

  // 1. رقم الإقامة (10 أرقام تبدأ بـ 2)
  const textNoSpaces = text.replace(/\s+/g, '');
  const iqamaMatch = textNoSpaces.match(/2\d{9}/);
  if (iqamaMatch) {
    result.iqamaNumber = iqamaMatch[0];
  }

  // 2. التواريخ — أول تاريخ = تاريخ الميلاد، آخر تاريخ = انتهاء الصلاحية
  const dateRegex = /(\d{2}[/\-.]\d{2}[/\-.]\d{4}|\d{4}[/\-.]\d{2}[/\-.]\d{2}|\d{4}[/\-.]\d{2})/g;
  const dateMatches = [...textNoSpaces.matchAll(dateRegex)].map(m => m[1]);
  if (dateMatches.length >= 1) {
    result.dateOfBirth = normalizeDateStr(dateMatches[0]);
  }
  if (dateMatches.length >= 2) {
    result.expiryDate = normalizeDateStr(dateMatches[dateMatches.length - 1]);
  }

  // 3. الجنسية
  const upperText = text.toUpperCase();
  for (const nat of KNOWN_NATIONALITIES) {
    if (upperText.includes(nat.toUpperCase())) {
      result.nationality = mapNationalityToArabic(nat);
      break;
    }
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

  // الاسم الإنجليزي: سطر يحتوي على أحرف لاتينية أساساً (مع تسامح مع الأرقام/الرموز بسبب أخطاء OCR)
  const englishNameIdx = lines.findIndex(line =>
    /^[A-Za-z0-9\s.,-]{5,}$/.test(line) &&
    /[A-Za-z]{3,}/.test(line) &&
    line.split(/\s+/).length >= 2 &&
    !KNOWN_NATIONALITIES.some(n => line.toUpperCase().includes(n.toUpperCase())) &&
    !EXCLUDED_EN_WORDS.some(w => line.toUpperCase().includes(w))
  );

  if (englishNameIdx !== -1) {
    result.nameEn = lines[englishNameIdx].replace(/\s+/g, ' ').trim();
    // الاسم العربي غالباً يكون السطر الذي يسبق الاسم الإنجليزي مباشرة في الهوية السعودية
    if (englishNameIdx > 0) {
      const possibleArName = lines[englishNameIdx - 1];
      if (!EXCLUDED_AR_WORDS.some(w => possibleArName.includes(w))) {
        result.name = possibleArName.replace(/\s+/g, ' ').trim();
      }
    }
  }

  // fallback للاسم العربي إذا لم يتم العثور عليه
  if (!result.name) {
    const arabicNameLine = lines.find(line =>
      // فحص مخفف: يحتوي على أحرف عربية ومسافات كافية بعد إزالة الرموز
      /^[\u0600-\u06FF\s]{5,}$/.test(line.replace(/[^\u0600-\u06FF\s]/g, '')) &&
      line.split(/\s+/).length >= 2 &&
      !EXCLUDED_AR_WORDS.some(w => line.includes(w))
    );
    if (arabicNameLine) {
      result.name = arabicNameLine.replace(/\s+/g, ' ').trim();
    }
  }

  return result;
}

// ─── تحليل بيانات رخصة القيادة ───────────────────────────────────────────────

/**
 * يستخرج بيانات رخصة القيادة السعودية من النص.
 *
 * @param rawText - النص الخام من OCR
 * @returns بيانات الرخصة المُهيكلة
 */
export function parseLicenseData(rawText: string): LicenseData {
  const text = normalizeArabicNumerals(rawText);
  const result: LicenseData = {};

  // 1. رقم الرخصة: عادةً 10 أرقام
  const textNoSpaces = text.replace(/\s+/g, '');
  const licenseNumMatch = textNoSpaces.match(/2\d{9}/) || textNoSpaces.match(/\d{10}/);
  if (licenseNumMatch) {
    result.licenseNumber = licenseNumMatch[0];
  }

  // 2. التواريخ — آخر تاريخ = انتهاء الصلاحية
  const dateRegex = /(\d{2}[/\-.]\d{2}[/\-.]\d{4}|\d{4}[/\-.]\d{2}[/\-.]\d{2}|\d{4}[/\-.]\d{2})/g;
  const dateMatches = [...textNoSpaces.matchAll(dateRegex)].map(m => m[1]);
  if (dateMatches.length > 0) {
    result.expiryDate = normalizeDateStr(dateMatches[dateMatches.length - 1]);
  }

  // 3. فئة الرخصة
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
        result.name = possibleArName.replace(/\s+/g, ' ').trim();
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
      result.name = arabicNameLine.replace(/\s+/g, ' ').trim();
    }
  }

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
