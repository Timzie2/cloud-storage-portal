import { useAuth } from "../context/AuthContext";
import React, { useEffect, useRef, useState } from "react";

import {
  Document,
  Page,
  pdfjs,
} from "react-pdf";

import {
  Scissors,
  ArrowLeft,
  FilePlus2,
  FileText,
  Files,
  Download,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Folder,
  Search,
  Home,
} from "lucide-react";

import {
  saveNewPdfToMyFiles,
  getUserFiles,
  getFileBlob,
} from "../services/files";

import { getUserFolders } from "../services/folders";

import { useNavigate } from "react-router-dom";
import { PDFDocument } from "pdf-lib";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import "../styles/split-pdf.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

function SplitPDF() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const fileInputRef = useRef(null);
  // ========================================
// PDF FILE STATES
// ========================================

const [selectedFile, setSelectedFile] = useState(null);
const [pageCount, setPageCount] = useState(0);
const [isLoading, setIsLoading] = useState(false);
const [splitMode, setSplitMode] = useState("individual");
const [pageRanges, setPageRanges] = useState("");

// ========================================
// SPLIT PDF RESULT STATES
// ========================================

const [splitResults, setSplitResults] = useState([]);
const [isSplitting, setIsSplitting] = useState(false);
const [isSaving, setIsSaving] = useState(false);
const [saveSuccess, setSaveSuccess] = useState("");

// ========================================
// PDF PREVIEW STATES
// ========================================

const [showPreview, setShowPreview] = useState(false);
const [previewPageNumber, setPreviewPageNumber] = useState(1);
const [previewScale, setPreviewScale] = useState(1);
const [previewLoading, setPreviewLoading] = useState(false);

// ========================================
// MY FILES PICKER STATES
// ========================================

const [showFilePicker, setShowFilePicker] = useState(false);
const [cloudFiles, setCloudFiles] = useState([]);
const [cloudFolders, setCloudFolders] = useState([]);
const [currentFolderId, setCurrentFolderId] = useState(null);
const [folderPath, setFolderPath] = useState([]);
const [fileSearch, setFileSearch] = useState("");
const [isLoadingCloudFiles, setIsLoadingCloudFiles] = useState(false);
const [isLoadingCloudPdf, setIsLoadingCloudPdf] = useState(false);


// ========================================
// MY FILES PICKER HANDLERS
// ========================================

const loadCloudPickerData = async () => {
  if (!user?.id) return;

  setIsLoadingCloudFiles(true);

  try {
    const [files, folders] = await Promise.all([
      getUserFiles(user.id),
      getUserFolders(user.id),
    ]);

    setCloudFiles(files || []);
    setCloudFolders(folders || []);
  } catch (error) {
    console.error("Error loading My Files:", error);
    alert("Could not load your files. Please try again.");
  } finally {
    setIsLoadingCloudFiles(false);
  }
};

const openFilePicker = async () => {
  setCurrentFolderId(null);
  setFolderPath([]);
  setFileSearch("");
  setShowFilePicker(true);

  await loadCloudPickerData();
};

const handleOpenCloudFolder = (folder) => {
  setCurrentFolderId(folder.id);
  setFolderPath((previous) => [...previous, folder]);
};

const handleGoToCloudFolder = (index) => {
  if (index === -1) {
    setCurrentFolderId(null);
    setFolderPath([]);
    return;
  }

  setCurrentFolderId(folderPath[index].id);
  setFolderPath((previous) => previous.slice(0, index + 1));
};


const visibleCloudFolders = cloudFolders.filter(
  (folder) => folder.parent_id === currentFolderId
);

const visibleCloudPdfFiles = cloudFiles.filter((file) => {
  const isInCurrentFolder = file.folder_id === currentFolderId;

  const isPdf =
    file.mime_type === "application/pdf" ||
    file.name?.toLowerCase().endsWith(".pdf");

  const matchesSearch = file.name
    ?.toLowerCase()
    .includes(fileSearch.toLowerCase());

  return isInCurrentFolder && isPdf && matchesSearch;
});


const loadPdfFile = async (file) => {
  if (!file) return;

  const isPdf =
    file.type === "application/pdf" ||
    file.name?.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    alert("Please select a valid PDF file.");
    return;
  }

  try {
    setIsLoading(true);
    setSplitResults([]);
    setSaveSuccess("");
    setPageRanges("");

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);

    setSelectedFile(file);
    setPageCount(pdf.getPageCount());
    setPreviewPageNumber(1);
    setPreviewScale(1);
    setShowPreview(false);
    return true;
  } catch (error) {
    console.error("Could not load PDF:", error);
    alert("This PDF could not be opened. Please select another file.");
    setSelectedFile(null);
    setPageCount(0);
    return false;
  } finally {
    setIsLoading(false);
  }
};

