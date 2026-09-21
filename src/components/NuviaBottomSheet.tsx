'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';

export type BottomSheetVariant = 'compact' | 'standard' | 'full';

export interface NuviaBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  variant?: BottomSheetVariant;
  maxWidth?: string; // e.g. 'max-w-md', 'max-w-lg'
  showGrabHandle?: boolean;
  contentClassName?: string;
  triggerRef?: React.RefObject<HTMLElement | null>;
  closeOnBackdropClick?: boolean;
  bottomGap?: number; // optional extra gap in px above bottom nav
}

export function NuviaBottomSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  headerAction,
  children,
  variant = 'standard',
  maxWidth = 'max-w-md',
  showGrabHandle,
  contentClassName = '',
  triggerRef,
  closeOnBackdropClick = true,
  bottomGap,
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

  // Variant defaults
  const isCompact = variant === 'compact';
  const isFull = variant === 'full';
  const shouldShowGrabHandle = showGrabHandle !== undefined ? showGrabHandle : !isCompact;
  const gapPx = bottomGap !== undefined ? bottomGap : isCompact ? 8 : 0;

  // Track previous focused element for accessible restoration on close
  useEffect(() => {
    if (isOpen) {
      if (document.activeElement instanceof HTMLElement) {
        lastFocusedElementRef.current = document.activeElement;
      }
    }
  }, [isOpen]);

  // Lock body scroll safely without breaking child scrolling
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      const originalOverscroll = document.body.style.overscrollBehavior;
      document.body.style.overflow = 'hidden';
      document.body.style.overscrollBehavior = 'none';

      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.overscrollBehavior = originalOverscroll;
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

  // Touch handlers for drag-to-dismiss
  const handleTouchStart = (e: React.TouchEvent, isHeader = false) => {
    if (isCompact) return; // Compact sheets are click-to-dismiss
    if (!isHeader && scrollRef.current && scrollRef.current.scrollTop > 5) {
      return;
    }
    isDraggingRef.current = true;
    setIsDragging(true);
    startYRef.current = e.touches[0].clientY - currentDragYRef.current;
  };

  const handleTouchMove = (e: React.TouchEvent, isHeader = false) => {
    if (!isDraggingRef.current) return;
    if (!isHeader && scrollRef.current && scrollRef.current.scrollTop > 5) {
      isDraggingRef.current = false;
      setIsDragging(false);
      return;
    }
    const touchY = e.touches[0].clientY;
    const delta = touchY - startYRef.current;
    if (delta > 0) {
      setDragY(delta);
    } else {
      setDragY(delta * 0.2); // Rubber-band effect upwards
    }
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);

    if (currentDragYRef.current > 120) {
      triggerClose();
    } else {
      setDragY(0);
    }
  };

  // Mouse drag handlers for desktop emulation
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isCompact) return;
    isDraggingRef.current = true;
    setIsDragging(true);
    startYRef.current = e.clientY - currentDragYRef.current;
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = e.clientY - startYRef.current;
      if (delta > 0) {
        setDragY(delta);
      } else {
        setDragY(delta * 0.2);
      }
    };

    const onMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);

      if (currentDragYRef.current > 120) {
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

  // Compute height styling based on variant
  const cardHeightStyle = isCompact
    ? 'h-auto max-h-[60vh]'
    : isFull
    ? 'h-[calc(100dvh-var(--bottom-nav-height,56px)-env(safe-area-inset-bottom,0px)-0.75rem)] flex flex-col'
    : 'h-auto max-h-[calc(100dvh-var(--bottom-nav-height,56px)-env(safe-area-inset-bottom,0px)-1.5rem)] flex flex-col';

  // Compute border and corner rounding based on variant
  const cardShapeStyle = isCompact
    ? 'rounded-3xl border border-white/15 bg-[#1C1C1E] shadow-2xl overflow-hidden'
    : 'rounded-t-[28px] rounded-b-none border-t border-x border-b-0 border-white/10 bg-[#161618] shadow-2xl overflow-hidden';

  const containerPadding = isCompact ? 'px-3 sm:px-0' : 'px-0';

  return (
    <>
      {/* 
        ── LAYER 2: BACKDROP ─────────────────────────────────────────────
        Covers the page content region exclusively.
        Terminates strictly at the top border of the bottom navigation bar.
        The bottom navigation (Layer 4) is NEVER covered, dimmed, or blurred.
      */}
      <div
        role="presentation"
        className="fixed md:absolute top-0 left-0 right-0 z-40 bg-black/75 backdrop-blur-sm transition-opacity"
        style={{
          bottom: `calc(var(--bottom-nav-height, 56px) + env(safe-area-inset-bottom, 0px))`,
          opacity: isClosing || isEntering ? 0 : Math.max(0.1, 1 - dragY / 300),
          transitionDuration: isDragging ? '0ms' : isEntering ? '280ms' : '200ms',
        }}
        onClick={closeOnBackdropClick ? triggerClose : undefined}
        aria-hidden="true"
      />

      {/* 
        ── LAYER 3: BOTTOM SHEET CONTAINER ──────────────────────────────
        Sits above the backdrop (z-45).
        Positioned right above the bottom navigation bar.
      */}
      <div
        role="dialog"
        aria-modal="true"
        className={`fixed md:absolute left-0 right-0 z-45 flex items-end justify-center pointer-events-none ${containerPadding}`}
        style={{
          bottom: `calc(var(--bottom-nav-height, 56px) + env(safe-area-inset-bottom, 0px) + ${gapPx}px)`,
        }}
      >
        {/* Sheet Card */}
        <div
          onClick={(e) => e.stopPropagation()}
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
          className={`pointer-events-auto relative w-full ${maxWidth} ${cardShapeStyle} ${cardHeightStyle} z-10 will-change-transform select-none sm:select-auto`}
        >
          {/* Grab Handle */}
          {shouldShowGrabHandle && (
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

          {/* Modal Header */}
          {(title || headerAction) && (
            <div
              onTouchStart={(e) => handleTouchStart(e, true)}
              onTouchMove={(e) => handleTouchMove(e, true)}
              onTouchEnd={handleTouchEnd}
              onMouseDown={handleMouseDown}
              className="flex items-center justify-between px-5 py-3.5 border-b border-white/5 cursor-grab active:cursor-grabbing touch-none select-none shrink-0"
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
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Content Area */}
          <div
            ref={scrollRef}
            onTouchStart={(e) => handleTouchStart(e, false)}
            onTouchMove={(e) => handleTouchMove(e, false)}
            onTouchEnd={handleTouchEnd}
            className={`overflow-y-auto overscroll-contain ${isCompact ? 'p-4' : 'flex-1 px-5 py-4'} ${contentClassName}`}
          >
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
