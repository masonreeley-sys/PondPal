import React, { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "./supabase";

const LAKE_CHARLESTON = { lat: 39.4666, lng: -88.1458 };
const MILES_TO_METERS = 1609.34;

export default function App() {
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [authError, setAuthError] = useState("");
  const [tab, setTab] = useState("dashboard");
  const [darkMode, setDarkMode] = useState(() =>
    JSON.parse(localStorage.getItem("pondpal-dark") || "false")
  );
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const [ponds, setPonds] = useState([]);
  const [selectedPondId, setSelectedPondId] = useState("");
  const [newPond, setNewPond] = useState({ name: "", location: "" });

  const [catches, setCatches] = useState([]);
  const [newCatch, setNewCatch] = useState({
    species: "",
    length: "",
    weight: "",
    location: "",
    caught_at: new Date().toISOString().slice(0, 10),
    photoFile: null,
  });

  const [notes, setNotes] = useState([]);
  const [note, setNote] = useState("");
  const [pondSize, setPondSize] = useState(0.25);
  const [goal, setGoal] = useState("balanced");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [aiHistory, setAiHistory] = useState([]);

  const [mapRadius, setMapRadius] = useState(50);
  const [nearbyWaters, setNearbyWaters] = useState([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState("");

  const theme = darkMode ? dark : light;
  const user = session?.user;
  const selectedPond = ponds.find((p) => p.id === selectedPondId);
  const pondCatches = catches.filter((fish) => fish.pond_id === selectedPondId);
  const pondNotes = notes.filter((item) => item.pond_id === selectedPondId);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => setSession(newSession)
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem("pondpal-dark", JSON.stringify(darkMode));
  }, [darkMode]);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  useEffect(() => {
    if (tab === "map") fetchNearbyWaters();
  }, [tab, mapRadius]);

  async function loadData() {
    const { data: pondData } = await supabase
      .from("ponds")
      .select("*")
      .order("created_at", { ascending: true });

    let loadedPonds = pondData || [];

    if (loadedPonds.length === 0) {
      const { data: created } = await supabase
        .from("ponds")
        .insert({
          user_id: user.id,
          name: "Main Pond",
          location: "Home",
        })
        .select()
        .single();

      loadedPonds = created ? [created] : [];
    }

    setPonds(loadedPonds);
    setSelectedPondId(loadedPonds[0]?.id || "");

    const { data: catchData } = await supabase
      .from("catches")
      .select("*")
      .order("created_at", { ascending: false });

    setCatches(catchData || []);

    const { data: noteData } = await supabase
      .from("notes")
      .select("*")
      .order("created_at", { ascending: false });

    setNotes(noteData || []);
  }

  async function fetchNearbyWaters() {
    setMapLoading(true);
    setMapError("");

    try {
      const radiusMeters = Math.round(mapRadius * MILES_TO_METERS);

      const query = `
        [out:json][timeout:60];
        (
          node["natural"="water"]["water"~"lake|pond|reservoir"](around:${radiusMeters},${LAKE_CHARLESTON.lat},${LAKE_CHARLESTON.lng});
          way["natural"="water"]["water"~"lake|pond|reservoir"](around:${radiusMeters},${LAKE_CHARLESTON.lat},${LAKE_CHARLESTON.lng});
          relation["natural"="water"]["water"~"lake|pond|reservoir"](around:${radiusMeters},${LAKE_CHARLESTON.lat},${LAKE_CHARLESTON.lng});
        );
        out center tags;
      `;

      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: query,
      });

      if (!response.ok) {
        throw new Error("Map search failed. Try a smaller radius.");
      }

      const data = await response.json();

      const waters = data.elements
        .filter((item) => item.tags?.name)
        .map((item) => ({
          id: `${item.type}-${item.id}`,
          name: item.tags.name,
          type: item.tags.water || "water",
          lat: item.lat || item.center?.lat,
          lng: item.lon || item.center?.lon,
        }))
        .filter((item) => item.lat && item.lng);

      const unique = Array.from(
        new Map(waters.map((w) => [w.name + w.lat + w.lng, w])).values()
      );

      setNearbyWaters(unique);
    } catch (err) {
      setMapError(err.message);
      setNearbyWaters([]);
    } finally {
      setMapLoading(false);
    }
  }

  async function handleAuth(e) {
    e.preventDefault();
    setAuthError("");

    if (!authForm.email.trim() || !authForm.password.trim()) {
      setAuthError("Enter an email and password.");
      return;
    }

    if (authMode === "create") {
      const { error } = await supabase.auth.signUp({
        email: authForm.email,
        password: authForm.password,
      });

      if (error) {
        setAuthError(error.message);
        return;
      }

      alert(
        "Account created. Check your email if Supabase asks you to confirm it, then log in."
      );
      setAuthMode("login");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: authForm.email,
      password: authForm.password,
    });

    if (error) setAuthError(error.message);
  }

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
    setPonds([]);
    setCatches([]);
    setNotes([]);
    setAiHistory([]);
  }

  async function addPond(e) {
    e.preventDefault();
    if (!newPond.name.trim()) return;

    const { data, error } = await supabase
      .from("ponds")
      .insert({
        user_id: user.id,
        name: newPond.name,
        location: newPond.location || "No location added",
      })
      .select()
      .single();

    if (!error && data) {
      setPonds([...ponds, data]);
      setSelectedPondId(data.id);
      setNewPond({ name: "", location: "" });
    }

    if (error) alert(error.message);
  }

  async function deletePond(id) {
    const confirmed = confirm(
      "Delete this pond? This will also remove its catches and notes."
    );
    if (!confirmed) return;

    await supabase.from("ponds").delete().eq("id", id);

    const updatedPonds = ponds.filter((pond) => pond.id !== id);

    setPonds(updatedPonds);
    setCatches(catches.filter((fish) => fish.pond_id !== id));
    setNotes(notes.filter((item) => item.pond_id !== id));

    if (selectedPondId === id) {
      setSelectedPondId(updatedPonds[0]?.id || "");
    }
  }

  async function addWaterAsPond(water) {
    const { data, error } = await supabase
      .from("ponds")
      .insert({
        user_id: user.id,
        name: water.name,
        location: `${water.type} near Lake Charleston`,
      })
      .select()
      .single();

    if (!error && data) {
      setPonds([...ponds, data]);
      setSelectedPondId(data.id);
      setTab("dashboard");
    }

    if (error) alert(error.message);
  }

  async function uploadCatchPhoto(file) {
    if (!file || !user) return "";

    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;

    const { error } = await supabase.storage
      .from("catch-photos")
      .upload(fileName, file);

    if (error) {
      alert(error.message);
      return "";
    }

    const { data } = supabase.storage
      .from("catch-photos")
      .getPublicUrl(fileName);

    return data.publicUrl;
  }

  async function addCatch(e) {
    e.preventDefault();

    if (!newCatch.species.trim() || !selectedPondId) return;

    let photoUrl = "";

    if (newCatch.photoFile) {
      photoUrl = await uploadCatchPhoto(newCatch.photoFile);
    }

    const { data, error } = await supabase
      .from("catches")
      .insert({
        user_id: user.id,
        pond_id: selectedPondId,
        species: newCatch.species,
        length: newCatch.length || null,
        weight: newCatch.weight || null,
        location: newCatch.location,
        caught_at: newCatch.caught_at,
        photo_url: photoUrl || null,
      })
      .select()
      .single();

    if (!error && data) {
      setCatches([data, ...catches]);
      setNewCatch({
        species: "",
        length: "",
        weight: "",
        location: "",
        caught_at: new Date().toISOString().slice(0, 10),
        photoFile: null,
      });
    }

    if (error) alert(error.message);
  }

  async function deleteCatch(id) {
    await supabase.from("catches").delete().eq("id", id);
    setCatches(catches.filter((fish) => fish.id !== id));
  }

  async function addNote(e) {
    e.preventDefault();
    if (!note.trim() || !selectedPondId) return;

    const { data, error } = await supabase
      .from("notes")
      .insert({
        user_id: user.id,
        pond_id: selectedPondId,
        note,
      })
      .select()
      .single();

    if (!error && data) {
      setNotes([data, ...notes]);
      setNote("");
    }

    if (error) alert(error.message);
  }

  async function deleteNote(id) {
    await supabase.from("notes").delete().eq("id", id);
    setNotes(notes.filter((item) => item.id !== id));
  }

  const plan = useMemo(() => {
    const acres = Number(pondSize) || 0;
    const fatheads = Math.max(1, Math.round(acres * 8));
    const bluegill = Math.round(acres * 500);
    const bass = Math.round(acres * 75);
    const catfish = Math.round(acres * 75);

    if (goal === "minnows") {
      return [
        `${fatheads} lb fathead minnows`,
        "Add PVC, brush piles, rock, or pallets",
        "Wait before adding predator fish",
      ];
    }

    if (goal === "bass") {
      return [
        `${bluegill} bluegill/redear mix`,
        `${fatheads} lb fathead minnows`,
        `${bass} largemouth bass once forage is ready`,
      ];
    }

    return [
      `${bluegill} bluegill/redear mix`,
      `${fatheads} lb fathead minnows`,
      `${bass} largemouth bass`,
      `${catfish} channel catfish if wanted`,
    ];
  }, [pondSize, goal]);

  const personalRecords = useMemo(() => {
    const records = {};

    pondCatches.forEach((fish) => {
      const species = fish.species || "Unknown";
      const score =
        (Number(fish.weight) || 0) * 100 + (Number(fish.length) || 0);

      const old = records[species];
      const oldScore = old
        ? (Number(old.weight) || 0) * 100 + (Number(old.length) || 0)
        : -1;

      if (!old || score > oldScore) {
        records[species] = fish;
      }
    });

    return Object.values(records);
  }, [pondCatches]);

  const leaderboard = useMemo(() => {
    return [...pondCatches].sort((a, b) => {
      const scoreA =
        (Number(a.weight) || 0) * 100 + (Number(a.length) || 0);
      const scoreB =
        (Number(b.weight) || 0) * 100 + (Number(b.length) || 0);

      return scoreB - scoreA;
    });
  }, [pondCatches]);

  function askPondPal() {
    if (!question.trim()) return;

    const response = `For ${
      selectedPond?.name || "this pond"
    }, start with oxygen, water clarity, cover, and forage fish before adding bigger predator fish.`;

    const newMessage = {
      id: crypto.randomUUID(),
      question,
      answer: response,
      date: new Date().toLocaleString(),
    };

    setAiHistory([newMessage, ...aiHistory]);
    setAnswer(response);
    setQuestion("");
  }

  if (!session) {
    return (
      <div style={{ ...styles.authPage, background: light.page }}>
        <div style={styles.authCard}>
          <h1 style={styles.authLogo}>🐟 PondPal</h1>
          <h2>{authMode === "login" ? "Log in" : "Create account"}</h2>
          <p style={{ color: "#64748b", fontWeight: 700 }}>
            Real login powered by Supabase.
          </p>

          <form onSubmit={handleAuth} style={styles.authForm}>
            {authMode === "create" && (
              <input
                style={styles.input}
                placeholder="Name"
                value={authForm.name}
                onChange={(e) =>
                  setAuthForm({ ...authForm, name: e.target.value })
                }
              />
            )}

            <input
              style={styles.input}
              placeholder="Email"
              value={authForm.email}
              onChange={(e) =>
                setAuthForm({ ...authForm, email: e.target.value })
              }
            />

            <input
              style={styles.input}
              placeholder="Password"
              type="password"
              value={authForm.password}
              onChange={(e) =>
                setAuthForm({ ...authForm, password: e.target.value })
              }
            />

            {authError && <p style={styles.error}>{authError}</p>}

            <button style={styles.primaryButton}>
              {authMode === "login" ? "Log In" : "Create Account"}
            </button>
          </form>

          <button
            style={styles.linkButton}
            onClick={() =>
              setAuthMode(authMode === "login" ? "create" : "login")
            }
          >
            {authMode === "login"
              ? "Need an account? Create one"
              : "Already have an account? Log in"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        ...styles.app,
        flexDirection: isMobile ? "column" : "row",
        background: theme.page,
        color: theme.text,
      }}
    >
      <aside
        style={{
          ...styles.sidebar,
          width: isMobile ? "100%" : "285px",
          height: isMobile ? "auto" : "100vh",
          position: isMobile ? "relative" : "sticky",
          borderRight: isMobile ? "none" : "1px solid",
          borderBottom: isMobile ? `1px solid ${theme.border}` : "none",
          background: theme.sidebar,
          borderColor: theme.border,
        }}
      >
        <div>
          <h1 style={styles.logo}>🐟 PondPal</h1>
          <p style={{ ...styles.sidebarSub, color: theme.muted }}>
            {user.email}
          </p>

          <select
            style={{
              ...styles.pondSelect,
              background: theme.input,
              color: theme.text,
              borderColor: theme.border,
            }}
            value={selectedPondId}
            onChange={(e) => setSelectedPondId(e.target.value)}
          >
            {ponds.map((pond) => (
              <option key={pond.id} value={pond.id}>
                {pond.name}
              </option>
            ))}
          </select>

          {isMobile ? (
            <select
              value={tab}
              onChange={(e) => setTab(e.target.value)}
              style={{
                ...styles.pondSelect,
                background: theme.input,
                color: theme.text,
                borderColor: theme.border,
                marginTop: "18px",
              }}
            >
              <option value="dashboard">📊 Dashboard</option>
              <option value="planner">🐟 Stocking Planner</option>
              <option value="checklist">✅ Checklist</option>
              <option value="catchlog">🎣 Catch Log</option>
              <option value="records">🏆 Records</option>
              <option value="leaderboard">🥇 Leaderboard</option>
              <option value="map">🗺️ World Map</option>
              <option value="ponds">🌊 Ponds</option>
              <option value="notes">📝 Pond Notes</option>
              <option value="ask">💬 Ask PondPal</option>
            </select>
          ) : (
            <nav style={styles.sideNav}>
              <SideButton
                label="Dashboard"
                icon="📊"
                active={tab === "dashboard"}
                onClick={() => setTab("dashboard")}
                theme={theme}
              />
              <SideButton
                label="Stocking Planner"
                icon="🐟"
                active={tab === "planner"}
                onClick={() => setTab("planner")}
                theme={theme}
              />
              <SideButton
                label="Checklist"
                icon="✅"
                active={tab === "checklist"}
                onClick={() => setTab("checklist")}
                theme={theme}
              />
              <SideButton
                label="Catch Log"
                icon="🎣"
                active={tab === "catchlog"}
                onClick={() => setTab("catchlog")}
                theme={theme}
              />
              <SideButton
                label="Records"
                icon="🏆"
                active={tab === "records"}
                onClick={() => setTab("records")}
                theme={theme}
              />
              <SideButton
                label="Leaderboard"
                icon="🥇"
                active={tab === "leaderboard"}
                onClick={() => setTab("leaderboard")}
                theme={theme}
              />
              <SideButton
                label="World Map"
                icon="🗺️"
                active={tab === "map"}
                onClick={() => setTab("map")}
                theme={theme}
              />
              <SideButton
                label="Ponds"
                icon="🌊"
                active={tab === "ponds"}
                onClick={() => setTab("ponds")}
                theme={theme}
              />
              <SideButton
                label="Pond Notes"
                icon="📝"
                active={tab === "notes"}
                onClick={() => setTab("notes")}
                theme={theme}
              />
              <SideButton
                label="Ask PondPal"
                icon="💬"
                active={tab === "ask"}
                onClick={() => setTab("ask")}
                theme={theme}
              />
            </nav>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gap: "10px",
            marginTop: isMobile ? "14px" : 0,
          }}
        >
          <button
            style={{
              ...styles.modeButton,
              background: theme.card,
              color: theme.text,
              borderColor: theme.border,
            }}
            onClick={() => setDarkMode(!darkMode)}
          >
            {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
          </button>

          <button style={styles.logoutButton} onClick={logout}>
            Log Out
          </button>
        </div>
      </aside>

      <main style={{ ...styles.main, padding: isMobile ? "16px" : "28px" }}>
        <header style={styles.topbar}>
          <div>
            <h2 style={styles.pageTitle}>{getTitle(tab)}</h2>
            <p style={{ ...styles.subtitle, color: theme.muted }}>
              {selectedPond?.name || "No pond"} •{" "}
              {selectedPond?.location || "Add a pond"}
            </p>
          </div>
        </header>

        {tab === "dashboard" && (
          <>
            <section style={styles.hero}>
              <div>
                <h2 style={styles.heroTitle}>
                  {selectedPond?.name || "Your Pond"} is ready.
                </h2>
                <p style={styles.heroText}>
                  Track catches, upload fish photos, compare records, and find
                  lakes near Lake Charleston.
                </p>
              </div>

              <div style={styles.scoreCard}>
                <p style={styles.scoreLabel}>Pond Health Score</p>
                <h3 style={styles.score}>78</h3>
                <div style={styles.progressBack}>
                  <div style={styles.progressFill}></div>
                </div>
              </div>
            </section>

            <section style={styles.grid}>
              <Card
                title="Logged Catches"
                value={String(pondCatches.length)}
                emoji="🎣"
                theme={theme}
              />
              <Card
                title="Personal Records"
                value={String(personalRecords.length)}
                emoji="🏆"
                theme={theme}
              />
              <Card
                title="Map Waters"
                value={String(nearbyWaters.length)}
                emoji="🗺️"
                theme={theme}
              />
              <Card
                title="AI Questions"
                value={String(aiHistory.length)}
                emoji="💬"
                theme={theme}
              />
            </section>
          </>
        )}

        {tab === "planner" && (
          <Panel theme={theme}>
            <h2>Stocking Planner</h2>

            <label style={styles.label}>Pond size in acres</label>
            <input
              style={{
                ...styles.input,
                background: theme.input,
                color: theme.text,
                borderColor: theme.border,
              }}
              type="number"
              step="0.05"
              value={pondSize}
              onChange={(e) => setPondSize(e.target.value)}
            />

            <label style={styles.label}>Main goal</label>
            <select
              style={{
                ...styles.input,
                background: theme.input,
                color: theme.text,
                borderColor: theme.border,
              }}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            >
              <option value="balanced">Balanced fishing pond</option>
              <option value="minnows">Build minnows first</option>
              <option value="bass">Bass fishing</option>
            </select>

            <div style={{ ...styles.resultBox, background: theme.soft }}>
              <h3>Recommended Starter Plan</h3>
              {plan.map((item) => (
                <p key={item} style={styles.check}>
                  ✅ {item}
                </p>
              ))}
            </div>
          </Panel>
        )}

        {tab === "checklist" && (
          <Panel theme={theme}>
            <h2>Pond Startup Checklist</h2>
            {[
              "Check water clarity",
              "Add aeration if oxygen is low",
              "Add shallow cover for minnows and bluegill",
              "Stock forage fish first",
              "Wait before adding bass",
              "Track fish sizes after stocking",
            ].map((item) => (
              <p key={item} style={styles.check}>
                ✅ {item}
              </p>
            ))}
          </Panel>
        )}

        {tab === "catchlog" && (
          <Panel theme={theme}>
            <h2>Fish Catch Log</h2>

            <form onSubmit={addCatch} style={styles.catchForm}>
              <input
                placeholder="Species"
                value={newCatch.species}
                onChange={(e) =>
                  setNewCatch({ ...newCatch, species: e.target.value })
                }
                style={{
                  ...styles.input,
                  background: theme.input,
                  color: theme.text,
                  borderColor: theme.border,
                }}
              />
              <input
                placeholder="Length inches"
                value={newCatch.length}
                onChange={(e) =>
                  setNewCatch({ ...newCatch, length: e.target.value })
                }
                style={{
                  ...styles.input,
                  background: theme.input,
                  color: theme.text,
                  borderColor: theme.border,
                }}
              />
              <input
                placeholder="Weight lbs"
                value={newCatch.weight}
                onChange={(e) =>
                  setNewCatch({ ...newCatch, weight: e.target.value })
                }
                style={{
                  ...styles.input,
                  background: theme.input,
                  color: theme.text,
                  borderColor: theme.border,
                }}
              />
              <input
                placeholder="Location"
                value={newCatch.location}
                onChange={(e) =>
                  setNewCatch({ ...newCatch, location: e.target.value })
                }
                style={{
                  ...styles.input,
                  background: theme.input,
                  color: theme.text,
                  borderColor: theme.border,
                }}
              />
              <input
                type="date"
                value={newCatch.caught_at}
                onChange={(e) =>
                  setNewCatch({ ...newCatch, caught_at: e.target.value })
                }
                style={{
                  ...styles.input,
                  background: theme.input,
                  color: theme.text,
                  borderColor: theme.border,
                }}
              />
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setNewCatch({
                    ...newCatch,
                    photoFile: e.target.files[0],
                  })
                }
                style={{
                  ...styles.input,
                  background: theme.input,
                  color: theme.text,
                  borderColor: theme.border,
                }}
              />
              <button style={styles.primaryButton}>Add Catch</button>
            </form>

            <RecordTable
              rows={pondCatches}
              theme={theme}
              deleteCatch={deleteCatch}
              showAction
            />
          </Panel>
        )}

        {tab === "records" && (
          <Panel theme={theme}>
            <h2>Personal Records</h2>
            <RecordTable rows={personalRecords} theme={theme} />
          </Panel>
        )}

        {tab === "leaderboard" && (
          <Panel theme={theme}>
            <h2>{selectedPond?.name || "Pond"} Leaderboard</h2>
            <LeaderboardTable rows={leaderboard} theme={theme} />
          </Panel>
        )}

        {tab === "map" && (
          <Panel theme={theme}>
            <h2>Waters Within {mapRadius} Miles of Lake Charleston</h2>

            <div style={styles.mapControls}>
              <select
                style={{
                  ...styles.input,
                  background: theme.input,
                  color: theme.text,
                  borderColor: theme.border,
                }}
                value={mapRadius}
                onChange={(e) => setMapRadius(Number(e.target.value))}
              >
                <option value={25}>25 miles</option>
                <option value={50}>50 miles</option>
                <option value={100}>100 miles</option>
                <option value={200}>200 miles</option>
              </select>

              <button style={styles.primaryButton} onClick={fetchNearbyWaters}>
                Refresh Map
              </button>
            </div>

            {mapLoading && (
              <p style={{ color: theme.muted, fontWeight: 900 }}>
                Loading lakes and ponds...
              </p>
            )}

            {mapError && <p style={styles.error}>{mapError}</p>}

            <div style={styles.realMapBox}>
              <MapContainer
                center={[LAKE_CHARLESTON.lat, LAKE_CHARLESTON.lng]}
                zoom={8}
                style={{ height: "100%", width: "100%" }}
              >
                <MapUpdater center={LAKE_CHARLESTON} radius={mapRadius} />

                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <CircleMarker
                  center={[LAKE_CHARLESTON.lat, LAKE_CHARLESTON.lng]}
                  radius={12}
                  pathOptions={{
                    color: "#ef4444",
                    fillColor: "#ef4444",
                    fillOpacity: 0.9,
                  }}
                >
                  <Popup>
                    <strong>Lake Charleston Area</strong>
                  </Popup>
                </CircleMarker>

                {nearbyWaters.map((water) => (
                  <CircleMarker
                    key={water.id}
                    center={[water.lat, water.lng]}
                    radius={8}
                    pathOptions={{
                      color: "#0f766e",
                      fillColor: "#22c55e",
                      fillOpacity: 0.8,
                    }}
                  >
                    <Popup>
                      <strong>{water.name}</strong>
                      <br />
                      {water.type}
                      <br />
                      <button onClick={() => addWaterAsPond(water)}>
                        Add to My Ponds
                      </button>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>

            <p style={{ color: theme.muted, fontWeight: 800, marginTop: 14 }}>
              Found {nearbyWaters.length} named lakes, ponds, or reservoirs.
              Use smaller radius if 200 miles loads slowly.
            </p>
          </Panel>
        )}

        {tab === "ponds" && (
          <Panel theme={theme}>
            <h2>Manage Ponds</h2>

            <form onSubmit={addPond} style={styles.catchForm}>
              <input
                placeholder="Pond name"
                value={newPond.name}
                onChange={(e) =>
                  setNewPond({ ...newPond, name: e.target.value })
                }
                style={{
                  ...styles.input,
                  background: theme.input,
                  color: theme.text,
                  borderColor: theme.border,
                }}
              />
              <input
                placeholder="Location"
                value={newPond.location}
                onChange={(e) =>
                  setNewPond({ ...newPond, location: e.target.value })
                }
                style={{
                  ...styles.input,
                  background: theme.input,
                  color: theme.text,
                  borderColor: theme.border,
                }}
              />
              <button style={styles.primaryButton}>Add Pond</button>
            </form>

            <div style={styles.grid}>
              {ponds.map((pond) => (
                <div
                  key={pond.id}
                  style={{
                    ...styles.card,
                    background: theme.card,
                    borderColor: theme.border,
                  }}
                >
                  <div style={styles.cardEmoji}>🌊</div>
                  <p style={{ ...styles.cardTitle, color: theme.muted }}>
                    {pond.location}
                  </p>
                  <h3 style={styles.cardValue}>{pond.name}</h3>
                  <button
                    style={{ ...styles.deleteButton, marginTop: "16px" }}
                    onClick={() => deletePond(pond.id)}
                  >
                    Delete Pond
                  </button>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {tab === "notes" && (
          <Panel theme={theme}>
            <h2>Pond Notes</h2>

            <form onSubmit={addNote}>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Write a pond note..."
                style={{
                  ...styles.textarea,
                  background: theme.input,
                  color: theme.text,
                  borderColor: theme.border,
                }}
              />
              <button style={styles.primaryButton}>Save Note</button>
            </form>

            <div style={styles.noteList}>
              {pondNotes.map((item) => (
                <div
                  key={item.id}
                  style={{
                    ...styles.noteCard,
                    background: theme.soft,
                    borderColor: theme.border,
                  }}
                >
                  <div>
                    <strong>
                      {new Date(item.created_at).toLocaleDateString()}
                    </strong>
                    <p>{item.note}</p>
                  </div>

                  <button
                    style={styles.deleteButton}
                    onClick={() => deleteNote(item.id)}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {tab === "ask" && (
          <Panel theme={theme}>
            <h2>Ask PondPal</h2>

            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a pond question..."
              style={{
                ...styles.textarea,
                background: theme.input,
                color: theme.text,
                borderColor: theme.border,
              }}
            />

            <button style={styles.primaryButton} onClick={askPondPal}>
              Ask PondPal
            </button>

            {answer && (
              <div style={{ ...styles.answer, background: theme.soft }}>
                {answer}
              </div>
            )}

            <div style={{ marginTop: "24px" }}>
              <h3>Question History</h3>

              {aiHistory.length === 0 && (
                <p style={{ color: theme.muted, fontWeight: 800 }}>
                  No questions asked yet.
                </p>
              )}

              {aiHistory.map((item) => (
                <div
                  key={item.id}
                  style={{
                    ...styles.noteCard,
                    background: theme.soft,
                    borderColor: theme.border,
                    marginBottom: "12px",
                  }}
                >
                  <div>
                    <strong>{item.date}</strong>
                    <p>
                      <b>You:</b> {item.question}
                    </p>
                    <p>
                      <b>PondPal:</b> {item.answer}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </main>
    </div>
  );
}

function MapUpdater({ center, radius }) {
  const map = useMap();

  useEffect(() => {
    const zoom = radius <= 25 ? 9 : radius <= 50 ? 8 : radius <= 100 ? 7 : 6;

    const timer = setTimeout(() => {
      map.invalidateSize();
      map.setView([center.lat, center.lng], zoom);
    }, 300);

    return () => clearTimeout(timer);
  }, [center, radius, map]);

  return null;
}

function getTitle(tab) {
  return {
    dashboard: "Dashboard",
    planner: "Stocking Planner",
    checklist: "Pond Checklist",
    catchlog: "Fish Catch Log",
    records: "Records",
    leaderboard: "Leaderboard",
    map: "World Map",
    ponds: "Manage Ponds",
    notes: "Pond Notes",
    ask: "Ask PondPal",
  }[tab];
}

function SideButton({ label, icon, active, onClick, theme }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.sideButton,
        background: active ? "#0f766e" : "transparent",
        color: active ? "white" : theme.text,
      }}
    >
      <span>{icon}</span>
      {label}
    </button>
  );
}

function Card({ title, value, emoji, theme }) {
  return (
    <div
      style={{
        ...styles.card,
        background: theme.card,
        borderColor: theme.border,
      }}
    >
      <div style={styles.cardEmoji}>{emoji}</div>
      <p style={{ ...styles.cardTitle, color: theme.muted }}>{title}</p>
      <h3 style={styles.cardValue}>{value}</h3>
    </div>
  );
}

function Panel({ children, theme }) {
  return (
    <section
      style={{
        ...styles.panel,
        background: theme.card,
        borderColor: theme.border,
      }}
    >
      {children}
    </section>
  );
}

function RecordTable({ rows, theme, deleteCatch, showAction = false }) {
  if (!rows.length) {
    return (
      <p style={{ color: theme.muted, fontWeight: 800 }}>
        No catches logged yet.
      </p>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Photo</th>
            <th style={styles.th}>Species</th>
            <th style={styles.th}>Length</th>
            <th style={styles.th}>Weight</th>
            <th style={styles.th}>Location</th>
            <th style={styles.th}>Date</th>
            {showAction && <th style={styles.th}>Action</th>}
          </tr>
        </thead>

        <tbody>
          {rows.map((fish) => (
            <tr key={fish.id} style={{ borderTop: `1px solid ${theme.border}` }}>
              <td style={styles.td}>
                {fish.photo_url ? (
                  <img
                    src={fish.photo_url}
                    alt={fish.species}
                    style={styles.catchPhoto}
                  />
                ) : (
                  "-"
                )}
              </td>
              <td style={styles.td}>{fish.species}</td>
              <td style={styles.td}>{fish.length ? `${fish.length} in` : "-"}</td>
              <td style={styles.td}>{fish.weight ? `${fish.weight} lb` : "-"}</td>
              <td style={styles.td}>{fish.location || "-"}</td>
              <td style={styles.td}>{fish.caught_at || "-"}</td>
              {showAction && (
                <td style={styles.td}>
                  <button
                    style={styles.deleteButton}
                    onClick={() => deleteCatch(fish.id)}
                  >
                    Delete
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeaderboardTable({ rows, theme }) {
  if (!rows.length) {
    return (
      <p style={{ color: theme.muted, fontWeight: 800 }}>
        No catches logged for this pond yet.
      </p>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Rank</th>
            <th style={styles.th}>Species</th>
            <th style={styles.th}>Weight</th>
            <th style={styles.th}>Length</th>
            <th style={styles.th}>Location</th>
            <th style={styles.th}>Date</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((fish, index) => (
            <tr key={fish.id} style={{ borderTop: `1px solid ${theme.border}` }}>
              <td style={styles.td}>
                {index === 0
                  ? "🥇"
                  : index === 1
                  ? "🥈"
                  : index === 2
                  ? "🥉"
                  : `#${index + 1}`}
              </td>
              <td style={styles.td}>{fish.species}</td>
              <td style={styles.td}>{fish.weight ? `${fish.weight} lb` : "-"}</td>
              <td style={styles.td}>{fish.length ? `${fish.length} in` : "-"}</td>
              <td style={styles.td}>{fish.location || "-"}</td>
              <td style={styles.td}>{fish.caught_at || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const light = {
  page: "linear-gradient(135deg, #ecfeff, #f0fdf4)",
  sidebar: "rgba(255,255,255,.92)",
  card: "white",
  text: "#0f172a",
  muted: "#64748b",
  border: "#dbeafe",
  input: "white",
  soft: "#ecfdf5",
};

const dark = {
  page: "linear-gradient(135deg, #020617, #052e2b)",
  sidebar: "rgba(15,23,42,.94)",
  card: "#0f172a",
  text: "#f8fafc",
  muted: "#94a3b8",
  border: "#1e293b",
  input: "#111827",
  soft: "#042f2e",
};

const styles = {
  authPage: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    fontFamily: "Arial, sans-serif",
    padding: "24px",
  },
  authCard: {
    width: "100%",
    maxWidth: "430px",
    background: "white",
    borderRadius: "30px",
    padding: "34px",
    boxShadow: "0 20px 50px rgba(15,23,42,.12)",
  },
  authLogo: {
    fontSize: "38px",
    margin: 0,
  },
  authForm: {
    display: "grid",
    gap: "12px",
    marginTop: "20px",
  },
  error: {
    color: "#ef4444",
    fontWeight: 800,
  },
  linkButton: {
    border: "none",
    background: "transparent",
    color: "#0f766e",
    fontWeight: 900,
    cursor: "pointer",
    marginTop: "16px",
  },

  app: {
    minHeight: "100vh",
    display: "flex",
    fontFamily: "Arial, sans-serif",
  },
  sidebar: {
    width: "285px",
    padding: "20px",
    borderRight: "1px solid",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    position: "sticky",
    top: 0,
    height: "100vh",
    boxSizing: "border-box",
    overflowY: "auto",
  },
  logo: {
    fontSize: "30px",
    margin: 0,
  },
  sidebarSub: {
    marginTop: "6px",
    fontWeight: 700,
    fontSize: "13px",
    wordBreak: "break-word",
  },
  pondSelect: {
    width: "100%",
    marginTop: "14px",
    padding: "12px",
    borderRadius: "16px",
    border: "1px solid",
    fontWeight: 800,
  },
  sideNav: {
    display: "grid",
    gap: "10px",
    marginTop: "24px",
  },
  sideButton: {
    border: "none",
    borderRadius: "18px",
    padding: "14px 16px",
    cursor: "pointer",
    fontWeight: "800",
    fontSize: "15px",
    display: "flex",
    gap: "12px",
    alignItems: "center",
    textAlign: "left",
    whiteSpace: "nowrap",
  },
  modeButton: {
    border: "1px solid",
    borderRadius: "999px",
    padding: "14px",
    fontWeight: "900",
    cursor: "pointer",
  },
  logoutButton: {
    background: "#ef4444",
    color: "white",
    border: "none",
    borderRadius: "999px",
    padding: "14px",
    fontWeight: "900",
    cursor: "pointer",
  },

  main: {
    flex: 1,
    padding: "28px",
    maxWidth: "1240px",
    width: "100%",
    boxSizing: "border-box",
  },
  topbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
    gap: "16px",
    flexWrap: "wrap",
  },
  pageTitle: {
    margin: 0,
    fontSize: "clamp(28px, 7vw, 34px)",
  },
  subtitle: {
    marginTop: "6px",
    fontWeight: 700,
  },
  primaryButton: {
    background: "#0f766e",
    color: "white",
    border: "none",
    borderRadius: "999px",
    padding: "14px 22px",
    fontWeight: "900",
    cursor: "pointer",
  },

  hero: {
    background: "linear-gradient(135deg, #064e3b, #0891b2)",
    color: "white",
    borderRadius: "34px",
    padding: "clamp(22px, 5vw, 36px)",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "24px",
    boxShadow: "0 20px 50px rgba(15,118,110,.25)",
    marginBottom: "22px",
  },
  heroTitle: {
    fontSize: "clamp(34px, 8vw, 46px)",
    margin: "0 0 14px",
    lineHeight: 1,
  },
  heroText: {
    fontSize: "18px",
    lineHeight: 1.6,
    opacity: 0.9,
  },
  scoreCard: {
    background: "rgba(255,255,255,.15)",
    borderRadius: "28px",
    padding: "24px",
  },
  scoreLabel: {
    margin: 0,
    opacity: 0.8,
    fontWeight: 700,
  },
  score: {
    fontSize: "64px",
    margin: "10px 0",
  },
  progressBack: {
    background: "rgba(255,255,255,.25)",
    height: "12px",
    borderRadius: "999px",
    overflow: "hidden",
  },
  progressFill: {
    width: "78%",
    background: "#bef264",
    height: "100%",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "18px",
  },
  card: {
    border: "1px solid",
    borderRadius: "26px",
    padding: "26px",
    boxShadow: "0 12px 30px rgba(15,23,42,.08)",
  },
  cardEmoji: {
    fontSize: "34px",
  },
  cardTitle: {
    fontWeight: 800,
  },
  cardValue: {
    fontSize: "28px",
    margin: 0,
  },

  panel: {
    border: "1px solid",
    borderRadius: "28px",
    padding: "clamp(18px, 5vw, 30px)",
    boxShadow: "0 12px 30px rgba(15,23,42,.08)",
  },
  label: {
    display: "block",
    marginTop: "18px",
    marginBottom: "8px",
    fontWeight: "900",
  },
  input: {
    width: "100%",
    padding: "14px",
    borderRadius: "16px",
    border: "1px solid",
    fontSize: "16px",
    boxSizing: "border-box",
  },
  resultBox: {
    marginTop: "22px",
    borderRadius: "22px",
    padding: "20px",
  },
  check: {
    fontSize: "17px",
    fontWeight: "700",
  },
  textarea: {
    width: "100%",
    minHeight: "150px",
    padding: "16px",
    borderRadius: "18px",
    border: "1px solid",
    fontSize: "16px",
    marginBottom: "16px",
    boxSizing: "border-box",
  },
  answer: {
    marginTop: "20px",
    padding: "20px",
    borderRadius: "20px",
    fontWeight: "800",
    lineHeight: 1.6,
  },
  catchForm: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: "12px",
    marginBottom: "24px",
  },
  noteList: {
    display: "grid",
    gap: "12px",
    marginTop: "18px",
  },
  noteCard: {
    border: "1px solid",
    borderRadius: "20px",
    padding: "18px",
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "820px",
  },
  th: {
    textAlign: "left",
    padding: "14px",
    color: "#0f766e",
  },
  td: {
    padding: "14px",
    fontWeight: "700",
  },
  deleteButton: {
    background: "#ef4444",
    color: "white",
    border: "none",
    borderRadius: "999px",
    padding: "9px 14px",
    fontWeight: "900",
    cursor: "pointer",
  },
  catchPhoto: {
    width: "70px",
    height: "70px",
    objectFit: "cover",
    borderRadius: "14px",
  },

  mapControls: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
    marginBottom: "16px",
  },
  realMapBox: {
    height: "min(70vh, 560px)",
    minHeight: "420px",
    borderRadius: "24px",
    overflow: "hidden",
    border: "1px solid #dbeafe",
  },
};
