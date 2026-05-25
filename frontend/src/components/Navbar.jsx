import React from 'react';
import { NavLink } from 'react-router-dom';
import { Activity } from 'lucide-react';

const Navbar = () => {
    return (
        <header className="bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800 p-4 sticky top-0 z-50 w-full text-left">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                {/* Brand Logo */}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center bg-neutral-900 border border-neutral-800/80 rounded-xl shadow-inner relative group overflow-hidden">
                        <svg viewBox="0 0 100 100" className="w-8 h-8 relative z-10 transition-transform duration-500 group-hover:rotate-12" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <linearGradient id="batGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#d946ef" />
                                    <stop offset="100%" stopColor="#8b5cf6" />
                                </linearGradient>
                                <linearGradient id="ballGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#ef4444" />
                                    <stop offset="100%" stopColor="#991b1b" />
                                </linearGradient>
                            </defs>
                            {/* Bat handle */}
                            <path d="M72 16 L58 30" stroke="url(#batGrad)" strokeWidth="5" strokeLinecap="round" />
                            {/* Grip wrap lines */}
                            <path d="M68 20 L72 16" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
                            <path d="M64 24 L68 20" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
                            {/* Bat blade */}
                            <path d="M58 30 L22 66 C19 69 16 73 18 76 C20 79 24 78 27 75 L63 39 Z" fill="url(#batGrad)" />
                            {/* Cricket Ball */}
                            <circle cx="34" cy="38" r="10" fill="url(#ballGrad)" />
                            {/* Seam */}
                            <path d="M29 33 C33 37 36 40 40 44" stroke="#ffffff" strokeWidth="1.2" strokeDasharray="1.5,1.5" opacity="0.9" />
                        </svg>
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-fuchsia-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xl font-black tracking-tight text-white m-0 bg-gradient-to-r from-white via-neutral-100 to-neutral-400 bg-clip-text text-transparent flex items-center leading-none">
                            PitchIQ <span className="text-fuchsia-500 text-[10px] tracking-widest font-black uppercase ml-1.5 px-1.5 py-0.5 bg-fuchsia-500/10 border border-fuchsia-500/25 rounded-md">Pro</span>
                        </span>
                        <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest mt-1.5 leading-none">
                            Advanced Cricket Analytics
                        </span>
                    </div>
                </div>

                {/* Navigation Links */}
                <nav className="flex bg-neutral-900 p-1 rounded-xl border border-neutral-800">
                    <NavLink
                        to="/"
                        className={({ isActive }) =>
                            `px-5 py-2.5 rounded-lg font-semibold transition-all duration-300 cursor-pointer ${
                                isActive ? 'bg-neutral-800 text-fuchsia-400 shadow-sm' : 'text-gray-400 hover:text-gray-200'
                            }`
                        }
                    >
                        Home
                    </NavLink>
                    <NavLink
                        to="/matches"
                        className={({ isActive }) =>
                            `px-5 py-2.5 rounded-lg font-semibold transition-all duration-300 cursor-pointer ${
                                isActive ? 'bg-neutral-800 text-fuchsia-400 shadow-sm' : 'text-gray-400 hover:text-gray-200'
                            }`
                        }
                    >
                        Matches
                    </NavLink>
                    <NavLink
                        to="/players"
                        className={({ isActive }) =>
                            `px-5 py-2.5 rounded-lg font-semibold transition-all duration-300 cursor-pointer ${
                                isActive ? 'bg-neutral-800 text-fuchsia-400 shadow-sm' : 'text-gray-400 hover:text-gray-200'
                            }`
                        }
                    >
                        Players
                    </NavLink>
                    <NavLink
                        to="/top-performers"
                        className={({ isActive }) =>
                            `px-5 py-2.5 rounded-lg font-semibold transition-all duration-300 cursor-pointer ${
                                isActive ? 'bg-neutral-800 text-fuchsia-400 shadow-sm' : 'text-gray-400 hover:text-gray-200'
                            }`
                        }
                    >
                        Top Performers
                    </NavLink>
                </nav>
            </div>
        </header>
    );
};

export default Navbar;
