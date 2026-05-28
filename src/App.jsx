import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";
import { supabase } from "./supabase";

const DEFAULT_LOCATION = { lat: 39.4666, lng: -88.1458 };
const MILES_TO_METERS = 1609.34;

const SUPPLIES = {
  stocking: [
    {
      title: "Jones Lake Management Fish Stocking",
      tag: "Bass, bluegill, catfish, minnows",
      note: "Online fish stocking store with largemouth bass, bluegill, redear, channel catfish, and fathead minnows.",
      url: "https://shop.joneslakemanagement.com/collections/fish-stocking",
    },
    {
      title: "Natural Waterscapes Live Fish",
      tag: "Ship-to-door stocking fish",
      note: "Live pond fish options including bass and bluegill with hatchery-direct shipping options.",
      url: "https://shop.naturalwaterscapes.com/live-fish/",
    },
    {
      title: "Herman Brothers Fisheries",
      tag: "Midwest / Illinois hatchery",
      note: "Illinois-based hatchery focused on initial pond stocking and corrective stocking.",
      url: "https://hbfisheries.com/our-fish-farm/",
    },
    {
      title: "Scoville Fish Hatchery",
      tag: "Illinois hatchery",
      note: "Northern Illinois fish hatchery producing sport and game fish.",
      url: "https://www.scovillefishhatchery.com/",
    },
  ],

  aeration: [
    {
      title: "Small Pond Aeration Kit",
      tag: "Small backyard ponds",
      note: "Compare for small decorative or backyard ponds.",
      url: "https://russellwatergardens.com/products/pa-1000",
    },
    {
      title: "VEVOR 1 Acre Pond Aerator Kit",
      tag: "Budget farm pond",
      note: "Compare for small farm ponds up to around 1 acre.",
      url: "https://www.target.com/p/vevor-pond-aerator-550w-power-5-2cfm-for-up-to-1-acre-50-lake-pond-aeration-kit-includes-3-4-hp-compressor-100-weighted-tubing-diffuser/-/A-1002940223",
    },
    {
      title: "AirMax PS10 Pond Aeration System",
      tag: "Premium acre kit",
      note: "A more serious aeration system to compare for managed ponds.",
      url: "https://americanaeration.com/products/airmax-ps10-pond-aeration-system-with-100-3-8-weighted-airline-and-1-diffuser-115v",
    },
    {
      title: "Weighted Hose + Diffuser Kit",
      tag: "Hose and diffuser",
      note: "Useful if you already have a compressor and need diffuser parts.",
      url: "https://www.target.com/p/vevor-pond-aerator-air-diffuser-3-8-in-self-sinking-aeration-hose-kit-8in-silicone-lake-aeration-diffuser-with-100ft-pond-aerator-hose-kit-blue/-/A-1010732992",
    },
  ],

  water: [
    {
      title: "Pond Water Test Kit",
      tag: "pH / ammonia / nitrite",
      note: "Use for checking pond water before stocking or when fish seem stressed.",
      url: "https://www.amazon.com/s?k=pond+water+test+kit",
    },
    {
      title: "Beneficial Pond Bacteria",
      tag: "Muck / organic waste",
      note: "Can help support organic waste management when used correctly.",
      url: "https://www.amazon.com/s?k=beneficial+pond+bacteria",
    },
    {
      title: "Pond Algae Control",
      tag: "Algae tools",
      note: "Compare algae-control options carefully before treating a stocked pond.",
      url: "https://www.amazon.com/s?k=pond+algae+control",
    },
    {
      title: "Pond Muck Remover",
      tag: "Bottom muck",
      note: "Compare options for reducing organic sludge and muck buildup.",
      url: "https://www.amazon.com/s?k=pond+muck+remover",
    },
  ],

  habitat: [
    {
      title: "Artificial Fish Habitat",
      tag: "Fish structure",
      note: "Adds cover for forage fish and ambush areas for predator fish.",
      url: "https://www.amazon.com/s?k=pond+fish+habitat+structure",
    },
    {
      title: "Fish Attractor / Pond Structure",
      tag: "Cover",
      note: "Compare fish attractors for bass, bluegill, and baitfish cover.",
      url: "https://www.amazon.com/s?k=fish+attractor+pond+structure",
    },
    {
      title: "Pond Gravel",
      tag: "Spawning areas",
      note: "Useful for creating spawning beds and shoreline improvement areas.",
      url: "https://www.amazon.com/s?k=pond+gravel",
    },
    {
      title: "River Rock for Pond",
      tag: "Rock habitat",
      note: "Can help with shoreline structure and spawning areas.",
      url: "https://www.amazon.com/s?k=river+rock+for+pond",
    },
  ],

  feeding: [
    {
      title: "Automatic Pond Fish Feeder",
      tag: "Feeding program",
      note: "Helpful for bluegill, catfish, and managed feeding programs.",
      url: "https://www.amazon.com/s?k=pond+fish+feeder",
    },
    {
      title: "Floating Fish Food",
      tag: "General feed",
      note: "Compare floating fish feeds for pond fish.",
      url: "https://www.amazon.com/s?k=floating+fish+food+pond",
    },
    {
      title: "Bluegill Fish Food",
      tag: "Bluegill feed",
      note: "Useful if growing bluegill is one of your pond goals.",
      url: "https://www.amazon.com/s?k=bluegill+fish+food",
    },
    {
      title: "Catfish Fish Food",
      tag: "Catfish feed",
      note: "Useful for catfish-focused ponds.",
      url: "https://www.amazon.com/s?k=catfish+fish+food",
    },
  ],
};

const KNOWN_PUBLIC_NAMES = [
  "Lake Charleston",
  "Lake Mattoon",
  "Walnut Point",
  "Lake Paradise",
  "Mill Creek",
];

function getLevelFromXP(xp) {
  return Math.max(1, Math.floor((Number(xp) || 0) / 100) + 1);
}

function getXPForNextLevel(xp) {
  const currentXP = Number(xp) || 0;
  const nextLevelXP = getLevelFromXP(currentXP) * 100;
  return Math.max(0, nextLevelXP - currentXP);
}

function niceGoal(goal) {
  const labels = {
    balanced: "Balanced",
    bass: "Bass",
    bluegill: "Bluegill",
    catfish: "Catfish",
    forage: "Forage",
    trophy: "Trophy Bass",
  };

  return labels[goal] || "Balanced";
}

function looksLikeKnownPublicLocation(pond) {
  const name = String(pond?.name || "").toLowerCase();
  const location = String(pond?.location || "").toLowerCase();

  return (
    location.includes("near lake charleston") ||
    KNOWN_PUBLIC_NAMES.some((known) => name.includes(known.toLowerCase()))
  );
}

