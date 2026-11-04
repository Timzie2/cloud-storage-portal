import { Palette, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const COLORS = [
  "#000000", "#434343", "#666666", "#999999", "#B7B7B7", "#FFFFFF",
  "#F44336", "#E91E63", "#9C27B0", "#673AB7", "#3F51B5", "#2196F3",
  "#03A9F4", "#00BCD4", "#009688", "#4CAF50", "#8BC34A", "#CDDC39",
  "#FFEB3B", "#FFC107", "#FF9800", "#FF5722", "#795548", "#607D8B",
];

export default function ColorPicker({
  label,
  type,
  defaultColor,
  onSelect,
}) {
  const [open, setOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState(defaultColor);
  const [menuPosition, setMenuPosition] = useState({
  top: 0,
  left: 12,
});

  const applyColor = (color) => {
    setSelectedColor(color);
    onSelect(color);
    setOpen(false);
  };

  const pickerRef = useRef(null);

useEffect(() => {
  const handleOutsideClick = (event) => {
    if (
      pickerRef.current &&
      !pickerRef.current.contains(event.target)
    ) {
      setOpen(false);
    }
  };

  const handleEscape = (event) => {
    if (event.key === "Escape") {
      setOpen(false);
    }
  };

  document.addEventListener("pointerdown", handleOutsideClick);
  document.addEventListener("keydown", handleEscape);

  return () => {
    document.removeEventListener("pointerdown", handleOutsideClick);
    document.removeEventListener("keydown", handleEscape);
  };
}, []);

const togglePicker = () => {
  if (!open) {
    const trigger = pickerRef.current?.querySelector(
      ".nova-color-picker-trigger"
    );

    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      const menuWidth = Math.min(235, window.innerWidth - 24);

      const left = Math.max(
        12,
        Math.min(rect.left, window.innerWidth - menuWidth - 12)
      );

      setMenuPosition({
        top: rect.bottom + 8,
        left,
      });
    }
  }

  setOpen((previous) => !previous);
};

  return (
    <div className="nova-color-picker" ref={pickerRef}>
      <button
        type="button"
        className="nova-color-picker-trigger"
        title={label}
        aria-label={label}
        aria-expanded={open}
        onMouseDown={(event) => event.preventDefault()}
        onClick={togglePicker}
      >
        {type === "text" ? (
          <span className="nova-color-letter">A</span>
        ) : (
          <Palette size={17} />
        )}

        <span
          className="nova-color-indicator"
          style={{ backgroundColor: selectedColor }}
        />

        <ChevronDown size={12} />
      </button>

      {open && (
  <div
    className="nova-color-picker-menu"
    style={{
      top: `${menuPosition.top}px`,
      left: `${menuPosition.left}px`,
    }}
  >
          <strong>{label}</strong>

          <div className="nova-color-grid">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                title={color}
                aria-label={`Choose ${color}`}
                className={
                  selectedColor === color ? "selected" : ""
                }
                style={{ backgroundColor: color }}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyColor(color)}
              />
            ))}
          </div>

          <label className="nova-custom-color">
            <span>Custom colour</span>
            <input
              type="color"
              value={selectedColor}
              onChange={(event) => applyColor(event.target.value)}
            />
          </label>
        </div>
      )}
    </div>
  );
}
