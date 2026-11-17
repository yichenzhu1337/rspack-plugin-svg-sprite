// Chapter timestamps of the intro video become buttons that seek the player.
// Without JavaScript they stay as plain text.
const video = document.querySelector('.intro-video video');

if (video) {
  document.querySelectorAll('#video-chapters .ts').forEach((ts) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ts';
    button.textContent = ts.textContent;
    button.setAttribute('aria-label', `Play from ${ts.textContent}`);
    button.addEventListener('click', () => {
      video.currentTime = Number(ts.dataset.t);
      video.play().catch(() => {});
    });
    ts.replaceWith(button);
  });
}
