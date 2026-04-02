const BUTTONDOWN_URL =
  'https://buttondown.com/api/emails/embed-subscribe/clipjot';

export async function subscribeEmail(email: string): Promise<void> {
  const body = new URLSearchParams({ email });

  const response = await fetch(BUTTONDOWN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Subscription failed: ${response.status}`);
  }
}
