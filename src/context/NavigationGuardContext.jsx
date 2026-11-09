
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from "react";
import {
  useBlocker,
  useNavigate,
} from "react-router-dom";

const NavigationGuardContext = createContext(null);

export function NavigationGuardProvider({ children }) {
  const navigate = useNavigate();
  const navigationGuardRef = useRef(null);
  const skipNextBlockRef = useRef(false);

  const shouldBlockNavigation = useCallback(() => {
    if (skipNextBlockRef.current) {
      skipNextBlockRef.current = false;
      return false;
    }

    return Boolean(navigationGuardRef.current?.isDirty?.());
  }, []);

  const blocker = useBlocker(shouldBlockNavigation);

  const allowNextNavigation = useCallback(() => {
    skipNextBlockRef.current = true;
  }, []);

  const registerNavigationGuard = useCallback((guard) => {
    navigationGuardRef.current = guard;

    return () => {
      if (navigationGuardRef.current === guard) {
        navigationGuardRef.current = null;
      }
    };
  }, []);

  const requestNavigation = useCallback(
    (destination) => {
      const guard = navigationGuardRef.current;

      if (guard?.onRequest) {
        guard.onRequest(destination);
        return;
      }

      navigate(destination);
    },
    [navigate]
  );

  const value = useMemo(
    () => ({
      registerNavigationGuard,
      requestNavigation,
      allowNextNavigation,
      blockedNavigation:
        blocker.state === "blocked" ? blocker : null,
    }),
    [
      registerNavigationGuard,
      requestNavigation,
      allowNextNavigation,
      blocker,
    ]
  );

  return (
    <NavigationGuardContext.Provider value={value}>
      {children}
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard() {
  const context = useContext(NavigationGuardContext);

  if (!context) {
    throw new Error(
      "useNavigationGuard must be used inside NavigationGuardProvider"
    );
  }

  return context;
}
