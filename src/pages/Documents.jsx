import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import CharacterCount from "@tiptap/extension-character-count";
import { Table } from "@tiptap/extension-table";
import { TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import mammoth from "mammoth";
import { TextStyleKit } from "@tiptap/extension-text-style";
import ColorPicker from "../components/ColorPicker";
import "../styles/document.css";
import {
  ArrowLeft, AlertCircle, Bold, Italic, List, ListOrdered, Heading1, Heading2, RotateCw, Save, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Highlighter,
  MoreHorizontal, Link2, Unlink, Download, Users, MessageSquare,
  MoreVertical, Search, X, ChevronUp, ChevronDown, FileText,
  BarChart3, Printer, Maximize, Minimize, Minus, Plus, Table2,
  Image as ImageIcon, CalendarClock, Scissors, FilePlus2, Check,
  Settings2, Clock3, Copy, AlignStartHorizontal, AlignCenterHorizontal,
  AlignEndHorizontal, RotateCcw, Trash2, WrapText
} from "lucide-react";

import {
  Document, Paragraph, ImageRun, TextRun, Packer, HeadingLevel,
  AlignmentType, ExternalHyperlink, Table as DocxTable,
  TableRow as DocxTableRow, TableCell as DocxTableCell, WidthType,
} from "docx";

import { useAuth } from "../context/AuthContext";
import { useNavigationGuard } from "../context/NavigationGuardContext";
import { getDocument, saveDocument } from "../services/documents";
import {
  uploadDocumentImage,
  getDocumentImageUrl,
} from "../services/documentImages";

import {
  updateOriginalDocx,
  saveDocumentDocxOutput,
  saveNewDocxToMyFiles,
  getDocxVersions,
  downloadDocxVersion,
  restoreDocxVersion,
  deleteDocxVersion,
  clearDocxVersionHistory,
} from "../services/files";

// Image node view with a draggable bottom-right resize handle.
// Width is stored in the document JSON, so it survives autosave and reopening.
function ResizableImageView({ node, updateAttributes, selected }) {
  const imageRef = useRef(null);
  const dragRef = useRef(null);
  const width = Number(node.attrs.width) || 480;

  const handlePointerDown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const currentWidth = imageRef.current?.getBoundingClientRect().width || width;
    dragRef.current = { startX: event.clientX, startWidth: currentWidth };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!dragRef.current) return;
    const nextWidth = Math.max(
      80,
      Math.min(1200, dragRef.current.startWidth + event.clientX - dragRef.current.startX)
    );
    updateAttributes({ width: Math.round(nextWidth) });
  };

  const handlePointerUp = (event) => {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const align = node.attrs.align || "center";
  const wrap = node.attrs.wrap || "none";
  const rotation = Number(node.attrs.rotation) || 0;

  return (
    <NodeViewWrapper
      draggable={true}
      className={`nova-resizable-image align-${align} wrap-${wrap} ${selected ? "is-selected" : ""}`}
      data-align={align}
      data-wrap={wrap}
      style={{
        width: `${width}px`,
        maxWidth: "100%",
        float: wrap === "left" ? "left" : wrap === "right" ? "right" : "none",
        margin: wrap === "left"
          ? "8px 18px 12px 0"
          : wrap === "right"
            ? "8px 0 12px 18px"
            : align === "left"
              ? "12px auto 12px 0"
              : align === "right"
                ? "12px 0 12px auto"
                : "12px auto",
      }}
    >
      <img
        ref={imageRef}
        src={node.attrs.src}
        alt={node.attrs.alt || ""}
        title={node.attrs.title || ""}
        style={{
          width: "100%",
          maxWidth: "100%",
          height: "auto",
          transform: `rotate(${rotation}deg)`,
        }}
        draggable={false}
      />
      {selected && (
        <button
          type="button"
          className="nova-image-resize-handle"
          aria-label="Drag to resize image"
          title="Drag to resize"
          contentEditable={false}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      )}
    </NodeViewWrapper>
  );
}

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: 480,
        parseHTML: (element) => {
          const width = element.getAttribute("width") || element.style.width;
          const parsed = Number.parseInt(width, 10);
          return Number.isFinite(parsed) ? parsed : 480;
        },
        renderHTML: (attributes) => ({
          width: attributes.width || 480,
          style: `width: ${attributes.width || 480}px; max-width: 100%; height: auto;`,
        }),
      },
      align: {
        default: "center",
        parseHTML: (element) => element.getAttribute("data-align") || "center",
        renderHTML: (attributes) => ({ "data-align": attributes.align || "center" }),
      },
      wrap: {
        default: "none",
        parseHTML: (element) => element.getAttribute("data-wrap") || "none",
        renderHTML: (attributes) => ({ "data-wrap": attributes.wrap || "none" }),
      },
      rotation: {
        default: 0,
        parseHTML: (element) => Number(element.getAttribute("data-rotation")) || 0,
        renderHTML: (attributes) => ({ "data-rotation": attributes.rotation || 0 }),
      },

      storagePath: {
  default: null,
  parseHTML: (element) =>
    element.getAttribute("data-storage-path"),
  renderHTML: (attributes) =>
    attributes.storagePath
      ? { "data-storage-path": attributes.storagePath }
      : {},
},
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});

const cleanColor = (color) => color?.replace("#", "").toUpperCase();


const getImageRun = async (src, requestedWidth = 480) => {
  if (!src) return null;

  const image = new window.Image();

  image.src = src;
  await image.decode();

  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;

  if (!naturalWidth || !naturalHeight) {
    throw new Error("Unable to determine image dimensions.");
  }

  // Convert the image to PNG for DOCX compatibility.
  const canvas = document.createElement("canvas");
  canvas.width = naturalWidth;
  canvas.height = naturalHeight;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to process an image for export.");
  }

  context.drawImage(image, 0, 0);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("Image conversion failed."));
    }, "image/png");
  });

  const data = new Uint8Array(await blob.arrayBuffer());

  // Keep images within a reasonable Word document width.
  const width = Math.min(
    Number(requestedWidth) || naturalWidth,
    600
  );

  const height = width * (naturalHeight / naturalWidth);

  return new ImageRun({
    data,
    type: "png",
    transformation: {
      width,
      height,
    },
  });
};

const getTextRuns = async (nodes = []) => {
  const runs = [];

  for (const node of nodes) {
    if (node.type === "hardBreak") {
      runs.push(new TextRun({ break: 1 }));
      continue;
    }

    if (node.type === "image") {
      const imageRun = await getImageRun(
        node.attrs?.src,
        node.attrs?.width
      );

      if (imageRun) runs.push(imageRun);
      continue;
    }

    if (node.type !== "text") continue;

    const marks = node.marks || [];
    const textStyle = marks.find(
      (mark) => mark.type === "textStyle"
    )?.attrs || {};

    const highlight = marks.find(
      (mark) => mark.type === "highlight"
    )?.attrs?.color;

    const link = marks.find(
      (mark) => mark.type === "link"
    )?.attrs?.href;

    const run = new TextRun({
      text: node.text || "",
      bold: marks.some((mark) => mark.type === "bold"),
      italics: marks.some((mark) => mark.type === "italic"),
      strike: marks.some((mark) => mark.type === "strike"),
      underline: marks.some((mark) => mark.type === "underline")
        ? { type: "single" }
        : undefined,
      color: cleanColor(textStyle.color),
      font: textStyle.fontFamily,
      size: textStyle.fontSize
        ? Math.round(parseFloat(textStyle.fontSize) * 2)
        : undefined,
      shading: highlight
        ? { fill: cleanColor(highlight), type: "clear" }
        : undefined,
    });

    runs.push(
      link
        ? new ExternalHyperlink({ link, children: [run] })
        : run
    );
  }

  return runs;
};

