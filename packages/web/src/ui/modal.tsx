import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./icon";
import { Button } from "./button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: number;
}

export function Modal({ open, onClose, title, children, width = 420 }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div ref={overlayRef} onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0, 0, 0, 0.45)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24, animation: "zs-fade-in .15s var(--ease)",
      }}>
      <div style={{
        width: "100%", maxWidth: width, maxHeight: "80vh",
        background: "var(--bg-0)", border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)", boxShadow: "var(--shadow)",
        display: "flex", flexDirection: "column", overflow: "hidden",
        animation: "zs-scale-in .15s var(--ease)",
      }}>
        {title && (
          <div className="flex shrink-0 items-center" style={{
            padding: "14px 18px", borderBottom: "1px solid var(--border)",
            gap: 10,
          }}>
            <span style={{ fontSize: "var(--fs-base)", fontWeight: 700, color: "var(--text-0)", flex: 1 }}>{title}</span>
            <button onClick={onClose} style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: "var(--text-3)", padding: 2, display: "flex",
            }}>
              <Icon name="x" size={16} />
            </button>
          </div>
        )}
        <div style={{ padding: 18, overflow: "auto", flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

export function ConfirmModal({ open, onClose, onConfirm, title = "Confirm", message, confirmLabel = "Confirm", danger }: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={380}>
      <p style={{ margin: "0 0 18px", color: "var(--text-1)", fontSize: "var(--fs-sm)", lineHeight: 1.5 }}>{message}</p>
      <div className="flex justify-end" style={{ gap: 8 }}>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? "danger" : "default"} size="sm" onClick={() => { onConfirm(); onClose(); }}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
