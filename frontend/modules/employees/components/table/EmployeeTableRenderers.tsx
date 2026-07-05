import React from "react";
import { differenceInDays, parseISO } from "date-fns";
import { Eye, Edit, Trash2 } from "lucide-react";
import { Button } from "@shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@shared/components/ui/dropdown-menu";
import { todayISO } from "@shared/lib/formatters";
import {
  CityBadges,
  LicenseBadge,
  SponsorBadge,
  StatusBadge,
  EmployeeAvatar,
} from "@modules/employees/components/EmployeesViewParts";
import { getEmployeeCities } from "@modules/employees/model/employeeUtils";
import {
  InlineMultiSelectEditor,
  InlineSelectEditor,
} from "@modules/employees/components/EmployeeInlineEditors";
import { PlatformAppsEditor } from "@modules/employees/components/PlatformAppsEditor";
import {
  dayColorByThreshold,
  probationColor,
  EMPTY_DATA_PLACEHOLDER,
  type Employee,
  type ColumnDef,
} from "@modules/employees/types/employee.types";
import { getContrastTextColor } from "./EmployeeTableFilters";

const SPONSORSHIP_OPTIONS = [
  { value: "sponsored", label: "على الكفالة" },
  { value: "not_sponsored", label: "ليس على الكفالة" },
  { value: "absconded", label: "هروب" },
  { value: "terminated", label: "انتهاء الخدمة" },
] as const;

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

export type CellContext = {
  col: ColumnDef;
  colIdx: number;
  emp: Employee;
  globalIdx: number;
  presenceUser?: { userId: string; name: string; color: string };
  res: { days: number | null };
  daysColor: string;
  permissions: { can_edit: boolean; can_delete: boolean };
  availableApps: { id: string; name: string; brand_color?: string }[];
  cityOptions: { value: string; label: string }[];
  commercialRecordNames: string[];
  uniqueVals: { job_title: string[]; nationality: string[]; sponsorship_status: string[]; license_status: string[]; status: string[]; city: string[] };
  emptyCell: React.ReactNode;
  saveField: (id: string, field: string, value: string | null, extraFields?: Record<string, unknown>) => Promise<void>;
  setSelectedEmployee: React.Dispatch<React.SetStateAction<string | null>>;
  setEditEmployee: React.Dispatch<React.SetStateAction<Employee | null>>;
  setShowAddModal: React.Dispatch<React.SetStateAction<boolean>>;
  setDeleteEmployee: React.Dispatch<React.SetStateAction<Employee | null>>;
  setStatusDateDialog: React.Dispatch<React.SetStateAction<{ emp: Employee; newStatus: string; label: string } | null>>;
  setStatusDate: React.Dispatch<React.SetStateAction<string>>;
  refetchEmployees: () => void;
  renderTextValue: (value?: string | null, options?: Readonly<{ dir?: "rtl" | "ltr" | "auto"; className?: string }>) => React.ReactNode;
  renderEditableTextCell: (employeeId: string, field: string, value?: string | null, options?: Readonly<{ dir?: "rtl" | "ltr" | "auto"; className?: string; placeholder?: string; inputType?: "text" | "email" }>) => React.ReactNode;
  renderEditableDate: (employeeId: string, field: string, value?: string | null, display?: React.ReactNode) => React.ReactNode;
  formatDateCell: (value?: string | null) => string;
  buildTextOptions: (values: string[], currentValue?: string | null) => { value: string; label: string }[];
};

function renderSeqCell(ctx: CellContext): React.ReactNode {
  const { colIdx, globalIdx, presenceUser } = ctx;
  return (
    <td key="seq" className="ta-td relative font-semibold text-muted-foreground tabular-nums">
      {globalIdx}
      {colIdx === 0 && presenceUser && (
        <span className="absolute -top-2.5 start-1 z-10 rounded px-1.5 py-0 text-[8px] font-medium text-white whitespace-nowrap shadow-sm" style={{ backgroundColor: presenceUser.color }}>
          {presenceUser.name}
        </span>
      )}
    </td>
  );
}

function renderNameCell(ctx: CellContext): React.ReactNode {
  const { emp, setSelectedEmployee } = ctx;
  return (
    <td key="name" className="ta-td align-middle">
      <button
        onClick={() => setSelectedEmployee(emp.id)}
        className="flex items-center justify-center gap-2.5 text-sm font-semibold text-foreground transition-colors hover:text-primary text-center"
      >
        <EmployeeAvatar path={emp.personal_photo_url} name={emp.name} />
        <span className="whitespace-nowrap">{emp.name}</span>
      </button>
    </td>
  );
}

