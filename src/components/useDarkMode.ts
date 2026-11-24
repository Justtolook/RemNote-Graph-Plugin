import { useEffect, useState } from 'react';

/** RemNote toggles a `dark`/`light` class on the plugin iframe's body. */
export function useDarkMode(): boolean {
  const read = () => document.body.classList.contains('dark');
  const [dark, setDark] = useState(read);
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(read()));
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}
