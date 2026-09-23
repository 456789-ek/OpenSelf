import { createRoot } from 'react-dom/client';
import ParticleText from '../components/ParticleText.jsx';

const mount = document.getElementById('openself-title');

if (mount) {
  const word = mount.closest('.word');

  createRoot(mount).render(
    <ParticleText
      text="openself"
      color="#f7f1e6"
      highlightColor="#e8b06a"
      fontFamily='"Openself Display", Syne, sans-serif'
      fontWeight={700}
      fontSize="clamp(3.15rem, 13vw, 8.6rem)"
      style={{ height: '100%', minHeight: 0 }}
    />
  );

  if (word) {
    const fallback = word.querySelector('.word-fallback');
    if (fallback) fallback.setAttribute('aria-hidden', 'true');
    word.classList.add('is-ready');
  }
}
