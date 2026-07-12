import { z } from 'zod';
import { useForm } from 'react-hook-form';
import {
  isValidEmployeeNationalId,
  isValidEmployeePhone,
} from '@modules/employees/model/employeeFieldValidation';

const phoneSchema = z
  .string()
  .trim()
  .min(1, 'رقم الهاتف مطلوب')
  .refine(isValidEmployeePhone, 'رقم هاتف غير صحيح');

const nationalIdSchema = z
  .string()
  .trim()
  .min(1, 'رقم الهوية مطلوب')
  .refine(isValidEmployeeNationalId, 'رقم هوية غير صحيح (10 أرقام)');

export const employeeFormSchema = z
  .object({
    name: z.string().trim().min(2, 'الاسم مطلوب'),
    name_en: z.string().trim().optional().or(z.literal('')),
    job_title: z.string().trim().optional().or(z.literal('')),
    phone: phoneSchema,
    email: z.string().trim().email('بريد غير صحيح').optional().or(z.literal('')),
    national_id: nationalIdSchema,
    nationality: z.string().trim().optional().or(z.literal('')),
    commercial_record: z.string().trim().optional().or(z.literal('')),
    bank_account_number: z.string().trim().optional().or(z.literal('')),
    cities: z.array(z.string().trim().min(1)).default([]),
    join_date: z.string().optional().or(z.literal('')),
    birth_date: z.string().optional().or(z.literal('')),
    residency_expiry: z.string().trim().min(1, 'تاريخ انتهاء الإقامة مطلوب'),
    health_insurance_expiry: z.string().optional().or(z.literal('')),
    license_expiry: z.string().optional().or(z.literal('')),
    probation_end_date: z.string().optional().or(z.literal('')),
    probation_days: z.string().optional().or(z.literal('')),
    license_status: z.enum(['has_license', 'no_license', 'applied']),
    sponsorship_status: z.enum(['sponsored', 'not_sponsored', 'absconded', 'terminated']),
    status: z.enum(['active', 'inactive', 'ended']).default('active'),
    preferred_language: z.enum(['ar', 'en']).default('ar'),
  });

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

export async function validateEmployeeStep(
  step: number,
  trigger: ReturnType<typeof useForm<EmployeeFormValues>>['trigger']
) {
  if (step === 0) return await trigger(['name', 'phone', 'national_id']);
  if (step === 1) return await trigger(['residency_expiry']);
  return true;
}
