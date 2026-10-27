import { useEffect, useRef } from 'react';
import type React from 'react';
import { confirmAction } from '@/components/common/ConfirmModal';

/**
 * Close a modal by clicking (or tapping) outside it, without losing typed work.
 *
 * Spread `backdrop` on the full-screen overlay and `panel` on the dialog inside it. A press
 * that starts on the overlay itself closes the modal; one that starts inside the dialog
 * never does, even if the mouse is released outside (dragging to select text). Once anything
 * has been typed or picked in the dialog, closing asks first.
 *
 * @param open    whether the modal is showing (each opening starts clean)
 * @param onClose the modal's own close action
 */
export function useDismiss(open: boolean, onClose: () => void, options: { guard?: boolean } = {}) {
    const { guard = true } = options;
    const dirty = useRef(false);
    const asking = useRef(false);

    useEffect(() => {
        if (open) dirty.current = false;
    }, [open]);

    const dismiss = async () => {
        if (asking.current) return;
        if (guard && dirty.current) {
            asking.current = true;
            const discard = await confirmAction({
                title: 'Discard your changes?',
                message: "What you've entered hasn't been saved and will be lost.",
                confirmLabel: 'Discard',
                cancelLabel: 'Keep editing',
                tone: 'danger',
            });
            asking.current = false;
            if (!discard) return;
        }
        dirty.current = false;
        onClose();
    };

    return {
        dismiss,
        backdrop: {
            onMouseDown: (e: React.MouseEvent<HTMLElement>) => {
                if (e.target === e.currentTarget) dismiss();
            },
        },
        panel: {
            onInput: () => {
                dirty.current = true;
            },
            onChange: () => {
                dirty.current = true;
            },
        },
        /** Call after a successful save, so closing doesn't ask. */
        markSaved: () => {
            dirty.current = false;
        },
    };
}
