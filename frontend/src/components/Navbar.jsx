import React from 'react';
import { NavLink } from 'react-router-dom';
import { Activity } from 'lucide-react';

const Navbar = () => {
    return (
        <header className="bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800 p-4 sticky top-0 z-50 w-full text-left">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                {/* Brand Logo */}
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-fuchsia-600 to-purple-800 rounded-xl shadow-lg shadow-fuchsia-900/20">
                        <Activity className="w-6 h-6 text-white animate-pulse" />
                    </div>
                    <h1 className="text-2xl font-black tracking-tight text-white m-0 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent flex items-center">
                        🏏 PitchIQ <span className="text-fuchsia-500 text-xs align-top ml-1">PRO</span>
                    </h1>
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
