import React, { useRef, useEffect } from "react";
import gsap from "gsap";

interface OAuthButtonProps {
  provider: "google" | "twitter";
  onClick?: () => void;
  className?: string;
}

const OAuthButton: React.FC<OAuthButtonProps> = ({
  provider,
  onClick,
  className = "",
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const text =
    provider === "google" ? "Continue with Google" : "Continue with X";

  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;

    const hoverAnim = gsap.to(button, {
      backgroundColor: "var(--color-bg-primary)",
      color: "var(--color-text-primary)",
      borderColor: "var(--color-text-primary)",
      scale: 1.02,
      duration: 0.3,
      paused: true,
      ease: "power2.out",
    });

    button.addEventListener("mouseenter", () => hoverAnim.play());
    button.addEventListener("mouseleave", () => hoverAnim.reverse());

    return () => {
      button.removeEventListener("mouseenter", () => hoverAnim.play());
      button.removeEventListener("mouseleave", () => hoverAnim.reverse());
      hoverAnim.kill();
    };
  }, []);

  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      className={`relative w-full py-3 px-4 bg-transparent border border-white/10 rounded-lg flex items-center justify-center gap-3 transition-all ${className}`}
    >
      {provider === "google" ? (
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
      ) : (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      )}
      <span className="font-sans text-sm tracking-wide">{text}</span>
    </button>
  );
};

export default OAuthButton;
