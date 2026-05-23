import React from "react";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className=" playfair-font min-h-screen bg-bg-primary text-text-primary overflow-x-hidden relative">
      <div className="grain-overlay" />
      <main className="relative z-10 w-full">{children}</main>
    </div>
  );
};

export default Layout;
