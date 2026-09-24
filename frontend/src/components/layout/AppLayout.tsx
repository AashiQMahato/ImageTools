import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";

export function AppLayout() {
    const { pathname } = useLocation();

    // Start each route at the top, like a normal page load.
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    return (
        <div className="flex min-h-dvh flex-col bg-primary">
            <a
                href="#main"
                className="sr-only rounded-lg bg-brand-solid px-3 py-2 text-sm font-semibold text-primary_on-brand focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
            >
                Skip to content
            </a>
            <Navbar />
            <main id="main" className="flex-1">
                <Outlet />
            </main>
            <Footer />
        </div>
    );
}
