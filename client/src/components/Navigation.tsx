import React, { useEffect, useRef } from "react";
import { Link,useNavigate } from "react-router-dom";
import gsap from "gsap";


const Navigation: React.FC = () => {
  const navigate = useNavigate();

  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const navElement = navRef.current;

    gsap.fromTo(
      navElement,
      {
        y: -50,
        opacity: 0,
      },
      {
        y: 0,
        opacity: 1,
        duration: 1,
        ease: "power2.out",
        delay: 0.2,
      },
    );
    return () => {
      gsap.killTweensOf(navElement);
    };
  }, []);
  return (
    <nav
      ref={navRef}
      className="fixed top-0 left-0 w-full z-50 px-8 py-6 flex justify-between items-center mix-blend-difference text-white"
    >
      <div onClick = {() => navigate('/')} className=" cursor-pointer text-xl font-serif font-medium tracking-wide">
        CurriculumOS
      </div>
      <div className="hidden md:flex gap-12 font-sans text-sm tracking-widest uppercase opacity-80">
        <Link
          to="/dashboard"
          className="hover:opacity-100 transition-opacity duration-300"
        >
          Dashboard
        </Link>
        <Link
          to="/profile"
          className="hover:opacity-100 transition-opacity duration-300"
        >
          Profile
        </Link>
        <Link
          to="/login"
          className="hover:opacity-100 transition-opacity duration-300"
        >
          Login
        </Link>
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
