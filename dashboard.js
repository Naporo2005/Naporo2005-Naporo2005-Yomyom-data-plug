let allTransactions = [];

function showToast(message, variant = '') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast show ${variant}`;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.className = 'toast'; }, 3200);
}

// ---------------------------------------------------------
// AUTH GUARD
// ---------------------------------------------------------
async function guardAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = 'login.html';
});

// ---------------------------------------------------------
// TABS
// ---------------------------------------------------------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// ---------------------------------------------------------
// BUNDLES
// ---------------------------------------------------------
function formatDataLabel(mb) {
  if (mb >= 1000) {
    const gb = mb / 1000;
    return Number.isInteger(gb) ? `${gb}GB` : `${gb.toFixed(1)}GB`;
  }
  return `${mb}MB`;
}

const BUNDLE_NETWORKS = ['MTN', 'Telecel', 'AirtelTigo'];
let allAdminBundles = [];
let currentBundleNetwork = 'MTN';

function renderBundleNetworkTabs() {
  const wrap = document.getElementById('bundleNetworkTabs');
  wrap.innerHTML = BUNDLE_NETWORKS.map(n => {
    const count = allAdminBundles.filter(b => b.network === n).length;
    return `
      <button class="network-chip-btn ${n === currentBundleNetwork ? 'active' : ''}" data-network="${n}">
        <span class="swatch"></span> ${n} (${count})
      </button>`;
  }).join('');

  wrap.querySelectorAll('.network-chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentBundleNetwork = btn.dataset.network;
      renderBundleNetworkTabs();
      renderBundleList();
    });
  });
}

async function loadBundles() {
  const { data: bundles, error } = await supabaseClient
    .from('bundles')
    .select('*')
    .order('data_mb', { ascending: true });

  if (error) {
    document.getElementById('bundleList').innerHTML = `<div class="empty-state">Couldn't load bundles.</div>`;
    return;
  }
  allAdminBundles = bundles || [];
  renderBundleNetworkTabs();
  renderBundleList();
}

function renderBundleList() {
  const list = document.getElementById('bundleList');
  const bundles = allAdminBundles.filter(b => b.network === currentBundleNetwork);

  if (!bundles.length) {
    list.innerHTML = `<div class="empty-state">No ${currentBundleNetwork} bundles yet. Add one below.</div>`;
    return;
  }

  list.innerHTML = bundles.map(b => `
    <div class="admin-bundle-row ${b.enabled ? '' : 'disabled'}" data-id="${b.id}">
      <button class="bundle-toggle ${b.enabled ? 'on' : ''}" data-action="toggle" aria-label="Enable or disable"></button>
      <div class="admin-bundle-info">
        <div class="name">${b.label}</div>
        <div class="meta">${b.network} · ${formatDataLabel(b.data_mb)}</div>
      </div>
      <input type="number" step="0.01" min="0" class="price-input" value="${Number(b.price).toFixed(2)}" data-action="price">
      <button class="icon-btn" data-action="edit" aria-label="Edit">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      </button>
      <button class="icon-btn danger" data-action="delete" aria-label="Delete">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6"/></svg>
      </button>
    </div>
  `).join('');

  list.querySelectorAll('[data-action="toggle"]').forEach(el => {
    el.addEventListener('click', () => toggleBundle(el));
  });
  list.querySelectorAll('[data-action="price"]').forEach(el => {
    el.addEventListener('change', () => updatePrice(el));
  });
  list.querySelectorAll('[data-action="edit"]').forEach(el => {
    el.addEventListener('click', () => openBundleModal(allAdminBundles.find(b => b.id === el.closest('.admin-bundle-row').dataset.id)));
  });
  list.querySelectorAll('[data-action="delete"]').forEach(el => {
    el.addEventListener('click', () => confirmDeleteBundle(el.closest('.admin-bundle-row').dataset.id));
  });
}

async function toggleBundle(el) {
  const row = el.closest('.admin-bundle-row');
  const id = row.dataset.id;
  const nextState = !el.classList.contains('on');
  const { error } = await supabaseClient.from('bundles').update({ enabled: nextState }).eq('id', id);
  if (error) { showToast('Could not update bundle.', 'danger'); return; }
  el.classList.toggle('on', nextState);
  row.classList.toggle('disabled', !nextState);
  const cached = allAdminBundles.find(b => b.id === id);
  if (cached) cached.enabled = nextState;
}

async function updatePrice(el) {
  const row = el.closest('.admin-bundle-row');
  const id = row.dataset.id;
  const price = parseFloat(el.value);
  if (isNaN(price) || price < 0) { showToast('Enter a valid price.', 'danger'); return; }
  const { error } = await supabaseClient.from('bundles').update({ price }).eq('id', id);
  if (error) { showToast('Could not update price.', 'danger'); return; }
  const cached = allAdminBundles.find(b => b.id === id);
  if (cached) cached.price = price;
  showToast('Price updated.');
}

