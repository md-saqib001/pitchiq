import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { User, Shield, Zap, Target, Activity, Search, AlertCircle, MapPin, Flag } from 'lucide-react';

// --- REUSABLE AUTOCOMPLETE COMPONENT ---
function AutocompleteInput({ label, value, setValue, fetchUrl, fetchParams, placeholder, icon: Icon }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const dropdownRef = useRef(null);

  // Convert the object to a string so React can accurately track if it changed
  const paramsString = JSON.stringify(fetchParams || {});

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (value.trim().length >= 1) {
        try {
          // Parse the string back into an object for Axios
          const currentParams = JSON.parse(paramsString);
          const res = await axios.get(fetchUrl, { params: { q: value, ...currentParams } });
          setSuggestions(res.data);
          setShowSuggestions(true);
        } catch (err) {
          console.error("Failed to load suggestions", err);
        }
      } else {
        setSuggestions([]);
      }
    }, 150);
    return () => clearTimeout(delayDebounceFn);
  }, [value, fetchUrl, paramsString]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0) {
        setValue(suggestions[activeIndex]);
        setShowSuggestions(false);
        setActiveIndex(-1);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div className="mb-4 relative" ref={dropdownRef}>
      <label className="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-1">{label}</label>
      <div className="relative">
        <input 
          type="text" 
          value={value} 
          onChange={(e) => {
            setValue(e.target.value);
            setShowSuggestions(true);
            setActiveIndex(-1);
          }}
          onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
          onKeyDown={handleKeyDown}
          className="w-full bg-gray-950 border border-gray-800 rounded-lg py-2 pl-3 pr-10 text-sm focus:outline-none focus:border-emerald-500 font-medium text-gray-100"
          placeholder={placeholder}
        />
        {Icon && <Icon className="absolute right-3 top-2.5 h-4 w-4 text-gray-500" />}
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full bg-gray-950 border border-gray-800 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-2xl divide-y divide-gray-900">
          {suggestions.map((name, index) => (
            <li 
              key={index}
              onClick={() => {
                setValue(name);
                setShowSuggestions(false);
                setActiveIndex(-1);
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={`px-4 py-2 text-sm cursor-pointer transition-colors font-medium ${
                index === activeIndex ? 'bg-emerald-500 text-gray-950' : 'text-gray-300 hover:bg-emerald-500 hover:text-gray-950'
              }`}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- MAIN APPLICATION DASHBOARD ---
export default function App() {
  const [role, setRole] = useState('batter'); 
  const [playerName, setPlayerName] = useState('V Kohli');
  const [phase, setPhase] = useState('all');
  const [context, setContext] = useState('all');
  
  // New Advanced Filters
  const [opposition, setOpposition] = useState('');
  const [venue, setVenue] = useState('');
  const [targetScore, setTargetScore] = useState('');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [queryTime, setQueryTime] = useState(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    const startTime = performance.now();

    try {
      const endpoint = role === 'batter' 
        ? 'http://localhost:5000/api/analytics/player' 
        : 'http://localhost:5000/api/analytics/bowler';

      const params = { 
        [role === 'batter' ? 'player' : 'bowler']: playerName, 
        phase, 
        context,
        opposition: opposition.trim() || undefined,
        venue: venue.trim() || undefined,
        targetScore: targetScore || undefined
      };

      const response = await axios.get(endpoint, { params });
      
      setQueryTime((performance.now() - startTime).toFixed(2));
      setData(response.data.metrics);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to communicate with PitchIQ Engine");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPlayerName(role === 'batter' ? 'V Kohli' : 'JJ Bumrah');
    setData(null);
  }, [role]);

  // Prevent user from selecting a target score if they aren't chasing
  useEffect(() => {
    if (context !== 'chasing') setTargetScore('');
  }, [context]);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 p-6 font-sans">
      <header className="max-w-7xl mx-auto mb-8 flex justify-between items-center border-b border-gray-800 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-emerald-400 flex items-center gap-2">
            <Activity className="h-8 w-8 animate-pulse text-emerald-400" />
            PitchIQ <span className="text-sm font-mono text-gray-500 px-2 py-0.5 bg-gray-900 rounded border border-gray-800">v2.0</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">Advanced Deterministic Match Intelligence Engine</p>
        </div>
        {queryTime && (
          <div className="text-right font-mono text-xs text-gray-400 bg-gray-900 border border-gray-800 p-2 rounded">
            Frontend Trip: <span className="text-emerald-400 font-bold">{queryTime}ms</span>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Control Panel */}
        <section className="lg:col-span-1 bg-[#131B2E] border border-gray-800 rounded-xl p-5 shadow-xl h-fit">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-300">
            <Target className="h-5 w-5 text-emerald-400" /> Query Filters
          </h2>

          <div className="mb-5">
            <label className="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-2">Analysis Role</label>
            <div className="grid grid-cols-2 gap-2 bg-gray-950 p-1 rounded-lg border border-gray-800">
              <button 
                onClick={() => setRole('batter')}
                className={`py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${role === 'batter' ? 'bg-emerald-500 text-gray-950 shadow' : 'text-gray-400 hover:text-white'}`}
              >
                <Zap className="h-4 w-4" /> Batter
              </button>
              <button 
                onClick={() => setRole('bowler')}
                className={`py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${role === 'bowler' ? 'bg-emerald-500 text-gray-950 shadow' : 'text-gray-400 hover:text-white'}`}
              >
                <Shield className="h-4 w-4" /> Bowler
              </button>
            </div>
          </div>

          <AutocompleteInput 
            label="Player Identifier" 
            value={playerName} 
            setValue={setPlayerName} 
            fetchUrl="http://localhost:5000/api/players/search" 
            fetchParams={{ role }} 
            placeholder="Search player (e.g. Kohli)..." 
            icon={Search} 
          />

          <AutocompleteInput 
            label="Opposition Team (Optional)" 
            value={opposition} 
            setValue={setOpposition} 
            fetchUrl="http://localhost:5000/api/teams/search" 
            fetchParams={{}} 
            placeholder="Search team (e.g. Chennai)..." 
            icon={Flag} 
          />

          <AutocompleteInput 
            label="Venue (Optional)" 
            value={venue} 
            setValue={setVenue} 
            fetchUrl="http://localhost:5000/api/venues/search" 
            fetchParams={{}} 
            placeholder="Search stadium..." 
            icon={MapPin} 
          />

          <div className="mb-4">
            <label className="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-1">Match Phase</label>
            <select value={phase} onChange={(e) => setPhase(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500">
              <option value="all">Full Match (Overs 1-20)</option>
              <option value="powerplay">Powerplay (Overs 1-6)</option>
              <option value="middle">Middle Overs (Overs 7-15)</option>
              <option value="death">Death Phase (Overs 16-20)</option>
            </select>
          </div>

          {role === 'batter' && (
            <>
              <div className="mb-4">
                <label className="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-1">Innings Context</label>
                <select value={context} onChange={(e) => setContext(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500">
                  <option value="all">All Situations</option>
                  <option value="defending">1st Innings (Defending)</option>
                  <option value="chasing">2nd Innings (Chasing Target)</option>
                </select>
              </div>

              {context === 'chasing' && (
                <div className="mb-5">
                  <label className="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-1 text-emerald-400">Target Score Pressure</label>
                  <select value={targetScore} onChange={(e) => setTargetScore(e.target.value)} className="w-full bg-gray-950 border border-emerald-900 rounded-lg p-2 text-sm focus:outline-none focus:border-emerald-500">
                    <option value="">Any Target</option>
                    <option value="150">Chasing 150+</option>
                    <option value="180">Chasing 180+</option>
                    <option value="200">Chasing 200+</option>
                  </select>
                </div>
              )}
            </>
          )}

          <button onClick={fetchAnalytics} disabled={loading} className="w-full py-2.5 bg-gray-100 text-gray-950 hover:bg-emerald-400 font-bold rounded-lg text-sm tracking-wide shadow-lg transition-all disabled:opacity-50 mt-2">
            {loading ? 'Executing Aggregation...' : 'Execute Query'}
          </button>
        </section>

        {/* Right Dashboard Results View */}
        <section className="lg:col-span-3 flex flex-col justify-between">
          {error && (
            <div className="bg-red-950/40 border border-red-900 rounded-xl p-4 flex items-start gap-3 mb-6">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-red-400">Query Runtime Error</h3>
                <p className="text-xs text-red-300 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex-1 min-h-[300px] bg-[#131B2E] border border-gray-800 rounded-xl flex flex-col justify-center items-center gap-3">
              <div className="h-8 w-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-mono text-gray-400">Scanning relational blocks...</p>
            </div>
          ) : data ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full">
              {role === 'batter' ? (
                <>
                  <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-5">
                    <p className="text-xs font-mono text-gray-400 uppercase tracking-wider">Runs Scored</p>
                    <p className="text-3xl font-black text-white mt-2 font-mono">{data.runs}</p>
                  </div>
                  <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-5">
                    <p className="text-xs font-mono text-gray-400 uppercase tracking-wider">Balls Faced</p>
                    <p className="text-3xl font-black text-white mt-2 font-mono">{data.balls_faced}</p>
                  </div>
                  <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-5">
                    <p className="text-xs font-mono text-gray-400 uppercase tracking-wider">Strike Rate</p>
                    <p className="text-3xl font-black text-emerald-400 mt-2 font-mono">{data.strike_rate}</p>
                  </div>
                  <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-5">
                    <p className="text-xs font-mono text-gray-400 uppercase tracking-wider">Batting Average</p>
                    <p className="text-3xl font-black text-white mt-2 font-mono">{data.average}</p>
                  </div>
                  <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-5">
                    <p className="text-xs font-mono text-gray-400 uppercase tracking-wider">Boundaries (4s / 6s)</p>
                    <p className="text-3xl font-black text-white mt-2 font-mono">{data.fours} <span className="text-gray-500 text-lg">/</span> {data.sixes}</p>
                  </div>
                  <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-5">
                    <p className="text-xs font-mono text-gray-400 uppercase tracking-wider">Times Dismissed</p>
                    <p className="text-3xl font-black text-red-400 mt-2 font-mono">{data.dismissals}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-5">
                    <p className="text-xs font-mono text-gray-400 uppercase tracking-wider">Wickets Taken</p>
                    <p className="text-3xl font-black text-emerald-400 mt-2 font-mono">{data.wickets}</p>
                  </div>
                  <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-5">
                    <p className="text-xs font-mono text-gray-400 uppercase tracking-wider">Overs Bowled</p>
                    <p className="text-3xl font-black text-white mt-2 font-mono">{data.overs_bowled}</p>
                  </div>
                  <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-5">
                    <p className="text-xs font-mono text-gray-400 uppercase tracking-wider">Runs Conceded</p>
                    <p className="text-3xl font-black text-white mt-2 font-mono">{data.runs_conceded}</p>
                  </div>
                  <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-5">
                    <p className="text-xs font-mono text-gray-400 uppercase tracking-wider">Economy Rate</p>
                    <p className="text-3xl font-black text-white mt-2 font-mono">{data.economy_rate}</p>
                  </div>
                  <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-5">
                    <p className="text-xs font-mono text-gray-400 uppercase tracking-wider">Bowling Strike Rate</p>
                    <p className="text-3xl font-black text-white mt-2 font-mono">{data.bowling_strike_rate}</p>
                  </div>
                  <div className="bg-[#131B2E] border border-gray-800 rounded-xl p-5">
                    <p className="text-xs font-mono text-gray-400 uppercase tracking-wider">Dot Balls Delivered</p>
                    <p className="text-3xl font-black text-white mt-2 font-mono">{data.dot_balls}</p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 min-h-[300px] bg-[#131B2E] border border-gray-800 rounded-xl flex flex-col justify-center items-center text-center p-6">
              <User className="h-12 w-12 text-gray-600 mb-2" />
              <p className="text-sm font-semibold text-gray-400">No Query Executed</p>
              <p className="text-xs text-gray-500 max-w-xs mt-1">Configure your target filters on the left panel and click execute to query the database.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}