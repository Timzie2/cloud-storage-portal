import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import { createPortal } from "react-dom";
import {
  ArrowLeft, Upload, ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
  FileText, MousePointer2, Hand, Highlighter, Underline, Strikethrough,
  Type, Pencil, Square, Circle, ArrowUpRight, Eraser, Users,
  MessageSquare, MoreVertical, SlidersHorizontal, CheckCircle2,
  Download, Printer, Undo2, Redo2,
RotateCw, RotateCcw,
} from "lucide-react";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "../styles/pdf.css";

import {
  saveNewPdfToMyFiles,
  renameFile,
} from "../services/files";
import { useAuth } from "../context/AuthContext";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const annotationTools = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "hand", label: "Hand tool", icon: Hand },
  { id: "highlight", label: "Highlight", icon: Highlighter },
  { id: "underline", label: "Underline", icon: Underline },
  { id: "strike", label: "Strikethrough", icon: Strikethrough },
  { id: "text", label: "Add text", icon: Type },
  { id: "draw", label: "Draw", icon: Pencil },
  { id: "rectangle", label: "Rectangle", icon: Square },
  { id: "circle", label: "Circle", icon: Circle },
  { id: "arrow", label: "Arrow", icon: ArrowUpRight },
  { id: "eraser", label: "Eraser", icon: Eraser },
];

const textTools = ["highlight", "underline", "strike"];
const drawingTools = ["draw", "rectangle", "circle", "arrow"];

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

function pdfColor(hex) {
  const value = hex.replace("#", "");
  const normalized = value.length === 3
    ? value.split("").map((char) => char + char).join("")
    : value;

  const number = parseInt(normalized, 16);

  return rgb(
    ((number >> 16) & 255) / 255,
    ((number >> 8) & 255) / 255,
    (number & 255) / 255
  );
}

function PDF() {
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = location.state?.from || "/office";
  const returnLabel = returnTo.startsWith("/files")
    ? "My Files"
    : returnTo.startsWith("/shared")
      ? "Shared"
      : "Office";

  const [file, setFile] = useState(() => location.state?.pendingPdfFile || null);
  const [fileName, setFileName] = useState(
    () => location.state?.fileName || location.state?.pendingPdfFile?.name || ""
  );
  const [sourceFileId, setSourceFileId] = useState(
  () => location.state?.sourceFileId || null
);

const [isRenaming, setIsRenaming] = useState(false);
const [renameInput, setRenameInput] = useState("");
const [isRenamingSaving, setIsRenamingSaving] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(Boolean(location.state?.pendingPdfFile));
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageOrder, setPageOrder] = useState([]);
  const [draggedPage, setDraggedPage] = useState(null);
  const [pageRotations, setPageRotations] = useState({});
  const [originalPageRotations, setOriginalPageRotations] = useState({});
  const [scale, setScale] = useState(1);
  const [zoomMode, setZoomMode] = useState("custom");
  const [pdfDocument, setPdfDocument] = useState(null);
  const [viewerSize, setViewerSize] = useState({ width: 0, height: 0 });
  const [error, setError] = useState("");

  const [activeTool, setActiveTool] = useState("select");
  const [annotationColor, setAnnotationColor] = useState("#f5e642");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [annotations, setAnnotations] = useState([]);
  const [selectedText, setSelectedText] = useState("");
  const [selectionRects, setSelectionRects] = useState([]);
  const [draftShape, setDraftShape] = useState(null);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const { user } = useAuth();

  const [showComments, setShowComments] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isSavingAnnotatedPdf, setIsSavingAnnotatedPdf] = useState(false);
  const [comments, setComments] = useState([
    { id: 1, name: "Abiola", initial: "A", time: "2 hours ago", message: "Can we confirm the arrival check-in time?" },
    { id: 2, name: "You", initial: "N", time: "1 hour ago", message: "I've highlighted the restricted items for clarity." },
    { id: 3, name: "Temitope", initial: "T", time: "45 minutes ago", message: "Destination confirmed — Lagos (LOS).", resolved: true },
  ]);
  const [commentDraft, setCommentDraft] = useState("");
  const [showColorPalette, setShowColorPalette] = useState(false);
  const colorPopoverRef = useRef(null);
const colorTriggerRef = useRef(null);

const [colorPalettePosition, setColorPalettePosition] = useState({
  top: 0,
  left: 0,
});

const presetColors = [
  "#F5E642", // Yellow
  "#FF6B6B", // Red
  "#FF9F43", // Orange
  "#2ECC71", // Green
  "#00B8D9", // Cyan
  "#3498DB", // Blue
  "#8E44AD", // Purple
  "#FF69B4", // Pink
  "#222222", // Black
  "#FFFFFF", // White
];

  const pdfViewerRef = useRef(null);
  const pageContainerRef = useRef(null);
  const moreMenuRef = useRef(null);
  const colorPaletteRef = useRef(null);
  const drawingRef = useRef(false);
  const draftRef = useRef(null);
  const activePointerIdRef = useRef(null);

  const touchPageDragRef = useRef({
  pointerId: null,
  fromPage: null,
  targetPage: null,
});

