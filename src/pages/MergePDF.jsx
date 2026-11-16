import { useAuth } from "../context/AuthContext";
import {
  saveNewPdfToMyFiles,
  getUserFiles,
  getFileBlob,
} from "../services/files";

import { getUserFolders } from "../services/folders";
import React, { useEffect, useRef, useState } from "react";

import {
  Document,
  Page,
  pdfjs,
} from "react-pdf";

import {
  FilePlus2,
  Files,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Trash2,
  Eye,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  FileText,
  RefreshCw,
  Folder,
  Search,
  Home,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { PDFDocument } from "pdf-lib";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import "../styles/merge-pdf.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

function MergePDF() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const fileInputRef = useRef(null);

  // ========================================
  // FILE SELECTION STATES
  // ========================================

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isMerging, setIsMerging] = useState(false);
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
const [cloudSelectedFiles, setCloudSelectedFiles] = useState([]);

  // ========================================
  // MERGED PDF STATES
  // ========================================

  const [mergedPdfUrl, setMergedPdfUrl] = useState(null);
  const [mergedPdfName, setMergedPdfName] = useState(
    "merged-document.pdf"
  );
  const [mergedPdfBlob, setMergedPdfBlob] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState("");

  // ========================================
  // PREVIEW STATES
  // ========================================

  const [showPreview, setShowPreview] = useState(false);
  const [previewNumPages, setPreviewNumPages] = useState(0);
  const [previewPageNumber, setPreviewPageNumber] = useState(1);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewLoading, setPreviewLoading] = useState(false);


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
  setCloudSelectedFiles([]);
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

// ========================================
// FILTER CLOUD FILES AND FOLDERS
// ========================================

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


// ========================================
// SELECT AND DESELECT CLOUD PDF FILES
// ========================================

const handleToggleCloudPdf = (file) => {
  setCloudSelectedFiles((previous) => {
    const alreadySelected = previous.some(
      (item) => item.id === file.id
    );

    if (alreadySelected) {
      return previous.filter((item) => item.id !== file.id);
    }

    return [...previous, file];
  });
};

// ========================================
// ADD SELECTED CLOUD PDFS TO MERGE LIST
// ========================================

