import os
import re

# إعدادات السكريبت
PROJECT_DIR = '.'
OUTPUT_FILE = 'system_map.md'
IGNORE_DIRS = {'node_modules', 'build', 'dist', '.git', 'mocks', '__tests__', 'graphify-out'}
# نبحث عن استدعاءات قاعدة البيانات في Supabase
SUPABASE_PATTERN = re.compile(r"supabase\.from\(['\"]([^'\"]+)['\"]\)")

def build_system_map():
    db_connections = {}

    # المرور على كل ملفات المشروع
    for root, dirs, files in os.walk(PROJECT_DIR):
        # استبعاد المجلدات غير المهمة
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]

        for file in files:
            # التركيز على ملفات الأكواد فقط
            if file.endswith(('.ts', '.tsx')):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                        
                        # البحث عن الجداول المرتبطة بهذا الملف
                        matches = SUPABASE_PATTERN.findall(content)
                        if matches:
                            # تنظيف مسار الملف ليكون مقروءاً
                            clean_path = os.path.relpath(filepath, PROJECT_DIR)
                            db_connections[clean_path] = list(set(matches))
                except Exception:
                    pass # تخطي الملفات التي لا يمكن قراءتها

    # كتابة الخريطة في ملف نصي مبسط للمساعد الذكي
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as out:
        out.write("# خريطة معمارية النظام (System Architecture Map)\n\n")
        out.write("هذا الملف يوضح الملفات البرمجية والجداول التي تتصل بها في قاعدة بيانات Supabase بشكل مباشر:\n\n")
        
        if not db_connections:
            out.write("لم يتم العثور على استدعاءات مباشرة لقاعدة البيانات.\n")
        else:
            for filepath, tables in db_connections.items():
                out.write(f"### الملف: `{filepath}`\n")
                out.write(f"- **يتصل بجداول:** {', '.join(tables)}\n\n")

    print(f"تم بناء الخريطة بنجاح! راجع ملف {OUTPUT_FILE}")

if __name__ == "__main__":
    build_system_map()