const convertBlocksToDocx = async (nodes = []) => {
  const paragraphs = [];

  for (const node of nodes) {
    if (node.type === "paragraph" || node.type === "heading") {
      const alignmentMap = {
        left: AlignmentType.LEFT,
        center: AlignmentType.CENTER,
        right: AlignmentType.RIGHT,
        justify: AlignmentType.JUSTIFIED,
      };

      const level = node.attrs?.level;

      paragraphs.push(
        new Paragraph({
          heading:
            node.type === "heading"
              ? level === 1
                ? HeadingLevel.HEADING_1
                : level === 2
                  ? HeadingLevel.HEADING_2
                  : HeadingLevel.HEADING_3
              : undefined,
          alignment:
            alignmentMap[node.attrs?.textAlign] ||
            AlignmentType.LEFT,
          children: await getTextRuns(node.content || []),
        })
      );

      continue;
    }

    // Standalone images
    if (node.type === "image") {
      const imageRun = await getImageRun(
        node.attrs?.src,
        node.attrs?.width
      );

      if (imageRun) {
        const alignmentMap = {
          left: AlignmentType.LEFT,
          center: AlignmentType.CENTER,
          right: AlignmentType.RIGHT,
        };

        paragraphs.push(
          new Paragraph({
            alignment:
              alignmentMap[node.attrs?.align] ||
              AlignmentType.CENTER,
            children: [imageRun],
          })
        );
      }

      continue;
    }

    if (node.type === "bulletList" || node.type === "orderedList") {
      let number = 0;

      for (const item of node.content || []) {
        for (const paragraph of item.content || []) {
          if (paragraph.type !== "paragraph") continue;

          number += 1;

          paragraphs.push(
            new Paragraph({
              indent: { left: 720 },
              children: [
                new TextRun({
                  text:
                    node.type === "bulletList"
                      ? "• "
                      : `${number}. `,
                }),
                ...(await getTextRuns(paragraph.content || [])),
              ],
            })
          );
        }
      }

      continue;
    }

    if (node.type === "blockquote") {
      paragraphs.push(
        ...(await convertBlocksToDocx(node.content || []))
      );

      continue;
    }

    if (node.type === "table") {
      const rows = [];

      for (const row of node.content || []) {
        const cells = [];

        for (const cell of row.content || []) {
          const cellContent = await convertBlocksToDocx(
            cell.content || []
          );

          cells.push(
            new DocxTableCell({
              children: cellContent.length
                ? cellContent
                : [new Paragraph("")],
            })
          );
        }

        rows.push(
          new DocxTableRow({
            children: cells,
          })
        );
      }

      if (rows.length) {
        paragraphs.push(
          new DocxTable({
            rows,
            width: {
              size: 100,
              type: WidthType.PERCENTAGE,
            },
          })
        );
      }
    }
  }

  return paragraphs;
};

const prepareContentForSave = (node) => {
  if (!node || typeof node !== "object") return node;

  const next = { ...node };

  // Never save temporary signed URLs for images stored in Supabase.
  if (next.type === "image" && next.attrs?.storagePath) {
    next.attrs = {
      ...next.attrs,
      src: null,
    };
  }

  if (Array.isArray(next.content)) {
    next.content = next.content.map(prepareContentForSave);
  }

  return next;
};

const dataUrlToFile = (dataUrl, filename = "imported-image") => {
  const [header, base64] = dataUrl.split(",");
  const mimeType =
    header.match(/data:(.*?);base64/i)?.[1] || "image/png";

  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (character) =>
    character.charCodeAt(0)
  );

  const extension =
    mimeType.split("/")[1]?.replace("jpeg", "jpg") || "png";

  return new File([bytes], `${filename}.${extension}`, {
    type: mimeType,
  });
};

const uploadEmbeddedImages = async (node, userId, documentId) => {
  if (!node || typeof node !== "object") return node;

  const next = { ...node };

  if (
    next.type === "image" &&
    next.attrs?.src?.startsWith("data:image/")
  ) {
    const file = dataUrlToFile(
      next.attrs.src,
      next.attrs.alt || "imported-image"
    );

    const storagePath = await uploadDocumentImage(
      file,
      userId,
      documentId
    );

    const imageUrl = await getDocumentImageUrl(storagePath);

    next.attrs = {
      ...next.attrs,
      src: imageUrl,
      storagePath,
    };
  }

  if (Array.isArray(next.content)) {
    next.content = await Promise.all(
      next.content.map((child) =>
        uploadEmbeddedImages(child, userId, documentId)
      )
    );
  }

  return next;
};

const countWords = (text) => (text.trim().match(/\S+/g) || []).length;

export default function Documents() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
 const {
  registerNavigationGuard,
  blockedNavigation,
  allowNextNavigation,
} = useNavigationGuard();
  const isNewDocument =
  documentId === "new" || documentId.startsWith("new-");
const temporarySessionKey =
  user?.id && documentId
    ? `nova-doc-session:${user.id}:${documentId}`
    : null;
  const location = useLocation();
  const returnTo = location.state?.from || "/files";
  const returnLabel = returnTo === "/office" ? "Office" : "My Files";
  const creationPromiseRef = useRef(null);
  const skipNextTemporaryAutosaveRef = useRef(false);
  const pendingDocxFile = location.state?.pendingDocxFile || null;
  const pendingFileName = location.state?.fileName || "";

  
  const [sourceFileId, setSourceFileId] = useState(null);

  const [title, setTitle] = useState("Untitled document");
  const [content, setContent] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [hasEditedDocument, setHasEditedDocument] = useState(false);
  // Stores the last permanently saved document version.
  const savedVersionRef = useRef(null);
  const isInitializingDocumentRef = useRef(true);
  const [saveStatus, setSaveStatus] = useState("Loading document...");
  const [loadError, setLoadError] = useState("");
  const [showMoreTools, setShowMoreTools] = useState(false);

  // New editor workspace state
  const [activePanel, setActivePanel] = useState("");
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [matches, setMatches] = useState([]);
  const [activeMatch, setActiveMatch] = useState(0);
  const [pageSize, setPageSize] = useState("A4");
  const [pageMargins, setPageMargins] = useState("Normal");
  const [zoom, setZoom] = useState(100);
  const [fullscreen, setFullscreen] = useState(false);
  const [showInsertMenu, setShowInsertMenu] = useState(false);
  const insertButtonRef = useRef(null);
  const [insertMenuPosition, setInsertMenuPosition] = useState(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const insertMenuWrapRef = useRef(null);
  const insertDropdownRef = useRef(null);
  const moreMenuRef = useRef(null);
  const fileInputRef = useRef(null);
  const docxInputRef = useRef(null);
  const pageRef = useRef(null);
  const [importingDocx, setImportingDocx] = useState(false);
  const autoImportStartedRef = useRef(false);
  const [imageToolbarPosition, setImageToolbarPosition] = useState(null);
  const imageToolbarRef = useRef(null);
  const [updatingOriginal, setUpdatingOriginal] = useState(false);
  const [savingToMyFiles, setSavingToMyFiles] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [versionActionId, setVersionActionId] = useState(null);
  const [clearingHistory, setClearingHistory] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyleKit,
      Highlight.configure({ multicolor: true }),
      ResizableImage.configure({ inline: false, allowBase64: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      CharacterCount,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
      }),
    ],
    content: { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: {
      attributes: {
        class: "nova-document-editor",
        spellcheck: "true",
        "aria-label": "Document content",
      },
    },
onUpdate: ({ editor: currentEditor }) => {
  if (isInitializingDocumentRef.current) return;

  setContent(currentEditor.getJSON());
  setHasEditedDocument(true);
  setSaveStatus("Unsaved changes");
},
  });

const hasUnsavedChanges = loaded && hasEditedDocument;

  useEffect(() => {
  const handleBeforeUnload = (event) => {
    if (!hasUnsavedChanges) return;

    event.preventDefault();
    event.returnValue = "";
  };

  window.addEventListener("beforeunload", handleBeforeUnload);

  return () => {
    window.removeEventListener("beforeunload", handleBeforeUnload);
  };
}, [hasUnsavedChanges]);

