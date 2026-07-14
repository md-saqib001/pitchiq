import React, { useState, useEffect, useMemo } from 'react';
import { Search, Swords, Target, Zap, TrendingUp, AlertCircle, Shield } from 'lucide-react';
import { fetchMatchup, fetchPlayers } from '../utils/api';

const PlayerSearchInput = ({ value, onChange, onSelect, placeholder, allPlayers }) => {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const suggestions = useMemo(() => {
        if (!value || value.length < 2) return [];
        return allPlayers
            .filter(p => p.toLowerCase().includes(value.toLowerCase()))
            .slice(0, 5);
    }, [value, allPlayers]);

    return (
        <div className="relative flex-1">
            <Search className="absolute left-3 top-3 w-4 h-4 text-neutral-500" />
            <input
                type="text"
                value={value}
                onChange={(e) => {
                    onChange(e.target.value);
                    setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="w-full h-10 bg-neutral-900 border border-neutral-800 text-white rounded-xl pl-9 pr-3 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all text-sm font-medium placeholder:text-neutral-600"
                placeholder={placeholder}
            />
            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-12 left-0 right-0 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                    {suggestions.map((name, i) => (
                        <button
                            key={i}
                            onMouseDown={() => {
                                onSelect(name);
                                setShowSuggestions(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors font-medium"
                        >
                            {name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const StatCard = ({ icon: Icon, label, value, unit, color }) => (
    <div className="bg-neutral-900/50 backdrop-blur border border-neutral-800/50 rounded-2xl p-4 flex flex-col justify-between hover:bg-neutral-800/50 transition-colors">
        <div className="flex items-center gap-2 mb-2">
            <div className={`p-2 rounded-lg bg-${color}-500/10 text-${color}-400`}>
                <Icon className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{label}</span>
        </div>
        <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold text-white tabular-nums">{value}</span>
            {unit && <span className="text-sm font-medium text-neutral-500">{unit}</span>}
        </div>
    </div>
);

const HeadToHead = () => {
    const [batterName, setBatterName] = useState('');
    const [bowlerName, setBowlerName] = useState('');
    const [allPlayers, setAllPlayers] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searchedBatter, setSearchedBatter] = useState('');
    const [searchedBowler, setSearchedBowler] = useState('');

    useEffect(() => {
        fetchPlayers().then(res => setAllPlayers(res.data)).catch(() => {});
    }, []);

    const handleAnalyze = async () => {
        if (!batterName.trim() || !bowlerName.trim()) return;
        setLoading(true);
        setError('');
        try {
            const res = await fetchMatchup(batterName, bowlerName);
            setStats(res.data);
            setSearchedBatter(batterName);
            setSearchedBowler(bowlerName);
        } catch (e) {
            setError('Failed to fetch matchup data.');
            console.error(e);
        }
        setLoading(false);
    };

    const getBoundaryPercentage = () => {
        if (!stats || stats.balls_faced === 0) return '0.0';
        return (((stats.fours + stats.sixes) / stats.balls_faced) * 100).toFixed(1);
    };

    const getDotPercentage = () => {
        if (!stats || stats.balls_faced === 0) return '0.0';
        return ((stats.dots / stats.balls_faced) * 100).toFixed(1);
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Input Section */}
            <div className="bg-neutral-950 border border-neutral-800 p-6 rounded-3xl mb-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>
                
                <div className="flex flex-col md:flex-row gap-6 items-center">
                    <div className="flex-1 w-full space-y-2">
                        <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest pl-1">Batter</label>
                        <PlayerSearchInput 
                            value={batterName}
                            onChange={setBatterName}
                            onSelect={(v) => setBatterName(v)}
                            placeholder="Enter Batter Name"
                            allPlayers={allPlayers}
                        />
                    </div>
                    
                    <div className="flex items-center justify-center pt-6">
                        <div className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center shadow-inner">
                            <Swords className="w-5 h-5 text-neutral-500" />
                        </div>
                    </div>
                    
                    <div className="flex-1 w-full space-y-2">
                        <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest pl-1">Bowler</label>
                        <PlayerSearchInput 
                            value={bowlerName}
                            onChange={setBowlerName}
                            onSelect={(v) => setBowlerName(v)}
                            placeholder="Enter Bowler Name"
                            allPlayers={allPlayers}
                        />
                    </div>

                    <div className="pt-6 w-full md:w-auto">
                        <button
                            onClick={handleAnalyze}
                            disabled={loading || !batterName || !bowlerName}
                            className="w-full px-6 h-10 rounded-xl font-bold text-sm tracking-wide transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Swords className="w-4 h-4" />
                                    Analyze Matchup
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm text-center">
                    {error}
                </div>
            )}

            {/* Results Section */}
            {stats && !loading && (
                <div className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-500">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5 pointer-events-none"></div>
                    
                    {/* Header */}
                    <div className="flex flex-col items-center justify-center mb-8 relative z-10">
                        <div className="flex items-center gap-4 text-center">
                            <h3 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
                                {searchedBatter}
                            </h3>
                            <span className="text-neutral-500 font-bold italic">VS</span>
                            <h3 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                                {searchedBowler}
                            </h3>
                        </div>
                        {stats.balls_faced === 0 ? (
                            <p className="text-neutral-400 mt-4 text-sm flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                No matchup data found for these players.
                            </p>
                        ) : (
                            <p className="text-neutral-400 mt-2 text-sm font-medium">
                                Head-to-Head T20 Statistics
                            </p>
                        )}
                    </div>

                    {stats.balls_faced > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
                            <StatCard 
                                icon={Zap} 
                                label="Runs Scored" 
                                value={stats.total_runs} 
                                color="yellow"
                            />
                            <StatCard 
                                icon={Target} 
                                label="Balls Faced" 
                                value={stats.balls_faced} 
                                color="blue"
                            />
                            <StatCard 
                                icon={Shield} 
                                label="Outs" 
                                value={stats.dismissals} 
                                color="red"
                            />
                            <StatCard 
                                icon={TrendingUp} 
                                label="Strike Rate" 
                                value={stats.strike_rate} 
                                color="emerald"
                            />
                            
                            {/* Row 2 */}
                            <div className="bg-neutral-900/50 backdrop-blur border border-neutral-800/50 rounded-2xl p-4 flex flex-col justify-between hover:bg-neutral-800/50 transition-colors col-span-2">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Boundaries</span>
                                    <span className="text-xs font-bold text-cyan-400">{getBoundaryPercentage()}% Rate</span>
                                </div>
                                <div className="flex gap-4 mt-2">
                                    <div>
                                        <div className="text-2xl font-bold text-white">{stats.fours}</div>
                                        <div className="text-xs text-neutral-500 uppercase tracking-widest">Fours</div>
                                    </div>
                                    <div className="w-px bg-neutral-800"></div>
                                    <div>
                                        <div className="text-2xl font-bold text-white">{stats.sixes}</div>
                                        <div className="text-xs text-neutral-500 uppercase tracking-widest">Sixes</div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-neutral-900/50 backdrop-blur border border-neutral-800/50 rounded-2xl p-4 flex flex-col justify-between hover:bg-neutral-800/50 transition-colors col-span-2">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Dot Balls</span>
                                    <span className="text-xs font-bold text-purple-400">{getDotPercentage()}% Rate</span>
                                </div>
                                <div className="flex gap-4 mt-2">
                                    <div>
                                        <div className="text-2xl font-bold text-white">{stats.dots}</div>
                                        <div className="text-xs text-neutral-500 uppercase tracking-widest">Dots</div>
                                    </div>
                                    <div className="w-px bg-neutral-800"></div>
                                    <div>
                                        <div className="text-2xl font-bold text-white">{stats.average}</div>
                                        <div className="text-xs text-neutral-500 uppercase tracking-widest">Batting Avg</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default HeadToHead;
