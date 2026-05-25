import React, { useState, useEffect, useMemo } from 'react';
import { Trophy, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, Swords, Target, Shield } from 'lucide-react';
import { fetchLeaderboard, fetchBowlingLeaderboard, fetchAllrounderLeaderboard } from '../utils/api';
import { TableRowSkeleton } from './LoadingSkeleton';
import EmptyState from './EmptyState';

// ─────────────────────────────────────────────────
// Profile Configurations
// ─────────────────────────────────────────────────

const profileConfig = {
    batting: {
        label: 'Batting',
        icon: Swords,
        color: 'emerald',
        columns: [
            { key: 'rank', label: 'Rank', sortable: false, align: 'left' },
            { key: 'name', label: 'Player', sortable: false, align: 'left' },
            { key: 'total_runs', label: 'Runs', sortable: true, align: 'right' },
            { key: 'average', label: 'Avg', sortable: true, align: 'right' },
            { key: 'strike_rate', label: 'SR', sortable: true, align: 'right' },
            { key: 'innings', label: 'Inn', sortable: true, align: 'right' },
            { key: 'boundary_rate', label: 'Boundary %', sortable: true, align: 'right' },
        ],
        metrics: [
            { value: 'total_runs', label: 'Total Runs' },
            { value: 'average', label: 'Batting Average' },
            { value: 'strike_rate', label: 'Strike Rate' },
            { value: 'boundary_rate', label: 'Boundary %' },
        ],
        defaultMetric: 'total_runs',
        defaultSort: 'total_runs',
        fetchFn: fetchLeaderboard,
        showPhase: true,
        showMinInnings: true,
    },
    bowling: {
        label: 'Bowling',
        icon: Target,
        color: 'red',
        columns: [
            { key: 'rank', label: 'Rank', sortable: false, align: 'left' },
            { key: 'name', label: 'Player', sortable: false, align: 'left' },
            { key: 'wickets', label: 'Wkts', sortable: true, align: 'right' },
            { key: 'economy', label: 'Econ', sortable: true, align: 'right' },
            { key: 'bowling_average', label: 'Avg', sortable: true, align: 'right' },
            { key: 'bowling_strike_rate', label: 'SR', sortable: true, align: 'right' },
            { key: 'matches', label: 'Matches', sortable: true, align: 'right' },
        ],
        metrics: [
            { value: 'wickets', label: 'Wickets' },
            { value: 'economy', label: 'Economy' },
            { value: 'bowling_average', label: 'Bowling Average' },
            { value: 'bowling_strike_rate', label: 'Bowling SR' },
        ],
        defaultMetric: 'wickets',
        defaultSort: 'wickets',
        fetchFn: fetchBowlingLeaderboard,
        showPhase: true,
        showMinInnings: true,
    },
    allrounder: {
        label: 'All-Rounder',
        icon: Shield,
        color: 'amber',
        columns: [
            { key: 'rank', label: 'Rank', sortable: false, align: 'left' },
            { key: 'name', label: 'Player', sortable: false, align: 'left' },
            { key: 'allrounder_score', label: 'AR Score', sortable: true, align: 'right' },
            { key: 'total_runs', label: 'Runs', sortable: true, align: 'right' },
            { key: 'batting_avg', label: 'Bat Avg', sortable: true, align: 'right' },
            { key: 'wickets', label: 'Wkts', sortable: true, align: 'right' },
            { key: 'economy', label: 'Econ', sortable: true, align: 'right' },
        ],
        metrics: [], // No metric selector — always sorted by AR Score
        defaultMetric: 'allrounder_score',
        defaultSort: 'allrounder_score',
        fetchFn: fetchAllrounderLeaderboard,
        showPhase: false,
        showMinInnings: false,
    },
};

// ─────────────────────────────────────────────────
// Color utilities for each profile accent
// ─────────────────────────────────────────────────