const handleBackNavigation = () => {
  if (hasUnsavedChanges) {
    setShowUnsavedModal(true);
    return;
  }

  navigate(returnTo);
};

useEffect(() => {
  const guard = {
    isDirty: () => hasUnsavedChanges,

    onRequest: (destination) => {
      if (hasUnsavedChanges) {
        setPendingNavigation(destination);
        setShowUnsavedModal(true);
        return;
      }

      navigate(destination);
    },
  };

  return registerNavigationGuard(guard);
}, [registerNavigationGuard, hasUnsavedChanges, navigate]);

useEffect(() => {
  if (blockedNavigation) {
    setPendingNavigation(null);
    setShowUnsavedModal(true);
  }
}, [blockedNavigation]);

const confirmLeaveWithoutSaving = () => {
  setShowUnsavedModal(false);

  allowNextNavigation();

  if (blockedNavigation) {
    blockedNavigation.proceed();
    return;
  }

  const destination = pendingNavigation || returnTo;
  setPendingNavigation(null);
  navigate(destination);
};

  // Keep the image toolbar close to the selected image as the page scrolls.
  useEffect(() => {
    if (!editor) return;

    let frame = 0;
    const updateToolbarPosition = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!editor.isActive("image")) {
          setImageToolbarPosition(null);
          return;
        }

        const selectedImage = editor.view.dom.querySelector(".nova-resizable-image.is-selected");
        if (!selectedImage) return;

        const rect = selectedImage.getBoundingClientRect();

const toolbarRect = imageToolbarRef.current?.getBoundingClientRect();

const toolbarWidth =
  toolbarRect?.width || Math.min(760, window.innerWidth - 28);

const toolbarHeight = toolbarRect?.height || 58;

const left = Math.max(
  14,
  Math.min(
    rect.left + rect.width / 2 - toolbarWidth / 2,
    window.innerWidth - toolbarWidth - 14
  )
);

const spaceAbove = rect.top;
const top =
  spaceAbove > toolbarHeight + 20
    ? rect.top - toolbarHeight - 12
    : Math.min(
        rect.bottom + 12,
        window.innerHeight - toolbarHeight - 12
      );

setImageToolbarPosition({ top, left });
      });
    };

    editor.on("selectionUpdate", updateToolbarPosition);
    editor.on("transaction", updateToolbarPosition);
    window.addEventListener("scroll", updateToolbarPosition, true);
    window.addEventListener("resize", updateToolbarPosition);
    updateToolbarPosition();

    return () => {
      cancelAnimationFrame(frame);
      editor.off("selectionUpdate", updateToolbarPosition);
      editor.off("transaction", updateToolbarPosition);
      window.removeEventListener("scroll", updateToolbarPosition, true);
      window.removeEventListener("resize", updateToolbarPosition);
    };
  }, [editor]);

useEffect(() => {
  if (!editor || !documentId || !user?.id) return;

  let cancelled = false;

async function load() {
  // The DOCX has already been imported.
  // Don't initialise the editor again when its route state is cleared.
  if (autoImportStartedRef.current && !pendingDocxFile) {
    return;
  }

  setLoaded(false);
  isInitializingDocumentRef.current = true;
  setHasEditedDocument(false);
  setLoadError("");
    setSaveStatus(
      isNewDocument
        ? "Preparing document..."
        : "Loading document..."
    );

    try {
      let initialTitle = "Untitled document";
      let initialContent = {
        type: "doc",
        content: [{ type: "paragraph" }],
      };

let savedSession =
  documentId === "new" && !pendingDocxFile && temporarySessionKey
    ? sessionStorage.getItem(temporarySessionKey)
    : null;

      if (isNewDocument) {
        initialTitle =
          location.state?.fileName?.replace(/\.docx$/i, "") ||
          "Untitled document";

        setSourceFileId(location.state?.sourceFileId || null);
      } else {
        const document = await getDocument(documentId);

        if (cancelled) return;

        setSourceFileId(document.source_file_id || null);
        initialTitle = document.title || "Untitled document";

        const documentContent = document.content || initialContent;

        const restoreImageUrls = async (node) => {
          if (!node || typeof node !== "object") return node;

          const restoredNode = { ...node };

          if (
            restoredNode.type === "image" &&
            restoredNode.attrs?.storagePath
          ) {
            const imageUrl = await getDocumentImageUrl(
              restoredNode.attrs.storagePath
            );

            restoredNode.attrs = {
              ...restoredNode.attrs,
              src: imageUrl,
            };
          }

          if (Array.isArray(restoredNode.content)) {
            restoredNode.content = await Promise.all(
              restoredNode.content.map(restoreImageUrls)
            );
          }

          return restoredNode;
        };

        initialContent = await restoreImageUrls(documentContent);

        if (cancelled) return;
      }

// Capture the permanently saved version using TipTap's
// normalized document structure.
editor.commands.setContent(initialContent, {
  emitUpdate: false,
});

const permanentlySavedContent = editor.getJSON();

savedVersionRef.current = {
  title: initialTitle,
  content: JSON.stringify(permanentlySavedContent),
};

      // Restore any temporary editing session.
      if (savedSession) {
        try {
          const parsedSession = JSON.parse(savedSession);

          initialTitle = parsedSession.title || initialTitle;
          initialContent = parsedSession.content || initialContent;
        } catch (error) {
          console.error(
            "Unable to restore temporary document session:",
            error
          );
        }
      }

setTitle(initialTitle);
setContent(initialContent);

if (savedSession) {
  setHasEditedDocument(false);
} else {
  setHasEditedDocument(false);
}

      editor.commands.setContent(initialContent, {
        emitUpdate: false,
      });

      if (cancelled) return;

      setLoaded(true);

      // Import a Word document passed from My Files.
      if (
        pendingDocxFile &&
        !autoImportStartedRef.current &&
        !savedSession
      ) {
        autoImportStartedRef.current = true;

        await handleImportDocx(pendingDocxFile, {
          throwOnError: true,
        });

        if (cancelled) return;

        // Remove the pending file from route state to prevent re-importing.
        const {
          pendingDocxFile: _,
          ...remainingState
        } = location.state || {};

        navigate(location.pathname, {
          replace: true,
          state: remainingState,
        });
      } else if (savedSession) {
        setSaveStatus("Restored temporary session");
      } else if (pendingDocxFile) {
        setSaveStatus("Imported — temporarily saved");
      } else if (isNewDocument) {
        setSaveStatus("Unsaved changes");
      } else {
        setSaveStatus("All changes saved");
      }
      isInitializingDocumentRef.current = false;
    } catch (error) {
      if (cancelled) return;

      console.error("Unable to load document:", error);

      setLoadError(
        error.message ||
          "We couldn't open this document. Check that you have access and try again."
      );

      setSaveStatus("Couldn't load document");
    }
  }

  load();

  return () => {
    cancelled = true;
  };
}, [
  editor,
  documentId,
  user?.id,
  navigate,
  location.state,
]);


