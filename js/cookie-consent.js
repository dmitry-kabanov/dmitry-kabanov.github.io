const DAYS_COOKIES_DURATION = 30;

// ISO 3166-1 alpha-2 codes for EU/EEA, UK, and Switzerland
const GDPR_COUNTRIES_LIST = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO',
  'GB', 'CH'
];

const CONSENT_STATE = Object.freeze({
    UNDECIDED: "undecided",
    ACCEPTED: "accepted",
    REJECTED: "rejected",
});

let consentState = CONSENT_STATE.UNDECIDED;

function setCookieConsentState(nextConsentState, { saveCookieConsent = true} = {}) {
    const prevConsentState = consentState;
    consentState = nextConsentState;

    switch (consentState) {
        case CONSENT_STATE.UNDECIDED:
            // Show the banner after a short delay
            // to not distract the user immediately from the page itself.
            showBanner(300);
            break;
        case CONSENT_STATE.ACCEPTED:
            updateConsent("granted");
            if (prevConsentState == CONSENT_STATE.REJECTED) {
                gtag("event", "page_view");
            }
            if (saveCookieConsent && prevConsentState != CONSENT_STATE.ACCEPTED) {
                setCookie('cookie_consent', CONSENT_STATE.ACCEPTED, DAYS_COOKIES_DURATION);
            }
            hideBanner();
            break;
        case CONSENT_STATE.REJECTED:
            updateConsent("denied");
            deleteGoogleAnalyticsCookies();
            if (saveCookieConsent && prevConsentState != CONSENT_STATE.REJECTED) {
                setCookie('cookie_consent', CONSENT_STATE.REJECTED, DAYS_COOKIES_DURATION);
            }
            hideBanner();
            break;
        default:
            console.warn("Unknown consent state: " + consentState);
    }
}

function deleteCookie(name) {
    const expires = "expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    document.cookie = `${name}=;${expires}`;
    const parts = window.location.hostname.split(".");
    while (parts.length > 0) {
        const domain = parts.join(".");
        document.cookie = `${name}=;${expires};domain=${domain}`;
        document.cookie = `${name}=;${expires};domain=.${domain}`;
        parts.shift();
    }
}

function deleteGoogleAnalyticsCookies() {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
        const name = cookie.split("=")[0].trim();
        if (/^(_ga|_gid|_gat)/.test(name)) {
            deleteCookie(name);
        }
    }
}

function updateConsent(status) {
    gtag("consent", "update", {
        "ad_user_data": status,
        "ad_personalization": status,
        "ad_storage": status,
        "analytics_storage": status
    });
}

function setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = name + "=" + value + ";expires=" + d.toUTCString() + ";path=/;SameSite=Lax";
}

function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
}

function showBanner(delay = 0) {
    setTimeout(() => {
        document.getElementById("cookie-consent-banner")?.classList.add("visible");
        const link = document.getElementById("change-cookie-settings");
        if (link) {
            link.style.display = "none";
        }
    }, delay);
}

function hideBanner() {
    document.getElementById("cookie-consent-banner")?.classList.remove("visible");
    const link = document.getElementById("change-cookie-settings");
    if (link) {
        link.style.display = "inline";
    }
}

async function checkGDPRLocation() {
    let checkers = [];

    if (Math.random() < 0.5) {
        checkers = [checkViaApiCountryIs, checkViaCloudflare];
    } else {
        checkers = [checkViaCloudflare, checkViaApiCountryIs];
    }

    let countryCode = null;

    for (const checker of checkers) {
        try{
            countryCode = await checker(2000);
            if (countryCode) {
                break;
            }
        } catch (error) {
            console.warn("Could not check for GDPR country: " + error);
        }
    }

    if (countryCode) {
        return GDPR_COUNTRIES_LIST.includes(countryCode);
    }

    console.warn("Could not determine country code, defaulting to GDPR.");
    return true;  // Fallback to GDPR for legal safety.
}

async function checkViaApiCountryIs(timeout) {
    const response = await fetch("https://api.country.is", {
        signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
        throw new Error("[checkViaApiCountryIs] Response status: " + response.status);
    }

    const data = await response.json();
    const country = (data.country || "").toUpperCase();
    if (!country) {
        throw new Error("[checkViaApiCountryIs] No country code");
    }

    return country;
}

async function checkViaCloudflare(timeout) {
    const response = await fetch("https://cloudflare.com/cdn-cgi/trace", {
        signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
        throw new Error("[checkViaCloudflare] Response status: " + response.status);
    }

    const data = await response.text();
    const match = data.match(/^loc=([A-Z]{2})$/m);
    if (!match || !match[1]) {
        throw new Error("[checkViaCloudflare] No country code found");
    }

    return match[1];
}

document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById('cookies-reject-btn')
        ?.addEventListener("click", () => setCookieConsentState(CONSENT_STATE.REJECTED));
    document.getElementById('cookies-accept-btn')
        ?.addEventListener("click", () => setCookieConsentState(CONSENT_STATE.ACCEPTED));

    document.getElementById("change-cookie-settings")?.addEventListener("click", (event) => {
        event.preventDefault();
        showBanner();
    });

    // TODO: Remove this block on 2027-11-01
    const cachedCountryCookie = getCookie("cached_country");
    if (cachedCountryCookie) {
        deleteCookie("cached_country");
    }

    const consentCookieValue = getCookie("cookie_consent");

    if (consentCookieValue == CONSENT_STATE.ACCEPTED || consentCookieValue == CONSENT_STATE.REJECTED) {
        setCookieConsentState(consentCookieValue, { saveCookieConsent: false });
        return;
    }

    // Visitor has not accepted or rejected cookies.
    const isGDPRLocation = await checkGDPRLocation();

    if (isGDPRLocation) {
        setCookieConsentState(CONSENT_STATE.UNDECIDED, { saveCookieConsent: false });
    } else {
        setCookieConsentState(CONSENT_STATE.ACCEPTED, { saveCookieConsent: false });
    }
});

