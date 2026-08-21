const params = new URLSearchParams(window.location.search);
const ref = params.get('ref');
let failedTxn = null;

async function init() {
  if (ref) {
    document.getElementById('refCard').hidden = false;
    document.getElementById('txRef').textContent = ref;

    const { data: txn } = await supabaseClient
      .from('public_transaction_lookup')
      .select('*')
      .eq('reference', ref)
      .single();
    failedTxn = txn || null;
  }
}

document.getElementById('retryBtn').addEventListener('click', () => {
  // Rebuild the order in sessionStorage in case it was lost (e.g. after a reload)
  if (!sessionStorage.getItem('dataplug_order') && failedTxn) {
    sessionStorage.setItem('dataplug_order', JSON.stringify({
      id: failedTxn.bundle_id,
      label: failedTxn.bundle_label,
      price: failedTxn.amount,
      network: failedTxn.network,
    }));
  }

  if (sessionStorage.getItem('dataplug_order')) {
    window.location.href = 'checkout.html';
  } else {
    window.location.href = 'index.html';
  }
});

init();