// Debounced temporary autosave for both new and existing documents.
useEffect(() => {
  if (
  !loaded ||
  !editor ||
  !content ||
  !temporarySessionKey ||
  !hasEditedDocument
) return;

if (skipNextTemporaryAutosaveRef.current) {
  skipNextTemporaryAutosaveRef.current = false;
  return;
}

  const timeout = window.setTimeout(() => {
    try {
      sessionStorage.setItem(
        temporarySessionKey,
        JSON.stringify({
          title: title.trim() || "Untitled document",
          content,
          updatedAt: new Date().toISOString(),
        })
      );

      setSaveStatus("Temporarily saved");
    } catch (error) {
      console.error("Unable to save temporary session:", error);
      setSaveStatus("Temporary save failed");
    }
  }, 800);

  return () => window.clearTimeout(timeout);
}, [
  loaded,
  editor,
  title,
  content,
  temporarySessionKey,
  hasEditedDocument,
]);


  const runCommand = useCallback((command) => {
    if (!editor) return;
    command(editor.chain().focus()).run();
  }, [editor]);

  const plainText = editor?.getText({ blockSeparator: "\n" }) || "";
  const stats = useMemo(() => {
    const text = plainText;
    const paragraphs = text.split(/\n+/).filter((part) => part.trim()).length;
    // Approximate pagination for display; actual page breaks are handled by print/CSS.
    const pages = Math.max(1, Math.ceil(text.length / (pageSize === "A4" ? 2600 : 2800)));
    return {
      words: countWords(text),
      characters: text.length,
      charactersNoSpaces: text.replace(/\s/g, "").length,
      paragraphs,
      pages,
      readingMinutes: Math.max(1, Math.ceil(countWords(text) / 200)),
    };
  }, [plainText, pageSize]);

  const refreshMatches = useCallback((query) => {
    if (!editor || !query.trim()) {
      setMatches([]);
      setActiveMatch(0);
      return;
    }
    const found = [];
    const needle = query.toLocaleLowerCase();
    editor.state.doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      let fromIndex = 0;
      const haystack = node.text.toLocaleLowerCase();
      while (fromIndex < haystack.length) {
        const index = haystack.indexOf(needle, fromIndex);
        if (index === -1) break;
        found.push({ from: pos + index, to: pos + index + query.length });
        fromIndex = index + Math.max(query.length, 1);
      }
    });
    setMatches(found);
    setActiveMatch(0);
  }, [editor]);

  useEffect(() => {
  const toolbar = imageToolbarRef.current;
  if (!toolbar) return;

  toolbar.style.setProperty(
    "--toolbar-top",
    `${imageToolbarPosition?.top ?? 12}px`
  );

  toolbar.style.setProperty(
    "--toolbar-left",
    `${imageToolbarPosition?.left ?? 14}px`
  );
}, [imageToolbarPosition]);

  useEffect(() => {
    refreshMatches(findText);
  }, [findText, content, refreshMatches]);

  const selectMatch = (index) => {
    if (!editor || !matches.length) return;
    const safeIndex = (index + matches.length) % matches.length;
    setActiveMatch(safeIndex);
    const match = matches[safeIndex];
    editor.chain().focus().setTextSelection({ from: match.from, to: match.to }).run();
  };

  const replaceCurrent = () => {
    if (!editor || !matches.length) return;
    const match = matches[activeMatch];
    editor.chain().focus().insertContentAt({ from: match.from, to: match.to }, replaceText).run();
  };

  const replaceAll = () => {
    if (!editor || !matches.length) return;
    // Replace from the end so earlier document positions remain valid.
    [...matches].reverse().forEach((match) => {
      editor.commands.insertContentAt({ from: match.from, to: match.to }, replaceText);
    });
    setMatches([]);
    setActiveMatch(0);
  };

const generateDocxBlob = async () => {
  if (!editor) {
    throw new Error("The document editor is not ready.");
  }

  const documentContent = editor.getJSON();

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: await convertBlocksToDocx(
          documentContent.content || []
        ),
      },
    ],
  });

  return await Packer.toBlob(doc);
};

