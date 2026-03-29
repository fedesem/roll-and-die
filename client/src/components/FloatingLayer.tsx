import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface FloatingAnchor {
  left: number;
  top: number;
  width: number;
  height: number;
}

type FloatingPlacement = "top-start" | "bottom-start";

interface FloatingLayerProps {
  anchor: FloatingAnchor | null;
  children: ReactNode;
  className?: string;
  placement?: FloatingPlacement;
  offset?: number;
  margin?: number;
  zIndex?: number;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
}

export function anchorFromRect(rect: Pick<DOMRect, "left" | "top" | "width" | "height">): FloatingAnchor {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  };
}

export function FloatingLayer({
  anchor,
  children,
  className,
  placement = "top-start",
  offset = 10,
  margin = 12,
  zIndex = 2147483000,
  onPointerEnter,
  onPointerLeave
}: FloatingLayerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<CSSProperties>({
    position: "fixed",
    left: margin,
    top: margin,
    visibility: "hidden",
    zIndex
  });

  useLayoutEffect(() => {
    if (!anchor || !panelRef.current || typeof window === "undefined") {
      return;
    }

    const panelRect = panelRef.current.getBoundingClientRect();
    const maxLeft = Math.max(margin, window.innerWidth - panelRect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - panelRect.height - margin);
    const preferredLeft = anchor.left;
    const topStart = anchor.top - panelRect.height - offset;
    const bottomStart = anchor.top + anchor.height + offset;
    const shouldUseTop =
      placement === "top-start"
        ? topStart >= margin || window.innerHeight - bottomStart < topStart - margin
        : !(bottomStart <= maxTop || anchor.top - offset - panelRect.height < margin);

    setStyle({
      position: "fixed",
      left: Math.min(Math.max(margin, preferredLeft), maxLeft),
      top: shouldUseTop ? Math.min(Math.max(margin, topStart), maxTop) : Math.min(Math.max(margin, bottomStart), maxTop),
      visibility: "visible",
      zIndex
    });
  }, [anchor, margin, offset, placement, zIndex, children]);

  useEffect(() => {
    if (!anchor || typeof window === "undefined") {
      return;
    }

    const syncPosition = () => {
      if (!panelRef.current) {
        return;
      }

      const panelRect = panelRef.current.getBoundingClientRect();
      const maxLeft = Math.max(margin, window.innerWidth - panelRect.width - margin);
      const maxTop = Math.max(margin, window.innerHeight - panelRect.height - margin);
      const preferredLeft = anchor.left;
      const topStart = anchor.top - panelRect.height - offset;
      const bottomStart = anchor.top + anchor.height + offset;
      const shouldUseTop =
        placement === "top-start"
          ? topStart >= margin || window.innerHeight - bottomStart < topStart - margin
          : !(bottomStart <= maxTop || anchor.top - offset - panelRect.height < margin);

      setStyle({
        position: "fixed",
        left: Math.min(Math.max(margin, preferredLeft), maxLeft),
        top: shouldUseTop ? Math.min(Math.max(margin, topStart), maxTop) : Math.min(Math.max(margin, bottomStart), maxTop),
        visibility: "visible",
        zIndex
      });
    };

    window.addEventListener("resize", syncPosition);
    window.addEventListener("scroll", syncPosition, true);
    return () => {
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("scroll", syncPosition, true);
    };
  }, [anchor, margin, offset, placement, zIndex]);

  if (!anchor || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div ref={panelRef} className={className} style={style} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
      {children}
    </div>,
    document.body
  );
}
