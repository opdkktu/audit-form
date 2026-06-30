/**
 * spectrum.js
 * -----------
 * Renders the "Compliance Spectrum" — the 6-segment gauge that mirrors
 * the official JKN Kedah scoring scale. One function, reused on the
 * form's result screen and the state dashboard, so a score always
 * looks the same wherever it appears.
 */
(function () {
  function renderSpectrum(container, percentage) {
    const pct = Math.max(0, Math.min(100, percentage));
    const segs = KATEGORI_SCALE.slice().reverse(); // render low -> high (left -> right)

    const track = segs.map(t =>
      `<div class="spectrum-seg" style="background:${t.color}" title="${t.label} (${t.min}-${t.max}%)"></div>`
    ).join("");

    container.innerHTML = `
      <div class="spectrum-marker-wrap">
        <div class="spectrum-marker" style="left:${pct}%">
          <div class="spectrum-marker__dot"></div>
        </div>
      </div>
      <div class="spectrum-track">${track}</div>
      <div class="spectrum-labels"><span>0%</span><span>20%</span><span>40%</span><span>60%</span><span>80%</span><span>100%</span></div>
    `;
  }

  window.renderSpectrum = renderSpectrum;
})();
