import React from "react";

interface HeaderProps {
  userName?: string;
  currentDate?: string;
  onOpenAuth?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  userName = "Alex",
  currentDate = "Mardi 28 octobre",
  onOpenAuth,
}) => {
  return (
    <header className="pt-2 pb-4">
      <div className="flex items-center justify-between">
        <div className="font-display font-black text-2xl tracking-tighter text-bna-anthracite">
          BN<span className="text-bna-copper">A</span>
        </div>
        <button
          onClick={onOpenAuth}
          className="w-8 h-8 rounded-full bg-bna-border/50 border border-bna-border flex items-center justify-center font-display font-semibold text-xs text-bna-anthracite hover:border-bna-copper transition-colors cursor-pointer"
          title="Mon profil & connexion"
          aria-label="Mon profil & connexion"
        >
          {userName.charAt(0).toUpperCase()}
        </button>
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