const suppressThumbnailClickRef = useRef(false);

  useEffect(() => {
  if (!showColorPalette) return;

const handleOutsideClick = (event) => {
  const clickedInsideWrapper =
    colorPaletteRef.current?.contains(event.target);

  const clickedInsidePopover =
    colorPopoverRef.current?.contains(event.target);

  if (!clickedInsideWrapper && !clickedInsidePopover) {
    setShowColorPalette(false);
  }
};

  const handleEscape = (event) => {
    if (event.key === "Escape") {
      setShowColorPalette(false);
    }
  };

  document.addEventListener("mousedown", handleOutsideClick);
  document.addEventListener("keydown", handleEscape);

  return () => {
    document.removeEventListener("mousedown", handleOutsideClick);
    document.removeEventListener("keydown", handleEscape);
  };
}, [showColorPalette]);

  const pageAnnotations = useMemo(
    () => annotations.filter((item) => item.pageNumber === pageNumber),
    [annotations, pageNumber]
  );

  const recordAnnotations = (next) => {
    setUndoStack((stack) => [...stack, annotations]);
    setRedoStack([]);
    setAnnotations(next);
  };

  const undo = () => {
    if (!undoStack.length) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((stack) => [...stack, annotations]);
    setAnnotations(previous);
    setUndoStack((stack) => stack.slice(0, -1));
  };

  const redo = () => {
    if (!redoStack.length) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((stack) => [...stack, annotations]);
    setAnnotations(next);
    setRedoStack((stack) => stack.slice(0, -1));
  };

  const handleFileUpload = (event) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    if (
      selectedFile.type !== "application/pdf" &&
      !selectedFile.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Please select a valid PDF file.");
      return;
    }
    setError("");
    setFile(selectedFile);
    setPdfDocument(null);
    setZoomMode("custom");
    setScale(1);
    setIsPdfLoading(true);
    setFileName(selectedFile.name);
    setPageNumber(1);
    setNumPages(0);
    setAnnotations([]);
    setUndoStack([]);
    setRedoStack([]);
    setPageRotations({});
    setOriginalPageRotations({});
    setPageOrder([]);
    setDraggedPage(null);
  };

  const handleRenameFile = async () => {
  const trimmedName = renameInput.trim();

  if (!trimmedName || isRenamingSaving) return;

  let newName = trimmedName;

  if (!newName.toLowerCase().endsWith(".pdf")) {
    newName += ".pdf";
  }

  try {
    setIsRenamingSaving(true);

    // Update the actual NOVA file when opened from My Files.
    if (sourceFileId) {
      await renameFile(sourceFileId, newName);
    }

    setFileName(newName);

    // Keep the in-memory file's name in sync.
    if (file instanceof File) {
      const renamedFile = new File([file], newName, {
        type: file.type,
        lastModified: file.lastModified,
      });

      setFile(renamedFile);
    }

    setIsRenaming(false);
    window.alert("PDF renamed successfully.");
  } catch (renameError) {
    console.error("PDF rename failed:", renameError);
    window.alert(renameError.message || "Unable to rename this PDF.");
  } finally {
    setIsRenamingSaving(false);
  }
};

  const handleTextSelection = () => {
    if (!textTools.includes(activeTool) && activeTool !== "select") return;
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (!selection || !text || !selection.rangeCount) {
      setSelectedText("");
      setSelectionRects([]);
      return;
    }

    const pageElement = pageContainerRef.current?.querySelector(".react-pdf__Page");
    if (!pageElement) return;
    const bounds = pageElement.getBoundingClientRect();
    const range = selection.getRangeAt(0);

const rects = Array.from(range.getClientRects())
  .filter((rect) => rect.width > 0 && rect.height > 0)
  .map((rect) => {
    const displayCorners = [
      {
        x: ((rect.left - bounds.left) / bounds.width) * 100,
        y: ((rect.top - bounds.top) / bounds.height) * 100,
      },
      {
        x: ((rect.right - bounds.left) / bounds.width) * 100,
        y: ((rect.top - bounds.top) / bounds.height) * 100,
      },
      {
        x: ((rect.left - bounds.left) / bounds.width) * 100,
        y: ((rect.bottom - bounds.top) / bounds.height) * 100,
      },
      {
        x: ((rect.right - bounds.left) / bounds.width) * 100,
        y: ((rect.bottom - bounds.top) / bounds.height) * 100,
      },
    ];

    const pageCorners = displayCorners.map(displayedToPagePoint);

    const xs = pageCorners.map((point) => point.x);
    const ys = pageCorners.map((point) => point.y);

    const left = Math.min(...xs);
    const top = Math.min(...ys);
    const right = Math.max(...xs);
    const bottom = Math.max(...ys);

    return {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    };
  })
  .filter((rect) => rect.x >= -1 && rect.y >= -1);

    if (!rects.length) return;
    setSelectedText(text);
    setSelectionRects(rects);
  };

  const handleApplyTextAnnotation = (type) => {
    if (!selectedText || !selectionRects.length) {
      setActiveTool(type);
      return;
    }

    const sameGeometry = (a, b) =>
      a.length === b.length &&
      a.every((rect, index) => {
        const other = b[index];
        return (
          Math.abs(rect.x - other.x) < 1.5 &&
          Math.abs(rect.y - other.y) < 1.5 &&
          Math.abs(rect.width - other.width) < 1.5 &&
          Math.abs(rect.height - other.height) < 1.5
        );
      });

    const existing = annotations.find(
      (item) =>
        item.pageNumber === pageNumber &&
        item.type === type &&
        item.text === selectedText &&
        sameGeometry(item.rects || [], selectionRects)
    );

    const next = existing
      ? annotations.filter((item) => item.id !== existing.id)
      : [
          ...annotations,
          {
            id: makeId(),
            pageNumber,
            type,
            text: selectedText,
            color: annotationColor,
            rects: selectionRects,
          },
        ];

    recordAnnotations(next);
    setSelectedText("");
    setSelectionRects([]);
    window.getSelection()?.removeAllRanges();
    setActiveTool(type);
  };

const currentPageRotation =
  (
    (originalPageRotations[pageNumber] || 0) +
    (pageRotations[pageNumber] || 0)
  ) % 360;