function renderPlatformAppsCell(ctx: CellContext): React.ReactNode {
  const { emp, permissions, availableApps, refetchEmployees, emptyCell } = ctx;
  return (
    <td key="platform_apps" className="ta-td">
      {permissions.can_edit ? (
        <PlatformAppsEditor employeeId={emp.id} employeeName={emp.name} currentApps={emp.platform_apps || []} availableApps={availableApps} onSuccess={refetchEmployees} />
      ) : (
        <div className="flex items-center justify-center gap-1 whitespace-nowrap">
          {emp.platform_apps?.length
            ? emp.platform_apps.map((app) => (
                <span key={app.id} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium"
                  style={{ backgroundColor: app.brand_color || "#6366f1", color: getContrastTextColor(app.brand_color || "#6366f1") }}
                >
                  {app.name}
                </span>
              ))
            : emptyCell}
        </div>
      )}
    </td>
  );
}

function renderResidencyCell(ctx: CellContext): React.ReactNode {
  const { emp, res, daysColor, renderEditableDate, formatDateCell, emptyCell } = ctx;
  return (
    <td key="residency_combined" className="ta-td">
      {renderEditableDate(emp.id, "residency_expiry", emp.residency_expiry,
        emp.residency_expiry ? (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs text-muted-foreground">{formatDateCell(emp.residency_expiry)}</span>
            {res.days !== null && (
              <span className={`text-xs font-medium ${daysColor}`}>
                {res.days >= 0 ? `متبقي ${res.days} يوم` : `منتهية منذ ${Math.abs(res.days)} يوم`}
              </span>
            )}
          </div>
        ) : emptyCell,
      )}
    </td>
  );
}

