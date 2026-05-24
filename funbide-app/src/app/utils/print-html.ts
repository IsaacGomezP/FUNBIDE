export interface PrintHtmlOptions {
  closeDelayMs?: number;
  printDelayMs?: number;
  onError?: (error: unknown) => void;
}

export function printHtmlInHiddenFrame(html: string, options: PrintHtmlOptions = {}): () => void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.zIndex = '-1';

  const closeDelayMs = options.closeDelayMs ?? 1500;
  const printDelayMs = options.printDelayMs ?? 50;

  let disposed = false;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;

  const cleanup = () => {
    if (disposed) return;
    disposed = true;

    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }

    try {
      const win = iframe.contentWindow;
      if (win) {
        win.onafterprint = null;
      }
    } catch {
      // Ignore cleanup errors if the frame is already gone.
    }

    iframe.remove();
  };

  iframe.onload = () => {
    window.setTimeout(() => {
      try {
        const win = iframe.contentWindow;
        if (!win) {
          throw new Error('No se pudo preparar la ventana de impresión');
        }

        win.onafterprint = () => {
          cleanup();
        };

        win.focus();
        win.print();

        closeTimer = window.setTimeout(cleanup, closeDelayMs);
      } catch (error) {
        cleanup();
        options.onError?.(error);
      }
    }, printDelayMs);
  };

  document.body.appendChild(iframe);
  iframe.srcdoc = html;

  return cleanup;
}
