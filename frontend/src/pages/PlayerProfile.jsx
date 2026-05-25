import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
    ArrowLeft, Calendar, MapPin, Trophy, ShieldAlert, 
    Zap, Target, UserCircle, Activity, Search, Sparkles, X, ChevronRight 
} from 'lucide-react';
import { 
    ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
    LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from 'recharts';
import { 
    fetchPlayerStats, 
    fetchPlayerBowling, 
    fetchSeasonTrend, 
    fetchPhaseBreakdown, 
    fetchPlayerBowlingPhaseBreakdown,
    fetchRecentInnings, 
    fetchPlayerBowlingRecentInnings, 
    fetchIPLAverages, 
    fetchPlayers, 
    fetchMatchup 
} from '../utils/api';
import EmptyState from '../components/EmptyState';

const PlayerProfile = () => {
    const { playerName } = useParams();
    const navigate = useNavigate();
    const decodedName = decodeURIComponent(playerName);

    // Profile & UI States
    const [profileMode, setProfileMode] = useState('batting'); // 'batting' or 'bowling'
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Player Data States
    const [battingStats, setBattingStats] = useState(null);
    const [bowlingStats, setBowlingStats] = useState(null);
    const [seasonTrend, setSeasonTrend] = useState([]);
    const [phaseData, setPhaseData] = useState([]);
    const [bowlingPhaseData, setBowlingPhaseData] = useState([]);
    const [recentInnings, setRecentInnings] = useState([]);
    const [bowlingRecentInnings, setBowlingRecentInnings] = useState([]);
    const [iplAverages, setIplAverages] = useState(null);

    // Matchup Analyzer States
    const [allPlayersList, setAllPlayersList] = useState([]);
    const [matchupQuery, setMatchupQuery] = useState('');
    const [matchupSuggestions, setMatchupSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedOpponent, setSelectedOpponent] = useState('');
    const [matchupStats, setMatchupStats] = useState(null);
    const [loadingMatchup, setLoadingMatchup] = useState(false);

    // Initial Data Fetcher
    useEffect(() => {
        const loadProfile = async () => {
            setLoading(true);
            setError(null);
            try {
                // Fetch basic batting + bowling stats + IPL benchmarks + player list
                const [batRes, bowlRes, trendRes, iplRes, playersRes] = await Promise.all([
                    fetchPlayerStats(decodedName),
                    fetchPlayerBowling(decodedName).catch(() => ({ data: null })),
                    fetchSeasonTrend(decodedName).catch(() => ({ data: [] })),
                    fetchIPLAverages().catch(() => ({ data: null })),
                    fetchPlayers().catch(() => ({ data: [] }))
                ]);

                const bStats = batRes.data;
                const bowlStats = bowlRes?.data;

                setBattingStats(bStats);
                setBowlingStats(bowlStats?.matches > 0 ? bowlStats : null);
                setSeasonTrend(trendRes.data || []);
                setIplAverages(iplRes?.data);
                setAllPlayersList(playersRes.data || []);

                // Heuristic: default mode selection
                const ballsFaced = bStats?.balls_faced || 0;
                const ballsBowled = bowlStats?.legal_balls || 0;
                if (ballsBowled > ballsFaced) {
                    setProfileMode('bowling');
                } else {
                    setProfileMode('batting');
                }

                // Reset Matchup analyzer
                setMatchupQuery('');
                setSelectedOpponent('');
                setMatchupStats(null);

            } catch (err) {
                console.error("Error loading player profile:", err);
                setError('Failed to retrieve career records for this player.');
            } finally {
                setLoading(false);
            }
        };

        if (decodedName) {
            loadProfile();
        }
    }, [decodedName]);

    // Secondary load of detailed breakdowns (based on profile mode)
    useEffect(() => {
        const loadDetails = async () => {
            try {
                if (profileMode === 'batting') {
                    const [phaseRes, recentRes] = await Promise.all([
                        fetchPhaseBreakdown(decodedName).catch(() => ({ data: [] })),
                        fetchRecentInnings(decodedName).catch(() => ({ data: [] }))
                    ]);
                    setPhaseData(phaseRes.data || []);
                    setRecentInnings(recentRes.data || []);
                } else {
                    const [phaseRes, recentRes] = await Promise.all([
                        fetchPlayerBowlingPhaseBreakdown(decodedName).catch(() => ({ data: [] })),
                        fetchPlayerBowlingRecentInnings(decodedName).catch(() => ({ data: [] }))
                    ]);
                    setBowlingPhaseData(phaseRes.data || []);
                    setBowlingRecentInnings(recentRes.data || []);
                }
            } catch (err) {
                console.error("Error loading secondary profile details:", err);
            }
        };

        if (decodedName && !loading) {
            loadDetails();
        }
    }, [decodedName, profileMode, loading]);

    // Handle matchup autocomplete query
    useEffect(() => {
        if (!matchupQuery || matchupQuery.trim().length < 2) {
            setMatchupSuggestions([]);
            return;
        }
        const filtered = allPlayersList
            .filter(p => p.toLowerCase().includes(matchupQuery.toLowerCase()) && p !== decodedName)
            .slice(0, 5);
        setMatchupSuggestions(filtered);
    }, [matchupQuery, allPlayersList, decodedName]);

    // Run matchup analysis
    const handleRunMatchup = async (opponent) => {
        setSelectedOpponent(opponent);
        setShowSuggestions(false);
        setMatchupQuery('');
        setLoadingMatchup(true);
        setMatchupStats(null);
        try {
            // Determine batter vs bowler based on profileMode
            const batterName = profileMode === 'batting' ? decodedName : opponent;
            const bowlerName = profileMode === 'batting' ? opponent : decodedName;
            
            const res = await fetchMatchup(batterName, bowlerName);
            setMatchupStats(res.data);
        } catch (err) {
            console.error("Error fetching matchup:", err);
        } finally {
            setLoadingMatchup(false);
        }
    };

    // Radar Chart Data Prep: Scale stats against overall IPL Averages (Benchmark = 100)
    const getRadarData = () => {
        if (!iplAverages) return [];

        if (profileMode === 'batting' && battingStats) {
            const playerAvg = battingStats.avg ? parseFloat(battingStats.avg) : 0;
            const playerSR = battingStats.strike_rate ? parseFloat(battingStats.strike_rate) : 0;
            const playerBR = battingStats.boundary_rate ? parseFloat(battingStats.boundary_rate) : 0;

            return [
                { subject: 'Average', Player: ((playerAvg / iplAverages.avg) * 100).toFixed(0), Benchmark: 100, val: playerAvg.toFixed(1) },
                { subject: 'Strike Rate', Player: ((playerSR / iplAverages.strike_rate) * 100).toFixed(0), Benchmark: 100, val: playerSR.toFixed(1) },
                { subject: 'Boundary %', Player: ((playerBR / iplAverages.boundary_rate) * 100).toFixed(0), Benchmark: 100, val: playerBR.toFixed(1) + '%' }
            ];
        } else if (profileMode === 'bowling' && bowlingStats) {
            const playerEco = bowlingStats.economy ? parseFloat(bowlingStats.economy) : 0;
            const playerAvg = bowlingStats.average ? parseFloat(bowlingStats.average) : 0;
            const playerSR = bowlingStats.strike_rate ? parseFloat(bowlingStats.strike_rate) : 0;

            // Bowling stats: lower is better, so invert the comparison (ipl_avg / player_avg * 100)
            const ecoRatio = playerEco > 0 ? ((iplAverages.bowling_economy / playerEco) * 100).toFixed(0) : 0;
            const avgRatio = playerAvg > 0 ? ((iplAverages.bowling_avg / playerAvg) * 100).toFixed(0) : 0;
            const srRatio = playerSR > 0 ? ((iplAverages.bowling_sr / playerSR) * 100).toFixed(0) : 0;

            return [
                { subject: 'Economy', Player: ecoRatio, Benchmark: 100, val: playerEco.toFixed(2) },
                { subject: 'Bowling Avg', Player: avgRatio, Benchmark: 100, val: playerAvg.toFixed(2) },
                { subject: 'Bowling SR', Player: srRatio, Benchmark: 100, val: playerSR.toFixed(2) }
            ];
        }
        return [];
    };

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 mt-4 space-y-8 animate-pulse text-left">
                <div className="h-6 bg-neutral-800 rounded w-24 mb-4"></div>
                <div className="bg-neutral-950 p-8 rounded-3xl border border-neutral-800 h-44 flex flex-col justify-between">
                    <div className="h-10 bg-neutral-800 rounded w-1/3"></div>
                    <div className="h-4 bg-neutral-800/60 rounded w-1/4"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="h-48 bg-neutral-950 border border-neutral-800 rounded-3xl"></div>
                    <div className="h-48 bg-neutral-950 border border-neutral-800 rounded-3xl"></div>
                    <div className="h-48 bg-neutral-950 border border-neutral-800 rounded-3xl"></div>
                </div>
            </div>
        );
    }

    if (error || !battingStats) {
        return (
            <div className="max-w-xl mx-auto p-8 my-20 text-center bg-neutral-950 border border-neutral-800 rounded-3xl">
                <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Player profile not found</h2>
                <p className="text-neutral-500 mb-6">{error || `Career stats for player "${decodedName}" could not be loaded.`}</p>
                <button
                    onClick={() => navigate('/matches')}
                    className="bg-neutral-900 border border-neutral-800 hover:border-purple-500/50 text-white px-6 py-3 rounded-2xl transition-colors font-bold flex items-center gap-2 mx-auto cursor-pointer"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to discovery
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500 text-left">
            {/* Back Navigation Button */}
            <button
                onClick={() => navigate('/matches')}
                className="group inline-flex items-center gap-2 text-sm font-bold text-neutral-400 hover:text-white transition-colors mb-6 cursor-pointer"
            >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                Back to Match Discovery
            </button>

            {/* Profile Overview Header Card */}
            <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl mb-8 relative overflow-hidden backdrop-blur-md">
                <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none -z-10"></div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex items-center gap-5">
                        <div className="w-20 h-20 bg-neutral-900 border border-neutral-850 rounded-3xl flex items-center justify-center relative shadow-inner">
                            <UserCircle className="w-10 h-10 text-neutral-500" />
                            <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-fuchsia-500 opacity-10 rounded-3xl blur-md -z-10"></div>
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                                {decodedName}
                            </h1>
                            <p className="text-neutral-400 text-xs sm:text-sm font-medium mt-1 uppercase tracking-wider flex items-center gap-1.5">
                                <Trophy className="w-4 h-4 text-purple-400" />
                                IPL Career Profile
                            </p>
                        </div>
                    </div>

                    {/* Symmetric Profile Tabs (batting/bowling toggle) */}
                    <div className="bg-neutral-900/60 p-1 rounded-2xl border border-neutral-800 flex gap-1 self-stretch md:self-auto justify-center shadow-inner">
                        <button
                            onClick={() => setProfileMode('batting')}
                            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 flex items-center gap-2 cursor-pointer ${
                                profileMode === 'batting'
                                    ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white shadow-lg'
                                    : 'text-neutral-400 hover:text-neutral-200'
                            }`}
                        >
                            <Zap className="w-4 h-4" />
                            Batting Profile
                        </button>
                        <button
                            onClick={() => bowlingStats && setProfileMode('bowling')}
                            disabled={!bowlingStats}
                            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 flex items-center gap-2 ${
                                profileMode === 'bowling'
                                    ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white shadow-lg cursor-pointer'
                                    : bowlingStats
                                        ? 'text-neutral-400 hover:text-neutral-200 cursor-pointer'
                                        : 'text-neutral-700 cursor-not-allowed'
                            }`}
                        >
                            <Target className="w-4 h-4" />
                            Bowling Profile
                        </button>
                    </div>
                </div>
            </div>

            {/* Core Stats Overview Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {profileMode === 'batting' ? (
                    <>
                        <div className="bg-neutral-950 border border-neutral-800/80 p-6 rounded-3xl shadow-xl flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">Total Runs</span>
                                <h3 className="text-3xl font-black text-white tabular-nums">{battingStats.total_runs || 0}</h3>
                            </div>
                            <div className="w-12 h-12 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-2xl flex items-center justify-center text-fuchsia-400">
                                <Zap className="w-6 h-6" />
                            </div>
                        </div>
                        <div className="bg-neutral-950 border border-neutral-800/80 p-6 rounded-3xl shadow-xl flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">Batting Average</span>
                                <h3 className="text-3xl font-black text-emerald-400 tabular-nums">{battingStats.avg ? parseFloat(battingStats.avg).toFixed(2) : '-'}</h3>
                            </div>
                            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400">
                                <Trophy className="w-6 h-6" />
                            </div>
                        </div>
                        <div className="bg-neutral-950 border border-neutral-800/80 p-6 rounded-3xl shadow-xl flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">Strike Rate</span>
                                <h3 className="text-3xl font-black text-blue-400 tabular-nums">{battingStats.strike_rate ? parseFloat(battingStats.strike_rate).toFixed(1) : '-'}</h3>
                            </div>
                            <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400">
                                <Activity className="w-6 h-6" />
                            </div>
                        </div>
                    </>
                ) : (
                    bowlingStats && (
                        <>
                            <div className="bg-neutral-950 border border-neutral-800/80 p-6 rounded-3xl shadow-xl flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">Total Wickets</span>
                                    <h3 className="text-3xl font-black text-white tabular-nums">{bowlingStats.wickets || 0}</h3>
                                </div>
                                <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400">
                                    <Target className="w-6 h-6" />
                                </div>
                            </div>
                            <div className="bg-neutral-950 border border-neutral-800/80 p-6 rounded-3xl shadow-xl flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">Economy Rate</span>
                                    <h3 className="text-3xl font-black text-amber-400 tabular-nums">{bowlingStats.economy || '0.00'}</h3>
                                </div>
                                <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center text-amber-400">
                                    <Activity className="w-6 h-6" />
                                </div>
                            </div>
                            <div className="bg-neutral-950 border border-neutral-800/80 p-6 rounded-3xl shadow-xl flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">Bowling Strike Rate</span>
                                    <h3 className="text-3xl font-black text-blue-400 tabular-nums">{bowlingStats.strike_rate || '0.0'}</h3>
                                </div>
                                <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400">
                                    <Zap className="w-6 h-6" />
                                </div>
                            </div>
                        </>
                    )
                )}
            </div>

            {/* Visualisations Tab Section */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
                
                {/* Benchmark Radar Comparison (vs overall IPL average) */}
                <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
                    <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-6 block border-b border-neutral-900 pb-3">
                        League Benchmark Comparison (IPL Avg = 100)
                    </h3>
                    <div className="h-64 w-full flex items-center justify-center">
                        {iplAverages ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={getRadarData()}>
                                    <PolarGrid stroke="#2e2b26" />
                                    <PolarAngleAxis dataKey="subject" stroke="#a3a3a3" fontSize={11} fontWeight="bold" />
                                    <PolarRadiusAxis angle={30} domain={[0, 160]} stroke="#444" fontSize={10} />
                                    <Radar name="Player" dataKey="Player" stroke="#d946ef" fill="#d946ef" fillOpacity={0.25} />
                                    <Radar name="IPL Average" dataKey="Benchmark" stroke="#737373" fill="#737373" fillOpacity={0.05} />
                                    <Tooltip 
                                        formatter={(value, name, props) => [`${value}% (${props.payload.val})`, name]}
                                        contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#262626', borderRadius: '12px' }}
                                    />
                                </RadarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-xs text-neutral-500 font-bold uppercase">Loading benchmarks...</div>
                        )}
                    </div>
                </div>

                {/* Season Trends Line Chart */}
                <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-3xl p-6 shadow-2xl xl:col-span-2 flex flex-col justify-between">
                    <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-6 block border-b border-neutral-900 pb-3">
                        Season-by-Season Career Trends
                    </h3>
                    <div className="h-64 w-full">
                        {seasonTrend.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={seasonTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid stroke="#1c1917" strokeDasharray="3 3" />
                                    <XAxis dataKey="season" stroke="#78716c" fontSize={10} tickLine={false} />
                                    <YAxis yAxisId="left" stroke="#d946ef" fontSize={10} tickLine={false} />
                                    <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={10} tickLine={false} />
                                    <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#262626', borderRadius: '12px' }} />
                                    <Legend verticalAlign="top" height={36} />
                                    {profileMode === 'batting' ? (
                                        <>
                                            <Line yAxisId="left" type="monotone" dataKey="runs" name="Runs Scored" stroke="#d946ef" strokeWidth={2} activeDot={{ r: 6 }} />
                                            <Line yAxisId="right" type="monotone" dataKey="avg" name="Batting Avg" stroke="#10b981" strokeWidth={2} />
                                        </>
                                    ) : (
                                        <>
                                            <Line yAxisId="left" type="monotone" dataKey="bowling_wickets" name="Wickets Taken" stroke="#d946ef" strokeWidth={2} activeDot={{ r: 6 }} />
                                            <Line yAxisId="right" type="monotone" dataKey="bowling_economy" name="Economy Rate" stroke="#10b981" strokeWidth={2} />
                                        </>
                                    )}
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-xs text-neutral-500 font-bold uppercase">No season trends available</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Split Grid: Phase Breakdown vs matchup */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
                
                {/* Phase splits (Powerplay, Middle, Death) */}
                <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
                    <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-6 block border-b border-neutral-900 pb-3">
                        Match Phase Performance Split
                    </h3>
                    <div className="h-64 w-full">
                        {((profileMode === 'batting' && phaseData.length > 0) || (profileMode === 'bowling' && bowlingPhaseData.length > 0)) ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart 
                                    data={profileMode === 'batting' ? phaseData : bowlingPhaseData} 
                                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                >
                                    <CartesianGrid stroke="#1c1917" strokeDasharray="3 3" />
                                    <XAxis dataKey="phase" stroke="#78716c" fontSize={10} tickLine={false} />
                                    <YAxis stroke="#78716c" fontSize={10} tickLine={false} />
                                    <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#262626', borderRadius: '12px' }} />
                                    {profileMode === 'batting' ? (
                                        <Bar dataKey="sr" name="Strike Rate" fill="#d946ef" radius={[8, 8, 0, 0]} />
                                    ) : (
                                        <Bar dataKey="economy" name="Economy Rate" fill="#10b981" radius={[8, 8, 0, 0]} />
                                    )}
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-xs text-neutral-500 font-bold uppercase">No match phase stats found</div>
                        )}
                    </div>
                </div>

                {/* Matchup Analyzer Search Box */}
                <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-3xl p-6 shadow-2xl xl:col-span-2 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-52 h-52 bg-purple-500/5 rounded-full blur-3xl pointer-events-none -z-10"></div>
                    
                    <div>
                        <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4 block border-b border-neutral-900 pb-3">
                            Matchup Intelligence vs Opponents
                        </h3>
                        
                        {/* Search Input box */}
                        <div className="relative mb-6">
                            <Search className="absolute left-4 top-3.5 w-5 h-5 text-neutral-500" />
                            <input 
                                type="text" 
                                value={matchupQuery}
                                onChange={(e) => {
                                    setMatchupQuery(e.target.value);
                                    setShowSuggestions(true);
                                }}
                                onFocus={() => setShowSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                className="w-full h-12 bg-neutral-900 border border-neutral-800 text-white rounded-2xl pl-12 pr-10 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all font-medium placeholder:text-neutral-600 text-sm"
                                placeholder={`Search opponent ${profileMode === 'batting' ? 'bowler' : 'batter'} (e.g. SP Narine)`}
                            />
                            
                            {/* Suggestions drop down */}
                            {showSuggestions && matchupSuggestions.length > 0 && (
                                <div className="absolute top-14 left-0 right-0 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    {matchupSuggestions.map((opponent, idx) => (
                                        <button
                                            key={idx}
                                            onMouseDown={() => handleRunMatchup(opponent)}
                                            className="w-full text-left px-4 py-3 text-sm text-neutral-350 hover:bg-neutral-800 hover:text-white transition-colors flex items-center gap-2 border-b border-neutral-800/30 last:border-0 font-medium cursor-pointer"
                                        >
                                            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                                            {opponent}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Matchup Data display */}
                        {loadingMatchup ? (
                            <div className="flex flex-col items-center justify-center py-10 gap-3">
                                <div className="w-6 h-6 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
                                <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Analyzing head-to-head matchup...</span>
                            </div>
                        ) : matchupStats ? (
                            <div className="bg-neutral-900/40 border border-neutral-800/60 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 animate-in fade-in duration-300">
                                <div>
                                    <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Head-To-Head Stats</div>
                                    <h4 className="text-lg font-black text-white mt-1">
                                        {profileMode === 'batting' ? `${decodedName} vs ${selectedOpponent}` : `${selectedOpponent} vs ${decodedName}`}
                                    </h4>
                                    <div className="flex items-center gap-4 mt-3 text-xs text-neutral-400 font-semibold">
                                        <span>Runs: <strong className="text-white">{matchupStats.total_runs || 0}</strong></span>
                                        <span>Balls: <strong className="text-white">{matchupStats.balls_faced || 0}</strong></span>
                                        <span>Outs: <strong className="text-red-500">{matchupStats.dismissals || 0}</strong></span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:flex items-center gap-4 self-stretch md:self-auto border-t md:border-t-0 md:border-l border-neutral-850 pt-4 md:pt-0 md:pl-6">
                                    <div className="text-center md:text-left">
                                        <div className="text-2xl font-black text-fuchsia-400 tabular-nums">{matchupStats.strike_rate || '0.0'}</div>
                                        <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider mt-0.5">Strike Rate</div>
                                    </div>
                                    <div className="text-center md:text-left">
                                        <div className="text-2xl font-black text-emerald-400 tabular-nums">{matchupStats.average || '0.0'}</div>
                                        <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider mt-0.5">Average</div>
                                    </div>
                                </div>
                            </div>
                        ) : selectedOpponent ? (
                            <div className="text-center py-8 text-neutral-500 text-xs font-semibold uppercase bg-neutral-900/20 border border-neutral-900 rounded-2xl">
                                No head-to-head records found between these players.
                            </div>
                        ) : (
                            <div className="text-center py-8 text-neutral-500 text-xs font-semibold uppercase bg-neutral-900/20 border border-neutral-900 rounded-2xl">
                                Enter an opponent name above to query direct matchup intel.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Match Innings Timeline list */}
            <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-3xl overflow-hidden shadow-2xl">
                <div className="px-6 py-5 border-b border-neutral-800 flex items-center justify-between">
                    <h2 className="text-base font-black text-white flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-purple-500" />
                        Recent Match Innings History (Last 10)
                    </h2>
                </div>

                <div className="overflow-x-auto">
                    {profileMode === 'batting' ? (
                        recentInnings.length > 0 ? (
                            <table className="w-full text-left border-collapse text-xs sm:text-sm">
                                <thead>
                                    <tr className="border-b border-neutral-800 text-neutral-500 font-bold uppercase tracking-wider text-[10px]">
                                        <th className="p-4 pl-6">Date</th>
                                        <th className="p-4">Opposition</th>
                                        <th className="p-4 text-right">Runs</th>
                                        <th className="p-4 text-right">Balls</th>
                                        <th className="p-4 text-right">4s</th>
                                        <th className="p-4 text-right">6s</th>
                                        <th className="p-4 text-right">SR</th>
                                        <th className="p-4">Dismissal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentInnings.map((inn, idx) => (
                                        <tr 
                                            key={idx}
                                            onClick={() => navigate(`/match/${inn.match_id}`)}
                                            className="border-b border-neutral-900 hover:bg-neutral-900/50 cursor-pointer transition-colors group"
                                        >
                                            <td className="p-4 pl-6 text-neutral-400 whitespace-nowrap">
                                                {new Date(inn.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="p-4 font-bold text-white group-hover:text-purple-400 transition-colors">
                                                {inn.team1 === battingStats.name ? inn.team2 : inn.team1}
                                            </td>
                                            <td className="p-4 text-right font-black text-white tabular-nums">
                                                {inn.runs}
                                            </td>
                                            <td className="p-4 text-right text-neutral-400 tabular-nums">
                                                {inn.balls}
                                            </td>
                                            <td className="p-4 text-right text-neutral-400 tabular-nums">
                                                {inn.fours}
                                            </td>
                                            <td className="p-4 text-right text-neutral-400 tabular-nums">
                                                {inn.sixes}
                                            </td>
                                            <td className="p-4 text-right font-bold text-neutral-300 tabular-nums">
                                                {inn.strike_rate}
                                            </td>
                                            <td className="p-4 text-neutral-400 italic truncate max-w-[140px]">
                                                {inn.dismissal ? (inn.dismissal === 'caught' ? `c ${inn.fielder} b ${inn.bowler}` : inn.dismissal) : 'not out'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="text-center py-10 text-neutral-500 text-xs font-semibold uppercase">No batting innings found</div>
                        )
                    ) : (
                        bowlingRecentInnings.length > 0 ? (
                            <table className="w-full text-left border-collapse text-xs sm:text-sm">
                                <thead>
                                    <tr className="border-b border-neutral-800 text-neutral-500 font-bold uppercase tracking-wider text-[10px]">
                                        <th className="p-4 pl-6">Date</th>
                                        <th className="p-4">Opposition</th>
                                        <th className="p-4 text-right">Overs</th>
                                        <th className="p-4 text-right">Runs Conceded</th>
                                        <th className="p-4 text-right">Wickets</th>
                                        <th className="p-4 text-right">Economy</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bowlingRecentInnings.map((inn, idx) => (
                                        <tr 
                                            key={idx}
                                            onClick={() => navigate(`/match/${inn.match_id}`)}
                                            className="border-b border-neutral-900 hover:bg-neutral-900/50 cursor-pointer transition-colors group"
                                        >
                                            <td className="p-4 pl-6 text-neutral-400 whitespace-nowrap">
                                                {new Date(inn.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="p-4 font-bold text-white group-hover:text-purple-400 transition-colors">
                                                {inn.team1 === decodedName ? inn.team2 : inn.team1}
                                            </td>
                                            <td className="p-4 text-right font-semibold text-neutral-350 tabular-nums">
                                                {inn.overs_str}
                                            </td>
                                            <td className="p-4 text-right font-semibold text-neutral-350 tabular-nums">
                                                {inn.runs}
                                            </td>
                                            <td className="p-4 text-right font-black text-white tabular-nums">
                                                {inn.wickets}
                                            </td>
                                            <td className="p-4 text-right font-bold text-neutral-300 tabular-nums">
                                                {inn.economy}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="text-center py-10 text-neutral-500 text-xs font-semibold uppercase">No bowling innings found</div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

export default PlayerProfile;
