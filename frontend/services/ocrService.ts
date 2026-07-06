/**
 * OCR Service — قراءة وثائق هوية الموظفين تلقائياً باستخدام Google Cloud Vision API
 *
 * الوظائف:
 * - extractTextFromImage: إرسال الصورة لخادم الـ AI لاستخراج النص باستخدام Google Cloud Vision
 * - parseIqamaData:  استخراج بيانات الإقامة (الاسم، رقم الإقامة، الجنسية، التواريخ)
 * - parseLicenseData: استخراج بيانات رخصة القيادة (الرقم، التاريخ، الفئة)
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
  name?: string;
  nameEn?: string;
  licenseNumber?: string;
  dateOfBirth?: string;
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
 * دالة: استخراج النص من الصورة باستخدام Google Cloud Vision API
 * ترسل الصورة إلى خادم الـ AI لتحليلها ضوئياً.
 */
export async function extractTextFromImage(
  imageFile: File,
  onProgress?: (progress: OcrProgress) => void,
): Promise<string> {
  try {
    if (onProgress) {
      onProgress({ status: 'جاري تحضير ملف الوثيقة وإرساله...', progress: 0.3 });
    }

    const formData = new FormData();
    formData.append('file', imageFile);

    if (onProgress) {
      onProgress({ status: 'جاري استخراج النص عبر Google Vision...', progress: 0.6 });
    }

    // يتطلب الخادم الآن تسجيل دخول صالح (نفس نمط باقي نقاط الـ API الداخلية)
    // لمنع استخدام هذه النقطة بدون هوية واستنزاف حصة Google Vision المدفوعة.
    const { supabase } = await import('@services/supabase/client');
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      throw new Error('يجب تسجيل الدخول لاستخدام استخراج النصوص');
    }

    // Always use the Vercel Serverless Function at /api/ocr/extract-waybill.
    // The Python backend path (/ai/...) is not available on Vercel.
    const response = await fetch('/api/ocr/extract-waybill', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || `Server error: ${response.statusText}`);
    }

    if (onProgress) {
      onProgress({ status: 'اكتمل تحليل المستند', progress: 1.0 });
    }

    const result = await response.json();
    if (result.success) {
      return result.text || '';
    }
    throw new Error('فشل استخراج النصوص من المستند');
  } catch (err: unknown) {
    console.error('Google Vision OCR Error:', err);
    throw new Error(err instanceof Error ? err.message : String(err));
  }
}

// ─── تحليل بيانات الإقامة ─────────────────────────────────────────────────────

function normalizeArabicNumerals(text: string): string {
  return text.replace(/[٠١٢٣٤٥٦٧٨٩]/g, (d) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]);
}

function cleanOcrNumbers(line: string): string {
  return line.replace(/\s+/g, '')
    .replace(/[Oo]/g, '0')
    .replace(/[lI|]/g, '1')
    .replace(/[Zz]/g, '2')
    .replace(/[Ss]/g, '5')
    .replace(/[Bb]/g, '8');
}

function extractDateFromLine(line: string): string | undefined {
  const clean = cleanOcrNumbers(line);
  const dateRegex = /(\d{1,2}[/.-]\d{1,2}[/.-]\d{4}|\d{4}[/.-]\d{1,2}[/.-]\d{1,2})/g;
  const dateMatches = [...clean.matchAll(dateRegex)].map(m => m[1]);
  if (dateMatches.length > 0) {
    return normalizeDateStr(dateMatches[0]);
  }
  return undefined;
}

/** أنماط البحث عن سطر رقم الهوية/الإقامة/الرخصة */
const ID_LINE_RE = /(رقم|الهوية|القوبة|الاقامة|الإقامة|Number|ID)/gi;
/** أنماط البحث عن سطر تاريخ الانتهاء */
const EXPIRY_LINE_RE = /(الانتهاء|انتهاء|النتهاء|الانتها|Expiry|End|Valid)/gi;
/** أنماط البحث عن سطر تاريخ الميلاد */
const DOB_LINE_RE = /(الميلاد|المبلاد|ميلاد|مبلاد|الولادة|Birth|Eith)/gi;

/** يبحث عن أول سطر يطابق نمطاً معيناً ويحتوي على رقم */
function findLineWithDigits(lines: string[], pattern: RegExp): string | undefined {
  return lines.find(line => pattern.test(line) && /\d/.test(line));
}

/**
 * يستخرج تاريخي الانتهاء والميلاد من قائمة أسطر النص — منطق مشترك بين
 * تحليل الإقامة ورخصة القيادة.
 */
function extractExpiryAndDob(lines: string[]): { expiryDate?: string; dateOfBirth?: string } {
  const result: { expiryDate?: string; dateOfBirth?: string } = {};

  const expiryLine = findLineWithDigits(lines, EXPIRY_LINE_RE);
  if (expiryLine) {
    const date = extractDateFromLine(expiryLine);
    if (date) result.expiryDate = date;
  }

  const dobLine = findLineWithDigits(lines, DOB_LINE_RE);
  if (dobLine) {
    const date = extractDateFromLine(dobLine);
    if (date) result.dateOfBirth = date;
  }

  return result;
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

  const idLine = findLineWithDigits(lines, ID_LINE_RE);
  if (idLine) {
    const clean = cleanOcrNumbers(idLine);
    const match = /2\d{9}/.exec(clean) || /[12]\d{9}/.exec(clean) || /\d{10}/.exec(clean);
    if (match) result.iqamaNumber = match[0];
  }

  Object.assign(result, extractExpiryAndDob(lines));

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

  const idLine = findLineWithDigits(lines, ID_LINE_RE);
  if (idLine) {
    const clean = cleanOcrNumbers(idLine);
    const match = /[12]\d{9}/.exec(clean) || /\d{10}/.exec(clean);
    if (match) result.licenseNumber = match[0];
  }

  Object.assign(result, extractExpiryAndDob(lines));

  const classMatch = [...text.matchAll(LICENSE_CLASS_RE)];
  if (classMatch.length > 0) {
    const cls = classMatch[0][1] || classMatch[0][3];
    if (cls) result.licenseClass = cls.toUpperCase();
  }

  if (!result.licenseClass) {
    const classLine = /(?:فئة|Class)\s*(?:[:：]\s*)?([A-Zأ-ي])/i.exec(text);
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
    if (c?.length === 4) {
      // DD/MM/YYYY
      return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
    }
    if (a?.length === 4) {
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
