function getOrder() {
  const raw = sessionStorage.getItem('dataplug_order');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function showToast(message, variant = '') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast show ${variant}`;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.className = 'toast'; }, 3500);
}

function isValidNumber(num) {
  const digits = num.replace(/\D/g, '');
  // Ghana mobile numbers: 10 digits, starting 0, second digit 2 or 5.
  // Not checking against a specific network's prefixes, since mobile
  // number portability means a number can keep its original prefix
  // even after switching networks.
  return /^0[25]\d{8}$/.test(digits);
}

function generateReference() {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `DP-${Date.now()}-${rand}`;
}

function setLoading(loading) {
  const btn = document.getElementById('payBtn');
  btn.classList.toggle('loading', loading);
  btn.disabled = loading;
}

const order = getOrder();
if (!order) {
  window.location.href = 'index.html';
}

// Paystack's transaction fee, passed on to the customer so the business
// nets the full listed bundle price. All math done in pesewas (integers)
// to avoid floating-point rounding errors.
const PAYSTACK_FEE_RATE = 0.0195;

function calculatePaystackFee(dataPrice) {
  const pricePesewas = Math.round(dataPrice * 100);
  const customerPaysPesewas = Math.ceil(pricePesewas / (1 - PAYSTACK_FEE_RATE));
  const paystackFeePesewas = customerPaysPesewas - pricePesewas;
  return {
    pricePesewas,
    customerPaysPesewas,
    paystackFeePesewas,
    netAmount: pricePesewas / 100,
    customerPays: customerPaysPesewas / 100,
    paystackFee: paystackFeePesewas / 100,
  };
}

const fees = calculatePaystackFee(Number(order.price));

document.getElementById('sumNetwork').textContent = order.network;
document.getElementById('sumBundle').textContent = order.label;
document.getElementById('sumPrice').textContent = `GH¢${fees.customerPays.toFixed(2)}`;
document.getElementById('beneficiaryLabel').textContent = `Beneficiary ${order.network} number (receives the data)`;

const beneficiaryInput = document.getElementById('beneficiary');
const confirmInput = document.getElementById('confirmBeneficiary');
const beneficiaryError = document.getElementById('beneficiaryError');
const confirmError = document.getElementById('confirmError');
const payerInput = document.getElementById('payerNumber');
const payerError = document.getElementById('payerError');

[beneficiaryInput, confirmInput, payerInput].forEach(input => {
  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '').slice(0, 10);
  });
});

async function handlePay() {
  const number = beneficiaryInput.value.trim();
  const confirmNumber = confirmInput.value.trim();
  const payerNumber = payerInput.value.trim();
  const numberValid = isValidNumber(number);
  let hasError = false;
  beneficiaryInput.classList.toggle('error', !numberValid);
  beneficiaryError.classList.toggle('show', !numberValid);
  if (!numberValid) hasError = true;

  const numbersMatch = numberValid && number === confirmNumber;
  confirmInput.classList.toggle('error', !numbersMatch);
  confirmError.classList.toggle('show', !numbersMatch);
  if (!numbersMatch) hasError = true;

  const payerValid = isValidNumber(payerNumber);
  payerInput.classList.toggle('error', !payerValid);
  payerError.classList.toggle('show', !payerValid);
  if (!payerValid) hasError = true;

  if (hasError) return;

  setLoading(true);

  try {
    const { data: settingsRow, error: settingsError } = await supabaseClient
      .from('public_settings')
      .select('paystack_public_key')
      .single();

    if (settingsError || !settingsRow?.paystack_public_key) {
      throw new Error('Payments are not configured yet. Please try again later.');
    }

    const reference = generateReference();

    const { error: insertError } = await supabaseClient.from('transactions').insert({
      reference,
      bundle_id: order.id,
      bundle_label: order.label,
      network: order.network,
      amount: fees.customerPays,
      net_amount: fees.netAmount,
      paystack_fee: fees.paystackFee,
      beneficiary_number: number,
      payer_number: payerNumber,
      status: 'pending',
      channel: 'mobile_money',
    });

    if (insertError) throw insertError;

    const popup = new PaystackPop();
    popup.newTransaction({
      key: settingsRow.paystack_public_key,
      email: `${payerNumber}@gmail.com`,
      amount: fees.customerPaysPesewas,
      currency: 'GHS',
      ref: reference,
      channels: ['mobile_money'],
      metadata: {
        network: order.network,
        bundle: order.label,
        beneficiary_number: number,
        payer_number: payerNumber,
        custom_fields: [
          { display_name: 'Bundle', variable_name: 'bundle', value: order.label },
          { display_name: 'Beneficiary Number', variable_name: 'beneficiary_number', value: number },
          { display_name: 'Payer Number', variable_name: 'payer_number', value: payerNumber },
        ],
      },
      onSuccess: async () => {
        await verifyAndRedirect(reference);
      },
      onCancel: () => {
        setLoading(false);
        showToast('Payment cancelled.');
      },
      onError: () => {
        setLoading(false);
        window.location.href = `failed.html?ref=${encodeURIComponent(reference)}`;
      },
    });
  } catch (err) {
    console.error(err);
    setLoading(false);
    showToast(err.message || 'Something went wrong. Please try again.', 'danger');
  }
}

async function verifyAndRedirect(reference) {
  try {
    const res = await fetch(CONFIG.VERIFY_PAYMENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: CONFIG.SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ reference }),
    });
    const result = await res.json();

    if (result.status === 'success') {
      sessionStorage.removeItem('dataplug_order');
      window.location.href = `success.html?ref=${encodeURIComponent(reference)}`;
    } else {
      window.location.href = `failed.html?ref=${encodeURIComponent(reference)}`;
    }
  } catch (err) {
    console.error(err);
    window.location.href = `failed.html?ref=${encodeURIComponent(reference)}`;
  }
}

document.getElementById('payBtn').addEventListener('click', handlePay);
