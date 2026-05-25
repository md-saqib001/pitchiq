import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Filter, X, Search, ChevronDown, Sparkles } from 'lucide-react';

const FilterBar = ({ 
    playerName, 
    setPlayerName, 
    filters, 
    setFilters, 
    onAnalyze, 
    loading 
}) => {
    const [venues, setVenues] = useState([]);
    const [teams, setTeams] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [allPlayers, setAllPlayers] = useState([]);

    useEffect(() => {
        // Fetch venues, teams, and players for suggestions
        const fetchData = async () => {
            try {
                const [venuesRes, playersRes, teamsRes] = await Promise.all([
                    axios.get('http://localhost:3000/api/venues'),
                    axios.get('http://localhost:3000/api/players'),
                    axios.get('http://localhost:3000/api/teams'),
                ]);
                setVenues(venuesRes.data.map(v => v.venue));
                setAllPlayers(playersRes.data);
                setTeams(teamsRes.data.map(t => t.team));
            } catch (err) {
                console.error("Error loading resources in FilterBar:", err);
            }
        };
        fetchData();
    }, []);

    // Handle player input search suggestions
    useEffect(() => {
        if (!playerName || playerName.trim().length < 2) {
            setSuggestions([]);
            return;
        }
        const filtered = allPlayers
            .filter(p => p.toLowerCase().includes(playerName.toLowerCase()))
            .slice(0, 5);
        setSuggestions(filtered);
    }, [playerName, allPlayers]);

    const handleChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const resetFilters = () => {
        setFilters({
            phase: 'all',
            venue: '',
            situation: 'all',
            target: 'any',
            season: 'all',
            opposition: '',
        });
    };

    const activeFilterCount = Object.keys(filters).reduce((count, key) => {
        if (key === 'phase' && filters[key] !== 'all') return count + 1;
        if (key === 'venue' && filters[key] !== '') return count + 1;
        if (key === 'situation' && filters[key] !== 'all') return count + 1;
        if (key === 'target' && filters[key] !== 'any') return count + 1;
        if (key === 'season' && filters[key] !== 'all') return count + 1;
        if (key === 'opposition' && filters[key] !== '') return count + 1;
        return count;
    }, 0);

    const seasons = Array.from({ length: 19 }, (_, i) => 2008 + i).reverse();

    return (
        <div className="bg-neutral-950 border border-neutral-800 p-5 rounded-3xl mb-8 shadow-2xl relative">
            {/* Top decorative glow */}
            <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50"></div>

            <div className="flex flex-col lg:flex-row gap-4 items-stretch">
                {/* Search Input with Suggestions */}
                <div className="relative flex-1 lg:max-w-xs">
                    <Search className="absolute left-4 top-3.5 w-5 h-5 text-neutral-500" />
                    <input 
                        type="text" 
                        value={playerName}
                        onChange={(e) => {
                            setPlayerName(e.target.value);
                            setShowSuggestions(true);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                setShowSuggestions(false);
                                onAnalyze();
                            }
                        }}
                        className="w-full h-12 bg-neutral-900 border border-neutral-800 text-white rounded-2xl pl-12 pr-4 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:bg-neutral-900 transition-all font-medium placeholder:text-neutral-600 text-sm"
                        placeholder="Search player (e.g. V Kohli)"
                    />
                    
                    {/* Auto-suggestions Dropdown */}
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute top-14 left-0 right-0 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                            {suggestions.map((name, index) => (
                                <button
                                    key={index}
                                    onMouseDown={() => {
                                        setPlayerName(name);
                                        setShowSuggestions(false);
                                    }}
                                    className="w-full text-left px-4 py-3 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors flex items-center gap-2 border-b border-neutral-800/30 last:border-0 font-medium"
                                >
                                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                                    {name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Filters Grid */}
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                    {/* Phase Selector */}
                    <div className="relative group">
                        <select 
                            value={filters.phase} 
                            onChange={(e) => handleChange('phase', e.target.value)}
                            className="w-full h-12 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 focus:text-white rounded-2xl pl-4 pr-10 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all appearance-none text-xs font-semibold uppercase tracking-wider cursor-pointer"
                        >
                            <option value="all">All Phases</option>
                            <option value="powerplay">Powerplay (0-5)</option>
                            <option value="middle">Middle (6-14)</option>
                            <option value="death">Death (15-19)</option>
                        </select>
                        <ChevronDown className="absolute right-3.5 top-4 w-4 h-4 text-neutral-500 pointer-events-none group-hover:text-neutral-400 transition-colors" />
                    </div>

                    {/* Venue Selector */}
                    <div className="relative group">
                        <select 
                            value={filters.venue} 
                            onChange={(e) => handleChange('venue', e.target.value)}
                            className="w-full h-12 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 focus:text-white rounded-2xl pl-4 pr-10 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all appearance-none text-xs font-semibold uppercase tracking-wider cursor-pointer truncate"
                        >
                            <option value="">All Venues</option>
                            <option value="Wankhede Stadium">Wankhede</option>
                            <option value="M Chinnaswamy Stadium">Chinnaswamy</option>
                            <option value="Eden Gardens">Eden Gardens</option>
                            <option value="MA Chidambaram Stadium">Chepauk</option>
                            <option value="Arun Jaitley Stadium">Feroz Shah Kotla</option>
                            {venues
                                .filter(v => ![
                                    'Wankhede Stadium', 
                                    'M Chinnaswamy Stadium', 
                                    'Eden Gardens', 
                                    'MA Chidambaram Stadium', 
                                    'Arun Jaitley Stadium'
                                ].includes(v))
                                .map((v, i) => (
                                    <option key={i} value={v}>{v}</option>
                                ))
                            }
                        </select>
                        <ChevronDown className="absolute right-3.5 top-4 w-4 h-4 text-neutral-500 pointer-events-none group-hover:text-neutral-400 transition-colors" />
                    </div>

                    {/* Situation Selector */}
                    <div className="relative group">
                        <select 
                            value={filters.situation} 
                            onChange={(e) => {
                                const val = e.target.value;
                                handleChange('situation', val);
                                if (val !== 'chase') {
                                    handleChange('target', 'any');
                                }
                            }}
                            className="w-full h-12 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 focus:text-white rounded-2xl pl-4 pr-10 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all appearance-none text-xs font-semibold uppercase tracking-wider cursor-pointer"
                        >
                            <option value="all">All Situations</option>
                            <option value="chase">Chasing</option>
                            <option value="defend">Defending</option>
                        </select>
                        <ChevronDown className="absolute right-3.5 top-4 w-4 h-4 text-neutral-500 pointer-events-none group-hover:text-neutral-400 transition-colors" />
                    </div>

                    {/* Target Selector */}
                    <div className="relative group">
                        <select 
                            value={filters.target} 
                            onChange={(e) => handleChange('target', e.target.value)}
                            disabled={filters.situation !== 'chase'}
                            className="w-full h-12 bg-neutral-900 border border-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed hover:border-neutral-700 text-neutral-300 focus:text-white rounded-2xl pl-4 pr-10 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all appearance-none text-xs font-semibold uppercase tracking-wider cursor-pointer"
                        >
                            <option value="any">Any Target</option>
                            <option value="150+">150+</option>
                            <option value="160+">160+</option>
                            <option value="170+">170+</option>
                            <option value="180+">180+</option>
                            <option value="190+">190+</option>
                        </select>
                        <ChevronDown className="absolute right-3.5 top-4 w-4 h-4 text-neutral-500 pointer-events-none group-hover:text-neutral-400 transition-colors" />
                    </div>

                    {/* Season Selector */}
                    <div className="relative group">
                        <select 
                            value={filters.season} 
                            onChange={(e) => handleChange('season', e.target.value)}
                            className="w-full h-12 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 focus:text-white rounded-2xl pl-4 pr-10 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all appearance-none text-xs font-semibold uppercase tracking-wider cursor-pointer"
                        >
                            <option value="all">All Seasons</option>
                            {seasons.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3.5 top-4 w-4 h-4 text-neutral-500 pointer-events-none group-hover:text-neutral-400 transition-colors" />
                    </div>

                    {/* Opposition Selector */}
                    <div className="relative group">
                        <select 
                            value={filters.opposition || ''} 
                            onChange={(e) => handleChange('opposition', e.target.value)}
                            className="w-full h-12 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 focus:text-white rounded-2xl pl-4 pr-10 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all appearance-none text-xs font-semibold uppercase tracking-wider cursor-pointer truncate"
                        >
                            <option value="">All Oppositions</option>
                            {teams.map((t, i) => <option key={i} value={t}>{t}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3.5 top-4 w-4 h-4 text-neutral-500 pointer-events-none group-hover:text-neutral-400 transition-colors" />
                    </div>
                </div>

                {/* Analyze Button */}
                <button 
                    onClick={onAnalyze}
                    disabled={loading || !playerName.trim()}
                    className="h-12 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white px-8 rounded-2xl font-bold transition-all shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 whitespace-nowrap text-sm cursor-pointer"
                >
                    {loading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                        <span>Analyze</span>
                    )}
                </button>
            </div>

            {/* Filter Badges and Reset Button */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center text-xs font-semibold text-neutral-500 uppercase tracking-widest gap-2">
                    <Filter className="w-3.5 h-3.5" />
                    <span>Filters Active</span>
                    {activeFilterCount > 0 ? (
                        <span className="bg-purple-600 text-white font-bold px-2 py-0.5 rounded-full text-[10px]">
                            {activeFilterCount}
                        </span>
                    ) : (
                        <span className="text-[10px] text-neutral-600 font-normal normal-case">(None)</span>
                    )}
                </div>

                {activeFilterCount > 0 && (
                    <>
                        <div className="h-4 w-px bg-neutral-800"></div>
                        
                        {/* Display Active Badges */}
                        <div className="flex flex-wrap gap-1.5">
                            {filters.phase !== 'all' && (
                                <span className="bg-purple-950/60 border border-purple-800/40 text-[10px] font-bold text-purple-400 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    Phase: {filters.phase}
                                </span>
                            )}
                            {filters.venue && (
                                <span className="bg-purple-950/60 border border-purple-800/40 text-[10px] font-bold text-purple-400 px-2 py-0.5 rounded-full uppercase tracking-wider truncate max-w-[120px]">
                                    Venue: {filters.venue.replace('Stadium', '')}
                                </span>
                            )}
                            {filters.situation !== 'all' && (
                                <span className="bg-purple-950/60 border border-purple-800/40 text-[10px] font-bold text-purple-400 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    {filters.situation}
                                </span>
                            )}
                            {filters.target !== 'any' && (
                                <span className="bg-purple-950/60 border border-purple-800/40 text-[10px] font-bold text-purple-400 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    Target: {filters.target}
                                </span>
                            )}
                            {filters.season !== 'all' && (
                                <span className="bg-purple-950/60 border border-purple-800/40 text-[10px] font-bold text-purple-400 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    Season: {filters.season}
                                </span>
                            )}
                            {filters.opposition && (
                                <span className="bg-purple-950/60 border border-purple-800/40 text-[10px] font-bold text-purple-400 px-2 py-0.5 rounded-full uppercase tracking-wider truncate max-w-[140px]">
                                    vs {filters.opposition}
                                </span>
                            )}
                        </div>

                        <button 
                            onClick={resetFilters}
                            className="text-[10px] bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-400 hover:text-white px-2.5 py-1 rounded-full flex items-center gap-1 transition-all uppercase tracking-wider cursor-pointer"
                        >
                            Reset Filters <X className="w-3 h-3" />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default FilterBar;