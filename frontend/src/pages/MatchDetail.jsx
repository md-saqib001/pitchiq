import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
    ArrowLeft, Calendar, MapPin, Trophy, ShieldAlert, 
    Zap, Target, X, Info, HelpCircle, ChevronRight, Activity
} from 'lucide-react';
import { 
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
    Tooltip, CartesianGrid, ReferenceLine 
} from 'recharts';
import { 
    fetchMatchDetails, 
    fetchMatchScorecard, 
    fetchPlayerMatchPerformance, 
    fetchMatchMomentum 
} from '../utils/api';
import { TableRowSkeleton } from '../components/LoadingSkeleton';

const MatchDetail = () => {
    const { matchId } = useParams();
    const navigate = useNavigate();

    // Data States
    const [match, setMatch] = useState(null);
    const [scorecard, setScorecard] = useState(null);
    const [momentum, setMomentum] = useState([]);
    
    // UI States
    const [activeInningsTab, setActiveInningsTab] = useState(1); // 1 or 2
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Sliding Drawer States
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [playerPerformance, setPlayerPerformance] = useState(null);
    const [loadingPlayer, setLoadingPlayer] = useState(false);
    const [drawerTab, setDrawerTab] = useState('batting'); // 'batting' or 'bowling'

    // Load Match & Scorecard data
    useEffect(() => {
        const loadMatchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const [matchRes, scorecardRes, momentumRes] = await Promise.all([
                    fetchMatchDetails(matchId),
                    fetchMatchScorecard(matchId),
                    fetchMatchMomentum(matchId).catch(() => ({ data: { momentum: [] } }))
                ]);
                
                setMatch(matchRes.data);
                setScorecard(scorecardRes.data);
                
                // Format momentum data for chart
                const rawMom = momentumRes.data?.momentum || [];
                const formattedMom = Array.from({ length: 20 }, (_, idx) => {
                    const overNum = idx + 1;
                    const inn1 = rawMom.find(m => m.innings_number === 1 && m.over_number === overNum);
                    const inn2 = rawMom.find(m => m.innings_number === 2 && m.over_number === overNum);
                    return {
                        over: overNum,
                        Innings1: inn1 ? parseFloat(inn1.momentum) : 0,
                        Innings2: inn2 ? parseFloat(inn2.momentum) : 0,
                        inn1_runs: inn1 ? inn1.runs_this_over : 0,
                        inn1_wickets: inn1 ? inn1.wickets_this_over : 0,
                        inn2_runs: inn2 ? inn2.runs_this_over : 0,
                        inn2_wickets: inn2 ? inn2.wickets_this_over : 0,
                    };
                });
                setMomentum(formattedMom);
                
            } catch (err) {
                console.error("Error fetching match details:", err);
                setError(err.message || 'Failed to retrieve match details.');
            } finally {
                setLoading(false);
            }
        };

        if (matchId) {
            loadMatchData();
        }
    }, [matchId]);

    // Fetch player performance when row clicked
    const handlePlayerClick = async (playerName) => {
        setSelectedPlayer(playerName);
        setIsDrawerOpen(true);
        setLoadingPlayer(true);
        setPlayerPerformance(null);
        try {
            const res = await fetchPlayerMatchPerformance(matchId, playerName);
            setPlayerPerformance(res.data);
            
            // Set default tab in drawer based on what they did
            if (res.data.batting && !res.data.bowling) {
                setDrawerTab('batting');
            } else if (!res.data.batting && res.data.bowling) {
                setDrawerTab('bowling');
            } else {
                setDrawerTab('batting');
            }
        } catch (err) {
            console.error("Error loading player match stats:", err);
        } finally {
            setLoadingPlayer(false);
        }
    };

    // Format Date from YYYY-MM-DD
    const formatDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 mt-4 space-y-8 animate-pulse text-left">
                {/* Back button skeleton */}
                <div className="h-6 bg-neutral-800 rounded w-24 mb-4"></div>
                {/* Header skeleton */}
                <div className="bg-neutral-950 p-8 rounded-3xl border border-neutral-800 h-48 flex flex-col justify-between">
                    <div className="h-4 bg-neutral-800 rounded w-1/4"></div>
                    <div className="h-8 bg-neutral-800 rounded w-1/2 my-4"></div>
                    <div className="h-4 bg-neutral-800/60 rounded w-1/3"></div>
                </div>
                {/* Chart skeleton */}
                <div className="h-64 bg-neutral-950 rounded-3xl border border-neutral-800"></div>
            </div>
        );
    }

    if (error || !match || !scorecard || scorecard.length === 0) {
        return (
            <div className="max-w-xl mx-auto p-8 my-20 text-center bg-neutral-950 border border-neutral-800 rounded-3xl">
                <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Failed to load scorecard</h2>
                <p className="text-neutral-500 mb-6">{error || "Match details could not be found."}</p>
                <button
                    onClick={() => navigate('/matches')}
                    className="bg-neutral-900 border border-neutral-800 hover:border-purple-500/50 text-white px-6 py-3 rounded-2xl transition-colors font-bold flex items-center gap-2 mx-auto cursor-pointer"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to matches
                </button>
            </div>
        );
    }

    // Active Innings scorecard
    const activeInnings = scorecard.find(s => s.innings_number === activeInningsTab) || scorecard[0];
    const opposingInnings = scorecard.find(s => s.innings_number !== activeInningsTab);

    // Custom tooltips for momentum chart
    const CustomMomentumTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-2xl shadow-2xl text-left max-w-xs text-xs font-semibold text-neutral-300 space-y-2">
                    <div className="text-neutral-500 font-bold border-b border-neutral-900 pb-1 uppercase tracking-widest text-[10px]">
                        Over {data.over}
                    </div>
                    {scorecard[0] && (
                        <div className="flex justify-between items-center gap-6">
                            <span className="text-fuchsia-400 font-bold">{scorecard[0].batting_team}:</span>
                            <span>{data.inn1_runs} runs {data.inn1_wickets > 0 && <strong className="text-red-500">({data.inn1_wickets}W)</strong>}</span>
                        </div>
                    )}
                    {scorecard[1] && (
                        <div className="flex justify-between items-center gap-6">
                            <span className="text-emerald-400 font-bold">{scorecard[1].batting_team}:</span>
                            <span>{data.inn2_runs} runs {data.inn2_wickets > 0 && <strong className="text-red-500">({data.inn2_wickets}W)</strong>}</span>
                        </div>
                    )}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500 text-left relative">
            
            {/* Back Button */}
            <button
                onClick={() => navigate('/matches')}
                className="group inline-flex items-center gap-2 text-sm font-bold text-neutral-400 hover:text-white transition-colors mb-6 cursor-pointer"
            >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                Back to Matches
            </button>

            {/* Match Header Summary Banner */}
            <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl mb-8 relative overflow-hidden backdrop-blur-md">
                {/* Decorative gradients */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl pointer-events-none -z-10"></div>
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -z-10"></div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="flex flex-wrap gap-2.5 items-center text-xs font-bold text-neutral-500 tracking-wider mb-3 uppercase">
                            <span className="bg-neutral-900 border border-neutral-850 px-2.5 py-1 rounded-lg text-neutral-400">
                                IPL {match.season}
                            </span>
                            <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {formatDate(match.date)}
                            </span>
                            <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                {match.venue}
                            </span>
                        </div>

                        {/* Team Title vs */}
                        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span>{match.team1}</span>
                            <span className="text-neutral-500 font-bold text-xl sm:text-2xl">vs</span>
                            <span>{match.team2}</span>
                        </h1>

                        {/* Toss and Margin details */}
                        <div className="mt-4 text-xs font-semibold text-neutral-400 flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-xl">
                                <Info className="w-3.5 h-3.5 text-purple-400" />
                                <span>Toss: <strong className="text-white">{match.toss_winner}</strong> won and elected to <strong className="text-white">{match.toss_decision}</strong></span>
                            </div>
                        </div>
                    </div>

                    {/* Result Banner */}
                    <div className="bg-emerald-500/10 border border-emerald-500/20 px-6 py-4 rounded-2xl flex items-center gap-3 self-stretch md:self-auto justify-center">
                        <Trophy className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                        <div>
                            <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Match Winner</div>
                            <div className="text-sm font-black text-white">{match.winner} Won</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Momentum Swings Panel */}
            {momentum.length > 0 && (
                <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-3xl p-6 shadow-2xl mb-8">
                    <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-purple-500" />
                        Match Momentum Swings
                    </h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={momentum} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorInn1" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#d946ef" stopOpacity={0.25}/>
                                        <stop offset="95%" stopColor="#d946ef" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorInn2" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid stroke="#1c1917" strokeDasharray="3 3" />
                                <XAxis dataKey="over" stroke="#78716c" fontSize={10} tickLine={false} />
                                <YAxis stroke="#78716c" fontSize={10} tickLine={false} />
                                <Tooltip content={<CustomMomentumTooltip />} cursor={{ stroke: '#2e2a24', strokeWidth: 1 }} />
                                <ReferenceLine y={0} stroke="#444" strokeWidth={1} />
                                <Area 
                                    name={scorecard[0]?.batting_team} 
                                    type="monotone" 
                                    dataKey="Innings1" 
                                    stroke="#d946ef" 
                                    strokeWidth={2} 
                                    fillOpacity={1} 
                                    fill="url(#colorInn1)" 
                                />
                                <Area 
                                    name={scorecard[1]?.batting_team} 
                                    type="monotone" 
                                    dataKey="Innings2" 
                                    stroke="#10b981" 
                                    strokeWidth={2} 
                                    fillOpacity={1} 
                                    fill="url(#colorInn2)" 
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Innings Tabs */}
            <div className="flex border-b border-neutral-800 mb-8">
                {scorecard.map((inn) => {
                    const isActive = activeInningsTab === inn.innings_number;
                    return (
                        <button
                            key={inn.innings_number}
                            onClick={() => setActiveInningsTab(inn.innings_number)}
                            className={`px-6 py-4 font-bold text-xs uppercase tracking-wider border-b-2 cursor-pointer transition-all ${
                                isActive 
                                    ? 'border-purple-500 text-purple-400 bg-purple-500/5' 
                                    : 'border-transparent text-neutral-500 hover:text-neutral-300'
                            }`}
                        >
                            {inn.batting_team} <strong className="text-white ml-1.5">{inn.total_runs}/{inn.total_wickets}</strong>
                        </button>
                    );
                })}
            </div>

            {/* Scorecard Table Cards */}
            <div className="space-y-8">
                {/* Batting Scorecard */}
                <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="px-6 py-5 border-b border-neutral-800 flex items-center justify-between">
                        <h2 className="text-base font-black text-white flex items-center gap-2">
                            <Zap className="w-5 h-5 text-fuchsia-500" />
                            Batting Scorecard
                        </h2>
                        <span className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">
                            Innings {activeInnings.innings_number}
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs sm:text-sm">
                            <thead>
                                <tr className="border-b border-neutral-800 text-neutral-500 font-bold uppercase tracking-wider text-[10px]">
                                    <th className="p-4 pl-6">Batter</th>
                                    <th className="p-4">Dismissal</th>
                                    <th className="p-4 text-right">Runs</th>
                                    <th className="p-4 text-right">Balls</th>
                                    <th className="p-4 text-right">4s</th>
                                    <th className="p-4 text-right">6s</th>
                                    <th className="p-4 text-right">SR</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activeInnings.batting.map((player, idx) => {
                                    const sr = player.balls > 0 ? ((player.runs / player.balls) * 100).toFixed(1) : '0.0';
                                    
                                    // Format dismissal
                                    let dismissalStr = 'not out';
                                    if (player.dismissal_kind) {
                                        if (player.dismissal_kind === 'caught') {
                                            dismissalStr = `c ${player.dismissal_fielder} b ${player.dismissal_bowler}`;
                                        } else if (player.dismissal_kind === 'bowled') {
                                            dismissalStr = `b ${player.dismissal_bowler}`;
                                        } else if (player.dismissal_kind === 'lbw') {
                                            dismissalStr = `lbw b ${player.dismissal_bowler}`;
                                        } else if (player.dismissal_kind === 'caught and bowled') {
                                            dismissalStr = `c & b ${player.dismissal_bowler}`;
                                        } else if (player.dismissal_kind === 'stumped') {
                                            dismissalStr = `st ${player.dismissal_fielder} b ${player.dismissal_bowler}`;
                                        } else if (player.dismissal_kind === 'run out') {
                                            dismissalStr = `run out (${player.dismissal_fielder || ''})`;
                                        } else {
                                            dismissalStr = player.dismissal_kind;
                                        }
                                    }

                                    return (
                                        <tr 
                                            key={idx}
                                            onClick={() => handlePlayerClick(player.name)}
                                            className="border-b border-neutral-900 hover:bg-neutral-900/50 cursor-pointer transition-colors group"
                                        >
                                            <td className="p-4 pl-6 font-bold text-white group-hover:text-purple-400 transition-colors">
                                                {player.name}
                                            </td>
                                            <td className="p-4 text-neutral-400 italic">
                                                {dismissalStr}
                                            </td>
                                            <td className="p-4 text-right font-black text-white tabular-nums">
                                                {player.runs}
                                            </td>
                                            <td className="p-4 text-right text-neutral-400 tabular-nums">
                                                {player.balls}
                                            </td>
                                            <td className="p-4 text-right text-neutral-400 tabular-nums">
                                                {player.fours}
                                            </td>
                                            <td className="p-4 text-right text-neutral-400 tabular-nums">
                                                {player.sixes}
                                            </td>
                                            <td className="p-4 text-right font-bold text-neutral-300 tabular-nums">
                                                {sr}
                                            </td>
                                        </tr>
                                    );
                                })}

                                {/* Extras Row */}
                                <tr className="bg-neutral-950/40 border-b border-neutral-900">
                                    <td className="p-4 pl-6 font-bold text-neutral-400">Extras</td>
                                    <td className="p-4 text-neutral-500 italic">
                                        (w {activeInnings.extras.wides}, nb {activeInnings.extras.noballs}, b {activeInnings.extras.byes}, lb {activeInnings.extras.legbyes})
                                    </td>
                                    <td className="p-4 text-right font-black text-neutral-400 tabular-nums">
                                        {activeInnings.extras.total_extras}
                                    </td>
                                    <td colSpan="4"></td>
                                </tr>

                                {/* Total Innings Row */}
                                <tr className="bg-neutral-950/80 font-black text-sm">
                                    <td className="p-4 pl-6 text-white uppercase tracking-wider">Total</td>
                                    <td className="p-4 text-neutral-400">
                                        {activeInnings.total_wickets} wickets
                                    </td>
                                    <td className="p-4 text-right text-purple-400 text-base tabular-nums">
                                        {activeInnings.total_runs}
                                    </td>
                                    <td colSpan="4" className="p-4 pl-4 text-neutral-500 font-semibold text-xs text-left">
                                        (Run Rate: {(activeInnings.total_runs / (opposingInnings ? opposingInnings.bowling.reduce((acc, curr) => {
                                            const parts = curr.overs.split('.');
                                            const oversVal = parseInt(parts[0]) + (parseInt(parts[1] || '0') / 6);
                                            return acc + oversVal;
                                        }, 0) : 20)).toFixed(2)})
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Fall of Wickets Row */}
                    {activeInnings.fow && activeInnings.fow.length > 0 && (
                        <div className="px-6 py-4 bg-neutral-950/20 border-t border-neutral-900 text-xs text-neutral-400">
                            <span className="font-bold text-neutral-500 uppercase tracking-widest mr-2 block sm:inline mb-1 sm:mb-0">
                                Fall of Wickets:
                            </span>
                            <span className="font-medium leading-relaxed">
                                {activeInnings.fow.map((w, idx) => (
                                    <span key={idx}>
                                        <strong>{w.runs_at_wicket}-{idx+1}</strong> ({w.player_out}, {w.over_number}.{w.ball_number})
                                        {idx < activeInnings.fow.length - 1 ? ', ' : ''}
                                    </span>
                                ))}
                            </span>
                        </div>
                    )}
                </div>

                {/* Bowling Scorecard */}
                <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="px-6 py-5 border-b border-neutral-800 flex items-center justify-between">
                        <h2 className="text-base font-black text-white flex items-center gap-2">
                            <Target className="w-5 h-5 text-emerald-500" />
                            Bowling Scorecard
                        </h2>
                        <span className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">
                            Innings {activeInnings.innings_number}
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs sm:text-sm">
                            <thead>
                                <tr className="border-b border-neutral-800 text-neutral-500 font-bold uppercase tracking-wider text-[10px]">
                                    <th className="p-4 pl-6">Bowler</th>
                                    <th className="p-4 text-right">Overs</th>
                                    <th className="p-4 text-right">Runs</th>
                                    <th className="p-4 text-right">Wickets</th>
                                    <th className="p-4 text-right">Economy</th>
                                    <th className="p-4 text-right">Dots</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activeInnings.bowling.map((player, idx) => (
                                    <tr 
                                        key={idx}
                                        onClick={() => handlePlayerClick(player.name)}
                                        className="border-b border-neutral-900 hover:bg-neutral-900/50 cursor-pointer transition-colors group"
                                    >
                                        <td className="p-4 pl-6 font-bold text-white group-hover:text-purple-400 transition-colors">
                                            {player.name}
                                        </td>
                                        <td className="p-4 text-right font-semibold text-neutral-350 tabular-nums">
                                            {player.overs}
                                        </td>
                                        <td className="p-4 text-right font-semibold text-neutral-350 tabular-nums">
                                            {player.runs_conceded}
                                        </td>
                                        <td className="p-4 text-right font-black text-white tabular-nums">
                                            {player.wickets}
                                        </td>
                                        <td className="p-4 text-right text-neutral-400 tabular-nums">
                                            {parseFloat(player.economy).toFixed(2)}
                                        </td>
                                        <td className="p-4 text-right text-neutral-400 tabular-nums">
                                            {player.dot_balls}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Sliding Player Match Panel Drawer */}
            {isDrawerOpen && (
                <>
                    {/* Backdrop */}
                    <div 
                        onClick={() => setIsDrawerOpen(false)}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-300"
                    ></div>

                    {/* Drawer container */}
                    <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-neutral-950 border-l border-neutral-800 z-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden">
                        
                        {/* Drawer Header */}
                        <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/90">
                            <div>
                                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block mb-1">Match Intel Panel</span>
                                <Link 
                                    to={`/player/${encodeURIComponent(selectedPlayer)}`}
                                    className="text-xl font-black text-white hover:text-purple-400 hover:underline transition-all underline decoration-neutral-700 decoration-2 underline-offset-4 flex items-center gap-1 group"
                                >
                                    {selectedPlayer}
                                    <ChevronRight className="w-5 h-5 text-neutral-500 group-hover:translate-x-1 transition-transform" />
                                </Link>
                            </div>
                            <button 
                                onClick={() => setIsDrawerOpen(false)}
                                className="w-10 h-10 bg-neutral-900 border border-neutral-850 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-xl flex items-center justify-center transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Drawer Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {loadingPlayer ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <div className="w-8 h-8 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
                                    <span className="text-xs text-neutral-500 font-bold uppercase tracking-wider">Analyzing Performance...</span>
                                </div>
                            ) : playerPerformance ? (
                                <>
                                    {/* Small Stats summary panels */}
                                    <div className="space-y-4">
                                        {/* Tab switcher inside drawer if they did both batting and bowling */}
                                        {playerPerformance.batting && playerPerformance.bowling && (
                                            <div className="flex bg-neutral-900 p-1 rounded-xl border border-neutral-800">
                                                <button
                                                    onClick={() => setDrawerTab('batting')}
                                                    className={`flex-1 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                                                        drawerTab === 'batting' 
                                                            ? 'bg-neutral-800 text-fuchsia-400 shadow-sm' 
                                                            : 'text-neutral-500 hover:text-neutral-300'
                                                    }`}
                                                >
                                                    Batting
                                                </button>
                                                <button
                                                    onClick={() => setDrawerTab('bowling')}
                                                    className={`flex-1 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                                                        drawerTab === 'bowling' 
                                                            ? 'bg-neutral-800 text-emerald-400 shadow-sm' 
                                                            : 'text-neutral-500 hover:text-neutral-300'
                                                    }`}
                                                >
                                                    Bowling
                                                </button>
                                            </div>
                                        )}

                                        {/* Batting Match Stats Overview */}
                                        {drawerTab === 'batting' && playerPerformance.batting && (
                                            <div className="bg-neutral-900/50 border border-neutral-800/80 p-5 rounded-2xl animate-in fade-in duration-300">
                                                <h4 className="text-[10px] font-bold text-fuchsia-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                    <Zap className="w-3.5 h-3.5" /> Batting Match Summary
                                                </h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <div className="text-3xl font-black text-white tabular-nums">{playerPerformance.batting.runs}</div>
                                                        <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mt-1">Runs Scored</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-3xl font-black text-white tabular-nums">{playerPerformance.batting.balls}</div>
                                                        <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mt-1">Balls Faced</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xl font-bold text-neutral-300 tabular-nums">{playerPerformance.batting.strike_rate}</div>
                                                        <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mt-1">Strike Rate</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xl font-bold text-neutral-300 tabular-nums">{playerPerformance.batting.fours}s / {playerPerformance.batting.sixes}s</div>
                                                        <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mt-1">4s / 6s</div>
                                                    </div>
                                                </div>
                                                {playerPerformance.batting.dismissal_kind && (
                                                    <div className="mt-4 pt-3 border-t border-neutral-800/40 text-xs text-neutral-400 italic">
                                                        Out: {playerPerformance.batting.dismissal_kind === 'caught' ? `c ${playerPerformance.batting.dismissal_fielder} b ${playerPerformance.batting.dismissal_bowler}` : playerPerformance.batting.dismissal_kind}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Bowling Match Stats Overview */}
                                        {drawerTab === 'bowling' && playerPerformance.bowling && (
                                            <div className="bg-neutral-900/50 border border-neutral-800/80 p-5 rounded-2xl animate-in fade-in duration-300">
                                                <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                    <Target className="w-3.5 h-3.5" /> Bowling Match Summary
                                                </h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <div className="text-3xl font-black text-white tabular-nums">{playerPerformance.bowling.wickets}</div>
                                                        <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mt-1">Wickets</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-3xl font-black text-white tabular-nums">{playerPerformance.bowling.overs}</div>
                                                        <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mt-1">Overs Bowled</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xl font-bold text-neutral-300 tabular-nums">{playerPerformance.bowling.runs_conceded}</div>
                                                        <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mt-1">Runs Conceded</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xl font-bold text-neutral-300 tabular-nums">{playerPerformance.bowling.economy}</div>
                                                        <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mt-1">Economy</div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Ball-by-ball timeline */}
                                    <div>
                                        <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-5">
                                            Ball-by-Ball Timeline
                                        </h4>

                                        {/* Timeline list */}
                                        <div className="relative border-l border-neutral-800/60 ml-3.5 pl-6 space-y-6">
                                            {drawerTab === 'batting' && playerPerformance.battingTimeline && (
                                                playerPerformance.battingTimeline.map((ball, idx) => {
                                                    const isBoundary = ball.runs_batter === 4 || ball.runs_batter === 6;
                                                    const isWicket = ball.dismissal_kind !== null && ball.player_out === selectedPlayer;
                                                    
                                                    let circleBg = 'bg-neutral-800 border-neutral-700';
                                                    let textColor = 'text-neutral-400';
                                                    
                                                    if (isBoundary) {
                                                        circleBg = 'bg-emerald-950 border-emerald-600';
                                                        textColor = 'text-emerald-400';
                                                    } else if (isWicket) {
                                                        circleBg = 'bg-red-950 border-red-650';
                                                        textColor = 'text-red-400';
                                                    } else if (ball.runs_batter > 0) {
                                                        circleBg = 'bg-purple-950 border-purple-800';
                                                        textColor = 'text-purple-300';
                                                    }

                                                    return (
                                                        <div key={idx} className="relative group">
                                                            {/* Bullet indicator */}
                                                            <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${circleBg} transition-transform group-hover:scale-110 duration-200 shadow-md`}></div>

                                                            {/* Details */}
                                                            <div className="text-xs">
                                                                <span className="font-bold text-neutral-500 mr-2">
                                                                    Over {ball.over_number}.{ball.ball_number}
                                                                </span>
                                                                <span className={`font-semibold ${textColor}`}>
                                                                    {ball.runs_batter} run{ball.runs_batter !== 1 && 's'}
                                                                    {ball.extras_type && <span className="text-[10px] text-neutral-500 ml-1.5 font-bold uppercase">({ball.extras_type})</span>}
                                                                </span>
                                                                <div className="text-[10px] text-neutral-500 mt-1 font-semibold">
                                                                    vs {ball.bowler_name || ball.opponent}
                                                                </div>
                                                                {isWicket && (
                                                                    <div className="text-red-400 mt-2 bg-red-950/20 border border-red-900/30 px-3 py-2 rounded-xl italic font-medium">
                                                                        Wicket! Out: {ball.dismissal_kind}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}

                                            {drawerTab === 'bowling' && playerPerformance.bowlingTimeline && (
                                                playerPerformance.bowlingTimeline.map((ball, idx) => {
                                                    const isWicket = ball.dismissal_kind !== null && ['bowled', 'caught', 'lbw', 'stumped', 'caught and bowled', 'hit wicket'].includes(ball.dismissal_kind);
                                                    const isDot = ball.runs_total === 0;
                                                    const isBoundary = ball.runs_batter === 4 || ball.runs_batter === 6;

                                                    let circleBg = 'bg-neutral-800 border-neutral-700';
                                                    let textColor = 'text-neutral-400';

                                                    if (isWicket) {
                                                        circleBg = 'bg-red-950 border-red-650';
                                                        textColor = 'text-red-400';
                                                    } else if (isDot) {
                                                        circleBg = 'bg-neutral-900 border-neutral-800';
                                                        textColor = 'text-neutral-500';
                                                    } else if (isBoundary) {
                                                        circleBg = 'bg-amber-950 border-amber-800';
                                                        textColor = 'text-amber-400';
                                                    }

                                                    return (
                                                        <div key={idx} className="relative group">
                                                            {/* Bullet indicator */}
                                                            <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${circleBg} transition-transform group-hover:scale-110 duration-200 shadow-md`}></div>

                                                            {/* Details */}
                                                            <div className="text-xs">
                                                                <span className="font-bold text-neutral-500 mr-2">
                                                                    Over {ball.over_number}.{ball.ball_number}
                                                                </span>
                                                                <span className={`font-semibold ${textColor}`}>
                                                                    {isWicket ? 'WICKET!' : `${ball.runs_total} runs`}
                                                                    {ball.extras_type && <span className="text-[10px] text-neutral-500 ml-1.5 font-bold uppercase">({ball.extras_type})</span>}
                                                                </span>
                                                                <div className="text-[10px] text-neutral-500 mt-1 font-semibold">
                                                                    to {ball.opponent}
                                                                </div>
                                                                {isWicket && (
                                                                    <div className="text-red-400 mt-2 bg-red-950/20 border border-red-900/30 px-3 py-2 rounded-xl italic font-medium">
                                                                        Wicket: {ball.player_out} dismissed ({ball.dismissal_kind})
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-20 text-neutral-500 text-xs font-semibold uppercase">
                                    No details available
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default MatchDetail;
