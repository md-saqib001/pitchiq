import React from 'react';
import { useNavigate } from 'react-router-dom';
import TopPerformers from '../components/TopPerformers';

const TopPerformersPage = () => {
    const navigate = useNavigate();

    const handlePlayerSelect = (playerName) => {
        navigate(`/player/${encodeURIComponent(playerName)}`);
    };

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500 text-left">
            <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4 bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">
                IPL Leaderboard & Top Performers
            </h1>
            <p className="text-neutral-400 max-w-2xl mb-8">
                Explore leaderboards for batting, bowling, and all-round performance with dynamic filters and sorting options.
            </p>
            <TopPerformers onPlayerSelect={handlePlayerSelect} />
        </div>
    );
};

export default TopPerformersPage;
