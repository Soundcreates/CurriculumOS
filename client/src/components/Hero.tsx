import React from "react";

const Hero: React.FC = () => {
  return (
    <section className="min-h-screen flex flex-col justify-center px-8 pt-40 pb-20 md:pt-60 relative">
      <div className="max-w-6xl mx-auto w-full">
        <h2 className="text-secondary font-sans text-xs md:text-sm tracking-[0.2em] uppercase mb-6 animate-fade-in">
          System v1.0
        </h2>
        <h1 className="font-serif text-5xl md:text-8xl lg:text-9xl leading-[0.9] text-text-primary mb-12 animate-fade-up delay-200">
          Raw knowledge,
          <br />
          <span className="italic text-gray-400">structured</span> layout.
        </h1>
        <div className="max-w-xl animate-fade-up delay-500">
          <p className="font-sans text-lg md:text-xl text-text-secondary leading-relaxed mb-10">
            An AI-powered learning engine designed for deep focus. CurriculumOS
            compiles the noise of the internet into elegant, daily learning
            paths.
          </p>
          <button className="group relative px-8 py-4 bg-transparent border border-accent/30 text-text-primary font-sans text-sm tracking-widest uppercase hover:bg-accent/10 transition-colors duration-500">
            <span className="relative z-10">Initialize Path</span>
          </button>
        </div>
      </div>
    </section>
  );
};

export default Hero;
