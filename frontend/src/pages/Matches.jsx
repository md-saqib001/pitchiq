import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Search, Calendar, MapPin, ChevronLeft, ChevronRight, 
    Trophy, X, ListFilter, ArrowUpDown, HelpCircle
} from 'lucide-react';
import { fetchMatchesList, fetchVenues, fetchTeams } from '../utils/api';
import EmptyState from '../components/EmptyState';

const Matches = () => {
    const navigate = useNavigate();

    // Filters and Search States
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [season, setSeason] = useState('all');
    const [team, setTeam] = useState('all');
    const [venue, setVenue] = useState('all');
    const [sort, setSort] = useState('date_desc');
    
    // Pagination State
    const [page, setPage] = useState(1);
    const [limit] = useState(12); // 12 matches per page is clean in grid layouts

    // Data States
    const [matches, setMatches] = useState([]);
    const [totalMatches, setTotalMatches] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    
    // Resource options
    const [teamsList, setTeamsList] = useState([]);
    const [venuesList, setVenuesList] = useState([]);
    
    // Loading & Error States
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // List of seasons 2008 to 2026 (descending)
    const seasons = Array.from({ length: 19 }, (_, i) => 2008 + i).reverse();

    // Fetch initial filter data (teams and venues)
    useEffect(() => {
        const loadFilterResources = async () => {
            try {
                const [teamsRes, venuesRes] = await Promise.all([
                    fetchTeams(),
                    fetchVenues()
                ]);
                setTeamsList(teamsRes.data.map(t => t.team));
                setVenuesList(venuesRes.data.map(v => v.venue));
            } catch (err) {
                console.error("Failed to load filter drop-down options:", err);
            }
        };
        loadFilterResources();
    }, []);

    // Debounce search query to prevent excessive queries
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery);
            setPage(1); // Reset to page 1 on new search
        }, 400);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Main API data fetcher
    const fetchMatches = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {
                page,
                limit,
                sort,
            };
            if (season !== 'all') params.season = season;
            if (team !== 'all') params.team = team;
            if (venue !== 'all') params.venue = venue;
            if (debouncedQuery.trim()) params.q = debouncedQuery.trim();

            const res = await fetchMatchesList(params);
            setMatches(res.data.matches);
            setTotalMatches(res.data.totalMatches);
            setTotalPages(res.data.totalPages);
        } catch (err) {
            setError(err.message || 'Failed to retrieve matches. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [page, limit, season, team, venue, debouncedQuery, sort]);

    useEffect(() => {
        fetchMatches();
    }, [fetchMatches]);

    // Handle filter resets
    const handleResetFilters = () => {
        setSearchQuery('');
        setDebouncedQuery('');
        setSeason('all');
        setTeam('all');
        setVenue('all');
        setSort('date_desc');
        setPage(1);
    };

    // Format Date from YYYY-MM-DD to beautiful DD MMM YYYY
    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const hasActiveFilters = 
        searchQuery !== '' || 
        season !== 'all' || 
        team !== 'all' || 
        venue !== 'all' || 
        sort !== 'date_desc';

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500 text-left">
            {/* Header Section */}
            <div className="relative mb-8">
                <h1 className="text-4xl font-extrabold tracking-tight text-white mb-3 bg-gradient-to-r from-white via-neutral-200 to-neutral-500 bg-clip-text text-transparent">
                    Match Discovery
                </h1>
                <p className="text-neutral-400 max-w-2xl">
                    Search and explore historical IPL matches from 2008 to 2026. Review detailed scorecards, match phases, and team performances.
                </p>
                <div className="absolute top-0 right-0 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>
            </div>

            {/* Filter and Search Panel */}
            <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-3xl p-6 shadow-2xl mb-8 backdrop-blur-md">
                <div className="flex flex-col gap-4">
                    {/* Search row */}
                    <div className="relative">
                        <Search className="absolute left-4 top-3.5 w-5 h-5 text-neutral-500" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by team, player or venue... (e.g. Kohli, Mumbai, Wankhede)"
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

                    {/* Dropdowns row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        {/* Season Filter */}
                        <div className="relative group">
                            <select
                                value={season}
                                onChange={(e) => { setSeason(e.target.value); setPage(1); }}
                                className="w-full h-12 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 focus:text-white rounded-2xl pl-4 pr-10 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all appearance-none text-xs font-semibold uppercase tracking-wider cursor-pointer"
                            >
                                <option value="all">All Seasons</option>
                                {seasons.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                            <span className="absolute right-4 top-4 text-neutral-500 pointer-events-none">▼</span>
                        </div>

                        {/* Team Filter */}
                        <div className="relative group">
                            <select
                                value={team}
                                onChange={(e) => { setTeam(e.target.value); setPage(1); }}
                                className="w-full h-12 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 focus:text-white rounded-2xl pl-4 pr-10 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all appearance-none text-xs font-semibold uppercase tracking-wider cursor-pointer truncate"
                            >
                                <option value="all">All Teams</option>
                                {teamsList.map((t, idx) => (
                                    <option key={idx} value={t}>{t}</option>
                                ))}
                            </select>
                            <span className="absolute right-4 top-4 text-neutral-500 pointer-events-none">▼</span>
                        </div>

                        {/* Venue Filter */}
                        <div className="relative group">
                            <select
                                value={venue}
                                onChange={(e) => { setVenue(e.target.value); setPage(1); }}
                                className="w-full h-12 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 focus:text-white rounded-2xl pl-4 pr-10 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all appearance-none text-xs font-semibold uppercase tracking-wider cursor-pointer truncate"
                            >
                                <option value="all">All Venues</option>
                                {venuesList.map((v, idx) => (
                                    <option key={idx} value={v}>{v}</option>
                                ))}
                            </select>
                            <span className="absolute right-4 top-4 text-neutral-500 pointer-events-none">▼</span>
                        </div>

                        {/* Sort Order */}
                        <div className="relative group">
                            <select
                                value={sort}
                                onChange={(e) => { setSort(e.target.value); setPage(1); }}
                                className="w-full h-12 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 focus:text-white rounded-2xl pl-4 pr-10 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all appearance-none text-xs font-semibold uppercase tracking-wider cursor-pointer"
                            >
                                <option value="date_desc">Latest First</option>
                                <option value="date_asc">Oldest First</option>
                            </select>
                            <span className="absolute right-4 top-4 text-neutral-500 pointer-events-none">▼</span>
                        </div>
                    </div>

                    {/* Filter Badges and Reset Button */}
                    <div className="flex items-center justify-between flex-wrap gap-4 border-t border-neutral-800/60 pt-4 mt-1">
                        <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500 uppercase tracking-widest">
                            <ListFilter className="w-4 h-4 text-neutral-600" />
                            <span>Matches Found: <strong className="text-purple-400 font-bold ml-1">{loading ? '...' : totalMatches}</strong></span>
                        </div>

                        {hasActiveFilters && (
                            <button
                                onClick={handleResetFilters}
                                className="text-xs bg-neutral-900 border border-neutral-800 hover:border-purple-500/50 hover:bg-neutral-900 text-neutral-400 hover:text-white px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 font-bold uppercase tracking-wider cursor-pointer"
                            >
                                Clear Search & Filters <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-950/40 border border-red-900/50 text-red-300 rounded-2xl p-4 mb-6">
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}

            {/* Loading Grid Skeleton */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div 
                            key={i} 
                            className="bg-neutral-950/80 border border-neutral-800/80 rounded-3xl p-6 h-64 flex flex-col justify-between relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-neutral-800/20 before:to-transparent before:animate-[shimmer_1.5s_ease-in-out_infinite] before:-translate-x-full"
                        >
                            <div className="flex justify-between items-center">
                                <div className="h-4 bg-neutral-800 rounded w-1/3"></div>
                                <div className="h-4 bg-neutral-800 rounded w-16"></div>
                            </div>
                            <div className="space-y-4 my-6">
                                <div className="flex justify-between items-center">
                                    <div className="h-5 bg-neutral-800 rounded w-1/2"></div>
                                    <div className="h-5 bg-neutral-800 rounded w-16"></div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="h-5 bg-neutral-800 rounded w-5/12"></div>
                                    <div className="h-5 bg-neutral-800 rounded w-20"></div>
                                </div>
                            </div>
                            <div className="h-8 bg-neutral-800/60 rounded-xl w-full"></div>
                        </div>
                    ))}
                </div>
            ) : matches.length === 0 ? (
                <EmptyState
                    type="noFilters"
                    title="No Matches Found"
                    description="No IPL matches matched your search criteria. Try relaxing your filters or check your search spelling."
                    action={{
                        label: "Reset All Filters",
                        onClick: handleResetFilters
                    }}
                />
            ) : (
                <>
                    {/* Matches Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {matches.map((match) => {
                            const isChased = match.team2_batting === match.winner;
                            return (
                                <div
                                    key={match.id}
                                    onClick={() => navigate(`/match/${match.id}`)}
                                    className="bg-neutral-950/60 hover:bg-neutral-950/90 border border-neutral-800/60 hover:border-purple-500/40 rounded-3xl p-6 shadow-xl hover:shadow-purple-500/5 transition-all duration-300 flex flex-col justify-between cursor-pointer group hover:-translate-y-1 relative overflow-hidden"
                                >
                                    {/* Top glow hover bar */}
                                    <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-purple-500 to-fuchsia-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                                    {/* Card Header */}
                                    <div>
                                        <div className="flex justify-between items-start text-xs font-bold text-neutral-500 tracking-wider mb-4 uppercase">
                                            <span className="bg-neutral-900 border border-neutral-800 px-2.5 py-1 rounded-lg text-neutral-400 group-hover:text-purple-400 transition-colors">
                                                IPL {match.season}
                                            </span>
                                            <span>{formatDate(match.date)}</span>
                                        </div>

                                        {/* Innings Details */}
                                        <div className="space-y-3.5 my-5">
                                            {/* Team 1 (first innings) */}
                                            <div className="flex justify-between items-center">
                                                <span className={`text-sm font-bold transition-colors ${match.winner === match.team1 ? 'text-white group-hover:text-purple-300' : 'text-neutral-400'}`}>
                                                    {match.team1}
                                                </span>
                                                <div className="text-right">
                                                    <span className={`text-base font-black tabular-nums tracking-tight ${match.winner === match.team1 ? 'text-white' : 'text-neutral-400'}`}>
                                                        {match.team1_runs}/{match.team1_wickets}
                                                    </span>
                                                    <span className="text-neutral-500 text-xs ml-1.5 font-medium">
                                                        ({match.team1_overs})
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Team 2 (second innings) */}
                                            <div className="flex justify-between items-center">
                                                <span className={`text-sm font-bold transition-colors ${match.winner === match.team2 ? 'text-white group-hover:text-purple-300' : 'text-neutral-400'}`}>
                                                    {match.team2}
                                                </span>
                                                <div className="text-right">
                                                    <span className={`text-base font-black tabular-nums tracking-tight ${match.winner === match.team2 ? 'text-white' : 'text-neutral-400'}`}>
                                                        {match.team2_runs}/{match.team2_wickets}
                                                    </span>
                                                    <span className="text-neutral-500 text-xs ml-1.5 font-medium">
                                                        ({match.team2_overs})
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card Footer */}
                                    <div className="border-t border-neutral-900/60 pt-4 mt-2">
                                        <div className="flex items-center justify-between text-xs font-medium">
                                            {/* Winner Info */}
                                            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                                                <Trophy className="w-3.5 h-3.5" />
                                                <span>{match.winner} Won</span>
                                            </div>
                                            
                                            {/* Venue Info */}
                                            <div className="flex items-center gap-1 text-neutral-500 font-semibold max-w-[50%] truncate">
                                                <MapPin className="w-3 h-3 flex-shrink-0" />
                                                <span className="truncate">{match.venue}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Pagination Controls */}
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

export default Matches;