const handleExportDocx = async () => {
  try {
    const blob = await generateDocxBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${title.trim() || "Untitled document"}.docx`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  } catch (error) {
    console.error("DOCX export failed:", error);
    alert("Unable to export document. Please try again.");
  }
};


const handleSaveToMyFiles = async () => {
  if (!editor || !user?.id || savingToMyFiles) return;

  try {
    setSavingToMyFiles(true);
    setSaveStatus("Saving to My Files...");

    const documentTitle = title.trim() || "Untitled document";

    // Generate the DOCX using the current editor content.
    const blob = await generateDocxBlob();

    if (isNewDocument) {
      // New documents are saved directly as DOCX files.
      // Embedded images are included inside the DOCX.
      await saveNewDocxToMyFiles(
        user.id,
        blob,
        documentTitle
      );
    } else {
      // Upload embedded Base64 images to permanent storage.
      const currentContent = editor.getJSON();

      const contentWithUploadedImages =
        await uploadEmbeddedImages(
          currentContent,
          user.id,
          documentId
        );

      // Save the document content with permanent image paths.
      await saveDocument(
        documentId,
        documentTitle,
        prepareContentForSave(contentWithUploadedImages)
      );

      // Save the DOCX copy to My Files.
      await saveDocumentDocxOutput(
        documentId,
        user.id,
        blob,
        documentTitle
      );

      // Update the editor with the permanently uploaded image URLs.
skipNextTemporaryAutosaveRef.current = true;

editor.commands.setContent(contentWithUploadedImages, {
  emitUpdate: false,
});

setContent(contentWithUploadedImages);
    }

    // Clear the temporary session only after all permanent saves succeed.
    if (temporarySessionKey) {
      sessionStorage.removeItem(temporarySessionKey);
    }

    savedVersionRef.current = {
  title: title.trim() || "Untitled document",
  content: JSON.stringify(editor.getJSON()),
};

    setSaveStatus("Saved to My Files");
    setHasEditedDocument(false);
  } catch (error) {
    console.error("Saving DOCX to My Files failed:", error);
    setSaveStatus("Save to My Files failed");

    alert(
      error.message ||
      "Unable to save this document to My Files."
    );
  } finally {
    setSavingToMyFiles(false);
  }
};


const handleUpdateOriginalDocx = async () => {
  if (!sourceFileId || !editor || updatingOriginal) return;

  const confirmed = window.confirm(
    "This will replace the original DOCX in your Files with your current NOVA Docs content. A backup will be created first. Continue?"
  );

  if (!confirmed) return;

  try {
    setUpdatingOriginal(true);

    const blob = await generateDocxBlob();

await updateOriginalDocx(
  sourceFileId,
  blob,
  title.trim() || "Untitled document"
);

savedVersionRef.current = {
  title: title.trim() || "Untitled document",
  content: JSON.stringify(editor.getJSON()),
};

setHasEditedDocument(false);

    if (temporarySessionKey) {
  sessionStorage.removeItem(temporarySessionKey);
}

setSaveStatus("Saved to My Files");

    alert("Original DOCX updated successfully. A backup was also created.");
  } catch (error) {
    console.error("Updating original DOCX failed:", error);
    alert(error.message || "Unable to update the original DOCX.");
  } finally {
    setUpdatingOriginal(false);
  }
};

const loadVersionHistory = async () => {
  if (!sourceFileId) return;

  try {
    setLoadingVersions(true);
    const result = await getDocxVersions(sourceFileId);
    setVersions(result || []);
  } catch (error) {
    console.error("Unable to load version history:", error);
    alert(error.message || "Unable to load version history.");
  } finally {
    setLoadingVersions(false);
  }
};

const handleOpenVersionHistory = async () => {
  setShowVersionHistory(true);
  await loadVersionHistory();
};

const handleDownloadVersion = async (version) => {
  try {
    setVersionActionId(version.id);

    const { blob } = await downloadDocxVersion(version.id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = version.file_name || "document-version.docx";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    console.error("Version download failed:", error);
    alert(error.message || "Unable to download this version.");
  } finally {
    setVersionActionId(null);
  }
};

const handleRestoreVersion = async (version) => {
  const confirmed = window.confirm(
    "Restore this version? Your current original DOCX will first be backed up, and the selected version will also replace the content in NOVA Docs."
  );

  if (!confirmed) return;

  try {
    setVersionActionId(version.id);

    // Retrieve the selected historical version.
    const { blob } = await downloadDocxVersion(version.id);

    // Restore the original DOCX in My Files.
    await restoreDocxVersion(sourceFileId, version.id);

    // Convert the restored version into a File for the editor importer.
    const restoredFile = new window.File(
      [blob],
      version.file_name || "restored-document.docx",
      {
        type:
          version.mime_type ||
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }
    );

    // Import the restored version into NOVA Docs.
    await handleImportDocx(restoredFile, {
  throwOnError: true,
});

    // Refresh the version history.
    await loadVersionHistory();

    alert(
      "Version restored successfully in NOVA Docs and My Files. Your previous original was backed up."
    );
  } catch (error) {
    console.error("Version restore failed:", error);
    alert(error.message || "Unable to restore this version.");
  } finally {
    setVersionActionId(null);
  }
};

const handleDeleteVersion = async (version) => {
  const confirmed = window.confirm(
    "Delete this saved version permanently? This will not affect your current original document."
  );

  if (!confirmed) return;

  try {
    setVersionActionId(version.id);

    await deleteDocxVersion(version.id);
    await loadVersionHistory();
  } catch (error) {
    console.error("Version deletion failed:", error);
    alert(error.message || "Unable to delete this version.");
  } finally {
    setVersionActionId(null);
  }
};

const handleClearVersionHistory = async () => {
  if (!sourceFileId || !versions.length) return;

  const confirmed = window.confirm(
    `Delete all ${versions.length} saved versions permanently? Your current original DOCX will not be deleted.`
  );

  if (!confirmed) return;

  try {
    setClearingHistory(true);

    await clearDocxVersionHistory(sourceFileId);
    await loadVersionHistory();

    alert("Version history cleared successfully.");
  } catch (error) {
    console.error("Unable to clear version history:", error);
    await loadVersionHistory();
    alert(error.message || "Unable to clear version history completely.");
  } finally {
    setClearingHistory(false);
  }
};

  const handlePrint = () => window.print();

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await pageRef.current?.requestFullscreen?.();
        setFullscreen(true);
      } else {
        await document.exitFullscreen?.();
        setFullscreen(false);
      }
    } catch (error) {
      console.error("Fullscreen is unavailable:", error);
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const insertDateTime = () => {
    if (!editor) return;
    runCommand((chain) => chain.insertContent(new Date().toLocaleString()));
    setShowInsertMenu(false);
  };

  const insertPageBreak = () => {
    if (!editor) return;
    // A visible page-break marker. True pagination requires a dedicated page-break extension.
    runCommand((chain) => chain.insertContent("<hr data-page-break='true' />"));
    setShowInsertMenu(false);
  };

  
const handleImageChoice = async (event) => {
  const file = event.target.files?.[0];

  if (!file || !editor) {
    event.target.value = "";
    return;
  }

  if (!file.type.startsWith("image/")) {
    alert("Please choose an image file.");
    event.target.value = "";
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert("Please choose an image smaller than 5 MB.");
    event.target.value = "";
    return;
  }

  try {
    setSaveStatus("Adding image...");

    const reader = new FileReader();

    const imageUrl = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = () =>
        reject(new Error("Unable to read the selected image."));

      reader.readAsDataURL(file);
    });

    editor
      .chain()
      .focus()
      .setImage({
        src: imageUrl,
        alt: file.name,
        storagePath: null,
      })
      .run();

    setSaveStatus("Image added — temporarily saved");
  } catch (error) {
    console.error("Image handling failed:", error);
    alert(error.message || "Unable to add image. Please try again.");
    setSaveStatus("Image handling failed");
  } finally {
    event.target.value = "";
  }
};

const handleImportDocx = async (
  eventOrFile,
  { throwOnError = false } = {}
) => {
  const file =
    eventOrFile instanceof File
      ? eventOrFile
      : eventOrFile.target.files?.[0];

  const resetInput = () => {
    if (!(eventOrFile instanceof File) && eventOrFile?.target) {
      eventOrFile.target.value = "";
    }
  };

  if (!file || !editor) {
    resetInput();
    return;
  }

  if (!file.name.toLowerCase().endsWith(".docx")) {
    alert("Please select a Microsoft Word .docx file.");
    resetInput();
    return;
  }

  const previousContent = editor.getJSON();
  const previousTitle = title;

  setImportingDocx(true);
  setSaveStatus("Importing Word document...");

  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });

    if (!result.value.trim()) {
      throw new Error("No readable document content was found in this file.");
    }

    // Convert the Word document into editor content.
    editor.commands.setContent(result.value, {
      emitUpdate: false,
    });

    // Keep imported images as temporary Base64 data URLs.
    // Do not upload images or save anything permanently.
    const importedContent = editor.getJSON();

    editor.commands.setContent(importedContent, {
      emitUpdate: false,
    });

    const importedTitle =
      file.name.replace(/\.docx$/i, "") || "Untitled document";

    setContent(importedContent);
    setTitle(importedTitle);
    setHasEditedDocument(false);
    setSaveStatus("Imported — temporarily saved");

    if (result.messages?.length) {
      console.info("DOCX import notes:", result.messages);
    }
  } catch (error) {
    console.error("DOCX import failed:", error);

    // Restore the previous editor content and title.
    editor.commands.setContent(previousContent, {
      emitUpdate: false,
    });

    setContent(previousContent);
    setTitle(previousTitle);
    setSaveStatus("Import failed");

    if (throwOnError) {
      throw error;
    }

    alert(error.message || "Unable to import this Word document.");
  } finally {
    setImportingDocx(false);
    resetInput();
  }
};


  const insertTable = () => {
    if (!editor) return;
    const inserted = editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();

    if (!inserted) {
      console.error("Tiptap could not insert a table. Check the Table, TableRow, TableHeader and TableCell extensions.");
      alert("The table could not be inserted. Please click inside the document and try again.");
      return;
    }
    setShowInsertMenu(false);
  };

  useEffect(() => {
  if (!showInsertMenu || !insertButtonRef.current) return;

  const updatePosition = () => {
    const rect = insertButtonRef.current?.getBoundingClientRect();
    if (!rect) return;

    setInsertMenuPosition({
      top: rect.bottom + 8,
      left: Math.min(rect.left, window.innerWidth - 225),
    });
  };

  updatePosition();

  window.addEventListener("resize", updatePosition);
  document.addEventListener("scroll", updatePosition, true);

  return () => {
    window.removeEventListener("resize", updatePosition);
    document.removeEventListener("scroll", updatePosition, true);
  };
}, [showInsertMenu]);

useEffect(() => {
  if (!showInsertMenu && !showMoreMenu) return;

  const handleOutsideClick = (event) => {
    const target = event.target;

    const clickedInsert =
      insertMenuWrapRef.current?.contains(target) ||
      insertDropdownRef.current?.contains(target);

    const clickedMore =
      moreMenuRef.current?.contains(target);

    if (!clickedInsert) {
      setShowInsertMenu(false);
    }

    if (!clickedMore) {
      setShowMoreMenu(false);
    }
  };

  const handleEscape = (event) => {
    if (event.key === "Escape") {
      setShowInsertMenu(false);
      setShowMoreMenu(false);
    }
  };

  document.addEventListener("pointerdown", handleOutsideClick);
  document.addEventListener("keydown", handleEscape);

  return () => {
    document.removeEventListener("pointerdown", handleOutsideClick);
    document.removeEventListener("keydown", handleEscape);
  };
}, [showInsertMenu, showMoreMenu]);

  if (loadError) {
    return (
      <main className="nova-document-page">
        <button
  type="button"
  className="nova-document-back"
  onClick={handleBackNavigation}
>
  <ArrowLeft size={18} />
  Back to {returnLabel}
</button>
        <p role="alert">{loadError}</p>
      </main>
    );
  }

  return (
    <main ref={pageRef} className={`nova-document-page ${fullscreen ? "is-fullscreen" : ""}`}>
      <header className="nova-document-header">
        <button
  type="button"
  className="nova-document-back"
  onClick={handleBackNavigation}
  aria-label={`Back to ${returnLabel}`}
>
  <ArrowLeft size={18} />
  <span>{returnLabel}</span>
</button>

        <div className="nova-document-heading">
          <input
            className="nova-document-title"
            value={title}
            onChange={(event) => {
  setTitle(event.target.value);
  setHasEditedDocument(true);
  setSaveStatus("Unsaved changes");
}}
            aria-label="Document title"
            placeholder="Untitled document"
            maxLength={200}
            disabled={!loaded}
          />
          <div className="nova-document-save-status" aria-live="polite">
            {saveStatus === "All changes saved" && <Check size={15} />}
            {saveStatus === "Saving..." && <Save size={15} />}
            <span>{saveStatus}</span>
          </div>
        </div>

        <div className="nova-document-header-actions">
          <div className="nova-collaborator-placeholder" title="Collaboration features coming soon">
            <span className="nova-avatar">N</span>
          </div>
          <button type="button" className="nova-header-action nova-share-button" disabled title="Document sharing integration is coming next">
            <Users size={17} /> Share
          </button>
          <button type="button" className="nova-header-action" disabled title="Comments are coming next">
            <MessageSquare size={17} /> Comments
          </button>
          <div
  className="nova-document-menu-wrap"
  ref={moreMenuRef}
>
            <button type="button" className="nova-icon-button" aria-label="More document options" onClick={() => {
  setShowInsertMenu(false);
  setShowMoreMenu((v) => !v);
}}>
              <MoreVertical size={19} />
            </button>
            {showMoreMenu && (
              <div className="nova-document-dropdown">
                <button type="button" onClick={() => { docxInputRef.current?.click(); setShowMoreMenu(false); }}><FileText size={16} /> Open Word document</button>
                <button type="button" onClick={handleExportDocx}><Download size={16} /> Export DOCX</button>
                <button type="button" onClick={handlePrint}><Printer size={16} /> Print</button>
                <button type="button" onClick={() => { setActivePanel("stats"); setShowMoreMenu(false); }}><BarChart3 size={16} /> Document stats</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <nav className="nova-document-toolbar" aria-label="Text formatting">
        <div className="nova-toolbar-main nova-toolbar-group nova-toolbar-history">
          <button type="button" title="Undo" aria-label="Undo" disabled={!editor || !editor.can().undo()} onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().undo().run()}><RotateCcw size={18} /></button>
          <button type="button" title="Redo" aria-label="Redo" disabled={!editor || !editor.can().redo()} onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().redo().run()}><RotateCw size={18} /></button>
        </div>
        <span className="nova-document-toolbar-divider" />
        <div className="nova-toolbar-group nova-toolbar-font">
          <button type="button" title="Heading 1" aria-label="Heading 1" className={editor?.isActive("heading", { level: 1 }) ? "active" : ""} onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand((chain) => chain.toggleHeading({ level: 1 }))}><Heading1 size={18} /></button>
          <button type="button" title="Heading 2" aria-label="Heading 2" className={editor?.isActive("heading", { level: 2 }) ? "active" : ""} onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand((chain) => chain.toggleHeading({ level: 2 }))}><Heading2 size={18} /></button>
          <select className="nova-font-family-select" aria-label="Font family" defaultValue="Arial" onChange={(e) => runCommand((chain) => chain.setFontFamily(e.target.value))}>
            <option>Arial</option><option>Inter</option><option>Georgia</option><option>Times New Roman</option><option>Courier New</option><option>Verdana</option>
          </select>
          <select className="nova-font-size-select" aria-label="Font size" defaultValue="12pt" onChange={(e) => runCommand((chain) => chain.setFontSize(e.target.value))}>
            {["8pt", "9pt", "10pt", "11pt", "12pt", "14pt", "16pt", "18pt", "20pt", "24pt", "28pt", "36pt"].map((size) => <option key={size} value={size}>{size.replace("pt", "")}</option>)}
          </select>
        </div>
        <span className="nova-document-toolbar-divider" />
        <div className="nova-toolbar-format nova-toolbar-group nova-toolbar-formatting">
          <button type="button" title="Bold" aria-label="Bold" className={editor?.isActive("bold") ? "active" : ""} onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand((chain) => chain.toggleBold())}><Bold size={18} /></button>
          <button type="button" title="Italic" aria-label="Italic" className={editor?.isActive("italic") ? "active" : ""} onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand((chain) => chain.toggleItalic())}><Italic size={18} /></button>
          <button type="button" title="Underline" aria-label="Underline" className={editor?.isActive("underline") ? "active" : ""} onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand((chain) => chain.toggleUnderline())}><UnderlineIcon size={18} /></button>
          <button type="button" title="Strikethrough" aria-label="Strikethrough" className={editor?.isActive("strike") ? "active" : ""} onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand((chain) => chain.toggleStrike())}><Strikethrough size={18} /></button>
          <ColorPicker label="Text colour" type="text" defaultColor="#202124" onSelect={(color) => runCommand((chain) => chain.setColor(color))} />
          <ColorPicker label="Text highlight" type="highlight" defaultColor="#fff176" onSelect={(color) => runCommand((chain) => chain.setHighlight({ color }))} />
        </div>
        <button type="button" className="nova-toolbar-more-toggle" aria-label="More formatting tools" aria-expanded={showMoreTools} onMouseDown={(e) => e.preventDefault()} onClick={() => setShowMoreTools((v) => !v)}>
          <MoreHorizontal size={19} /><span>More</span>
        </button>
        <div className={`nova-toolbar-advanced nova-toolbar-group ${showMoreTools ? "is-open" : ""}`}>
          {[
            { value: "left", Icon: AlignLeft, label: "Align left" },
            { value: "center", Icon: AlignCenter, label: "Align center" },
            { value: "right", Icon: AlignRight, label: "Align right" },
            { value: "justify", Icon: AlignJustify, label: "Justify" },
          ].map(({ value, Icon, label }) => (
            <button key={value} type="button" title={label} aria-label={label} className={editor?.isActive({ textAlign: value }) ? "active" : ""} onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand((chain) => chain.setTextAlign(value))}><Icon size={18} /></button>
          ))}
          <span className="nova-document-toolbar-divider" />
          <button type="button" title="Bulleted list" aria-label="Bulleted list" className={editor?.isActive("bulletList") ? "active" : ""} onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand((chain) => chain.toggleBulletList())}><List size={19} /></button>
          <button type="button" title="Numbered list" aria-label="Numbered list" className={editor?.isActive("orderedList") ? "active" : ""} onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand((chain) => chain.toggleOrderedList())}><ListOrdered size={19} /></button>
          <span className="nova-document-toolbar-divider" />
          <button type="button" title="Insert or edit link" aria-label="Insert or edit link" className={editor?.isActive("link") ? "active" : ""} onMouseDown={(e) => e.preventDefault()} onClick={() => {
            const previousUrl = editor?.getAttributes("link").href || "";
            const url = window.prompt("Enter URL:", previousUrl);
            if (url === null) return;
            if (!url.trim()) runCommand((chain) => chain.extendMarkRange("link").unsetLink());
            else runCommand((chain) => chain.extendMarkRange("link").setLink({ href: url.trim() }));
          }}><Link2 size={18} /></button>
          <button type="button" title="Remove link" aria-label="Remove link" disabled={!editor?.isActive("link")} onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand((chain) => chain.extendMarkRange("link").unsetLink())}><Unlink size={18} /></button>
          <button type="button" title="Remove text colour" aria-label="Remove text colour" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand((chain) => chain.unsetColor())}><span>A̸</span></button>
          <button type="button" title="Remove highlight" aria-label="Remove highlight" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand((chain) => chain.unsetHighlight())}><Highlighter size={18} /></button>
        </div>
        <span className="nova-document-toolbar-divider nova-export-divider" />
        {sourceFileId && (
  <button
    type="button"
    className="nova-export-docx-button"
    onClick={handleUpdateOriginalDocx}
    disabled={!loaded || !editor || updatingOriginal}
    title="Replace the original Word document in My Files"
  >
    <Save size={17} />
    <span>
      {updatingOriginal ? "Updating..." : "Update Original"}
    </span>
  </button>
)}

{sourceFileId && (
  <button
    type="button"
    className="nova-export-docx-button"
    onClick={handleOpenVersionHistory}
    disabled={!loaded || loadingVersions}
    title="View and manage saved document versions"
  >
    <Clock3 size={17} />
    <span>
      {loadingVersions ? "Loading History..." : "Version History"}
    </span>
  </button>
)}

{!sourceFileId && (
  <button
    type="button"
    className="nova-export-docx-button"
    onClick={handleSaveToMyFiles}
    disabled={!loaded || !editor || savingToMyFiles}
    title="Save a DOCX copy to My Files"
  >
    <Save size={17} />
    <span>{savingToMyFiles ? "Saving..." : "Save to My Files"}</span>
  </button>
)}

<button
  type="button"
  className="nova-export-docx-button"
  onClick={handleExportDocx}
  disabled={!loaded || !editor}
>
  <Download size={17} />
  <span>Export DOCX</span>
</button>

      </nav>

      <nav className="nova-document-tools-row" aria-label="Document tools">
        <button type="button" className="nova-document-tool-button" onClick={() => docxInputRef.current?.click()} disabled={!loaded || importingDocx}>
          <FileText size={17} /> {importingDocx ? "Importing..." : "Open Word"}
        </button>
        <input ref={docxInputRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden onChange={handleImportDocx} />
        <div
  className="nova-document-tool-menu-wrap"
  ref={insertMenuWrapRef}
>
          <button
  ref={insertButtonRef}
  type="button"
  className="nova-document-tool-button nova-insert-button"
  aria-expanded={showInsertMenu}
  onClick={() => {
    setShowMoreMenu(false);
    setShowInsertMenu((v) => !v);
  }}
>
  <FilePlus2 size={17} />
  Insert
</button>
        </div>
        <button type="button" className="nova-document-tool-button" onClick={insertTable} disabled={!loaded}><Table2 size={17} /> Insert table</button>
        <button type="button" className="nova-document-tool-button" onClick={() => runCommand((chain) => chain.addRowAfter())} disabled={!editor?.can().addRowAfter()} title="Add row below">+ Row</button>
        <button type="button" className="nova-document-tool-button" onClick={() => runCommand((chain) => chain.addColumnAfter())} disabled={!editor?.can().addColumnAfter()} title="Add column to the right">+ Column</button>
        <button type="button" className="nova-document-tool-button" onClick={() => runCommand((chain) => chain.deleteRow())} disabled={!editor?.can().deleteRow()} title="Delete selected row">− Row</button>
        <button type="button" className="nova-document-tool-button" onClick={() => runCommand((chain) => chain.deleteColumn())} disabled={!editor?.can().deleteColumn()} title="Delete selected column">− Column</button>
        <button type="button" className="nova-document-tool-button" onClick={() => runCommand((chain) => chain.deleteTable())} disabled={!editor?.can().deleteTable()} title="Delete current table">Delete table</button>
        <button type="button" className="nova-document-tool-button" onClick={() => fileInputRef.current?.click()} disabled={!loaded}><ImageIcon size={17} /> Image</button>
        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleImageChoice} />
        <button type="button" className="nova-document-tool-button" onClick={() => { setActivePanel("find"); setTimeout(() => document.querySelector(".nova-find-input")?.focus(), 0); }}><Search size={17} /> Find &amp; Replace</button>
        <button type="button" className="nova-document-tool-button" onClick={() => setActivePanel(activePanel === "page" ? "" : "page")}><FileText size={17} /> Page Setup</button>
        <button type="button" className="nova-document-tool-button" onClick={() => setActivePanel(activePanel === "stats" ? "" : "stats")}><BarChart3 size={17} /> Word Count</button>
        <button type="button" className="nova-document-tool-button" onClick={handlePrint}><Printer size={17} /> Print</button>
        <button type="button" className="nova-document-tool-button" onClick={toggleFullscreen}>{fullscreen ? <Minimize size={17} /> : <Maximize size={17} />} {fullscreen ? "Exit Full Screen" : "Full Screen"}</button>
      </nav>

      {showInsertMenu && insertMenuPosition &&
  createPortal(
    <div
      className="nova-document-dropdown nova-insert-dropdown"
      ref={insertDropdownRef}
      style={{
        position: "fixed",
        top: insertMenuPosition.top,
        left: insertMenuPosition.left,
        right: "auto",
        zIndex: 10000,
      }}
    >
      <button
        type="button"
        onClick={() => {
          runCommand((chain) => chain.setHorizontalRule());
          setShowInsertMenu(false);
        }}
      >
        <Minus size={16} /> Horizontal line
      </button>

      <button type="button" onClick={insertPageBreak}>
        <FileText size={16} /> Page-break marker
      </button>

      <button type="button" onClick={insertDateTime}>
        <CalendarClock size={16} /> Date &amp; time
      </button>

    </div>,
    document.body
  )
}

      {editor?.isActive("image") && (
  <div
    ref={imageToolbarRef}
    className="nova-image-context-toolbar"
    role="toolbar"
    aria-label="Image options"
  >
          <span className="nova-image-toolbar-label">Image</span>
          <button type="button" title="Align left" aria-label="Align left" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().updateAttributes("image", { align: "left", wrap: "none" }).run()}>
            <AlignStartHorizontal size={17} />
          </button>
          <button type="button" title="Align center" aria-label="Align center" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().updateAttributes("image", { align: "center", wrap: "none" }).run()}>
            <AlignCenterHorizontal size={17} />
          </button>
          <button type="button" title="Align right" aria-label="Align right" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().updateAttributes("image", { align: "right", wrap: "none" }).run()}>
            <AlignEndHorizontal size={17} />
          </button>
          <span className="nova-image-toolbar-divider" />
          <button type="button" title="Wrap text left" aria-label="Wrap text left" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().updateAttributes("image", { wrap: "left", align: "left" }).run()}>
            <WrapText size={17} /> Left
          </button>
          <button type="button" title="Wrap text right" aria-label="Wrap text right" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().updateAttributes("image", { wrap: "right", align: "right" }).run()}>
            <WrapText size={17} /> Right
          </button>
          <span className="nova-image-toolbar-divider" />
          <button type="button" title="Rotate left" aria-label="Rotate left" onMouseDown={(e) => e.preventDefault()} onClick={() => {
            const current = Number(editor.getAttributes("image").rotation) || 0;
            editor.chain().focus().updateAttributes("image", { rotation: (current - 90 + 360) % 360 }).run();
          }}>
            <RotateCcw size={17} />
          </button>
          <button type="button" title="Rotate right" aria-label="Rotate right" onMouseDown={(e) => e.preventDefault()} onClick={() => {
            const current = Number(editor.getAttributes("image").rotation) || 0;
            editor.chain().focus().updateAttributes("image", { rotation: (current + 90) % 360 }).run();
          }}>
            <RotateCw size={17} />
          </button>
          <button type="button" title="Edit alt text" aria-label="Edit alt text" onMouseDown={(e) => e.preventDefault()} onClick={() => {
            const current = editor.getAttributes("image").alt || "";
            const alt = window.prompt("Describe this image for accessibility:", current);
            if (alt !== null) editor.chain().focus().updateAttributes("image", { alt }).run();
          }}>
            Alt text
          </button>
          <button type="button" title="Delete image" aria-label="Delete image" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().deleteSelection().run()}>
            <Trash2 size={17} />
          </button>
        </div>
      )}

      <section className="nova-document-main-area">
        <div className="nova-document-workspace">
          <div
            className={`nova-document-paper nova-page-${pageSize.toLowerCase()}`}
            style={{
              "--nova-page-zoom": zoom / 100,
              "--nova-page-padding": pageMargins === "Narrow" ? "1.25in" : pageMargins === "Wide" ? "1.5in" : "1in",
            }}
          >
            {loaded ? <EditorContent editor={editor} /> : <p className="nova-document-loading">Opening your document...</p>}
          </div>
        </div>

        {activePanel && (
          <aside className="nova-document-sidepanels">
            {activePanel === "find" && (
              <section className="nova-document-panel">
                <header><h3><Search size={17} /> Find &amp; Replace</h3><button type="button" aria-label="Close panel" onClick={() => setActivePanel("")}><X size={17} /></button></header>
                <div className="nova-find-tabs"><span className="active">Find</span><span>Replace</span></div>
                <label className="nova-panel-label" htmlFor="nova-find">Find</label>
                <input id="nova-find" className="nova-find-input" value={findText} onChange={(e) => setFindText(e.target.value)} placeholder="Find in document..." />
                <div className="nova-find-result-row">
                  <span>{matches.length ? `${activeMatch + 1} of ${matches.length}` : findText ? "No matches" : "Enter text to search"}</span>
                  <div>
                    <button type="button" aria-label="Previous match" disabled={!matches.length} onClick={() => selectMatch(activeMatch - 1)}><ChevronUp size={17} /></button>
                    <button type="button" aria-label="Next match" disabled={!matches.length} onClick={() => selectMatch(activeMatch + 1)}><ChevronDown size={17} /></button>
                  </div>
                </div>
                <label className="nova-panel-label" htmlFor="nova-replace">Replace with</label>
                <input id="nova-replace" value={replaceText} onChange={(e) => setReplaceText(e.target.value)} placeholder="Replacement text..." />
                <div className="nova-panel-actions">
                  <button type="button" disabled={!matches.length} onClick={replaceCurrent}>Replace</button>
                  <button type="button" disabled={!matches.length} onClick={replaceAll}>Replace all</button>
                </div>
              </section>
            )}

            {activePanel === "stats" && (
              <section className="nova-document-panel">
                <header><h3><BarChart3 size={17} /> Document Stats</h3><button type="button" aria-label="Close panel" onClick={() => setActivePanel("")}><X size={17} /></button></header>
                <dl className="nova-document-stats">
                  <div><dt>Words</dt><dd>{stats.words.toLocaleString()}</dd></div>
                  <div><dt>Characters (no spaces)</dt><dd>{stats.charactersNoSpaces.toLocaleString()}</dd></div>
                  <div><dt>Characters (with spaces)</dt><dd>{stats.characters.toLocaleString()}</dd></div>
                  <div><dt>Paragraphs</dt><dd>{stats.paragraphs.toLocaleString()}</dd></div>
                  <div><dt>Estimated pages ({pageSize})</dt><dd>{stats.pages}</dd></div>
                  <div><dt>Reading time</dt><dd>{stats.readingMinutes} min</dd></div>
                </dl>
                <p className="nova-panel-note">Page count is an estimate based on text length and may differ from printed pagination.</p>
              </section>
            )}

            {activePanel === "page" && (
              <section className="nova-document-panel">
                <header><h3><FileText size={17} /> Page Setup</h3><button type="button" aria-label="Close panel" onClick={() => setActivePanel("")}><X size={17} /></button></header>
                <label className="nova-panel-setting"><span>Page size</span>
                  <select value={pageSize} onChange={(e) => setPageSize(e.target.value)}>
                    <option value="A4">A4 (210 × 297 mm)</option>
                    <option value="Letter">Letter (8.5 × 11 in)</option>
                    <option value="Legal">Legal (8.5 × 14 in)</option>
                  </select>
                </label>
                <label className="nova-panel-setting"><span>Margins</span>
                  <select value={pageMargins} onChange={(e) => setPageMargins(e.target.value)}>
                    <option value="Normal">Normal (2.54 cm)</option>
                    <option value="Narrow">Narrow (1.27 cm)</option>
                    <option value="Wide">Wide (3.81 cm)</option>
                  </select>
                </label>
                <p className="nova-panel-note">These settings update the editor page preview. DOCX page-layout export will be added separately.</p>
              </section>
            )}
          </aside>
        )}
      </section>

      <footer className="nova-document-statusbar">
        <span>Page 1 of {stats.pages}</span>
        <div className="nova-statusbar-right">
          <span>Words: {stats.words}</span>
          <span className="nova-statusbar-divider" />
          <span>Characters: {stats.characters}</span>
          <div className="nova-zoom-controls">
            <button type="button" aria-label="Zoom out" disabled={zoom <= 50} onClick={() => setZoom((v) => Math.max(50, v - 10))}><Minus size={15} /></button>
            <span>{zoom}%</span>
            <button type="button" aria-label="Zoom in" disabled={zoom >= 150} onClick={() => setZoom((v) => Math.min(150, v + 10))}><Plus size={15} /></button>
          </div>
        </div>
      </footer>

            {showVersionHistory && (
        <div
          className="nova-version-history-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowVersionHistory(false);
            }
          }}
        >
          <div
            className="nova-version-history-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nova-version-history-title"
          >
            <div className="nova-version-history-header">
              <div>
                <h2 id="nova-version-history-title">Version History</h2>
                <p>
                  View and manage backups of your original Word document.
                </p>
              </div>

              <button
                type="button"
                className="nova-version-history-close"
                onClick={() => setShowVersionHistory(false)}
                aria-label="Close version history"
              >
                ×
              </button>
            </div>

            <div className="nova-version-history-content">
              <div className="nova-version-history-toolbar">
                <span>
                  {versions.length} saved{" "}
                  {versions.length === 1 ? "version" : "versions"}
                </span>

                <button
                  type="button"
                  className="nova-version-clear-button"
                  onClick={handleClearVersionHistory}
                  disabled={
                    !versions.length ||
                    loadingVersions ||
                    clearingHistory ||
                    Boolean(versionActionId)
                  }
                >
                  {clearingHistory ? "Clearing..." : "Clear History"}
                </button>
              </div>

              {loadingVersions ? (
                <div className="nova-version-history-empty">
                  Loading version history...
                </div>
              ) : versions.length === 0 ? (
                <div className="nova-version-history-empty">
                  <h3>No saved versions yet</h3>
                  <p>
                    NOVA automatically creates a backup whenever you update
                    your original DOCX document.
                  </p>
                </div>
              ) : (
                <div className="nova-version-list">
                  {versions.map((version) => (
                    <div
                      className="nova-version-item"
                      key={version.id}
                    >
                      <div className="nova-version-info">
                        <h3>{version.file_name}</h3>

                        <p>
                          {new Date(version.created_at).toLocaleString()}
                        </p>

                        <span>
                          {(
                            Number(version.size_bytes || 0) /
                            (1024 * 1024)
                          ).toFixed(2)}{" "}
                          MB
                        </span>
                      </div>

                      <div className="nova-version-actions">
                        <button
                          type="button"
                          onClick={() => handleDownloadVersion(version)}
                          disabled={
                            Boolean(versionActionId) || clearingHistory
                          }
                        >
                          Download
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRestoreVersion(version)}
                          disabled={
                            Boolean(versionActionId) || clearingHistory
                          }
                        >
                          Restore
                        </button>

                        <button
                          type="button"
                          className="nova-version-delete-button"
                          onClick={() => handleDeleteVersion(version)}
                          disabled={
                            Boolean(versionActionId) || clearingHistory
                          }
                        >
                          Delete
                        </button>
                      </div>

                      {versionActionId === version.id && (
                        <p className="nova-version-action-status">
                          Processing...
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="nova-version-history-footer">
              <p>
                Restoring a version first backs up your current original
                document.
              </p>

              <button
                type="button"
                onClick={() => setShowVersionHistory(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {showUnsavedModal && (
  <div className="nova-unsaved-overlay">
    <div
      className="nova-unsaved-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nova-unsaved-title"
    >
      <div className="nova-unsaved-icon">
        <AlertCircle size={24} />
      </div>

      <h2 id="nova-unsaved-title">Leave without saving?</h2>

      <p>
        You have unsaved changes. If you leave now, your latest
        changes won't be permanently saved.
      </p>

      <div className="nova-unsaved-actions">
        <button
          type="button"
          className="nova-unsaved-stay"
          onClick={() => {
  setShowUnsavedModal(false);
  setPendingNavigation(null);
  blockedNavigation?.reset();
}}
        >
          Keep editing
        </button>

        <button
          type="button"
          className="nova-unsaved-leave"
          onClick={confirmLeaveWithoutSaving}
        >
          Leave without saving
        </button>
      </div>
    </div>
  </div>
)}

    </main>
  );
}