function getStockingPlan(profile) {
  const acres = Math.max(0.05, Number(profile.acres) || 0.25);
  const goal = profile.goal || "balanced";

  const bluegill = Math.round(acres * (goal === "trophy" ? 700 : 500));
  const minnows = Math.max(1, Math.round(acres * 8));
  const bass = Math.round(acres * (goal === "trophy" ? 50 : 75));
  const catfish = goal === "catfish" ? Math.round(acres * 125) : Math.round(acres * 50);

  const order = [
    "Start with forage: fathead minnows and bluegill/redear before predator fish.",
    "Give forage time to spawn before adding bass.",
    "Add bass only after the forage base is established.",
    "Add catfish only if you want them and plan to feed or harvest them.",
  ];

  const warnings = [
    "Do not add bass too early or they can wipe out your forage base.",
    "Do not overstock catfish unless you plan to feed and harvest them.",
    "Fix water quality before stocking heavily if the pond is muddy, shallow, or oxygen-stressed.",
    "Check local hatchery recommendations and local regulations before buying fish.",
  ];

  if (goal === "forage") {
    return {
      bluegill: `${Math.round(acres * 250)} fish`,
      minnows: `${Math.max(1, Math.round(acres * 12))} lb`,
      bass: "Wait",
      catfish: "Optional",
      actions: [
        "Build forage first with minnows, bluegill, and habitat.",
        "Add brush piles, pallets, rock, or artificial habitat.",
        "Wait before adding predator fish.",
      ],
      order,
      warnings,
    };
  }

  if (goal === "catfish") {
    return {
      bluegill: `${Math.round(acres * 300)} fish`,
      minnows: `${minnows} lb`,
      bass: "Optional",
      catfish: `${catfish} fish`,
      actions: [
        "Plan a feeding station if catfish are a main goal.",
        "Avoid overstocking without aeration.",
        "Harvest catfish regularly once they reach eating size.",
      ],
      order,
      warnings,
    };
  }

  return {
    bluegill: `${bluegill} fish`,
    minnows: `${minnows} lb`,
    bass: `${bass} fish`,
    catfish: `${catfish} fish optional`,
    actions: [
      "Stock forage before bass.",
      "Add habitat before or during forage stocking.",
      "Wait before adding predator fish if the pond is new.",
    ],
    order,
    warnings,
  };
}

function getAerationPlan(profile) {
  const acres = Math.max(0.05, Number(profile.acres) || 0.25);
  const avgDepth = Math.max(1, Number(profile.averageDepth) || 6);
  const maxDepth = Math.max(avgDepth, Number(profile.maxDepth) || 10);
  const powerNearby = profile.powerNearby || "yes";

  let type = "Small diffuser kit";
  let diffusers = "1 diffuser";
  let priority = "Medium";
  let short = "Basic";
  let power = "Power nearby helps.";

  if (acres >= 0.75) {
    type = "Bottom diffuser system";
    diffusers = acres >= 2 ? "2–4 diffusers" : "1–2 diffusers";
    priority = "High";
    short = "Needed";
  }

  if (maxDepth >= 10) {
    type = "Bottom diffuser aeration";
    priority = "High";
    short = "Deep pond";
  }

  if (avgDepth <= 4) {
    type = "Shallow pond aeration or surface agitation";
    diffusers = "1 diffuser or surface unit";
    priority = "Medium";
    short = "Shallow";
  }

  if (powerNearby === "no") {
    power = "No power nearby. Compare solar or wind options, but size them carefully.";
  } else if (powerNearby === "maybe") {
    power = "Confirm power access before buying a compressor system.";
  }

  return {
    type,
    diffusers,
    priority,
    short,
    power,
    tips: [
      "Start aeration gradually, especially in older ponds, to avoid turning over bad bottom water too fast.",
      "Place diffusers in deeper water, not right next to shore.",
      "Use weighted airline for clean installation.",
      "Aeration helps oxygen, fish stress, and circulation, but it does not fix every algae problem by itself.",
    ],
    buy: [
      "Small ponds: compare small aeration kits.",
      "Farm ponds up to around 1 acre: compare 1-acre diffuser kits.",
      "Larger ponds: compare multi-diffuser systems.",
      "Already have a compressor? Compare weighted hose and diffuser kits.",
    ],
    actions: [
      "Measure pond size and depth before buying.",
      "Decide where the compressor can safely sit.",
      "Choose weighted airline and diffuser count based on pond size.",
    ],
  };
}

function getWaterQualityPlan(profile) {
  const algae = profile.algae || "light";
  const clarity = profile.clarity || "normal";
  const smell = profile.waterSmell || "normal";

  let priority = "Normal";

  if (algae === "heavy" || smell === "bad" || clarity === "muddy") {
    priority = "High";
  } else if (algae === "moderate") {
    priority = "Medium";
  }

  const issues = [];

  if (algae === "heavy") {
    issues.push("Heavy algae may point to excess nutrients, low circulation, or too much runoff.");
  }

  if (clarity === "muddy") {
    issues.push("Muddy water may come from runoff, clay suspension, livestock, carp, or shoreline erosion.");
  }

  if (smell === "bad") {
    issues.push("Bad smell can point to low oxygen, decay, stagnant water, or muck buildup.");
  }

  if (issues.length === 0) {
    issues.push("No major water issue flagged from your current profile.");
  }

  return {
    priority,
    checks: [
      "Water clarity",
      "Algae level",
      "Fish gasping at surface",
      "Bad smell",
      "pH",
      "Ammonia and nitrite if fish are stressed",
      "Dissolved oxygen if you have access to a meter",
    ],
    issues,
    actions: [
      "Log a water note weekly during warm months.",
      "Test water before major stocking decisions.",
      "Reduce nutrient runoff when algae is heavy.",
      "Consider aeration if fish show summer stress.",
    ],
  };
}

function getHabitatPlan(profile) {
  const acres = Math.max(0.05, Number(profile.acres) || 0.25);
  const structureCount = Math.max(2, Math.round(acres * 6));

  return {
    items: [
      `${structureCount} or more structure spots for this pond size.`,
      "Brush piles or artificial fish habitat for forage protection.",
      "Rock or gravel spawning areas for bluegill/redear.",
      "Shallow cover for minnows and young bluegill.",
      "Deeper ambush cover for bass if bass are part of the goal.",
    ],
    placement: [
      "Put some cover near shallow spawning areas.",
      "Put some cover near depth changes if available.",
      "Avoid placing all structure in one pile.",
      "Keep swimming, boating, and mowing access in mind.",
    ],
    actions: [
      "Add habitat before heavy predator stocking.",
      "Create shallow forage cover first.",
      "Log habitat additions in Pond Notes.",
    ],
  };
}

