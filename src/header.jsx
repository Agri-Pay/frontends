import React from "react";

const Header = () => {
  return (
    <header className="w-full px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto flex items-center justify-between py-4 border-b border-primary/20 dark:border-primary/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 text-primary">
            <svg
              fill="none"
              viewBox="0 0 48 48"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                clipRule="evenodd"
                d="M12.0799 24L4 19.2479L9.95537 8.75216L18.04 13.4961L18.0446 4H29.9554L29.96 13.4961L38.0446 8.75216L44 19.2479L35.92 24L44 28.7521L38.0446 39.2479L29.96 34.5039L29.9554 44H18.0446L18.04 34.5039L9.95537 39.2479L4 28.7521L12.0799 24Z"
                fill="currentColor"
                fillRule="evenodd"
              ></path>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            AgriPay
          </h1>
        </div>
        <nav className="hidden md:flex items-center gap-6">
          <a
            className="text-sm font-medium hover:text-primary transition-colors"
            href="#"
          >
            About
          </a>
          <a
            className="text-sm font-medium hover:text-primary transition-colors"
            href="#"
          >
            Contact
          </a>
          <button className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary/20 hover:bg-primary/30 dark:bg-primary/30 dark:hover:bg-primary/40 text-gray-800 dark:text-white transition-colors">
            Sign Up
          </button>
        </nav>
        <button className="md:hidden flex items-center justify-center p-2 rounded-lg hover:bg-primary/20 dark:hover:bg-primary/30">
          <span className="material-symbols-outlined">menu</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