const handleAddCloudPdfs = async () => {
  if (!cloudSelectedFiles.length || isLoadingCloudPdf) return;

  try {
    setIsLoadingCloudPdf(true);

    const newFiles = [];

    for (const cloudFile of cloudSelectedFiles) {
      // Prevent adding the same cloud file twice.
      const alreadyAdded = selectedFiles.some(
        (item) => item.cloudFileId === cloudFile.id
      );

      if (alreadyAdded) continue;

      const blob = await getFileBlob(cloudFile.storage_path);

      const pdfFile = new File([blob], cloudFile.name, {
        type: "application/pdf",
      });

      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);

      newFiles.push({
        id: crypto.randomUUID(),
        cloudFileId: cloudFile.id,
        file: pdfFile,
        pageCount: pdf.getPageCount(),
      });
    }

    if (newFiles.length > 0) {
      setSelectedFiles((previous) => [...previous, ...newFiles]);
    }

    setCloudSelectedFiles([]);
    setShowFilePicker(false);
  } catch (error) {
    console.error("Could not load selected PDFs:", error);
    alert(
      error.message || "Some selected PDFs could not be loaded."
    );
  } finally {
    setIsLoadingCloudPdf(false);
  }
};


  // Release generated PDF URLs when replaced or page unmounts
  useEffect(() => {
    return () => {
      if (mergedPdfUrl) {
        URL.revokeObjectURL(mergedPdfUrl);
      }
    };
  }, [mergedPdfUrl]);

  // ========================================
  // SELECT PDF FILES
  // ========================================

  const handleFilesSelected = async (event) => {
    const files = Array.from(event.target.files || []);
    const newFiles = [];

    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer();

        const pdf = await PDFDocument.load(arrayBuffer);

        newFiles.push({
          id: crypto.randomUUID(),
          file,
          pageCount: pdf.getPageCount(),
        });
      } catch (error) {
        console.error("Could not load PDF:", file.name, error);

        alert(
          `${file.name} could not be opened. Please select a valid PDF.`
        );
      }
    }

    setSelectedFiles((previous) => [
      ...previous,
      ...newFiles,
    ]);

    event.target.value = "";
  };

  // ========================================
  // REORDER PDF FILES
  // ========================================

  const moveFile = (index, direction) => {
    setSelectedFiles((previous) => {
      const updated = [...previous];
      const newIndex = index + direction;

      if (newIndex < 0 || newIndex >= updated.length) {
        return previous;
      }

      [updated[index], updated[newIndex]] = [
        updated[newIndex],
        updated[index],
      ];

      return updated;
    });
  };

  // ========================================
  // REMOVE PDF FILE
  // ========================================

  const removeFile = (id) => {
    setSelectedFiles((previous) =>
      previous.filter((item) => item.id !== id)
    );
  };

  // ========================================
  // MERGE PDF FILES
  // ========================================

  const handleMergePdfs = async () => {
    if (selectedFiles.length < 2) {
      alert("Please select at least two PDF files to merge.");
      return;
    }

    try {
      setIsMerging(true);

      const mergedPdf = await PDFDocument.create();

      for (const item of selectedFiles) {
        const arrayBuffer = await item.file.arrayBuffer();

        const sourcePdf = await PDFDocument.load(arrayBuffer);

        const copiedPages = await mergedPdf.copyPages(
          sourcePdf,
          sourcePdf.getPageIndices()
        );

        copiedPages.forEach((page) => {
          mergedPdf.addPage(page);
        });
      }

      const mergedPdfBytes = await mergedPdf.save();

      const blob = new Blob([mergedPdfBytes], {
        type: "application/pdf",
      });

      setMergedPdfBlob(blob);
      setSaveSuccess("");

      const url = URL.createObjectURL(blob);

      setMergedPdfUrl(url);
      setMergedPdfName("merged-document.pdf");

      setPreviewPageNumber(1);
      setPreviewNumPages(0);
      setPreviewScale(1);
      setShowPreview(false);

    } catch (error) {
      console.error("PDF merge failed:", error);

      alert("Something went wrong while merging your PDFs.");
    } finally {
      setIsMerging(false);
    }
  };

  // ========================================
  // DOWNLOAD MERGED PDF
  // ========================================

  const handleDownload = () => {
    if (!mergedPdfUrl) return;

    const link = document.createElement("a");

    link.href = mergedPdfUrl;
    link.download = mergedPdfName;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveToMyFiles = async () => {
  if (!user?.id || !mergedPdfBlob || isSaving) return;

  try {
    setIsSaving(true);
    setSaveSuccess("");

    await saveNewPdfToMyFiles(
      user.id,
      mergedPdfBlob,
      mergedPdfName
    );

    setSaveSuccess("PDF saved successfully to My Files!");
  } catch (error) {
    console.error("Could not save merged PDF:", error);

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
    setPreviewNumPages(numPages);
    setPreviewPageNumber(1);
    setPreviewLoading(false);
  };

  const handlePageChange = (page) => {
    if (page < 1 || page > previewNumPages) return;

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
  // ========================================
  // PAGE RENDER
  // ========================================

  return (
    <div className="nova-merge-pdf">

      {/* ========================================
          HEADER
      ======================================== */}

      <header className="merge-pdf-header">

        <button
          type="button"
          className="merge-pdf-back"
          onClick={() => navigate("/office")}
        >
          <ArrowLeft size={18} />
          Back to Office
        </button>

        <div>
          <h1>Merge PDFs</h1>
          <p>Combine multiple PDF documents into one file.</p>
        </div>

      </header>

      <main className="merge-pdf-content">

        {/* ========================================
            INTRODUCTION
        ======================================== */}

        <div className="merge-pdf-intro">

          <div className="merge-pdf-icon">
            <Files size={30} />
          </div>

          <h2>Bring your PDFs together</h2>

          <p>
            Select multiple PDF files, arrange them in your preferred
            order, and combine them into a single document.
          </p>

        </div>

        {/* ========================================
            PDF UPLOAD AREA
        ======================================== */}

        <div className="merge-pdf-upload-area">

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            hidden
            onChange={handleFilesSelected}
          />

          <FilePlus2 size={38} />

          <h3>Add PDF files</h3>

          <p>
            Your selected PDF documents will appear here.
          </p>

          {/* SELECTED FILE LIST */}

          {selectedFiles.length > 0 && (

            <div className="merge-pdf-file-list">

              {selectedFiles.map((item, index) => (

                <div
                  className="merge-pdf-file-item"
                  key={item.id}
                >

                  <div className="merge-pdf-file-info">

                    <Files size={20} />

                    <div>
                      <strong>{item.file.name}</strong>

                      <span>
                        {item.pageCount}{" "}
                        {item.pageCount === 1 ? "page" : "pages"}
                      </span>
                    </div>

                  </div>

                  <div className="merge-pdf-file-actions">

                    <span className="merge-pdf-file-number">
                      {index + 1}
                    </span>

                    <button
                      type="button"
                      title="Move up"
                      disabled={index === 0}
                      onClick={() => moveFile(index, -1)}
                    >
                      <ArrowUp size={16} />
                    </button>

                    <button
                      type="button"
                      title="Move down"
                      disabled={index === selectedFiles.length - 1}
                      onClick={() => moveFile(index, 1)}
                    >
                      <ArrowDown size={16} />
                    </button>

                    <button
                      type="button"
                      title="Remove PDF"
                      onClick={() => removeFile(item.id)}
                    >
                      <Trash2 size={16} />
                    </button>

                  </div>

                </div>

              ))}

            </div>

          )}

          {/* MERGE BUTTON */}

          {selectedFiles.length >= 2 && (

            <button
              type="button"
              className="merge-pdf-merge-button"
              onClick={handleMergePdfs}
              disabled={isMerging}
            >
              {isMerging ? (
                <>
                  <RefreshCw size={17} className="merge-pdf-spinner" />
                  Merging PDFs...
                </>
              ) : (
                "Merge PDFs"
              )}
            </button>

          )}

          {/* ADD MORE FILES */}

          <button
            type="button"
            className="merge-pdf-add-button"
            onClick={() => fileInputRef.current?.click()}
          >
            <FilePlus2 size={17} />
            Choose PDF files
          </button>


<button
  type="button"
  className="merge-pdf-cloud-button"
  onClick={openFilePicker}
  disabled={isMerging}
>
  <Folder size={17} />
  Choose from My Files
</button>


          <span>PDF files only</span>

        </div>

        {/* ========================================
            MERGED PDF RESULT
        ======================================== */}

        {mergedPdfUrl && (

          <div className="merge-pdf-result">

            <div className="merge-pdf-result-header">

              <div>
                <h3>PDFs merged successfully!</h3>

                <p>Your combined document is ready.</p>
              </div>

              <Files size={28} />

            </div>

            <div className="merge-pdf-result-actions">

              <button
                type="button"
                onClick={
                  showPreview
                    ? handlePreviewClose
                    : handlePreviewOpen
                }
              >
                {showPreview ? (
                  <X size={17} />
                ) : (
                  <Eye size={17} />
                )}

                {showPreview ? "Close Preview" : "Preview PDF"}
              </button>

              <button
                type="button"
                onClick={handleDownload}
              >
                <Download size={17} />
                Download PDF
              </button>

              <button
  type="button"
  onClick={handleSaveToMyFiles}
  disabled={isSaving || !mergedPdfBlob || !!saveSuccess}
>
  {isSaving ? (
    <>
      <RefreshCw size={17} className="merge-pdf-spinner" />
      Saving...
    </>
  ) : (
    <>
      <FilePlus2 size={17} />
      Save to My Files
    </>
  )}
</button>

            </div>

            {saveSuccess && (
  <p className="merge-pdf-save-success">
    {saveSuccess}
  </p>
)}

            {/* ========================================
                NOVA PDF PREVIEW
            ======================================== */}

            {showPreview && (

              <div className="merge-pdf-viewer">

                {/* VIEWER TOOLBAR */}

                <div className="merge-pdf-viewer-toolbar">

                  <div className="merge-pdf-viewer-title">
                    <FileText size={18} />

                    <span>{mergedPdfName}</span>
                  </div>

                  <div className="merge-pdf-viewer-controls">

                    {/* PREVIOUS PAGE */}

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

                    {/* PAGE COUNTER */}

                    <span className="merge-pdf-page-counter">
                      {previewPageNumber} / {previewNumPages || "..."}
                    </span>

                    {/* NEXT PAGE */}

                    <button
                      type="button"
                      title="Next page"
                      disabled={
                        previewPageNumber >= previewNumPages ||
                        previewNumPages === 0
                      }
                      onClick={() =>
                        handlePageChange(previewPageNumber + 1)
                      }
                    >
                      <ChevronRight size={18} />
                    </button>

                    <div className="merge-pdf-toolbar-divider" />

                    {/* ZOOM OUT */}

                    <button
                      type="button"
                      title="Zoom out"
                      disabled={previewScale <= 0.5}
                      onClick={handleZoomOut}
                    >
                      <ZoomOut size={18} />
                    </button>

                    {/* ZOOM LEVEL */}

                    <button
                      type="button"
                      className="merge-pdf-zoom-level"
                      title="Reset zoom"
                      onClick={handleZoomReset}
                    >
                      {Math.round(previewScale * 100)}%
                    </button>

                    {/* ZOOM IN */}

                    <button
                      type="button"
                      title="Zoom in"
                      disabled={previewScale >= 2}
                      onClick={handleZoomIn}
                    >
                      <ZoomIn size={18} />
                    </button>

                    <div className="merge-pdf-toolbar-divider" />

                    {/* DOWNLOAD */}

                    <button
                      type="button"
                      title="Download PDF"
                      onClick={handleDownload}
                    >
                      <Download size={18} />
                    </button>

                    {/* CLOSE */}

                    <button
                      type="button"
                      title="Close preview"
                      onClick={handlePreviewClose}
                    >
                      <X size={18} />
                    </button>

                  </div>

                </div>

                {/* DOCUMENT LOADING */}

                {previewLoading && (
                  <div className="merge-pdf-viewer-loading">
                    Loading document...
                  </div>
                )}

                {/* PDF DOCUMENT */}

                <Document
                  file={mergedPdfUrl}
                  onLoadSuccess={handleDocumentLoad}
                  onLoadError={(error) => {
                    console.error("Preview loading failed:", error);
                    setPreviewLoading(false);
                  }}
                  onLoadStart={() => setPreviewLoading(true)}
                  loading={
                    <div className="merge-pdf-viewer-loading">
                      Loading PDF...
                    </div>
                  }
                  error={
                    <div className="merge-pdf-viewer-error">
                      Unable to display this PDF.
                    </div>
                  }
                  className="merge-pdf-document"
                >

                  {/* THUMBNAIL SIDEBAR */}

                  <aside className="merge-pdf-thumbnails">

                    <div className="merge-pdf-thumbnails-heading">
                      Pages
                    </div>

                    {Array.from(
                      new Array(previewNumPages),
                      (_, index) => index + 1
                    ).map((page) => (

                      <button
                        type="button"
                        key={page}
                        className={`merge-pdf-thumbnail ${
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

                  <section className="merge-pdf-document-canvas">

                    {previewNumPages > 0 && (

                      <div className="merge-pdf-page-wrapper">

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

          </div>

        )}

        
{showFilePicker && (
  <div className="merge-pdf-picker-overlay">
    <div className="merge-pdf-picker-modal">
      {/* HEADER */}
      <div className="merge-pdf-picker-header">
        <div>
          <h2>Choose from My Files</h2>
          <p>Select the PDF files you want to merge.</p>
        </div>

        <button
          type="button"
          className="merge-pdf-picker-close"
          onClick={() => setShowFilePicker(false)}
          disabled={isLoadingCloudPdf}
        >
          <X size={20} />
        </button>
      </div>

      {/* SEARCH */}
      <div className="merge-pdf-picker-search">
        <Search size={18} />
        <input
          type="text"
          placeholder="Search PDF files..."
          value={fileSearch}
          onChange={(event) => setFileSearch(event.target.value)}
        />
      </div>

      {/* BREADCRUMBS */}
      <div className="merge-pdf-picker-breadcrumbs">
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

      {/* FILE LIST */}
      <div className="merge-pdf-picker-list">
        {isLoadingCloudFiles ? (
          <div className="merge-pdf-picker-empty">
            Loading your files...
          </div>
        ) : (
          <>
            {visibleCloudFolders.map((folder) => (
              <button
                type="button"
                className="merge-pdf-picker-item"
                key={folder.id}
                onClick={() => handleOpenCloudFolder(folder)}
                disabled={isLoadingCloudPdf}
              >
                <Folder size={19} />
                <span className="merge-pdf-picker-item-name">
                  {folder.name}
                </span>
                <span className="merge-pdf-picker-item-action">
                  Open
                </span>
              </button>
            ))}

            {visibleCloudPdfFiles.map((file) => {
              const isSelected = cloudSelectedFiles.some(
                (item) => item.id === file.id
              );

              const alreadyAdded = selectedFiles.some(
                (item) => item.cloudFileId === file.id
              );

              return (
                <button
                  type="button"
                  className={`merge-pdf-picker-item ${
                    isSelected ? "selected" : ""
                  }`}
                  key={file.id}
                  onClick={() => handleToggleCloudPdf(file)}
                  disabled={isLoadingCloudPdf || alreadyAdded}
                >
                  <FileText size={19} />

                  <span className="merge-pdf-picker-item-name">
                    {file.name}
                  </span>

                  <span className="merge-pdf-picker-item-action">
                    {alreadyAdded
                      ? "Added"
                      : isSelected
                      ? "Selected"
                      : "Select"}
                  </span>
                </button>
              );
            })}

            {visibleCloudFolders.length === 0 &&
              visibleCloudPdfFiles.length === 0 && (
                <div className="merge-pdf-picker-empty">
                  No PDF files or folders found here.
                </div>
              )}
          </>
        )}
      </div>

      {/* FOOTER */}
      <div className="merge-pdf-picker-footer">
        <span>
          {cloudSelectedFiles.length} PDF
          {cloudSelectedFiles.length === 1 ? "" : "s"} selected
        </span>

        <div>
          <button
            type="button"
            className="merge-pdf-picker-cancel"
            onClick={() => setShowFilePicker(false)}
            disabled={isLoadingCloudPdf}
          >
            Cancel
          </button>

          <button
            type="button"
            className="merge-pdf-picker-add"
            onClick={handleAddCloudPdfs}
            disabled={
              cloudSelectedFiles.length === 0 || isLoadingCloudPdf
            }
          >
            {isLoadingCloudPdf
              ? "Adding PDFs..."
              : `Add ${cloudSelectedFiles.length} PDFs`}
          </button>
        </div>
      </div>
    </div>
  </div>
)}


      </main>

    </div>
  );
}

export default MergePDF;
