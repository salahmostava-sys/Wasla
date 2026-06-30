import React, { useRef, useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { Label } from '@shared/components/ui/label';
import { useSignedUrl, extractStoragePath } from '@shared/hooks/useSignedUrl';
import { cn } from '@shared/lib/utils';
import { isImageDocument, STEPS, UploadStatus } from './addEmployee.types';

export const SectionTitle = ({ title }: { title: string }) => (
  <div className="flex items-center gap-3 mb-5">
    <span className="text-sm font-bold text-foreground">{title}</span>
    <div className="flex-1 h-px bg-border" />
  </div>
);

export const F = ({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) => (
  <div>
    <Label className="text-sm mb-1.5 block text-foreground/80">
      {label} {required && <span className="text-destructive">*</span>}
    </Label>
    {children}
    {error && <p className="text-xs text-destructive mt-1">{error}</p>}
  </div>
);

export function StepIndicator({ step }: Readonly<{ step: number }>) {
  return (
    <div className="flex items-center gap-0 px-6 pt-4 pb-2 shrink-0">
      {STEPS.map((s, i) => {
        const isDone = i < step;
        const isCurrent = i === step;
        let stateClass = 'bg-muted text-muted-foreground';
        if (isDone) stateClass = 'bg-success text-success-foreground';
        else if (isCurrent) stateClass = 'bg-primary text-primary-foreground';
        return (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors', stateClass)}>
                {isDone ? <Check size={12} /> : i + 1}
              </div>
              <span className={`text-xs hidden sm:block ${isCurrent ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>{s}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-2 ${isDone ? 'bg-success' : 'bg-border'}`} />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Secure Upload Area — uses signed URLs for existing private docs ──────────
export const UploadArea = ({ label, icon, file, existingStoragePath, onFile, onRemove, status, errorText }: {
  label: string; icon: string; file: File | null; existingStoragePath?: string | null;
  onFile: (f: File) => void; onRemove: () => void;
  status?: UploadStatus;
  errorText?: string | null;
}) => {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  // Generate a signed URL for existing document (private bucket)
  const storagePath = extractStoragePath(existingStoragePath);
  const signedUrl = useSignedUrl('employee-documents', storagePath);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };

  const hasContent = file || existingStoragePath;
  let previewNode: React.ReactNode = null;
  if (file) {
    const isImageFile = isImageDocument(file.name, file.type);
    previewNode = isImageFile
      ? <img src={URL.createObjectURL(file)} className="w-16 h-16 object-cover rounded-lg mx-auto" alt="" />
      : <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mx-auto text-2xl">📄</div>;
  } else if (signedUrl) {
    previewNode = isImageDocument(existingStoragePath)
      ? <img src={signedUrl} className="w-16 h-16 object-cover rounded-lg mx-auto" alt="" />
      : <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mx-auto text-2xl">📄</div>;
  } else if (existingStoragePath) {
    previewNode = <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mx-auto text-xl">📄</div>;
  }

  const statusBadge = (() => {
    if (status === 'uploading') return <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">جاري الرفع...</span>;
    if (status === 'uploaded') return <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success">تم الرفع</span>;
    if (status === 'selected') return <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/10 text-warning">جاهز للرفع</span>;
    if (status === 'error') return <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">فشل الرفع</span>;
    return null;
  })();

  return (
    <div className="flex-1 min-w-[130px]">
      <button
        type="button"
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${drag ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
        onClick={() => ref.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            ref.current?.click();
          }
        }}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
      >
        <input ref={ref} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" className="hidden" onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
        {hasContent ? (
          <div className="space-y-1">
            {previewNode}
            <p className="text-xs text-foreground truncate max-w-[120px] mx-auto">{file ? file.name : 'مرفوع مسبقاً 🔒'}</p>
            {statusBadge}
            <button type="button" onClick={e => { e.stopPropagation(); onRemove(); }} className="text-xs text-destructive hover:underline flex items-center gap-1 mx-auto">
              <Trash2 size={10} /> حذف
            </button>
          </div>
        ) : (
          <>
            <div className="text-3xl mb-2">{icon}</div>
            <p className="text-xs font-medium text-foreground/70">{label}</p>
            <p className="text-[10px] text-muted-foreground mt-1">اضغط للرفع أو اسحب هنا</p>
            <p className="text-[10px] text-muted-foreground">JPG, PNG, WEBP, PDF — 5MB</p>
          </>
        )}
      </button>
      {errorText && <p className="text-[11px] text-destructive mt-1">{errorText}</p>}
    </div>
  );
}