const handleFileSelected = async (event) => {
  const file = event.target.files?.[0];

  if (!file) return;

  await loadPdfFile(file);

  event.target.value = "";
};


const handleSelectCloudPdf = async (file) => {
  if (!file?.storage_path) {
    alert("This file has no valid storage location.");
    return;
  }

  try {
    setIsLoadingCloudPdf(true);

    const blob = await getFileBlob(file.storage_path);

    const pdfFile = new File([blob], file.name, {
      type: "application/pdf",
    });

    const loaded = await loadPdfFile(pdfFile);

    if (loaded) {
      setShowFilePicker(false);
    }
  } catch (error) {
    console.error("Could not load PDF from My Files:", error);
    alert(error.message || "Could not load this PDF from My Files.");
  } finally {
    setIsLoadingCloudPdf(false);
  }
};


// ========================================
// SPLIT PDF
// ========================================

const handleSplitPdf = async () => {
  if (!selectedFile || !pageCount || isSplitting) return;

  try {
    setIsSplitting(true);
    setSplitResults([]);
    setSaveSuccess("");

    const arrayBuffer = await selectedFile.arrayBuffer();
    const sourcePdf = await PDFDocument.load(arrayBuffer);

    let groups = [];

    if (splitMode === "individual") {
      // Each page becomes a separate PDF.
      groups = Array.from(
        { length: pageCount },
        (_, index) => [index]
      );
    } else {
      // Parse custom page ranges.
      const ranges = pageRanges
        .split(",")
        .map((range) => range.trim())
        .filter(Boolean);

      if (!ranges.length) {
        alert("Enter at least one page range.");
        return;
      }

      groups = ranges.map((range) => {
        const match = range.match(/^(\d+)(?:\s*-\s*(\d+))?$/);

        if (!match) {
          throw new Error(`Invalid page range: ${range}`);
        }

        const start = Number(match[1]);
        const end = Number(match[2] || match[1]);

        if (
          start < 1 ||
          end > pageCount ||
          start > end
        ) {
          throw new Error(
            `Page range "${range}" is outside the valid page range (1-${pageCount}).`
          );
        }

        return Array.from(
          { length: end - start + 1 },
          (_, index) => start - 1 + index
        );
      });
    }

    const results = [];

    for (let index = 0; index < groups.length; index++) {
      const newPdf = await PDFDocument.create();

      const copiedPages = await newPdf.copyPages(
        sourcePdf,
        groups[index]
      );

      copiedPages.forEach((page) => newPdf.addPage(page));

      const bytes = await newPdf.save();

      const blob = new Blob([bytes], {
        type: "application/pdf",
      });

      const url = URL.createObjectURL(blob);

      results.push({
        id: crypto.randomUUID(),
        name: `split-${index + 1}.pdf`,
        blob,
        url,
        pageCount: groups[index].length,
        saved: false,
      });
    }

    setSplitResults(results);
  } catch (error) {
    console.error("PDF split failed:", error);
    alert(error.message || "Something went wrong while splitting your PDF.");
  } finally {
    setIsSplitting(false);
  }
};

// ========================================
// DOWNLOAD SPLIT PDF
// ========================================

