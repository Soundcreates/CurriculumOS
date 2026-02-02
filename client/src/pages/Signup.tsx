import React, { useEffect, useRef } from "react";
import Layout from "../components/Layout";
import Navigation from "../components/Navigation";
import OAuthButton from "../components/OAuthButton";
import gsap from "gsap";
import { Link } from "react-router-dom";

const Signup: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    tl.fromTo(
      containerRef.current,
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 1, delay: 0.2 },
    )
      .fromTo(
        titleRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8 },
        "-=0.5",
      )
      .fromTo(
        formRef.current?.children || [],
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.1 },
        "-=0.6",
      );

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <Layout>
      <Navigation />
      <div className="min-h-screen flex flex-col items-center justify-center px-4 relative z-10">
        <div ref={containerRef} className="w-full max-w-md">
          <div className="text-center mb-10">
            <h1
              ref={titleRef}
              className="text-4xl md:text-5xl font-serif text-white mb-4"
            >
              Begin your path
            </h1>
            <p className="text-text-secondary font-sans tracking-wide">
              Create an account to start your curriculum.
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-8 rounded-2xl shadow-2xl">
            <form ref={formRef} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-widest text-text-secondary">
                  Full Name
                </label>
                <input
                  type="text"
                  className="bg-transparent border-b border-white/20 py-2 text-white focus:outline-none focus:border-white transition-colors placeholder:text-white/20 font-sans"
                  placeholder="John Doe"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-widest text-text-secondary">
                  Email
                </label>
                <input
                  type="email"
                  className="bg-transparent border-b border-white/20 py-2 text-white focus:outline-none focus:border-white transition-colors placeholder:text-white/20 font-sans"
                  placeholder="scholar@curriculum.os"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-widest text-text-secondary">
                  Password
                </label>
                <input
                  type="password"
                  className="bg-transparent border-b border-white/20 py-2 text-white focus:outline-none focus:border-white transition-colors placeholder:text-white/20 font-sans"
                  placeholder="Create a strong password"
                />
              </div>

              <button className="mt-4 bg-white text-black py-3 rounded-lg font-serif text-lg hover:bg-white/90 transition-colors">
                Create Account
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[#0f0f0f] px-2 text-text-secondary">
                    Or continue with
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <OAuthButton provider="google" />
                <OAuthButton provider="twitter" />
              </div>
            </form>
          </div>

          <p className="mt-8 text-center text-text-secondary text-sm">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-white hover:underline underline-offset-4"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default Signup;
