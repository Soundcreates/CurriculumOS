import React, { useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";
import Navigation from "../components/Navigation";
import OAuthButton from "../components/OAuthButton";
import gsap from "gsap";
import { Link, useNavigate } from "react-router-dom";
import { login, startOAuthLogin } from "../apis/authApi";

const Login: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const startOAuth = (provider: "google" | "twitter") => {
    startOAuthLogin(provider);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setStatusMessage("");
    setIsSubmitting(true);

    try {
      const response = await login({
        email,
        password,
      });

      const data = response.data as {
        success?: boolean;
        token?: string;
        user?: unknown;
        message?: string;
      };

      if (data?.token || data?.user || data?.success) {
        navigate("/dashboard");
        return;
      }

      setStatusMessage(data?.message ?? "Login request completed.");
    } catch {
      setErrorMessage("Login failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
              Welcome back
            </h1>
            <p className="text-text-secondary font-sans tracking-wide">
              Sign in to continue your curriculum.
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-8 rounded-2xl shadow-2xl">
            <form
              ref={formRef}
              className="flex flex-col gap-5"
              onSubmit={handleSubmit}
            >
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-widest text-text-secondary">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="bg-transparent border-b border-white/20 py-2 text-white focus:outline-none focus:border-white transition-colors placeholder:text-white/20 font-sans"
                  placeholder="scholar@curriculum.os"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-widest text-text-secondary">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="bg-transparent border-b border-white/20 py-2 text-white focus:outline-none focus:border-white transition-colors placeholder:text-white/20 font-sans"
                  placeholder="••••••••"
                  required
                />
              </div>

              {errorMessage ? (
                <p className="text-sm text-red-300">{errorMessage}</p>
              ) : null}

              {statusMessage ? (
                <p className="text-sm text-text-secondary">{statusMessage}</p>
              ) : null}

              <div className="flex justify-end">
                <a
                  href="#"
                  className="text-xs text-text-secondary hover:text-white transition-colors"
                >
                  Forgot Password?
                </a>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-4 bg-white text-black py-3 rounded-lg font-serif text-lg hover:bg-white/90 transition-colors disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Signing In..." : "Sign In"}
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
                <OAuthButton
                  provider="google"
                  onClick={() => startOAuth("google")}
                />
                <OAuthButton
                  provider="twitter"
                  onClick={() => startOAuth("twitter")}
                />
              </div>
            </form>
          </div>

          <p className="mt-8 text-center text-text-secondary text-sm">
            Don't have an account?{" "}
            <Link
              to="/signup"
              className="text-white hover:underline underline-offset-4"
            >
              Join the waitlist
            </Link>
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default Login;