function inputStyle(theme) {
  return {
    ...styles.input,
    background: theme.input,
    color: theme.text,
    borderColor: theme.border,
  };
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [authError, setAuthError] = useState("");

  const [tab, setTab] = useState("dashboard");
  const [darkMode, setDarkMode] = useState(() =>
    JSON.parse(localStorage.getItem("pondpal-dark") || "false")
  );
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const [ponds, setPonds] = useState([]);
  const [selectedPondId, setSelectedPondId] = useState("");
  const [newPond, setNewPond] = useState({ name: "", location: "" });

  const [pondProfile, setPondProfile] = useState(() =>
    JSON.parse(localStorage.getItem("pondpal-profile") || "{}")
  );

  const [catches, setCatches] = useState([]);
  const [identifyingFish, setIdentifyingFish] = useState(false);
  const [newCatch, setNewCatch] = useState({
    species: "",
    length: "",
    weight: "",
    location: "",
    caught_at: new Date().toISOString().slice(0, 10),
    photoFile: null,
    photo_url: "",
    ai_species: "",
    ai_confidence: null,
    estimated_length: "",
    estimate_notes: "",
  });

  const [notes, setNotes] = useState([]);
  const [note, setNote] = useState("");

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [aiHistory, setAiHistory] = useState([]);

  const [mapRadius, setMapRadius] = useState(25);
  const [nearbyWaters, setNearbyWaters] = useState([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState("");
  const [userLocation, setUserLocation] = useState(DEFAULT_LOCATION);
  const [locationLabel, setLocationLabel] = useState("Lake Charleston fallback");
  const [qrBroken, setQrBroken] = useState(false);

  const theme = darkMode ? dark : light;
  const user = session?.user;

  const selectedPond = ponds.find((p) => p.id === selectedPondId);
  const pondCatches = catches.filter((fish) => fish.pond_id === selectedPondId);
  const pondNotes = notes.filter((item) => item.pond_id === selectedPondId);

  const isPersonalPond = selectedPond?.is_personal === true;
  const currentXP = selectedPond?.xp || 0;
  const currentLevel = selectedPond?.level || getLevelFromXP(currentXP);

  const profile = getCurrentProfile();
  const stockingPlan = getStockingPlan(profile);
  const aerationPlan = getAerationPlan(profile);
  const waterPlan = getWaterQualityPlan(profile);
  const habitatPlan = getHabitatPlan(profile);
  const pondHealthScore = calculatePondHealthScore();

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem("pondpal-dark", JSON.stringify(darkMode));
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem("pondpal-profile", JSON.stringify(pondProfile));
  }, [pondProfile]);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  useEffect(() => {
    if (tab === "map") {
      getCurrentLocationAndFetch();
    }
  }, [tab, mapRadius]);

  function getCurrentProfile() {
    const pondKey = selectedPondId || "default";

    return {
      acres: 0.25,
      averageDepth: 6,
      maxDepth: 10,
      goal: "balanced",
      powerNearby: "yes",
      clarity: "normal",
      algae: "light",
      waterSmell: "normal",
      feeding: "no",
      existingFish: "unknown",
      ...pondProfile[pondKey],
    };
  }

  function updateProfile(field, value) {
    const pondKey = selectedPondId || "default";

    setPondProfile((old) => ({
      ...old,
      [pondKey]: {
        ...getCurrentProfile(),
        ...old[pondKey],
        [field]: value,
      },
    }));
  }

  async function normalizeOldPublicLocations(loadedPonds) {
    const pondsToFix = loadedPonds.filter((pond) => {
      return pond.is_personal !== false && looksLikeKnownPublicLocation(pond);
    });

    if (pondsToFix.length === 0) return loadedPonds;

    await Promise.all(
      pondsToFix.map((pond) =>
        supabase.from("ponds").update({ is_personal: false }).eq("id", pond.id)
      )
    );

    return loadedPonds.map((pond) =>
      pondsToFix.some((fixed) => fixed.id === pond.id)
        ? { ...pond, is_personal: false }
        : pond
    );
  }

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
          is_personal: true,
          xp: 0,
          level: 1,
        })
        .select()
        .single();

      loadedPonds = created ? [created] : [];
    }

    loadedPonds = await normalizeOldPublicLocations(loadedPonds);

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

  function getCurrentLocationAndFetch() {
    if (!navigator.geolocation) {
      setUserLocation(DEFAULT_LOCATION);
      setLocationLabel("Lake Charleston fallback");
      setMapError("Location is not supported by this browser. Showing Lake Charleston fallback.");
      fetchNearbyWaters(DEFAULT_LOCATION);
      return;
    }

    setMapLoading(true);
    setMapError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setUserLocation(coords);
        setLocationLabel("your current location");
        fetchNearbyWaters(coords);
      },
      () => {
        setUserLocation(DEFAULT_LOCATION);
        setLocationLabel("Lake Charleston fallback");
        setMapError("Location permission was denied or unavailable. Showing Lake Charleston fallback.");
        fetchNearbyWaters(DEFAULT_LOCATION);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }

  async function fetchNearbyWaters(center = userLocation) {
    setMapLoading(true);

    try {
      const radiusMeters = Math.round(mapRadius * MILES_TO_METERS);

      const query = `
        [out:json][timeout:35];
        (
          way["natural"="water"]["water"~"lake|pond|reservoir"](around:${radiusMeters},${center.lat},${center.lng});
          relation["natural"="water"]["water"~"lake|pond|reservoir"](around:${radiusMeters},${center.lat},${center.lng});
        );
        out center tags 100;
      `;

      const endpoints = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
        "https://overpass.openstreetmap.ru/api/interpreter",
      ];

      let data = null;

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
            body: new URLSearchParams({ data: query }),
          });

          if (!response.ok) continue;

          data = await response.json();
          break;
        } catch {
          continue;
        }
      }

      if (!data) throw new Error("Map search failed.");

      const waters = data.elements
        .filter((item) => item.tags?.name)
        .map((item) => ({
          id: `${item.type}-${item.id}`,
          name: item.tags.name,
          type: item.tags.water || "water",
          lat: item.center?.lat || item.lat,
          lng: item.center?.lon || item.lon,
        }))
        .filter((item) => item.lat && item.lng);

      const unique = Array.from(
        new Map(waters.map((w) => [w.name + w.lat + w.lng, w])).values()
      );

      if (unique.length === 0) {
        setNearbyWaters([]);
        setMapError("No named lakes, ponds, or reservoirs were found nearby. Try increasing the radius.");
        return;
      }

      setNearbyWaters(unique);
    } catch {
      setNearbyWaters([]);
      setMapError("Live lake search failed. Try refreshing the map or allowing location access.");
    } finally {
      setMapLoading(false);
    }
  }

  async function updatePondXP(pondId, amount) {
    const pond = ponds.find((p) => p.id === pondId);
    if (!pond) return;

    const newXP = (Number(pond.xp) || 0) + amount;
    const newLevel = getLevelFromXP(newXP);

    const { error } = await supabase
      .from("ponds")
      .update({ xp: newXP, level: newLevel })
      .eq("id", pondId);

    if (!error) {
      setPonds((oldPonds) =>
        oldPonds.map((p) =>
          p.id === pondId ? { ...p, xp: newXP, level: newLevel } : p
        )
      );
    }
  }

  function calculatePondHealthScore() {
    if (selectedPond?.is_personal !== true) return null;

    let score = 55;
    score += Math.min(15, pondCatches.length * 3);
    score += Math.min(15, pondNotes.length * 3);
    score += Math.min(10, currentLevel * 2);
    score += Number(profile.acres) > 0 ? 5 : 0;
    score += Number(profile.averageDepth) >= 4 ? 5 : -5;
    score += profile.powerNearby === "yes" ? 5 : 0;
    score += profile.algae === "heavy" ? -10 : profile.algae === "moderate" ? -5 : 5;
    score += profile.waterSmell === "bad" ? -10 : 5;

    return Math.max(0, Math.min(100, score));
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

      alert("Account created. Check your email if Supabase asks you to confirm it, then log in.");
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
        is_personal: true,
        xp: 10,
        level: 1,
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
    const confirmed = confirm("Delete this pond? This will also remove its catches and notes.");
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
        location: `${water.type} near ${locationLabel}`,
        is_personal: false,
        xp: 0,
        level: 1,
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

  async function identifyFish() {
    if (!newCatch.photoFile && !newCatch.photo_url) {
      alert("Choose a fish photo first.");
      return;
    }

    setIdentifyingFish(true);

    try {
      let photoUrl = newCatch.photo_url;

      if (!photoUrl && newCatch.photoFile) {
        photoUrl = await uploadCatchPhoto(newCatch.photoFile);
      }

      if (!photoUrl) {
        alert("Photo upload failed.");
        return;
      }

      const response = await fetch("/api/identify-fish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageUrl: photoUrl }),
      });

      const rawText = await response.text();

      let result;

      try {
        result = JSON.parse(rawText);
      } catch {
        throw new Error(
          "The fish identifier backend did not return JSON. Response started with: " +
            rawText.slice(0, 160)
        );
      }

      if (!response.ok) {
        throw new Error(result.error || "Fish identification failed.");
      }

      setNewCatch((old) => ({
        ...old,
        photo_url: photoUrl,
        species: result.species && result.species !== "Unknown" ? result.species : old.species,
        length: result.estimated_length_inches ? String(result.estimated_length_inches) : old.length,
        ai_species: result.species || "Unknown",
        ai_confidence: result.confidence ?? 0,
        estimated_length: result.estimated_length_inches ? String(result.estimated_length_inches) : "",
        estimate_notes: result.notes || "",
      }));
    } catch (error) {
      alert(error.message);
    } finally {
      setIdentifyingFish(false);
    }
  }

  async function addCatch(e) {
    e.preventDefault();
    if (!newCatch.species.trim() || !selectedPondId) return;

    let photoUrl = newCatch.photo_url || "";

    if (!photoUrl && newCatch.photoFile) {
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
        ai_species: newCatch.ai_species || null,
        ai_confidence: newCatch.ai_confidence ?? null,
        estimated_length: newCatch.estimated_length || null,
        estimate_notes: newCatch.estimate_notes || null,
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
        photo_url: "",
        ai_species: "",
        ai_confidence: null,
        estimated_length: "",
        estimate_notes: "",
      });

      await updatePondXP(selectedPondId, 25);
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
      await updatePondXP(selectedPondId, 10);
    }

    if (error) alert(error.message);
  }

  async function deleteNote(id) {
    await supabase.from("notes").delete().eq("id", id);
    setNotes(notes.filter((item) => item.id !== id));
  }

  const personalRecords = useMemo(() => {
    const records = {};

    pondCatches.forEach((fish) => {
      const species = fish.species || "Unknown";
      const score = (Number(fish.weight) || 0) * 100 + (Number(fish.length) || 0);
      const old = records[species];
      const oldScore = old ? (Number(old.weight) || 0) * 100 + (Number(old.length) || 0) : -1;

      if (!old || score > oldScore) {
        records[species] = fish;
      }
    });

    return Object.values(records);
  }, [pondCatches]);

  const leaderboard = useMemo(() => {
    return [...pondCatches].sort((a, b) => {
      const scoreA = (Number(a.weight) || 0) * 100 + (Number(a.length) || 0);
      const scoreB = (Number(b.weight) || 0) * 100 + (Number(b.length) || 0);
      return scoreB - scoreA;
    });
  }, [pondCatches]);

  function askPondPal() {
    if (!question.trim()) return;

    const response = `For ${selectedPond?.name || "this pond"}, focus on oxygen, water clarity, algae level, habitat, and forage balance first. Stock forage before predators, and consider aeration if you see fish stress, bad smell, heavy algae, or summer oxygen problems.`;

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
            Private pond management, stocking, aeration, water quality, and catch records.
          </p>

          <form onSubmit={handleAuth} style={styles.authForm}>
            {authMode === "create" && (
              <input
                style={styles.input}
                placeholder="Name"
                value={authForm.name}
                onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
              />
            )}

            <input
              style={styles.input}
              placeholder="Email"
              value={authForm.email}
              onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
            />

            <input
              style={styles.input}
              placeholder="Password"
              type="password"
              value={authForm.password}
              onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
            />

            {authError && <p style={styles.error}>{authError}</p>}

            <button style={styles.primaryButton}>
              {authMode === "login" ? "Log In" : "Create Account"}
            </button>
          </form>

          <button
            style={styles.linkButton}
            onClick={() => setAuthMode(authMode === "login" ? "create" : "login")}
          >
            {authMode === "login" ? "Need an account? Create one" : "Already have an account? Log in"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...styles.app, flexDirection: isMobile ? "column" : "row", background: theme.page, color: theme.text }}>
      <aside
        style={{
          ...styles.sidebar,
          width: isMobile ? "100%" : "285px",
          minWidth: isMobile ? "0" : "285px",
          maxWidth: "100%",
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
          <p style={{ ...styles.sidebarSub, color: theme.muted }}>{user.email}</p>

          <select
            style={{ ...styles.pondSelect, background: theme.input, color: theme.text, borderColor: theme.border }}
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
              <option value="profile">🌊 Pond Profile</option>
              <option value="stocking">🐟 Stocking Plan</option>
              <option value="aeration">💨 Aeration</option>
              <option value="water">💧 Water Quality</option>
              <option value="habitat">🪵 Habitat</option>
              <option value="catchlog">🎣 Catch Log</option>
              <option value="records">🏆 Records</option>
              <option value="leaderboard">🥇 Leaderboard</option>
              <option value="map">🗺️ Nearby Waters</option>
              <option value="ponds">➕ Ponds</option>
              <option value="notes">📝 Notes</option>
              <option value="ask">💬 Ask PondPal</option>
            </select>
          ) : (
            <nav style={styles.sideNav}>
              <SideButton label="Dashboard" icon="📊" active={tab === "dashboard"} onClick={() => setTab("dashboard")} theme={theme} />
              <SideButton label="Pond Profile" icon="🌊" active={tab === "profile"} onClick={() => setTab("profile")} theme={theme} />
              <SideButton label="Stocking Plan" icon="🐟" active={tab === "stocking"} onClick={() => setTab("stocking")} theme={theme} />
              <SideButton label="Aeration" icon="💨" active={tab === "aeration"} onClick={() => setTab("aeration")} theme={theme} />
              <SideButton label="Water Quality" icon="💧" active={tab === "water"} onClick={() => setTab("water")} theme={theme} />
              <SideButton label="Habitat" icon="🪵" active={tab === "habitat"} onClick={() => setTab("habitat")} theme={theme} />
              <SideButton label="Catch Log" icon="🎣" active={tab === "catchlog"} onClick={() => setTab("catchlog")} theme={theme} />
              <SideButton label="Records" icon="🏆" active={tab === "records"} onClick={() => setTab("records")} theme={theme} />
              <SideButton label="Leaderboard" icon="🥇" active={tab === "leaderboard"} onClick={() => setTab("leaderboard")} theme={theme} />
              <SideButton label="Nearby Waters" icon="🗺️" active={tab === "map"} onClick={() => setTab("map")} theme={theme} />
              <SideButton label="Ponds" icon="➕" active={tab === "ponds"} onClick={() => setTab("ponds")} theme={theme} />
              <SideButton label="Notes" icon="📝" active={tab === "notes"} onClick={() => setTab("notes")} theme={theme} />
              <SideButton label="Ask PondPal" icon="💬" active={tab === "ask"} onClick={() => setTab("ask")} theme={theme} />
            </nav>
          )}
        </div>

        <div style={{ display: "grid", gap: "10px", marginTop: isMobile ? "14px" : 0 }}>
          <button
            style={{ ...styles.modeButton, background: theme.card, color: theme.text, borderColor: theme.border }}
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
              {selectedPond?.name || "No pond"} • {selectedPond?.location || "Add a pond"}
            </p>
          </div>
        </header>

        {tab === "dashboard" && (
          <>
            <section style={styles.hero}>
              <div>
                <p style={styles.badge}>{isPersonalPond ? "Private Pond Mode" : "Named Public Location"}</p>
                <h2 style={styles.heroTitle}>Manage your pond like a pond owner.</h2>
                <p style={styles.heroText}>
                  Track pond size, stocking, aeration, water quality, habitat, feeding, and catch records.
                </p>
              </div>

              <div style={styles.scoreCard}>
                {isPersonalPond ? (
                  <>
                    <p style={styles.scoreLabel}>Pond Readiness Score</p>
                    <h3 style={styles.score}>{pondHealthScore}</h3>
                    <div style={styles.progressBack}>
                      <div style={{ ...styles.progressFill, width: `${pondHealthScore}%` }} />
                    </div>
                    <p style={styles.scoreText}>
                      Based on profile, catches, notes, water quality, aeration readiness, and habitat activity.
                    </p>
                  </>
                ) : (
                  <>
                    <p style={styles.scoreLabel}>Location Level</p>
                    <h3 style={styles.score}>Lv. {currentLevel}</h3>
                    <div style={styles.progressBack}>
                      <div style={{ ...styles.progressFill, width: `${currentXP % 100}%` }} />
                    </div>
                    <p style={styles.scoreText}>Public locations use XP only. Pond tools are best for private ponds.</p>
                  </>
                )}
              </div>
            </section>

            <section style={styles.grid}>
              <Card title="Acres" value={`${profile.acres || 0}`} emoji="📐" theme={theme} />
              <Card title="Avg Depth" value={`${profile.averageDepth || 0} ft`} emoji="📏" theme={theme} />
              <Card title="Goal" value={niceGoal(profile.goal)} emoji="🎯" theme={theme} />
              <Card title="Aeration" value={aerationPlan.short} emoji="💨" theme={theme} />
              <Card title="Level" value={`Lv. ${currentLevel}`} emoji="⭐" theme={theme} />
              <Card title="Next Level" value={`${getXPForNextLevel(currentXP)} XP`} emoji="⬆️" theme={theme} />
            </section>

            <Panel theme={theme}>
              <h2>Next Best Actions</h2>
              <ActionList items={[stockingPlan.actions[0], aerationPlan.actions[0], waterPlan.actions[0], habitatPlan.actions[0]]} />
            </Panel>
          </>
        )}

        {tab === "profile" && (
          <Panel theme={theme}>
            <h2>Pond Profile</h2>
            <p style={{ color: theme.muted, fontWeight: 800 }}>
              This controls your stocking, aeration, water quality, and habitat recommendations.
            </p>

            <div style={styles.formGrid}>
              <Field label="Pond size in acres">
                <input style={inputStyle(theme)} type="number" step="0.05" value={profile.acres} onChange={(e) => updateProfile("acres", e.target.value)} />
              </Field>

              <Field label="Average depth in feet">
                <input style={inputStyle(theme)} type="number" step="1" value={profile.averageDepth} onChange={(e) => updateProfile("averageDepth", e.target.value)} />
              </Field>

              <Field label="Max depth in feet">
                <input style={inputStyle(theme)} type="number" step="1" value={profile.maxDepth} onChange={(e) => updateProfile("maxDepth", e.target.value)} />
              </Field>

              <Field label="Main pond goal">
                <select style={inputStyle(theme)} value={profile.goal} onChange={(e) => updateProfile("goal", e.target.value)}>
                  <option value="balanced">Balanced fishing pond</option>
                  <option value="bass">Bass-focused pond</option>
                  <option value="bluegill">Bluegill pond</option>
                  <option value="catfish">Catfish pond</option>
                  <option value="forage">Forage/minnow pond</option>
                  <option value="trophy">Trophy bass goal</option>
                </select>
              </Field>

              <Field label="Power near pond?">
                <select style={inputStyle(theme)} value={profile.powerNearby} onChange={(e) => updateProfile("powerNearby", e.target.value)}>
                  <option value="yes">Yes, power is nearby</option>
                  <option value="no">No power nearby</option>
                  <option value="maybe">Not sure</option>
                </select>
              </Field>

              <Field label="Existing fish">
                <select style={inputStyle(theme)} value={profile.existingFish} onChange={(e) => updateProfile("existingFish", e.target.value)}>
                  <option value="unknown">Unknown</option>
                  <option value="none">No fish yet</option>
                  <option value="bluegill">Bluegill / sunfish present</option>
                  <option value="bass">Bass present</option>
                  <option value="catfish">Catfish present</option>
                  <option value="mixed">Mixed fish present</option>
                </select>
              </Field>

              <Field label="Water clarity">
                <select style={inputStyle(theme)} value={profile.clarity} onChange={(e) => updateProfile("clarity", e.target.value)}>
                  <option value="clear">Very clear</option>
                  <option value="normal">Normal</option>
                  <option value="muddy">Muddy/cloudy</option>
                </select>
              </Field>

              <Field label="Algae level">
                <select style={inputStyle(theme)} value={profile.algae} onChange={(e) => updateProfile("algae", e.target.value)}>
                  <option value="light">Light</option>
                  <option value="moderate">Moderate</option>
                  <option value="heavy">Heavy</option>
                </select>
              </Field>

              <Field label="Water smell">
                <select style={inputStyle(theme)} value={profile.waterSmell} onChange={(e) => updateProfile("waterSmell", e.target.value)}>
                  <option value="normal">Normal</option>
                  <option value="bad">Bad / rotten smell</option>
                </select>
              </Field>

              <Field label="Feeding fish?">
                <select style={inputStyle(theme)} value={profile.feeding} onChange={(e) => updateProfile("feeding", e.target.value)}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                  <option value="planning">Planning to</option>
                </select>
              </Field>
            </div>
          </Panel>
        )}

        {tab === "stocking" && (
          <Panel theme={theme}>
            <h2>Private Pond Stocking Plan</h2>
            <p style={{ color: theme.muted, fontWeight: 800 }}>
              Starter planning only. Check local laws and talk to a local hatchery before buying fish.
            </p>

            <div style={styles.grid}>
              <Card title="Bluegill / Redear" value={stockingPlan.bluegill} emoji="🐟" theme={theme} />
              <Card title="Fathead Minnows" value={stockingPlan.minnows} emoji="🐠" theme={theme} />
              <Card title="Largemouth Bass" value={stockingPlan.bass} emoji="🎣" theme={theme} />
              <Card title="Channel Catfish" value={stockingPlan.catfish} emoji="🐡" theme={theme} />
            </div>

            <InfoBox title="Recommended Order" items={stockingPlan.order} theme={theme} />
            <InfoBox title="Warnings" items={stockingPlan.warnings} theme={theme} />
            <InfoBox title="Actions" items={stockingPlan.actions} theme={theme} />

            <SupplyGrid title="Where To Buy Stock Fish" items={SUPPLIES.stocking} theme={theme} />
            <SupplyGrid title="Feeding Supplies" items={SUPPLIES.feeding} theme={theme} />
          </Panel>
        )}

        {tab === "aeration" && (
          <Panel theme={theme}>
            <h2>Aeration Recommendation</h2>
            <p style={{ color: theme.muted, fontWeight: 800 }}>
              Aeration depends on pond shape, depth, fish load, and power access. Use this as a starting point.
            </p>

            <section style={styles.grid}>
              <Card title="System Type" value={aerationPlan.type} emoji="💨" theme={theme} />
              <Card title="Diffusers" value={aerationPlan.diffusers} emoji="🫧" theme={theme} />
              <Card title="Priority" value={aerationPlan.priority} emoji="⚠️" theme={theme} />
              <Card title="Power Note" value={aerationPlan.power} emoji="🔌" theme={theme} />
            </section>

            <InfoBox title="Aeration Setup Tips" items={aerationPlan.tips} theme={theme} />
            <InfoBox title="What To Buy / Compare" items={aerationPlan.buy} theme={theme} />
            <InfoBox title="Actions" items={aerationPlan.actions} theme={theme} />

            <SupplyGrid title="Aeration Supplies" items={SUPPLIES.aeration} theme={theme} />
          </Panel>
        )}

        {tab === "water" && (
          <Panel theme={theme}>
            <h2>Water Quality</h2>

            <section style={styles.grid}>
              <Card title="Clarity" value={profile.clarity} emoji="👁️" theme={theme} />
              <Card title="Algae" value={profile.algae} emoji="🟢" theme={theme} />
              <Card title="Smell" value={profile.waterSmell} emoji="👃" theme={theme} />
              <Card title="Testing Priority" value={waterPlan.priority} emoji="🧪" theme={theme} />
            </section>

            <InfoBox title="What To Check" items={waterPlan.checks} theme={theme} />
            <InfoBox title="Likely Issues" items={waterPlan.issues} theme={theme} />
            <InfoBox title="Actions" items={waterPlan.actions} theme={theme} />

            <SupplyGrid title="Water Quality Supplies" items={SUPPLIES.water} theme={theme} />
          </Panel>
        )}

        {tab === "habitat" && (
          <Panel theme={theme}>
            <h2>Habitat Plan</h2>
            <p style={{ color: theme.muted, fontWeight: 800 }}>
              Good habitat helps forage fish survive and gives predator fish ambush points.
            </p>

            <InfoBox title="Recommended Habitat" items={habitatPlan.items} theme={theme} />
            <InfoBox title="Placement Tips" items={habitatPlan.placement} theme={theme} />
            <InfoBox title="Actions" items={habitatPlan.actions} theme={theme} />

            <SupplyGrid title="Habitat Supplies" items={SUPPLIES.habitat} theme={theme} />
          </Panel>
        )}

        {tab === "catchlog" && (
          <Panel theme={theme}>
            <h2>Fish Catch Log</h2>
            <p style={{ color: theme.muted, fontWeight: 800 }}>
              +25 XP for each catch logged. Fish ID needs a clear fish photo.
            </p>

            <form onSubmit={addCatch} style={styles.catchForm}>
              <input placeholder="Species" value={newCatch.species} onChange={(e) => setNewCatch({ ...newCatch, species: e.target.value })} style={inputStyle(theme)} />
              <input placeholder="Length inches" value={newCatch.length} onChange={(e) => setNewCatch({ ...newCatch, length: e.target.value })} style={inputStyle(theme)} />
              <input placeholder="Weight lbs" value={newCatch.weight} onChange={(e) => setNewCatch({ ...newCatch, weight: e.target.value })} style={inputStyle(theme)} />
              <input placeholder="Location" value={newCatch.location} onChange={(e) => setNewCatch({ ...newCatch, location: e.target.value })} style={inputStyle(theme)} />
              <input type="date" value={newCatch.caught_at} onChange={(e) => setNewCatch({ ...newCatch, caught_at: e.target.value })} style={inputStyle(theme)} />

              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files[0];

                  if (!file) return;

                  const name = file.name.toLowerCase();
                  const isHeic = name.endsWith(".heic") || name.endsWith(".heif");

                  if (isHeic) {
                    alert("iPhone HEIC photos do not display well on the web. Please upload a JPG, JPEG, PNG, or WEBP photo.");
                    e.target.value = "";
                    return;
                  }

                  setNewCatch({
                    ...newCatch,
                    photoFile: file,
                    photo_url: "",
                  });
                }}
                style={inputStyle(theme)}
              />

              <button type="button" style={styles.secondaryButton} onClick={identifyFish} disabled={identifyingFish}>
                {identifyingFish ? "Identifying..." : "Identify Fish"}
              </button>
              <button style={styles.primaryButton}>Add Catch</button>
            </form>

            {(newCatch.ai_species || newCatch.estimate_notes) && (
              <div style={{ ...styles.compactAiResult, background: theme.soft, borderColor: theme.border, color: theme.text }}>
                <div>
                  <strong>AI Fish ID:</strong> {newCatch.ai_species || "Unknown"}{" "}
                  <span style={{ color: theme.muted }}>({newCatch.ai_confidence ?? 0}%)</span>
                </div>

                <div style={styles.aiPill}>
                  {newCatch.estimated_length ? `${newCatch.estimated_length} in estimate` : "No size estimate"}
                </div>

                <details style={{ gridColumn: "1 / -1" }}>
                  <summary style={{ cursor: "pointer", fontWeight: 800 }}>Notes</summary>
                  <p style={{ marginBottom: 0 }}>{newCatch.estimate_notes || "No notes."}</p>
                  <p style={{ color: theme.muted, fontWeight: 800 }}>AI can be wrong. Confirm species and size before saving.</p>
                </details>
              </div>
            )}

            <RecordTable rows={pondCatches} theme={theme} deleteCatch={deleteCatch} showAction />
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
            <h2>Waters Within {mapRadius} Miles of {locationLabel}</h2>

            <div style={styles.mapControls}>
              <select style={inputStyle(theme)} value={mapRadius} onChange={(e) => setMapRadius(Number(e.target.value))}>
                <option value={25}>25 miles</option>
                <option value={50}>50 miles</option>
                <option value={100}>100 miles</option>
                <option value={200}>200 miles</option>
              </select>
              <button style={styles.primaryButton} onClick={getCurrentLocationAndFetch}>
                Use My Location
              </button>
            </div>

            {mapLoading && <p style={{ color: theme.muted, fontWeight: 900 }}>Loading lakes and ponds...</p>}
            {mapError && <p style={styles.error}>{mapError}</p>}

            <div style={styles.realMapBox}>
              <MapContainer center={[userLocation.lat, userLocation.lng]} zoom={8} style={{ height: "100%", width: "100%" }}>
                <MapUpdater center={userLocation} radius={mapRadius} />
                <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                <CircleMarker center={[userLocation.lat, userLocation.lng]} radius={12} pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.9 }}>
                  <Popup><strong>{locationLabel}</strong></Popup>
                </CircleMarker>

                {nearbyWaters.map((water) => (
                  <CircleMarker key={water.id} center={[water.lat, water.lng]} radius={8} pathOptions={{ color: "#0f766e", fillColor: "#22c55e", fillOpacity: 0.8 }}>
                    <Popup>
                      <strong>{water.name}</strong>
                      <br />
                      {water.type}
                      <br />
                      <button onClick={() => addWaterAsPond(water)}>Add to My Ponds</button>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>

            <p style={{ color: theme.muted, fontWeight: 800, marginTop: 14 }}>
              Found {nearbyWaters.length} named lakes, ponds, or reservoirs.
            </p>
          </Panel>
        )}

        {tab === "ponds" && (
          <Panel theme={theme}>
            <h2>Manage Ponds</h2>

            <form onSubmit={addPond} style={styles.catchForm}>
              <input placeholder="Pond name" value={newPond.name} onChange={(e) => setNewPond({ ...newPond, name: e.target.value })} style={inputStyle(theme)} />
              <input placeholder="Location" value={newPond.location} onChange={(e) => setNewPond({ ...newPond, location: e.target.value })} style={inputStyle(theme)} />
              <button style={styles.primaryButton}>Add Personal Pond</button>
            </form>

            <div style={styles.grid}>
              {ponds.map((pond) => {
                const personal = pond.is_personal === true;

                return (
                  <div key={pond.id} style={{ ...styles.card, background: theme.card, borderColor: theme.border }}>
                    <div style={styles.cardEmoji}>{personal ? "🌊" : "📍"}</div>
                    <p style={{ ...styles.cardTitle, color: theme.muted }}>{personal ? "Personal Pond" : "Named Public Location"}</p>
                    <h3 style={styles.cardValue}>{pond.name}</h3>
                    <p style={{ color: theme.muted, fontWeight: 800 }}>{pond.location}</p>
                    <p style={{ fontWeight: 900 }}>Lv. {pond.level || 1} • {pond.xp || 0} XP</p>
                    {personal && <p style={{ color: theme.muted, fontWeight: 800 }}>Gets pond-owner tools</p>}
                    {!personal && <p style={{ color: theme.muted, fontWeight: 800 }}>Public map location</p>}
                    <button style={{ ...styles.deleteButton, marginTop: "16px" }} onClick={() => deletePond(pond.id)}>
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}

        {tab === "notes" && (
          <Panel theme={theme}>
            <h2>Pond Notes</h2>
            <p style={{ color: theme.muted, fontWeight: 800 }}>+10 XP for each note saved.</p>

            <form onSubmit={addNote}>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Write a pond note..." style={{ ...styles.textarea, background: theme.input, color: theme.text, borderColor: theme.border }} />
              <button style={styles.primaryButton}>Save Note</button>
            </form>

            <div style={styles.noteList}>
              {pondNotes.map((item) => (
                <div key={item.id} style={{ ...styles.noteCard, background: theme.soft, borderColor: theme.border }}>
                  <div>
                    <strong>{new Date(item.created_at).toLocaleDateString()}</strong>
                    <p>{item.note}</p>
                  </div>
                  <button style={styles.deleteButton} onClick={() => deleteNote(item.id)}>
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
            <textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask a pond question..." style={{ ...styles.textarea, background: theme.input, color: theme.text, borderColor: theme.border }} />
            <button style={styles.primaryButton} onClick={askPondPal}>Ask PondPal</button>

            {answer && <div style={{ ...styles.answer, background: theme.soft }}>{answer}</div>}

            <div style={{ marginTop: "24px" }}>
              <h3>Question History</h3>
              {aiHistory.length === 0 && <p style={{ color: theme.muted, fontWeight: 800 }}>No questions asked yet.</p>}
              {aiHistory.map((item) => (
                <div key={item.id} style={{ ...styles.noteCard, background: theme.soft, borderColor: theme.border, marginBottom: "12px" }}>
                  <div>
                    <strong>{item.date}</strong>
                    <p><b>You:</b> {item.question}</p>
                    <p><b>PondPal:</b> {item.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        <div style={{ ...styles.donationBox, background: theme.card, borderColor: theme.border }}>
          <div>
            <h3 style={{ margin: 0 }}>Support PondPal</h3>
            <p style={{ color: theme.muted, fontWeight: 800, marginBottom: 0 }}>
              Donations help cover hosting, map tools, and AI fish ID costs.
            </p>
          </div>

          <div style={styles.qrWrap}>
            {!qrBroken ? (
              <img
                src="/venmo-qr.png"
                alt="Donate to PondPal with Venmo"
                style={styles.qrCode}
                onError={() => setQrBroken(true)}
              />
            ) : (
              <div style={styles.qrFallback}>
                QR missing
                <br />
                Add <b>venmo-qr.png</b> to the <b>public</b> folder.
              </div>
            )}
            <p style={{ margin: 0, fontWeight: 800, color: theme.text }}>
              Scan to support PondPal
            </p>
          </div>
        </div>
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
    profile: "Pond Profile",
    stocking: "Stocking Plan",
    aeration: "Aeration",
    water: "Water Quality",
    habitat: "Habitat",
    catchlog: "Fish Catch Log",
    records: "Records",
    leaderboard: "Leaderboard",
    map: "Nearby Waters",
    ponds: "Manage Ponds",
    notes: "Pond Notes",
    ask: "Ask PondPal",
  }[tab] || "Dashboard";
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
    <div style={{ ...styles.card, background: theme.card, borderColor: theme.border }}>
      <div style={styles.cardEmoji}>{emoji}</div>
      <p style={{ ...styles.cardTitle, color: theme.muted }}>{title}</p>
      <h3 style={styles.cardValue}>{value}</h3>
    </div>
  );
}

function Panel({ children, theme }) {
  return (
    <section style={{ ...styles.panel, background: theme.card, borderColor: theme.border }}>
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  );
}

function ActionList({ items }) {
  return (
    <div style={styles.actionList}>
      {items.map((item) => (
        <div key={item} style={styles.actionItem}>
          ✅ {item}
        </div>
      ))}
    </div>
  );
}

function InfoBox({ title, items, theme }) {
  return (
    <div style={{ ...styles.infoBox, background: theme.soft, borderColor: theme.border }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <ActionList items={items} />
    </div>
  );
}

function SupplyGrid({ title, items, theme }) {
  return (
    <div style={{ ...styles.suppliesSection, borderColor: theme.border }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <p style={{ color: theme.muted, fontWeight: 800 }}>
        Starter links for comparing supplies. Prices and stock can change, so compare before buying.
      </p>

      <div style={styles.shopGrid}>
        {items.map((item) => (
          <a
            key={item.title}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            style={{
              ...styles.shopCard,
              background: theme.soft,
              borderColor: theme.border,
              color: theme.text,
            }}
          >
            <p style={styles.shopTag}>{item.tag}</p>
            <h3>{item.title}</h3>
            <p style={{ color: theme.muted, fontWeight: 800 }}>{item.note}</p>
            <strong>Open link →</strong>
          </a>
        ))}
      </div>
    </div>
  );
}

function RecordTable({ rows, theme, deleteCatch, showAction = false }) {
  if (!rows.length) {
    return <p style={{ color: theme.muted, fontWeight: 800 }}>No catches logged yet.</p>;
  }

  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Photo</th>
            <th style={styles.th}>Species</th>
            <th style={styles.th}>AI ID</th>
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
                  <a href={fish.photo_url} target="_blank" rel="noreferrer" title="Open full-size fish photo">
                    <img
                      src={fish.photo_url}
                      alt={fish.species}
                      style={styles.catchPhoto}
                      onError={(e) => {
                        e.currentTarget.src = "https://placehold.co/100x100/0f172a/ffffff?text=Fish";
                      }}
                    />
                  </a>
                ) : (
                  "-"
                )}
              </td>
              <td style={styles.td}>{fish.species}</td>
              <td style={styles.td}>
                {fish.ai_species ? (
                  <>
                    {fish.ai_species}
                    <br />
                    <span style={{ fontSize: "12px", color: theme.muted }}>
                      {fish.ai_confidence || 0}% confident
                    </span>
                  </>
                ) : (
                  "-"
                )}
              </td>
              <td style={styles.td}>{fish.length ? `${fish.length} in` : "-"}</td>
              <td style={styles.td}>{fish.weight ? `${fish.weight} lb` : "-"}</td>
              <td style={styles.td}>{fish.location || "-"}</td>
              <td style={styles.td}>{fish.caught_at || "-"}</td>
              {showAction && (
                <td style={styles.td}>
                  <button style={styles.deleteButton} onClick={() => deleteCatch(fish.id)}>
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
    return <p style={{ color: theme.muted, fontWeight: 800 }}>No catches logged for this pond yet.</p>;
  }

  return (
    <div style={styles.tableWrap}>
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
                {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
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
  authLogo: { fontSize: "38px", margin: 0 },
  authForm: { display: "grid", gap: "12px", marginTop: "20px" },
  error: { color: "#ef4444", fontWeight: 800 },
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
    width: "100%",
    display: "flex",
    fontFamily: "Arial, sans-serif",
    overflowX: "hidden",
  },
  sidebar: {
    width: "285px",
    minWidth: "285px",
    flexShrink: 0,
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
    overflowX: "hidden",
  },
  logo: { fontSize: "30px", margin: 0 },
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
  sideNav: { display: "grid", gap: "10px", marginTop: "24px" },
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
    width: "100%",
    maxWidth: "none",
    minWidth: 0,
    boxSizing: "border-box",
    overflowX: "hidden",
  },
  topbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
    gap: "16px",
    flexWrap: "wrap",
  },
  pageTitle: { margin: 0, fontSize: "clamp(28px, 7vw, 34px)" },
  subtitle: { marginTop: "6px", fontWeight: 700 },
  primaryButton: {
    background: "#0f766e",
    color: "white",
    border: "none",
    borderRadius: "999px",
    padding: "14px 22px",
    fontWeight: "900",
    cursor: "pointer",
  },
  secondaryButton: {
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "999px",
    padding: "14px 22px",
    fontWeight: "900",
    cursor: "pointer",
  },

  badge: {
    display: "inline-block",
    background: "rgba(255,255,255,.18)",
    padding: "8px 12px",
    borderRadius: "999px",
    fontWeight: 900,
    margin: "0 0 14px",
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
    maxWidth: "100%",
    overflow: "hidden",
  },
  heroTitle: {
    fontSize: "clamp(34px, 8vw, 46px)",
    margin: "0 0 14px",
    lineHeight: 1,
  },
  heroText: { fontSize: "18px", lineHeight: 1.6, opacity: 0.9 },
  scoreCard: {
    background: "rgba(255,255,255,.15)",
    borderRadius: "28px",
    padding: "24px",
    minWidth: 0,
  },
  scoreLabel: { margin: 0, opacity: 0.8, fontWeight: 700 },
  score: { fontSize: "64px", margin: "10px 0" },
  scoreText: { fontWeight: 800, lineHeight: 1.4, margin: 0 },
  progressBack: {
    background: "rgba(255,255,255,.25)",
    height: "12px",
    borderRadius: "999px",
    overflow: "hidden",
  },
  progressFill: { background: "#bef264", height: "100%" },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "18px",
    width: "100%",
    maxWidth: "100%",
    marginBottom: "18px",
  },
  card: {
    border: "1px solid",
    borderRadius: "26px",
    padding: "26px",
    boxShadow: "0 12px 30px rgba(15,23,42,.08)",
    minWidth: 0,
    overflow: "hidden",
  },
  cardEmoji: { fontSize: "34px" },
  cardTitle: { fontWeight: 800 },
  cardValue: { fontSize: "28px", margin: 0, overflowWrap: "anywhere" },

  panel: {
    border: "1px solid",
    borderRadius: "28px",
    padding: "clamp(18px, 5vw, 30px)",
    boxShadow: "0 12px 30px rgba(15,23,42,.08)",
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
    boxSizing: "border-box",
    marginBottom: "22px",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "14px",
  },
  field: {
    display: "grid",
    gap: "8px",
  },
  label: {
    fontWeight: "900",
  },
  input: {
    width: "100%",
    padding: "14px",
    borderRadius: "16px",
    border: "1px solid",
    fontSize: "16px",
    boxSizing: "border-box",
    minWidth: 0,
  },
  infoBox: {
    border: "1px solid",
    borderRadius: "22px",
    padding: "18px",
    marginTop: "18px",
  },
  actionList: {
    display: "grid",
    gap: "10px",
  },
  actionItem: {
    fontWeight: 800,
    lineHeight: 1.4,
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
    resize: "vertical",
  },
  answer: {
    marginTop: "20px",
    padding: "20px",
    borderRadius: "20px",
    fontWeight: "800",
    lineHeight: 1.6,
    overflowWrap: "anywhere",
  },
  catchForm: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: "12px",
    marginBottom: "24px",
    width: "100%",
    maxWidth: "100%",
  },
  noteList: { display: "grid", gap: "12px", marginTop: "18px" },
  noteCard: {
    border: "1px solid",
    borderRadius: "20px",
    padding: "18px",
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    flexWrap: "wrap",
    overflowWrap: "anywhere",
  },

  compactAiResult: {
    border: "1px solid",
    borderRadius: "18px",
    padding: "12px 14px",
    marginBottom: "18px",
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "8px 12px",
    alignItems: "center",
    fontSize: "14px",
    maxWidth: "100%",
    overflow: "hidden",
  },
  aiPill: {
    background: "#0f766e",
    color: "white",
    borderRadius: "999px",
    padding: "7px 11px",
    fontWeight: 900,
    fontSize: "12px",
    whiteSpace: "nowrap",
  },

  suppliesSection: {
    border: "1px solid",
    borderRadius: "24px",
    padding: "18px",
    marginTop: "22px",
  },
  shopGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: "16px",
  },
  shopCard: {
    border: "1px solid",
    borderRadius: "22px",
    padding: "18px",
    textDecoration: "none",
    display: "block",
  },
  shopTag: {
    display: "inline-block",
    background: "#0f766e",
    color: "white",
    borderRadius: "999px",
    padding: "6px 10px",
    fontWeight: 900,
    fontSize: "12px",
    margin: 0,
  },

  donationBox: {
    border: "1px solid",
    borderRadius: "24px",
    padding: "20px",
    marginTop: "28px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
    maxWidth: "100%",
    overflow: "hidden",
  },
  qrWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
  },
  qrCode: {
    width: "150px",
    height: "150px",
    objectFit: "contain",
    borderRadius: "16px",
    border: "1px solid #dbeafe",
    background: "white",
    padding: "8px",
  },
  qrFallback: {
    width: "150px",
    minHeight: "150px",
    borderRadius: "16px",
    border: "1px dashed #94a3b8",
    background: "white",
    color: "#0f172a",
    padding: "12px",
    display: "grid",
    placeItems: "center",
    textAlign: "center",
    fontWeight: 800,
    fontSize: "12px",
  },

  tableWrap: {
    width: "100%",
    maxWidth: "100%",
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "760px",
  },
  th: { textAlign: "left", padding: "14px", color: "#0f766e" },
  td: { padding: "14px", fontWeight: "700" },
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
    width: "90px",
    height: "90px",
    objectFit: "cover",
    borderRadius: "14px",
    cursor: "pointer",
  },

  mapControls: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
    marginBottom: "16px",
    width: "100%",
  },
  realMapBox: {
    height: "min(70vh, 560px)",
    minHeight: "420px",
    borderRadius: "24px",
    overflow: "hidden",
    border: "1px solid #dbeafe",
    width: "100%",
    maxWidth: "100%",
  },
};