const displayedToPagePoint = (point) => {
  switch (currentPageRotation) {
    case 90:
      return { x: point.y, y: 100 - point.x };

    case 180:
      return { x: 100 - point.x, y: 100 - point.y };

    case 270:
      return { x: 100 - point.y, y: point.x };

    default:
      return point;
  }
};

const pointFromEvent = (event) => {
  const bounds = event.currentTarget.getBoundingClientRect();

  const displayedPoint = {
    x: Math.max(
      0,
      Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100)
    ),
    y: Math.max(
      0,
      Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100)
    ),
  };

  return displayedToPagePoint(displayedPoint);
};


const handleOverlayPointerDown = (event) => {
  if (
    !drawingTools.includes(activeTool) &&
    activeTool !== "eraser" &&
    activeTool !== "text"
  ) return;

  // Prevent a second finger from interrupting an active gesture.
  if (activePointerIdRef.current !== null) return;

  event.preventDefault();

  activePointerIdRef.current = event.pointerId;
  event.currentTarget.setPointerCapture?.(event.pointerId);

  const point = pointFromEvent(event);

  if (activeTool === "eraser") {
    const hit = [...pageAnnotations].reverse().find((item) => {
      if (item.rects) {
        return item.rects.some((r) =>
          point.x >= r.x - 1 &&
          point.x <= r.x + r.width + 1 &&
          point.y >= r.y - 1 &&
          point.y <= r.y + r.height + 1
        );
      }

      if (item.points?.length) {
        return item.points.some(
          (p) => Math.hypot(p.x - point.x, p.y - point.y) < 3
        );
      }

      return (
        point.x >= Math.min(item.x, item.x + item.width) - 1 &&
        point.x <= Math.max(item.x, item.x + item.width) + 1 &&
        point.y >= Math.min(item.y, item.y + item.height) - 1 &&
        point.y <= Math.max(item.y, item.y + item.height) + 1
      );
    });

    if (hit) {
      recordAnnotations(
        annotations.filter((item) => item.id !== hit.id)
      );
    }

    return;
  }

  if (activeTool === "text") {
    const value = window.prompt("Enter text to add to the PDF:");

    if (value?.trim()) {
      recordAnnotations([
        ...annotations,
        {
          id: makeId(),
          pageNumber,
          type: "text",
          text: value.trim(),
          x: point.x,
          y: point.y,
          color: annotationColor,
          strokeWidth,
        },
      ]);
    }

    return;
  }

  drawingRef.current = true;

  const draft = {
    id: makeId(),
    pageNumber,
    type: activeTool,
    x: point.x,
    y: point.y,
    width: 0,
    height: 0,
    points: [point],
    color: annotationColor,
    strokeWidth,
  };

  draftRef.current = draft;
  setDraftShape(draft);
};

const handleOverlayPointerMove = (event) => {
  if (event.pointerId !== activePointerIdRef.current) return;
  if (!drawingRef.current || !draftRef.current) return;

  const point = pointFromEvent(event);
  const start = draftRef.current;

  const updated = {
    ...start,
    width: point.x - start.x,
    height: point.y - start.y,
    points:
      start.type === "draw"
        ? [...start.points, point]
        : start.points,
  };

  draftRef.current = updated;
  setDraftShape(updated);
};

const handleOverlayPointerUp = (event) => {
  if (event.pointerId !== activePointerIdRef.current) return;

  activePointerIdRef.current = null;

  if (!drawingRef.current || !draftRef.current) return;

  drawingRef.current = false;

  const completed = draftRef.current;

  draftRef.current = null;
  setDraftShape(null);

  if (
    completed.type !== "draw" &&
    Math.abs(completed.width) < 0.4 &&
    Math.abs(completed.height) < 0.4
  ) return;

  if (completed.type === "draw" && completed.points.length < 2) return;

  recordAnnotations([...annotations, completed]);
};

const handleOverlayPointerCancel = (event) => {
  if (event.pointerId !== activePointerIdRef.current) return;

  // Discard an interrupted drawing gesture.
  activePointerIdRef.current = null;
  drawingRef.current = false;
  draftRef.current = null;
  setDraftShape(null);
};


const changePage = (direction) => {
  const currentIndex = pageOrder.indexOf(pageNumber);

  const nextIndex = Math.min(
    pageOrder.length - 1,
    Math.max(0, currentIndex + direction)
  );

  setPageNumber(pageOrder[nextIndex]);
  setSelectedText("");
  setSelectionRects([]);
};


const handlePageDrop = (targetPage, sourcePage = draggedPage) => {
  if (sourcePage === null || sourcePage === targetPage) return;

  setPageOrder((current) => {
    const next = [...current];

    const fromIndex = next.indexOf(sourcePage);
    const toIndex = next.indexOf(targetPage);

    if (fromIndex === -1 || toIndex === -1) return current;

    const [movedPage] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, movedPage);

    return next;
  });

  setDraggedPage(null);
};




const handleThumbnailPointerDown = (event, page) => {
  if (event.pointerType !== "touch") return;

  event.preventDefault();

  touchPageDragRef.current = {
    pointerId: event.pointerId,
    fromPage: page,
    targetPage: page,
  };

  event.currentTarget.setPointerCapture(event.pointerId);
};

const handleThumbnailPointerMove = (event) => {
  const drag = touchPageDragRef.current;

  if (
    drag.pointerId === null ||
    drag.pointerId !== event.pointerId
  ) return;

  event.preventDefault();

  const element = document.elementFromPoint(
    event.clientX,
    event.clientY
  );

  const thumbnail = element?.closest("[data-pdf-page]");

  if (thumbnail) {
    drag.targetPage = Number(thumbnail.dataset.pdfPage);
  }
};

