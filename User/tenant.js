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
```[span_0](start_span)[span_0](end_span)

---

### 2. User Panel: `payment_2.html` (Missing `salonId` Guard)
`confirmAndPayToCloud` ke andar `try {` se just pehle yeh check lagao taaki bina `activeSalonId` ke booking submit na ho:

```javascript
if (!activeSalonId) {
    window.showToast("Salon link/ID missing! Please open via your salon booking link.", "error");
    btnElement.innerHTML = originalBtnHtml;
    btnElement.disabled = false;
    return;
}
```[span_1](start_span)[span_1](end_span)

---

### 3. User Panel: `history.html` aur `success.html` (`matchesCurrentCustomer` Fix)
Dono files mein `matchesCurrentCustomer(booking, user)` ko is se replace karo taaki `user.uid` primary match ho aur phone/email change hone par bhi customer ki apni booking dikhe:

```javascript
function matchesCurrentCustomer(booking, user) {
    const authUid = String(user?.uid || "").trim();
    const authEmail = String(user?.email || sessionStorage.getItem("salonCustomerEmail") || "").trim().toLowerCase();
    const authPhone = String(sessionStorage.getItem("salonCustomerPhone") || "").replace(/\D/g, "");

    const bUid = String(booking.userId || "").trim();
    const bEmail = String(booking.userEmail || booking.email || "").trim().toLowerCase();
    const bPhoneRaw = String(booking.userPhone || booking.phone || "").trim();
    const bPhoneLower = bPhoneRaw.toLowerCase();
    const bPhoneDigits = bPhoneRaw.replace(/\D/g, "");

    if (!authUid && !authEmail && !authPhone) return false;
    if (authUid && bUid && authUid === bUid) return true;
    if (authEmail && ((bEmail && authEmail === bEmail) || (bPhoneLower && authEmail === bPhoneLower))) return true;
    if (authPhone && bPhoneDigits && authPhone === bPhoneDigits) return true;
    return false;
}
```[span_2](start_span)[span_2](end_span)[span_3](start_span)[span_3](end_span)[span_4](start_span)[span_4](end_span)[span_5](start_span)[span_5](end_span)

---

### 4. Admin Panel: `index.html` (`resolveLoginEmail` Fix)
`"Admin"` se login karte waqt random/latest salon pick hone ke bajaye URL/session ke `salon` slug ko priority do:

```javascript
async function resolveLoginEmail(userIdInput, salonSlugHint = "") {
    const raw = userIdInput.trim();
    if (raw.includes("@")) {
        return { email: raw.toLowerCase(), salonSlug: normalizeSalonId(salonSlugHint) };
    }

    if (raw.toLowerCase() === "admin") {
        const params = new URLSearchParams(window.location.search);
        const rawSlug =
            salonSlugHint ||
            params.get("salon") ||
            sessionStorage.getItem("activeSalonId") ||
            "";
        const targetSlug = rawSlug ? await resolveCanonicalSalonId(rawSlug) : "";

        if (targetSlug) {
            const salonSnap = await getDoc(getSalonDocRef(targetSlug));
            if (salonSnap.exists() && salonSnap.data()?.ownerEmail) {
                return {
                    email: salonSnap.data().ownerEmail.trim().toLowerCase(),
                    salonSlug: targetSlug
                };
            }
        }
    }
    return { email: "", salonSlug: "" };
}
```[span_6](start_span)[span_6](end_span)[span_7](start_span)[span_7](end_span)

---

### 5. Admin / Purchase: `purchase.html` (Pending Purchase Backup)
`savePendingPurchase`, `readPendingPurchase`, aur `clearPendingPurchase` ko is se update karo taaki redirect ke dauran `window.name` backup bhi rahe:

```javascript
function savePendingPurchase(payload) {
    const serialized = JSON.stringify(payload);
    try { localStorage.setItem(STORAGE_KEY, serialized); } catch (_) {}
    try { sessionStorage.setItem(STORAGE_KEY, serialized); } catch (_) {}
    try { window.name = "SALON_PENDING:" + serialized; } catch (_) {}
}

function readPendingPurchase() {
    try {
        const fromLocal = localStorage.getItem(STORAGE_KEY);
        if (fromLocal) return JSON.parse(fromLocal);
    } catch (_) {}
    try {
        const fromSession = sessionStorage.getItem(STORAGE_KEY);
        if (fromSession) return JSON.parse(fromSession);
    } catch (_) {}
    try {
        if (typeof window.name === "string" && window.name.startsWith("SALON_PENDING:")) {
            return JSON.parse(window.name.slice("SALON_PENDING:".length));
        }
    } catch (_) {}
    return null;
}

function clearPendingPurchase() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}
    try {
        if (typeof window.name === "string" && window.name.startsWith("SALON_PENDING:")) {
            window.name = "";
        }
    } catch (_) {}
}
```[span_8](start_span)[span_8](end_span)

---

Ye **Step 2** ke code updates laga lo. Jaise hi tum ye kar lo, batao—uske baad hum **Step 3 (GitHub Paths & APK Builder Link Check)** aur **Step 4 (Live End-to-End Test)** karenge!
