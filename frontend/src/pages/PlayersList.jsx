import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, X, UserCircle, Swords, Target, ListFilter } from 'lucide-react';
import { fetchPlayersSummary } from '../utils/api';
import EmptyState from '../components/EmptyState';

const PlayersList = () => {
    const navigate = useNavigate();

    // Query & Filter States
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [sort, setSort] = useState('total_runs'); // 'total_runs', 'total_wickets', 'name'
    const [page, setPage] = useState(1);
    const [limit] = useState(18); // 18 cards per page fits nicely in grids

    // Data States
    const [players, setPlayers] = useState([]);
    const [totalPlayers, setTotalPlayers] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    
    // Loading & Error States
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery);
            setPage(1);
        }, 450);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Load players summary
    const loadPlayers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {
                page,
                limit,
                sort
            };
            if (debouncedQuery.trim()) {
                params.q = debouncedQuery.trim();
            }
            const res = await fetchPlayersSummary(params);
            setPlayers(res.data.players);
            setTotalPlayers(res.data.totalPlayers);
            setTotalPages(res.data.totalPages);
        } catch (err) {
            console.error("Error loading players list:", err);
            setError(err.message || 'Failed to retrieve players database.');
        } finally {
            setLoading(false);
        }
    }, [page, limit, sort, debouncedQuery]);

    useEffect(() => {
        loadPlayers();
    }, [loadPlayers]);

    const handleClearFilters = () => {
        setSearchQuery('');
        setDebouncedQuery('');
        setSort('total_runs');
        setPage(1);
    };

    const hasActiveFilters = searchQuery !== '' || sort !== 'total_runs';

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500 text-left relative">
            {/* Background Glow */}
            <div className="absolute top-0 right-1/4 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl pointer-events-none -z-10"></div>

            {/* Header */}
            <div className="mb-8">
                <h1 className="text-4xl font-extrabold tracking-tight text-white mb-3 bg-gradient-to-r from-white via-neutral-200 to-neutral-500 bg-clip-text text-transparent">
                    Player Directory
                </h1>
                <p className="text-neutral-400 max-w-2xl">
                    Explore and search the complete roster of IPL players from 2008 to 2026. Review aggregate runs and wickets stats before diving deep into career metrics.
                </p>
            </div>

            {/* Search & Sort Panel */}
            <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-3xl p-6 shadow-2xl mb-8 backdrop-blur-md">
                <div className="flex flex-col md:flex-row gap-4 items-stretch">
                    {/* Search query box */}
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-3.5 w-5 h-5 text-neutral-500" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search player name... (e.g. Dhoni, Bumrah, Narine)"
                            className="w-full h-12 bg-neutral-900 border border-neutral-800 text-white rounded-2xl pl-12 pr-10 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all text-sm font-medium placeholder:text-neutral-600"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-4 top-3.5 text-neutral-500 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>

                    {/* Sorting Selector */}
                    <div className="relative group min-w-[200px]">
                        <select
                            value={sort}
                            onChange={(e) => { setSort(e.target.value); setPage(1); }}
                            className="w-full h-12 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-350 focus:text-white rounded-2xl pl-4 pr-10 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all appearance-none text-xs font-semibold uppercase tracking-wider cursor-pointer"
                        >
                            <option value="total_runs">Sort by Runs</option>
                            <option value="total_wickets">Sort by Wickets</option>
                            <option value="name">Sort by Name (A-Z)</option>
                        </select>
                        <span className="absolute right-4 top-4 text-neutral-500 pointer-events-none">▼</span>
                    </div>
                </div>

                {/* Filter helper badges */}
                <div className="flex items-center justify-between flex-wrap gap-4 border-t border-neutral-800/60 pt-4 mt-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500 uppercase tracking-widest">
                        <ListFilter className="w-4 h-4 text-neutral-600" />
                        <span>Players Match Count: <strong className="text-purple-400 font-bold ml-1">{loading ? '...' : totalPlayers}</strong></span>
                    </div>

                    {hasActiveFilters && (
                        <button
                            onClick={handleClearFilters}
                            className="text-xs bg-neutral-900 border border-neutral-800 hover:border-purple-500/50 hover:bg-neutral-900 text-neutral-400 hover:text-white px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 font-bold uppercase tracking-wider cursor-pointer"
                        >
                            Reset Search <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-950/40 border border-red-900/50 text-red-300 rounded-2xl p-4 mb-6">
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}

            {/* Loading Grid */}
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {Array.from({ length: 9 }).map((_, i) => (
                        <div 
                            key={i} 
                            className="bg-neutral-950/80 border border-neutral-850 rounded-3xl p-6 h-40 flex items-center gap-4 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-neutral-800/20 before:to-transparent before:animate-[shimmer_1.5s_ease-in-out_infinite] before:-translate-x-full"
                        >
                            <div className="w-12 h-12 bg-neutral-900 rounded-2xl flex-shrink-0"></div>
                            <div className="space-y-3 flex-1">
                                <div className="h-4 bg-neutral-800 rounded w-2/3"></div>
                                <div className="h-3 bg-neutral-850 rounded w-1/2"></div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : players.length === 0 ? (
                <EmptyState
                    type="noFilters"
                    title="No Players Found"
                    description="No players matched your search criteria. Check your spelling or reset filters."
                    action={{
                        label: "Reset Search",
                        onClick: handleClearFilters
                    }}
                />
            ) : (
                <>
                    {/* Players Directory Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                        {players.map((player, idx) => (
                            <div
                                key={idx}
                                onClick={() => navigate(`/player/${encodeURIComponent(player.name)}`)}
                                className="bg-neutral-950/50 hover:bg-neutral-950/80 border border-neutral-800/60 hover:border-purple-500/40 rounded-3xl p-5 shadow-xl transition-all duration-300 flex items-center justify-between cursor-pointer group hover:-translate-y-1 relative overflow-hidden"
                            >
                                {/* Top Glow Bar */}
                                <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-purple-500 to-fuchsia-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                                <div className="flex items-center gap-4 truncate">
                                    <div className="w-12 h-12 bg-neutral-900 border border-neutral-800 group-hover:border-neutral-700 rounded-2xl flex items-center justify-center flex-shrink-0 text-neutral-500 group-hover:text-purple-400 transition-all">
                                        <UserCircle className="w-6 h-6" />
                                    </div>
                                    <div className="truncate">
                                        <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors truncate">
                                            {player.name}
                                        </h3>
                                        <div className="flex items-center gap-3 text-[10px] font-bold text-neutral-500 mt-1 uppercase tracking-wider">
                                            <span className="flex items-center gap-1">
                                                <Swords className="w-3 h-3 text-neutral-600" />
                                                {player.total_runs ? player.total_runs.toLocaleString() : 0} runs
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Target className="w-3 h-3 text-neutral-600" />
                                                {player.total_wickets || 0} wkts
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <ChevronRight className="w-5 h-5 text-neutral-700 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                            </div>
                        ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-12 bg-neutral-950/40 border border-neutral-900 p-2.5 rounded-2xl max-w-sm mx-auto shadow-lg">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="w-10 h-10 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-neutral-900 border border-neutral-800 text-white rounded-xl flex items-center justify-center transition-colors disabled:cursor-not-allowed cursor-pointer"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>

                            <div className="px-4 text-xs font-bold uppercase tracking-wider text-neutral-400">
                                Page <span className="text-white">{page}</span> of <span className="text-white">{totalPages}</span>
                            </div>

                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="w-10 h-10 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-neutral-900 border border-neutral-800 text-white rounded-xl flex items-center justify-center transition-colors disabled:cursor-not-allowed cursor-pointer"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default PlayersList;
