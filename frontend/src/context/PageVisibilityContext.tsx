"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { ALL_PAGES, isRouteProtected, NAVIGATION_CONFIG } from "@/config/navigationConfig";
import { API_BASE } from "@/lib/apiConfig";

const STORAGE_KEY = "alpha_india_hidden_pages_v1";

interface PageVisibilityContextType {
  hiddenPages: string[];
  isLoaded: boolean;
  isPageHidden: (href: string) => boolean;
  hidePage: (href: string) => Promise<void>;
  unhidePage: (href: string) => Promise<void>;
  togglePageVisibility: (href: string) => Promise<void>;
  unhideAll: () => Promise<void>;
  hideSection: (sectionTitle: string) => Promise<void>;
  unhideSection: (sectionTitle: string) => Promise<void>;
  totalCount: number;
  hiddenCount: number;
  visibleCount: number;
}

const PageVisibilityContext = createContext<PageVisibilityContextType | undefined>(undefined);

export function PageVisibilityProvider({ children }: { children: ReactNode }) {
  const [hiddenPages, setHiddenPages] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Sync to backend system_settings asynchronously
  const syncToBackend = useCallback(async (routes: string[]) => {
    try {
      await fetch(`${API_BASE}/api/system/page-visibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden_pages: routes }),
      });
    } catch {
      // Backend may be offline/restarting; local storage acts as durable cache
    }
  }, []);

  // Save changes to localStorage and dispatch event for cross-tab / cross-component sync
  const commitChanges = useCallback(
    (newHidden: string[]) => {
      // Guarantee protected routes (e.g. /company-master) are never hidden
      const sanitized = newHidden.filter((href) => !isRouteProtected(href));
      const deduped = Array.from(new Set(sanitized));

      setHiddenPages(deduped);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped));
        window.dispatchEvent(
          new CustomEvent("alpha_india_page_visibility_change", {
            detail: deduped,
          })
        );
      } catch {
        // Storage write failed
      }
      syncToBackend(deduped);
    },
    [syncToBackend]
  );

  // Initialize: Load from localStorage first, then merge with backend settings
  useEffect(() => {
    let initial: string[] = [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          initial = parsed.filter((href) => !isRouteProtected(href));
        }
      }
    } catch {
      // Ignore parse error
    }

    setHiddenPages(initial);
    setIsLoaded(true);

    // Fetch remote configuration from backend if available
    const fetchBackendSettings = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/system/page-visibility`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.hidden_pages)) {
            const remoteCleaned = data.hidden_pages.filter(
              (href: string) => !isRouteProtected(href)
            );
            // If localStorage was empty, use remote
            if (initial.length === 0 && remoteCleaned.length > 0) {
              setHiddenPages(remoteCleaned);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteCleaned));
            }
          }
        }
      } catch {
        // Silent fallback to local storage
      }
    };

    fetchBackendSettings();

    // Listen to changes across tabs or custom events
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setHiddenPages(parsed.filter((href) => !isRouteProtected(href)));
          }
        } catch {
          // Ignore
        }
      }
    };

    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent<string[]>;
      if (Array.isArray(customEvent.detail)) {
        setHiddenPages(customEvent.detail);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(
      "alpha_india_page_visibility_change",
      handleCustomChange
    );

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(
        "alpha_india_page_visibility_change",
        handleCustomChange
      );
    };
  }, []);

  const isPageHidden = useCallback(
    (href: string) => {
      if (isRouteProtected(href)) return false;
      return hiddenPages.includes(href);
    },
    [hiddenPages]
  );

  const hidePage = useCallback(
    async (href: string) => {
      if (isRouteProtected(href)) return;
      if (!hiddenPages.includes(href)) {
        commitChanges([...hiddenPages, href]);
      }
    },
    [hiddenPages, commitChanges]
  );

  const unhidePage = useCallback(
    async (href: string) => {
      commitChanges(hiddenPages.filter((h) => h !== href));
    },
    [hiddenPages, commitChanges]
  );

  const togglePageVisibility = useCallback(
    async (href: string) => {
      if (isRouteProtected(href)) return;
      if (hiddenPages.includes(href)) {
        commitChanges(hiddenPages.filter((h) => h !== href));
      } else {
        commitChanges([...hiddenPages, href]);
      }
    },
    [hiddenPages, commitChanges]
  );

  const unhideAll = useCallback(async () => {
    commitChanges([]);
  }, [commitChanges]);

  const hideSection = useCallback(
    async (sectionTitle: string) => {
      const section = NAVIGATION_CONFIG.find((s) => s.title === sectionTitle);
      if (!section) return;
      const toHide = section.items
        .filter((item) => !item.isProtected)
        .map((item) => item.href);
      commitChanges([...hiddenPages, ...toHide]);
    },
    [hiddenPages, commitChanges]
  );

  const unhideSection = useCallback(
    async (sectionTitle: string) => {
      const section = NAVIGATION_CONFIG.find((s) => s.title === sectionTitle);
      if (!section) return;
      const sectionHrefs = new Set(section.items.map((i) => i.href));
      commitChanges(hiddenPages.filter((h) => !sectionHrefs.has(h)));
    },
    [hiddenPages, commitChanges]
  );

  const totalCount = ALL_PAGES.length;
  const hiddenCount = hiddenPages.length;
  const visibleCount = totalCount - hiddenCount;

  return (
    <PageVisibilityContext.Provider
      value={{
        hiddenPages,
        isLoaded,
        isPageHidden,
        hidePage,
        unhidePage,
        togglePageVisibility,
        unhideAll,
        hideSection,
        unhideSection,
        totalCount,
        hiddenCount,
        visibleCount,
      }}
    >
      {children}
    </PageVisibilityContext.Provider>
  );
}

export function usePageVisibility(): PageVisibilityContextType {
  const context = useContext(PageVisibilityContext);
  if (!context) {
    // Graceful fallback if used outside provider
    return {
      hiddenPages: [],
      isLoaded: true,
      isPageHidden: () => false,
      hidePage: async () => {},
      unhidePage: async () => {},
      togglePageVisibility: async () => {},
      unhideAll: async () => {},
      hideSection: async () => {},
      unhideSection: async () => {},
      totalCount: ALL_PAGES.length,
      hiddenCount: 0,
      visibleCount: ALL_PAGES.length,
    };
  }
  return context;
}
