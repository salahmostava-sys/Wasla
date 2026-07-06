import type { ReactNode } from 'react';
import { Loader2, ExternalLink, Trash2 } from 'lucide-react';
import { useSignedUrl, extractStoragePath } from '@shared/hooks/useSignedUrl';
import { isImageDocument } from './employeeProfile.utils';
import { Button } from '@shared/components/ui/button';

export const SecureDocThumb = ({
  storagePath, label, onDelete
}: { storagePath: string | null | undefined; label: string; onDelete?: () => void }) => {
  const path = extractStoragePath(storagePath);
  const signedUrl = useSignedUrl('employee-documents', path);

  if (!path) return null;

  let thumb: ReactNode;
  if (signedUrl && isImageDocument(path)) {
    thumb = (
      <a href={signedUrl} target="_blank" rel="noreferrer" className="group">
        <img
          src={signedUrl}
          className="w-20 h-20 object-cover rounded-lg border border-border group-hover:opacity-80 transition-opacity"
          alt={label}
        />
      </a>
    );
  } else if (signedUrl) {
    thumb = (
      <a
        href={signedUrl}
        target="_blank"
        rel="noreferrer"
        className="w-20 h-20 rounded-lg border border-border bg-muted flex items-center justify-center text-2xl"
      >
        📄
      </a>
    );
  } else {
    thumb = (
      <div className="w-20 h-20 rounded-lg border border-border bg-muted flex items-center justify-center">
        <Loader2 size={16} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1 relative">
      {thumb}
      <p className="text-xs text-center text-muted-foreground">{label}</p>
      <div className="flex items-center gap-3">
        {signedUrl && (
          <a
            href={signedUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-0.5 text-[10px] text-primary hover:underline"
          >
            <ExternalLink size={9} /> فتح
          </a>
        )}
        {signedUrl && onDelete && (
          <button
            onClick={onDelete}
            className="flex items-center gap-0.5 text-[10px] text-destructive hover:underline"
          >
            <Trash2 size={9} /> حذف
          </button>
        )}
      </div>
    </div>
  );
};
