import { Clock3 } from "lucide-react";

function Recent() {
  return (
    <main className="dashboard">
      <section className="dashboard-content">
        <p className="dashboard-eyebrow">Activity</p>

        <h1 className="dashboard-title">Recent</h1>

        <p className="dashboard-subtitle">
          Quickly find the files you've recently worked with.
        </p>

        <div className="page-placeholder">
          <Clock3 size={28} />
          <strong>Recent files</strong>
          <p>
            Your recent activity will appear here.
          </p>
        </div>
      </section>
    </main>
  );
}

export default Recent;