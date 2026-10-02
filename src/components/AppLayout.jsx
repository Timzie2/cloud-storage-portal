import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";

function AppLayout({ children }) {
  return (
    <>
      <Sidebar />

      {children}

      <MobileNav />
    </>
  );
}

export default AppLayout;