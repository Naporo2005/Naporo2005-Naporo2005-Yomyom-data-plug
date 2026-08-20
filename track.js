function isValidNumber(num) {
  const digits = num.replace(/\D/g, '');
  return /^0[25]\d{8}$/.test(digits);
}

function statusLabel(status, deliveryStatus) {
  if (status !== 'success') return 'Payment not completed';
  const map = {
    success: 'Delivered',
    processing: 'Processing — on its way',
    queued: 'Queued for delivery',
    failed: 'Delivery issue — contact us',
    not_started: 'Preparing your order',
  };
  return map[deliveryStatus] || 'Processing';
}

function statusClass(status, deliveryStatus) {
  if (status !== 'success') return 'failed';
  if (deliveryStatus === 'success') return 'success';
  if (deliveryStatus === 'failed') return 'failed';
  return 'pending';
}

const phoneInput = document.getElementById('trackPhone');
phoneInput.addEventListener('input', () => {
  phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 10);
});

async function checkOrders() {
  const phone = phoneInput.value.trim();
  const valid = isValidNumber(phone);
  phoneInput.classList.toggle('error', !valid);
  document.getElementById('trackError').classList.toggle('show', !valid);
  if (!valid) return;

  const btn = document.getElementById('trackBtn');
  btn.classList.add('loading');
  btn.disabled = true;

  const resultsList = document.getElementById('resultsList');
  resultsList.innerHTML = '';

  try {
    // Only select non-sensitive fields — never expose payer_number or amount
    // to a phone-number-only lookup.
    const { data: orders, error } = await supabaseClient
      .from('transactions')
      .select('reference, network, bundle_label, status, delivery_status, created_at')
      .eq('beneficiary_number', phone)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    if (!orders || !orders.length) {
      resultsList.innerHTML = `<div class="empty-state">No orders found for this number.</div>`;
      return;
    }

    resultsList.innerHTML = orders.map(o => `
      <div class="summary-card fade-up" style="margin-bottom:12px; padding:16px 18px;">
        <div class="summary-row">
          <span class="k">${o.network} · ${o.bundle_label}</span>
          <span class="status-pill ${statusClass(o.status, o.delivery_status)}">${statusLabel(o.status, o.delivery_status)}</span>
        </div>
        <div class="summary-row">
          <span class="k">REF</span>
          <span class="v mono" style="font-size:12px;">${o.reference}</span>
        </div>
        <div class="summary-row">
          <span class="k">DATE</span>
          <span class="v" style="font-size:12px;">${new Date(o.created_at).toLocaleString('en-GH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
    resultsList.innerHTML = `<div class="empty-state">Couldn't load orders. Check your connection and try again.</div>`;
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

document.getElementById('trackBtn').addEventListener('click', checkOrders);
phoneInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') checkOrders(); });