const handleThumbnailPointerUp = (event) => {
  const drag = touchPageDragRef.current;

  if (
    drag.pointerId === null ||
    drag.pointerId !== event.pointerId
  ) return;

  const { fromPage, targetPage } = drag;

  touchPageDragRef.current = {
    pointerId: null,
    fromPage: null,
    targetPage: null,
  };

  if (fromPage !== targetPage) {
    suppressThumbnailClickRef.current = true;

    handlePageDrop(targetPage, fromPage);

    requestAnimationFrame(() => {
      suppressThumbnailClickRef.current = false;
    });
  }
};


const handleThumbnailPointerCancel = (event) => {
  if (
    touchPageDragRef.current.pointerId !== event.pointerId
  ) return;

  touchPageDragRef.current = {
    pointerId: null,
    fromPage: null,
    targetPage: null,
  };
};


  const rotatePage = (direction) => {
  setPageRotations((current) => ({
    ...current,
    [pageNumber]: (
      (current[pageNumber] || 0) + direction + 360
    ) % 360,
  }));
};

  const handleDownload = () => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName || "NOVA-document.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  
const createAnnotatedPdfBlob = async () => {
  if (!file) return;

  let sourceBytes;

    if (file instanceof Blob) {
      sourceBytes = await file.arrayBuffer();
    } else if (typeof file === "string") {
      const response = await fetch(file);

      if (!response.ok) {
        throw new Error("Unable to retrieve the original PDF.");
      }

      sourceBytes = await response.arrayBuffer();
    } else {
      sourceBytes = file;
    }

const pdfDoc = await PDFDocument.load(sourceBytes);
const pages = pdfDoc.getPages();

// Apply the rotations to the actual PDF pages.
pages.forEach((page, index) => {
  const additionalRotation = pageRotations[index + 1] || 0;

  if (additionalRotation !== 0) {
    const currentRotation = page.getRotation().angle;

    page.setRotation(
      degrees(
        (currentRotation + additionalRotation + 360) % 360
      )
    );
  }
});

const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    annotations.forEach((item) => {
      const page = pages[item.pageNumber - 1];
      if (!page) return;

      const { width, height } = page.getSize();
      const color = pdfColor(item.color || "#222222");

      const toX = (value) => (value / 100) * width;
      const toY = (value) => height - (value / 100) * height;

      const strokeWidthValue =
        Math.max(0.25, Number(item.strokeWidth || 3) / 4) *
        (height / 100);

      // Highlights, underlines and strikethroughs
      if (item.rects?.length) {
        item.rects.forEach((rect) => {
          const x = toX(rect.x);
          const rectWidth = toX(rect.width);
          const rectHeight = (rect.height / 100) * height;
          const bottom =
  height - ((rect.y + rect.height) / 100) * height;

          if (item.type === "highlight") {
            page.drawRectangle({
              x,
              y: bottom,
              width: rectWidth,
              height: rectHeight,
              color,
              opacity: 0.42,
            });
          }

          if (item.type === "underline" || item.type === "strike") {
            const position =
              item.type === "underline"
                ? rect.y + rect.height * 0.96
                : rect.y + rect.height * 0.5;

            const y = toY(position);

            page.drawLine({
              start: { x, y },
              end: { x: x + rectWidth, y },
              color,
              thickness: Math.max(0.5, (0.12 / 100) * height),
            });
          }
        });

        return;
      }

      // Added text
      if (item.type === "text") {
        page.drawText(item.text || "", {
          x: toX(item.x),
          y: toY(item.y),
          font,
          size: (2.4 / 100) * height,
          color,
        });

        return;
      }

      // Freehand drawing
      if (item.type === "draw" && item.points?.length > 1) {
        for (let index = 1; index < item.points.length; index++) {
          const previous = item.points[index - 1];
          const current = item.points[index];

          page.drawLine({
            start: {
              x: toX(previous.x),
              y: toY(previous.y),
            },
            end: {
              x: toX(current.x),
              y: toY(current.y),
            },
            color,
            thickness: strokeWidthValue,
          });
        }

        return;
      }

      const x1 = toX(item.x);
      const y1 = toY(item.y);
      const x2 = toX(item.x + item.width);
      const y2 = toY(item.y + item.height);

      // Rectangle
      if (item.type === "rectangle") {
        page.drawRectangle({
          x: Math.min(x1, x2),
          y: Math.min(y1, y2),
          width: Math.abs(x2 - x1),
          height: Math.abs(y2 - y1),
          borderColor: color,
          borderWidth: strokeWidthValue,
        });
      }

      // Circle
      if (item.type === "circle") {
        page.drawEllipse({
          x: (x1 + x2) / 2,
          y: (y1 + y2) / 2,
          xScale: Math.abs(x2 - x1) / 2,
          yScale: Math.abs(y2 - y1) / 2,
          borderColor: color,
          borderWidth: strokeWidthValue,
        });
      }

      // Arrow
      if (item.type === "arrow") {
        page.drawLine({
          start: { x: x1, y: y1 },
          end: { x: x2, y: y2 },
          color,
          thickness: strokeWidthValue,
        });

        const angle = Math.atan2(y2 - y1, x2 - x1);
        const head = Math.max(6, Math.min(width, height) * 0.022);

        const leftX = x2 - head * Math.cos(angle - Math.PI / 6);
        const leftY = y2 - head * Math.sin(angle - Math.PI / 6);

        const rightX = x2 - head * Math.cos(angle + Math.PI / 6);
        const rightY = y2 - head * Math.sin(angle + Math.PI / 6);

        page.drawLine({
          start: { x: leftX, y: leftY },
          end: { x: x2, y: y2 },
          color,
          thickness: strokeWidthValue,
        });

        page.drawLine({
          start: { x: x2, y: y2 },
          end: { x: rightX, y: rightY },
          color,
          thickness: strokeWidthValue,
        });
      }
    });

const orderedPdfDoc = await PDFDocument.create();

const orderedPages = await orderedPdfDoc.copyPages(
  pdfDoc,
  pageOrder.map((page) => page - 1)
);

orderedPages.forEach((page) => {
  orderedPdfDoc.addPage(page);
});

const pdfBytes = await orderedPdfDoc.save();

return new Blob([pdfBytes], {
  type: "application/pdf",
});
};