function renderSponsorshipCell(ctx: CellContext): React.ReactNode {
  const { emp, permissions, saveField, setStatusDate, setStatusDateDialog } = ctx;
  return (
    <td key="sponsorship_status" className="ta-td">
      {permissions.can_edit ? (
        <InlineSelectEditor
          value={emp.sponsorship_status || "not_sponsored"}
          options={SPONSORSHIP_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
          onSave={(nextValue) => {
            if (nextValue === "absconded" || nextValue === "terminated") {
              setStatusDate(todayISO());
              setStatusDateDialog({ emp, newStatus: nextValue, label: nextValue === "absconded" ? "هروب" : "انتهاء الخدمة" });
              return Promise.resolve();
            }
            return saveField(emp.id, "sponsorship_status", nextValue);
          }}
          renderDisplay={() => <SponsorBadge status={emp.sponsorship_status} />}
        />
      ) : (
        <SponsorBadge status={emp.sponsorship_status} />
      )}
    </td>
  );
}

function renderProbationCell(ctx: CellContext): React.ReactNode {
  const { emp, renderEditableDate, formatDateCell, emptyCell } = ctx;
  const probDays = emp.probation_end_date ? differenceInDays(parseISO(emp.probation_end_date), new Date()) : null;
  return (
    <td key="probation_end_date" className="ta-td">
      {renderEditableDate(emp.id, "probation_end_date", emp.probation_end_date,
        emp.probation_end_date ? (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs text-muted-foreground">{formatDateCell(emp.probation_end_date)}</span>
            {probDays !== null && (
              <span className={`text-xs font-medium ${probationColor(probDays)}`}>
                {probDays < 0 ? "انتهت" : `متبقي ${probDays} يوم`}
              </span>
            )}
          </div>
        ) : emptyCell,
      )}
    </td>
  );
}

function renderExpiryDateCell(key: string, field: string, ctx: CellContext): React.ReactNode {
  const { emp, renderEditableDate, formatDateCell, emptyCell } = ctx;
  const expiry = emp[field as keyof Employee] as string | null;
  const days = expiry ? differenceInDays(parseISO(expiry), new Date()) : null;
  const color = dayColorByThreshold(days);
  const label = key === "health_insurance_expiry"
    ? { remaining: "متبقي", expired: "منتهي منذ" }
    : { remaining: "متبقي", expired: "منتهية منذ" };
  return (
    <td key={key} className="ta-td">
      {renderEditableDate(emp.id, field, expiry,
        expiry ? (
          <div className="flex flex-col items-center gap-0.5">
            <span className={`text-xs ${color}`}>{formatDateCell(expiry)}</span>
            {days !== null && (
              <span className={`text-[10px] ${color}`}>
                {days < 0 ? `${label.expired} ${Math.abs(days)} يوم` : `${label.remaining} ${days} يوم`}
              </span>
            )}
          </div>
        ) : emptyCell,
      )}
    </td>
  );
}

function renderActionsCell(ctx: CellContext): React.ReactNode {
  const { emp, permissions, setSelectedEmployee, setEditEmployee, setShowAddModal, setDeleteEmployee } = ctx;
  return (
    <td key="actions" className="ta-td">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground">⋮</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setSelectedEmployee(emp.id)}>
            <Eye size={14} className="me-2" /> عرض الملف
          </DropdownMenuItem>
          {permissions.can_edit && (
            <DropdownMenuItem onClick={() => { setEditEmployee(emp); setShowAddModal(true); }}>
              <Edit size={14} className="me-2" /> تعديل البيانات
            </DropdownMenuItem>
          )}
          {permissions.can_delete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setDeleteEmployee(emp)} className="text-destructive focus:text-destructive">
                <Trash2 size={14} className="me-2" /> حذف الموظف
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </td>
  );
}

function renderJobTitleCell(ctx: CellContext): React.ReactNode {
  const { emp, permissions, uniqueVals, buildTextOptions, renderTextValue, saveField } = ctx;
  const options = [{ value: "", label: "بدون تحديد" }, ...buildTextOptions(uniqueVals.job_title, emp.job_title)];
  return (
    <td key="job_title" className="ta-td">
      {permissions.can_edit ? (
        <InlineSelectEditor value={emp.job_title || ""} options={options} onSave={(nextValue) => saveField(emp.id, "job_title", nextValue)} renderDisplay={() => renderTextValue(emp.job_title)} />
      ) : renderTextValue(emp.job_title)}
    </td>
  );
}

function renderCityCell(ctx: CellContext): React.ReactNode {
  const { emp, permissions, cityOptions, saveField } = ctx;
  const onSaveCities = (nextValues: string[]) => {
    const ordered = cityOptions.map((o) => o.value).filter((v) => nextValues.includes(v));
    return saveField(emp.id, "city", ordered[0] ?? "", { cities: ordered });
  };
  return (
    <td key="city" className="ta-td">
      {permissions.can_edit ? (
        <InlineMultiSelectEditor values={getEmployeeCities(emp)} options={cityOptions} onSave={onSaveCities} renderDisplay={() => <CityBadges cities={emp.cities} city={emp.city} />} />
      ) : <CityBadges cities={emp.cities} city={emp.city} />}
    </td>
  );
}

function renderNationalityCell(ctx: CellContext): React.ReactNode {
  const { emp, permissions, uniqueVals, buildTextOptions, renderTextValue, saveField } = ctx;
  const options = [{ value: "", label: "بدون تحديد" }, ...buildTextOptions(uniqueVals.nationality, emp.nationality)];
  return (
    <td key="nationality" className="ta-td">
      {permissions.can_edit ? (
        <InlineSelectEditor value={emp.nationality || ""} options={options} onSave={(nextValue) => saveField(emp.id, "nationality", nextValue)} renderDisplay={() => renderTextValue(emp.nationality)} />
      ) : renderTextValue(emp.nationality)}
    </td>
  );
}

function renderCommercialRecordCell(ctx: CellContext): React.ReactNode {
  const { emp, permissions, commercialRecordNames, buildTextOptions, renderTextValue, saveField } = ctx;
  const options = [{ value: "", label: "بدون تحديد" }, ...buildTextOptions(commercialRecordNames, emp.commercial_record)];
  return (
    <td key="commercial_record" className="ta-td">
      {permissions.can_edit ? (
        <InlineSelectEditor value={emp.commercial_record || ""} options={options} onSave={(nextValue) => saveField(emp.id, "commercial_record", nextValue)} renderDisplay={() => renderTextValue(emp.commercial_record)} />
      ) : renderTextValue(emp.commercial_record)}
    </td>
  );
}

function renderEmployeeProfessionalCell(ctx: CellContext): React.ReactNode {
  switch (ctx.col.key) {
    case "job_title": return renderJobTitleCell(ctx);
    case "city": return renderCityCell(ctx);
    case "nationality": return renderNationalityCell(ctx);
    case "platform_apps": return renderPlatformAppsCell(ctx);
    case "commercial_record": return renderCommercialRecordCell(ctx);
    default: return null;
  }
}

function renderEmployeeStatusCell(ctx: CellContext): React.ReactNode {
  const { col, emp, permissions, saveField } = ctx;
  switch (col.key) {
    case "residency_combined": return renderResidencyCell(ctx);
    case "sponsorship_status": return renderSponsorshipCell(ctx);
    case "status": return (
      <td key="status" className="ta-td">
        {permissions.can_edit ? (
          <InlineSelectEditor value={emp.status || "active"} options={STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label }))} onSave={(nextValue) => saveField(emp.id, "status", nextValue)} renderDisplay={() => <StatusBadge status={emp.status} />} />
        ) : <StatusBadge status={emp.status} />}
      </td>
    );
    case "license_status": return (
      <td key="license_status" className="ta-td">
        {permissions.can_edit ? (
          <InlineSelectEditor value={emp.license_status || "no_license"} options={LICENSE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))} onSave={(nextValue) => saveField(emp.id, "license_status", nextValue)} renderDisplay={() => <LicenseBadge status={emp.license_status} />} />
        ) : <LicenseBadge status={emp.license_status} />}
      </td>
    );
    default: return null;
  }
}

