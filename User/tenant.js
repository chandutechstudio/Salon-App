// tenant.js - Multi-tenant salon helper for user panel
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, collection, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBR7QQNVmKmlAem6FRfqbMYVuK0tdwhb6I",
  authDomain: "creator-chandu.firebaseapp.com",
  projectId: "creator-chandu",
  storageBucket: "creator-chandu.firebasestorage.app",
  messagingSenderId: "536504537561",
  appId: "1:536504537561:web:3c7d0362376f63462649c8",
  measurementId: "G-7RLH5MVLV3"
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export const DEVELOPER_ZAP_KEY = "zap9616e75062c85cc199581822ae0d1d5";
export const ZAP_UNLOCK_AMOUNT = "100";
// Silently kisi default salon par redirect na ho isliye empty rakha gaya hai
export const DEFAULT_SALON_SLUG = "";

try {
    localStorage.removeItem("userBookings");
} catch (_) {}

export function salonNameToSlug(salonName) {
    if (!salonName || typeof salonName !== "string") return "";
    return salonName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

export function normalizeSalonId(rawValue) {
    if (!rawValue || typeof rawValue !== "string") return "";
    return rawValue.trim().toLowerCase();
}

export function resolveActiveSalonId({ persist = true, fallback = "" } = {}) {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = normalizeSalonId(params.get("salon"));

    if (fromUrl) {
        if (persist) {
            try { sessionStorage.setItem("activeSalonId", fromUrl); } catch (_) {}
        }
        return fromUrl;
    }

    try {
        const fromSession = normalizeSalonId(sessionStorage.getItem("activeSalonId"));
        if (fromSession) return fromSession;
    } catch (_) {}

    const cleanFallback = normalizeSalonId(fallback);
    if (cleanFallback) {
        if (persist) {
            try { sessionStorage.setItem("activeSalonId", cleanFallback); } catch (_) {}
        }
        return cleanFallback;
    }

    return "";
}

export function buildSalonUrl(pageName, salonId, extraParams = {}) {
    const cleanId = normalizeSalonId(salonId) || resolveActiveSalonId({ persist: false });
    const url = new URL(pageName, window.location.href);
    if (cleanId) url.searchParams.set("salon", cleanId);
    Object.entries(extraParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            url.searchParams.set(key, String(value));
        }
    });
    return url.toString();
}

export function getSalonDocRef(salonId) {
    const id = normalizeSalonId(salonId);
    if (!id) throw new Error("Missing active salon tenant ID.");
    return doc(db, "salons", id);
}

export function getSalonSubcollectionRef(salonId, subcollectionName) {
    const id = normalizeSalonId(salonId);
    if (!id) throw new Error("Missing active salon tenant ID.");
    return collection(db, "salons", id, subcollectionName);
}

export function getCustomerDocRef(salonId, uid) {
    const id = normalizeSalonId(salonId);
    if (!id || !uid) throw new Error("Missing active salon ID or customer UID.");
    return doc(db, "salons", id, "customers", uid);
}

export async function resolveCanonicalSalonId(rawSlug, { persist = true } = {}) {
    let current = normalizeSalonId(rawSlug);
    if (!current) return "";

    const visited = new Set();
    while (current && !visited.has(current)) {
        visited.add(current);
        try {
            const snap = await getDoc(getSalonDocRef(current));
            if (!snap.exists()) break;
            const next = normalizeSalonId(snap.data()?.redirectToSlug || "");
            if (next && next !== current) {
                current = next;
            } else {
                break;
            }
        } catch (_) {
            break;
        }
    }

    if (current && persist) {
        try {
            sessionStorage.setItem("activeSalonId", current);
        } catch (_) {}
    }

    return current;
}

export async function resolveCanonicalActiveSalonId({ persist = true, fallback = "" } = {}) {
    const initialId = resolveActiveSalonId({ persist, fallback });
    if (!initialId) return "";
    return await resolveCanonicalSalonId(initialId, { persist });
}
