import { useState } from 'react';
import { Button } from './ui/button';
import { SubscribeDialog } from './SubscribeDialog';
import { DOWNLOADS, type Platform } from '@/lib/download-config';

export default function DownloadButtons() {
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleDownload(platform: Platform) {
    // Trigger the download
    const link = document.createElement('a');
    link.href = DOWNLOADS[platform].url;
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Show subscription dialog once per session, unless already subscribed
    const alreadySubscribed = sessionStorage.getItem('clipjot_subscribed_session');
    const alreadyShown = sessionStorage.getItem('clipjot_dialog_shown');

    if (!alreadySubscribed && !alreadyShown) {
      sessionStorage.setItem('clipjot_dialog_shown', '1');
      // Small delay so the download starts first
      setTimeout(() => setDialogOpen(true), 500);
    }
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Button
          size="lg"
          className="w-full sm:w-auto gap-2 text-base px-6 cursor-pointer"
          onClick={() => handleDownload('macos')}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
          </svg>
          Download for macOS
        </Button>

        <Button
          size="lg"
          variant="outline"
          className="w-full sm:w-auto gap-2 text-base px-6 cursor-pointer bg-(--background)"
          onClick={() => handleDownload('windows')}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
          </svg>
          Download for Windows
        </Button>
      </div>

      <SubscribeDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
}