function confirmDeleteBundle(id) {
  openModal(`
    <h3>Delete this bundle?</h3>
    <p style="font-size:14px;color:var(--charcoal);">This can't be undone. Past transactions referencing it will keep their saved details.</p>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="cancelDelete">Cancel</button>
      <button class="btn btn-dark" id="confirmDelete" style="background:var(--danger);">Delete</button>
    </div>
  `);
  document.getElementById('cancelDelete').addEventListener('click', closeModal);
  document.getElementById('confirmDelete').addEventListener('click', async () => {
    const { error } = await supabaseClient.from('bundles').delete().eq('id', id);
    closeModal();
    if (error) { showToast('Could not delete bundle.', 'danger'); return; }
    showToast('Bundle deleted.');
    loadBundles();
  });
}

document.getElementById('addBundleBtn').addEventListener('click', () => openBundleModal(null));

function openBundleModal(bundle) {
  const isEdit = !!bundle;
  const defaultNetwork = isEdit ? bundle.network : currentBundleNetwork;
  openModal(`
    <h3>${isEdit ? 'Edit Bundle' : 'Add Bundle'}</h3>
    <div class="field">
      <label for="mNetwork">Network</label>
      <select id="mNetwork" class="price-input" style="width:100%; text-align:left; padding:13px 14px;">
        <option value="MTN" ${defaultNetwork === 'MTN' ? 'selected' : ''}>MTN</option>
        <option value="Telecel" ${defaultNetwork === 'Telecel' ? 'selected' : ''}>Telecel</option>
        <option value="AirtelTigo" ${defaultNetwork === 'AirtelTigo' ? 'selected' : ''}>AirtelTigo</option>
      </select>
    </div>
    <div class="field">
      <label for="mLabel">Label</label>
      <input type="text" id="mLabel" placeholder="e.g. 1GB" value="${isEdit ? bundle.label : ''}">
    </div>
    <div class="field">
      <label for="mDataMb">Data (in MB — e.g. 1000 for 1GB)</label>
      <input type="number" id="mDataMb" placeholder="1000" value="${isEdit ? bundle.data_mb : ''}">
    </div>
    <div class="field">
      <label for="mPrice">Price (GH¢)</label>
      <input type="number" step="0.01" id="mPrice" placeholder="6.00" value="${isEdit ? bundle.price : ''}">
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="cancelBundle">Cancel</button>
      <button class="btn btn-primary" id="saveBundle">${isEdit ? 'Save Changes' : 'Add Bundle'}</button>
    </div>
  `);
  document.getElementById('cancelBundle').addEventListener('click', closeModal);
  document.getElementById('saveBundle').addEventListener('click', async () => {
    const network = document.getElementById('mNetwork').value;
    const label = document.getElementById('mLabel').value.trim();
    const data_mb = parseInt(document.getElementById('mDataMb').value, 10);
    const price = parseFloat(document.getElementById('mPrice').value);

    if (!label || isNaN(data_mb) || data_mb <= 0 || isNaN(price) || price < 0) {
      showToast('Fill in all fields with valid values.', 'danger');
      return;
    }

    let error;
    if (isEdit) {
      ({ error } = await supabaseClient.from('bundles').update({ network, label, data_mb, price }).eq('id', bundle.id));
    } else {
      ({ error } = await supabaseClient.from('bundles').insert({ network, label, data_mb, price }));
    }

    closeModal();
    if (error) { showToast('Could not save bundle.', 'danger'); return; }
    showToast(isEdit ? 'Bundle updated.' : 'Bundle added.');
    loadBundles();
  });
}

// ---------------------------------------------------------
// MODAL HELPERS
// ---------------------------------------------------------
function openModal(innerHtml) {
  const root = document.getElementById('bundleModalRoot');
  root.innerHTML = `<div class="modal-backdrop" id="modalBackdrop"><div class="modal">${innerHtml}</div></div>`;
  document.getElementById('modalBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modalBackdrop') closeModal();
  });
}
function closeModal() {
  document.getElementById('bundleModalRoot').innerHTML = '';
}

// ---------------------------------------------------------
// TRANSACTIONS
// ---------------------------------------------------------
async function loadTransactions() {
  const { data, error } = await supabaseClient
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error(error);
    return;
  }
  allTransactions = data || [];
  renderStats();
  renderTransactions();
}

function renderStats() {
  const successTxns = allTransactions.filter(t => t.status === 'success');
  const total = successTxns.reduce((sum, t) => sum + Number(t.amount), 0);
  document.getElementById('statTotalSales').textContent = `GH¢${total.toFixed(2)}`;
  document.getElementById('statSuccessCount').textContent = successTxns.length;
  document.getElementById('statPendingCount').textContent = allTransactions.filter(t => t.status === 'pending').length;
  document.getElementById('statFailedCount').textContent = allTransactions.filter(t => t.status === 'failed').length;
}

