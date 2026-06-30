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
import { TextFilterInput } from "@modules/employees/components/EmployeesViewParts";
import { type ColumnDef } from "@modules/employees/types/employee.types";

export const DATE_FILTER_KEYS = new Set([
  "join_date",
  "birth_date",
  "probation_end_date",
  "residency_combined",
  "health_insurance_expiry",
  "license_expiry",
]);

const LICENSE_OPTIONS = [
  { value: "has_license", label: "لديه رخصة" },
  { value: "no_license", label: "ليس لديه رخصة" },
  { value: "applied", label: "تم التقديم" },
] as const;

const STATUS_OPTIONS = [
  { value: "active", label: "نشط" },
  { value: "inactive", label: "غير نشط" },
  { value: "ended", label: "منتهي" },
] as const;

export function getContrastTextColor(hexColor: string): string {
  const hex = hexColor.replaceAll('#', '');
  const r = Number.parseInt(hex.substring(0, 2), 16);
  const g = Number.parseInt(hex.substring(2, 4), 16);
  const b = Number.parseInt(hex.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#000000' : '#ffffff';
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
  const { colFilters, availableApps, setColFilter } = ctx;
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
    return <p className="text-xs text-muted-foreground text-center py-2">لا توجد منصات متاحة</p>;
  }
  return (
    <div className="space-y-2">
      {availableApps.map((app) => (
        <label key={app.id} className="flex items-center gap-2 text-xs cursor-pointer">
          <Checkbox checked={selected.includes(app.id)} onCheckedChange={() => toggleApp(app.id)} />
          <span
            className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium"
            style={{
              backgroundColor: app.brand_color || "#6366f1",
              color: getContrastTextColor(app.brand_color || "#6366f1"),
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
  const { colFilters, setColFilter } = ctx;
  const kafalaOptions = [
    { v: "sponsored", l: "على الكفالة" },
    { v: "not_sponsored", l: "ليس على الكفالة" },
    { v: "absconded", l: "هروب" },
    { v: "terminated", l: "انتهاء الخدمة" },
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
  const { col, colFilters, setColFilter } = ctx;
  const rangeVal = colFilters[col.key] || "";
  const [rangeFrom = "", rangeTo = ""] = rangeVal.includes("..") ? rangeVal.split("..") : [rangeVal, ""];
  const updateRange = (from: string, to: string) => {
    if (!from && !to) setColFilter(col.key, "");
    else if (to) setColFilter(col.key, `${from}..${to}`);
    else setColFilter(col.key, from);
  };
  return (
    <fieldset className="space-y-1.5" aria-label="اختيار نطاق التاريخ">
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground w-6">من</span>
        <Input type="date" className="h-7 text-xs px-1.5 flex-1" value={rangeFrom} onChange={(event) => updateRange(normalizeArabicDigits(event.target.value), rangeTo)} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground w-6">إلى</span>
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
  const { col, uniqueVals, commercialRecordNames } = ctx;
  if (col.key === "city") return buildCityFilter(ctx);
  if (col.key === "platform_apps") return buildPlatformAppsFilter(ctx);
  if (col.key === "sponsorship_status") return buildSponsorshipFilter(ctx);
  if (DATE_FILTER_KEYS.has(col.key)) return buildDateRangeFilter(ctx);
  if (col.key === "license_status") return buildSelectFilter("license_status", "الكل", [...LICENSE_OPTIONS], ctx);
  if (col.key === "status") return buildSelectFilter("status", "الكل", [...STATUS_OPTIONS], ctx);
  if (col.key === "nationality") return buildSelectFilter("nationality", "الكل", uniqueVals.nationality.map((n) => ({ value: n, label: n })), ctx);
  if (col.key === "job_title") return buildSelectFilter("job_title", "الكل", uniqueVals.job_title.map((j) => ({ value: j, label: j })), ctx);
  if (col.key === "commercial_record") return buildSelectFilter("commercial_record", "الكل", commercialRecordNames.map((cr) => ({ value: cr, label: cr })), ctx);
  return <TextFilterInput value={ctx.colFilters[col.key] || ""} onChange={(v) => ctx.setColFilter(col.key, v)} />;
}
