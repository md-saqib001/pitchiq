import React, { useState, useEffect, useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from 'recharts';
import { Search, Sparkles, Swords, ChevronDown } from 'lucide-react';
import { fetchCompareStats, fetchPlayers } from '../utils/api';

const dimensions = [
    { key: 'avg', label: 'Average', max: 60 },
    { key: 'sr', label: 'Strike Rate', max: 180 },
    { key: 'boundary_rate', label: 'Boundary %', max: 30 },
    { key: 'powerplay_sr', label: 'Powerplay SR', max: 200 },
    { key: 'death_sr', label: 'Death SR', max: 200 },
];

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

const StatRow = ({ label, val1, val2, format = 'number' }) => {
    const f = (v) => {
        if (v === null || v === undefined) return '-';
        if (format === 'pct') return `${parseFloat(v).toFixed(1)}%`;
        if (format === 'dec') return parseFloat(v).toFixed(1);
        return Number(v).toLocaleString();
    };
    const better1 = parseFloat(val1) > parseFloat(val2);
    const better2 = parseFloat(val2) > parseFloat(val1);

    return (
        <div className="grid grid-cols-3 items-center py-3 border-b border-neutral-800/50 last:border-0">
            <div className={`text-right font-bold tabular-nums text-lg ${better1 ? 'text-emerald-400' : 'text-neutral-400'}`}>
                {f(val1)}
            </div>
            <div className="text-center text-xs text-neutral-500 font-bold uppercase tracking-widest">
                {label}
            </div>
            <div className={`text-left font-bold tabular-nums text-lg ${better2 ? 'text-emerald-400' : 'text-neutral-400'}`}>
                {f(val2)}
            </div>
        </div>
    );
};

const PlayerCompare = () => {
    const [player1Name, setPlayer1Name] = useState('');
    const [player2Name, setPlayer2Name] = useState('');
    const [player1Stats, setPlayer1Stats] = useState(null);
    const [player2Stats, setPlayer2Stats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [allPlayers, setAllPlayers] = useState([]);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchPlayers().then(res => setAllPlayers(res.data)).catch(() => {});
    }, []);

    const handleCompare = async () => {
        if (!player1Name.trim() || !player2Name.trim()) return;
        setLoading(true);
        setError('');
        try {
            const [res1, res2] = await Promise.all([
                fetchCompareStats(player1Name),
                fetchCompareStats(player2Name),
            ]);
            setPlayer1Stats(res1.data);
            setPlayer2Stats(res2.data);
        } catch (e) {
            setError(e.message || 'Failed to fetch comparison data');
        } finally {
            setLoading(false);
        }
    };

    // Prepare radar chart data
    const radarData = useMemo(() => {
        if (!player1Stats || !player2Stats) return [];
        return dimensions.map(dim => ({
            dimension: dim.label,
            player1: Math.min((parseFloat(player1Stats[dim.key]) / dim.max) * 100, 100) || 0,
            player2: Math.min((parseFloat(player2Stats[dim.key]) / dim.max) * 100, 100) || 0,
        }));
    }, [player1Stats, player2Stats]);

    return (
        <div className="space-y-6">
            {/* Search Controls */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 shadow-lg">
                <h2 className="text-xl font-black text-white mb-5 flex items-center">
                    <Swords className="w-5 h-5 mr-3 text-purple-400" />
                    Head-to-Head Comparator
                </h2>

                <div className="flex items-center gap-3">
                    <PlayerSearchInput
                        value={player1Name}
                        onChange={setPlayer1Name}
                        onSelect={setPlayer1Name}
                        placeholder="Player 1 (e.g. V Kohli)"
                        allPlayers={allPlayers}
                    />
                    <span className="text-neutral-600 font-black text-sm px-2">VS</span>
                    <PlayerSearchInput
                        value={player2Name}
                        onChange={setPlayer2Name}
                        onSelect={setPlayer2Name}
                        placeholder="Player 2 (e.g. GJ Maxwell)"
                        allPlayers={allPlayers}
                    />
                    <button
                        onClick={handleCompare}
                        disabled={loading || !player1Name.trim() || !player2Name.trim()}
                        className="h-10 bg-purple-600 hover:bg-purple-500 active:scale-95 text-white px-6 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap cursor-pointer"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : 'Compare'}
                    </button>
                </div>

                {error && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                        {error}
                    </div>
                )}
            </div>

            {/* Results */}
            {player1Stats && player2Stats && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* Radar Chart */}
                    <div className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 shadow-lg">
                        <h3 className="text-neutral-400 font-bold text-xs uppercase tracking-widest mb-4">
                            Performance Radar
                        </h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                                    <PolarGrid stroke="#333" />
                                    <PolarAngleAxis
                                        dataKey="dimension"
                                        tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 600 }}
                                    />
                                    <PolarRadiusAxis
                                        angle={90}
                                        domain={[0, 100]}
                                        tick={false}
                                        axisLine={false}
                                    />
                                    <Radar
                                        name={player1Name}
                                        dataKey="player1"
                                        stroke="#a855f7"
                                        fill="#a855f7"
                                        fillOpacity={0.2}
                                        strokeWidth={2}
                                    />
                                    <Radar
                                        name={player2Name}
                                        dataKey="player2"
                                        stroke="#22c55e"
                                        fill="#22c55e"
                                        fillOpacity={0.2}
                                        strokeWidth={2}
                                    />
                                    <Legend
                                        wrapperStyle={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af' }}
                                    />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Side-by-Side Stats */}
                    <div className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 shadow-lg">
                        {/* Header */}
                        <div className="grid grid-cols-3 items-center mb-6">
                            <div className="text-right">
                                <span className="text-white font-black text-lg">{player1Name}</span>
                                <div className="text-[11px] text-neutral-500">{player1Stats.matches} matches</div>
                            </div>
                            <div className="text-center text-xs text-neutral-600 font-bold uppercase tracking-widest">
                                Stat
                            </div>
                            <div className="text-left">
                                <span className="text-white font-black text-lg">{player2Name}</span>
                                <div className="text-[11px] text-neutral-500">{player2Stats.matches} matches</div>
                            </div>
                        </div>

                        <StatRow label="Average" val1={player1Stats.avg} val2={player2Stats.avg} format="dec" />
                        <StatRow label="Strike Rate" val1={player1Stats.sr} val2={player2Stats.sr} format="dec" />
                        <StatRow label="Runs" val1={player1Stats.runs} val2={player2Stats.runs} />
                        <StatRow label="Boundary %" val1={player1Stats.boundary_rate} val2={player2Stats.boundary_rate} format="pct" />
                        <StatRow label="PP SR" val1={player1Stats.powerplay_sr} val2={player2Stats.powerplay_sr} format="dec" />
                        <StatRow label="Death SR" val1={player1Stats.death_sr} val2={player2Stats.death_sr} format="dec" />
                        <StatRow label="Innings" val1={player1Stats.innings} val2={player2Stats.innings} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlayerCompare;
