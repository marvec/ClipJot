declare global {
  interface Window {
    grecaptcha: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

const RECAPTCHA_SITE_KEY = import.meta.env.PUBLIC_RECAPTCHA_SITE_KEY as string;
const SUBSCRIBE_URL = import.meta.env.PUBLIC_SUBSCRIBE_URL as string;

let scriptLoaded = false;

function loadRecaptcha(): Promise<void> {
  return new Promise((resolve) => {
    if (scriptLoaded) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.onload = () => {
      scriptLoaded = true;
      resolve();
    };
    document.head.appendChild(script);
  });
}

async function getRecaptchaToken(): Promise<string> {
  await loadRecaptcha();
  return new Promise((resolve, reject) => {
    window.grecaptcha.ready(() => {
      window.grecaptcha
        .execute(RECAPTCHA_SITE_KEY, { action: 'subscribe' })
        .then(resolve)
        .catch(reject);
    });
  });
}

export async function subscribeEmail(email: string): Promise<void> {
  const token = await getRecaptchaToken();

  const response = await fetch(SUBSCRIBE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, token }),
  });

  if (!response.ok) {
    throw new Error(`Subscription failed: ${response.status}`);
  }
}
