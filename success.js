async function loadTransaction() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');

  if (!ref) {
    window.location.href = 'index.html';
    return;
  }

  const { data: txn, error } = await supabaseClient
    .from('public_transaction_lookup')
    .select('*')
    .eq('reference', ref)
    .single();

  if (error || !txn || txn.status !== 'success') {
    window.location.href = `failed.html?ref=${encodeURIComponent(ref)}`;
    return;
  }

  document.getElementById('txRef').textContent = txn.reference;
  document.getElementById('txBeneficiary').textContent = txn.beneficiary_number;
  document.getElementById('txBundle').textContent = `${txn.network} ${txn.bundle_label}`;
  document.getElementById('txAmount').textContent = `GH¢${Number(txn.amount).toFixed(2)}`;
}

loadTransaction();
