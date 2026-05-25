import React from 'react';

const Home = () => {
    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500 text-left">
            <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4 bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">
                PitchIQ Dashboard
            </h1>
            <p className="text-neutral-400 max-w-2xl mb-8">
                Welcome to PitchIQ, the advanced cricket analytics platform. Here you can explore player profiles, matchup intelligence, and team dynamics.
            </p>
            <div className="bg-neutral-950 border border-neutral-800 rounded-3xl p-8 shadow-2xl">
                <span className="text-sm font-bold text-fuchsia-500 uppercase tracking-widest block mb-2">Placeholder</span>
                <h2 className="text-2xl font-bold text-white mb-4">Main Dashboard Shell</h2>
                <p className="text-neutral-500">
                    The core player query, stats analysis cards, and intelligence panels will render here in the next steps.
                </p>
            </div>
        </div>
    );
};

export default Home;
