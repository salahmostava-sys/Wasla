import React from "react";
import { Checkbox } from "@shared/components/ui/checkbox";
import { Input } from "@shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shared/components/ui/select";
import { normalizeArabicDigits } from "@shared/lib/formatters";
import { ColumnTextFilter } from "@shared/components/table/ColumnFilterPopover";
import { type ColumnDef } from "@modules/employees/types/employee.types";
import type { TFunction } from "i18next";

export const DATE_FILTER_KEYS = new Set([
  "join_date",
  "birth_date",
  "probation_end_date",
  "residency_combined",
  "health_insurance_expiry",
  "license_expiry",
]);

export function getContrastTextColor(hexColor: string): string {
  if (!hexColor) return '#ffffff';
  let hex = hexColor.replaceAll('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  
  const r = Number.parseInt(hex.substring(0, 2), 16);
  const g = Number.parseInt(hex.substring(2, 4), 16);
  const b = Number.parseInt(hex.substring(4, 6), 16);
  
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    const isLight = ['yellow', 'lime', 'cyan', 'white'].some(c => hexColor.toLowerCase().includes(c));
    return isLight ? '#000000' : '#ffffff';
  }

  return (r * 299 + g * 587 + b * 114) / 1000 >= 128 ? '#000000' : '#ffffff';
}

export type FilterContext = {
  col: ColumnDef;
  colFilters: Record<string, string>;
  cityOptions: { value: string; label: string }[];
  availableApps: { id: string; name: string; brand_color?: string }[];
  commercialRecordNames: string[];
  uniqueVals: {
    city: string[];
    nationality: string[];
    sponsorship_status: string[];
    license_status: string[];
    job_title: string[];
    status: string[];
  };
  setColFilter: (key: string, value: string) => void;
  t: TFunction;
};

export function buildCityFilter(ctx: FilterContext): React.ReactNode {
  const { colFilters, cityOptions, setColFilter } = ctx;
  const selected = colFilters.city
    ? colFilters.city.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const toggleCity = (v: string) => {
    const next = selected.includes(v)
      ? selected.filter((x) => x !== v)
      : [...selected, v];
    setColFilter("city", next.length ? [...next].sort((a, b) => a.localeCompare(b)).join(",") : "");
  };
  return (
    <div className="space-y-2">
      {cityOptions.map(({ value, label }) => (
        <label key={value} className="flex items-center gap-2 text-xs cursor-pointer">
          <Checkbox checked={selected.includes(value)} onCheckedChange={() => toggleCity(value)} />
          {label}
        </label>
      ))}
    </div>
  );
}

export function buildPlatformAppsFilter(ctx: FilterContext): React.ReactNode {
  const { colFilters, availableApps, setColFilter, t } = ctx;
  const selected = colFilters.platform_apps
    ? colFilters.platform_apps.split(",").map((value) => value.trim()).filter(Boolean)
    : [];
  const toggleApp = (appId: string) => {
    const next = selected.includes(appId)
      ? selected.filter((value) => value !== appId)
      : [...selected, appId];
    const ordered = availableApps.map((app) => app.id).filter((appIdValue) => next.includes(appIdValue));
    setColFilter("platform_apps", ordered.join(","));
  };
  if (availableApps.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-2">{t('noPlatformsAvailable')}</p>;
  }
  return (
    <div className="space-y-2">
      {availableApps.map((app) => (
        <label key={app.id} className="flex items-center gap-2 text-xs cursor-pointer">
          <Checkbox checked={selected.includes(app.id)} onCheckedChange={() => toggleApp(app.id)} />
          <span
            className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium"
            style={{
              backgroundColor: app.brand_color || "#1f54ad",
              color: getContrastTextColor(app.brand_color || "#1f54ad"),
            }}
          >
            {app.name}
          </span>
        </label>
      ))}
    </div>
  );
}

