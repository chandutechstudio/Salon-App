import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, collection, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

export function resolveActiveSalonId({ persist = true } = {}) {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = normalizeSalonId(params.get("salon"));

    if (fromUrl) {
        if (persist) {
            sessionStorage.setItem("activeSalonId", fromUrl);
        }
        return fromUrl;
    }

    const fromSession = normalizeSalonId(sessionStorage.getItem("activeSalonId"));
    if (fromSession) return fromSession;

    return "";
}

export function buildSalonUrl(pageName, salonId, extraParams = {}) {
    const cleanId = normalizeSalonId(salonId);
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

export function getSubscriptionDocRef(salonId) {
    const id = normalizeSalonId(salonId);
    if (!id) throw new Error("Missing active salon tenant ID.");
    return doc(db, "subscriptions", id);
}

// Agar purana slug change hua hai to latest active slug resolve karta hai
export async function resolveCanonicalSalonId(rawSlug) {
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
    return current;
}

// Strict ownership verification: logged-in admin ka uid salon ownerUid se match hona chahiye
export async function verifyAdminSalonAccess(user, candidateSlug) {
    if (!user || !user.uid) return { ok: false, salonId: "" };

    const rawCandidate = normalizeSalonId(candidateSlug);
    const canonicalCandidate = rawCandidate ? await resolveCanonicalSalonId(rawCandidate) : "";
    const emailKey = String(user.email || "").trim().toLowerCase();
    let ownedSlug = "";

    if (emailKey) {
        try {
            const emailSnap = await getDoc(getSalonDocRef(emailKey));
            if (emailSnap.exists()) {
                const eData = emailSnap.data() || {};
                if (eData.ownerUid === user.uid && eData.linkedSalonSlug) {
                    ownedSlug = await resolveCanonicalSalonId(eData.linkedSalonSlug);
                }
            }
        } catch (_) {}
    }

    const targetSlug = canonicalCandidate || ownedSlug;
    if (!targetSlug) return { ok: false, salonId: "" };

    try {
        const salonSnap = await getDoc(getSalonDocRef(targetSlug));
        if (!salonSnap.exists()) {
            return { ok: false, salonId: ownedSlug || "" };
        }

        const data = salonSnap.data() || {};
        if (!data.ownerUid || data.ownerUid !== user.uid) {
            return { ok: false, salonId: ownedSlug || "" };
        }

        return { ok: true, salonId: targetSlug };
    } catch (_) {
        return { ok: false, salonId: "" };
    }
}

// Har protected admin page ke liye mandatory auth + ownership guard
export function requireAdminAuth(onAuthorized, { redirectTo = "index.html" } = {}) {
    return onAuthStateChanged(auth, async (user) => {
        if (!user || !user.uid) {
            try { sessionStorage.clear(); } catch (_) {}
            window.location.replace(redirectTo);
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const candidate = params.get("salon") || sessionStorage.getItem("activeSalonId") || "";
        const access = await verifyAdminSalonAccess(user, candidate);

        if (!access.ok || !access.salonId) {
            try { sessionStorage.clear(); } catch (_) {}
            window.location.replace(redirectTo);
            return;
        }

        sessionStorage.setItem("activeSalonId", access.salonId);
        if (user.email) {
            sessionStorage.setItem("adminEmail", user.email.trim().toLowerCase());
        }

        if (typeof onAuthorized === "function") {
            await onAuthorized(user, access.salonId);
        }
    });
}