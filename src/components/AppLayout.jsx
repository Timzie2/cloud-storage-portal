
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />

      <main className="app-main">
        {children}
      </main>

      <MobileNav />
    </div>
  );
}

export default AppLayout;
