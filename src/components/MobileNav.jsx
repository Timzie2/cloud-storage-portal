import {
  Home,
  Folder,
  Share2,
  Settings,
} from "lucide-react";

import { NavLink } from "react-router-dom";

function MobileNav() {
  const navItems = [
    {
      to: "/",
      label: "Home",
      icon: Home,
    },
    {
      to: "/files",
      label: "Files",
      icon: Folder,
    },
    {
      to: "/shared",
      label: "Shared",
      icon: Share2,
    },
    {
      to: "/settings",
      label: "Settings",
      icon: Settings,
    },
  ];

  return (
    <nav className="mobile-nav">
      {navItems.map((item) => {
        const Icon = item.icon;

        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `mobile-nav-link ${isActive ? "active" : ""}`
            }
          >
            <Icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export default MobileNav;