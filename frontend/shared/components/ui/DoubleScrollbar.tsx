import React, { useRef, useEffect, ReactNode } from 'react';

export function DoubleScrollbar({ children, className = '' }: { children: ReactNode; className?: string }) {
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const top = topScrollRef.current;
    const bottom = bottomScrollRef.current;
    const content = contentRef.current;
    
    if (!top || !bottom || !content) return;

    let isSyncingLeft = false;
    let isSyncingRight = false;

    const syncTop = () => {
      if (!isSyncingLeft) {
        isSyncingRight = true;
        top.scrollLeft = bottom.scrollLeft;
      }
      isSyncingLeft = false;
    };

    const syncBottom = () => {
      if (!isSyncingRight) {
        isSyncingLeft = true;
        bottom.scrollLeft = top.scrollLeft;
      }
      isSyncingRight = false;
    };

    const updateWidth = () => {
      // Find the actual scrollable content width.
      // Usually it's the table inside the contentRef
      const scrollWidth = content.scrollWidth;
      if (top.firstElementChild) {
        (top.firstElementChild as HTMLElement).style.width = `${scrollWidth}px`;
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      updateWidth();
    });

    if (content.firstElementChild) {
      resizeObserver.observe(content.firstElementChild);
    }
    resizeObserver.observe(content);

    top.addEventListener('scroll', syncBottom);
    bottom.addEventListener('scroll', syncTop);
    
    // Initial sync
    setTimeout(updateWidth, 100);

    return () => {
      top.removeEventListener('scroll', syncBottom);
      bottom.removeEventListener('scroll', syncTop);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className={`flex flex-col w-full ${className}`}>
      {/* Top Scrollbar */}
      <div 
        ref={topScrollRef} 
        className="overflow-x-auto overflow-y-hidden custom-scrollbar"
        style={{ height: '14px' }}
      >
        <div style={{ height: '1px' }} />
      </div>
      {/* Bottom Scrollbar + Content */}
      <div 
        ref={bottomScrollRef} 
        className="overflow-x-auto custom-scrollbar flex-1"
      >
        <div ref={contentRef} className="min-w-fit">
          {children}
        </div>
      </div>
    </div>
  );
}
