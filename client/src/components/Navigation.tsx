import React from "react";

const Navigation: React.FC = () => {
  return (
    <nav className="fixed top-0 left-0 w-full z-50 px-8 py-6 flex justify-between items-center mix-blend-difference text-white">
      <div className="text-xl font-serif font-medium tracking-wide">
        CurriculumOS
      </div>
      <div className="hidden md:flex gap-12 font-sans text-sm tracking-widest uppercase opacity-80">
        <a
          href="#"
          className="hover:opacity-100 transition-opacity duration-300"
        >
          Manifesto
        </a>
        <a
          href="#"
          className="hover:opacity-100 transition-opacity duration-300"
        >
          Engine
        </a>
        <a
          href="#"
          className="hover:opacity-100 transition-opacity duration-300"
        >
          Access
        </a>
      </div>
      <div className="md:hidden">
        {/* Mobile Menu Icon Placeholder */}
        <div className="w-6 h-0.5 bg-current mb-1.5"></div>
        <div className="w-6 h-0.5 bg-current"></div>
      </div>
    </nav>
  );
};

export default Navigation;
