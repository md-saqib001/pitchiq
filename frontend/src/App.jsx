import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import {
    Activity, Trophy, UserCircle, Target, Zap, MapPin, Swords
} from 'lucide-react';

import Navbar from './components/Navbar';
import Home from './pages/Home';
import Matches from './pages/Matches';
import MatchDetail from './pages/MatchDetail';
import PlayerProfile from './pages/PlayerProfile';
import PlayersList from './pages/PlayersList';
import TopPerformersPage from './pages/TopPerformersPage';

import FilterBar from './components/FilterBar';
import AskPitchIQ from './components/AskPitchIQ';
import StatCard from './components/StatCard';
import PhaseBreakdown from './components/PhaseBreakdown';
import VenueIntelligence from './components/VenueIntelligence';
import MatchTimeline from './components/MatchTimeline';
import PlayerCompare from './components/PlayerCompare';
import HeadToHead from './components/HeadToHead';
import TopPerformers from './components/TopPerformers';
import { DashboardSkeleton } from './components/LoadingSkeleton';
import EmptyState from './components/EmptyState';

import {
    fetchPlayerStats,
    fetchPlayerBowling,
    fetchSeasonTrend,
    fetchIPLAverages,
    fetchPhaseBreakdown,
    fetchVenueStats,
    fetchRecentInnings,
    fetchPlayerBowlingPhaseBreakdown,
    fetchPlayerBowlingVenueStats,
    fetchPlayerBowlingRecentInnings,
} from './utils/api';