function renderEmployeeDatesCell(ctx: CellContext): React.ReactNode {
  const { col, emp, renderEditableDate, formatDateCell, emptyCell, renderTextValue } = ctx;
  switch (col.key) {
    case "join_date": return <td key="join_date" className="ta-td">{renderEditableDate(emp.id, "join_date", emp.join_date, emp.join_date ? renderTextValue(formatDateCell(emp.join_date), { dir: "ltr" }) : emptyCell)}</td>;
    case "birth_date": return <td key="birth_date" className="ta-td">{renderEditableDate(emp.id, "birth_date", emp.birth_date, emp.birth_date ? renderTextValue(formatDateCell(emp.birth_date), { dir: "ltr" }) : emptyCell)}</td>;
    case "probation_end_date": return renderProbationCell(ctx);
    case "health_insurance_expiry": return renderExpiryDateCell("health_insurance_expiry", "health_insurance_expiry", ctx);
    case "license_expiry": return renderExpiryDateCell("license_expiry", "license_expiry", ctx);
    default: return null;
  }
}

export function renderEmployeeCell(ctx: CellContext): React.ReactNode {
  const { col, emp, renderTextValue, renderEditableTextCell, emptyCell } = ctx;
  switch (col.key) {
    case "seq": return renderSeqCell(ctx);
    case "name": return renderNameCell(ctx);
    case "name_en": return <td key="name_en" className="ta-td" dir="ltr">{renderEditableTextCell(emp.id, "name_en", emp.name_en, { dir: "ltr", placeholder: "الاسم بالإنجليزية" })}</td>;
    case "national_id": return <td key="national_id" className="ta-td" dir="ltr">{renderTextValue(emp.national_id, { dir: "ltr", className: "tabular-nums" })}</td>;
    case "phone": return <td key="phone" className="ta-td" dir="ltr">{renderEditableTextCell(emp.id, "phone", emp.phone, { dir: "ltr", placeholder: "رقم الهاتف" })}</td>;
    case "email": return (
      <td key="email" className="ta-td" dir="ltr">
        {emp.email ? <a href={`mailto:${emp.email}`} className="text-primary hover:underline text-sm">{emp.email}</a> : emptyCell}
      </td>
    );
    case "job_title":
    case "city":
    case "nationality":
    case "platform_apps":
    case "commercial_record":
      return renderEmployeeProfessionalCell(ctx);
    case "residency_combined":
    case "sponsorship_status":
    case "status":
    case "license_status":
      return renderEmployeeStatusCell(ctx);
    case "join_date":
    case "birth_date":
    case "probation_end_date":
    case "health_insurance_expiry":
    case "license_expiry":
      return renderEmployeeDatesCell(ctx);
    case "bank_account_number": return <td key="bank_account_number" className="ta-td" dir="ltr">{renderTextValue(emp.bank_account_number, { dir: "ltr", className: "tabular-nums" })}</td>;
    case "actions": return renderActionsCell(ctx);
    default: return <td key={(col as { key: string }).key} className="ta-td">{EMPTY_DATA_PLACEHOLDER}</td>;
  }
}