function renderTransactions() {
  const search = document.getElementById('txnSearch').value.trim().toLowerCase();
  const statusFilter = document.getElementById('txnStatusFilter').value;

  const filtered = allTransactions.filter(t => {
    const matchesSearch = !search ||
      t.reference.toLowerCase().includes(search) ||
      t.beneficiary_number.includes(search) ||
      (t.payer_number && t.payer_number.includes(search));
    const matchesStatus = !statusFilter || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const tbody = document.getElementById('txnTableBody');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--charcoal);padding:24px;">No transactions found.</td></tr>`;
    return;
  }

  const canRetry = (t) => t.status === 'success' && ['failed', 'queued', 'not_started'].includes(t.delivery_status);

  tbody.innerHTML = filtered.map(t => `
    <tr>
      <td>${new Date(t.created_at).toLocaleString('en-GH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
      <td class="mono">${t.reference}</td>
      <td>${t.network} ${t.bundle_label}</td>
      <td class="mono">${t.beneficiary_number}</td>
      <td class="mono">${t.payer_number || '—'}</td>
      <td>GH¢${Number(t.amount).toFixed(2)}</td>
      <td><span class="status-pill ${t.status}">${t.status}</span></td>
      <td><span class="status-pill ${t.delivery_status}">${t.delivery_status.replace('_', ' ')}</span></td>
      <td>${canRetry(t) ? `<button class="retry-btn" data-ref="${t.reference}">Retry</button>` : ''}</td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.retry-btn').forEach(btn => {
    btn.addEventListener('click', () => reprocessDelivery(btn));
  });
}

async function reprocessDelivery(btn) {
  const reference = btn.dataset.ref;
  btn.disabled = true;
  btn.textContent = '...';

  try {
    const res = await fetch(CONFIG.REPROCESS_DELIVERY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: CONFIG.SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ reference }),
    });
    const result = await res.json();

    if (!res.ok) throw new Error(result.error || 'Retry failed');

    showToast(`Delivery status: ${result.delivery_status}`);
    loadTransactions();
  } catch (err) {
    showToast(err.message, 'danger');
    btn.disabled = false;
    btn.textContent = 'Retry';
  }
}

document.getElementById('txnSearch').addEventListener('input', renderTransactions);
document.getElementById('txnStatusFilter').addEventListener('change', renderTransactions);

// ---------------------------------------------------------
// SETTINGS
// ---------------------------------------------------------
async function loadSettings() {
  const { data, error } = await supabaseClient
    .from('settings')
    .select('paystack_public_key')
    .eq('id', true)
    .single();

  if (!error && data) {
    document.getElementById('publicKey').value = data.paystack_public_key || '';
  }
  // Secret key is intentionally never loaded back into the browser.
}

document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
  const publicKey = document.getElementById('publicKey').value.trim();
  const secretKey = document.getElementById('secretKey').value.trim();
  const rxKey = document.getElementById('rxKey').value.trim();

  const update = { paystack_public_key: publicKey };
  if (secretKey) update.paystack_secret_key = secretKey;
  if (rxKey) update.affordabledata_api_key = rxKey;

  const { error } = await supabaseClient.from('settings').update(update).eq('id', true);
  if (error) { showToast('Could not save settings.', 'danger'); return; }
  document.getElementById('secretKey').value = '';
  document.getElementById('rxKey').value = '';
  showToast('Settings saved.');
});

document.getElementById('loadPlansBtn').addEventListener('click', async () => {
  const container = document.getElementById('providerPlansList');
  const network = document.getElementById('plansNetworkSelect').value;
  container.textContent = 'Loading...';
  try {
    const res = await fetch(CONFIG.PROVIDER_PLANS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: CONFIG.SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ network }),
    });
    const rawText = await res.text();
    let plans;
    try { plans = JSON.parse(rawText); } catch { plans = null; }

    if (!res.ok || !plans) {
      const detail = plans?.error?.code || plans?.error?.message || plans?.error || plans?.message || rawText || 'no response body';
      throw new Error(`HTTP ${res.status}: ${detail}`);
    }
    if (!Array.isArray(plans) || !plans.length) {
      container.textContent = `No packages returned. Raw response: ${JSON.stringify(plans)}`;
      return;
    }

    container.innerHTML = `
      <div style="max-height:220px; overflow-y:auto; margin-top:4px;">
        ${plans.map(p => `
          <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--line); font-size:13px;">
            <span class="mono">${p.volume}</span>
            <span>GH¢${Number(p.price).toFixed(2)}</span>
          </div>
        `).join('')}
      </div>`;
  } catch (err) {
    container.textContent = err.message;
    console.error('Load Plans error:', err);
  }
});

// ---------------------------------------------------------
// INIT
// ---------------------------------------------------------
(async function init() {
  const ok = await guardAuth();
  if (!ok) return;
  loadBundles();
  loadTransactions();
  loadSettings();
})();
