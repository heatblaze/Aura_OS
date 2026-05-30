import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";

export default function AppLayout() {
  return (
    <div className="relative min-h-screen w-full flex overflow-hidden text-foreground">
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-60" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1200px] h-[1200px] rounded-full bg-primary/5 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-60 right-0 w-[800px] h-[800px] rounded-full bg-secondary/10 blur-3xl pointer-events-none" />

      <AppSidebar />
      <div className="relative z-10 flex-1 min-w-0 flex flex-col scrollbar-hide overflow-y-auto max-h-screen">
        <Outlet />
      </div>
    </div>
  );
}