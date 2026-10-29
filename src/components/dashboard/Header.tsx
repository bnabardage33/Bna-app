import React from "react";

interface HeaderProps {
  userName?: string;
  currentDate?: string;
}

export const Header: React.FC<HeaderProps> = ({
  userName = "Alex",
  currentDate = "Mardi 28 octobre",
}) => {
  return (
    <header className="pt-2 pb-4">
      <div className="flex items-center justify-between">
        <div className="font-display font-black text-2xl tracking-tighter text-bna-anthracite">
          BN<span className="text-bna-copper">A</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-bna-border/50 border border-bna-border flex items-center justify-center font-display font-semibold text-xs text-bna-anthracite">
          {userName.charAt(0)}
        </div>
      </div>

      <div className="mt-4">
        <span className="text-xs font-medium text-bna-muted">{currentDate}</span>
        <h1 className="font-display font-bold text-2xl text-bna-anthracite mt-0.5 tracking-tight">
          Bonjour, {userName}
        </h1>
      </div>
    </header>
  );
};