const handleExportAnnotated = async () => {
  try {
    const blob = await createAnnotatedPdfBlob();
    if (!blob) return;

    const baseName = (fileName || "NOVA-document.pdf")
      .replace(/\.pdf$/i, "");

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${baseName} (annotated).pdf`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (exportError) {
    console.error("PDF export failed:", exportError);
    window.alert(
      exportError.message || "Unable to export the annotated PDF."
    );
  }
};



const handleSaveAnnotatedToNOVA = async () => {
  if (isSavingAnnotatedPdf) return;

if (!user?.id) {
  window.alert("Please sign in to save this PDF to NOVA.");
  return;
}

  setIsSavingAnnotatedPdf(true);

  try {
    const blob = await createAnnotatedPdfBlob();
    if (!blob) return;

    const baseName = (fileName || "NOVA-document.pdf")
      .replace(/\.pdf$/i, "");

    await saveNewPdfToMyFiles(
      user.id,
      blob,
      `${baseName} (annotated).pdf`
    );

    window.alert("Annotated PDF saved successfully to NOVA My Files.");
  } catch (saveError) {
    console.error("Saving annotated PDF failed:", saveError);
    window.alert(
      saveError.message || "Unable to save the annotated PDF to NOVA."
    );
  } finally {
    setIsSavingAnnotatedPdf(false);
  }
};

  const handlePrint = () => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const printWindow = window.open(url, "_blank");
    if (!printWindow) {
      URL.revokeObjectURL(url);
      return;
    }
    printWindow.addEventListener("load", () => {
      printWindow.focus();
      printWindow.print();
    });
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const addComment = (event) => {
    event.preventDefault();
    if (!commentDraft.trim()) return;
    setComments((items) => [
      ...items,
      {
        id: makeId(),
        name: "You",
        initial: "N",
        time: "Just now",
        message: commentDraft.trim(),
      },
    ]);
    setCommentDraft("");
  };

  useEffect(() => {
    const viewer = pdfViewerRef.current;
    if (!viewer) return;
    const observer = new ResizeObserver(([entry]) => {
      setViewerSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(viewer);
    return () => observer.disconnect();
  }, [file]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!pdfDocument || !viewerSize.width || !viewerSize.height ||
      zoomMode === "custom" || zoomMode === "actual") return;
    let cancelled = false;
    const calculateZoom = async () => {
      try {
        const page = await pdfDocument.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const widthScale = viewerSize.width / viewport.width;
        const heightScale = viewerSize.height / viewport.height;
        const nextScale = zoomMode === "width"
          ? widthScale
          : Math.min(widthScale, heightScale);
        if (!cancelled) setScale(Math.max(0.1, Math.min(nextScale, 3)));
      } catch (loadError) {
        console.error("Unable to calculate PDF zoom:", loadError);
      }
    };
    calculateZoom();
    return () => { cancelled = true; };
  }, [pdfDocument, pageNumber, viewerSize, zoomMode]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const target = event.target;
      if (target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const renderAnnotation = (item) => {
    if (item.rects) {
      return item.rects.map((rect, index) => (
        <g key={`${item.id}-${index}`}>
          {item.type === "highlight" && (
            <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height}
              rx="0.25" fill={item.color} fillOpacity="0.42" />
          )}
          {item.type === "underline" && (
  <line
    x1={rect.x}
    y1={rect.y + rect.height * 0.96}
    x2={rect.x + rect.width}
    y2={rect.y + rect.height * 0.96}
    stroke={item.color}
    strokeWidth="0.12"
    strokeLinecap="round"
  />
)}

{item.type === "strike" && (
  <line
    x1={rect.x}
    y1={rect.y + rect.height * 0.50}
    x2={rect.x + rect.width}
    y2={rect.y + rect.height * 0.50}
    stroke={item.color}
    strokeWidth="0.12"
    strokeLinecap="round"
  />
)}
        </g>
      ));
    }

    if (item.type === "text") {
      return (
        <text key={item.id} x={item.x} y={item.y} fill={item.color}
          fontSize="2.4" paintOrder="stroke" stroke="white" strokeWidth="0.25">
          {item.text}
        </text>
      );
    }

    if (item.type === "draw" && item.points?.length) {
      return (
        <polyline key={item.id}
          points={item.points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none" stroke={item.color} strokeWidth={Math.max(0.25, item.strokeWidth / 4)}
          strokeLinecap="round" strokeLinejoin="round" />
      );
    }

    const x = Math.min(item.x, item.x + item.width);
    const y = Math.min(item.y, item.y + item.height);
    const width = Math.abs(item.width);
    const height = Math.abs(item.height);
    const stroke = item.color;
    const strokeWidthValue = Math.max(0.25, item.strokeWidth / 4);

    if (item.type === "rectangle") {
      return <rect key={item.id} x={x} y={y} width={width} height={height}
        fill="none" stroke={stroke} strokeWidth={strokeWidthValue} />;
    }
    if (item.type === "circle") {
      return <ellipse key={item.id} cx={x + width / 2} cy={y + height / 2}
        rx={width / 2} ry={height / 2} fill="none"
        stroke={stroke} strokeWidth={strokeWidthValue} />;
    }
    if (item.type === "arrow") {
      const x1 = item.x;
      const y1 = item.y;
      const x2 = item.x + item.width;
      const y2 = item.y + item.height;
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const head = 2.2;
      const leftX = x2 - head * Math.cos(angle - Math.PI / 6);
      const leftY = y2 - head * Math.sin(angle - Math.PI / 6);
      const rightX = x2 - head * Math.cos(angle + Math.PI / 6);
      const rightY = y2 - head * Math.sin(angle + Math.PI / 6);
      return (
        <g key={item.id} stroke={stroke} strokeWidth={strokeWidthValue}
          fill="none" strokeLinecap="round">
          <line x1={x1} y1={y1} x2={x2} y2={y2} />
          <polyline points={`${leftX},${leftY} ${x2},${y2} ${rightX},${rightY}`} />
        </g>
      );
    }
    return null;
  };

  const overlayInteractive = drawingTools.includes(activeTool) ||
    activeTool === "eraser" || activeTool === "text";

  return (
    <div className="nova-pdf">
      <header className="pdf-header">
        <div className="pdf-header-left">
          <button className="pdf-back-button" onClick={() => navigate(returnTo)}
            type="button" title={`Back to ${returnLabel}`}>
            <ArrowLeft size={19} />
          </button>
          <span className="pdf-office-link">{returnLabel}</span>
          
<div className="pdf-header-title">
  {isRenaming ? (
    <div className="pdf-rename-controls">
      <div className="pdf-rename-input-wrapper">
  <input
    type="text"
    value={renameInput}
    autoFocus
    disabled={isRenamingSaving}
    onChange={(event) => setRenameInput(event.target.value)}
    onKeyDown={(event) => {
      if (event.key === "Enter") handleRenameFile();

      if (event.key === "Escape") {
        setIsRenaming(false);
        setRenameInput("");
      }
    }}
  />
  <span className="pdf-rename-extension">.pdf</span>
</div>

      <button
        type="button"
        onClick={handleRenameFile}
        disabled={!renameInput.trim() || isRenamingSaving}
      >
        {isRenamingSaving ? "Saving..." : "Save"}
      </button>

      <button
        type="button"
        onClick={() => {
          setIsRenaming(false);
          setRenameInput("");
        }}
        disabled={isRenamingSaving}
      >
        Cancel
      </button>
    </div>
  ) : (
    <h2
      title="Click to rename PDF"
      onClick={() => {
        setRenameInput((fileName || "").replace(/\.pdf$/i, ""));
        setIsRenaming(true);
      }}
      style={{ cursor: "text" }}
    >
      {fileName || "NOVA PDF"}
      <Pencil size={15} />
    </h2>
  )}

  <span>{file ? "PDF document" : "Ready to open a PDF"}</span>
</div>

        </div>

        <div className="pdf-header-right">
          <div className="pdf-collaborators" title="Collaboration coming soon">
            <span className="pdf-avatar">N</span>
            <span className="pdf-avatar pdf-avatar-alt">A</span>
            <span className="pdf-avatar pdf-avatar-more">+2</span>
          </div>
          <button className="pdf-header-action pdf-share-button" type="button"
            disabled title="PDF sharing is coming soon">
            <Users size={17} /> Share
          </button>
          <button className={`pdf-header-action pdf-comments-button ${showComments ? "active" : ""}`}
            type="button" onClick={() => setShowComments((value) => !value)}>
            <MessageSquare size={18} />
            Comments
            {comments.length > 0 && <span className="pdf-comment-count">{comments.length}</span>}
          </button>
          <div className="pdf-more-wrapper" ref={moreMenuRef}>
            <button className="pdf-more-button" type="button" title="More options"
              onClick={() => setShowMoreMenu((value) => !value)}>
              <MoreVertical size={20} />
            </button>
            {showMoreMenu && (
              <div className="pdf-more-menu">

                
<button
  type="button"
  disabled={isSavingAnnotatedPdf}
  onClick={() => {
    handleSaveAnnotatedToNOVA();
    setShowMoreMenu(false);
  }}
>
  <Upload size={17} />
  {isSavingAnnotatedPdf ? "Saving..." : "Save annotated PDF to My Files"}
</button>


  <button
    type="button"
    onClick={() => {
      handleExportAnnotated();
      setShowMoreMenu(false);
    }}
  >
    <Download size={17} /> Download annotated PDF
  </button>

  <button
    type="button"
    onClick={() => {
      handleDownload();
      setShowMoreMenu(false);
    }}
  >
    <FileText size={17} /> Download original PDF
  </button>

  <button
    type="button"
    onClick={() => {
      handlePrint();
      setShowMoreMenu(false);
    }}
  >
    <Printer size={17} /> Print original PDF
  </button>
</div>
            )}
          </div>
        </div>
      </header>

      {!file ? (
        <main className="pdf-empty-state">
          <div className="pdf-empty-icon"><FileText size={42} /></div>
          <h2>Welcome to NOVA PDF</h2>
          <p>Open a PDF from your computer to get started.</p>
          <label className="pdf-empty-upload">
            <Upload size={18} /> Choose PDF file
            <input type="file" accept="application/pdf,.pdf" onChange={handleFileUpload} hidden />
          </label>
          {error && <p className="pdf-error">{error}</p>}
        </main>
      ) : (
        <>
          <div className="pdf-annotation-toolbar">
            <div className="pdf-tool-group">
              {annotationTools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button key={tool.id} type="button" title={tool.label}
                    aria-label={tool.label}
                    className={`pdf-tool-button ${activeTool === tool.id ? "active" : ""}`}
                    onClick={() => {
  if (textTools.includes(tool.id)) {
    handleApplyTextAnnotation(tool.id);
    return;
  }

  if (activeTool === tool.id) {
    setActiveTool("select");
    return;
  }

  setActiveTool(tool.id);
}}
                    >
                    <Icon size={20} />
                  </button>
                );
              })}
</div>

<div className="pdf-tool-divider" />

<div className="pdf-page-rotation-controls">
  <button
    type="button"
    title="Rotate page left"
    onClick={() => rotatePage(-90)}
  >
    <RotateCcw size={19} />
  </button>

  <button
    type="button"
    title="Rotate page right"
    onClick={() => rotatePage(90)}
  >
    <RotateCw size={19} />
  </button>
</div>

<div className="pdf-tool-divider" />

<div className="pdf-color-wrapper" ref={colorPaletteRef}>
<button
  ref={colorTriggerRef}
  type="button"
  className="pdf-color-trigger"
    title="Choose annotation colour"
    onClick={() => {
  if (showColorPalette) {
    setShowColorPalette(false);
    return;
  }

  const rect = colorTriggerRef.current.getBoundingClientRect();

  setColorPalettePosition({
    top: rect.bottom + 12,
    left: Math.min(rect.left, window.innerWidth - 265),
  });

  setShowColorPalette(true);
}}
  >
    <span
      className="pdf-color-preview"
      style={{ background: annotationColor }}
    />
  </button>

  {showColorPalette &&
  createPortal(
    <div
      ref={colorPopoverRef}
      className="pdf-color-popover"
      style={{
        position: "fixed",
        top: colorPalettePosition.top,
        left: colorPalettePosition.left,
        zIndex: 99999,
      }}
    >
      <strong>Annotation colour</strong>

      <div className="pdf-color-grid">
        {presetColors.map((color) => (
          <button
            key={color}
            type="button"
            className={`pdf-color-swatch ${
              annotationColor.toLowerCase() === color.toLowerCase()
                ? "selected"
                : ""
            }`}
            style={{ background: color }}
            title={color}
            aria-label={`Choose ${color}`}
            aria-pressed={
              annotationColor.toLowerCase() === color.toLowerCase()
            }
            onClick={() => {
              setAnnotationColor(color);
              setShowColorPalette(false);
            }}
          >
            {annotationColor.toLowerCase() === color.toLowerCase() && (
              <span className="pdf-color-check">✓</span>
            )}
          </button>
        ))}
      </div>

      <div className="pdf-custom-color">
        <label htmlFor="pdf-custom-color-input">Custom colour</label>
        <input
          id="pdf-custom-color-input"
          type="color"
          value={annotationColor}
          onChange={(event) => setAnnotationColor(event.target.value)}
        />
        <span>{annotationColor.toUpperCase()}</span>
      </div>
    </div>,
    document.body
  )}
</div>
            <select className="pdf-stroke-select" value={strokeWidth}
              onChange={(event) => setStrokeWidth(Number(event.target.value))}
              title="Stroke width">
              <option value="1">1 px</option>
              <option value="2">2 px</option>
              <option value="3">3 px</option>
              <option value="5">5 px</option>
              <option value="8">8 px</option>
            </select>
            <div className="pdf-tool-divider" />
            <div className="pdf-history-controls">
              <button type="button" title="Undo" onClick={undo} disabled={!undoStack.length}>
                <Undo2 size={18} />
              </button>
              <button type="button" title="Redo" onClick={redo} disabled={!redoStack.length}>
                <Redo2 size={18} />
              </button>
            </div>
            <div className="pdf-tool-divider" />
            <div className="pdf-zoom-controls">
              <button type="button" onClick={() => { setZoomMode("custom"); setScale((v) => Math.max(0.5, v - 0.1)); }}
                disabled={scale <= 0.5 && zoomMode === "custom"} title="Zoom out">
                <ZoomOut size={19} />
              </button>
              <span>{Math.round(scale * 100)}%</span>
              <button type="button" onClick={() => { setZoomMode("custom"); setScale((v) => Math.min(3, v + 0.1)); }}
                disabled={scale >= 3 && zoomMode === "custom"} title="Zoom in">
                <ZoomIn size={19} />
              </button>
              <select className="pdf-zoom-mode" value={zoomMode}
                onChange={(event) => {
                  const mode = event.target.value;
                  setZoomMode(mode);
                  if (mode === "actual") setScale(1);
                }} title="Zoom options">
                <option value="custom">Custom zoom</option>
                <option value="width">Fit to width</option>
                <option value="page">Fit to page</option>
                <option value="actual">Actual size (100%)</option>
              </select>
            </div>
            <div className="pdf-tool-divider" />
            <div className="pdf-page-controls">
              <button type="button" onClick={() => changePage(-1)}
                disabled={pageOrder.indexOf(pageNumber) === 0} title="Previous page">
                <ChevronLeft size={21} />
              </button>
              <span>{pageOrder.indexOf(pageNumber) + 1} / {numPages}</span>
              <button type="button" onClick={() => changePage(1)}
                disabled={pageOrder.indexOf(pageNumber) === pageOrder.length - 1} title="Next page">
                <ChevronRight size={21} />
              </button>
            </div>
          </div>

          <main className={`pdf-workspace ${showComments ? "" : "pdf-comments-hidden"}`}>
            <Document
              file={file}
              onLoadSuccess={async (pdf) => {
  setNumPages(pdf.numPages);
  setPdfDocument(pdf);
  setIsPdfLoading(false);
  setError("");
  setPageOrder(
  Array.from({ length: pdf.numPages }, (_, index) => index + 1)
);

  const rotations = {};

  for (let page = 1; page <= pdf.numPages; page++) {
    const pdfPage = await pdf.getPage(page);
    rotations[page] = pdfPage.rotate || 0;
  }

  setOriginalPageRotations(rotations);
}}
              onLoadError={(loadError) => {
                setError(loadError.message || "Unable to load PDF.");
                setIsPdfLoading(false);
              }}
              loading={<p className="pdf-loading">Loading PDF...</p>}
              error={<p className="pdf-error">Unable to display this PDF.</p>}
            >
              <aside className="pdf-thumbnails">
                <h3>Pages</h3>
{pageOrder.map((page, index) => (
  <button
    type="button"
    key={page}
    draggable
    data-pdf-page={page}
    onPointerDown={(event) =>
      handleThumbnailPointerDown(event, page)
    }
    onPointerMove={handleThumbnailPointerMove}
    onPointerUp={handleThumbnailPointerUp}
    onPointerCancel={handleThumbnailPointerCancel}
    className={`pdf-thumbnail ${
      pageNumber === page ? "active" : ""
    }`}
onClick={() => {
  if (suppressThumbnailClickRef.current) return;

  setPageNumber(page);
  setSelectedText("");
  setSelectionRects([]);
}}
    onDragStart={(event) => {
      setDraggedPage(page);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(page));
    }}
onDragOver={(event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";

  const sidebar = event.currentTarget.closest(".pdf-thumbnails");

  if (!sidebar) return;

  const bounds = sidebar.getBoundingClientRect();
  const pointerY = event.clientY;

  // Auto-scroll upwards
  if (pointerY < bounds.top + 60) {
    sidebar.scrollTop -= 15;
  }

  // Auto-scroll downwards
  if (pointerY > bounds.bottom - 60) {
    sidebar.scrollTop += 15;
  }
}}
    onDrop={(event) => {
      event.preventDefault();
      handlePageDrop(page);
    }}
    onDragEnd={() => setDraggedPage(null)}
  >
    <Page
      pageNumber={page}
      width={125}
      rotate={
        (
          (originalPageRotations[page] || 0) +
          (pageRotations[page] || 0)
        ) % 360
      }
      renderTextLayer={false}
      renderAnnotationLayer={false}
    />

    <span>Page {index + 1}</span>
  </button>
))}
              </aside>

              <section className="pdf-main-page" ref={pdfViewerRef}
                onMouseUp={handleTextSelection} onTouchEnd={handleTextSelection}>
                <div className="pdf-page-container" ref={pageContainerRef}>
                  <Page
  pageNumber={pageNumber}
  scale={scale}
rotate={
  (
    (originalPageRotations[pageNumber] || 0) +
    (pageRotations[pageNumber] || 0)
  ) % 360
}
  renderTextLayer
  renderAnnotationLayer
/>
                  <svg
                    className={`pdf-annotation-layer ${overlayInteractive ? "interactive" : ""}`}
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    onPointerDown={handleOverlayPointerDown}
                    onPointerMove={handleOverlayPointerMove}
                    onPointerUp={handleOverlayPointerUp}
                    onPointerCancel={handleOverlayPointerCancel}
                    style={{ touchAction: overlayInteractive ? "none" : "auto" }}
                  >
<g transform={`rotate(${currentPageRotation} 50 50)`}>
  {pageAnnotations.map(renderAnnotation)}
  {draftShape && renderAnnotation(draftShape)}
</g>
                  </svg>
                </div>
              </section>
            </Document>

            {(isPdfLoading || error) && (
              <div className="pdf-loading-screen">
                <div className="pdf-loading-content">
                  <div className="pdf-loading-icon">
                    <FileText size={38} /><span className="pdf-loading-spinner" />
                  </div>
                  <h2>{error ? "Unable to open PDF" : "Opening your PDF"}</h2>
                  <p>{error || `Preparing ${fileName || "your document"}...`}</p>
                  {isPdfLoading && <div className="pdf-loading-progress"><span /></div>}
                  <small>Powered by NOVA PDF</small>
                </div>
              </div>
            )}

            {showComments && (
              <aside className="pdf-comments-panel">
                <div className="pdf-comments-heading">
                  <h3>Comments ({comments.length})</h3>
                  <button type="button" title="Filter comments" disabled>
                    <SlidersHorizontal size={19} />
                  </button>
                </div>
                <div className="pdf-comments-list">
                  {comments.map((comment) => (
                    <article className="pdf-comment-card" key={comment.id}>
                      <div className="pdf-comment-top">
                        <span className={`pdf-comment-avatar avatar-${comment.initial.toLowerCase()}`}>
                          {comment.initial}
                        </span>
                        <div className="pdf-comment-author">
                          <strong>{comment.name}</strong><span>{comment.time}</span>
                        </div>
                        {comment.resolved && <CheckCircle2 className="pdf-comment-resolved" size={20} />}
                      </div>
                      <p>{comment.message}</p>
                    </article>
                  ))}
                </div>
                <form className="pdf-comment-form" onSubmit={addComment}>
                  <textarea value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)}
                    placeholder="Write a comment..." rows={3} />
                  <button type="submit" disabled={!commentDraft.trim()}>Add comment</button>
                </form>
              </aside>
            )}
          </main>
          {error && <p className="pdf-error">{error}</p>}
        </>
      )}
    </div>
  );
}

export default PDF;
