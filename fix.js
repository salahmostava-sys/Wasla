const fs = require('node:fs');

let c = fs.readFileSync('frontend/shared/components/settings/ProjectSettings.tsx', 'utf8');

c = c.replaceAll(
  "import type React from 'react';",
  "import type React from 'react';\nconst t = (isRTL: boolean, ar: string, en: string) => isRTL ? ar : en;"
);

c = c.replaceAll(/isRTL \? '(.*?)' : '(.*?)'/g, "t(isRTL, '$1', '$2')");
c = c.replaceAll(/isRTL \? `(.*?)` : `(.*?)`/g, "t(isRTL, `$1`, `$2`)");
c = c.replaceAll('isRTL ? opt.labelAr : opt.labelEn', "t(isRTL, opt.labelAr, opt.labelEn)");

fs.writeFileSync('frontend/shared/components/settings/ProjectSettings.tsx', c);
