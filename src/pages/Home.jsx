import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  ArrowRight,
  Bell,
  Cloud,
  Database,
  Folder,
  FolderOpen,
  LockKeyhole,
  Search,
  Share2,
  Sun,
  UploadCloud,
} from "lucide-react";

import "../styles/home.css";

import Logo from "../components/Logo";
import ThemeToggle from "../components/ThemeToggle";

function Home() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
  const sections = [
    document.getElementById("features"),
    document.getElementById("how-it-works"),
    document.getElementById("security"),
  ].filter(Boolean);

  if (!sections.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      const visibleSections = entries
        .filter((entry) => entry.isIntersecting)
        .sort(
          (a, b) =>
            a.boundingClientRect.top -
            b.boundingClientRect.top
        );

      if (visibleSections.length > 0) {
        setActiveSection(visibleSections[0].target.id);
      }
    },
    {
      rootMargin: "-25% 0px -60% 0px",
      threshold: 0,
    }
  );

  sections.forEach((section) => observer.observe(section));

  return () => observer.disconnect();
}, []);

  return (
    <main className="home-page">
      {/* =========================================
          NAVIGATION
      ========================================= */}

      <header className="home-nav">
        <Logo />

        <nav className="home-nav-links">
          <a
  href="#features"
  className={activeSection === "features" ? "active" : ""}
>
  Features
</a>

<a
  href="#how-it-works"
  className={
    activeSection === "how-it-works" ? "active" : ""
  }
>
  How it works
</a>

<a
  href="#security"
  className={activeSection === "security" ? "active" : ""}
>
  Security
</a>
        </nav>

        <div className="home-nav-actions">
          <ThemeToggle />

          <button
            type="button"
            className="home-signin-button"
            onClick={() => navigate("/auth")}
          >
            Sign in
          </button>

          <button
            type="button"
            className="home-cta-button"
            onClick={() => navigate("/auth")}
          >
            Get started
            <ArrowRight size={16} />
          </button>
        </div>
      </header>

      {/* =========================================
          HERO
      ========================================= */}

      <section className="home-hero">
        <div className="home-hero-glow home-hero-glow-one" />
        <div className="home-hero-glow home-hero-glow-two" />

        <div className="home-hero-content">
          <div className="home-eyebrow">
            <Cloud size={15} />
            <span>Your digital space</span>
          </div>

          <h1>
            Your files.
            <br />
            <span>Everywhere.</span>
          </h1>

          <p>
            NOVA gives you one simple, secure place to store,
            organize, access and share your files from anywhere.
          </p>

          <div className="home-hero-actions">
            <button
              type="button"
              className="home-primary-button"
              onClick={() => navigate("/auth")}
            >
              Get started
              <ArrowRight size={17} />
            </button>

            <button
              type="button"
              className="home-secondary-button"
              onClick={() => navigate("/auth")}
            >
              Sign in
            </button>
          </div>

          <div className="home-hero-note">
            <LockKeyhole size={14} />
            <span>Your files stay private and secure.</span>
          </div>
        </div>

        {/* PRODUCT PREVIEW */}

<div className="home-product-preview">
  <div className="home-preview-window">

    {/* Browser / window topbar */}
    <div className="home-preview-topbar">
      <div className="home-preview-dots">
        <span />
        <span />
        <span />
      </div>

      <div className="home-preview-title">
        NOVA
      </div>
    </div>


    {/* Dashboard preview */}
    <div className="home-preview-body">

      {/* Preview Sidebar */}
      <aside className="home-preview-sidebar">

        <div className="home-preview-logo">
          <Logo />
        </div>

        <div className="home-preview-nav active">
          <FolderOpen size={14} />
          <span>Home</span>
        </div>

        <div className="home-preview-nav">
          <FolderOpen size={14} />
          <span>My Files</span>
        </div>

        <div className="home-preview-nav">
          <Share2 size={14} />
          <span>Shared</span>
        </div>

        <div className="home-preview-nav">
          <UploadCloud size={14} />
          <span>Recent</span>
        </div>

        <div className="home-preview-nav">
          <span className="home-preview-trash-icon">
            ♢
          </span>
          <span>Trash</span>
        </div>

        <div className="home-preview-sidebar-spacer" />

        {/* Storage */}
        <div className="home-preview-storage">

          <div className="home-preview-storage-title">
            Storage
          </div>

          <div className="home-preview-storage-text">
            2.4 GB of 10 GB used
          </div>

          <div className="home-preview-storage-track">
            <div className="home-preview-storage-fill" />
          </div>

        </div>

      </aside>


      {/* Preview Main */}
      <div className="home-preview-main">

        {/* Dashboard Topbar */}
        <div className="home-preview-dashboard-topbar">

          <div className="home-preview-search">
            <Search size={12} />
            <span>Search files...</span>
          </div>

          <div className="home-preview-top-actions">

            <div className="home-preview-top-icon">
              <Bell size={13} />
              <span className="home-preview-notification-dot" />
            </div>

            <div className="home-preview-top-icon">
              <Sun size={13} />
            </div>

            <div className="home-preview-avatar">
              A
            </div>

          </div>

        </div>


        {/* Dashboard Content */}
        <div className="home-preview-content">

          {/* Greeting */}
          <div className="home-preview-heading">

            <div>
              <span>Your digital space</span>

              <strong>
                Good evening, Alex 👋
              </strong>
            </div>

          </div>


          {/* Storage / File Stats */}
          <div className="home-preview-stats">

            <div>
              <div className="home-preview-stat-icon">
                <Folder size={12} />
              </div>

              <div>
                <span>Total Files</span>
                <strong>128</strong>
              </div>
            </div>


            <div>
              <div className="home-preview-stat-icon storage">
                <Database size={12} />
              </div>

              <div>
                <span>Storage Used</span>
                <strong>2.4 GB</strong>
              </div>
            </div>


            <div>
              <div className="home-preview-stat-icon total">
                <Cloud size={12} />
              </div>

              <div>
                <span>Total Storage</span>
                <strong>10 GB</strong>
              </div>
            </div>


            <div>
              <div className="home-preview-stat-icon shared">
                <Share2 size={12} />
              </div>

              <div>
                <span>Shared Files</span>
                <strong>12</strong>
              </div>
            </div>

          </div>


          {/* Recent Files */}
          <div className="home-preview-files">

            <div className="home-preview-file-heading">
              <strong>Recent files</strong>
              <span>View all →</span>
            </div>


            <div className="home-preview-file">

              <div className="home-preview-file-icon presentation">
                <span>P</span>
              </div>

              <div>
                <strong>
                  Project Presentation.pptx
                </strong>

                <span>
                  2.4 MB • 2 hours ago
                </span>
              </div>

            </div>


            <div className="home-preview-file">

              <div className="home-preview-file-icon image">
                <span>▣</span>
              </div>

              <div>
                <strong>
                  Vacation Photo.jpg
                </strong>

                <span>
                  4.2 MB • 5 hours ago
                </span>
              </div>

            </div>


            <div className="home-preview-file">

              <div className="home-preview-file-icon document">
                <span>PDF</span>
              </div>

              <div>
                <strong>
                  Resume.pdf
                </strong>

                <span>
                  1.1 MB • Yesterday
                </span>
              </div>

            </div>


            <div className="home-preview-file">

              <div className="home-preview-file-icon video">
                <span>▶</span>
              </div>

              <div>
                <strong>
                  Project Video.mp4
                </strong>

                <span>
                  84 MB • 2 days ago
                </span>
              </div>

            </div>

          </div>


          {/* Upload */}
          <div className="home-preview-upload">

            <div className="home-preview-upload-icon">
              <UploadCloud size={15} />
            </div>

            <div>
              <strong>
                Upload files
              </strong>

              <span>
                Images, videos, documents and more
              </span>
            </div>

            <div className="home-preview-upload-arrow">
              →
            </div>

          </div>

        </div>

      </div>

    </div>
  </div>
</div>

</section>

{/* =========================================
    FEATURES
========================================= */}

<section
  className="home-section"
  id="features"
>
  <div className="home-section-heading">

    <p className="home-section-eyebrow">
      Everything in one place
    </p>

    <h2>
      Built around your files.
    </h2>

    <p>
      NOVA keeps the things you care about organized,
      accessible and easy to share.
    </p>

  </div>


  <div className="home-feature-grid">

    <article className="home-feature-card">

      <div className="home-feature-icon">
        <UploadCloud size={21} />
      </div>

      <h3>
        Upload anything
      </h3>

      <p>
        Store images, videos, documents and other files
        in your personal cloud space.
      </p>

    </article>


    <article className="home-feature-card">

      <div className="home-feature-icon">
        <FolderOpen size={21} />
      </div>

      <h3>
        Stay organized
      </h3>

      <p>
        Create folders and keep your digital space
        structured exactly how you want it.
      </p>

    </article>


    <article className="home-feature-card">

      <div className="home-feature-icon">
        <Share2 size={21} />
      </div>

      <h3>
        Share with ease
      </h3>

      <p>
        Share files with other people while keeping
        control of your stored content.
      </p>

    </article>

  </div>
</section>


{/* =========================================
    HOW IT WORKS
========================================= */}

<section
  className="home-section home-how-section"
  id="how-it-works"
>
  <div className="home-section-heading">
    <p className="home-section-eyebrow">
      Simple by design
    </p>

    <h2>
      Everything you need. Nothing you don't.
    </h2>

    <p>
      From your first upload to sharing a file, NOVA keeps
      everything simple and within reach.
    </p>
  </div>

  <div className="home-steps">

    <article className="home-step">
      <div className="home-step-top">
        <div className="home-step-icon">
          <Cloud size={19} />
        </div>

        <span>01</span>
      </div>

      <div className="home-step-content">
        <h3>Create your space</h3>

        <p>
          Create your NOVA account and get your own
          private storage space.
        </p>
      </div>
    </article>


    <article className="home-step">
      <div className="home-step-top">
        <div className="home-step-icon">
          <UploadCloud size={19} />
        </div>

        <span>02</span>
      </div>

      <div className="home-step-content">
        <h3>Upload your files</h3>

        <p>
          Add images, videos, documents and everything
          else you want to keep safe.
        </p>
      </div>
    </article>


    <article className="home-step">
      <div className="home-step-top">
        <div className="home-step-icon">
          <Share2 size={19} />
        </div>

        <span>03</span>
      </div>

      <div className="home-step-content">
        <h3>Access and share</h3>

        <p>
          Find your files whenever you need them and
          share them with the people who matter.
        </p>
      </div>
    </article>

  </div>
</section>

      {/* =========================================
    SECURITY
========================================= */}

<section
  className="home-security"
  id="security"
>
  <div className="home-security-glow" />

  <div className="home-security-content">

    <div className="home-security-icon">
      <LockKeyhole size={23} />
    </div>

    <div className="home-security-copy">
      <p className="home-section-eyebrow">
        Private by design
      </p>

      <h2>
        Your files belong to you.
      </h2>

      <p>
        NOVA is designed around private storage, controlled
        access and a simple experience without unnecessary
        complexity.
      </p>
    </div>

    <div className="home-security-points">

      <div className="home-security-point">
        <div className="home-security-point-icon">
          <LockKeyhole size={15} />
        </div>

        <div>
          <strong>Private storage</strong>
          <span>
            Your files stay inside your personal storage space.
          </span>
        </div>
      </div>

      <div className="home-security-point">
        <div className="home-security-point-icon">
          <Share2 size={15} />
        </div>

        <div>
          <strong>Controlled sharing</strong>
          <span>
            Share files when you choose and keep control of access.
          </span>
        </div>
      </div>

      <div className="home-security-point">
        <div className="home-security-point-icon">
          <Cloud size={15} />
        </div>

        <div>
          <strong>Cloud access</strong>
          <span>
            Keep your files available wherever you need them.
          </span>
        </div>
      </div>

    </div>

  </div>
      </section>

      {/* =========================================
          FINAL CTA
      ========================================= */}

      <section className="home-final-cta">

        <div className="home-final-cta-glow" />

        <div className="home-final-cta-content">

          <p className="home-section-eyebrow">
            Ready when you are
          </p>

          <h2>
            Give your files a place
            <br />
            <span>to call home.</span>
          </h2>

          <p>
            Create your NOVA space and start organizing
            your digital world.
          </p>

          <button
            type="button"
            className="home-primary-button"
            onClick={() => navigate("/auth")}
          >
            Get started
            <ArrowRight size={17} />
          </button>

        </div>

      </section>

      {/* =========================================
          FOOTER
      ========================================= */}

      <footer className="home-footer">
        <Logo />

        <span>
          Your files, everywhere.
        </span>

        <span>
          © {new Date().getFullYear()} NOVA
        </span>
      </footer>
    </main>
  );
}

export default Home;