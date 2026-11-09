
import {
  Home,
  Folder,
  Share2,
  Trash2,
  Star,
} from "lucide-react";

import { NavLink, useLocation } from "react-router-dom";
import { useNavigationGuard } from "../context/NavigationGuardContext";

function MobileNav() {
  const { requestNavigation } = useNavigationGuard();
  const location = useLocation();

  const navItems = [
    { to: "/", label: "Home", icon: Home },
    { to: "/files", label: "Files", icon: Folder },
    { to: "/favorites", label: "Favorites", icon: Star },
    { to: "/shared", label: "Shared", icon: Share2 },
    { to: "/trash", label: "Trash", icon: Trash2 },
  ];

  const handleNavigation = (event, destination) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    if (location.pathname === destination) return;

    event.preventDefault();
    requestNavigation(destination);
  };

  return (
    <nav className="mobile-nav">
      {navItems.map((item) => {
        const Icon = item.icon;

        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={(event) =>
              handleNavigation(event, item.to)
            }
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