const App = () => {
    const [activeTab, setActiveTab] = useState('player');
    const [loading, setLoading] = useState(false);

    // Filter State
    const [playerName, setPlayerName] = useState('V Kohli');
    const [filters, setFilters] = useState({
        phase: 'all',
        venue: '',
        situation: 'all',
        target: 'any',
        season: 'all',
        opposition: '',
    });

    // Player State
    const [profileMode, setProfileMode] = useState('batting');
    const [lastAnalyzedPlayer, setLastAnalyzedPlayer] = useState('');
    const [playerStats, setPlayerStats] = useState(null);
    const [playerBowling, setPlayerBowling] = useState(null);
    const [seasonTrend, setSeasonTrend] = useState([]);
    const [iplAverages, setIplAverages] = useState(null);
    
    // Batting and Bowling secondary state
    const [phaseData, setPhaseData] = useState([]);
    const [bowlingPhaseData, setBowlingPhaseData] = useState([]);
    const [venueData, setVenueData] = useState([]);
    const [bowlingVenueData, setBowlingVenueData] = useState([]);
    const [recentInnings, setRecentInnings] = useState([]);
    const [bowlingRecentInnings, setBowlingRecentInnings] = useState([]);

    // Secondary loading states
    const [loadingPhase, setLoadingPhase] = useState(false);
    const [loadingVenue, setLoadingVenue] = useState(false);
    const [loadingTimeline, setLoadingTimeline] = useState(false);

    // Fetch IPL averages once
    useEffect(() => {
        fetchIPLAverages()
            .then(res => setIplAverages(res.data))
            .catch(() => {});
    }, []);

    const handleAnalyze = useCallback(async () => {
        if (!playerName.trim()) return;
        setLoading(true);

        try {
            // Primary: batting + bowling stats
            const [battingRes, bowlingRes] = await Promise.all([
                fetchPlayerStats(playerName, filters),
                fetchPlayerBowling(playerName, filters).catch(() => ({ data: null })),
            ]);
            
            const bStats = battingRes.data;
            const bowlStats = bowlingRes?.data;
            
            setPlayerStats(bStats);
            setPlayerBowling(bowlStats?.matches > 0 ? bowlStats : null);
            
            const ballsFaced = bStats?.balls_faced || 0;
            const ballsBowled = bowlStats?.legal_balls || 0;
            const isBowler = ballsBowled > ballsFaced;
            
            if (playerName !== lastAnalyzedPlayer) {
                setProfileMode(isBowler ? 'bowling' : 'batting');
                setLastAnalyzedPlayer(playerName);
            }
        } catch (error) {
            console.error('Error fetching player stats', error);
            setPlayerStats(null);
            setPlayerBowling(null);
        } finally {
            setLoading(false);
        }

        // Secondary: season trend (for sparklines) — independent of filters
        fetchSeasonTrend(playerName)
            .then(res => setSeasonTrend(res.data))
            .catch(() => setSeasonTrend([]));

        // Phase breakdown (Batting & Bowling concurrently)
        setLoadingPhase(true);
        Promise.all([
            fetchPhaseBreakdown(playerName, filters).catch(() => ({ data: [] })),
            fetchPlayerBowlingPhaseBreakdown(playerName, filters).catch(() => ({ data: [] }))
        ]).then(([battingPhase, bowlingPhase]) => {
            setPhaseData(battingPhase.data || []);
            setBowlingPhaseData(bowlingPhase.data || []);
        }).catch(() => {
            setPhaseData([]);
            setBowlingPhaseData([]);
        }).finally(() => setLoadingPhase(false));

        // Venue stats (Batting & Bowling concurrently)
        setLoadingVenue(true);
        Promise.all([
            fetchVenueStats(playerName).catch(() => ({ data: [] })),
            fetchPlayerBowlingVenueStats(playerName).catch(() => ({ data: [] }))
        ]).then(([battingVenue, bowlingVenue]) => {
            setVenueData(battingVenue.data || []);
            setBowlingVenueData(bowlingVenue.data || []);
        }).catch(() => {
            setVenueData([]);
            setBowlingVenueData([]);
        }).finally(() => setLoadingVenue(false));

        // Recent innings (Batting & Bowling concurrently)
        setLoadingTimeline(true);
        Promise.all([
            fetchRecentInnings(playerName).catch(() => ({ data: [] })),
            fetchPlayerBowlingRecentInnings(playerName).catch(() => ({ data: [] }))
        ]).then(([battingRecent, bowlingRecent]) => {
            setRecentInnings(battingRecent.data || []);
            setBowlingRecentInnings(bowlingRecent.data || []);
        }).catch(() => {
            setRecentInnings([]);
            setBowlingRecentInnings([]);
        }).finally(() => setLoadingTimeline(false));
    }, [playerName, filters, lastAnalyzedPlayer]);

    useEffect(() => {
        if (playerName) {
            handleAnalyze();
        }
    }, [playerName, filters]);

    const handlePhaseClick = (phase) => {
        setFilters(prev => ({ ...prev, phase }));
        // Trigger re-analyze after state update
        setTimeout(() => handleAnalyze(), 50);
    };

    const handlePlayerSelect = (name) => {
        setPlayerName(name);
        setActiveTab('player');
        setTimeout(() => handleAnalyze(), 50);
    };

    // Helper to get sparkline data for a specific metric
    const getSparkData = (metricKey) => {
        return seasonTrend.map(s => ({
            season: s.season,
            value: s[metricKey] || 0,
        }));
    };

    return (
        <div className="min-h-screen bg-neutral-900 text-gray-100 font-sans selection:bg-fuchsia-500/30">
            <Navbar />

            <Routes>
                <Route path="/" element={
                    <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 mt-4">
                        {/* Tab Switcher inside Home page to maintain existing functionality */}
                        <div className="flex justify-center mb-6">
                            <nav className="flex bg-neutral-950/60 backdrop-blur-md p-1 rounded-xl border border-neutral-800/80">
                                <button
                                    onClick={() => setActiveTab('player')}
                                    className={`px-5 py-2.5 rounded-lg font-semibold transition-all duration-300 cursor-pointer ${activeTab === 'player' ? 'bg-neutral-800 text-fuchsia-400 shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                                >
                                    Player Intel
                                </button>
                                <button
                                    onClick={() => setActiveTab('compare')}
                                    className={`px-5 py-2.5 rounded-lg font-semibold transition-all duration-300 cursor-pointer ${activeTab === 'compare' ? 'bg-neutral-800 text-purple-400 shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                                >
                                    Compare
                                </button>
                                <button
                                    onClick={() => setActiveTab('h2h')}
                                    className={`px-5 py-2.5 rounded-lg font-semibold transition-all duration-300 cursor-pointer ${activeTab === 'h2h' ? 'bg-neutral-800 text-cyan-400 shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                                >
                                    Head-to-head
                                </button>
                            </nav>
                        </div>

                        {/* ─── PLAYER INTEL TAB ─── */}
                        {activeTab === 'player' && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* Filter Bar */}
                                <FilterBar
                                    playerName={playerName}
                                    setPlayerName={setPlayerName}
                                    filters={filters}
                                    setFilters={setFilters}
                                    onAnalyze={handleAnalyze}
                                    loading={loading}
                                />

                                {/* Profile Mode Toggle */}
                                {playerStats && !loading && (
                                    <div className="flex justify-center mb-6 animate-in fade-in duration-300">
                                        <div className="bg-neutral-950/60 backdrop-blur-md p-1 rounded-2xl border border-neutral-800/80 flex gap-1 shadow-inner">
                                            <button
                                                onClick={() => setProfileMode('batting')}
                                                className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 flex items-center gap-2 cursor-pointer ${
                                                    profileMode === 'batting'
                                                        ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white shadow-lg shadow-fuchsia-500/20'
                                                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/55'
                                                }`}
                                            >
                                                <Zap className="w-4 h-4" />
                                                Batting Profile
                                            </button>
                                            <button
                                                onClick={() => playerBowling && setProfileMode('bowling')}
                                                disabled={!playerBowling}
                                                className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 flex items-center gap-2 ${
                                                    profileMode === 'bowling'
                                                        ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white shadow-lg shadow-fuchsia-500/20 cursor-pointer'
                                                        : playerBowling
                                                            ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/55 cursor-pointer'
                                                            : 'text-neutral-700 cursor-not-allowed'
                                                }`}
                                            >
                                                <Target className="w-4 h-4" />
                                                Bowling Profile
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Stats content */}
                                {loading ? (
                                    <DashboardSkeleton />
                                ) : (
                                    playerStats ? (
                                        <div className="space-y-8 animate-in fade-in duration-500">
                                            {/* Primary Stats Grid */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                                {profileMode === 'batting' ? (
                                                    <>
                                                        <StatCard
                                                            label="Batting Average"
                                                            value={playerStats.avg ? parseFloat(playerStats.avg) : null}
                                                            decimals={1}
                                                            sparkData={getSparkData('avg')}
                                                            benchmark={iplAverages?.avg}
                                                            color="emerald"
                                                            info="Runs per dismissal"
                                                        />
                                                        <StatCard
                                                            label="Strike Rate"
                                                            value={playerStats.strike_rate ? parseFloat(playerStats.strike_rate) : null}
                                                            decimals={1}
                                                            sparkData={getSparkData('sr')}
                                                            benchmark={iplAverages?.strike_rate}
                                                            color="amber"
                                                            info="Runs scored per 100 balls"
                                                        />
                                                        <StatCard
                                                            label="Boundary %"
                                                            value={playerStats.boundary_rate ? parseFloat(playerStats.boundary_rate) : null}
                                                            decimals={1}
                                                            suffix="%"
                                                            sparkData={getSparkData('boundary_rate')}
                                                            benchmark={iplAverages?.boundary_rate}
                                                            color="blue"
                                                            info="Percentage of balls hit for 4s or 6s"
                                                        />
                                                        <StatCard
                                                            label="Runs / Matches"
                                                            value={playerStats.total_runs || 0}
                                                            subValue={`${playerStats.matches || 0} Matches (${playerStats.dismissals || 0} Outs)`}
                                                            sparkData={getSparkData('runs')}
                                                            color="fuchsia"
                                                            info="Total career runs & match count"
                                                        />
                                                    </>
                                                ) : (
                                                    playerBowling && (
                                                        <>
                                                            <StatCard
                                                                label="Wickets"
                                                                value={playerBowling.wickets}
                                                                subValue={`${playerBowling.matches || 0} Matches`}
                                                                sparkData={getSparkData('bowling_wickets')}
                                                                color="red"
                                                                info="Total career wickets"
                                                            />
                                                            <StatCard
                                                                label="Economy"
                                                                value={playerBowling.economy}
                                                                sparkData={getSparkData('bowling_economy')}
                                                                benchmark={iplAverages?.bowling_economy}
                                                                color="emerald"
                                                                info="Runs conceded per over"
                                                            />
                                                            <StatCard
                                                                label="Bowling Avg"
                                                                value={playerBowling.average}
                                                                sparkData={getSparkData('bowling_average')}
                                                                benchmark={iplAverages?.bowling_avg}
                                                                color="cyan"
                                                                info="Runs conceded per wicket"
                                                            />
                                                            <StatCard
                                                                label="Bowling SR"
                                                                value={playerBowling.strike_rate}
                                                                sparkData={getSparkData('bowling_strike_rate')}
                                                                benchmark={iplAverages?.bowling_sr}
                                                                color="blue"
                                                                info="Balls bowled per wicket"
                                                            />
                                                        </>
                                                    )
                                                )}
                                            </div>

                                            {/* Summary section */}
                                            {profileMode === 'batting' ? (
                                                <div className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 shadow-2xl text-left">
                                                    <h3 className="text-neutral-400 font-bold mb-6 flex items-center tracking-wide text-xs uppercase tracking-widest">
                                                        <UserCircle className="w-4 h-4 mr-2 text-fuchsia-500" />
                                                        Batting Overview
                                                    </h3>
                                                    <div className="flex justify-around items-end h-32 pb-4">
                                                        <div className="text-center relative z-10">
                                                            <div className="text-5xl font-black text-fuchsia-400 tabular-nums tracking-tighter">{playerStats.total_runs}</div>
                                                            <div className="text-xs font-bold text-neutral-500 mt-3 tracking-widest">TOTAL RUNS</div>
                                                        </div>
                                                        <div className="h-full w-px bg-neutral-800"></div>
                                                        <div className="text-center relative z-10">
                                                            <div className="text-5xl font-black text-emerald-400 tabular-nums tracking-tighter">{playerStats.avg ? parseFloat(playerStats.avg).toFixed(1) : '-'}</div>
                                                            <div className="text-xs font-bold text-neutral-500 mt-3 tracking-widest">AVERAGE</div>
                                                        </div>
                                                        <div className="h-full w-px bg-neutral-800"></div>
                                                        <div className="text-center relative z-10">
                                                            <div className="text-5xl font-black text-blue-400 tabular-nums tracking-tighter">{playerStats.strike_rate ? parseFloat(playerStats.strike_rate).toFixed(1) : '-'}</div>
                                                            <div className="text-xs font-bold text-neutral-500 mt-3 tracking-widest">STRIKE RATE</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                playerBowling && (
                                                    <div className="bg-neutral-950 border border-neutral-800 rounded-3xl p-6 shadow-2xl text-left">
                                                        <h3 className="text-neutral-400 font-bold mb-6 flex items-center tracking-wide text-xs uppercase tracking-widest">
                                                            <Target className="w-4 h-4 mr-2 text-fuchsia-500" />
                                                            Bowling Overview
                                                        </h3>
                                                        <div className="flex justify-around items-end h-32 pb-4">
                                                            <div className="text-center relative z-10">
                                                                <div className="text-5xl font-black text-red-400 tabular-nums tracking-tighter">{playerBowling.wickets}</div>
                                                                <div className="text-xs font-bold text-neutral-500 mt-3 tracking-widest">TOTAL WICKETS</div>
                                                            </div>
                                                            <div className="h-full w-px bg-neutral-800"></div>
                                                            <div className="text-center relative z-10">
                                                                <div className="text-5xl font-black text-emerald-400 tabular-nums tracking-tighter">{playerBowling.economy}</div>
                                                                <div className="text-xs font-bold text-neutral-500 mt-3 tracking-widest">ECONOMY</div>
                                                            </div>
                                                            <div className="h-full w-px bg-neutral-800"></div>
                                                            <div className="text-center relative z-10">
                                                                <div className="text-5xl font-black text-blue-400 tabular-nums tracking-tighter">{playerBowling.average}</div>
                                                                <div className="text-xs font-bold text-neutral-500 mt-3 tracking-widest">AVERAGE</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            )}

                                            {/* Phase + Venue side by side */}
                                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                                <PhaseBreakdown
                                                    data={profileMode === 'bowling' ? bowlingPhaseData : phaseData}
                                                    loading={loadingPhase}
                                                    onPhaseClick={handlePhaseClick}
                                                    mode={profileMode}
                                                />
                                                <VenueIntelligence
                                                    data={profileMode === 'bowling' ? bowlingVenueData : venueData}
                                                    loading={loadingVenue}
                                                    mode={profileMode}
                                                />
                                            </div>

                                            {/* Match Timeline */}
                                            <MatchTimeline
                                                data={profileMode === 'bowling' ? bowlingRecentInnings : recentInnings}
                                                loading={loadingTimeline}
                                                playerName={playerName}
                                                mode={profileMode}
                                            />
                                        </div>
                                    ) : (
                                        <EmptyState
                                            type="noResults"
                                            title="Search for a player"
                                            description="Enter a player name above and click Analyze to see their complete IPL profile."
                                        />
                                    )
                                )}

                                {/* Ask PitchIQ */}
                                <AskPitchIQ
                                    setPlayerName={setPlayerName}
                                    setFilters={setFilters}
                                    onAnalyze={handleAnalyze}
                                />
                            </div>
                        )}

                        {activeTab === 'compare' && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <PlayerCompare />
                            </div>
                        )}

                        {activeTab === 'h2h' && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <HeadToHead />
                            </div>
                        )}
                    </main>
                } />
                <Route path="/matches" element={<Matches />} />
                <Route path="/match/:matchId" element={<MatchDetail />} />
                <Route path="/player/:playerName" element={<PlayerProfile />} />
                <Route path="/players" element={<PlayersList />} />
                <Route path="/top-performers" element={<TopPerformersPage />} />
            </Routes>
        </div>
    );
};

export default App;