const profileAccentClasses = {
    emerald: {
        activeBg: 'bg-emerald-600',
        activeText: 'text-white',
        hoverBg: 'hover:bg-emerald-950/40',
        borderActive: 'border-emerald-500',
        badgeBg: 'bg-emerald-600',
        highlight: 'text-emerald-400',
        ring: 'focus:ring-emerald-500/20 focus:border-emerald-500',
        sortArrow: 'text-emerald-400',
    },
    red: {
        activeBg: 'bg-red-600',
        activeText: 'text-white',
        hoverBg: 'hover:bg-red-950/40',
        borderActive: 'border-red-500',
        badgeBg: 'bg-red-600',
        highlight: 'text-red-400',
        ring: 'focus:ring-red-500/20 focus:border-red-500',
        sortArrow: 'text-red-400',
    },
    amber: {
        activeBg: 'bg-amber-600',
        activeText: 'text-white',
        hoverBg: 'hover:bg-amber-950/40',
        borderActive: 'border-amber-500',
        badgeBg: 'bg-amber-600',
        highlight: 'text-amber-400',
        ring: 'focus:ring-amber-500/20 focus:border-amber-500',
        sortArrow: 'text-amber-400',
    },
};

const rankStyles = {
    0: 'text-amber-400', // gold
    1: 'text-neutral-300', // silver
    2: 'text-amber-700', // bronze
};

// ─────────────────────────────────────────────────
// Cell Renderers (profile-aware)
// ─────────────────────────────────────────────────

const renderCell = (key, value, profile, accent) => {
    switch (key) {
        // Batting cells
        case 'total_runs':
            if (profile === 'allrounder') {
                return <span className="font-bold text-neutral-300 tabular-nums">{parseInt(value).toLocaleString()}</span>;
            }
            return <span className="font-black text-fuchsia-400 text-lg tabular-nums">{parseInt(value).toLocaleString()}</span>;
        case 'average':
        case 'batting_avg':
            return <span className="font-semibold text-emerald-400 tabular-nums">{parseFloat(value).toFixed(1)}</span>;
        case 'strike_rate':
        case 'batting_sr':
            return (
                <span className="bg-neutral-900 border border-neutral-700 px-2.5 py-1 rounded-lg font-mono text-sm text-gray-300 tabular-nums">
                    {parseFloat(value).toFixed(1)}
                </span>
            );
        case 'boundary_rate':
            return <span className="font-semibold text-blue-400 tabular-nums">{value ? `${parseFloat(value).toFixed(1)}%` : '-'}</span>;
        case 'innings':
            return <span className="text-neutral-400 font-medium tabular-nums">{value || '-'}</span>;
        // Bowling cells
        case 'wickets':
            if (profile === 'allrounder') {
                return <span className="font-bold text-red-400 tabular-nums">{value}</span>;
            }
            return <span className="font-black text-red-400 text-lg tabular-nums">{value}</span>;
        case 'economy':
            return (
                <span className={`font-semibold tabular-nums ${parseFloat(value) <= 7.5 ? 'text-emerald-400' : parseFloat(value) <= 8.5 ? 'text-amber-400' : 'text-red-400'}`}>
                    {parseFloat(value).toFixed(2)}
                </span>
            );
        case 'bowling_average':
            return <span className="font-semibold text-cyan-400 tabular-nums">{parseFloat(value).toFixed(1)}</span>;
        case 'bowling_strike_rate':
            return (
                <span className="bg-neutral-900 border border-neutral-700 px-2.5 py-1 rounded-lg font-mono text-sm text-gray-300 tabular-nums">
                    {parseFloat(value).toFixed(1)}
                </span>
            );
        case 'matches':
            return <span className="text-neutral-400 font-medium tabular-nums">{value || '-'}</span>;
        // All-rounder AR score
        case 'allrounder_score':
            return (
                <span className="font-black text-amber-400 text-lg tabular-nums">
                    {parseFloat(value).toFixed(1)}
                </span>
            );
        default:
            return <span className="text-neutral-400 tabular-nums">{value ?? '-'}</span>;
    }
};

// ─────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────

