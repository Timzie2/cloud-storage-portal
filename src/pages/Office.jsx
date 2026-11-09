import "../styles/office.css";
import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import {
  FileText,
  Table2,
  Presentation,
  File,
  ArrowRight,
  Plus,
  Clock3,
  Sparkles,
  FilePenLine,
  FilePlus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getRecentUserDocuments } from "../services/documents";
import { getRecentOfficeFiles } from "../services/files";

const officeApps = [
  {
    id: "docs",
    name: "NOVA Docs",
    description: "Create and edit Word documents.",
    detail: "Documents",
    icon: FileText,
    color: "docs",
    status: "Available",
    action: "Create document",
  },
  {
    id: "sheets",
    name: "NOVA Sheets",
    description: "Organise data, use formulas and create charts.",
    detail: "Spreadsheets",
    icon: Table2,
    color: "sheets",
    status: "Coming soon",
  },
  {
    id: "slides",
    name: "NOVA Slides",
    description: "Design beautiful presentations.",
    detail: "Presentations",
    icon: Presentation,
    color: "slides",
    status: "Coming soon",
  },
  {
    id: "pdf",
    name: "NOVA PDF",
    description: "Read, annotate and work with PDF files.",
    detail: "PDF documents",
    icon: File,
    color: "pdf",
    status: "Coming soon",
  },
];

