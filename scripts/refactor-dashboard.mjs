import fs from 'fs';

const filePath = 'd:\\MuhimmatAltawseel\\frontend\\modules\\ai-dashboard\\components\\AIDashboard.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Move helpers out
const helpersRegex = /  const getTrendIcon = [\s\S]*?  };\n/m;
const helpersMatch = content.match(helpersRegex);
if (helpersMatch) {
  content = content.replace(helpersMatch[0], '');
  content = content.replace('export function AIDashboard({', helpersMatch[0].replace(/^  /gm, '') + '\nexport function AIDashboard({');
}

// 2. Extract Data Summary rendering
const dataSummaryRegex = /{normalizedOrders === null \? \([\s\S]*?\)\)}/m;
const dataSummaryMatch = content.match(dataSummaryRegex);
if (dataSummaryMatch) {
  const func = `
function DataSummaryContent({ normalizedOrders, normalizedDaysPassed, topPerformers, monthlyTrend }: any) {
  return ${dataSummaryMatch[0]};
}
`;
  content = content.replace('export function AIDashboard({', func + '\nexport function AIDashboard({');
  content = content.replace(dataSummaryMatch[0], '<DataSummaryContent normalizedOrders={normalizedOrders} normalizedDaysPassed={normalizedDaysPassed} topPerformers={topPerformers} monthlyTrend={monthlyTrend} />');
}

// 3. Extract Order Forecast rendering
const orderForecastRegex = /{loadingExtras \? \(\s*<div className="flex items-center justify-center py-8">\s*<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" \/>\s*<\/div>\s*\) : orderForecast \? \([\s\S]*?\) : \([\s\S]*?\)}/m;
const orderForecastMatch = content.match(orderForecastRegex);
if (orderForecastMatch) {
  const func = `
function OrderForecastContent({ loadingExtras, orderForecast, getTrendIcon, getConfidenceBadge }: any) {
  return ${orderForecastMatch[0]};
}
`;
  content = content.replace('export function AIDashboard({', func + '\nexport function AIDashboard({');
  content = content.replace(orderForecastMatch[0], '<OrderForecastContent loadingExtras={loadingExtras} orderForecast={orderForecast} getTrendIcon={getTrendIcon} getConfidenceBadge={getConfidenceBadge} />');
}

// 4. Extract Top Platforms rendering
const topPlatformsRegex = /{loadingExtras \? \(\s*<div className="flex items-center justify-center py-8">\s*<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" \/>\s*<\/div>\s*\) : topPlatforms && topPlatforms.platforms.length > 0 \? \([\s\S]*?\) : \([\s\S]*?\)}/m;
const topPlatformsMatch = content.match(topPlatformsRegex);
if (topPlatformsMatch) {
  const func = `
function TopPlatformsContent({ loadingExtras, topPlatforms }: any) {
  return ${topPlatformsMatch[0]};
}
`;
  content = content.replace('export function AIDashboard({', func + '\nexport function AIDashboard({');
  content = content.replace(topPlatformsMatch[0], '<TopPlatformsContent loadingExtras={loadingExtras} topPlatforms={topPlatforms} />');
}

// 5. Extract Smart Alerts rendering
const smartAlertsRegex = /{loadingExtras \? \(\s*<div className="flex items-center justify-center py-8">\s*<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" \/>\s*<\/div>\s*\) : smartAlerts && smartAlerts.alerts.length > 0 \? \([\s\S]*?\) : \([\s\S]*?\)}/m;
const smartAlertsMatch = content.match(smartAlertsRegex);
if (smartAlertsMatch) {
  const func = `
function SmartAlertsContent({ loadingExtras, smartAlerts }: any) {
  return ${smartAlertsMatch[0]};
}
`;
  content = content.replace('export function AIDashboard({', func + '\nexport function AIDashboard({');
  content = content.replace(smartAlertsMatch[0], '<SmartAlertsContent loadingExtras={loadingExtras} smartAlerts={smartAlerts} />');
}

// 6. Extract Anomaly Detection rendering
const anomalyRegex = /{loadingExtras \? \(\s*<div className="flex items-center justify-center py-8">\s*<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" \/>\s*<\/div>\s*\) : anomaly \? \([\s\S]*?\) : \([\s\S]*?\)}/m;
const anomalyMatch = content.match(anomalyRegex);
if (anomalyMatch) {
  const func = `
function AnomalyDetectionContent({ loadingExtras, anomaly }: any) {
  return ${anomalyMatch[0]};
}
`;
  content = content.replace('export function AIDashboard({', func + '\nexport function AIDashboard({');
  content = content.replace(anomalyMatch[0], '<AnomalyDetectionContent loadingExtras={loadingExtras} anomaly={anomaly} />');
}


fs.writeFileSync(filePath, content, 'utf-8');
console.log('Refactoring complete.');