export function buildSponsorshipFilter(ctx: FilterContext): React.ReactNode {
  const { colFilters, setColFilter, t } = ctx;
  const kafalaOptions = [
    { v: "sponsored", l: t('sponsored') },
    { v: "not_sponsored", l: t('notSponsored') },
    { v: "absconded", l: t('absconded') },
    { v: "terminated", l: t('terminated') },
  ] as const;
  const selected = colFilters.sponsorship_status
    ? colFilters.sponsorship_status.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const order = ["sponsored", "not_sponsored", "absconded", "terminated"] as const;
  const toggleKafala = (v: string) => {
    const next = selected.includes(v)
      ? selected.filter((x) => x !== v)
      : [...selected, v];
    const sorted = order.filter((k) => next.includes(k));
    setColFilter("sponsorship_status", sorted.length ? sorted.join(",") : "");
  };
  return (
    <div className="space-y-2">
      {kafalaOptions.map(({ v, l }) => (
        <label key={v} className="flex items-center gap-2 text-xs cursor-pointer">
          <Checkbox checked={selected.includes(v)} onCheckedChange={() => toggleKafala(v)} />
          {l}
        </label>
      ))}
    </div>
  );
}

export function buildDateRangeFilter(ctx: FilterContext): React.ReactNode {
  const { col, colFilters, setColFilter, t } = ctx;
  const rangeVal = colFilters[col.key] || "";
  const [rangeFrom = "", rangeTo = ""] = rangeVal.includes("..") ? rangeVal.split("..") : [rangeVal, ""];
  const updateRange = (from: string, to: string) => {
    if (!from && !to) setColFilter(col.key, "");
    else if (to) setColFilter(col.key, `${from}..${to}`);
    else setColFilter(col.key, from);
  };
  return (
    <fieldset className="space-y-1.5" aria-label={t('dateRange')}>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground w-6">{t('from')}</span>
        <Input type="date" className="h-7 text-xs px-1.5 flex-1" value={rangeFrom} onChange={(event) => updateRange(normalizeArabicDigits(event.target.value), rangeTo)} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground w-6">{t('to')}</span>
        <Input type="date" className="h-7 text-xs px-1.5 flex-1" value={rangeTo} onChange={(event) => updateRange(rangeFrom, normalizeArabicDigits(event.target.value))} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} />
      </div>
    </fieldset>
  );
}

export function buildSelectFilter(filterKey: string, label: string, options: { value: string; label: string }[], ctx: FilterContext): React.ReactNode {
  const { colFilters, setColFilter } = ctx;
  return (
    <Select value={colFilters[filterKey] || "all"} onValueChange={(v) => setColFilter(filterKey, v)}>
      <SelectTrigger className="h-7 text-xs w-full"><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{label}</SelectItem>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function buildColumnFilter(ctx: FilterContext): React.ReactNode {
  const { col, uniqueVals, commercialRecordNames, t } = ctx;
  const licenseOptions = [
    { value: "has_license", label: t('hasLicense') },
    { value: "no_license", label: t('noLicense') },
    { value: "applied", label: t('applied') },
  ];
  const statusOptions = [
    { value: "active", label: t('active') },
    { value: "inactive", label: t('inactive') },
    { value: "ended", label: t('ended') },
  ];
  if (col.key === "city") return buildCityFilter(ctx);
  if (col.key === "platform_apps") return buildPlatformAppsFilter(ctx);
  if (col.key === "sponsorship_status") return buildSponsorshipFilter(ctx);
  if (DATE_FILTER_KEYS.has(col.key)) return buildDateRangeFilter(ctx);
  if (col.key === "license_status") return buildSelectFilter("license_status", t('all'), licenseOptions, ctx);
  if (col.key === "status") return buildSelectFilter("status", t('all'), statusOptions, ctx);
  if (col.key === "nationality") return buildSelectFilter("nationality", t('all'), uniqueVals.nationality.map((n) => ({ value: n, label: n })), ctx);
  if (col.key === "job_title") return buildSelectFilter("job_title", t('all'), uniqueVals.job_title.map((j) => ({ value: j, label: j })), ctx);
  if (col.key === "commercial_record") return buildSelectFilter("commercial_record", t('all'), commercialRecordNames.map((cr) => ({ value: cr, label: cr })), ctx);
  return <ColumnTextFilter value={ctx.colFilters[col.key] || ""} onChange={(v) => ctx.setColFilter(col.key, v)} />;
}
