import React from "react";

interface CardProps {
  number: string;
  title: string;
  description: string;
}

const Card: React.FC<CardProps> = ({ number, title, description }) => {
  return (
    <div className="group p-8 border border-white/5 hover:border-accent/30 transition-colors duration-500 bg-white/[0.02]">
      <div className="font-sans text-xs text-accent tracking-widest mb-6 opacity-60 group-hover:opacity-100 transition-opacity">
        {number}
      </div>
      <h3 className="font-serif text-2xl md:text-3xl text-text-primary mb-4">
        {title}
      </h3>
      <p className="font-sans text-sm md:text-base text-text-secondary leading-relaxed opacity-80">
        {description}
      </p>
    </div>
  );
};

export default Card;