function Office() {
  const navigate = useNavigate();
  const { user } = useAuth();

const [recentDocuments, setRecentDocuments] = useState([]);
const [documentsLoading, setDocumentsLoading] = useState(true);
const [documentsError, setDocumentsError] = useState("");
const [docxChoiceFile, setDocxChoiceFile] = useState(null);

useEffect(() => {
  let isMounted = true;

  const loadRecentDocuments = async () => {
    if (!user?.id) {
      setRecentDocuments([]);
      setDocumentsLoading(false);
      return;
    }

    try {
      setDocumentsLoading(true);
      setDocumentsError("");

const [documents, files] = await Promise.all([
  getRecentUserDocuments(user.id, 10),
  getRecentOfficeFiles(user.id, 20),
]);

      // Hide DOCX files that already have a corresponding
      // NOVA Docs document, so they aren't displayed twice.
      const linkedFileIds = new Set(
        documents.flatMap((doc) =>
          [doc.output_file_id, doc.source_file_id].filter(Boolean)
        )
      );

      const officeFiles = files
        .filter((file) => !linkedFileIds.has(file.id))
        .map((file) => {
          const name = file.name || "";
          const extension = name.split(".").pop()?.toLowerCase();

          let type = null;

          if (extension === "docx") type = "word";
          if (extension === "pdf") type = "pdf";
          if (["xlsx", "xls"].includes(extension)) type = "excel";
          if (["pptx", "ppt"].includes(extension)) type = "powerpoint";

          if (!type) return null;

          return {
            id: file.id,
            fileId: file.id,
            title: name,
            date: file.updated_at || file.created_at,
            type,
            kind: "file",
            file,
          };
        })
        .filter(Boolean);

      const officeDocuments = documents.map((doc) => ({
        id: doc.id,
        title: doc.title || "Untitled document",
        date: doc.updated_at,
        type: "word",
        kind: "document",
        document: doc,
      }));

      const combined = [...officeDocuments, ...officeFiles]
        .sort(
          (a, b) =>
            new Date(b.date || 0).getTime() -
            new Date(a.date || 0).getTime()
        )
        .slice(0, 5);

      if (isMounted) {
        setRecentDocuments(combined);
      }
    } catch (error) {
      console.error("Could not load recent Office files:", error);

      if (isMounted) {
        setDocumentsError("Could not load your recent documents.");
      }
    } finally {
      if (isMounted) {
        setDocumentsLoading(false);
      }
    }
  };

  loadRecentDocuments();

  return () => {
    isMounted = false;
  };
}, [user?.id]);

const formatDocumentDate = (date) => {
  if (!date) return "Recently updated";

  return new Date(date).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

  const openApp = (app) => {
  if (app.id === "docs") {
    const newDocumentId = `new-${crypto.randomUUID()}`;

    navigate(`/documents/${newDocumentId}`, {
      state: {
        from: "/office",
      },
    });
  }
};

  const handleOpenInNovaDocs = async (mode) => {
  if (!docxChoiceFile || !user) return;

  try {
    const { data: blob, error } = await supabase.storage
      .from("user-files")
      .download(docxChoiceFile.storage_path);

    if (error) throw error;

    const pendingDocxFile = new window.File(
      [blob],
      docxChoiceFile.name,
      {
        type:
          docxChoiceFile.mime_type ||
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }
    );

const newDocumentId = `new-${crypto.randomUUID()}`;

navigate("/documents/new", {
  state: {
    from: "/office",
    pendingDocxFile,
    sourceFileId:
      mode === "original" ? docxChoiceFile.id : null,
    fileName: docxChoiceFile.name,
  },
});

    setDocxChoiceFile(null);
  } catch (error) {
    console.error("Unable to open DOCX in NOVA Docs:", error);
    alert(error.message || "Unable to open this Word document.");
  }
};

  return (
    <div className="office-page">
      <div className="office-content">

        <header className="office-header">
          <div>
            <p className="office-eyebrow">
              <Sparkles size={15} />
              YOUR PRODUCTIVITY WORKSPACE
            </p>

            <h1>NOVA Office</h1>

            <p className="office-subtitle">
              Everything you need to create, organise and get work done.
            </p>
          </div>
        </header>

        <section className="office-welcome">
          <div className="office-welcome-content">
            <span>WELCOME TO NOVA OFFICE</span>
            <h2>Bring your ideas to life.</h2>
            <p>
              Create documents, organise information and build
              presentations, all in one workspace.
            </p>

            <button
              type="button"
              onClick={() => {
  const newDocumentId = `new-${crypto.randomUUID()}`;

  navigate(`/documents/${newDocumentId}`, {
    state: { from: "/office" },
  });
}}
            >
              <Plus size={18} />
              Create a document
            </button>
          </div>

          <div className="office-welcome-decoration">
            <div className="office-decoration-card office-decoration-one">
              <FileText size={30} />
            </div>
            <div className="office-decoration-card office-decoration-two">
              <Table2 size={30} />
            </div>
            <div className="office-decoration-card office-decoration-three">
              <Presentation size={30} />
            </div>
          </div>
        </section>

        <section className="office-app-section">
          <div className="office-section-heading">
            <div>
              <h2>Your applications</h2>
              <p>Choose an application to get started.</p>
            </div>
          </div>

          <div className="office-app-grid">
            {officeApps.map((app) => {
              const Icon = app.icon;
              const available = app.status === "Available";

              return (
                <button
                  type="button"
                  key={app.id}
                  className={`office-app-card office-${app.color}`}
                  onClick={() => openApp(app)}
                  disabled={!available}
                >
                  <div className="office-app-card-top">
                    <div className="office-app-icon">
                      <Icon size={25} />
                    </div>

                    <span
                      className={`office-app-status ${
                        available ? "available" : "coming-soon"
                      }`}
                    >
                      {app.status}
                    </span>
                  </div>

                  <div className="office-app-card-content">
                    <h3>{app.name}</h3>
                    <p>{app.description}</p>
                  </div>

                  <div className="office-app-card-footer">
                    <span>{app.detail}</span>
                    <ArrowRight size={18} />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="office-recent-section">
  <div className="office-section-heading">
    <div>
      <h2>Recent documents</h2>
      <p>Continue working on your documents.</p>
    </div>

    <button type="button" onClick={() => navigate("/files")}>
      View My Files
      <ArrowRight size={16} />
    </button>
  </div>

  {documentsLoading ? (
    <div className="office-empty-state">
      <p>Loading your recent documents...</p>
    </div>
  ) : documentsError ? (
    <div className="office-empty-state">
      <p>{documentsError}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
      >
        Try again
      </button>
    </div>
  ) : recentDocuments.length > 0 ? (
    <div className="office-recent-list">
      {recentDocuments.map((document) => (
        <button
          type="button"
          key={document.id}
          className="office-recent-item"
          onClick={() => {

  if (document.kind === "file" && document.type === "word") {
    setDocxChoiceFile(document.file);
    return;
  }

  navigate(`/documents/${document.id}`, {
    state: { from: "/office" },
  });
}}
        >
          <div className="office-recent-item-icon">
            <FileText size={22} />
          </div>

          <div className="office-recent-item-info">
            <h3>{document.title || "Untitled document"}</h3>
            <p>
              Last modified {formatDocumentDate(document.date)}
            </p>
          </div>

          <ArrowRight size={18} />
        </button>
      ))}
    </div>
  ) : (
    <div className="office-empty-state">
      <div className="office-empty-icon">
        <Clock3 size={25} />
      </div>

      <h3>Your workspace starts here</h3>
      <p>Your recent Office documents will appear here.</p>

      <button
  type="button"
  onClick={() => {
    const newDocumentId = `new-${crypto.randomUUID()}`;

    navigate(`/documents/${newDocumentId}`, {
      state: { from: "/office" },
    });
  }}
>
  Create your first document
</button>
    </div>
  )}
      </section>

      {docxChoiceFile && (
        <div
          className="docx-choice-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setDocxChoiceFile(null);
            }
          }}
        >
          <div
            className="docx-choice-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="docx-choice-title"
          >
            <button
              type="button"
              className="docx-choice-close"
              onClick={() => setDocxChoiceFile(null)}
            >
              ×
            </button>

            <div className="docx-choice-icon">
              <FilePenLine size={26} />
            </div>

            <h2 id="docx-choice-title">Open in NOVA Docs</h2>

            <p>How would you like to work with this document?</p>

            <div className="docx-choice-options">
              <button
                type="button"
                onClick={() => handleOpenInNovaDocs("original")}
              >
                <FilePenLine size={20} />
                <span>
                  <strong>Save to original document</strong>
                  <small>
                    Create an editable NOVA version linked to this file.
                  </small>
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenInNovaDocs("new")}
              >
                <FilePlus size={20} />
                <span>
                  <strong>Save as a new document</strong>
                  <small>
                    Create a separate document and keep the original untouched.
                  </small>
                </span>
              </button>
            </div>

            <button
              type="button"
              className="docx-choice-cancel"
              onClick={() => setDocxChoiceFile(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}

export default Office;
