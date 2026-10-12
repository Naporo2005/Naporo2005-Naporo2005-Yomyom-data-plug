const GAUGE_R = 22;
const GAUGE_C = 2 * Math.PI * GAUGE_R;
const NETWORKS = ['MTN', 'Telecel', 'AirtelTigo'];

let allBundles = [];
let currentNetwork = 'MTN';

function showToast(message, variant = '') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast show ${variant}`;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.className = 'toast'; }, 3200);
}

function formatDataLabel(mb) {
  if (mb >= 1000) {
    const gb = mb / 1000;
    return Number.isInteger(gb) ? `${gb}GB` : `${gb.toFixed(1)}GB`;
  }
  return `${mb}MB`;
}

function gaugeSVG(ratio) {
  const offset = GAUGE_C * (1 - ratio);
  return `
    <svg width="52" height="52" viewBox="0 0 52 52">
      <circle class="gauge-ring-bg" cx="26" cy="26" r="${GAUGE_R}" fill="none" stroke-width="4"></circle>
      <circle class="gauge-ring-fg" cx="26" cy="26" r="${GAUGE_R}" fill="none" stroke-width="4"
        stroke-dasharray="${GAUGE_C}" stroke-dashoffset="${offset}"></circle>
    </svg>`;
}

function renderNetworkTabs() {
  const wrap = document.getElementById('networkTabs');
  wrap.innerHTML = NETWORKS.map(n => `
    <button class="network-chip-btn ${n === currentNetwork ? 'active' : ''}" data-network="${n}">
      <span class="swatch"></span> ${n}
    </button>
  `).join('');

  wrap.querySelectorAll('.network-chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentNetwork = btn.dataset.network;
      renderNetworkTabs();
      renderBundles();
    });
  });
}

async function loadBundles() {
  const grid = document.getElementById('bundleGrid');
  const bigLoader = document.getElementById('bigLoader');

  try {
    const { data: bundles, error } = await supabaseClient
      .from('bundles')
      .select('*')
      .eq('enabled', true)
      .order('data_mb', { ascending: true });

    if (error) throw error;
    allBundles = bundles || [];
    renderBundles();
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">Couldn't load bundles. Check your connection and try again.</div>`;
  } finally {
    // Swap the big loader out for the real grid either way — on error the
    // grid shows the "couldn't load" message instead of bundle cards.
    bigLoader.style.display = 'none';
    grid.style.display = 'grid';
    grid.classList.add('is-loaded');
  }
}

function renderBundles() {
  const grid = document.getElementById('bundleGrid');
  grid.classList.remove('network-mtn', 'network-telecel', 'network-airteltigo');
  grid.classList.add(`network-${currentNetwork.toLowerCase()}`);

  const bundles = allBundles.filter(b => (b.network || 'MTN').toLowerCase() === currentNetwork.toLowerCase());

  if (!bundles.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">No ${currentNetwork} bundles available right now.</div>`;
    return;
  }

  const maxMb = Math.max(...bundles.map(b => b.data_mb));

  grid.innerHTML = bundles.map(b => {
    const ratio = b.data_mb / maxMb;
    return `
      <button class="bundle-card fade-up" data-id="${b.id}"
        data-label="${b.label}" data-price="${b.price}" data-network="${b.network}">
        <div class="gauge-wrap">
          ${gaugeSVG(ratio)}
          <div class="gauge-label">${formatDataLabel(b.data_mb)}</div>
        </div>
        <div class="bundle-label">${b.label}</div>
        <div class="bundle-sub">${b.network} · Non‑expiry*</div>
        <div class="bundle-price">GH¢${Number(b.price).toFixed(2)}</div>
      </button>`;
  }).join('');

  grid.querySelectorAll('.bundle-card').forEach(card => {
    card.addEventListener('click', () => selectBundle(card));
  });
}

function selectBundle(card) {
  document.querySelectorAll('.bundle-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');

  const order = {
    id: card.dataset.id,
    label: card.dataset.label,
    price: card.dataset.price,
    network: card.dataset.network,
  };
  sessionStorage.setItem('dataplug_order', JSON.stringify(order));

  setTimeout(() => { window.location.href = 'checkout.html'; }, 180);
}

// Shows the admin-written announcement box (same slot as the weekend
// banner) only when there's an active row to fetch. RLS on the
// `announcements` table means this query returns nothing at all when the
// admin has it switched off, so there's no extra "is it on?" check needed
// here beyond "did we get a row back".
async function loadAnnouncement() {
  try {
    const { data, error } = await supabaseClient
      .from('announcements')
      .select('message')
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const message = (data?.message || '').trim();
    if (!message) return;

    document.getElementById('announcementText').textContent = message;
    document.getElementById('announcementBanner').style.display = 'flex';
  } catch (err) {
    // Silently skip — a broken announcement fetch should never block the
    // rest of the store from loading.
    console.error(err);
  }
}

// Shows the admin-written promotion banner, fully free-text (same pattern
// as loadAnnouncement() above — write the whole message yourself in the
// dashboard, flip it on/off there). RLS on `promotion_banner` means this
// query returns nothing at all when the admin has it switched off, so
// there's no separate "is it on?" check needed, and no automatic
// day-of-week logic — you control exactly when it's visible from the
// dashboard toggle.
async function loadPromotionBanner() {
  try {
    const { data, error } = await supabaseClient
      .from('promotion_banner')
      .select('message')
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const message = (data?.message || '').trim();
    if (!message) return;

    document.getElementById('promotionText').textContent = message;
    document.getElementById('promotionBanner').style.display = 'block';
  } catch (err) {
    // A broken promo-banner fetch should never block the rest of the
    // store from loading.
    console.error(err);
  }
}

window.addEventListener('scroll', () => {
  document.getElementById('topbar').classList.toggle('scrolled', window.scrollY > 4);
});

renderNetworkTabs();
loadBundles();
loadAnnouncement();
loadPromotionBanner();
