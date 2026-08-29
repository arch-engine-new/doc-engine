import { ref, type Ref } from "vue";
import type { EffectiveFieldBoxView } from "../../services/types";

export interface DraftBox {
  field_key: string;
  value_type: string;
  page: number;
  x: string;
  y: string;
  w: string;
  h: string;
}

/** Percent-based CSS positioning for FieldBox overlays on the annotate canvas. */
export function boxStyle(box: { x: string | number; y: string | number; w: string | number; h: string | number }) {
  return {
    left: `${box.x}%`,
    top: `${box.y}%`,
    width: `${box.w}%`,
    height: `${box.h}%`,
  };
}

/** Mouse-driven rectangle drawing for template extension FieldBoxes. */
export function useAnnotateCanvas(
  boxes: Ref<DraftBox[]>,
  nextKey: Ref<string>,
  nextType: Ref<string>,
  onDirty: () => void,
) {
  // Drag-to-draw ghost rectangle; commits a DraftBox when the pointer is released.
  const drawing = ref<{ x: number; y: number } | null>(null);
  const ghost = ref<{ x: number; y: number; w: number; h: number } | null>(null);

  function pct(ev: MouseEvent, axis: "x" | "y"): number {
    const el = ev.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const value =
      axis === "x" ? ((ev.clientX - rect.left) / rect.width) * 100 : ((ev.clientY - rect.top) / rect.height) * 100;
    return Math.max(0, Math.min(100, value));
  }

  function onDown(ev: MouseEvent) {
    drawing.value = { x: pct(ev, "x"), y: pct(ev, "y") };
    ghost.value = { x: drawing.value.x, y: drawing.value.y, w: 0, h: 0 };
  }

  function onMove(ev: MouseEvent) {
    if (!drawing.value) return;
    const x2 = pct(ev, "x");
    const y2 = pct(ev, "y");
    const x = Math.min(drawing.value.x, x2);
    const y = Math.min(drawing.value.y, y2);
    ghost.value = {
      x,
      y,
      w: Math.abs(x2 - drawing.value.x),
      h: Math.abs(y2 - drawing.value.y),
    };
  }

  function onUp() {
    if (ghost.value && ghost.value.w >= 2 && ghost.value.h >= 2) {
      boxes.value.push({
        field_key: nextKey.value.trim() || `field_${boxes.value.length + 1}`,
        value_type: nextType.value.trim() || "string",
        page: 1,
        x: ghost.value.x.toFixed(1),
        y: ghost.value.y.toFixed(1),
        w: ghost.value.w.toFixed(1),
        h: ghost.value.h.toFixed(1),
      });
      onDirty();
    }
    drawing.value = null;
    ghost.value = null;
  }

  function removeBox(index: number) {
    boxes.value.splice(index, 1);
    onDirty();
  }

  return { drawing, ghost, onDown, onMove, onUp, removeBox };
}
