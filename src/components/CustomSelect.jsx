
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import "../styles/custom-select.css";

function CustomSelect({
  options = [],
  value,
  onChange,
  placeholder = "Select an option",
  disabled = false,
  className = "",
  ariaLabel = "Select an option",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  const selectedOption = options.find(
    (option) => option.value === value
  );

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleSelect = (option) => {
    if (option.disabled) return;

    onChange?.(option.value);
    setIsOpen(false);
  };

  return (
    <div
      ref={wrapperRef}
      className={`nova-select ${isOpen ? "open" : ""} ${className}`}
    >
      <button
        type="button"
        className="nova-select-trigger"
        onClick={() => setIsOpen((current) => !current)}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={!selectedOption ? "placeholder" : ""}>
          {selectedOption?.label || placeholder}
        </span>

        <ChevronDown
          size={17}
          className="nova-select-chevron"
        />
      </button>

      {isOpen && (
        <div className="nova-select-menu" role="listbox">
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                className={`nova-select-option ${
                  isSelected ? "selected" : ""
                }`}
                onClick={() => handleSelect(option)}
              >
                <span>{option.label}</span>

                {isSelected && <Check size={16} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CustomSelect;
