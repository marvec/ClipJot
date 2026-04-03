import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { subscribeEmail } from '@/lib/subscribe';

type FormState = 'idle' | 'loading' | 'success' | 'error';

const BASE = import.meta.env.BASE_URL as string;

export default function SubscribeForm() {
  const [state, setState] = useState<FormState>('idle');
  const [email, setEmail] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [emailError, setEmailError] = useState('');

  function validateEmail(value: string): boolean {
    if (!value) {
      setEmailError('Please enter your email address');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateEmail(email)) return;

    setState('loading');
    try {
      await subscribeEmail(email);
      setState('success');
      sessionStorage.setItem('clipjot_subscribed_session', '1');
    } catch {
      setState('error');
    }
  }

  if (state === 'success') {
    return (
      <div className="text-center py-4">
        <div className="mb-3 flex justify-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: 'color-mix(in srgb, var(--feedback-success) 15%, transparent)' }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--feedback-success)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>
        <p className="font-semibold text-[var(--foreground)]">You're subscribed!</p>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          We'll keep you posted on ClipJot updates.
        </p>
      </div>
    );
  }

  const isSubmitDisabled = !agreed || state === 'loading' || !email;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 space-y-1.5">
          <Input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) validateEmail(e.target.value);
            }}
            disabled={state === 'loading'}
            autoComplete="email"
            aria-label="Email address"
            aria-describedby={emailError ? 'form-email-error' : undefined}
          />
          {emailError && (
            <p id="form-email-error" className="text-xs text-[var(--destructive)]">
              {emailError}
            </p>
          )}
        </div>

        <Button type="submit" disabled={isSubmitDisabled} className="w-full sm:w-auto cursor-pointer">
          {state === 'loading' ? (
            <span className="flex items-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Subscribing…
            </span>
          ) : (
            'Get updates'
          )}
        </Button>
      </div>

      <div className="flex items-start gap-3">
        <Checkbox
          id="form-gdpr"
          checked={agreed}
          onCheckedChange={(checked) => setAgreed(checked === true)}
          disabled={state === 'loading'}
          className="mt-0.5"
        />
        <Label
          htmlFor="form-gdpr"
          className="text-xs font-normal text-[var(--muted-foreground)] leading-relaxed cursor-pointer"
        >
          I agree to the{' '}
          <a
            href={`${BASE}terms`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-[var(--foreground)]"
          >
            Terms and Conditions
          </a>{' '}
          and{' '}
          <a
            href={`${BASE}privacy`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-[var(--foreground)]"
          >
            Privacy Policy
          </a>
          .
        </Label>
      </div>

      {state === 'error' && (
        <p className="text-sm text-[var(--destructive)]">
          Something went wrong — please try again.
        </p>
      )}
    </form>
  );
}
