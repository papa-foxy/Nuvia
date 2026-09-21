'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';

export interface NuviaBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string; // e.g. 'max-w-lg', 'max-w-md'
  showGrabHandle?: boolean;
  contentClassName?: string;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

export function NuviaBottomSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  headerAction,
  children,
  maxWidth = 'max-w-md sm:max-w-lg',
  showGrabHandle = true,
  contentClassName = '',
  triggerRef,
}: NuviaBottomSheetProps) {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isEntering, setIsEntering] = useState(true);

  const startYRef = useRef(0);
  const currentDragYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

  currentDragYRef.current = dragY;

  // Track previous focused element for accessible restoration on close
  useEffect(() => {
    if (isOpen) {
      if (document.activeElement instanceof HTMLElement) {
        lastFocusedElementRef.current = document.activeElement;
      }
    }
  }, [isOpen]);

  // Lock body scroll while sheet is open to prevent background bleed-through
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      const originalTouchAction = document.body.style.touchAction;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';

      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.touchAction = originalTouchAction;
      };
    }
  }, [isOpen]);

  // Entrance animation trigger
  useEffect(() => {
    if (isOpen) {
      setIsEntering(true);
      setIsClosing(false);
      setDragY(0);
      setIsDragging(false);

      const timer = setTimeout(() => {
        setIsEntering(false);
      }, 20);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const triggerClose = useCallback(() => {
    setIsClosing(true);
    setIsDragging(false);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
      setDragY(0);

      // Restore focus to trigger element if available
      if (triggerRef?.current) {
        triggerRef.current.focus();
      } else if (lastFocusedElementRef.current) {
        lastFocusedElementRef.current.focus();
      }
    }, 220);
  }, [onClose, triggerRef]);

  // Keyboard accessibility: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        triggerClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, triggerClose]);

  // Touch handlers for drag-to-dismiss gesture
  const handleTouchStart = (e: React.TouchEvent, fromHeader = false) => {
    if (!fromHeader && scrollRef.current && scrollRef.current.scrollTop > 5) return;
    startYRef.current = e.touches[0].clientY;
    isDraggingRef.current = true;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent, fromHeader = false) => {
    if (!isDraggingRef.current) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - startYRef.current;

    if (delta > 0) {
      setDragY(delta);
    } else {
      if (!fromHeader) {
        isDraggingRef.current = false;
        setIsDragging(false);
        setDragY(0);
      } else {
        setDragY(0);
      }
    }
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    if (currentDragYRef.current > 75) {
      triggerClose();
    } else {
      setDragY(0);
    }
  };

  // Mouse handlers for desktop drag-down
  const handleMouseDown = (e: React.MouseEvent) => {
    startYRef.current = e.clientY;
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      const delta = e.clientY - startYRef.current;
      if (delta > 0) {
        setDragY(delta);
      } else {
        setDragY(0);
      }
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      if (currentDragYRef.current > 75) {
        triggerClose();
      } else {
        setDragY(0);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, triggerClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center p-0 pb-[calc(56px+env(safe-area-inset-bottom,0px))]"
    >
      {/* Backdrop: covers page background above bottom nav */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        style={{
          opacity: isClosing || isEntering ? 0 : Math.max(0.1, 1 - dragY / 300),
          transitionDuration: isDragging ? '0ms' : isEntering ? '300ms' : '220ms',
        }}
        onClick={triggerClose}
        aria-hidden="true"
      />

      {/* Sheet Container */}
      <div
        style={{
          transform:
            isClosing || isEntering
              ? 'translateY(100%)'
              : `translateY(${dragY}px)`,
          transition: isDragging
            ? 'none'
            : isEntering
            ? 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1)'
            : 'transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)',
        }}
        className={`relative w-full ${maxWidth} bg-[#161618] border-t border-x border-b-0 border-white/10 rounded-t-[28px] rounded-b-none max-h-[calc(100dvh-56px-env(safe-area-inset-bottom,0px)-0.5rem)] flex flex-col overflow-hidden shadow-2xl z-10 will-change-transform`}
      >
        {/* Grab Handle */}
        {showGrabHandle && (
          <div
            onTouchStart={(e) => handleTouchStart(e, true)}
            onTouchMove={(e) => handleTouchMove(e, true)}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            className="flex flex-col items-center justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing w-full touch-none select-none hover:bg-white/[0.02] transition-colors shrink-0"
          >
            <div className="w-12 h-1.5 rounded-full bg-white/30 hover:bg-white/50 transition-colors" />
          </div>
        )}

        {/* Modal Top Header (if title, subtitle, or headerAction provided) */}
        {(title || headerAction) && (
          <div
            onTouchStart={(e) => handleTouchStart(e, true)}
            onTouchMove={(e) => handleTouchMove(e, true)}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            className="flex items-center justify-between px-5 py-3 border-b border-white/5 cursor-grab active:cursor-grabbing touch-none select-none shrink-0"
          >
            <div className="flex-1 pr-2">
              {typeof title === 'string' ? (
                <h3 className="text-base font-bold text-white tracking-tight leading-snug">{title}</h3>
              ) : (
                title
              )}
              {subtitle && (
                typeof subtitle === 'string' ? (
                  <p className="text-[11px] text-[#8E8E93] mt-0.5">{subtitle}</p>
                ) : (
                  subtitle
                )
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {headerAction}
              <button
                type="button"
                onClick={triggerClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Content Area */}
        <div
          ref={scrollRef}
          onTouchStart={(e) => handleTouchStart(e, false)}
          onTouchMove={(e) => handleTouchMove(e, false)}
          onTouchEnd={handleTouchEnd}
          className={`flex-1 overflow-y-auto overscroll-contain px-5 py-4 ${contentClassName}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
