import React, { useState, useRef, useEffect } from 'react';
import { Clock, LayoutGrid } from 'lucide-react';

/**
 * Mobile Draggable Navigator Floating Pill Widget
 * Scope: Renders a floating, vertically draggable compact widget on mobile (right edge).
 * Tapping it opens the Mobile Question Navigator Drawer.
 */
export function MobileDraggableNavigatorWidget({
  onOpenDrawer,
  answeredCount = 0,
  totalCount = 0,
  timeStr = '00:00',
  isDarkMode = false
}) {
  const [topY, setTopY] = useState(240);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startTopYRef = useRef(240);

  // Initialize topY position to 35% of screen height
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setTopY(Math.round(window.innerHeight * 0.35));
    }
  }, []);

  const handlePointerDown = (clientY) => {
    isDraggingRef.current = false;
    startYRef.current = clientY;
    startTopYRef.current = topY;
  };

  const handlePointerMove = (clientY) => {
    const deltaY = clientY - startYRef.current;
    if (Math.abs(deltaY) > 5) {
      isDraggingRef.current = true;
      const windowH = typeof window !== 'undefined' ? window.innerHeight : 800;
      const newTop = Math.max(70, Math.min(windowH - 180, startTopYRef.current + deltaY));
      setTopY(newTop);
    }
  };

  const handlePointerUp = () => {
    if (!isDraggingRef.current) {
      if (onOpenDrawer) onOpenDrawer();
    }
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
  };

  // Touch Event Handlers
  const handleTouchStart = (e) => {
    if (e.touches.length > 0) {
      handlePointerDown(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length > 0) {
      handlePointerMove(e.touches[0].clientY);
    }
  };

  const handleTouchEnd = () => {
    handlePointerUp();
  };

  // Mouse Event Handlers
  const handleMouseDown = (e) => {
    e.preventDefault();
    handlePointerDown(e.clientY);

    const onMouseMove = (moveEvt) => {
      handlePointerMove(moveEvt.clientY);
    };

    const onMouseUp = () => {
      handlePointerUp();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      style={{ top: `${topY}px` }}
      aria-label="Open Question Navigator"
      role="button"
      tabIndex={0}
      className={`fixed right-0 z-40 w-14 py-3.5 px-1.5 rounded-l-2xl border shadow-lg flex flex-col items-center gap-3 cursor-grab active:cursor-grabbing select-none touch-none transition-shadow lg:hidden ${
        isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-100 shadow-black/50' : 'bg-white border-slate-200 text-slate-900 shadow-slate-300/60'
      }`}
    >
      {/* Clock icon + timer text */}
      <div className="flex flex-col items-center gap-0.5 text-center">
        <Clock className="w-4 h-4 text-slate-600 dark:text-slate-400" />
        <span className="text-[10px] font-extrabold tracking-tight" style={{ color: isDarkMode ? '#ffffff' : '#0f172a' }}>
          {timeStr ? timeStr.split(':').slice(-2).join(':') : '00:00'}
        </span>
      </div>

      {/* Circle progress ring / fraction count */}
      <div className="flex flex-col items-center justify-center text-center">
        <div className="w-7 h-7 rounded-full border-2 border-blue-500 flex items-center justify-center bg-white shadow-xs">
          <span className="text-[10px] font-black text-blue-600">
            {answeredCount}
          </span>
        </div>
        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-1">
          {answeredCount}/{totalCount}
        </span>
      </div>

      {/* Grid icon */}
      <div className="p-1 text-blue-600 dark:text-blue-400">
        <LayoutGrid className="w-4.5 h-4.5" />
      </div>
    </div>
  );
}