const TopPerformers = ({ onPlayerSelect }) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState('batting');
    const [sortKey, setSortKey] = useState('total_runs');
    const [sortDir, setSortDir] = useState('desc');

    // Filter states
    const [phase, setPhase] = useState('all');
    const [metric, setMetric] = useState('total_runs');
    const [minInnings, setMinInnings] = useState(10);
    const [season, setSeason] = useState('all');

    const seasons = Array.from({ length: 19 }, (_, i) => 2008 + i).reverse();
    const config = profileConfig[profile];
    const accent = profileAccentClasses[config.color];

    // Reset sort/metric when profile changes
    useEffect(() => {
        const cfg = profileConfig[profile];
        setMetric(cfg.defaultMetric);
        setSortKey(cfg.defaultSort);
        setSortDir('desc');
        setPhase('all');
        setMinInnings(profile === 'allrounder' ? 0 : 10);
    }, [profile]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = { limit: 50 };
            if (config.showPhase && phase !== 'all') params.phase = phase;
            if (season !== 'all') params.season = season;
            if (config.showMinInnings && parseInt(minInnings) > 0) params.min_innings = minInnings;
            if (config.metrics.length > 0) params.metric = metric;

            const res = await config.fetchFn(params);
            setData(res.data);
        } catch (e) {
            console.error('Leaderboard fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [profile, phase, metric, minInnings, season]);

    // Determine sort direction: for bowling stats, lower is better by default
    const lowerIsBetterKeys = ['economy', 'bowling_average', 'bowling_strike_rate'];

    const sortedData = useMemo(() => {
        if (!data.length) return [];
        return [...data].sort((a, b) => {
            const aVal = parseFloat(a[sortKey]) || 0;
            const bVal = parseFloat(b[sortKey]) || 0;
            return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
        });
    }, [data, sortKey, sortDir]);

    const handleSort = (key) => {
        if (sortKey === key) {
            setSortDir(d => d === 'desc' ? 'asc' : 'desc');
        } else {
            setSortKey(key);
            // Default direction: ascending for lower-is-better stats
            setSortDir(lowerIsBetterKeys.includes(key) ? 'asc' : 'desc');
        }
    };

    // Profile icon rendering
    const ProfileIcon = config.icon;

    return (
        <div className="space-y-6">
            {/* Profile Tabs */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-3xl p-2 shadow-lg">
                <div className="flex gap-1.5">
                    {Object.entries(profileConfig).map(([key, cfg]) => {
                        const Icon = cfg.icon;
                        const isActive = profile === key;
                        const accentCls = profileAccentClasses[cfg.color];
                        return (
                            <button
                                key={key}
                                onClick={() => setProfile(key)}
                                className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl font-bold text-sm uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                                    isActive
                                        ? `${accentCls.activeBg} ${accentCls.activeText} shadow-lg scale-[1.02]`
                                        : `text-neutral-500 hover:text-neutral-300 ${accentCls.hoverBg}`
                                }`}
                            >
                                <Icon className="w-4.5 h-4.5" />
                                {cfg.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Filters */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-3xl p-5 shadow-lg">
                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Filters</span>

                    {/* Phase — only for batting/bowling */}
                    {config.showPhase && (
                        <div className="relative group">
                            <select
                                value={phase}
                                onChange={(e) => setPhase(e.target.value)}
                                className={`h-10 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 focus:text-white rounded-xl pl-3 pr-8 outline-none ${accent.ring} transition-all appearance-none text-xs font-semibold uppercase tracking-wider cursor-pointer`}
                            >
                                <option value="all">All Phases</option>
                                <option value="powerplay">Powerplay</option>
                                <option value="middle">Middle</option>
                                <option value="death">Death</option>
                            </select>
                            <ChevronDown className="absolute right-2.5 top-3 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
                        </div>
                    )}

                    {/* Metric — only if profile has metrics */}
                    {config.metrics.length > 0 && (
                        <div className="relative group">
                            <select
                                value={metric}
                                onChange={(e) => {
                                    setMetric(e.target.value);
                                    setSortKey(e.target.value);
                                    setSortDir(lowerIsBetterKeys.includes(e.target.value) ? 'asc' : 'desc');
                                }}
                                className={`h-10 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 focus:text-white rounded-xl pl-3 pr-8 outline-none ${accent.ring} transition-all appearance-none text-xs font-semibold uppercase tracking-wider cursor-pointer`}
                            >
                                {config.metrics.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2.5 top-3 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
                        </div>
                    )}

                    {/* Min Innings — only for batting/bowling */}
                    {config.showMinInnings && (
                        <div className="relative group">
                            <select
                                value={minInnings}
                                onChange={(e) => setMinInnings(parseInt(e.target.value))}
                                className={`h-10 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 focus:text-white rounded-xl pl-3 pr-8 outline-none ${accent.ring} transition-all appearance-none text-xs font-semibold uppercase tracking-wider cursor-pointer`}
                            >
                                <option value={0}>No Min</option>
                                <option value={5}>5+ Inn</option>
                                <option value={10}>10+ Inn</option>
                                <option value={20}>20+ Inn</option>
                                <option value={50}>50+ Inn</option>
                            </select>
                            <ChevronDown className="absolute right-2.5 top-3 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
                        </div>
                    )}

                    {/* Season — always available */}
                    <div className="relative group">
                        <select
                            value={season}
                            onChange={(e) => setSeason(e.target.value)}
                            className={`h-10 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 focus:text-white rounded-xl pl-3 pr-8 outline-none ${accent.ring} transition-all appearance-none text-xs font-semibold uppercase tracking-wider cursor-pointer`}
                        >
                            <option value="all">All Seasons</option>
                            {seasons.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-3 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
                    </div>

                    {/* AR formula hint */}
                    {profile === 'allrounder' && (
                        <div className="ml-auto text-[10px] text-neutral-600 font-mono uppercase tracking-wider hidden sm:block" title="AR Score = (Bat Avg × SR / 100) + (10000 / (Econ × Bowl SR))">
                            AR = BatImpact + BowlImpact
                        </div>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-neutral-800 bg-neutral-900/50 flex items-center justify-between">
                    <h2 className="text-2xl font-black flex items-center text-white">
                        <Trophy className={`w-6 h-6 mr-3 ${accent.highlight}`} />
                        Top {config.label === 'All-Rounder' ? 'All-Rounders' : config.label === 'Bowling' ? 'Bowlers' : 'Batters'}
                    </h2>
                    {profile === 'allrounder' && (
                        <span className="text-[10px] font-mono text-neutral-600 bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-xl hidden md:inline-block"
                              title="Batting Impact = (Avg × SR) / 100 | Bowling Impact = 10000 / (Economy × Bowling SR)">
                            Min 500 runs & 30 wickets to qualify
                        </span>
                    )}
                </div>

                {loading ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <tbody>
                                {Array.from({ length: 10 }).map((_, i) => (
                                    <TableRowSkeleton key={i} cols={config.columns.length} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : sortedData.length === 0 ? (
                    <EmptyState type="noFilters" />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-neutral-950 text-neutral-500 text-[11px] font-bold uppercase tracking-widest">
                                <tr>
                                    {config.columns.map(col => (
                                        <th
                                            key={col.key}
                                            className={`p-5 ${col.align === 'right' ? 'text-right' : ''} ${col.sortable ? 'cursor-pointer hover:text-neutral-300 transition-colors select-none' : ''}`}
                                            onClick={() => col.sortable && handleSort(col.key)}
                                        >
                                            <span className="inline-flex items-center gap-1">
                                                {col.label}
                                                {col.sortable && sortKey === col.key && (
                                                    sortDir === 'desc'
                                                        ? <ArrowDown className={`w-3 h-3 ${accent.sortArrow}`} />
                                                        : <ArrowUp className={`w-3 h-3 ${accent.sortArrow}`} />
                                                )}
                                                {col.sortable && sortKey !== col.key && (
                                                    <ArrowUpDown className="w-3 h-3 opacity-30" />
                                                )}
                                            </span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-800/50">
                                {sortedData.map((row, index) => (
                                    <tr
                                        key={index}
                                        className={`hover:bg-neutral-800/50 transition-colors group cursor-pointer ${index < 3 ? 'bg-neutral-900/30' : ''}`}
                                        onClick={() => onPlayerSelect && onPlayerSelect(row.name)}
                                    >
                                        {config.columns.map(col => (
                                            <td key={col.key} className={`p-5 ${col.align === 'right' ? 'text-right' : ''}`}>
                                                {col.key === 'rank' ? (
                                                    <span className={`font-bold ${rankStyles[index] || 'text-neutral-500'}`}>
                                                        #{index + 1}
                                                    </span>
                                                ) : col.key === 'name' ? (
                                                    <span className="font-bold text-gray-200 text-base group-hover:text-white transition-colors flex items-center gap-2">
                                                        {row.name}
                                                        <ChevronRight className="w-3.5 h-3.5 text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </span>
                                                ) : (
                                                    renderCell(col.key, row[col.key], profile, accent)
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TopPerformers;