const handleDownloadSplit = (result) => {
  const link = document.createElement("a");

  link.href = result.url;
  link.download = result.name;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// ========================================
// SAVE SPLIT PDF TO MY FILES
// ========================================

const handleSaveSplit = async (result) => {
  if (!user?.id || !result || isSaving || result.saved) return;

  try {
    setIsSaving(true);
    setSaveSuccess("");

    await saveNewPdfToMyFiles(
      user.id,
      result.blob,
      result.name
    );

    setSplitResults((previous) =>
      previous.map((item) =>
        item.id === result.id
          ? { ...item, saved: true }
          : item
      )
    );

    setSaveSuccess(`${result.name} saved successfully to My Files!`);
  } catch (error) {
    console.error("Could not save split PDF:", error);

    alert(error.message || "Unable to save PDF to My Files.");
  } finally {
    setIsSaving(false);
  }
};

// ========================================
// PDF PREVIEW CONTROLS
// ========================================

const handlePreviewOpen = () => {
  setShowPreview(true);
  setPreviewPageNumber(1);
  setPreviewScale(1);
};

const handlePreviewClose = () => {
  setShowPreview(false);
};

const handleDocumentLoad = ({ numPages }) => {
  setPreviewPageNumber(1);
  setPreviewLoading(false);
};

const handlePageChange = (page) => {
  if (page < 1 || page > pageCount) return;

  setPreviewPageNumber(page);
};

const handleZoomIn = () => {
  setPreviewScale((previous) =>
    Math.min(2, Number((previous + 0.1).toFixed(2)))
  );
};

const handleZoomOut = () => {
  setPreviewScale((previous) =>
    Math.max(0.5, Number((previous - 0.1).toFixed(2)))
  );
};

const handleZoomReset = () => {
  setPreviewScale(1);
};


// ========================================
// LOCK BACKGROUND SCROLL WHILE PICKER IS OPEN
// ========================================

useEffect(() => {
  if (!showFilePicker) return;

  const previousOverflow = document.body.style.overflow;
  const previousPaddingRight = document.body.style.paddingRight;

  const scrollbarWidth =
    window.innerWidth - document.documentElement.clientWidth;

  document.body.style.overflow = "hidden";

  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`;
  }

  return () => {
    document.body.style.overflow = previousOverflow;
    document.body.style.paddingRight = previousPaddingRight;
  };
}, [showFilePicker]);


  return (
    <div className="nova-split-pdf">
      <header className="split-pdf-header">
        <button
          type="button"
          className="split-pdf-back"
          onClick={() => navigate("/office")}
        >
          <ArrowLeft size={18} />
          Back to Office
        </button>

        <div>
          <h1>Split PDF</h1>
          <p>Separate PDF pages into individual documents.</p>
        </div>
      </header>

      <main className="split-pdf-content">

        {/* INTRODUCTION */}
        <div className="split-pdf-intro">
          <div className="split-pdf-icon">
            <Scissors size={30} />
          </div>

          <h2>Separate your PDF pages</h2>

          <p>
            Upload a PDF document and choose how you want to
            split its pages into separate files.
          </p>
        </div>

        {/* PDF UPLOAD */}
        <div className="split-pdf-upload-area">

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={handleFileSelected}
          />

          <FilePlus2 size={38} />

          <h3>{selectedFile ? "PDF selected" : "Choose a PDF file"}</h3>

          <p>
            {selectedFile
              ? selectedFile.name
              : "Select the PDF document you want to split."}
          </p>

          {isLoading && <span>Loading PDF...</span>}

          <button
            type="button"
            className="split-pdf-upload-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isSplitting}
          >
            <FilePlus2 size={17} />
            {selectedFile ? "Choose another PDF" : "Select PDF"}
          </button>


<button
  type="button"
  className="split-pdf-cloud-button"
  onClick={openFilePicker}
  disabled={isLoading || isSplitting}
>
  <Folder size={17} />
  Choose from My Files
</button>


          {selectedFile && (
            <div className="split-pdf-file-details">
              <FileText size={20} />
              <span>{selectedFile.name}</span>
              <strong>
                {pageCount} {pageCount === 1 ? "page" : "pages"}
              </strong>
            </div>
          )}
        </div>

        {/* SPLIT OPTIONS */}
        {selectedFile && (
          <div className="split-pdf-options">

            <h3>How would you like to split your PDF?</h3>

            <div className="split-pdf-mode-options">

              <button
                type="button"
                className={
                  splitMode === "individual" ? "active" : ""
                }
                onClick={() => setSplitMode("individual")}
              >
                <Files size={22} />
                <strong>Every page</strong>
                <span>
                  Create a separate PDF for each page.
                </span>
              </button>

              <button
                type="button"
                className={
                  splitMode === "ranges" ? "active" : ""
                }
                onClick={() => setSplitMode("ranges")}
              >
                <FileText size={22} />
                <strong>Custom ranges</strong>
                <span>
                  Choose specific pages or page ranges.
                </span>
              </button>

            </div>

            {splitMode === "individual" && (
              <p className="split-pdf-option-description">
                Your {pageCount} pages will become {pageCount} separate PDF files.
              </p>
            )}

            {splitMode === "ranges" && (
              <div className="split-pdf-range-input">
                <label htmlFor="split-page-ranges">
                  Enter page ranges
                </label>

                <input
                  id="split-page-ranges"
                  type="text"
                  value={pageRanges}
                  onChange={(event) => setPageRanges(event.target.value)}
                  placeholder="Example: 1-3, 5, 7-9"
                />

                <span>
                  Separate ranges with commas. Valid pages: 1–{pageCount}.
                </span>
              </div>
            )}

            <div className="split-pdf-main-actions">

              <button
                type="button"
                onClick={handlePreviewOpen}
                disabled={isSplitting}
              >
                <Eye size={17} />
                Preview PDF
              </button>

              <button
                type="button"
                onClick={handleSplitPdf}
                disabled={
                  isSplitting ||
                  (splitMode === "ranges" && !pageRanges.trim())
                }
              >
                {isSplitting ? (
                  <>
                    <RefreshCw
                      size={17}
                      className="split-pdf-spinner"
                    />
                    Splitting PDF...
                  </>
                ) : (
                  <>
                    <Scissors size={17} />
                    Split PDF
                  </>
                )}
              </button>

            </div>
          </div>
        )}

        {/* SPLIT RESULTS */}
        {splitResults.length > 0 && (
          <div className="split-pdf-results">

            <div className="split-pdf-results-header">
              <div>
                <h3>PDF split successfully!</h3>
                <p>
                  {splitResults.length} separate PDF files created.
                </p>
              </div>

              <Scissors size={27} />
            </div>

            {splitResults.map((result, index) => (
              <div className="split-pdf-result-item" key={result.id}>

                <div className="split-pdf-result-info">
                  <FileText size={22} />

                  <div>
                    <strong>{result.name}</strong>
                    <span>
                      {result.pageCount}{" "}
                      {result.pageCount === 1 ? "page" : "pages"}
                    </span>
                  </div>
                </div>

                <div className="split-pdf-result-actions">

                  <button
                    type="button"
                    onClick={() => handleDownloadSplit(result)}
                  >
                    <Download size={16} />
                    Download
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveSplit(result)}
                    disabled={isSaving || result.saved}
                  >
                    <FilePlus2 size={16} />
                    {result.saved ? "Saved" : "Save to My Files"}
                  </button>

                </div>
              </div>
            ))}

            {saveSuccess && (
              <p className="split-pdf-save-success">
                {saveSuccess}
              </p>
            )}

          </div>
        )}

                {/* ========================================
            NOVA PDF PREVIEW
        ======================================== */}

        {showPreview && selectedFile && (
          <div className="split-pdf-viewer">

            {/* VIEWER TOOLBAR */}
            <div className="split-pdf-viewer-toolbar">

              <div className="split-pdf-viewer-title">
                <FileText size={18} />
                <span>{selectedFile.name}</span>
              </div>

              <div className="split-pdf-viewer-controls">

                <button
                  type="button"
                  title="Previous page"
                  disabled={previewPageNumber <= 1}
                  onClick={() =>
                    handlePageChange(previewPageNumber - 1)
                  }
                >
                  <ChevronLeft size={18} />
                </button>

                <span className="split-pdf-page-counter">
                  {previewPageNumber} / {pageCount || "..."}
                </span>

                <button
                  type="button"
                  title="Next page"
                  disabled={previewPageNumber >= pageCount}
                  onClick={() =>
                    handlePageChange(previewPageNumber + 1)
                  }
                >
                  <ChevronRight size={18} />
                </button>

                <div className="split-pdf-toolbar-divider" />

                <button
                  type="button"
                  title="Zoom out"
                  disabled={previewScale <= 0.5}
                  onClick={handleZoomOut}
                >
                  <ZoomOut size={18} />
                </button>

                <button
                  type="button"
                  className="split-pdf-zoom-level"
                  title="Reset zoom"
                  onClick={handleZoomReset}
                >
                  {Math.round(previewScale * 100)}%
                </button>

                <button
                  type="button"
                  title="Zoom in"
                  disabled={previewScale >= 2}
                  onClick={handleZoomIn}
                >
                  <ZoomIn size={18} />
                </button>

                <div className="split-pdf-toolbar-divider" />

                <button
                  type="button"
                  title="Close preview"
                  onClick={handlePreviewClose}
                >
                  <X size={18} />
                </button>

              </div>
            </div>

            {/* PDF DOCUMENT */}
            <Document
              file={selectedFile}
              onLoadSuccess={handleDocumentLoad}
              onLoadError={(error) => {
                console.error("Preview loading failed:", error);
                setPreviewLoading(false);
              }}
              onLoadStart={() => setPreviewLoading(true)}
              loading={
                <div className="split-pdf-viewer-loading">
                  Loading PDF...
                </div>
              }
              error={
                <div className="split-pdf-viewer-error">
                  Unable to display this PDF.
                </div>
              }
              className="split-pdf-document"
            >

              {/* THUMBNAIL SIDEBAR */}
              <aside className="split-pdf-thumbnails">

                <div className="split-pdf-thumbnails-heading">
                  Pages
                </div>

                {Array.from(
                  { length: pageCount },
                  (_, index) => index + 1
                ).map((page) => (

                  <button
                    type="button"
                    key={page}
                    className={`split-pdf-thumbnail ${
                      previewPageNumber === page ? "active" : ""
                    }`}
                    onClick={() => handlePageChange(page)}
                  >
                    <Page
                      pageNumber={page}
                      width={110}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />

                    <span>{page}</span>
                  </button>

                ))}

              </aside>

              {/* MAIN DOCUMENT CANVAS */}
              <section className="split-pdf-document-canvas">

                {pageCount > 0 && (
                  <div className="split-pdf-page-wrapper">
                    <Page
                      pageNumber={previewPageNumber}
                      width={Math.round(650 * previewScale)}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                  </div>
                )}

              </section>

            </Document>

          </div>
        )}


{/* ========================================
    MY FILES PDF PICKER
======================================== */}

{showFilePicker && (
  <div className="split-pdf-picker-overlay">
    <div className="split-pdf-picker-modal">

      <div className="split-pdf-picker-header">
        <div>
          <h2>Choose from My Files</h2>
          <p>Select a PDF document to split.</p>
        </div>

        <button
          type="button"
          onClick={() => setShowFilePicker(false)}
          aria-label="Close file picker"
        >
          <X size={20} />
        </button>
      </div>

      <div className="split-pdf-picker-search">
        <Search size={18} />

        <input
          type="text"
          placeholder="Search PDF files..."
          value={fileSearch}
          onChange={(event) => setFileSearch(event.target.value)}
        />
      </div>

      {/* FOLDER BREADCRUMBS */}
      <div className="split-pdf-picker-breadcrumbs">
        <button
          type="button"
          onClick={() => handleGoToCloudFolder(-1)}
        >
          <Home size={15} />
          My Files
        </button>

        {folderPath.map((folder, index) => (
          <React.Fragment key={folder.id}>
            <span>/</span>

            <button
              type="button"
              onClick={() => handleGoToCloudFolder(index)}
            >
              {folder.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* FILE AND FOLDER LIST */}
      <div className="split-pdf-picker-list">

        {isLoadingCloudFiles ? (
          <div className="split-pdf-picker-empty">
            Loading your files...
          </div>
        ) : (
          <>
            {visibleCloudFolders.map((folder) => (
              <button
                type="button"
                className="split-pdf-picker-item"
                key={folder.id}
                onClick={() => handleOpenCloudFolder(folder)}
                disabled={isLoadingCloudPdf}
              >
                <Folder size={21} />

                <span>{folder.name}</span>

                <ChevronRight size={17} />
              </button>
            ))}

            {visibleCloudPdfFiles.map((file) => (
              <button
                type="button"
                className="split-pdf-picker-item"
                key={file.id}
                onClick={() => handleSelectCloudPdf(file)}
                disabled={isLoadingCloudPdf}
              >
                <FileText size={21} />

                <span>{file.name}</span>

                {isLoadingCloudPdf ? null : (
                  <small>PDF</small>
                )}
              </button>
            ))}

            {visibleCloudFolders.length === 0 &&
              visibleCloudPdfFiles.length === 0 && (
                <div className="split-pdf-picker-empty">
                  {fileSearch
                    ? "No matching PDF files found."
                    : "No PDF files or folders in this location."}
                </div>
              )}
          </>
        )}

        {isLoadingCloudPdf && (
          <div className="split-pdf-picker-loading">
            Loading selected PDF...
          </div>
        )}

      </div>

      <div className="split-pdf-picker-footer">
        <span>
          Only PDF documents are displayed.
        </span>

        <button
          type="button"
          onClick={() => setShowFilePicker(false)}
          disabled={isLoadingCloudPdf}
        >
          Cancel
        </button>
      </div>

    </div>
  </div>
)}


      </main>
    </div>
  );
}

export default SplitPDF;