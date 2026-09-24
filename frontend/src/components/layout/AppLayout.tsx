import { Outlet } from "react-router-dom";
import { AppHeader } from "./AppHeader";

export function AppLayout() {
    return (
        <div className="flex min-h-dvh flex-col bg-primary">
            <AppHeader />
            <main className="mx-auto w-full max-w-container flex-1 px-4 py-10 md:px-8 md:py-16">
                <Outlet />
            </main>
        </div>
    );
}
