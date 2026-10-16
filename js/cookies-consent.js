const DAYS_COOKIES_DURATION = 30;

// ISO 3166-1 alpha-2 codes for EU/EEA, UK, and Switzerland
const GDPR_COUNTRIES_LIST = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO',
  'GB', 'CH'
];

function onCookiesAccepted() {
    updateConsent("granted");
    setCookie('cookie_consent', 'accepted', DAYS_COOKIES_DURATION);
    document.getElementById('cookies-consent-banner').style.display = 'none';
}

function onCookiesRejected() {
    updateConsent("denied");
    setCookie('cookie_consent', 'rejected', DAYS_COOKIES_DURATION);
    document.getElementById('cookies-consent-banner').style.display = 'none';
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

function showBanner() {
    const banner = document.getElementById("cookies-consent-banner");
    if (banner) {
        banner.style.display = 'block';
    }
}

function hideBanner() {
    const banner = document.getElementById("cookies-consent-banner");
    if (banner) {
        banner.style.display = 'none';
    }
}

async function checkGDPRLocation() {
	const cachedCountry = getCookie("cached_country");
	if (cachedCountry) {
		return GDPR_COUNTRIES_LIST.includes(cachedCountry);
	}

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
        setCookie("cached_country", countryCode, DAYS_COOKIES_DURATION);
        return GDPR_COUNTRIES_LIST.includes(countryCode);
    }

    console.warn("Could not determine country code, defaulting to GDPR.");
    return true;  // Fallback to GDPR for legal safety.
}

async function checkViaApiCountryIs(timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort, timeout);
    const response = await fetch("https://api.country.is", {
        signal: controller.signal,
    });
    clearTimeout(timeoutId);

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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort, timeout);
    const response = await fetch("https://cloudflare.com/cdn-cgi/trace", {
        signal: controller.signal,
    });
    clearTimeout(timeoutId);

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
    const consentCookieValue = getCookie("cookie_consent");

    if (consentCookieValue == "accepted") {
        updateConsent("granted");
        return;
    }

    if (consentCookieValue == "rejected") {
        updateConsent("denied");
        return;
    }

    // Visitor has not accepted or rejected cookies.
    const isGDPRLocation = await checkGDPRLocation();

    if (isGDPRLocation) {
        showBanner();
        const rejectButton = document.getElementById('cookies-reject-btn');
        const acceptButton = document.getElementById('cookies-accept-btn');
        rejectButton.addEventListener("click", onCookiesRejected);
        acceptButton.addEventListener("click", onCookiesAccepted);
    } else {
        updateConsent("granted");
    }
});

